# WebSocket Event Stream Listener for AFSIM Gateway
# 此脚本用于验证网关是否正确消费protobuf事件并转发给前端

$gatewayURL = "http://localhost:8080"

Write-Host "🔍 AFSIM Gateway WebSocket Event Stream Tester" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Step 1: Get scenario list
Write-Host "`n📋 Step 1: Fetching scenario list..." -ForegroundColor Yellow
try {
    $scenarios = Invoke-RestMethod -Uri "$gatewayURL/api/scenarios" -Method Get
    Write-Host "✓ Found $(($scenarios | Measure-Object).Count) scenario(s):" -ForegroundColor Green
    $scenarios | ForEach-Object { Write-Host "  - $($_.id) ($($_.name))" }
    
    if ($scenarios.Count -eq 0) {
        Write-Host "❌ No scenarios found! Ensure test_gateway.scenario exists in afsim-gateway/scenarios/" -ForegroundColor Red
        exit 1
    }
    
    $scenarioId = $scenarios[0].id
    Write-Host "✓ Using scenario ID: $scenarioId" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to fetch scenarios: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Start simulation
Write-Host "`n🚀 Step 2: Starting simulation '$scenarioId'..." -ForegroundColor Yellow
try {
    $simResponse = Invoke-RestMethod -Uri "$gatewayURL/api/simulations" `
        -Method Post `
        -ContentType "application/json" `
        -Body (ConvertTo-Json @{scenario_id = $scenarioId; mode = "run"})
    
    $simId = $simResponse.id
    Write-Host "✓ Simulation started with ID: $simId" -ForegroundColor Green
    Write-Host "  Status: $($simResponse.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to start simulation: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Connect to WebSocket
Write-Host "`n🔌 Step 3: Connecting to WebSocket..." -ForegroundColor Yellow
$wsURL = "ws://localhost:8080/api/simulations/$simId/ws"
Write-Host "  WebSocket URL: $wsURL" -ForegroundColor Gray

try {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $cts = New-Object System.Threading.CancellationTokenSource
    $cts.CancelAfter(30000) # 30 second timeout
    
    $ws.ConnectAsync($wsURL, $cts.Token).GetAwaiter().GetResult()
    Write-Host "✓ WebSocket connected!" -ForegroundColor Green
} catch {
    Write-Host "❌ WebSocket connection failed: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Read WebSocket messages
Write-Host "`n📡 Step 4: Listening for events (first 20 messages or 30 seconds)..." -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Gray

$messageCount = 0
$maxMessages = 20
$buffer = New-Object byte[] 4096

try {
    while ($messageCount -lt $maxMessages -and -not $cts.Token.IsCancellationRequested) {
        try {
            $result = $ws.ReceiveAsync($buffer, $cts.Token).GetAwaiter().GetResult()
            
            if ($result.Count -gt 0) {
                $messageCount++
                $message = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
                
                Write-Host "`n[Message $messageCount] - $(Get-Date -Format 'HH:mm:ss.fff')" -ForegroundColor Cyan
                try {
                    $json = ConvertFrom-Json $message
                    Write-Host (ConvertTo-Json $json -Depth 3) -ForegroundColor White
                } catch {
                    Write-Host $message -ForegroundColor White
                }
            }
        } catch {
            if ($_.Exception.InnerException -like "*cancelled*") {
                break
            }
            throw $_
        }
    }
    
    Write-Host "`n✓ Successfully received $messageCount event(s)" -ForegroundColor Green
} finally {
    Write-Host "`n🛑 Closing WebSocket..." -ForegroundColor Yellow
    $ws.Dispose()
    
    # Terminate simulation
    Write-Host "🛑 Terminating simulation..." -ForegroundColor Yellow
    try {
        Invoke-RestMethod -Uri "$gatewayURL/api/simulations/$simId/terminate" -Method Post | Out-Null
        Write-Host "✓ Simulation terminated" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Failed to terminate simulation: $_" -ForegroundColor Yellow
    }
}

Write-Host "`n✅ Test completed!" -ForegroundColor Green
