#!/usr/bin/env bash
# Run full-workflow integration tests in Docker against the compose DB.
# Requires: Docker, docker compose. Start the stack (at least db) first, e.g.:
#   docker compose up -d db
# Then run:
#   ./scripts/run-integration-tests.sh
# Or from repo root: docker compose --profile integration-test run --rm test-integration

set -e
cd "$(dirname "$0")/.."
docker compose --profile integration-test run --rm test-integration
