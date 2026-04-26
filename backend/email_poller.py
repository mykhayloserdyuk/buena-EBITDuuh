"""
Background IMAP email poller.

Environment variables:
  EMAIL_IMAP_HOST      — IMAP server hostname (required to enable polling)
  EMAIL_IMAP_PORT      — IMAP server port, default 993 (SSL)
  EMAIL_IMAP_USER      — IMAP login username (required)
  EMAIL_IMAP_PASS      — IMAP login password (required)
  EMAIL_IMAP_MAILBOX   — Mailbox to poll, default "INBOX"
  EMAIL_POLL_INTERVAL  — Polling interval in seconds, default 300
"""

import asyncio
import imaplib
import logging
import os
from datetime import datetime, timezone
from email import message_from_bytes

import env  # noqa: F401 — ensures .env is loaded before os.environ reads
from db import db
from ingest_file import _snake, ingest

logger = logging.getLogger(__name__)

_HOST = os.environ.get("EMAIL_IMAP_HOST", "")
_PORT = int(os.environ.get("EMAIL_IMAP_PORT", "993"))
_USER = os.environ.get("EMAIL_IMAP_USER", "")
_PASS = os.environ.get("EMAIL_IMAP_PASS", "")
_MAILBOX = os.environ.get("EMAIL_IMAP_MAILBOX", "INBOX")
_INTERVAL = int(os.environ.get("EMAIL_POLL_INTERVAL", "300"))

_seen = db["email_seen"]


def _load_seen_ids() -> set[str]:
    return {doc["_id"] for doc in _seen.find({}, {"_id": 1})}


def _mark_seen(message_id: str) -> None:
    _seen.update_one(
        {"_id": message_id},
        {"$setOnInsert": {"ingested_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


def _safe_filename(subject: str) -> str:
    return _snake((subject or "email") + ".eml")


def _poll_once(seen_ids: set[str]) -> int:
    ingested = 0
    try:
        with imaplib.IMAP4_SSL(_HOST, _PORT) as imap:
            imap.login(_USER, _PASS)
            imap.select(_MAILBOX, readonly=True)

            _, data = imap.search(None, "ALL")
            if not data or not data[0]:
                return 0

            seq_nums = data[0].split()
            for seq in seq_nums:
                # Fetch headers only first to check Message-ID cheaply
                _, hdr_data = imap.fetch(seq, "(BODY.PEEK[HEADER.FIELDS (MESSAGE-ID SUBJECT)])")
                if not hdr_data or not hdr_data[0]:
                    continue

                hdr_bytes = hdr_data[0][1]
                hdr_msg = message_from_bytes(hdr_bytes)
                message_id = (hdr_msg.get("Message-ID") or "").strip()

                if not message_id:
                    # No Message-ID: use sequence number as a stable-enough key
                    message_id = f"seq:{seq.decode()}"

                if message_id in seen_ids:
                    continue

                # Fetch full message
                _, full_data = imap.fetch(seq, "(RFC822)")
                if not full_data or not full_data[0]:
                    continue

                raw: bytes = full_data[0][1]
                full_msg = message_from_bytes(raw)
                subject = full_msg.get("Subject", "")
                filename = _safe_filename(subject)
                source_path = f"email/{_MAILBOX}/{message_id}"

                logger.info("Ingesting email: %s (Message-ID: %s)", subject, message_id)
                ingest(raw, filename, source_path)

                seen_ids.add(message_id)
                _mark_seen(message_id)
                ingested += 1

    except imaplib.IMAP4.error:
        logger.exception("IMAP error during poll")
    except Exception:
        logger.exception("Unexpected error during email poll")

    return ingested


async def run_email_poller() -> None:
    if not _HOST or not _USER or not _PASS:
        logger.info("Email polling disabled — set EMAIL_IMAP_HOST, EMAIL_IMAP_USER, EMAIL_IMAP_PASS to enable")
        return

    logger.info(
        "Email poller starting: %s@%s:%d/%s, interval=%ds",
        _USER, _HOST, _PORT, _MAILBOX, _INTERVAL,
    )

    loop = asyncio.get_event_loop()
    seen_ids = await loop.run_in_executor(None, _load_seen_ids)
    logger.info("Loaded %d already-seen message IDs from MongoDB", len(seen_ids))

    while True:
        count = await loop.run_in_executor(None, _poll_once, seen_ids)
        if count:
            logger.info("Email poll complete: ingested %d new email(s)", count)
        await asyncio.sleep(_INTERVAL)
