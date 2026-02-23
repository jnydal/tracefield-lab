FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY requirements/base.txt requirements/workers.txt requirements/workers-embeddings.txt ./
RUN pip install --upgrade pip && pip install -r workers-embeddings.txt

COPY service/ /app/service/
WORKDIR /app/service/worker_embeddings
ENV PYTHONPATH=/app/service

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
