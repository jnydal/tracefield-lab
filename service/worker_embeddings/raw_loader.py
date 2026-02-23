"""Load raw dataset rows from object storage for embedding extraction."""
from __future__ import annotations

import csv
import io
import json
import logging
import os
import re
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

log = logging.getLogger("worker_embeddings.raw_loader")

_ENDPOINT = os.environ.get("OBJECT_STORE_ENDPOINT", "http://minio:9000")
_ACCESS_KEY = os.environ.get("OBJECT_STORE_ACCESS_KEY", "minio")
_SECRET_KEY = os.environ.get("OBJECT_STORE_SECRET_KEY", "minio123")
_DEFAULT_BUCKET = os.environ.get("OBJECT_STORE_BUCKET_RAW", "tracefield-raw")


def _parse_s3_uri(uri: str) -> tuple[str, str]:
    """Parse s3://bucket/key into (bucket, key)."""
    m = re.match(r"s3://([^/]+)/(.+)", uri.strip())
    if not m:
        raise ValueError(f"Invalid S3 URI: {uri}")
    return m.group(1), m.group(2)


def _get_client():
    return boto3.client(
        "s3",
        endpoint_url=_ENDPOINT,
        aws_access_key_id=_ACCESS_KEY,
        aws_secret_access_key=_SECRET_KEY,
        config=Config(signature_version="s3v4", connect_timeout=30, read_timeout=60),
        region_name="us-east-1",
    )


def load_rows_from_uri(
    uri: str,
    id_column: str,
    text_columns: list[str] | None = None,
    text_column: str | None = None,
) -> dict[str, str]:
    """
    Load rows from object storage (CSV or JSON) and return a map: id_value -> concatenated_text.
    Rows without id_column or with empty text are skipped.
    Either text_columns (list) or text_column (single) must be provided.
    """
    cols = text_columns if text_columns else ([text_column] if text_column else [])
    if not cols:
        raise ValueError("Must provide text_column or text_columns")
    try:
        bucket, key = _parse_s3_uri(uri)
    except ValueError as e:
        log.error("Invalid object URI: %s", e)
        raise

    client = _get_client()
    try:
        resp = client.get_object(Bucket=bucket, Key=key)
        body = resp["Body"].read()
    except ClientError as e:
        log.error("Failed to fetch object %s: %s", uri, e)
        raise

    content_type = (resp.get("ContentType") or "").lower()
    suffix = (key.split(".")[-1] if "." in key else "").lower()

    if suffix == "json" or "json" in content_type:
        rows = _parse_json(body, id_column, cols)
    else:
        rows = _parse_csv(body, id_column, cols)

    return rows


def _parse_csv(body: bytes, id_column: str, text_columns: list[str]) -> dict[str, str]:
    """Parse CSV bytes into id -> text map."""
    text = body.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or id_column not in reader.fieldnames:
        raise ValueError(f"CSV missing id column '{id_column}'. Columns: {reader.fieldnames}")

    missing = [c for c in text_columns if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"CSV missing text columns {missing}. Columns: {reader.fieldnames}")

    out: dict[str, str] = {}
    for row in reader:
        rid = (row.get(id_column) or "").strip()
        if not rid:
            continue
        parts = []
        for col in text_columns:
            v = (row.get(col) or "").strip()
            if v:
                parts.append(v)
        text_val = " ".join(parts).strip()
        if text_val:
            out[rid] = text_val
    return out


def _parse_json(body: bytes, id_column: str, text_columns: list[str]) -> dict[str, str]:
    """Parse JSON (array of objects) into id -> text map."""
    data = json.loads(body)
    if not isinstance(data, list):
        data = [data]

    out: dict[str, str] = {}
    for item in data:
        if not isinstance(item, dict):
            continue
        rid = str(item.get(id_column) or "").strip()
        if not rid:
            continue
        parts = []
        for col in text_columns:
            v = item.get(col)
            if v is not None and str(v).strip():
                parts.append(str(v).strip())
        text_val = " ".join(parts).strip()
        if text_val:
            out[rid] = text_val
    return out
