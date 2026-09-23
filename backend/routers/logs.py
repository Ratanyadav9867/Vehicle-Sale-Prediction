"""
backend/routers/logs.py
=======================
Endpoints for querying, filtering, exporting, and viewing Activity Audit Logs.
"""

import csv
import io
import json
import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse

from backend.db.database import (
    get_logs,
    get_log_by_id,
    get_user_logs,
    get_admin_dashboard_stats,
    log_activity,
    save_activity_logs_batch,
)
from backend.schemas.auth import (
    LogEntryResponse,
    LogListResponse,
    ClientLogEventRequest,
    BatchLogEventsRequest,
    AdminDashboardStatsResponse,
)
from backend.utils.auth_deps import (
    get_client_ip,
    get_user_agent,
    get_current_user_optional,
    require_authenticated_user,
    require_admin_user,
)

router = APIRouter(tags=["Activity Logs"])


# ── Regular User: View Own Activity ──────────────────────────────────────────

@router.get("/api/me/logs", response_model=List[LogEntryResponse])
def get_my_activity(
    limit: int = Query(default=20, ge=1, le=100),
    user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """
    Fetch the authenticated user's own recent activity logs for their dashboard.
    """
    rows = get_user_logs(user_id=user["id"], limit=limit)
    return [LogEntryResponse(**r) for r in rows]


# ── Client Action Reporting ───────────────────────────────────────────────────

@router.post("/api/logs/event", status_code=status.HTTP_201_CREATED)
def record_client_event(
    req: ClientLogEventRequest,
    request: Request,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    Record client-side user events (e.g. page navigation, key feature usage).
    """
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    log_id = log_activity(
        action_type=req.action_type,
        category=req.category,
        description=req.description,
        status="success",
        user_id=user["id"] if user else None,
        user_name=user["name"] if user else "Guest",
        email=user["email"] if user else "anonymous",
        role=user["role"] if user else "guest",
        ip_address=ip,
        user_agent=ua,
        metadata=req.metadata or {},
    )
    return {"status": "recorded", "log_id": log_id}


@router.post("/api/logs/batch", status_code=status.HTTP_201_CREATED)
def record_client_batch_events(
    req: BatchLogEventsRequest,
    request: Request,
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    High-concurrency batch event ingestion endpoint.
    Batches client telemetry events and inserts them efficiently in bulk.
    """
    if not req.events:
        return {"status": "empty", "count": 0}

    ip = get_client_ip(request)
    ua = get_user_agent(request)

    entries = []
    for ev in req.events:
        entries.append({
            "action_type": ev.action_type,
            "category": ev.category,
            "description": ev.description,
            "status": "success",
            "user_id": user["id"] if user else None,
            "user_name": user["name"] if user else "Guest",
            "email": user["email"] if user else "anonymous",
            "role": user["role"] if user else "guest",
            "ip_address": ip,
            "user_agent": ua,
            "metadata": ev.metadata or {},
        })

    saved = save_activity_logs_batch(entries)
    return {"status": "recorded", "count": saved}


# ── Admin Only: Dashboard Analytics ───────────────────────────────────────────

@router.get("/api/admin/stats", response_model=AdminDashboardStatsResponse)
def admin_stats(admin: Dict[str, Any] = Depends(require_admin_user)):
    """
    Retrieve overview statistics for the Admin Dashboard.
    """
    return get_admin_dashboard_stats()


# ── Admin Only: Query & Filter All Logs ────────────────────────────────────────

@router.get("/api/admin/logs", response_model=LogListResponse)
def list_logs(
    search: str = Query(default=""),
    category: Optional[str] = Query(default=None),
    action_type: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    user_id: Optional[int] = Query(default=None),
    ip_address: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=5, le=100),
    sort_by: str = Query(default="timestamp"),
    sort_order: str = Query(default="desc"),
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """
    Search, filter, and paginate through system activity audit logs.
    """
    items, total = get_logs(
        search=search,
        category=category,
        action_type=action_type,
        role=role,
        status=status_filter,
        user_id=user_id,
        ip_address=ip_address,
        start_date=start_date,
        end_date=end_date,
        page=page,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    total_pages = max(1, math.ceil(total / limit))
    return LogListResponse(
        items=[LogEntryResponse(**item) for item in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


# ── Admin Only: Export Logs (CSV / JSON) ───────────────────────────────────────

@router.get("/api/admin/logs/export")
def export_logs(
    request: Request,
    format: str = Query(default="csv", pattern="^(csv|json)$"),
    category: Optional[str] = Query(default=None),
    role: Optional[str] = Query(default=None),
    action_type: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: str = Query(default=""),
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """
    Export audit logs to CSV or JSON format.
    The export action itself is recorded in the audit log.
    """
    ip = get_client_ip(request) if request else "127.0.0.1"
    ua = get_user_agent(request) if request else "Unknown"

    # Fetch up to 5,000 logs matching criteria
    logs, count = get_logs(
        search=search,
        category=category,
        action_type=action_type,
        role=role,
        status=status_filter,
        page=1,
        limit=5000,
    )

    # Log the export action
    log_activity(
        user_id=admin["id"],
        user_name=admin["name"],
        email=admin["email"],
        role=admin["role"],
        action_type="log_export",
        category="admin",
        description=f"Admin {admin['name']} exported {len(logs)} audit logs in {format.upper()} format",
        status="success",
        ip_address=ip,
        user_agent=ua,
        metadata={"format": format, "records_exported": len(logs), "filter_category": category}
    )

    if format == "json":
        json_data = json.dumps(logs, indent=2)
        return Response(
            content=json_data,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=audit_logs_{count}.json"},
        )

    # Default: CSV format
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Timestamp (UTC)", "User ID", "Name", "Email", "Role",
        "Action Type", "Category", "Description", "Status", "IP Address", "User Agent"
    ])
    for item in logs:
        writer.writerow([
            item.get("id"),
            item.get("timestamp"),
            item.get("user_id"),
            item.get("user_name"),
            item.get("email"),
            item.get("role"),
            item.get("action_type"),
            item.get("category"),
            item.get("description"),
            item.get("status"),
            item.get("ip_address"),
            item.get("user_agent"),
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_logs_{count}.csv"},
    )


# ── Admin Only: Single Log Detail ─────────────────────────────────────────────

@router.get("/api/admin/logs/{log_id}", response_model=LogEntryResponse)
def get_log_detail(
    log_id: int,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """
    Get full metadata and detail of a single log entry.
    """
    entry = get_log_by_id(log_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log entry not found")
    return LogEntryResponse(**entry)


# ── Admin Only: User Specific Timeline ────────────────────────────────────────

@router.get("/api/admin/users/{target_user_id}/logs", response_model=List[LogEntryResponse])
def get_specific_user_logs(
    target_user_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """
    Retrieve full historical activity timeline for a specific user account.
    """
    rows = get_user_logs(user_id=target_user_id, limit=limit)
    return [LogEntryResponse(**r) for r in rows]
