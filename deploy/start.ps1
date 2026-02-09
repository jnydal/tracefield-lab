# Vent til Docker engine svarer
"Waiting for Docker engine..."
for($i=0;$i -lt 60;$i++){
    docker version *> $null
    if($LASTEXITCODE -eq 0){
        "Docker is ready"
        break
    }
    Start-Sleep 5
}

# Start compose stack
Set-Location 'C:\workspace\tracefield-lab'
"Running docker compose up..."
docker compose up -d --remove-orphans 2>&1

"--- docker ps ---" | Out-File -Append $log
docker ps --format "table {{.Names}}\t{{.Status}}" 2>&1

"Done."
