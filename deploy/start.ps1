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
"Running docker compose up..." | Out-File -FilePath $log -Append
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans 2>&1 | Out-File -FilePath $log -Append
"--- docker ps ---" | Out-File -Append $log
docker ps --format "table {{.Names}}`t{{.Status}}" 2>&1 | Out-File -FilePath $log -Append
"Done." | Out-File -FilePath $log -Append
