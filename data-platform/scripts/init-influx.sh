#!/bin/bash
# InfluxDB 初始化脚本
# 用于创建 TrueSim 数据平台所需的 Bucket 和 Token

set -e

# 配置
INFLUX_HOST="${INFLUXDB_URL:-http://localhost:8086}"
INFLUX_TOKEN="${INFLUXDB_ADMIN_TOKEN:-my-super-secret-token}"
INFLUX_ORG="${INFLUXDB_ORG:-truesim}"
INFLUX_BUCKET="${INFLUXDB_BUCKET:-simulation}"
INFLUX_RETENTION="${INFLUXDB_RETENTION:-30d}"

echo "=== TrueSim InfluxDB 初始化 ==="
echo "Host: $INFLUX_HOST"
echo "Org: $INFLUX_ORG"
echo "Bucket: $INFLUX_BUCKET"

# 检查 influx CLI 是否可用
if ! command -v influx &> /dev/null; then
    echo "Error: influx CLI not found. Please install InfluxDB CLI."
    echo "See: https://docs.influxdata.com/influxdb/v2/tools/influx-cli/"
    exit 1
fi

# 配置 InfluxDB 连接
influx config create \
    --config-name truesim \
    --host-url "$INFLUX_HOST" \
    --org "$INFLUX_ORG" \
    --token "$INFLUX_TOKEN" \
    --active

# 创建 Bucket（如果不存在）
echo "Creating bucket: $INFLUX_BUCKET"
influx bucket create \
    --name "$INFLUX_BUCKET" \
    --org "$INFLUX_ORG" \
    --retention "$INFLUX_RETENTION" \
    --description "TrueSim simulation frame data" \
    2>/dev/null || echo "Bucket '$INFLUX_BUCKET' already exists"

# 创建只读 Token（用于前端查询）
echo "Creating read-only token..."
READ_TOKEN=$(influx auth create \
    --org "$INFLUX_ORG" \
    --description "TrueSim read-only token" \
    --read-bucket "$(influx bucket list --org "$INFLUX_ORG" --name "$INFLUX_BUCKET" --json | jq -r '.[0].id')" \
    --json | jq -r '.token')

echo "Read-only Token: $READ_TOKEN"

# 创建写入 Token（用于网关写入）
echo "Creating write token..."
WRITE_TOKEN=$(influx auth create \
    --org "$INFLUX_ORG" \
    --description "TrueSim write token" \
    --write-bucket "$(influx bucket list --org "$INFLUX_ORG" --name "$INFLUX_BUCKET" --json | jq -r '.[0].id')" \
    --json | jq -r '.token')

echo "Write Token: $WRITE_TOKEN"

# 创建 Telegraf 配置（可选，用于系统监控）
echo "Creating Telegraf config..."
cat > /tmp/truesim-telegraf.conf << 'EOF'
# TrueSim Telegraf Configuration
# 用于收集系统和应用指标

[agent]
  interval = "10s"
  flush_interval = "10s"

# InfluxDB 输出
[[outputs.influxdb_v2]]
  urls = ["http://localhost:8086"]
  token = "${INFLUXDB_TOKEN}"
  organization = "truesim"
  bucket = "simulation"

# CPU 指标
[[inputs.cpu]]
  percpu = true
  totalcpu = true

# 内存指标
[[inputs.mem]]

# 磁盘指标
[[inputs.disk]]
  ignore_fs = ["tmpfs", "devtmpfs", "devfs", "iso9660", "overlay", "aufs", "squashfs"]

# 网络指标
[[inputs.net]]

# 进程指标
[[inputs.processes]]
EOF

echo ""
echo "=== 初始化完成 ==="
echo ""
echo "请将以下环境变量添加到 .env 文件："
echo ""
echo "# InfluxDB Configuration"
echo "INFLUXDB_URL=$INFLUX_HOST"
echo "INFLUXDB_ORG=$INFLUX_ORG"
echo "INFLUXDB_BUCKET=$INFLUX_BUCKET"
echo "INFLUXDB_TOKEN=\$INFLUX_TOKEN"
echo ""
echo "# For Timeseries Service (write access)"
echo "INFLUXDB_WRITE_TOKEN=$WRITE_TOKEN"
echo ""
echo "# For Frontend (read access)"
echo "INFLUXDB_READ_TOKEN=$READ_TOKEN"
