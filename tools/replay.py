"""
CrowdShield Time-Series Replay & Simulation Tool (Milestone M14)
Feeds recorded or synthetic scenario logs through the Backend Spine to demonstrate
crush detection, safe exit rerouting, and 10-15 minute early warning forecasts.
"""

import argparse
import json
import time
import requests

BACKEND_ZONES_URL = "http://localhost:8000/zones"
SIMULATE_URL = "http://localhost:8000/api/simulate_event"

SCENARIOS = {
    "stampede_surge": [
        {"desc": "Normal Baseline Monitoring", "z2_density": 1.4, "conflict": 0.05, "speed": 1.1},
        {"desc": "Inflow Accelerating at East Corridor", "z2_density": 2.5, "conflict": 0.15, "speed": 0.9},
        {"desc": "Bottleneck Forming near Stage Aisle", "z2_density": 3.6, "conflict": 0.35, "speed": 0.6},
        {"desc": "Restricted Flow — Caution Threshold Crossed", "z2_density": 4.3, "conflict": 0.55, "speed": 0.4},
        {"desc": "Turbulent Opposing Streams (Conflict > 0.6)", "z2_density": 4.9, "conflict": 0.75, "speed": 0.25},
        {"desc": "CRITICAL CRUSH THRESHOLD BREACHED (Level 3)", "z2_density": 5.6, "conflict": 0.88, "speed": 0.12},
    ],
    "hardware_sos": [
        {"desc": "Field Node 2 normal heartbeat", "sos": 0},
        {"desc": "Crowd member presses physical SOS button", "sos": 1},
        {"desc": "Operator acknowledges and dispatches evacuation", "sos": 0},
    ]
}


def run_replay(scenario_name: str = "stampede_surge", speed_multiplier: float = 2.0):
    print("\n=====================================================================")
    print(f" CROWDSHIELD TIME-SERIES REPLAY: {scenario_name.upper()}")
    print("=====================================================================\n")

    if scenario_name == "stampede_surge":
        steps = SCENARIOS["stampede_surge"]
        for i, step in enumerate(steps):
            print(f"Step {i+1}/{len(steps)}: {step['desc']}")
            d2 = step["z2_density"]
            c2 = step["conflict"]
            v2 = step["speed"]
            lvl = 3 if d2 > 5.0 else 2 if d2 > 4.0 else 1 if d2 > 2.0 else 0
            if c2 > 0.6 and d2 > 3.0:
                lvl = min(3, lvl + 1)

            payload = {
                "ts": time.time(),
                "cam": "REPLAY-CAM-02",
                "fps": 15.0,
                "zones": {
                    "z1": {"density": 1.2, "speed": 1.1, "conflict": 0.05, "risk": 0.14, "level": 0},
                    "z2": {"density": d2, "speed": v2, "conflict": c2, "risk": round(d2 / 6.0, 2), "level": lvl},
                    "z3": {"density": 1.8, "speed": 0.9, "conflict": 0.10, "risk": 0.22, "level": 0},
                    "z4": {"density": 0.9, "speed": 1.2, "conflict": 0.04, "risk": 0.10, "level": 0},
                }
            }
            try:
                requests.post(BACKEND_ZONES_URL, json=payload, timeout=1.0)
            except Exception as e:
                print("Backend error:", e)

            time.sleep(3.0 / speed_multiplier)

    print("\nReplay scenario completed successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CrowdShield Scenario Replay")
    parser.add_argument("--scenario", type=str, default="stampede_surge", choices=["stampede_surge", "hardware_sos"])
    parser.add_argument("--speed", type=float, default=1.0, help="Playback speed multiplier")
    args = parser.parse_args()

    run_replay(args.scenario, args.speed)
