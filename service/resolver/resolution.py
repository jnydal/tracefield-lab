"""Entity resolution logic: exact match, semantic match, entity creation."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from typing import Any

import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor

from resolver.embedding import embed

log = logging.getLogger("resolver.resolution")

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@db:5432/tracefield"
)


def _config_hash(config: dict) -> str:
    """Stable hash of config for provenance."""
    canonical = json.dumps(config, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()[:16]


def _build_text(keys: dict[str, Any], fields: list[str]) -> str:
    """Concatenate values from keys for given fields."""
    parts = []
    for f in fields:
        v = keys.get(f)
        if v is not None and v != "":
            parts.append(str(v))
    return " ".join(parts) or ""


def load_entities(conn, entity_type: str) -> list[dict]:
    """Load entities of given type with id, display_name, external_ids."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, display_name, external_ids
            FROM entities
            WHERE entity_type = %s
            """,
            (entity_type,),
        )
        rows = cur.fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if isinstance(d.get("external_ids"), str):
            try:
                d["external_ids"] = json.loads(d["external_ids"])
            except Exception:
                d["external_ids"] = {}
        out.append(d)
    return out


def load_existing_mappings(
    conn, dataset_id: uuid.UUID
) -> dict[str, uuid.UUID]:
    """Load (source_record_id -> entity_id) for dataset. Skips null source_record_id."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT source_record_id, entity_id
            FROM entity_map
            WHERE dataset_id = %s AND source_record_id IS NOT NULL
            """,
            (str(dataset_id),),
        )
        return {r["source_record_id"]: r["entity_id"] for r in cur.fetchall()}


def exact_match(
    record_keys: dict,
    entities: list[dict],
    join_keys: list[str],
) -> uuid.UUID | None:
    """Find entity whose external_ids or display_name matches join key values."""
    if not join_keys or not record_keys:
        return None
    record_vals = {str(record_keys.get(k, "")).strip() for k in join_keys}
    record_vals.discard("")
    if not record_vals:
        return None

    for ent in entities:
        dn = (ent.get("display_name") or "").strip().lower()
        ext = ent.get("external_ids") or {}
        if not isinstance(ext, dict):
            ext = {}
        entity_vals = {str(v).strip().lower() for v in ext.values() if v}
        if dn:
            entity_vals.add(dn)
        for rv in record_vals:
            if rv and rv.lower() in entity_vals:
                return ent["id"]
    return None


def semantic_match(
    record_text: str,
    entities: list[dict],
    threshold: float,
) -> tuple[uuid.UUID | None, float]:
    """Find best entity by cosine similarity. Returns (entity_id, score) or (None, 0)."""
    if not record_text or not entities:
        return None, 0.0
    entity_texts = [(e["id"], (e.get("display_name") or "").strip() or "<empty>") for e in entities]
    valid = [(eid, t) for eid, t in entity_texts if t != "<empty>"]
    if not valid:
        return None, 0.0

    texts = [record_text] + [t for _, t in valid]
    vecs = embed(texts)
    if vecs.shape[0] < 2:
        return None, 0.0

    query_vec = vecs[0:1]
    entity_vecs = vecs[1:]
    scores = np.dot(entity_vecs, query_vec.T).flatten()
    best_idx = int(np.argmax(scores))
    best_score = float(scores[best_idx])
    if best_score >= threshold:
        return valid[best_idx][0], best_score
    return None, best_score


def upsert_entity_map_insert_only(
    conn,
    dataset_id: uuid.UUID,
    entity_id: uuid.UUID,
    source_record_id: str,
    source_keys: dict,
    method: str,
    score: float | None = None,
) -> bool:
    """Insert entity_map only if no mapping exists for (dataset_id, source_record_id). Returns True if inserted."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO entity_map (id, dataset_id, entity_id, source_record_id, source_keys, method, score, created_at)
            SELECT %s, %s, %s, %s, %s, %s, %s, NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM entity_map
                WHERE dataset_id = %s AND source_record_id = %s
            )
            """,
            (
                str(uuid.uuid4()),
                str(dataset_id),
                str(entity_id),
                source_record_id,
                json.dumps(source_keys) if source_keys else None,
                method,
                score,
                str(dataset_id),
                source_record_id,
            ),
        )
        return cur.rowcount > 0


def create_entity(
    conn, entity_type: str, display_name: str, external_ids: dict | None = None
) -> uuid.UUID:
    """Create new entity, return id."""
    eid = uuid.uuid4()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO entities (id, entity_type, display_name, external_ids, created_at, updated_at)
            VALUES (%s, %s, %s, %s, NOW(), NOW())
            """,
            (str(eid), entity_type, display_name, json.dumps(external_ids or {})),
        )
    return eid


def log_provenance(
    conn,
    job_id: uuid.UUID,
    dataset_id: uuid.UUID,
    config_hash: str,
    model: str,
    counts: dict,
) -> None:
    """Emit provenance_event for resolution job."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO provenance_event (job_id, dataset_id, stage, detail, created_at)
            VALUES (%s, %s, 'resolution', %s, NOW())
            """,
            (
                str(job_id),
                str(dataset_id),
                json.dumps(
                    {
                        "config_hash": config_hash,
                        "model": model,
                        "exact": counts.get("exact", 0),
                        "semantic": counts.get("semantic", 0),
                        "created": counts.get("created", 0),
                        "unmatched": counts.get("unmatched", 0),
                    }
                ),
            ),
        )


def run_resolution(conn, job: dict) -> dict:
    """
    Run resolution for one job. Returns result_summary dict.
    Job keys: id, dataset_id, entity_type, config_json.
    """
    job_id = job["id"]
    dataset_id = job["dataset_id"]
    entity_type = job["entity_type"]
    config = job["config_json"]
    if isinstance(config, str):
        config = json.loads(config)

    records = config.get("records") or []
    join_keys = config.get("joinKeys") or []
    semantic_fields = config.get("semanticFields") or ["name"]
    threshold = float(config.get("threshold") or 0.85)
    create_if_no_match = bool(config.get("createIfNoMatch") or False)

    if not records:
        return {"exact": 0, "semantic": 0, "created": 0, "unmatched": 0}

    entities = load_entities(conn, entity_type)
    existing = load_existing_mappings(conn, dataset_id)
    model_name = os.environ.get("EMBEDDINGS_MODEL", "BAAI/bge-small-en-v1.5")

    counts = {"exact": 0, "semantic": 0, "created": 0, "unmatched": 0}

    for rec in records:
        source_record_id = rec.get("source_record_id") or str(uuid.uuid4())
        keys = rec.get("keys") or {}
        if source_record_id in existing:
            continue  # Skip already mapped (idempotent)

        matched_entity_id = None
        method = ""
        score = None

        # 1. Exact match
        if join_keys:
            matched_entity_id = exact_match(keys, entities, join_keys)
            if matched_entity_id:
                method = "exact"
                score = 1.0

        # 2. Semantic match
        if not matched_entity_id:
            text = _build_text(keys, semantic_fields)
            if text:
                matched_entity_id, sim = semantic_match(text, entities, threshold)
                if matched_entity_id:
                    method = "semantic"
                    score = sim

        # 3. Create if no match
        if not matched_entity_id and create_if_no_match:
            display_name = keys.get("name") or keys.get("display_name") or source_record_id
            matched_entity_id = create_entity(conn, entity_type, str(display_name), keys)
            method = "created"
            score = 1.0
            entities.append({"id": matched_entity_id, "display_name": display_name})

        if matched_entity_id:
            inserted = upsert_entity_map_insert_only(
                conn,
                dataset_id,
                matched_entity_id,
                source_record_id,
                keys,
                method,
                score,
            )
            if inserted:
                counts[method] = counts.get(method, 0) + 1
        else:
            counts["unmatched"] = counts.get("unmatched", 0) + 1

    config_hash = _config_hash(config)
    log_provenance(conn, job_id, dataset_id, config_hash, model_name, counts)

    return counts
