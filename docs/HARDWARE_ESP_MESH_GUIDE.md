# CrowdShield Hardware Mesh & Audio Warning Dispatch Guide
**Version:** 2.1 (Pure ESP-NOW 2.4GHz Mesh & DFPlayer Mini Edition)  
**Target Hardware:** 1x Receiving Gateway (ESP32 or ESP8266) + 3x Zonal Field Nodes (ESP32)

---

## 1. System Architecture & Two-Way Feedback Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       COMMAND CENTER (Laptop)                               │
│  [Web App: http://localhost:8000] <==> [FastAPI Spine backend_server.py]    │
│                                       ↕                                     │
│                          [serial_reader.py Bridge]                          │
│                                       ↕ (USB Serial @ 115200 baud)          │
│                      [RECEIVING GATEWAY: ESP32 or ESP8266]                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                      2.4 GHz ESP-NOW Wireless Broadcast
                        (Mac: FF:FF:FF:FF:FF:FF)
                                       │
      ┌────────────────────────────────┼────────────────────────────────┐
      ▼                                ▼                                ▼
┌───────────────┐              ┌───────────────┐                ┌───────────────┐
│ ZONAL NODE 1  │              │ ZONAL NODE 2  │                │ ZONAL NODE 3  │
│ (ESP32)       │              │ (ESP32)       │                │ (ESP32)       │
│ • SOS Button  │              │ • SOS Button  │                │ • SOS Button  │
│ • DFPlayer    │              │ • DFPlayer    │                │ • DFPlayer    │
│ • 4Ω 3W Spk   │              │ • 4Ω 3W Spk   │                │ • 4Ω 3W Spk   │
│ • LED (G27)   │              │ • LED (G27)   │                │ • LED (G27)   │
└───────────────┘              └───────────────┘                └───────────────┘
```

1. **Uplink:** A person presses the physical SOS push button on Zone 1, 2, or 3.
   - The zonal ESP32 immediately broadcasts:
     `{"node":"NODE-Z1","z":1,"sos":1,"mo":0,"seq":42,"batteryVolts":4.12,"batteryPct":90}`
   - The Receiving ESP catches the packet and prints it to USB Serial.
   - `serial_reader.py` posts it to `/node`.
   - The Command Center web app rings the alarm and displays the critical SOS card!
2. **Operator Downlink Reply:**
   - The Command Center operator inspects the situation and selects one of **3 preset warning messages**:
     - **Preset 1 (Track 1 / `0001.mp3`):** Emergency Evacuation
     - **Preset 2 (Track 2 / `0002.mp3`):** Crowd Caution / Slow Down
     - **Preset 3 (Track 3 / `0003.mp3`):** All Clear / Standby
   - The operator clicks the quick reply button or confirms the dispatch modal.
   - `serial_reader.py` receives the downlink and sends `{"z":1,"track":1,"cmd":"PLAY"}` down USB Serial.
   - The Receiving ESP broadcasts it over 2.4GHz ESP-NOW.
   - The target Zonal ESP receives the packet, recognizes `z == 1`, and instructs the **DFPlayer Mini** to immediately play Track 1 on the 4Ω 3W speaker and flashes the LED pattern!

---

## 2. MicroSD Card Preparation for DFPlayer Mini

Format a MicroSD card (up to 32GB) as **FAT32**. Create a folder named `mp3` in the root (or place directly in the root) and save three `.mp3` audio files:

| File Name | Preset Name | Voice Announcement Content |
|---|---|---|
| `0001.mp3` | **Preset 1: Emergency Evacuation** | *"Attention please, an emergency has occurred. Please walk calmly towards designated exit gates immediately."* |
| `0002.mp3` | **Preset 2: Crowd Caution / Slow Down** | *"Attention, heavy crowd congestion ahead. Please slow down, avoid pushing, and maintain space."* |
| `0003.mp3` | **Preset 3: All Clear / Standby** | *"Attention, the situation is now under control and safe. Please remain in place calmly."* |

Insert a prepared MicroSD card into each Zonal DFPlayer Mini.

---

## 3. Circuit Wiring for Zonal Field Nodes (ESP32)

Each of the 3 Zonal nodes is wired identically:

### A. SOS Push Button
- **Terminal 1:** Connect to ESP32 **GPIO 13** (Firmware enables internal `INPUT_PULLUP`).
- **Terminal 2:** Connect to **GND**.

### B. Status Indicator LED
- **Anode (+, long leg):** Connect to ESP32 **GPIO 27** through a **330Ω resistor**.
- **Cathode (-, short leg):** Connect to **GND**.

### C. DFPlayer Mini Audio Player & 4Ω 3W Speaker
- **VCC (Pin 1):** Connect to **5.0V Rail** (VIN or 5V boost converter).
- **RX (Pin 2):** Connect via **1kΩ Resistor** to ESP32 **GPIO 26** (`DF_TX`).
  *(Note: The 1kΩ resistor is crucial to protect DFPlayer 3.3V logic from 5V noise).*
- **TX (Pin 3):** Connect directly to ESP32 **GPIO 25** (`DF_RX`).
- **SPK_1 (Pin 6):** Connect to Speaker terminal 1.
- **GND (Pin 7):** Connect to Common **GND**.
- **SPK_2 (Pin 8):** Connect to Speaker terminal 2.

---

## 4. Firmware Flashing Guide

### Board 1: Receiving Gateway (ESP32 or ESP8266)
- **If using ESP32 as Receiver:**
  1. Open Arduino IDE.
  2. Open file: `D:\crowdshield\firmware\receiver_esp32_espnow\receiver_esp32_espnow.ino`.
  3. Select Board: **ESP32 Dev Module**.
  4. Select the COM port of the receiving ESP32 and click **Upload**.
- **If using ESP8266 as Receiver:**
  1. Open Arduino IDE.
  2. Open file: `D:\crowdshield\firmware\receiver_esp8266_espnow\receiver_esp8266_espnow.ino`.
  3. Select Board: **NodeMCU 1.0 (ESP-12E Module)** or **LOLIN(WEMOS) D1 R2 & mini**.
  4. Select the COM port of the receiving ESP8266 and click **Upload**.

### Boards 2, 3, 4: The Three Zonal Field Nodes (ESP32)
1. Open file: `D:\crowdshield\firmware\zonal_esp32_espnow\zonal_esp32_espnow.ino`.
2. Required Arduino Libraries (Install via Library Manager if needed):
   - `DFRobotDFPlayerMini` (by DFRobot)
3. For **Zone 1 ESP32**:
   - Verify line 41: `#define ZONE_ID 1` and line 42: `const char* NODE_NAME = "NODE-Z1";`
   - Upload to Board 1.
4. For **Zone 2 ESP32**:
   - Change line 41 to: `#define ZONE_ID 2` and line 42 to: `const char* NODE_NAME = "NODE-Z2";`
   - Upload to Board 2.
5. For **Zone 3 ESP32**:
   - Change line 41 to: `#define ZONE_ID 3` and line 42 to: `const char* NODE_NAME = "NODE-Z3";`
   - Upload to Board 3.

---

## 5. Running the System with 1 Single Click

You no longer need to run separate starter bats or bridge windows! The system is completely autonomous:

### Method 1: Desktop 1-Click Launch (Recommended)
Simply double-click the new shortcut created on your Windows Desktop:
`CrowdWatch Command Center.bat`

This single click will automatically:
1. Start the unified FastAPI backend spine on port 8000.
2. Automatically scan and connect to your ESP32 or ESP8266 Gateway on USB Serial (115200 baud).
3. Start the background 2.4GHz ESP-NOW wireless mesh listening thread.
4. Open the full-screen CrowdWatch Command Center desktop window at `http://localhost:8000`!

---

## 6. How the Emergency Lockdown & Two-Way Loop Operates

1. **Quiet Monitoring:** The system sits in pure operational mode with zero false alarms. Normal heartbeats are logged silently.
2. **Physical Button Trigger:** A person presses the physical **SOS Push Button (GPIO 13)** on any zonal node (e.g. Zone 1).
3. **Mandatory Screen Takeover & Siren Alarm:**
   - The Command Center screen **locks down completely** with an unescapable emergency takeover modal (`z-[100]`).
   - The Command Center plays a **loud, continuous audio siren** (dual-tone Web Audio API sweep).
   - The operator cannot close or click away from the screen ("without responding they can't go anywhere").
   - The modal shows:
     - **Live Tactical Camera Feed** for that specific zone.
     - **Live GIS Density & Headcount**: ($pax/m^2$, persons, walking speed, flow conflict).
     - **Hardware Telemetry**: Node battery voltage, signal RSSI, DFPlayer status.
4. **Three Saved Warning Reply Presets:**
   - The operator verifies the incident on camera and clicks one of the 3 large action cards:
     - `[🚨 1. EVACUATION ORDER (Track 1 / 0001.mp3)]`
     - `[⚠️ 2. CROWD CAUTION / SLOW DOWN (Track 2 / 0002.mp3)]`
     - `[✅ 3. ALL CLEAR / STANDBY (Track 3 / 0003.mp3)]`
5. **Instant Execution:**
   - The selected warning command is transmitted immediately (<5ms) over USB Serial $\rightarrow$ Receiving ESP $\rightarrow$ 2.4GHz ESP-NOW broadcast.
   - The target Zone's DFPlayer Mini plays the exact voice message over the 4Ω 3W speaker!
   - The status LED strobes the corresponding pattern.
   - The Command Center siren silences and the lockout modal dismisses, returning the operator to normal view.


