# Check for AFSIM named pipes and try to connect
Write-Host "Listing all pipes containing 'afsim'..."
$pipes = [System.IO.Directory]::GetFiles("\\.\pipe\")
$afsimPipes = $pipes | Where-Object { $_ -match "afsim" }
if ($afsimPipes) {
    $afsimPipes | ForEach-Object { Write-Host "  Found: $_" }
} else {
    Write-Host "  No afsim pipes found."
    Write-Host "  Total pipes on system: $($pipes.Count)"
}
