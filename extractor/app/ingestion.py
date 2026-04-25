import hashlib
from pathlib import Path
from typing import Any

from .config import REPO_ROOT
from .document_loader import decode_document, resolve_local_path
from .llm import extract_with_llm
from .schemas import ExtractResponse, IngestResponse
from .storage import read_minio_object, upsert_extraction


def build_source_metadata(
    filename: str,
    raw: bytes,
    local_path: Path | None = None,
    minio_bucket: str | None = None,
    minio_key: str | None = None,
    minio_etag: str | None = None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "filename": filename,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "size_bytes": len(raw),
    }
    if minio_bucket and minio_key:
        metadata["type"] = "minio"
        metadata["bucket"] = minio_bucket
        metadata["key"] = minio_key
        if minio_etag:
            metadata["etag"] = minio_etag
    elif local_path:
        try:
            metadata["path"] = str(local_path.relative_to(REPO_ROOT))
            metadata["type"] = "local_file"
        except ValueError:
            metadata["path"] = str(local_path)
            metadata["type"] = "absolute_local_file"
    else:
        metadata["type"] = "upload"
    return metadata


def persist_extraction(
    *,
    collection_name: str,
    source: dict[str, Any],
    extraction: ExtractResponse,
) -> IngestResponse:
    document = {
        "source": source,
        "workflow": {
            "name": "langchain_document_extraction",
            "model": extraction.model,
            "llm_used": True,
        },
        "document": extraction.extraction.model_dump(mode="json"),
    }
    result, inserted_id = upsert_extraction(collection_name, document, source["sha256"])
    return IngestResponse(
        collection=collection_name,
        id=str(inserted_id),
        upserted=bool(result.upserted_id),
        matched_count=result.matched_count,
        modified_count=result.modified_count,
        extraction=extraction,
    )


def ingest_raw_bytes(
    *,
    raw: bytes,
    filename: str,
    content_type: str | None,
    schema_hint: str | None,
    collection: str,
    local_path: Path | None = None,
    source: dict[str, Any] | None = None,
) -> IngestResponse:
    content = decode_document(filename, content_type, raw)
    extraction = extract_with_llm(content, filename, schema_hint)
    if source is None:
        source = build_source_metadata(filename, raw, local_path)
    return persist_extraction(collection_name=collection, source=source, extraction=extraction)


def ingest_local_file(path: str, schema_hint: str | None, collection: str) -> IngestResponse:
    resolved = resolve_local_path(path)
    raw = resolved.read_bytes()
    content_type = "application/pdf" if resolved.suffix.lower() == ".pdf" else None
    return ingest_raw_bytes(
        raw=raw,
        filename=resolved.name,
        content_type=content_type,
        schema_hint=schema_hint,
        collection=collection,
        local_path=resolved,
    )


def ingest_minio_object(bucket: str, key: str, schema_hint: str | None, collection: str) -> IngestResponse:
    raw, etag = read_minio_object(bucket, key)
    filename = Path(key).name
    content_type = "application/pdf" if filename.lower().endswith(".pdf") else None
    source = build_source_metadata(
        filename=filename,
        raw=raw,
        minio_bucket=bucket,
        minio_key=key,
        minio_etag=etag,
    )
    return ingest_raw_bytes(
        raw=raw,
        filename=filename,
        content_type=content_type,
        schema_hint=schema_hint,
        collection=collection,
        source=source,
    )
