$log = "deploy/startup.log"

function Wait-DockerReady {
    "Waiting for Docker engine..." | Out-File -FilePath $log -Append
    for ($i = 0; $i -lt 60; $i++) {
        docker version *> $null
        if ($LASTEXITCODE -eq 0) {
            "Docker is ready" | Out-File -FilePath $log -Append
            return $true
        }
        Start-Sleep 5
    }
    return $false
}

# Wait for Docker (e.g. after boot or after Docker Desktop restart during a large pull)
if (-not (Wait-DockerReady)) {
    "Docker did not become ready within 5 minutes. Exiting." | Out-File -FilePath $log -Append
    exit 1
}

# Prune unused Docker data to avoid disk filling up (runs automatically, no prompt)
"Running docker system prune..." | Out-File -FilePath $log -Append
docker system prune -f 2>&1 | Out-File -FilePath $log -Append
"Prune done." | Out-File -FilePath $log -Append

$registry = "ghcr.io/jnydal/tracefield-lab"

$env:TRACEFIELD_API_IMAGE              = "$registry/api:latest"
$env:TRACEFIELD_FRONTEND_IMAGE         = "$registry/frontend:latest"
$env:TRACEFIELD_WORKER_INGEST_IMAGE    = "$registry/worker-ingest:latest"
$env:TRACEFIELD_WORKER_EMBEDDINGS_IMAGE = "$registry/worker-embeddings:latest"
$env:TRACEFIELD_RESOLVER_IMAGE         = "$registry/resolver:latest"

# Start compose stack in prod
Set-Location 'C:\workspace\tracefield-lab'

$composeFiles = "-f docker-compose.yml -f docker-compose.prod.yml"

# Run compose; capture output and exit code so we can retry if Docker dropped connection during pull.
# Large image pulls can cause Docker Desktop to restart (named pipe error); script retries once.
$maxComposeAttempts = 2
$composeSucceeded = $false

for ($attempt = 1; $attempt -le $maxComposeAttempts; $attempt++) {
    "Running docker compose up (pull policy per service) [attempt $attempt/$maxComposeAttempts]..." | Out-File -FilePath $log -Append
    $composeOutput = cmd /c "docker compose $composeFiles up -d --remove-orphans 2>&1"
    $composeExit = $LASTEXITCODE
    $composeOutput | Out-File -FilePath $log -Append
    if ($composeExit -eq 0) {
        $composeSucceeded = $true
        break
    }
    "Compose exited with code $composeExit (Docker may have restarted during large image pull)." | Out-File -FilePath $log -Append
    if ($attempt -lt $maxComposeAttempts) {
        "Waiting for Docker again, then retrying..." | Out-File -FilePath $log -Append
        if (-not (Wait-DockerReady)) {
            "Docker did not become ready. Exiting." | Out-File -FilePath $log -Append
            exit 1
        }
    }
}

if (-not $composeSucceeded) {
    "Compose failed after $maxComposeAttempts attempt(s). See above for errors. Check Docker Desktop resources (memory/disk)." | Out-File -FilePath $log -Append
    exit 1
}

"--- docker ps ---" | Out-File -Append $log
cmd /c "docker ps --format ""table {{.Names}}`t{{.Status}}"" 2>&1" | Out-File -FilePath $log -Append
"Done." | Out-File -FilePath $log -Append
