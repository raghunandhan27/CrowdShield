@echo off
TITLE CrowdShield Master System Launcher
echo =====================================================================
echo           CROWDSHIELD / CROWDWATCH COMMAND CENTER LAUNCHER
echo =====================================================================
echo.

cd /d "D:\crowdshield"

echo [1/3] Activating Python 3.11 Virtual Environment...
call "D:\crowdshield\.venv\Scripts\activate.bat"

echo [2/3] Starting Unified Backend Spine & Edge AI Engine (Port 8000)...
start "CrowdShield Backend Spine (Port 8000)" cmd /k "D:\crowdshield\.venv\Scripts\python.exe D:\crowdshield\backend_server.py"

echo Waiting for backend server to initialize...
timeout /t 3 /nobreak >nul

echo [3/3] Launching CrowdWatch Command Center Desktop Window...
if exist "D:\crowdshield\frontend\node_modules\electron\cli.js" (
    start "" node "D:\crowdshield\frontend\node_modules\electron\cli.js" "D:\crowdshield\frontend"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
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
echo  CrowdShield is LIVE & READY!
echo  - Command Center UI:  http://localhost:8000
echo  - WebSocket Stream:   ws://localhost:8000/ws
echo  - Live Video Stream:  http://localhost:8000/video_feed
echo.
echo  To connect your Phone Camera:
echo  1. Open 'IP Webcam' app on your Android phone
echo  2. Tap 'Start server' at the bottom
echo  3. In CrowdWatch, click 'ADD CAMERA' -> Enter the phone IP (e.g. 192.168.1.15:8080)
echo =====================================================================
pause
