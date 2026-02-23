$log = "deploy/startup.log"

# Vent til Docker engine svarer
"Waiting for Docker engine..." | Out-File -FilePath $log -Append

for($i=0;$i -lt 60;$i++){
    docker version *> $null
    if($LASTEXITCODE -eq 0){
        "Docker is ready" | Out-File -FilePath $log -Append
        break
    }
    Start-Sleep 5
}

$registry = "ghcr.io/jnydal/tracefield-lab"

$env:TRACEFIELD_API_IMAGE              = "$registry/api:latest"
$env:TRACEFIELD_FRONTEND_IMAGE         = "$registry/frontend:latest"
$env:TRACEFIELD_WORKER_INGEST_IMAGE    = "$registry/worker-ingest:latest"
$env:TRACEFIELD_WORKER_EMBEDDINGS_IMAGE = "$registry/worker-embeddings:latest"
$env:TRACEFIELD_RESOLVER_IMAGE         = "$registry/resolver:latest"

# Start compose stack in prod
Set-Location 'C:\workspace\tracefield-lab'

# Windows: add override to disable Watchtower (avoids restart loop on Docker Desktop)
$composeFiles = "-f docker-compose.yml -f docker-compose.prod.yml"
if ($IsWindows -ne $false) {
    $composeFiles += " -f deploy/docker-compose.windows.yml"
}

"Running docker compose up (pull always)..." | Out-File -FilePath $log -Append
# Use cmd /c to avoid PowerShell treating docker stderr (progress messages) as errors
# --pull always: fetch latest images on each run (replaces Watchtower when using scheduled start.ps1)
cmd /c "docker compose $composeFiles up -d --pull always --remove-orphans 2>&1" | Out-File -FilePath $log -Append
"--- docker ps ---" | Out-File -Append $log
cmd /c "docker ps --format ""table {{.Names}}`t{{.Status}}"" 2>&1" | Out-File -FilePath $log -Append
"Done." | Out-File -FilePath $log -Append
