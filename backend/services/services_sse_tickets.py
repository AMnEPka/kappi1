"""
services/services_sse_tickets.py
Short-lived, single-use SSE tickets.

Instead of passing a long-lived JWT token in SSE query parameters (where it
leaks into access logs, browser history, proxy logs, Referrer headers), the
client first exchanges a valid JWT for a one-time SSE ticket via an
authenticated endpoint and then passes only the opaque ticket to the SSE URL.

Tickets are stored in MongoDB with a TTL index and are deleted on first use.
"""

import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status  # pyright: ignore[reportMissingImports]

from config.config_init import db, logger
from models.auth_models import User

# Ticket lifetime in seconds (60 seconds is plenty to open an SSE connection)
SSE_TICKET_TTL_SECONDS = 60


async def create_sse_ticket(user_id: str) -> str:
    """
    Create a short-lived, single-use SSE ticket for the given user.

    Returns:
        The opaque ticket string the client should pass as ``?ticket=...``.
    """
    ticket = secrets.token_urlsafe(48)  # 64-char URL-safe random string
    now = datetime.now(timezone.utc)
    doc = {
        "ticket": ticket,
        "user_id": user_id,
        "created_at": now,
        "expires_at": now + timedelta(seconds=SSE_TICKET_TTL_SECONDS),
    }
    await db.sse_tickets.insert_one(doc)
    return ticket


async def validate_sse_ticket(ticket: Optional[str]) -> User:
    """
    Validate and **consume** an SSE ticket (single-use).

    Raises:
        HTTPException 401 if the ticket is missing, expired, already used,
        or the associated user no longer exists / is inactive.
    """
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется ticket для SSE-подключения",
        )

    # find_one_and_delete makes this atomic: if two requests race with the
    # same ticket, only one will get the document back.
    doc = await db.sse_tickets.find_one_and_delete({"ticket": ticket})

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или уже использованный ticket",
        )

    # Check expiration (belt-and-suspenders; TTL index cleans up too)
    expires_at = doc.get("expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ticket истёк",
            )

    user_id = doc.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Некорректный ticket",
        )

    # Resolve user
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )

    user = User(**user_doc)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь деактивирован",
        )

    return user
