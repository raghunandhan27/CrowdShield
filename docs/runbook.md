# 📋 CrowdShield Operator Runbook & Troubleshooting Guide

## 1. Quick Start (Demo Day)

### Starting the System
1. **Double-click:** `D:\crowdshield\start_system.bat`
2. **Verify Backend:** Command window opens showing:
   `Running at http://127.0.0.1:8000 (REST & WebSockets)`
3. **Verify Desktop App:** `CrowdWatch.exe` opens. Look at the top status bar:
   - `SPINE: ONLINE (DEMO_MOCK_SPINE)` or `(LIVE_VISION_ACTIVE)`
   - `CAMS: 4/4`
   - `GATEWAY: COM3 (ONLINE)`

---

## 2. Stopping the System
- Close `CrowdWatch.exe` window.
- In the backend terminal window, press `Ctrl + C`.

---

## 3. What to Do When Something Fails (Emergency Triage)

### Problem A: COM Port error ("Could not open COM3")
- **Cause:** Another program (e.g., Arduino IDE Serial Monitor) has locked the port, or the Gateway ESP32 was re-plugged into a different USB port.
- **Fix:**
  1. Close the Arduino IDE Serial Monitor.
  2. Open Windows Device Manager $\to$ Ports (COM & LPT) to find the correct port number (e.g., `COM4`).
  3. Start serial reader with the explicit port:
     ```powershell
     python serial_reader.py --port COM4
     ```
  4. Or run in virtual simulator mode:
     ```powershell
     python serial_reader.py --mock
     ```

### Problem B: Camera feed drops / phone Wi-Fi disconnects
- **Cause:** Phone went to sleep or Wi-Fi dropped.
- **Fix:**
  - CrowdShield automatically falls back to the **synthetic vision generator** within 3 seconds. The dashboard never crashes or shows a blank screen.
  - To reconnect phone: wake phone screen, open IP Webcam, ensure phone is connected to your local Wi-Fi router.

### Problem C: "Port 8000 already in use"
- **Cause:** A previous instance of `backend_server.py` is still running in the background.
- **Fix:**
  ```powershell
  Stop-Process -Name python -Force
  ```
  Then restart `start_system.bat`.

### Problem D: LoRa radio does not initialize on ESP32
- **Cause:** Wire loose or missing antenna.
- **Fix:**
  - Verify antenna is connected to `ANT` pin.
  - Verify `VCC` is plugged into `3.3V`, NOT `5V`.
  - Verify SPI pins: `NSS: 5`, `SCK: 18`, `MISO: 19`, `MOSI: 23`, `RST: 14`, `DIO0: 26`.
