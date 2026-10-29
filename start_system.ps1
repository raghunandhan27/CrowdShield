# CrowdShield Master PowerShell Launcher
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "       CROWDSHIELD / CROWDWATCH COMMAND CENTER LAUNCHER" -ForegroundColor Yellow
Write-Host "=====================================================================" -ForegroundColor Cyan

Set-Location -Path "D:\crowdshield"

Write-Host "`n[1/3] Starting Unified Backend Spine & AI Engine (Port 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& 'D:\crowdshield\.venv\Scripts\python.exe' 'D:\crowdshield\backend_server.py'"

Write-Host "Waiting for backend server to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 3

Write-Host "[2/3] Launching CrowdWatch Command Center Desktop Window..." -ForegroundColor Green
$frontendDir = Join-Path (Get-Location) "frontend"
$electronCli = Join-Path $frontendDir "node_modules\electron\cli.js"
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

if (Test-Path $electronCli) {
    Write-Host "[3/3] Launching Native Electron Command Center Window..." -ForegroundColor Cyan
    Start-Process node -ArgumentList "`"$electronCli`"", "`"$frontendDir`""
} elseif (Test-Path $edgePath) {
    Write-Host "[3/3] Opening Frameless Desktop App Mode via Edge..." -ForegroundColor Cyan
    Start-Process $edgePath -ArgumentList "--app=http://localhost:8000", "--start-maximized"
} elseif (Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe") {
    Write-Host "[3/3] Opening Frameless Desktop App Mode via Chrome..." -ForegroundColor Cyan
    Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--app=http://localhost:8000", "--start-maximized"
} else {
    Write-Host "[3/3] Opening in Default Browser..." -ForegroundColor Yellow
    Start-Process "http://localhost:8000"
}

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host " CrowdShield is LIVE & READY!" -ForegroundColor Green
Write-Host " - Command Center UI:  http://localhost:8000" -ForegroundColor White
Write-Host " - Live Video Stream:  http://localhost:8000/video_feed" -ForegroundColor White
Write-Host " - WebSocket Stream:   ws://localhost:8000/ws" -ForegroundColor White
Write-Host "=====================================================================`n" -ForegroundColor Green
