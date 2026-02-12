#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT_DIR/deploy/deploy.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a
fi

if [[ -z "${TRACEFIELD_API_IMAGE:-}" ]]; then
  echo "TRACEFIELD_API_IMAGE is not set. See deploy/deploy.env.example." >&2
  exit 1
fi

COMPOSE_FILES="${TRACEFIELD_COMPOSE_FILES:-$ROOT_DIR/docker-compose.yml,$ROOT_DIR/docker-compose.prod.yml}"
IFS=',' read -r -a compose_files <<< "$COMPOSE_FILES"

compose_args=()
for file in "${compose_files[@]}"; do
  compose_args+=(-f "$file")
done

wait_for_docker() {
  local timeout_seconds="${1:-60}"
  local interval_seconds=2
  local elapsed=0

  echo "Waiting for Docker to be ready..."

  # Docker is "ready" when the daemon responds
  until docker info >/dev/null 2>&1; do
    sleep "$interval_seconds"
    elapsed=$((elapsed + interval_seconds))

    if (( elapsed >= timeout_seconds )); then
      echo "Docker did not become ready within ${timeout_seconds}s. Aborting." >&2
      exit 1
    fi

    echo "Still waiting for Docker... (${elapsed}s)"
  done

  echo "Docker is ready 🚀"
}

get_digest() {
  local img="$1"
  docker image inspect --format='{{index .RepoDigests 0}}' "$img" 2>/dev/null || true
}

# Ensure Docker is up before we do anything docker-related
wait_for_docker "${DOCKER_STARTUP_TIMEOUT:-60}"

# Services we may pull (compose service name : env var name)
# Only pull services whose image env var is set
services_to_pull=()
[[ -n "${TRACEFIELD_API_IMAGE:-}" ]] && services_to_pull+=(api)
[[ -n "${TRACEFIELD_FRONTEND_IMAGE:-}" ]] && services_to_pull+=(frontend)
[[ -n "${TRACEFIELD_WORKER_INGEST_IMAGE:-}" ]] && services_to_pull+=(worker-ingest)
[[ -n "${TRACEFIELD_WORKER_EMBEDDINGS_IMAGE:-}" ]] && services_to_pull+=(worker-embeddings)
[[ -n "${TRACEFIELD_RESOLVER_IMAGE:-}" ]] && services_to_pull+=(resolver)

# Capture digests before pull
declare -A old_digests
for svc in "${services_to_pull[@]}"; do
  case "$svc" in
    api) img="${TRACEFIELD_API_IMAGE:-}" ;;
    frontend) img="${TRACEFIELD_FRONTEND_IMAGE:-}" ;;
    worker-ingest) img="${TRACEFIELD_WORKER_INGEST_IMAGE:-}" ;;
    worker-embeddings) img="${TRACEFIELD_WORKER_EMBEDDINGS_IMAGE:-}" ;;
    resolver) img="${TRACEFIELD_RESOLVER_IMAGE:-}" ;;
    *) continue ;;
  esac
  [[ -n "$img" ]] && old_digests[$svc]=$(get_digest "$img")
done

echo "Pulling images for: ${services_to_pull[*]}"
docker compose "${compose_args[@]}" pull "${services_to_pull[@]}"

any_new=0
for svc in "${services_to_pull[@]}"; do
  case "$svc" in
    api) img="${TRACEFIELD_API_IMAGE:-}" ;;
    frontend) img="${TRACEFIELD_FRONTEND_IMAGE:-}" ;;
    worker-ingest) img="${TRACEFIELD_WORKER_INGEST_IMAGE:-}" ;;
    worker-embeddings) img="${TRACEFIELD_WORKER_EMBEDDINGS_IMAGE:-}" ;;
    resolver) img="${TRACEFIELD_RESOLVER_IMAGE:-}" ;;
    *) continue ;;
  esac
  new_digest=$(get_digest "$img")
  if [[ -z "$new_digest" ]]; then
    echo "Image not present after pull for $svc ($img). Aborting." >&2
    exit 1
  fi
  if [[ "${old_digests[$svc]:-}" != "$new_digest" ]]; then
    echo "New image detected for $svc."
    any_new=1
  fi
done

if (( any_new )); then
  echo "Redeploying..."
  docker compose "${compose_args[@]}" up -d --no-build
  exit 0
fi

container_id="$(docker compose "${compose_args[@]}" ps -q api 2>/dev/null || true)"
if [[ -n "$container_id" ]]; then
  is_running="$(docker inspect -f '{{.State.Running}}' "$container_id" 2>/dev/null || echo "false")"
else
  is_running="false"
fi

if [[ "$is_running" == "true" ]]; then
  echo "No new images and api is already running. Nothing to do."
else
  echo "No new images. Starting services..."
  docker compose "${compose_args[@]}" up -d --no-build
fi
