#!/usr/bin/env bash
# 端到端验证 P2-H 的两个 timeseries 接口（StreamFrames / GetEngagementEvents）against 真实 InfluxDB。
#
# 自包含，只依赖 Docker（用于 InfluxDB）+ Go。流程：
#   1. 启动独立 InfluxDB 2.7（发布 8086，bucket/token/org 与 docker-compose 一致）；
#   2. 宿主机以 go run 启动 timeseries-service（连本地 InfluxDB，:50053）；
#   3. 运行 scripts/verify_p2h gRPC 客户端，写合成帧并断言两接口行为；
#   4. trap 清理容器与子进程。
#
# 退出码：0 = 两个检查全部通过；非 0 = 有失败或环境缺失。
# 适合在有 Docker 的 Linux/Mac 机器或 CI 上一键执行。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
TS_DIR="$PLATFORM_DIR/services/timeseries"

INFLUX_PORT="${INFLUX_PORT:-8086}"
TS_PORT="${TS_PORT:-50053}"
TOKEN="${INFLUXDB_TOKEN:-truesim-super-secret-token}"
ORG="${INFLUXDB_ORG:-truesim}"
BUCKET="${INFLUXDB_BUCKET:-simulation}"
CONTAINER="truesim-influx-p2h"

info() { echo -e "[verify-p2h] $*"; }
fail() { echo -e "[verify-p2h] ❌ $*" >&2; exit 1; }

TS_PID=""
cleanup() {
  info "清理中..."
  [ -n "$TS_PID" ] && kill "$TS_PID" 2>/dev/null || true
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# --- 0. 前置检查 -------------------------------------------------------------
docker info >/dev/null 2>&1 || fail "Docker 不可用，请先启动 dockerd"
go version  >/dev/null 2>&1 || fail "Go 不可用，请安装 Go 1.23+"

# --- 1. 启动独立 InfluxDB ----------------------------------------------------
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
info "启动 InfluxDB 容器 ($CONTAINER, :$INFLUX_PORT)..."
docker run -d --name "$CONTAINER" -p "${INFLUX_PORT}:8086" \
  -e DOCKER_INFLUXDB_INIT_MODE=setup \
  -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
  -e DOCKER_INFLUXDB_INIT_PASSWORD=admin123 \
  -e "DOCKER_INFLUXDB_INIT_ORG=$ORG" \
  -e "DOCKER_INFLUXDB_INIT_BUCKET=$BUCKET" \
  -e "DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=$TOKEN" \
  influxdb:2.7 >/dev/null

info "等待 InfluxDB 就绪..."
ready=false
for _ in $(seq 1 30); do
  sleep 2
  if docker exec "$CONTAINER" influx ping >/dev/null 2>&1; then ready=true; break; fi
done
[ "$ready" = true ] || fail "InfluxDB 未在 60s 内就绪"
info "InfluxDB 就绪"

# --- 2. 启动 timeseries-service（宿主机） ------------------------------------
info "启动 timeseries-service (go run, :$TS_PORT)..."
TS_LOG="$(mktemp)"
(
  cd "$TS_DIR"
  PORT="$TS_PORT" \
  INFLUXDB_URL="http://localhost:$INFLUX_PORT" \
  INFLUXDB_TOKEN="$TOKEN" \
  INFLUXDB_ORG="$ORG" \
  INFLUXDB_BUCKET="$BUCKET" \
  go run ./cmd
) >"$TS_LOG" 2>&1 &
TS_PID=$!
sleep 8   # 给 go build + 启动留时间
if ! kill -0 "$TS_PID" 2>/dev/null; then
  cat "$TS_LOG" >&2
  fail "timeseries-service 启动失败"
fi
info "timeseries-service 已启动 (pid $TS_PID)"

# --- 3. 运行验证客户端 -------------------------------------------------------
info "运行 gRPC 验证客户端..."
(
  cd "$TS_DIR"
  TS_ADDR="localhost:$TS_PORT" go run ./scripts/verify_p2h
)
info "✅ P2-H 两个接口在真实 InfluxDB 下验证通过"
