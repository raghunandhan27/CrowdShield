"""
CrowdShield USB Serial Gateway Bridge (ESP32 & ESP8266)
System Version: 2.1 (Pure ESP-NOW 2.4GHz Mesh Edition)

Bridges real-time wireless packets from Field Nodes (Zones 1, 2, 3) through
the Command Center Gateway ESP (ESP32 or ESP8266) into the FastAPI Spine (/node).
Also receives operator voice / warning dispatch commands from the web app
and transmits them down the USB Serial cable for instant over-the-air broadcast.
"""

import argparse
import json
import random
import sys
import threading
import time
from typing import Optional, Dict, Any, List

import requests
import serial
import serial.tools.list_ports

BACKEND_NODE_URL = "http://localhost:8000/node"
BACKEND_DOWNLINK_URL = "http://localhost:8000/api/downlink_queue"
DEFAULT_BAUD = 115200


def find_esp_port() -> Optional[str]:
    """Auto-detects ESP32 / ESP8266 / CH340 / CP2102 / FTDI COM ports."""
    ports = serial.tools.list_ports.comports()
    for p in ports:
        desc = (p.description or "").lower()
        hwid = (p.hwid or "").lower()
        port_name = (p.device or "").lower()
        keywords = ["ch340", "cp210", "usb-serial", "uart", "esp32", "esp8266", "silicon labs", "qinheng"]
        if any(keyword in desc or keyword in hwid for keyword in keywords):
            return p.device
    return None


def list_all_ports() -> List[Dict[str, str]]:
    """Returns a list of all detected serial ports on the machine."""
    found = []
    for p in serial.tools.list_ports.comports():
        found.append({
            "port": p.device,
            "description": p.description or "Generic Serial Device",
            "hwid": p.hwid or "N/A"
        })
    return found


def downlink_poll_worker(ser: serial.Serial, stop_event: threading.Event):
    """
    Background worker thread:
    Polls the backend /api/downlink_queue every 200ms so that operator warning
    commands dispatched in the web app are transmitted over USB to the ESP within
    sub-second latency, without waiting for the next node uplink!
    """
    while not stop_event.is_set():
        try:
            res = requests.get(BACKEND_DOWNLINK_URL, timeout=0.8)
            if res.status_code == 200:
                data = res.json()
                downlink = data.get("downlink")
                if downlink:
                    cmd_line = json.dumps(downlink) + "\n"
                    ser.write(cmd_line.encode("utf-8"))
                    ser.flush()
                    print(f"\n[{time.strftime('%H:%M:%S')}] >>> [DISPATCH DOWNLINK BROADCAST TO ESP]: "
                          f"Zone={downlink.get('z')} Track={downlink.get('track', 1)} "
                          f"Instruction={downlink.get('instruction', 'EVACUATE')}")
        except Exception:
            pass
        time.sleep(0.2)


def run_virtual_gateway():
    """
    High-Fidelity Virtual Hardware Simulator:
    Simulates the exact 2.4GHz ESP-NOW packet stream from 3 physical Zonal ESPs:
      - Zone 1 (ESP32 + DFPlayer Mini + SOS Button on GPIO 13)
      - Zone 2 (ESP32 + DFPlayer Mini + SOS Button on GPIO 13)
      - Zone 3 (ESP32 + DFPlayer Mini + SOS Button on GPIO 13)
    Allows complete validation of the app feedback loop before plugging in boards.
    """
    print("\n=====================================================================")
    print(" CROWDSHIELD VIRTUAL HARDWARE MESH SIMULATOR")
    print(f" Target Endpoint: {BACKEND_NODE_URL}")
    print(" Simulating: 3 Zonal Field Nodes on 2.4GHz Direct Broadcast")
    print("=====================================================================\n")

    seq_counters = {1: 10, 2: 20, 3: 15}
    last_sent = {1: 0.0, 2: 0.0, 3: 0.0}
    t_cycle = 0

    while True:
        now = time.time()

        # Check for pending downlinks
        try:
            dl_res = requests.get(BACKEND_DOWNLINK_URL, timeout=0.5)
            if dl_res.status_code == 200:
                dl_data = dl_res.json()
                downlink = dl_data.get("downlink")
                if downlink:
                    print(f"[{time.strftime('%H:%M:%S')}] >>> [VIRTUAL ESP-NOW RECEIVED DOWNLINK]: "
                          f"Zone={downlink.get('z')} Track={downlink.get('track')} "
                          f"Instruction={downlink.get('instruction')} -> DFPlayer Playing 000{downlink.get('track')}.mp3!")
        except Exception:
            pass

        for z in [1, 2, 3]:
            # Send heartbeat every 5s, or simulate SOS button trigger occasionally
            interval = 5.0
            if (now - last_sent[z]) >= interval:
                seq_counters[z] += 1
                is_sos = 0  # No fake timer SOS; alerts only trigger on actual button presses
                volts = round(4.12 - (t_cycle * 0.0005) + random.uniform(-0.01, 0.01), 2)
                pct = max(10, min(100, int((volts - 3.3) / 0.9 * 100)))

                packet = {
                    "node": f"NODE-Z{z}",
                    "z": z,
                    "sos": is_sos,
                    "mo": 1 if random.random() < 0.2 else 0,
                    "seq": seq_counters[z],
                    "rssi": random.randint(-72, -58),
                    "batteryVolts": volts,
                    "batteryPct": pct
                }

                try:
                    res = requests.post(BACKEND_NODE_URL, json=packet, timeout=1.0)
                    resp_data = res.json()
                    downlink = resp_data.get("downlink")

                    sos_tag = " [🚨 PHYSICAL SOS BUTTON PRESSED!]" if is_sos == 1 else ""
                    print(f"[{time.strftime('%H:%M:%S')}] Simulated Uplink -> Zone {z} (NODE-Z{z}) | "
                          f"Seq #{packet['seq']} | RSSI: {packet['rssi']} dBm | "
                          f"Bat: {volts}V ({pct}%){sos_tag}")

                    if downlink:
                        print(f"   >>> [DOWNLINK DELIVERED TO ZONE {downlink.get('z')}]: "
                              f"Track={downlink.get('track')} Cmd={downlink.get('instruction')}")
                except Exception as err:
                    print(f"   [!] Backend error: {err}")

                last_sent[z] = now

        t_cycle += 1
        time.sleep(0.5)


def run_serial_bridge(port_name: Optional[str] = None):
    print("\n=====================================================================")
    print(" CROWDSHIELD SERIAL GATEWAY BRIDGE (ESP32 / ESP8266)")
    print(f" Target Baud Rate: {DEFAULT_BAUD}")
    print(f" Backend Endpoint: {BACKEND_NODE_URL}")
    print("=====================================================================\n")

    available_ports = list_all_ports()
    print("Scanning available COM ports on host...")
    for p in available_ports:
        print(f"  • {p['port']}: {p['description']} ({p['hwid']})")

    port = port_name or find_esp_port()

    if not port:
        print("\n[!] No physical ESP32 or ESP8266 COM port auto-detected.")
        print("[!] Falling back to Virtual Hardware Mesh Simulator for testing...")
        run_virtual_gateway()
        return

    print(f"\n[+] Connecting to Gateway ESP on port: {port} at {DEFAULT_BAUD} baud...")

    while True:
        try:
            ser = serial.Serial(port, DEFAULT_BAUD, timeout=1.0)
            time.sleep(1.0) # Allow board reboot/DTR reset
            print(f"[✓] Connected to Gateway ESP on {port}!")
            print("[✓] Listening for 2.4GHz ESP-NOW packets from Zonal Nodes 1, 2, 3...\n")

            stop_event = threading.Event()
            poll_thread = threading.Thread(target=downlink_poll_worker, args=(ser, stop_event), daemon=True)
            poll_thread.start()

            while True:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if not line:
                    continue

                # Expected formats:
                # 1) JSON string followed by \t RSSI
                #    {"node":"NODE-Z1","z":1,"sos":1,"mo":0,"seq":42,"batteryVolts":4.1,"batteryPct":90}\t-65
                # 2) Raw JSON string: {"node":"NODE-Z1", ...}
                try:
                    rssi_val = -65
                    if "\t" in line:
                        payload_str, rssi_str = line.split("\t", 1)
                        ev = json.loads(payload_str)
                        try:
                            rssi_val = int(rssi_str.strip())
                        except ValueError:
                            rssi_val = -65
                    else:
                        ev = json.loads(line)

                    # Status messages from gateway itself
                    if "status" in ev:
                        print(f"[{time.strftime('%H:%M:%S')}] [GATEWAY STATUS]: {line}")
                        continue

                    ev.setdefault("rssi", rssi_val)

                    # Post uplink packet to central backend
                    res = requests.post(BACKEND_NODE_URL, json=ev, timeout=1.0)
                    resp_data = res.json()

                    sos_flag = " [🚨 HARDWARE SOS TRIGGERED!]" if ev.get("sos") == 1 else ""
                    print(f"[{time.strftime('%H:%M:%S')}] ESP-NOW Uplink -> Zone {ev.get('z')} "
                          f"({ev.get('node', 'NODE')}) | Seq #{ev.get('seq')} | "
                          f"RSSI: {ev.get('rssi')} dBm{sos_flag}")

                    # Check if backend returned an immediate downlink in response
                    downlink = resp_data.get("downlink")
                    if downlink:
                        cmd_line = json.dumps(downlink) + "\n"
                        ser.write(cmd_line.encode("utf-8"))
                        ser.flush()
                        print(f"   >>> [DIRECT DOWNLINK SENT]: {cmd_line.strip()}")

                except json.JSONDecodeError:
                    # Ignore radio noise or boot text
                    if not any(k in line for k in ["Booting", "Connecting", "rst:", "ets "]):
                        print(f"   [Serial Raw]: {line[:75]}")
                except Exception as ex:
                    print(f"   [!] Processing error: {ex}")

        except serial.SerialException as s_err:
            print(f"[!] Serial connection lost on {port}: {s_err}. Reconnecting in 3s...")
            time.sleep(3.0)
        except KeyboardInterrupt:
            print("\nSerial reader bridge stopped by operator.")
            break


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CrowdShield USB Serial Gateway Bridge")
    parser.add_argument("--port", type=str, default=None, help="COM port (e.g. COM3, COM4, COM5)")
    parser.add_argument("--mock", action="store_true", help="Force virtual hardware mesh simulator")
    args = parser.parse_args()

    if args.mock:
        run_virtual_gateway()
    else:
        run_serial_bridge(port_name=args.port)
