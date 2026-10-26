@echo off
TITLE CrowdWatch Autonomous Command Center (Master 1-Click Launcher)
COLOR 0A
echo =====================================================================
echo          CROWDWATCH / CROWDSHIELD AUTONOMOUS COMMAND CENTER
echo =====================================================================
echo.
echo [1/3] Navigating to CrowdShield core directory...
cd /d "D:\crowdshield"

echo [2/3] Starting Unified Backend Spine & Embedded Serial Gateway...
echo       - FastAPI Server on Port 8000
echo       - Auto-detecting ESP32/ESP8266 COM Ports (115200 baud)
echo       - 2.4GHz ESP-NOW Wireless Mesh Listening Thread
start "CrowdWatch Unified Backend + Serial Bridge" cmd /k "D:\crowdshield\.venv\Scripts\python.exe D:\crowdshield\backend_server.py"

echo Waiting 3 seconds for Command Center services to initialize...
timeout /t 3 /nobreak >nul

echo [3/3] Launching Command Center Desktop UI Window...
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:8000 --start-maximized
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:8000 --start-maximized
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:8000 --start-maximized
) else (
    start http://localhost:8000
)

echo.
echo =====================================================================
echo  ALL COMMAND CENTER TASKS COMPLETED AUTOMATICALLY!
echo  - Command Center URL:   http://localhost:8000
echo  - ESP Hardware Bridge:  RUNNING IN BACKGROUND (Auto-scans COM ports)
echo  - Emergency Audio Siren: ARMED
echo =====================================================================
exit
