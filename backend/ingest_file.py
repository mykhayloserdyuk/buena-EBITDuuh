import logging
import os
import tempfile
from email import message_from_bytes
from pathlib import Path

from docling.document_converter import DocumentConverter
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig

from agent import agent
from callbacks import _callback

logger = logging.getLogger(__name__)

_converter = DocumentConverter()


def _extract(file_bytes: bytes, filename: str) -> str:
    if Path(filename).suffix.lower() == ".eml":
        msg = message_from_bytes(file_bytes)
        parts = [f"From: {msg['from']}", f"To: {msg['to']}", f"Subject: {msg['subject']}", f"Date: {msg['date']}"]
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    parts.append(payload.decode("utf-8", errors="replace"))
        return "\n".join(parts)

    ext = Path(filename).suffix.lower() or ".bin"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(file_bytes)
        tmp = f.name
    try:
        return _converter.convert(tmp).document.export_to_markdown()
    finally:
        os.unlink(tmp)


_PROMPT = """New file to ingest: {filename}
Source path: {source_path}

Document content:
{text}

Ingest this into MongoDB:
1. Query entity_types, interaction_types and relevant entities to understand what already exists
2. Identify what entities and interactions this document contains
3. Match to existing types where possible — only create new types if clearly needed
4. Upsert entities and create interactions via mutate
5. For interactions: set original="{source_path}", done=false
6. Summarize what was created or updated"""


def ingest(file_bytes: bytes, filename: str, source_path: str = "") -> dict:
    logger.info("ingesting %s (%d bytes)", filename, len(file_bytes))

    text = _extract(file_bytes, filename)
    logger.info("extracted %d chars, calling agent", len(text))

    result = agent.invoke(
        {"messages": [HumanMessage(content=_PROMPT.format(
            filename=filename,
            source_path=source_path or filename,
            text=text,
        ))]},
        config=RunnableConfig(callbacks=[_callback]),
    )

    response = next(
        (m.content for m in reversed(result["messages"]) if hasattr(m, "content") and isinstance(m.content, str) and m.content),
        "",
    )
    logger.info("ingestion done for %s", filename)
    return {"response": response}
