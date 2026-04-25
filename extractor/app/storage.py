from typing import Any

import boto3
from fastapi import HTTPException
from pymongo import MongoClient

from .config import get_minio_settings, get_mongo_database, get_mongo_uri
from .schemas import MinioObject, MinioListResponse


def get_mongo_collection(name: str):
    client = MongoClient(get_mongo_uri(), serverSelectionTimeoutMS=8000)
    return client[get_mongo_database()][name]


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


def list_minio_objects(bucket: str, prefix: str, limit: int) -> MinioListResponse:
    client = get_minio_client()
    objects: list[MinioObject] = []
    paginator = client.get_paginator("list_objects_v2")
    try:
        pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
        for page in pages:
            for item in page.get("Contents", []):
                objects.append(
                    MinioObject(
                        bucket=bucket,
                        key=item["Key"],
                        size_bytes=item["Size"],
                        etag=item.get("ETag", "").strip('"') or None,
                    )
                )
                if len(objects) >= limit:
                    return MinioListResponse(bucket=bucket, prefix=prefix, objects=objects)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not list MinIO objects: {exc}") from exc
    return MinioListResponse(bucket=bucket, prefix=prefix, objects=objects)


def upsert_extraction(collection_name: str, document: dict[str, Any], sha256: str):
    collection = get_mongo_collection(collection_name)
    collection.create_index("source.sha256", unique=True)
    result = collection.replace_one({"source.sha256": sha256}, document, upsert=True)
    inserted_id = result.upserted_id
    if inserted_id is None:
        existing = collection.find_one({"source.sha256": sha256}, {"_id": 1})
        inserted_id = existing["_id"]
    return result, inserted_id
