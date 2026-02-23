"""Worker-embeddings: Kafka consumer for text-to-feature extraction (BGE 1024-dim)."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
import threading
import time
import uuid
from contextlib import contextmanager
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor
from confluent_kafka import Consumer, KafkaError, KafkaException

from raw_loader import load_rows_from_uri
from resolver.embedding import embed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("worker-embeddings")

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@db:5432/tracefield"
)
KAFKA_BOOTSTRAP = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
KAFKA_TOPIC = os.environ.get("EMBEDDINGS_KAFKA_TOPIC", "features")
KAFKA_GROUP = os.environ.get("EMBEDDINGS_KAFKA_GROUP", "worker-embeddings")
EMBEDDINGS_MODEL = os.environ.get("EMBEDDINGS_MODEL", "BAAI/bge-large-en-v1.5")
DIM = 1024


@contextmanager
def db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def update_job_status(
    conn, job_id: str, status: str, result: str | None = None, exc_info: str | None = None
):
    now_ms = int(time.time() * 1000)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE job_status
            SET status = %s,
                started_at = CASE WHEN %s = 'STARTED' THEN %s ELSE started_at END,
                ended_at = CASE WHEN %s IN ('FINISHED', 'FAILED') THEN %s ELSE ended_at END,
                result = %s, exc_info = %s, updated_at = NOW()
            WHERE id = %s::uuid
            """,
            (status, status, now_ms, status, now_ms, result, exc_info, job_id),
        )


def get_dataset_file_uris(conn, dataset_id: str) -> list[str]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT object_uri FROM dataset_files WHERE dataset_id = %s::uuid",
            (dataset_id,),
        )
        rows = cur.fetchall()
    return [r["object_uri"] for r in rows if r.get("object_uri")]


def get_entity_mappings(conn, dataset_id: str) -> dict[str, uuid.UUID]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT source_record_id, entity_id
            FROM entity_map
            WHERE dataset_id = %s::uuid AND source_record_id IS NOT NULL
            """,
            (dataset_id,),
        )
        rows = cur.fetchall()
    return {str(r["source_record_id"]): r["entity_id"] for r in rows}


def _config_hash(config: dict) -> str:
    canonical = json.dumps(config, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def emit_provenance(
    conn,
    job_id: str,
    dataset_id: str,
    config_hash: str,
    counts: dict,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO provenance_event (job_id, dataset_id, stage, detail, created_at)
            VALUES (%s::uuid, %s::uuid, 'embeddings', %s, NOW())
            """,
            (
                job_id,
                dataset_id,
                json.dumps(
                    {
                        "config_hash": config_hash,
                        "model": EMBEDDINGS_MODEL,
                        "dim": DIM,
                        "extracted": counts.get("extracted", 0),
                        "skipped": counts.get("skipped", 0),
                    }
                ),
            ),
        )


def upsert_embedding_1024(
    conn,
    entity_id: uuid.UUID,
    model_name: str,
    vector: list[float],
    text_hash: str | None = None,
    source: str | None = None,
):
    vec_str = "[" + ",".join(str(x) for x in vector) + "]"
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO embeddings_1024
                (entity_id, model_name, dim, vector, text_hash, source, updated_at, created_at)
            VALUES (%s::uuid, %s, %s, %s::vector, %s, %s, NOW(), NOW())
            ON CONFLICT (entity_id, model_name)
            DO UPDATE SET
                vector = EXCLUDED.vector,
                text_hash = EXCLUDED.text_hash,
                source = EXCLUDED.source,
                updated_at = NOW()
            """,
            (str(entity_id), model_name, DIM, vec_str, text_hash, source),
        )


def run_embeddings_extract(conn, job: dict) -> None:
    job_id = job.get("id")
    kwargs = job.get("kwargs") or {}
    dataset_id = kwargs.get("dataset_id") or (job.get("args") or [""])[0]
    text_column = kwargs.get("text_column") or kwargs.get("textColumn")
    text_columns_str = kwargs.get("text_columns") or kwargs.get("textColumns")
    id_column = kwargs.get("id_column") or kwargs.get("idColumn") or "id"

    if not dataset_id:
        raise ValueError("Missing dataset_id in job config")
    if not text_column and not text_columns_str:
        raise ValueError("Missing text_column or text_columns in job config")

    text_columns = json.loads(text_columns_str) if text_columns_str else [text_column]

    uris = get_dataset_file_uris(conn, dataset_id)
    if not uris:
        raise ValueError(f"No dataset files found for dataset {dataset_id}")

    mappings = get_entity_mappings(conn, dataset_id)
    if not mappings:
        raise ValueError(f"No entity mappings for dataset {dataset_id}")

    all_rows: dict[str, str] = {}
    for uri in uris:
        rows = load_rows_from_uri(
            uri,
            id_column=id_column,
            text_columns=text_columns,
        )
        all_rows.update(rows)

    entity_order: list[tuple[uuid.UUID, str]] = []
    for source_record_id, entity_id in mappings.items():
        text = all_rows.get(str(source_record_id).strip())
        if text:
            entity_order.append((entity_id, text))

    if not entity_order:
        raise ValueError(
            "No overlapping records between entity_map and raw data with non-empty text"
        )

    entity_ids, texts = zip(*entity_order)
    vectors = embed(list(texts))
    if vectors.shape[0] != len(texts) or vectors.shape[1] != DIM:
        raise RuntimeError(
            f"Embedding shape {vectors.shape} unexpected; expected ({len(texts)}, {DIM})"
        )

    model_name = EMBEDDINGS_MODEL.replace("/", "_").replace(".", "_")
    for i, eid in enumerate(entity_ids):
        vec = vectors[i].tolist()
        upsert_embedding_1024(conn, eid, model_name, vec, source=dataset_id)

    config = {"dataset_id": dataset_id, "text_column": text_column, "id_column": id_column}
    config_hash = _config_hash(config)
    emit_provenance(
        conn,
        job_id,
        dataset_id,
        config_hash,
        {"extracted": len(entity_order), "skipped": len(mappings) - len(entity_order)},
    )


def process_job(job: dict) -> None:
    job_id = job.get("id")
    if job.get("function") != "embeddings.extract":
        log.info("Skipping non-embeddings job: %s", job.get("function"))
        return

    with db_connection() as conn:
        update_job_status(conn, job_id, "STARTED")
        try:
            run_embeddings_extract(conn, job)
            update_job_status(conn, job_id, "FINISHED", result=json.dumps({"ok": True}))
            log.info("Completed embeddings job %s", job_id)
        except Exception as e:
            log.exception("Embeddings job %s failed", job_id)
            update_job_status(conn, job_id, "FAILED", exc_info=str(e))
            raise


def run_consumer():
    conf = {
        "bootstrap.servers": KAFKA_BOOTSTRAP,
        "group.id": KAFKA_GROUP,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    }
    consumer = Consumer(conf)
    consumer.subscribe([KAFKA_TOPIC])
    log.info("Subscribed to %s", KAFKA_TOPIC)

    while True:
        try:
            msg = consumer.poll(timeout=5.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                raise KafkaException(msg.error())

            payload = msg.value()
            if not payload:
                continue

            job = json.loads(payload)
            try:
                process_job(job)
                consumer.commit(message=msg)
            except Exception:
                log.exception("Job processing failed, not committing offset")
        except Exception as e:
            log.exception("Consumer error: %s", e)
            time.sleep(5)


from fastapi import FastAPI

app = FastAPI(title="worker-embeddings")


@app.on_event("startup")
def startup():
    t = threading.Thread(target=run_consumer, daemon=True)
    t.start()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "worker-embeddings"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
