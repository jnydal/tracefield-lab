"""Worker-analysis: polls for queued analysis jobs, runs statistical tests, writes results."""
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
import numpy as np
from scipy import stats
from scipy.cluster.vq import kmeans2

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("worker-analysis")

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:postgres@db:5432/tracefield"
)
POLL_INTERVAL_SEC = int(os.environ.get("ANALYSIS_POLL_INTERVAL_SEC", "5"))
EMBEDDINGS_MODEL = os.environ.get("EMBEDDINGS_MODEL", "BAAI/bge-large-en-v1.5")

# Model name as stored in embeddings_1024 (slashes/dots replaced)
def _embedding_model_name() -> str:
    return EMBEDDINGS_MODEL.replace("/", "_").replace(".", "_")


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
            UPDATE analysis_jobs
            SET status = 'running', started_at = NOW()
            WHERE id = (
                SELECT id FROM analysis_jobs
                WHERE status = 'queued'
                ORDER BY created_at
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, name, config_json
            """
        )
        row = cur.fetchone()
    return dict(row) if row else None


def get_feature_def_id_by_name(conn, name: str) -> uuid.UUID | None:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM feature_definitions WHERE name = %s", (name,)
        )
        row = cur.fetchone()
    return row["id"] if row else None


def _is_embedding_feature(name: str) -> bool:
    return (name or "").startswith("embeddings.")


def load_features_for_definitions(
    conn,
    left_id: uuid.UUID,
    right_id: uuid.UUID,
    left_name: str,
    right_name: str,
    config: dict,
) -> list[dict]:
    """Load entity_id, left value, right value for entities that have both features.
    Supports embedding definitions (embeddings.bge_large) via leftDimension/rightDimension in config.
    """
    left_emb = _is_embedding_feature(left_name)
    right_emb = _is_embedding_feature(right_name)
    left_dim = int(config.get("leftDimension", config.get("left_dimension", 0)))
    right_dim = int(config.get("rightDimension", config.get("right_dimension", 0)))
    model_name = _embedding_model_name()

    if left_emb and right_emb:
        # Both from embeddings_1024, different dimensions
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    entity_id,
                    (vector[%s])::float AS left_num,
                    NULL::text AS left_text,
                    (vector[%s])::float AS right_num,
                    NULL::text AS right_text
                FROM embeddings_1024
                WHERE model_name = %s
                """,
                (left_dim + 1, right_dim + 1, model_name),
            )
            rows = cur.fetchall()
    elif left_emb:
        # Left from embeddings, right from features
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    e.entity_id,
                    (e.vector[%s])::float AS left_num,
                    NULL::text AS left_text,
                    f.value_num AS right_num,
                    f.value_text AS right_text
                FROM embeddings_1024 e
                JOIN features f ON e.entity_id = f.entity_id AND f.feature_definition_id = %s
                WHERE e.model_name = %s
                """,
                (left_dim + 1, right_id, model_name),
            )
            rows = cur.fetchall()
    elif right_emb:
        # Left from features, right from embeddings
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    f.entity_id,
                    f.value_num AS left_num,
                    f.value_text AS left_text,
                    (e.vector[%s])::float AS right_num,
                    NULL::text AS right_text
                FROM features f
                JOIN embeddings_1024 e ON f.entity_id = e.entity_id AND e.model_name = %s
                WHERE f.feature_definition_id = %s
                """,
                (right_dim + 1, model_name, left_id),
            )
            rows = cur.fetchall()
    else:
        # Both from features (original logic)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    l.entity_id,
                    l.value_num AS left_num,
                    l.value_text AS left_text,
                    r.value_num AS right_num,
                    r.value_text AS right_text
                FROM features l
                JOIN features r ON l.entity_id = r.entity_id
                    AND r.feature_definition_id = %s
                WHERE l.feature_definition_id = %s
                """,
                (right_id, left_id),
            )
            rows = cur.fetchall()
    return [dict(r) for r in rows]


def run_anova(left_values: list[float], groups: list[str]) -> dict:
    """One-way ANOVA: numeric variable grouped by categorical."""
    group_to_values: dict[str, list[float]] = {}
    for g, v in zip(groups, left_values):
        if v is not None and not (isinstance(v, float) and (v != v)):  # skip NaN
            group_to_values.setdefault(g, []).append(float(v))
    group_values = [v for v in group_to_values.values() if len(v) >= 1]
    if len(group_values) < 2:
        f_stat, p_val = float("nan"), float("nan")
    else:
        f_stat, p_val = stats.f_oneway(*group_values)
    return {
        "test": "anova",
        "f_statistic": float(f_stat),
        "p_value": float(p_val),
        "n_groups": len(group_values),
        "n_total": sum(len(g) for g in group_values),
    }


def run_spearman(x: list[float], y: list[float]) -> dict:
    """Spearman correlation between two numeric variables."""
    valid = [
        (a, b)
        for a, b in zip(x, y)
        if a is not None and b is not None
        and not (isinstance(a, float) and a != a)
        and not (isinstance(b, float) and b != b)
    ]
    if len(valid) < 3:
        return {
            "test": "spearman",
            "correlation": float("nan"),
            "p_value": float("nan"),
            "n": len(valid),
        }
    xs, ys = zip(*valid)
    r, p = stats.spearmanr(xs, ys)
    return {
        "test": "spearman",
        "correlation": float(r),
        "p_value": float(p),
        "n": len(valid),
    }


def run_embedding_clustering(
    conn,
    config: dict,
    embedding_def_id: uuid.UUID,
    outcome_def_id: uuid.UUID,
) -> dict:
    """Cluster entities by embedding, then ANOVA of outcome by cluster."""
    n_clusters = int(config.get("nClusters", config.get("n_clusters", 3)))
    model_name = _embedding_model_name()

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT entity_id, vector
            FROM embeddings_1024
            WHERE model_name = %s
            """,
            (model_name,),
        )
        emb_rows = cur.fetchall()

    if not emb_rows:
        raise ValueError(f"No embeddings found for model {model_name}")

    entity_ids = [r["entity_id"] for r in emb_rows]
    vec_data = []
    for r in emb_rows:
        v = r["vector"]
        if isinstance(v, str):
            vec_data.append([float(x) for x in v.strip("[]").split(",")])
        else:
            vec_data.append(list(v))
    vectors = np.array(vec_data, dtype=np.float64)

    if len(vectors) < n_clusters:
        raise ValueError(
            f"Need at least {n_clusters} entities for clustering, got {len(vectors)}"
        )

    _, labels = kmeans2(vectors, n_clusters, minit="++", seed=42)
    entity_to_cluster = {eid: int(l) for eid, l in zip(entity_ids, labels)}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT entity_id, value_num
            FROM features
            WHERE feature_definition_id = %s AND value_num IS NOT NULL
            """,
            (outcome_def_id,),
        )
        outcome_rows = cur.fetchall()

    entity_to_outcome = {r["entity_id"]: float(r["value_num"]) for r in outcome_rows}

    cluster_labels: dict[str, list[float]] = {}
    for eid, cluster in entity_to_cluster.items():
        outcome = entity_to_outcome.get(eid)
        if outcome is not None:
            cluster_labels.setdefault(str(cluster), []).append(outcome)

    group_values = list(cluster_labels.values())
    if len(group_values) < 2:
        return {
            "test": "embedding_clustering",
            "n_clusters": n_clusters,
            "n_entities": len(emb_rows),
            "f_statistic": float("nan"),
            "p_value": float("nan"),
            "n_groups": len(group_values),
            "n_total": sum(len(g) for g in group_values),
        }

    f_stat, p_val = stats.f_oneway(*group_values)
    return {
        "test": "embedding_clustering",
        "n_clusters": n_clusters,
        "n_entities": len(emb_rows),
        "f_statistic": float(f_stat),
        "p_value": float(p_val),
        "n_groups": len(group_values),
        "n_total": sum(len(g) for g in group_values),
    }


def run_analysis(config: dict, rows: list[dict]) -> dict:
    test_type = (config.get("test") or "anova").lower()
    left_num = [r["left_num"] for r in rows]
    right_num = [r["right_num"] for r in rows]
    left_text = [r["left_text"] or "" for r in rows]
    right_text = [r["right_text"] or "" for r in rows]

    if test_type == "anova":
        # numeric (left) grouped by categorical (right)
        return run_anova(left_num, right_text)
    if test_type == "spearman":
        return run_spearman(left_num, right_num)
    # default: anova
    return run_anova(left_num, right_text)


def insert_result(
    conn,
    job_id: uuid.UUID,
    feature_x_id: uuid.UUID,
    feature_y_id: uuid.UUID,
    stats_dict: dict,
    p_value: float | None,
    effect_size: float | None,
    correction: str | None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO analysis_results
            (id, job_id, feature_x_id, feature_y_id, stats_json, p_value, effect_size, correction, created_at)
            VALUES (%s::uuid, %s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, NOW())
            """,
            (
                str(uuid.uuid4()),
                str(job_id),
                str(feature_x_id),
                str(feature_y_id),
                json.dumps(stats_dict),
                p_value,
                effect_size,
                correction,
            ),
        )


def complete_job(conn, job_id: uuid.UUID):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE analysis_jobs SET status = 'completed', ended_at = NOW() WHERE id = %s::uuid",
            (str(job_id),),
        )


def fail_job(conn, job_id: uuid.UUID, exc_info: str):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE analysis_jobs SET status = 'failed', ended_at = NOW() WHERE id = %s::uuid",
            (str(job_id),),
        )
    log.error("Job %s failed: %s", job_id, exc_info)


def process_job(conn, job: dict) -> None:
    job_id = job["id"]
    name = job["name"]
    config = job["config_json"]
    if isinstance(config, str):
        config = json.loads(config)

    test_type = (config.get("test") or "anova").lower()
    if test_type == "embedding_clustering":
        embedding_def = config.get("embeddingDef") or config.get("embedding_def")
        outcome_feature = config.get("outcomeFeature") or config.get("outcome_feature")
        if not embedding_def or not outcome_feature:
            raise ValueError(
                "embedding_clustering requires embeddingDef and outcomeFeature in config"
            )
        emb_id = get_feature_def_id_by_name(conn, embedding_def)
        outcome_id = get_feature_def_id_by_name(conn, outcome_feature)
        if not emb_id:
            raise ValueError(f"Feature definition not found: {embedding_def}")
        if not outcome_id:
            raise ValueError(f"Feature definition not found: {outcome_feature}")
        stats_dict = run_embedding_clustering(conn, config, emb_id, outcome_id)
        p_value = stats_dict.get("p_value", float("nan"))
        if p_value != p_value:
            p_value = None
        effect_size = stats_dict.get("effect_size")
        insert_result(
            conn,
            job_id,
            outcome_id,
            emb_id,
            stats_dict,
            p_value,
            effect_size,
            config.get("correction"),
        )
        complete_job(conn, job_id)
        log.info("Completed job %s (%s)", job_id, name)
        return

    left_name = config.get("leftFeatureSet") or config.get("featureSetA")
    right_name = config.get("rightFeatureSet") or config.get("featureSetB")
    # Accept arrays (take first element) or single string
    if isinstance(left_name, list):
        left_name = left_name[0] if left_name else None
    if isinstance(right_name, list):
        right_name = right_name[0] if right_name else None
    if not left_name or not right_name:
        raise ValueError(
            "Config must have leftFeatureSet/rightFeatureSet or featureSetA/featureSetB "
            "(feature definition names)"
        )

    left_id = get_feature_def_id_by_name(conn, left_name)
    right_id = get_feature_def_id_by_name(conn, right_name)
    if not left_id:
        raise ValueError(f"Feature definition not found: {left_name}")
    if not right_id:
        raise ValueError(f"Feature definition not found: {right_name}")

    rows = load_features_for_definitions(
        conn, left_id, right_id, left_name or "", right_name or "", config
    )
    if not rows:
        raise ValueError("No overlapping entity-feature data for left and right feature sets")

    stats_dict = run_analysis(config, rows)
    p_value = stats_dict.get("p_value", float("nan"))
    if p_value != p_value:  # NaN
        p_value = None

    correction = config.get("correction")
    effect_size = stats_dict.get("correlation") or stats_dict.get("effect_size")
    if effect_size is not None and (isinstance(effect_size, float) and effect_size != effect_size):
        effect_size = None

    insert_result(
        conn,
        job_id,
        left_id,
        right_id,
        stats_dict,
        p_value if p_value is not None else None,
        effect_size,
        correction,
    )
    complete_job(conn, job_id)
    log.info("Completed job %s (%s)", job_id, name)


def run_worker():
    log.info("Starting analysis worker, polling every %s sec", POLL_INTERVAL_SEC)
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

app = FastAPI(title="worker-analysis")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "worker-analysis"}


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
