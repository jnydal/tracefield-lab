"""Resolver: polls resolution_jobs, runs semantic entity resolution."""
from __future__ import annotations

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

from resolver import resolution

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("resolver")

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@db:5432/tracefield"
)
POLL_INTERVAL_SEC = int(os.environ.get("RESOLUTION_POLL_INTERVAL_SEC", "5"))


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


def fetch_queued_job(conn) -> dict[str, Any] | None:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            UPDATE resolution_jobs
            SET status = 'running', started_at = NOW()
            WHERE id = (
                SELECT id FROM resolution_jobs
                WHERE status = 'queued'
                ORDER BY created_at
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, name, config_json, dataset_id, entity_type
            """
        )
        row = cur.fetchone()
    return dict(row) if row else None


def complete_job(conn, job_id: uuid.UUID, result_summary: dict):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE resolution_jobs
            SET status = 'completed', ended_at = NOW(), result_summary = %s
            WHERE id = %s
            """,
            (json.dumps(result_summary), str(job_id)),
        )


def fail_job(conn, job_id: uuid.UUID, exc_info: str):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE resolution_jobs
            SET status = 'failed', ended_at = NOW(), exc_info = %s
            WHERE id = %s
            """,
            (exc_info, str(job_id)),
        )
    log.error("Job %s failed: %s", job_id, exc_info)


def process_job(conn, job: dict) -> None:
    job_id = job["id"]
    name = job["name"]
    log.info(
        "Processing resolution job %s (%s) dataset=%s",
        job_id,
        name,
        job.get("dataset_id"),
        extra={"service": "resolver", "job_id": str(job_id), "dataset_id": str(job.get("dataset_id", ""))},
    )
    result = resolution.run_resolution(conn, job)
    complete_job(conn, job_id, result)
    log.info(
        "Completed resolution job %s (%s): exact=%s semantic=%s created=%s unmatched=%s",
        job_id,
        name,
        result.get("exact", 0),
        result.get("semantic", 0),
        result.get("created", 0),
        result.get("unmatched", 0),
        extra={"service": "resolver", "job_id": str(job_id)},
    )


def run_worker():
    log.info("Starting resolution worker, polling every %s sec", POLL_INTERVAL_SEC)
    while True:
        try:
            with db_connection() as conn:
                job = fetch_queued_job(conn)
                if job:
                    try:
                        process_job(conn, job)
                    except Exception as e:
                        log.exception("Error processing job %s", job["id"])
                        fail_job(conn, job["id"], str(e))
        except Exception as e:
            log.exception("Worker iteration error: %s", e)
        time.sleep(POLL_INTERVAL_SEC)


from fastapi import FastAPI

app = FastAPI(title="resolver")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "resolver"}


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "worker":
        run_worker()
        return

    import uvicorn

    def start_worker():
        run_worker()

    t = threading.Thread(target=start_worker, daemon=True)
    t.start()

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
