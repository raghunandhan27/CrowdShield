@echo off
TITLE CrowdShield Hardware Gateway Bridge (ESP32 / ESP8266)
echo =====================================================================
echo    CROWDSHIELD ESP-NOW HARDWARE GATEWAY BRIDGE (ESP32 / ESP8266)
echo =====================================================================
echo.
cd /d "D:\crowdshield"
call "D:\crowdshield\.venv\Scripts\activate.bat"
echo Auto-scanning COM ports and connecting to Gateway ESP...
echo Press Ctrl+C to stop.
echo.
"D:\crowdshield\.venv\Scripts\python.exe" D:\crowdshield\serial_reader.py %*
pause
