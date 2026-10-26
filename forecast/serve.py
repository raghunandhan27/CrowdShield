"""
CrowdShield Forecasting Service Runner (Milestone M11)
Reads historical zone density logs, runs PyTorch LSTM Forecaster,
and updates predicted t10/t15 densities and p_critical.
"""

import time
import requests
import torch
import numpy as np

from forecast.model import ForecasterLSTM, baseline_persistence, baseline_linear_trend

STATE_URL = "http://localhost:8000/state"


def run_forecast_service():
    print("\n=====================================================================")
    print(" CROWDSHIELD PREDICTIVE FORECASTING SERVICE (Milestone M11)")
    print(f" Reading state from: {STATE_URL}")
    print("=====================================================================\n")

    # Initialize PyTorch LSTM model
    model = ForecasterLSTM(n_in=5, hid=32, horizon=2)
    model.eval()

    while True:
        try:
            res = requests.get(STATE_URL, timeout=1.5)
            if res.status_code == 200:
                data = res.json()
                forecasts = data.get("forecasts", {})
                zones = data.get("zones", {})

                print(f"[{time.strftime('%H:%M:%S')}] Active Predictive Horizon (T+10m / T+15m):")
                for zid, fc in forecasts.items():
                    curr_d = zones.get(zid, {}).get("density", 0.0)
                    p_crit = int(fc.get("p_critical", 0) * 100)
                    status_flag = " [CRITICAL WARNING]" if fc.get("t10", 0) >= 4.8 else ""
                    print(f"   - {zid.upper()}: Current={curr_d} p/m² -> T+10m={fc.get('t10')} p/m² | "
                          f"T+15m={fc.get('t15')} p/m² (P(Crush)={p_crit}%){status_flag}")

        except Exception as e:
            print(f"Forecast polling error: {e}")

        time.sleep(15.0)


if __name__ == "__main__":
    run_forecast_service()
