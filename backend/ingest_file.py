import hashlib
import logging
import os
import re
import tempfile
import unicodedata
import uuid
from email import message_from_bytes
from pathlib import Path

from docling.document_converter import DocumentConverter
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig

from agent import agent
from callbacks import _callback

logger = logging.getLogger(__name__)

_converter = DocumentConverter()
_UPLOAD_BUCKET = os.environ.get("RAW_DATA_BUCKET", "raw-data")
_UPLOAD_PREFIX = "uploads"


def _snake(name: str) -> str:
    stem = Path(name).stem
    suffix = Path(name).suffix.lower()
    stem = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode()
    stem = re.sub(r"[^a-z0-9]+", "_", stem.lower()).strip("_")
    return f"{stem or 'file'}{suffix}"


def _store_raw(file_bytes: bytes, filename: str) -> str | None:
    try:
        from minio_client import write_minio_object  # lazy to avoid import-time HTTPException
        sha = hashlib.sha256(file_bytes).hexdigest()[:16]
        key = f"{_UPLOAD_PREFIX}/{sha}/{filename}"
        write_minio_object(_UPLOAD_BUCKET, key, file_bytes, filename)
        return key
    except Exception:
        logger.warning("Could not store raw file in MinIO — provenance link will be omitted")
        return None


def _html_to_text(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


def _collect_email_parts(
    msg,
    raw_html: bool = False,
) -> tuple[list[str], str | None, list[tuple[str, bytes]]]:
    body_lines: list[str] = []
    html_fallback: str | None = None
    attachments: list[tuple[str, bytes]] = []

    for part in msg.walk():
        ct = part.get_content_type()
        if ct.startswith("multipart/"):
            continue
        att_name = part.get_filename()
        is_attachment = bool(att_name) or part.get_content_disposition() == "attachment"
        payload: bytes | None = part.get_payload(decode=True)
        if not payload:
            continue

        if ct == "text/plain" and not is_attachment:
            body_lines.append(payload.decode("utf-8", errors="replace"))
        elif ct == "text/html" and not is_attachment and html_fallback is None:
            raw = payload.decode("utf-8", errors="replace")
            html_fallback = raw if raw_html else _html_to_text(raw)
        elif is_attachment and att_name:
            attachments.append((_snake(att_name), payload))

    return body_lines, html_fallback, attachments


def _extract_attachments(attachments: list[tuple[str, bytes]]) -> list[str]:
    parts: list[str] = []
    for att_filename, att_bytes in attachments:
        parts.append(f"\n--- Attachment: {att_filename} ---")
        try:
            parts.append(_extract(att_bytes, att_filename))
        except Exception:
            logger.warning("Could not extract attachment %s", att_filename)
    return parts


def _extract_eml(file_bytes: bytes) -> str:
    msg = message_from_bytes(file_bytes)
    parts = [f"From: {msg['from']}", f"To: {msg['to']}", f"Subject: {msg['subject']}", f"Date: {msg['date']}"]
    body_lines, html_fallback, attachments = _collect_email_parts(msg)
    parts.extend(body_lines or ([html_fallback] if html_fallback else []))
    parts.extend(_extract_attachments(attachments))
    return "\n".join(parts)


def _extract_doc(file_bytes: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower() or ".bin"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(file_bytes)
        tmp = f.name
    try:
        return _converter.convert(tmp).document.export_to_markdown()
    finally:
        os.unlink(tmp)


def _extract(file_bytes: bytes, filename: str) -> str:
    if Path(filename).suffix.lower() == ".eml":
        return _extract_eml(file_bytes)
    return _extract_doc(file_bytes, filename)


_PROMPT = """
<metadata>
New file to ingest: {filename}
Source path: {source_path}
Raw file stored at: {raw_url}
</metadata>

<document_content>
{text}
</document_content>

<ontology>
The ontology is based on a meta model consisting of entity types, interaction types, and their attributes. 
Each can be instantiated as entities and interactions. Both have a field "_id" and an array with string "attributes" that can be used for their instances.
The attributes can be extended. Interactions always have cross links to "entity_ids" and "interaction_ids", which can be used to build a dynamic relational model.
The ontology is built by you. If it is not extensive enough, you can extend it as needed.
</ontology>
<instructions>
Ingest this into MongoDB:
1. Query entity_types, interaction_types and relevant entities to understand what already exists
2. Identify what entities and interactions this document contains and cross link them via the correct attributes
3. Match to existing types where possible — only create new types if clearly needed
4. Are the current attributes for entity types and relation types sufficient or do they need to be extended?
4. Upsert entities and create interactions via mutate
5. For interactions: set original="{raw_url}". Set done status if previous interactions clearly indicate this is was completed. E.g. a "purchase order" interaction would be marked done if there is a later "invoice" interaction for the same entities.
6. Always update entities with the latest info from the document, even if they existed before. I.e., update the tenant entity with the latest rental price, if the document states it is updated.
7. Make sure to check all linked entities and update them as well, e.g. if a "customer" entity is linked to an "order" entity, and the document contains new info about the customer, update the customer entity too.
8. Summarize what was created or updated

IMPORTANT: Only ingest the file when it is actually relevant. If there are no apparent links or if it is not even housing related, do not ingest it at all.
</instructions>
"""


def ingest(file_bytes: bytes, filename: str, source_path: str = "", raw_key: str | None = None) -> dict:
    logger.info("ingesting %s (%d bytes)", filename, len(file_bytes))

    if raw_key is None:
        raw_key = _store_raw(file_bytes, filename)

    raw_url = f"s3://{_UPLOAD_BUCKET}/{raw_key}" if raw_key else (source_path or filename)

    text = _extract(file_bytes, filename)
    logger.info("extracted %d chars, calling agent", len(text))

    result = agent.invoke(
        {"messages": [HumanMessage(content=_PROMPT.format(
            filename=filename,
            source_path=source_path or filename,
            raw_url=raw_url,
            text=text,
        ))]},
        config=RunnableConfig(callbacks=[_callback], configurable={"thread_id": str(uuid.uuid4())}),
    )

    response = next(
        (m.content for m in reversed(result["messages"]) if hasattr(m, "content") and isinstance(m.content, str) and m.content),
        "",
    )
    logger.info("ingestion done for %s", filename)
    return {"response": response, "raw_url": raw_url}
