"""
backend/routers/support.py
===========================
Support Ticket API routes.

Public:
  POST /api/support/tickets       -- Submit a new support ticket (with optional image attachment).
                                     Includes honeypot, min-fill-time, and per-IP rate-limit spam guards.

Admin only:
  GET  /api/support/tickets       -- Paginated list with optional status filter.
  GET  /api/support/tickets/{id}  -- Ticket detail.
  PATCH /api/support/tickets/{id}/status  -- Update ticket status.
  GET  /api/support/tickets/{id}/attachment -- Stream the stored attachment file.
"""

import logging
import mimetypes
import os
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from backend.db.database import (
    create_ticket,
    get_ticket_by_id,
    get_tickets,
    update_ticket_status,
)
from backend.services.email_service import send_customer_confirmation, send_support_notification
from backend.utils.auth_deps import get_client_ip, require_admin_user
from backend.utils.rate_limiter import check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/support", tags=["Support"])

# Directory for uploaded attachments (outside web root)
ATTACHMENTS_DIR = Path(__file__).parent.parent / "data" / "attachments"
ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024  # 2 MB
VALID_STATUSES = {"open", "resolved", "closed"}
VALID_CATEGORIES = {"bug", "account", "prediction", "general"}

# SECURITY FIX: Map each allowed MIME type to its binary magic-byte signature(s).
# Client-supplied Content-Type headers can be forged; magic bytes cannot.
_MAGIC_BYTES: dict = {
    "image/jpeg": [(b"\xff\xd8\xff",)],
    "image/png":  [(b"\x89PNG\r\n\x1a\n",)],
    "image/webp": [(b"RIFF", b"WEBP")],   # WEBP: bytes 0-3 == RIFF AND bytes 8-11 == WEBP
}


def _sniff_mime(data: bytes) -> str | None:
    """Return detected MIME type from magic bytes, or None if unrecognised."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class TicketStatusUpdate(BaseModel):
    status: str


# ── POST /api/support/tickets ─────────────────────────────────────────────────
@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def submit_ticket(
    raw_request: Request,
    background_tasks: BackgroundTasks,
    name: str = Form(..., min_length=1, max_length=120),
    email: str = Form(..., min_length=5, max_length=200),
    subject: str = Form(..., min_length=3, max_length=200),
    category: str = Form(default="general"),
    message: str = Form(..., min_length=20, max_length=5000),
    # Spam guards (hidden fields)
    website: str = Form(default=""),        # honeypot -- bots fill this
    fill_time: float = Form(default=10.0),  # seconds form was open before submit
    attachment: Optional[UploadFile] = File(default=None),
):
    """
    Submit a support ticket. Public endpoint, no auth required.

    Spam guards applied in order:
      1. Honeypot field (website) must be empty.
      2. Minimum fill time: 3 seconds.
      3. IP rate limit: 3 tickets per hour.
    """
    ip = get_client_ip(raw_request)

    # 1. Honeypot -- silently pretend success
    if website:
        logger.info("Honeypot triggered from IP %s -- ignoring ticket", ip)
        return {
            "ticket_id": 0,
            "message": "Your ticket has been submitted.",
            "email_sent": False,
        }

    # 2. Min fill time -- reject bots that submit instantly
    if fill_time < 3.0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please take a moment to fill out the form before submitting.",
        )

    # 3. IP rate limit: 3 tickets per hour
    allowed, retry_after = check_rate_limit(f"support_ip:{ip}", max_requests=3, window_seconds=3600)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many submissions. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    # Validate category
    cat = category.lower().strip()
    if cat not in VALID_CATEGORIES:
        cat = "general"

    # Handle optional attachment
    attachment_path: Optional[str] = None
    attachment_name: Optional[str] = None

    if attachment and attachment.filename:
        # Read and validate
        content = await attachment.read()
        if len(content) > MAX_ATTACHMENT_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Attachment must be smaller than 2 MB.",
            )

        # Validate MIME type via magic bytes (not just the client-supplied header)
        # SECURITY FIX: A client can set Content-Type: image/png on an .exe file.
        # Magic bytes are embedded in the file itself and cannot be forged this way.
        detected_mime = _sniff_mime(content)
        if detected_mime not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only JPG, PNG, and WebP images are accepted as attachments.",
            )

        # Store with UUID filename
        ext = Path(attachment.filename).suffix.lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".bin"
        safe_filename = f"{uuid.uuid4()}{ext}"
        dest = ATTACHMENTS_DIR / safe_filename
        dest.write_bytes(content)

        attachment_path = safe_filename
        attachment_name = attachment.filename[:200]  # cap original name length
        logger.info("Stored attachment %s (%d bytes) from IP %s", safe_filename, len(content), ip)

    # Persist ticket
    ticket_id = create_ticket(
        name=name.strip(),
        email=email.strip().lower(),
        subject=subject.strip(),
        category=cat,
        message=message.strip(),
        ip_address=ip,
        attachment_path=attachment_path,
        attachment_name=attachment_name,
    )

    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=500, detail="Failed to create ticket.")

    # Fire-and-forget email notifications
    background_tasks.add_task(send_support_notification, ticket)
    background_tasks.add_task(send_customer_confirmation, ticket)

    logger.info("Support ticket #%d created from %s (%s)", ticket_id, name, email)
    return {
        "ticket_id": ticket_id,
        "message": "Your ticket has been submitted. You will receive a confirmation email shortly.",
        "email_sent": True,
    }


# ── GET /api/support/tickets (Admin) ─────────────────────────────────────────
@router.get("/tickets")
def list_tickets(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """Return paginated support tickets. Admin only."""
    items, total = get_tickets(status_filter=status_filter, limit=limit, offset=offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


# ── GET /api/support/tickets/{id} (Admin) ────────────────────────────────────
@router.get("/tickets/{ticket_id}")
def get_ticket(
    ticket_id: int,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """Return a single ticket by ID. Admin only."""
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    return ticket


# ── PATCH /api/support/tickets/{id}/status (Admin) ───────────────────────────
@router.patch("/tickets/{ticket_id}/status")
def set_ticket_status(
    ticket_id: int,
    body: TicketStatusUpdate,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """Update ticket status (open / resolved / closed). Admin only."""
    new_status = body.status.lower().strip()
    if new_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid status '{new_status}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}.",
        )
    updated = update_ticket_status(ticket_id, new_status)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")
    ticket = get_ticket_by_id(ticket_id)
    return ticket


# ── GET /api/support/tickets/{id}/attachment (Admin) ─────────────────────────
@router.get("/tickets/{ticket_id}/attachment")
def get_ticket_attachment(
    ticket_id: int,
    admin: Dict[str, Any] = Depends(require_admin_user),
):
    """Stream the stored attachment for a ticket. Admin only."""
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    att_path = ticket.get("attachment_path")
    if not att_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This ticket has no attachment.")

    file_path = ATTACHMENTS_DIR / att_path
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file missing on server.")

    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(
        path=str(file_path),
        media_type=mime_type or "application/octet-stream",
        filename=ticket.get("attachment_name") or att_path,
    )
