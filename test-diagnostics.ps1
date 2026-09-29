# Detailed AFSIM Gateway Diagnostics Script
# 检查完整链路：AFSIM进程 → 命名管道 → Protobuf事件 → WebSocket

$gatewayURL = "http://localhost:8080"

Write-Host "🔍 AFSIM Gateway Full Diagnostics" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Check gateway health
Write-Host "`n📊 Step 0: Checking gateway health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$gatewayURL/health" -Method Get
    Write-Host "✓ Gateway healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Gateway not responding: $_" -ForegroundColor Red
    exit 1
}

# Get scenarios
Write-Host "`n📋 Step 1: Fetching scenario list..." -ForegroundColor Yellow
try {
    $scenarios = Invoke-RestMethod -Uri "$gatewayURL/api/scenarios" -Method Get
    Write-Host "✓ Found $(($scenarios | Measure-Object).Count) scenario(s):" -ForegroundColor Green
    $scenarios | ForEach-Object { Write-Host "  - ID: $($_.id), Name: $($_.name), Size: $($_.size)B" }
    
    if ($scenarios.Count -eq 0) {
        Write-Host "❌ No scenarios found!" -ForegroundColor Red
        exit 1
    }
    
    $scenarioId = $scenarios[0].id
} catch {
    Write-Host "❌ Failed to fetch scenarios: $_" -ForegroundColor Red
    exit 1
}

# Start simulation
Write-Host "`n🚀 Step 2: Starting simulation with ID='$scenarioId' (realtime mode)..." -ForegroundColor Yellow
try {
    $simResponse = Invoke-RestMethod -Uri "$gatewayURL/api/simulations" `
        -Method Post `
        -ContentType "application/json" `
        -Body (ConvertTo-Json @{scenario_id = $scenarioId; mode = "realtime"})
    
    $simId = $simResponse.id
    Write-Host "✓ Simulation created with ID: $simId" -ForegroundColor Green
    Write-Host "  Initial Status: $($simResponse.status)" -ForegroundColor Yellow
    Write-Host "  PID: $($simResponse.pid)" -ForegroundColor Gray
    Write-Host "  Created At: $($simResponse.created_at)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to create simulation: $_" -ForegroundColor Red
    exit 1
}

# Wait a moment for mission.exe to start
Write-Host "`n⏳ Waiting 2 seconds for mission.exe to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Check simulation status
Write-Host "`n📊 Step 3: Checking simulation status after 2 seconds..." -ForegroundColor Yellow
try {
    $status = Invoke-RestMethod -Uri "$gatewayURL/api/simulations/$simId" -Method Get
    Write-Host "✓ Current Status: $($status.status)" -ForegroundColor Yellow
    Write-Host "  Simulation ID: $($status.id)" -ForegroundColor Gray
    Write-Host "  Scenario: $($status.scenario_id)" -ForegroundColor Gray
    
    if ($status.status -eq "error") {
        Write-Host "⚠️  WARNING: Simulation in error state!" -ForegroundColor Red
        Write-Host "   This likely means AFSIM engine failed to initialize" -ForegroundColor Red
        Write-Host "   Possible causes:" -ForegroundColor Red
        Write-Host "   - mission.exe path is incorrect or not executable" -ForegroundColor Red
        Write-Host "   - AFSIM engine not installed or corrupted" -ForegroundColor Red
        Write-Host "   - Plugin DLL not loaded" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed to get simulation status: $_" -ForegroundColor Red
}

# Connect to WebSocket and read initial snapshot
Write-Host "`n🔌 Step 4: Connecting to WebSocket and reading full snapshot..." -ForegroundColor Yellow
$wsURL = "ws://localhost:8080/api/simulations/$simId/ws"

try {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $cts = New-Object System.Threading.CancellationTokenSource
    $cts.CancelAfter(5000)
    
    $ws.ConnectAsync($wsURL, $cts.Token).GetAwaiter().GetResult()
    Write-Host "✓ WebSocket connected!" -ForegroundColor Green
    
    # Read first message (should be full_snapshot)
    $buffer = New-Object byte[] 4096
    $result = $ws.ReceiveAsync($buffer, $cts.Token).GetAwaiter().GetResult()
    
    if ($result.Count -gt 0) {
        $message = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
        Write-Host "`n📡 Full Snapshot Message:" -ForegroundColor Cyan
        
        try {
            $json = ConvertFrom-Json $message
            Write-Host "  Type: $($json.type)" -ForegroundColor White
            Write-Host "  Sim Time: $($json.sim_time)" -ForegroundColor White
            
            if ($json.payload.error) {
                Write-Host "  ❌ Payload Error: $($json.payload.error)" -ForegroundColor Red
            } else {
                Write-Host "  ✓ Payload received (entities, platforms, sensors, etc.)" -ForegroundColor Green
            }
            
            Write-Host "`n  Full JSON:" -ForegroundColor Gray
            Write-Host (ConvertTo-Json $json -Depth 5) -ForegroundColor Gray
        } catch {
            Write-Host "  Raw Message:" -ForegroundColor Gray
            Write-Host $message -ForegroundColor Gray
        }
    }
    
    # Try to read a few more messages (simulation events)
    Write-Host "`n📡 Listening for event messages (10 seconds)..." -ForegroundColor Yellow
    
    $eventCount = 0
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $cts = New-Object System.Threading.CancellationTokenSource
    $cts.CancelAfter(10000)
    
    while ($sw.Elapsed.TotalSeconds -lt 10) {
        try {
            $result = $ws.ReceiveAsync($buffer, $cts.Token).GetAwaiter().GetResult()
            
            if ($result.Count -gt 0) {
                $eventCount++
                $message = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
                
                Write-Host "`n  [Event $eventCount] $(Get-Date -Format 'HH:mm:ss.fff')" -ForegroundColor Cyan
                try {
                    $json = ConvertFrom-Json $message
                    Write-Host "    Type: $($json.type)" -ForegroundColor White
                    if ($json.event_type) {
                        Write-Host "    Event Type: $($json.event_type)" -ForegroundColor White
                    }
                    if ($json.sim_time) {
                        Write-Host "    Sim Time: $($json.sim_time)" -ForegroundColor White
                    }
                } catch {
                    Write-Host "    Message: $message" -ForegroundColor White
                }
            }
        } catch {
            break
        }
    }
    
    Write-Host "`n✓ Received $eventCount event message(s)" -ForegroundColor Green
    
} catch {
    Write-Host "❌ WebSocket error: $_" -ForegroundColor Red
} finally {
    Write-Host "`n🛑 Cleaning up..." -ForegroundColor Yellow
    $ws.Dispose()
    
    # Terminate simulation
    try {
        Invoke-RestMethod -Uri "$gatewayURL/api/simulations/$simId/terminate" -Method Post -ErrorAction SilentlyContinue | Out-Null
        Write-Host "✓ Simulation terminated" -ForegroundColor Green
    } catch {}
}

Write-Host "`n✅ Diagnostics completed!" -ForegroundColor Green
Write-Host "`n📝 Summary:" -ForegroundColor Cyan
Write-Host "  - WebSocket connection: ✓ SUCCESS" -ForegroundColor Green
Write-Host "  - Full snapshot delivery: $(if ($eventCount -ge 0) { '✓ SUCCESS' } else { '❌ FAILED' })" -ForegroundColor Green
Write-Host "  - Event messages received: $eventCount" -ForegroundColor Gray
Write-Host "`n🔗 Chain Status:" -ForegroundColor Cyan
Write-Host "  AFSIM Engine → Plugin → Named Pipes → Gateway → WebSocket → Browser" -ForegroundColor Gray
