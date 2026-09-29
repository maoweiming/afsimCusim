#!/bin/bash
# TrueSim Data Platform - Development Startup Script
# Starts all services locally for development

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"

echo "==================================="
echo "  TrueSim Data Platform - Dev Mode"
echo "==================================="
echo ""

# Check dependencies
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "ERROR: $1 is not installed"
    return 1
  fi
  echo "OK: $1 found"
}

echo "Checking dependencies..."
check_command go
check_command docker || true
echo ""

# Default environment
export MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export INFLUXDB_URL="${INFLUXDB_URL:-http://localhost:8086}"
export NATS_URL="${NATS_URL:-nats://localhost:4222}"

# Infrastructure
echo "Starting infrastructure with Docker Compose..."
if command -v docker &> /dev/null; then
  cd "$PLATFORM_DIR/deploy"
  docker compose up -d mongo redis influxdb nats minio
  echo "Waiting for services to be healthy..."
  sleep 5
  cd "$PLATFORM_DIR"
else
  echo "Docker not available. Please start MongoDB, Redis, InfluxDB manually."
fi

echo ""
echo "Starting Go services..."

# Equipment Service
echo "  Starting equipment-service on :50051..."
cd "$PLATFORM_DIR/services/equipment"
go run cmd/main.go &
EQUIPMENT_PID=$!

# Scenario Service
echo "  Starting scenario-service on :50052..."
cd "$PLATFORM_DIR/services/scenario"
go run cmd/main.go &
SCENARIO_PID=$!

# Timeseries Service
echo "  Starting timeseries-service on :50053..."
cd "$PLATFORM_DIR/services/timeseries"
go run cmd/main.go &
TIMESERIES_PID=$!

# Data Gateway
echo "  Starting data-gateway on :8080..."
cd "$PLATFORM_DIR/services/data-gateway"
go run cmd/main.go &
GATEWAY_PID=$!

cd "$PLATFORM_DIR"

echo ""
echo "==================================="
echo "  All services started!"
echo "==================================="
echo ""
echo "  Equipment Service:  localhost:50051 (gRPC)"
echo "  Scenario Service:   localhost:50052 (gRPC)"
echo "  Timeseries Service: localhost:50053 (gRPC)"
echo "  Data Gateway:       localhost:8080  (REST)"
echo ""
echo "  API Base URL: http://localhost:8080/api/v1"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Trap to cleanup on exit
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $EQUIPMENT_PID $SCENARIO_PID $TIMESERIES_PID $GATEWAY_PID 2>/dev/null
  wait
  echo "All services stopped."
}

trap cleanup EXIT INT TERM

# Wait for all background processes
wait
