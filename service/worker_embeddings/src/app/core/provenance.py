"""Provenance helpers for worker events."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from psycopg2.extras import Json


def log_event(
    cur,
    *,
    stage: str,
    status: str,
    count: Optional[int] = None,
    duration_ms: Optional[int] = None,
    error: Optional[str] = None,
    meta: Optional[Mapping[str, Any]] = None,
    person_id: Optional[str] = None,
) -> None:
    payload = {
        "status": status,
        "count": count,
        "duration_ms": duration_ms,
        "error": error,
        "meta": dict(meta or {}),
    }

    cur.execute(
        "INSERT INTO provenance_event (person_id, stage, detail) VALUES (%s, %s, %s)",
        (person_id, stage, Json(payload)),
    )
