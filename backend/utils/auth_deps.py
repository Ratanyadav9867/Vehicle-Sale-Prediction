"""
backend/utils/auth_deps.py
==========================
FastAPI dependencies for token extraction, user authentication,
role-based authorization, and client IP/User-Agent resolution.
"""

from typing import Any, Dict, Optional
from fastapi import Header, HTTPException, Request, status
from backend.db.database import get_user_from_token, log_activity


import os as _auth_os

import ipaddress
from typing import List, Set, Union

# SECURITY FIX: Only trust X-Forwarded-For and X-Forwarded-Proto when the direct TCP
# peer is a known trusted reverse proxy or load balancer. Arbitrary internet clients
# setting these headers will be ignored to prevent IP spoofing, rate-limit evasion,
# and HTTPS enforcement bypass.
# Supports single IPs ("127.0.0.1") and CIDR subnets ("172.16.0.0/12,10.0.0.0/8").

_NAMED_TRUSTED_HOSTS: Set[str] = {"127.0.0.1", "::1", "localhost", "testclient"}

def _parse_trusted_networks() -> List[Union[ipaddress.IPv4Network, ipaddress.IPv6Network]]:
    networks = []
    raw = _auth_os.getenv("TRUSTED_PROXY_IPS", "127.0.0.1,::1,testclient,localhost")
    for item in raw.split(","):
        item = item.strip()
        if not item or item in ("testclient", "localhost"):
            continue
        try:
            if "/" in item:
                networks.append(ipaddress.ip_network(item, strict=False))
            else:
                networks.append(ipaddress.ip_network(f"{item}/32" if ":" not in item else f"{item}/128", strict=False))
        except ValueError:
            pass
    return networks

_TRUSTED_NETWORKS = _parse_trusted_networks()
_TRUSTED_PROXIES: Set[str] = set(
    ip.strip()
    for ip in _auth_os.getenv("TRUSTED_PROXY_IPS", "127.0.0.1,::1").split(",")
    if ip.strip()
) | _NAMED_TRUSTED_HOSTS


def is_trusted_proxy(ip: Optional[str]) -> bool:
    """Return True if direct peer IP or host is explicitly configured as a trusted proxy."""
    if not ip:
        return False
    ip_clean = ip.strip()
    if ip_clean in _NAMED_TRUSTED_HOSTS or ip_clean in _TRUSTED_PROXIES:
        return True
    try:
        addr = ipaddress.ip_address(ip_clean)
        for net in _TRUSTED_NETWORKS:
            if addr in net:
                return True
    except ValueError:
        pass
    return False


def get_client_ip(request: Request) -> str:
    """Resolve client IP. Only trust X-Forwarded-For or X-Real-IP from verified proxy IPs."""
    direct_peer = request.client.host if request.client else None
    if direct_peer and is_trusted_proxy(direct_peer):
        # Connection came from a trusted reverse proxy — honour forwarding headers
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first_ip = forwarded.split(",")[0].strip()
            if first_ip:
                return first_ip
        real_ip = request.headers.get("x-real-ip")
        if real_ip and real_ip.strip():
            return real_ip.strip()
    # Unknown peer or no header — use the direct TCP connection address
    if direct_peer:
        return direct_peer
    return "127.0.0.1"


def get_user_agent(request: Request) -> str:
    """Resolve client User-Agent string."""
    return request.headers.get("user-agent", "Unknown Browser")


def get_current_user_optional(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Optional[Dict[str, Any]]:
    """
    Return current user if a valid session token is found, else None.

    SECURITY FIX: Token is now extracted from the httpOnly session cookie
    (``auth_token``) first, which is inaccessible to JavaScript and safe from
    XSS-based token theft. The ``Authorization: Bearer`` header is kept as a
    secondary fallback so direct API consumers (curl, scripts, k6 load tests)
    continue to work without modification.
    """
    # 1. httpOnly cookie (preferred — XSS-safe, supporting __Host- prefix in production)
    token = request.cookies.get("__Host-auth_token") or request.cookies.get("auth_token")

    # 2. Bearer header fallback (for non-browser API clients)
    auth_header = authorization if isinstance(authorization, str) else request.headers.get("authorization")
    if not token and auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split("Bearer ", 1)[1].strip()

    if not token:
        return None
    return get_user_from_token(token)


def require_authenticated_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """Enforce authentication; raise 401 if missing or invalid token."""
    user = get_current_user_optional(request, authorization)
    if not user:
        ip = get_client_ip(request)
        ua = get_user_agent(request)
        action_type = "unauthorized_predict_attempt" if request.url.path == "/api/predict" else "unauthorized_access"
        log_activity(
            action_type=action_type,
            category="system",
            description=f"Blocked unauthenticated attempt to {request.url.path} (HTTP 401)",
            status="failed",
            ip_address=ip,
            user_agent=ua,
            metadata={"path": str(request.url.path), "method": request.method, "status_code": 401}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to proceed.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """Enforce admin role; raise 401 if unauthenticated, 403 if non-admin."""
    user = require_authenticated_user(request, authorization)
    if user.get("role") != "admin":
        ip = get_client_ip(request)
        ua = get_user_agent(request)
        log_activity(
            user_id=user["id"],
            user_name=user["name"],
            email=user["email"],
            role=user["role"],
            action_type="admin_access_denied",
            category="system",
            description=f"Forbidden admin route access attempt: {request.url.path}",
            status="failed",
            ip_address=ip,
            user_agent=ua,
            metadata={"path": str(request.url.path), "user_role": user["role"]}
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Administrator privileges required.",
        )
    return user
