"""
backend/routers/users.py
========================
Admin endpoints for viewing and managing user accounts.
"""

import math
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from backend.db.database import (
    list_users,
    set_user_status,
    set_user_role,
    delete_user,
    get_user_by_id,
    log_activity,
)
from backend.schemas.auth import (
    UserListResponse,
    UserResponse,
    UserStatusUpdateRequest,
    UserRoleUpdateRequest,
)
from backend.utils.auth_deps import (
    get_client_ip,
    get_user_agent,
    require_admin_user,
)

router = APIRouter(prefix="/api/admin/users", tags=["Admin User Management"])


@router.get("", response_model=UserListResponse)
def get_users_list(
    search: str = Query(default=""),
    role: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """List registered users with search, filtering, and pagination."""
    items, total = list_users(
        search=search,
        role=role,
        status=status_filter,
        page=page,
        limit=limit,
    )
    total_pages = max(1, math.ceil(total / limit))
    return UserListResponse(
        items=[UserResponse(**item) for item in items],
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    req: UserStatusUpdateRequest,
    request: Request,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """Activate or deactivate a user account."""
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    target = get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target["id"] == admin["id"] and req.status == "inactive":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own admin account.")

    updated = set_user_status(user_id, req.status)

    log_activity(
        user_id=admin["id"],
        user_name=admin["name"],
        email=admin["email"],
        role=admin["role"],
        action_type="user_status_changed",
        category="admin",
        description=f"Admin {admin['name']} changed status of user '{target['name']}' to '{req.status}'",
        status="success",
        ip_address=ip,
        user_agent=ua,
        metadata={"target_user_id": user_id, "old_status": target["status"], "new_status": req.status}
    )

    return UserResponse(**updated)


@router.patch("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    req: UserRoleUpdateRequest,
    request: Request,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """Change role of a user (e.g. promote to admin or demote to user)."""
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    target = get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target["id"] == admin["id"] and req.role != "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot demote your own admin account.")

    updated = set_user_role(user_id, req.role)

    log_activity(
        user_id=admin["id"],
        user_name=admin["name"],
        email=admin["email"],
        role=admin["role"],
        action_type="user_role_changed",
        category="admin",
        description=f"Admin {admin['name']} changed role of user '{target['name']}' from '{target['role']}' to '{req.role}'",
        status="success",
        ip_address=ip,
        user_agent=ua,
        metadata={"target_user_id": user_id, "old_role": target["role"], "new_role": req.role}
    )

    return UserResponse(**updated)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def remove_user(
    user_id: int,
    request: Request,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """Delete a user account."""
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    target = get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target["id"] == admin["id"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own admin account.")

    deleted = delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete user.")

    log_activity(
        user_id=admin["id"],
        user_name=admin["name"],
        email=admin["email"],
        role=admin["role"],
        action_type="user_deleted",
        category="admin",
        description=f"Admin {admin['name']} deleted user '{target['name']}' ({target['email']})",
        status="success",
        ip_address=ip,
        user_agent=ua,
        metadata={"deleted_user_id": user_id, "deleted_email": target["email"]}
    )

    return {"message": f"User {target['name']} successfully deleted."}
