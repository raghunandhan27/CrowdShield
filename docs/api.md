# CrowdShield API & Serial Protocol Specification

## 1. REST Endpoints (FastAPI Backend - Port 8000)

### 1.1 Hazard Management & GIS Rerouting
* **`POST /api/hazard/trigger`**
  * **Payload:**
    ```json
    {
      "zone_id": "zone_2",
      "hazard_type": "FIRE",
      "severity": "CRITICAL",
      "source": "operator_manual"
    }
    ```
  * **Response:**
    ```json
    {
      "status": "success",
      "message": "Hazard locked for zone_2",
      "active_hazards": ["zone_2"],
      "reroute_plan": {
        "zone_1": "gate_a",
        "zone_3": "gate_c",
        "zone_4": "gate_b"
      },
      "lora_dispatched": true
    }
    ```

* **`POST /api/hazard/clear`**
  * **Payload:**
    ```json
    {
      "zone_id": "zone_2"
    }
    ```
  * **Response:**
    ```json
    {
      "status": "cleared",
      "zone_id": "zone_2",
      "active_hazards": []
    }
    ```

* **`GET /api/hazard/status`**
  * Returns list of currently quarantined zones, timestamp, and active detour map.

### 1.2 Downlink Broadcast & Field Nodes
* **`POST /downlink`**
  * Direct transmission to Master ESP32 LoRa Gateway.
  * **Payload:**
    ```json
    {
      "target_zone": 1,
      "alert_level": 3,
      "display_text": "FIRE IN Z2 - REROUTE VIA GATE A",
      "audio_track": 1
    }
    ```

* **`POST /api/downlink/broadcast`**
  * Multi-zone simultaneous emergency broadcast over LoRa mesh.

* **`GET /api/nodes`**
  * Returns live telemetry for all connected field hardware nodes (battery level, RSSI, SOS switch state, uptime).

### 1.3 Video Stream & Camera Ingest
* **`GET /video_feed`**
  * Real-time multipart MJPEG stream from active CCTV / IP webcam feeds with homography overlay.
* **`POST /api/camera/add`**
  * Dynamic camera registration (RTSP URL, Android IP Webcam IP, or local webcam index).

---

## 2. WebSocket Real-Time Synchronization

* **Endpoint:** `ws://localhost:8000/ws`
* **Update Frequency:** Sub-second push (1 to 2 Hz live telemetry, instant push on hazard trigger).
* **Payload Schema:**
  ```json
  {
    "type": "TELEMETRY_UPDATE",
    "timestamp": 1729983450.12,
    "zones": {
      "zone_1": { "count": 24, "density_pax_m2": 0.48, "los": "C", "risk": 0.35, "evacuation_exit": "gate_a" },
      "zone_2": { "count": 89, "density_pax_m2": 2.85, "los": "F", "risk": 0.95, "evacuation_exit": "ISOLATED_HAZARD" }
    },
    "active_hazards": ["zone_2"],
    "alerts": [
      { "id": "alt_01", "level": "CRITICAL", "zone": "zone_2", "msg": "FIRE IN Z2 - REROUTE VIA GATE A" }
    ],
    "hardware_mesh": {
      "gateway_online": true,
      "rf_frequency_mhz": 433.0,
      "last_packet_tx": "1|3|FIRE IN Z2 - REROUTE VIA GATE A"
    }
  }
  ```

---

## 3. LoRa RF Downlink Protocol (Over-the-Air)

Field signboards parse downlinks inside a 0ms hardware interrupt using a compact pipe-delimited format:

$$\text{Format:} \quad \texttt{<ZoneNumber>|<AlertLevel>|<DisplayMessage>}$$

### Examples:
* `1|3|FIRE IN Z2 - REROUTE VIA GATE A`
  * Zone: 1 (Zonal Node 1)
  * Alert Level: 3 (Critical Emergency)
  * Display: Prints `REROUTE VIA GATE A` on Line 2 of 1602 LCD; triggers Track 001 MP3 speech evacuation broadcast.
* `3|2|SLOW DOWN - BOTTLENECK AHEAD`
  * Zone: 3 (Zonal Node 3)
  * Alert Level: 2 (Warning)
  * Display: Ingress warning, calm chime.
* `0|0|ALL ZONES CLEAR`
  * Global broadcast reset to all mesh nodes.
