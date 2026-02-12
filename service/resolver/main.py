"""Resolver: placeholder entrypoint. Replace with entity-resolution logic when ready."""
from __future__ import annotations

import uvicorn
from fastapi import FastAPI

app = FastAPI(title="resolver")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "resolver"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
