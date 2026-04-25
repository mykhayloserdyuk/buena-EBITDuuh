from fastapi import APIRouter, File, UploadFile

from .config import DEFAULT_COLLECTION
from .document_loader import decode_document
from .ingestion import ingest_local_file, ingest_minio_object, ingest_raw_bytes
from .llm import extract_with_llm
from .schemas import (
    ExtractRequest,
    ExtractResponse,
    IngestLocalRequest,
    IngestMinioRequest,
    IngestResponse,
    MinioListResponse,
)
from .storage import list_minio_objects as list_minio_objects_from_storage


router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/extract/text", response_model=ExtractResponse)
def extract_text(request: ExtractRequest) -> ExtractResponse:
    return extract_with_llm(request.content, request.document_name, request.schema_hint)


@router.post("/extract/file", response_model=ExtractResponse)
async def extract_file(
    file: UploadFile = File(...),
    schema_hint: str | None = None,
) -> ExtractResponse:
    raw = await file.read()
    content = decode_document(file.filename or "upload", file.content_type, raw)
    return extract_with_llm(content, file.filename, schema_hint)


@router.post("/ingest/file", response_model=IngestResponse)
async def ingest_file(
    file: UploadFile = File(...),
    schema_hint: str | None = None,
    collection: str = DEFAULT_COLLECTION,
) -> IngestResponse:
    raw = await file.read()
    return ingest_raw_bytes(
        raw=raw,
        filename=file.filename or "upload",
        content_type=file.content_type,
        schema_hint=schema_hint,
        collection=collection,
    )


@router.post("/ingest/local", response_model=IngestResponse)
def ingest_local(request: IngestLocalRequest) -> IngestResponse:
    return ingest_local_file(request.path, request.schema_hint, request.collection)


@router.get("/minio/objects", response_model=MinioListResponse)
def list_minio_objects(
    bucket: str = "raw-data",
    prefix: str = "",
    limit: int = 25,
) -> MinioListResponse:
    return list_minio_objects_from_storage(bucket, prefix, limit)


@router.post("/ingest/minio", response_model=IngestResponse)
def ingest_minio(request: IngestMinioRequest) -> IngestResponse:
    return ingest_minio_object(request.bucket, request.key, request.schema_hint, request.collection)
