"""
backend/services/email_service.py
==================================
Async-compatible email service for support ticket notifications.

Reads SMTP configuration from environment variables:
  SMTP_HOST      -- default: smtp.gmail.com
  SMTP_PORT      -- default: 587
  SMTP_USER      -- Gmail / SMTP username
  SMTP_PASSWORD  -- Gmail App Password or SMTP password
  SMTP_FROM      -- Display name + address, e.g. "Car Worth <noreply@example.com>"
  SUPPORT_EMAIL  -- Destination inbox, default: support@example.com

All sending is done inside asyncio.to_thread() so FastAPI event loop is never blocked.
"""

import asyncio
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@example.com")

_SMTP_CONFIG_MISSING_LOGGED = False


def _get_smtp_config() -> Optional[Dict[str, Any]]:
    """Return SMTP config dict from env vars, or None if any required var is absent."""
    global _SMTP_CONFIG_MISSING_LOGGED
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port_str = os.getenv("SMTP_PORT", "587")
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    sender = os.getenv("SMTP_FROM", f"Car Worth <{user}>")

    if not user or not password:
        if not _SMTP_CONFIG_MISSING_LOGGED:
            logger.warning(
                "SMTP_USER / SMTP_PASSWORD not configured -- email sending is disabled. "
                "Set them in your .env file to enable ticket notifications."
            )
            _SMTP_CONFIG_MISSING_LOGGED = True
        return None

    try:
        port = int(port_str)
    except ValueError:
        port = 587

    return {"host": host, "port": port, "user": user, "password": password, "sender": sender}


def _send_email_sync(to: str, subject: str, html_body: str, text_body: str) -> bool:
    """Blocking SMTP send -- must be called inside a thread."""
    config = _get_smtp_config()
    if config is None:
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = config["sender"]
    msg["To"] = to

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(config["host"], config["port"], timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(config["user"], config["password"])
            server.sendmail(config["sender"], [to], msg.as_string())
        logger.info("Email sent to %s | subject: %s", to, subject)
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error("SMTP authentication failed -- check SMTP_USER / SMTP_PASSWORD")
    except smtplib.SMTPException as exc:
        logger.error("SMTP error sending to %s: %s", to, exc)
    except OSError as exc:
        logger.error("Network error sending email to %s: %s", to, exc)
    return False


async def send_support_notification(ticket: Dict[str, Any]) -> bool:
    """Notify the support inbox that a new ticket has been submitted."""
    ticket_id = ticket.get("id", "?")
    name = ticket.get("name", "")
    email = ticket.get("email", "")
    subject_line = ticket.get("subject", "")
    category = ticket.get("category", "general")
    message = ticket.get("message", "")
    created_at = ticket.get("created_at", "")
    has_attachment = bool(ticket.get("attachment_name"))

    subject = f"[Car Worth Support] #{ticket_id} -- {subject_line}"

    html_body = f"""
    <html><body style="font-family:sans-serif;color:#1e293b;max-width:600px;margin:auto">
      <div style="background:#0f172a;padding:24px 32px;border-radius:12px 12px 0 0">
        <h2 style="color:#f8fafc;margin:0">Car Worth Support</h2>
        <p style="color:#94a3b8;margin:4px 0 0">New support ticket received</p>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#64748b;width:130px">Ticket #</td>
              <td style="padding:6px 0;font-weight:600">#{ticket_id}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">From</td>
              <td style="padding:6px 0">{name} ({email})</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Category</td>
              <td style="padding:6px 0">{category.title()}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Subject</td>
              <td style="padding:6px 0;font-weight:600">{subject_line}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Submitted</td>
              <td style="padding:6px 0">{created_at[:19].replace("T", " ")} UTC</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Attachment</td>
              <td style="padding:6px 0">{"Yes -- see admin inbox" if has_attachment else "None"}</td></tr>
        </table>
        <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0">
        <h4 style="margin:0 0 8px;color:#334155">Message:</h4>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px;white-space:pre-wrap">{message}</div>
      </div>
    </body></html>
    """

    text_body = (
        f"New Support Ticket #{ticket_id}\n\n"
        f"From:     {name} <{email}>\n"
        f"Category: {category.title()}\n"
        f"Subject:  {subject_line}\n"
        f"Date:     {created_at[:19].replace('T', ' ')} UTC\n"
        f"Attachment: {'Yes' if has_attachment else 'None'}\n\n"
        f"Message:\n{message}\n"
    )

    return await asyncio.to_thread(_send_email_sync, SUPPORT_EMAIL, subject, html_body, text_body)


async def send_customer_confirmation(ticket: Dict[str, Any]) -> bool:
    """Send a confirmation auto-reply to the customer who submitted the ticket."""
    ticket_id = ticket.get("id", "?")
    name = ticket.get("name", "")
    customer_email = ticket.get("email", "")
    subject_line = ticket.get("subject", "")

    subject = f"[Car Worth] We received your message (Ticket #{ticket_id})"

    html_body = f"""
    <html><body style="font-family:sans-serif;color:#1e293b;max-width:600px;margin:auto">
      <div style="background:#0f172a;padding:24px 32px;border-radius:12px 12px 0 0">
        <h2 style="color:#f8fafc;margin:0">Car Worth Support</h2>
        <p style="color:#94a3b8;margin:4px 0 0">We have received your message</p>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
        <p>Hi <strong>{name}</strong>,</p>
        <p>Thanks for reaching out! We have received your support request and our team will get back to you within <strong>24-48 hours</strong>.</p>
        <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0">
          <p style="margin:0;font-size:14px;color:#1d4ed8">
            <strong>Ticket #:</strong> {ticket_id}<br>
            <strong>Subject:</strong> {subject_line}
          </p>
        </div>
        <p>For urgent issues, email us directly at
           <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>.</p>
        <p style="color:#64748b;font-size:13px">-- The Car Worth Team</p>
      </div>
    </body></html>
    """

    text_body = (
        f"Hi {name},\n\n"
        f"Thanks for reaching out! We have received your support request.\n\n"
        f"Ticket #: {ticket_id}\n"
        f"Subject:  {subject_line}\n\n"
        f"We will get back to you within 24-48 hours.\n\n"
        f"For urgent issues, email us directly at {SUPPORT_EMAIL}.\n\n"
        f"-- The Car Worth Team\n"
    )

    return await asyncio.to_thread(_send_email_sync, customer_email, subject, html_body, text_body)
