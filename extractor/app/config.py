import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PACKAGE_ROOT.parent

DEFAULT_MODEL = "gemini-2.5-flash-lite"
DEFAULT_COLLECTION = "document_extractions"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

load_dotenv(PACKAGE_ROOT / ".env")


def get_api_key() -> str:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Set GOOGLE_API_KEY or GEMINI_API_KEY before calling the extractor.",
        )
    return api_key


def get_model_name() -> str:
    return os.getenv("GEMINI_MODEL", DEFAULT_MODEL)


def get_mongo_uri() -> str:
    uri = os.getenv("MONGO_URI")
    if not uri:
        raise HTTPException(status_code=503, detail="Set MONGO_URI before calling ingest endpoints.")
    return uri


def get_mongo_database() -> str:
    return os.getenv("MONGO_DB", "buena")


def get_minio_settings() -> tuple[str, str, str, str]:
    endpoint = os.getenv("MINIO_ENDPOINT")
    user = os.getenv("MINIO_USER")
    password = os.getenv("MINIO_PASS")
    region = os.getenv("MINIO_REGION", "us-east-1")
    if not endpoint or not user or not password:
        raise HTTPException(status_code=503, detail="Set MINIO_ENDPOINT, MINIO_USER, and MINIO_PASS.")
    return endpoint, user, password, region
