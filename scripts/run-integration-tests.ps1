# Run full-workflow integration tests in Docker against the compose DB.
# Requires: Docker, docker compose. Start the stack (at least db) first, e.g.:
#   docker compose up -d db
# Then run:
#   ./scripts/run-integration-tests.ps1
# Or from repo root: docker compose --profile integration-test run --rm test-integration

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
Push-Location $rootDir
try {
    docker compose --profile integration-test run --rm test-integration
} finally {
    Pop-Location
}
