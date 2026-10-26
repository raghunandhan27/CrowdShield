"""
CrowdShield Mock Data Publisher (Milestone M1)
Simulates realistic continuous multi-zone crowd density and LoRa node heartbeats.
Publishes directly to the central backend spine.
"""

import argparse
import math
import random
import time
import requests

from contracts import compute_risk

BACKEND_ZONES_URL = "http://localhost:8000/zones"
BACKEND_NODE_URL = "http://localhost:8000/node"


def run_publisher(surge_zone: int = 0, trigger_sos: bool = False):
    print("\n=====================================================================")
    print(" CROWDSHIELD MOCK TELEMETRY PUBLISHER (Milestone M1)")
    print(f" Target Backend: {BACKEND_ZONES_URL}")
    print("=====================================================================\n")

    t = 0
    seq = 100

    while True:
        now = time.time()
        zones_data = {}

        # 1. Synthesize 4 Zones with Fruin Level of Service Physics
        for z in range(1, 5):
            zid = f"z{z}"
            # Sine wave oscillation
            base_density = 2.4 + 2.2 * math.sin(t / 25.0 + z * 1.4) + random.uniform(-0.15, 0.15)
            
            # If simulated surge requested for specific zone
            if surge_zone == z:
                base_density = max(5.2, base_density + 2.8)

            d = max(0.2, round(base_density, 2))
            v = max(0.12, round(1.25 - (d / 4.5) + random.uniform(-0.06, 0.06), 2))
            c = round(min(0.95, max(0.05, (d / 6.0) * 0.70 + random.uniform(-0.08, 0.08))), 2)

            score, lvl = compute_risk(d, v, c)

            zones_data[zid] = {
                "density": d,
                "speed": v,
                "conflict": c,
                "risk": score,
                "level": lvl
            }

        # Post zones payload
        zones_payload = {
            "ts": now,
            "cam": "MOCK-CAM-01",
            "fps": 15.0,
            "zones": zones_data
        }

        try:
            res_z = requests.post(BACKEND_ZONES_URL, json=zones_payload, timeout=1.0)
            if res_z.status_code == 200:
                print(f"[{time.strftime('%H:%M:%S')}] Zones Sync -> "
                      f"z1: {zones_data['z1']['density']}p/m² (L{zones_data['z1']['level']}) | "
                      f"z2: {zones_data['z2']['density']}p/m² (L{zones_data['z2']['level']}) | "
                      f"z3: {zones_data['z3']['density']}p/m² | z4: {zones_data['z4']['density']}p/m²")
        except Exception as e:
            print(f"Warning: Could not post zones to backend ({e})")

        # 2. Synthesize Node Telemetry & Heartbeat every 5 seconds
        if t % 5 == 0:
            for z in [1, 2, 3, 4]:
                seq += 1
                is_sos = 1 if (trigger_sos and z == 2) else 0
                node_payload = {
                    "z": z,
                    "sos": is_sos,
                    "mo": 1 if random.random() < 0.3 else 0,
                    "seq": seq,
                    "rssi": random.randint(-82, -64),
                    "batteryVolts": round(4.12 - (t * 0.0005), 2),
                    "batteryPct": max(20, min(100, int(88 - t * 0.01)))
                }
                try:
                    res_n = requests.post(BACKEND_NODE_URL, json=node_payload, timeout=1.0)
                    downlink = res_n.json().get("downlink")
                    if downlink:
                        print(f"   >>> [LORA DOWNLINK DETECTED FOR ZONE {downlink.get('z')}]: {downlink}")
                except Exception:
                    pass

        t += 1
        time.sleep(1.0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CrowdShield Mock Telemetry Publisher")
    parser.add_argument("--surge-zone", type=int, default=0, help="Zone number to surge to Critical (1..4)")
    parser.add_argument("--sos", action="store_true", help="Simulate active hardware SOS on Zone 2")
    args = parser.parse_args()

    run_publisher(surge_zone=args.surge_zone, trigger_sos=args.sos)
