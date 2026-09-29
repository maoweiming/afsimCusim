# TrueSim Data Platform - Development Startup Script (Windows)
# Starts all services locally for development

$ErrorActionPreference = "Stop"
$PlatformDir = Split-Path -Parent $PSScriptRoot

Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  TrueSim Data Platform - Dev Mode" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Default environment
if (-not $env:MONGODB_URI) { $env:MONGODB_URI = "mongodb://localhost:27017" }
if (-not $env:REDIS_URL) { $env:REDIS_URL = "redis://localhost:6379" }
if (-not $env:INFLUXDB_URL) { $env:INFLUXDB_URL = "http://localhost:8086" }
if (-not $env:NATS_URL) { $env:NATS_URL = "nats://localhost:4222" }

# Start infrastructure
Write-Host "Starting infrastructure with Docker Compose..." -ForegroundColor Yellow
try {
    Push-Location "$PlatformDir\deploy"
    docker compose up -d mongo redis influxdb nats minio
    Write-Host "Waiting for services to be healthy..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
    Pop-Location
} catch {
    Write-Host "Docker not available. Please start MongoDB, Redis, InfluxDB manually." -ForegroundColor Red
    Pop-Location
}

Write-Host ""
Write-Host "Starting Go services..." -ForegroundColor Yellow

# Start services as background jobs
$equipmentJob = Start-Job -ScriptBlock {
    Set-Location "$using:PlatformDir\services\equipment"
    go run cmd/main.go
}

$scenarioJob = Start-Job -ScriptBlock {
    Set-Location "$using:PlatformDir\services\scenario"
    go run cmd/main.go
}

$timeseriesJob = Start-Job -ScriptBlock {
    Set-Location "$using:PlatformDir\services\timeseries"
    go run cmd/main.go
}

$gatewayJob = Start-Job -ScriptBlock {
    Set-Location "$using:PlatformDir\services\data-gateway"
    go run cmd/main.go
}

Write-Host ""
Write-Host "===================================" -ForegroundColor Green
Write-Host "  All services started!" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Equipment Service:  localhost:50051 (gRPC)" -ForegroundColor White
Write-Host "  Scenario Service:   localhost:50052 (gRPC)" -ForegroundColor White
Write-Host "  Timeseries Service: localhost:50053 (gRPC)" -ForegroundColor White
Write-Host "  Data Gateway:       localhost:8080  (REST)" -ForegroundColor White
Write-Host ""
Write-Host "  API Base URL: http://localhost:8080/api/v1" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Gray
Write-Host ""

# Wait for Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 1
        # Check if any job failed
        foreach ($job in @($equipmentJob, $scenarioJob, $timeseriesJob, $gatewayJob)) {
            if ($job.State -eq "Failed") {
                Write-Host "Service failed: $($job.ChildJobs[0].JobStateInfo.Reason.Message)" -ForegroundColor Red
            }
        }
    }
} finally {
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow
    Remove-Job -Job $equipmentJob, $scenarioJob, $timeseriesJob, $gatewayJob -Force -ErrorAction SilentlyContinue
    Write-Host "All services stopped." -ForegroundColor Green
}
