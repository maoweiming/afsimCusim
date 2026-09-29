<#
.SYNOPSIS
  端到端验证 P2-H 的两个 timeseries 接口（StreamFrames / GetEngagementEvents）against 真实 InfluxDB。

.DESCRIPTION
  本脚本自包含，只依赖 Docker（用于 InfluxDB）+ Go。它会：
    1. 启动一个独立的 InfluxDB 2.7 容器（发布 8086，与 docker-compose 的 bucket/token/org 一致）；
    2. 在宿主机以 go run 启动 timeseries-service（连本地 InfluxDB，监听 :50053）；
    3. 运行 scripts/verify_p2h gRPC 客户端，写入合成帧并断言两个接口的行为；
    4. 无论成败都清理容器与子进程。

  设计为"留待后续在有 Docker 的机器上一键执行"——本机当前无 Docker，故脚本本身不在此环境运行。

.NOTES
  退出码：0 = 两个检查全部通过；非 0 = 有失败或环境缺失。
  可调环境变量：INFLUXDB_TOKEN / INFLUXDB_ORG / INFLUXDB_BUCKET / TS_PORT / INFLUX_PORT。
#>

$ErrorActionPreference = "Stop"
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$PlatformDir = Split-Path -Parent $ScriptDir          # data-platform/
$TsDir       = Join-Path $PlatformDir "services/timeseries"

$InfluxPort = if ($env:INFLUX_PORT) { $env:INFLUX_PORT } else { "8086" }
$TsPort     = if ($env:TS_PORT)     { $env:TS_PORT }     else { "50053" }
$Token      = if ($env:INFLUXDB_TOKEN)  { $env:INFLUXDB_TOKEN }  else { "truesim-super-secret-token" }
$Org        = if ($env:INFLUXDB_ORG)    { $env:INFLUXDB_ORG }    else { "truesim" }
$Bucket     = if ($env:INFLUXDB_BUCKET) { $env:INFLUXDB_BUCKET } else { "simulation" }
$Container  = "truesim-influx-p2h"

function Fail($msg) { Write-Host "[verify-p2h] ❌ $msg" -ForegroundColor Red; exit 1 }
function Info($msg) { Write-Host "[verify-p2h] $msg" -ForegroundColor Cyan }

# --- 0. 前置检查 ---------------------------------------------------------------
try { docker info *> $null } catch { Fail "Docker 不可用，请先启动 Docker Desktop / dockerd" }
try { go version  *> $null } catch { Fail "Go 不可用，请安装 Go 1.23+" }

$tsProc = $null
function Cleanup {
    Info "清理中..."
    if ($script:tsProc -and -not $script:tsProc.HasExited) {
        try { Stop-Process -Id $script:tsProc.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    docker rm -f $Container *> $null 2>&1
}

try {
    # --- 1. 启动独立 InfluxDB --------------------------------------------------
    docker rm -f $Container *> $null 2>&1
    Info "启动 InfluxDB 容器 ($Container, :$InfluxPort)..."
    docker run -d --name $Container -p "${InfluxPort}:8086" `
        -e DOCKER_INFLUXDB_INIT_MODE=setup `
        -e DOCKER_INFLUXDB_INIT_USERNAME=admin `
        -e DOCKER_INFLUXDB_INIT_PASSWORD=admin123 `
        -e "DOCKER_INFLUXDB_INIT_ORG=$Org" `
        -e "DOCKER_INFLUXDB_INIT_BUCKET=$Bucket" `
        -e "DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=$Token" `
        influxdb:2.7 | Out-Null

    Info "等待 InfluxDB 就绪..."
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        $health = docker exec $Container influx ping 2>&1
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    }
    if (-not $ready) { Fail "InfluxDB 未在 60s 内就绪" }
    Info "InfluxDB 就绪"

    # --- 2. 启动 timeseries-service（宿主机） ----------------------------------
    Info "启动 timeseries-service (go run, :$TsPort)..."
    $env:PORT           = $TsPort
    $env:INFLUXDB_URL   = "http://localhost:$InfluxPort"
    $env:INFLUXDB_TOKEN = $Token
    $env:INFLUXDB_ORG   = $Org
    $env:INFLUXDB_BUCKET = $Bucket
    $tsLog = Join-Path $env:TEMP "p2h-timeseries.log"
    $script:tsProc = Start-Process -FilePath "go" -ArgumentList "run","./cmd" `
        -WorkingDirectory $TsDir -PassThru -NoNewWindow `
        -RedirectStandardOutput $tsLog -RedirectStandardError "$tsLog.err"
    Start-Sleep -Seconds 8   # 给 go build + 启动留时间
    if ($script:tsProc.HasExited) {
        Get-Content "$tsLog.err" -ErrorAction SilentlyContinue | Write-Host
        Fail "timeseries-service 启动失败（退出码 $($script:tsProc.ExitCode)）"
    }
    Info "timeseries-service 已启动 (pid $($script:tsProc.Id))"

    # --- 3. 运行验证客户端 -----------------------------------------------------
    Info "运行 gRPC 验证客户端..."
    $env:TS_ADDR = "localhost:$TsPort"
    Push-Location $TsDir
    try {
        go run ./scripts/verify_p2h
        $verifyExit = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    if ($verifyExit -ne 0) { Fail "验证客户端返回非 0（$verifyExit）——见上方输出" }
    Write-Host "[verify-p2h] ✅ P2-H 两个接口在真实 InfluxDB 下验证通过" -ForegroundColor Green
}
finally {
    Cleanup
}
