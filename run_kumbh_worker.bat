@echo off
TITLE CrowdShield — Maha Kumbh Extreme-Density Vision Worker
echo =====================================================================
echo    CROWDSHIELD AI VISION WORKER — MAHA KUMBH EXTREME-DENSITY
echo    Zero-Cloud Edge Microservice (CSRNet + Farneback Conflict)
echo =====================================================================
echo.

cd /d "D:\crowdshield"
set PYTHON_EXE=D:\crowdshield\.venv\Scripts\python.exe

if not exist "%PYTHON_EXE%" (
    echo [ERROR] Virtual environment python not found at %PYTHON_EXE%
    pause
    exit /b 1
)

echo Select camera source mode:
echo   [1] Connect USB / Laptop Webcam (Source 0)
echo   [2] Run Synthetic Maha Kumbh Mega-Crowd Simulation (Mock Mode)
echo   [3] Run Custom Video File (e.g. test_videos/kumbh.mp4)
echo   [4] Run in Headless Background Mode (Posts telemetry to Port 8000)
echo.
set /p MODE="Enter choice (1-4) [default: 1]: "

if "%MODE%"=="2" (
    echo.
    echo Launching Synthetic Maha Kumbh Mega-Crowd Simulation...
    "%PYTHON_EXE%" vision_worker.py --mock
) else if "%MODE%"=="3" (
    echo.
    set /p VID_PATH="Enter path to crowd video file: "
    echo Launching with video source: %VID_PATH%
    "%PYTHON_EXE%" vision_worker.py --source "%VID_PATH%"
) else if "%MODE%"=="4" (
    echo.
    echo Launching in Headless Edge Background Mode...
    "%PYTHON_EXE%" vision_worker.py --source 0 --headless
) else (
    echo.
    echo Launching with Laptop / USB Webcam (Source 0)...
    echo.
    echo Key Controls in Video Window:
    echo   [m] - Toggle Maha Kumbh Heatmap Overlay
    echo   [k] - Inject Mega Kumbh Crush (6.5 pax/m^2)
    echo   [f] - Inject Violent Fight / Directional Conflict
    echo   [p] - Inject Fallen Person & Repulsion Ring
    echo   [h] - Toggle Optical Flow Vector Grid
    echo   [c] - Clear All Injected Scenarios
    echo   [q] - Quit
    echo.
    "%PYTHON_EXE%" vision_worker.py --source 0
)

pause
