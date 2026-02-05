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
else
  echo "No new image. Ensuring services are running..."
fi

docker compose "${compose_args[@]}" up -d --no-build
