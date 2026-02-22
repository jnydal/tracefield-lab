"""Worker-embeddings: placeholder entrypoint. Replace with Kafka consumer when ready."""
from __future__ import annotations

import uvicorn
from fastapi import FastAPI

app = FastAPI(title="worker-embeddings")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "worker-embeddings"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
