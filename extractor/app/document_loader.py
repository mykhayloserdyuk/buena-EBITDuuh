from io import BytesIO
from pathlib import Path

from fastapi import HTTPException

from .config import MAX_UPLOAD_BYTES, REPO_ROOT

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - optional until requirements are installed
    PdfReader = None


def decode_document(filename: str, content_type: str | None, raw: bytes) -> str:
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file is larger than 10 MB.")

    lowered = filename.lower()
    if lowered.endswith(".pdf") or content_type == "application/pdf":
        if PdfReader is None:
            raise HTTPException(status_code=500, detail="PDF support requires pypdf to be installed.")
        reader = PdfReader(BytesIO(raw))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        if not text.strip():
            raise HTTPException(status_code=422, detail="No extractable text found in PDF.")
        return text

    for encoding in ("utf-8", "latin-1"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue

    raise HTTPException(status_code=415, detail="Unsupported file encoding.")


def resolve_local_path(path: str) -> Path:
    candidate = Path(path).expanduser()
    if not candidate.is_absolute():
        candidate = REPO_ROOT / candidate
    try:
        resolved = candidate.resolve(strict=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"File not found: {path}") from exc
    if not resolved.is_file():
        raise HTTPException(status_code=400, detail=f"Path is not a file: {path}")
    return resolved
