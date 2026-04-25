import os
from pathlib import Path

import boto3
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv(Path(__file__).parent / ".env")


def get_minio_settings() -> tuple[str, str, str, str]:
    endpoint = os.getenv("MINIO_ENDPOINT")
    user = os.getenv("MINIO_USER")
    password = os.getenv("MINIO_PASS")
    region = os.getenv("MINIO_REGION", "europe-west3")
    if not endpoint or not user or not password:
        raise HTTPException(status_code=503, detail="Set MINIO_ENDPOINT, MINIO_USER, and MINIO_PASS.")
    return endpoint, user, password, region


def get_minio_client():
    endpoint, user, password, region = get_minio_settings()
    return boto3.client(
        "s3",
        endpoint_url=f"http://{endpoint}",
        aws_access_key_id=user,
        aws_secret_access_key=password,
        region_name=region,
    )


def read_minio_object(bucket: str, key: str) -> tuple[bytes, str | None]:
    client = get_minio_client()
    try:
        response = client.get_object(Bucket=bucket, Key=key)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Could not read MinIO object {bucket}/{key}: {exc}") from exc
    try:
        raw = response["Body"].read()
    finally:
        response["Body"].close()
    return raw, response.get("ETag", "").strip('"') or None


def list_minio_objects(bucket: str, prefix: str, limit: int) -> dict:
    client = get_minio_client()
    objects: list[dict] = []
    paginator = client.get_paginator("list_objects_v2")
    try:
        pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
        for page in pages:
            for item in page.get("Contents", []):
                objects.append(
                    {
                        "bucket": bucket,
                        "key": item["Key"],
                        "size_bytes": item["Size"],
                        "etag": item.get("ETag", "").strip('"') or None,
                    }
                )
                if len(objects) >= limit:
                    return {"bucket": bucket, "prefix": prefix, "objects": objects}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not list MinIO objects: {exc}") from exc
    return {"bucket": bucket, "prefix": prefix, "objects": objects}
