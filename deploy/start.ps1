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

"Running docker compose up (pull policy per service)..." | Out-File -FilePath $log -Append
# Use cmd /c to avoid PowerShell treating docker stderr (progress messages) as errors
# Pull policy is per-service in docker-compose.prod.yml: api, frontend, workers, resolver=always
cmd /c "docker compose $composeFiles up -d --remove-orphans 2>&1" | Out-File -FilePath $log -Append
"--- docker ps ---" | Out-File -Append $log
cmd /c "docker ps --format ""table {{.Names}}`t{{.Status}}"" 2>&1" | Out-File -FilePath $log -Append
"Done." | Out-File -FilePath $log -Append
