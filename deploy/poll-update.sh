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

# Ensure Docker is up before we do anything docker-related
wait_for_docker "${DOCKER_STARTUP_TIMEOUT:-60}"

get_digest() {
  docker image inspect --format='{{index .RepoDigests 0}}' "$TRACEFIELD_API_IMAGE" 2>/dev/null || true
}

old_digest="$(get_digest)"

echo "Checking for updates: $TRACEFIELD_API_IMAGE"
docker compose "${compose_args[@]}" pull api

new_digest="$(get_digest)"

if [[ -z "$new_digest" ]]; then
  echo "Image not present after pull. Aborting." >&2
  exit 1
fi

if [[ "$old_digest" != "$new_digest" ]]; then
  echo "New image detected. Redeploying..."
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
  echo "No new image and api is already running. Nothing to do."
else
  echo "No new image. Starting services..."
  docker compose "${compose_args[@]}" up -d --no-build
fi
