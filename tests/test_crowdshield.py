"""
CrowdShield Automated Test Suite (Milestone M14)
Unit & Contract Tests for Data Schemas, Physics Risk Engine,
NetworkX Dynamic Routing, PyTorch Forecaster, and FastAPI Spine.
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import math
import time
import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

from contracts import (
    AlertObject,
    DownlinkCmd,
    NodeEvent,
    ZoneMetric,
    ZonesPayload,
    build_venue_graph,
    compute_risk,
    compute_safe_routes,
)
from backend_server import app, state, raise_alert
from forecast.model import ForecasterLSTM, baseline_linear_trend, baseline_persistence


# ============================================================================
# 1. CONTRACTS & PYDANTIC SCHEMA TESTS
# ============================================================================

def test_pydantic_contracts_validation():
    # Valid ZoneMetric
    zm = ZoneMetric(density=2.4, speed=0.85, conflict=0.20, risk=0.52, level=1)
    assert zm.density == 2.4
    assert zm.level == 1

    # Valid ZonesPayload
    payload = ZonesPayload(
        ts=time.time(),
        cam="cam1",
        fps=15.0,
        zones={"z1": zm}
    )
    assert "z1" in payload.zones

    # Valid NodeEvent
    ne = NodeEvent(z=2, sos=1, mo=0, seq=17, rssi=-92)
    assert ne.z == 2
    assert ne.sos == 1
    assert ne.rssi == -92

    # Valid DownlinkCmd
    cmd = DownlinkCmd(z=2, lvl=3, instruction="EVACUATE")
    assert cmd.z == 2
    assert cmd.lvl == 3


# ============================================================================
# 2. FRUIN DENSITY-GATED RISK PHYSICS TESTS
# ============================================================================

def test_density_gated_risk_no_false_alarm_in_empty_room():
    """
    Critical verification: An empty or quiet room where speed=0
    MUST NOT score as high risk!
    """
    d_empty = 0.2
    v_still = 0.0
    c_still = 0.0
    score, level = compute_risk(d_empty, v_still, c_still)
    assert level == 0, f"Empty room scored level {level}, expected 0 (Safe)!"
    assert score < 0.25, f"Risk score was {score}, expected low!"


def test_fruin_critical_crush_threshold():
    """
    Fruin LoS Level 3 (Critical) triggered when density > 5.0 p/m^2.
    """
    d_crush = 5.2
    v_slow = 0.2
    c_moderate = 0.3
    score, level = compute_risk(d_crush, v_slow, c_moderate)
    assert level == 3, f"Crush density scored level {level}, expected 3 (Critical)!"
    assert score > 0.60


def test_turbulence_hard_override():
    """
    Hard safety override: if conflict > 0.60 and density > 3.0 p/m^2,
    the alert level automatically steps up by +1.
    """
    # Density 3.2 would normally be Level 1 (Caution)
    d_dense = 3.2
    v_crawl = 0.4
    c_turbulent = 0.75  # Opposing chaotic movement
    score, level = compute_risk(d_dense, v_crawl, c_turbulent)
    assert level >= 2, f"Turbulent flow did not step up level (level={level})"


# ============================================================================
# 3. NETWORKX DYNAMIC ROUTING TESTS
# ============================================================================

def test_networkx_safe_exit_routing_and_rerouting():
    G = build_venue_graph()
    assert len(G.nodes) == 7
    assert len(G.edges) == 8

    # Safe baseline
    zone_levels = {"z1": 0, "z2": 0, "z3": 0, "z4": 0}
    routes = compute_safe_routes(G, zone_levels, [])
    assert "z2" in routes
    assert routes["z2"]["exit"] == "GATE_B"
    initial_cost = routes["z2"]["cost"]

    # When z2 reaches Critical (Level 3), paths through z2 get infinite cost
    # Crowd in z1 must NOT be routed through z2!
    zone_levels_critical = {"z1": 0, "z2": 3, "z3": 0, "z4": 0}
    new_routes = compute_safe_routes(G, zone_levels_critical, [])
    assert new_routes["z1"]["exit"] == "GATE_A"
    assert "z2" not in new_routes["z1"]["path"]

    # When corridor z2-GATE_B is blocked by operator
    blocked_routes = compute_safe_routes(G, {"z1": 0, "z2": 1, "z3": 0, "z4": 0}, ["z2-GATE_B"])
    assert "GATE_B" not in blocked_routes["z2"]["path"]


# ============================================================================
# 4. PREDICTIVE FORECASTING & BASELINE TESTS
# ============================================================================

def test_forecasting_baselines_and_lstm():
    # 30 historical steps of 5 features
    hist = np.zeros((30, 5))
    hist[:, 0] = np.linspace(1.5, 3.5, 30)  # Density rising
    hist[:, 1] = 0.8
    hist[:, 2] = 0.2

    # Persistence
    pers = baseline_persistence(hist)
    assert pers[0] == hist[-1, 0]

    # Linear trend
    trend = baseline_linear_trend(hist)
    assert trend[0] > hist[-1, 0], "Trend should project rising density"

    # PyTorch LSTM
    model = ForecasterLSTM(n_in=5, hid=32, horizon=2)
    x = torch.from_numpy(hist).unsqueeze(0).float()
    out = model(x)
    assert out.shape == (1, 2)


# ============================================================================
# 5. FASTAPI BACKEND SERVER REST & WEBSOCKET TESTS
# ============================================================================

def test_fastapi_health_endpoint():
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "mode" in data


def test_fastapi_state_endpoint():
    client = TestClient(app)
    res = client.get("/state")
    assert res.status_code == 200
    data = res.json()
    assert "zones" in data
    assert "nodes" in data
    assert "routes" in data


def test_fastapi_node_telemetry_and_sos():
    client = TestClient(app)
    payload = {"z": 2, "sos": 1, "mo": 1, "seq": 45, "rssi": -72}
    res = client.post("/node", json=payload)
    assert res.status_code == 200
    resp_data = res.json()
    assert resp_data["ok"] is True

    # Verify node 2 state is updated
    state_res = client.get("/state").json()
    assert state_res["nodes"]["2"]["sos"] == 1
    assert state_res["nodes"]["2"]["seq"] == 45


def test_fastapi_alert_acknowledge():
    client = TestClient(app)
    # Raise a test alert
    alert = raise_alert("z2", "test_alert", 2, "Test English", "Test Tamil", cooldown_sec=0)
    assert alert is not None
    alert_id = alert["id"]

    # Acknowledge
    ack_res = client.post(f"/ack/{alert_id}")
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "acknowledged"


def test_fastapi_dispatch_downlink():
    client = TestClient(app)
    cmd = {"z": 2, "lvl": 3, "action": "LED_AND_AUDIO", "instruction": "0001_EVACUATE.mp3"}
    res = client.post("/dispatch", json=cmd)
    assert res.status_code == 200
    assert res.json()["ok"] is True

    # Check if queued for LoRa gateway
    node_ping = client.post("/node", json={"z": 1, "sos": 0, "mo": 0, "seq": 99, "rssi": -70})
    downlink = node_ping.json().get("downlink")
    assert downlink is not None
    assert downlink["instruction"] == "0001_EVACUATE.mp3"


def test_fastapi_simulate_event():
    client = TestClient(app)
    res = client.post("/api/simulate_event", json={"scenario": "SURGE_ZONE_2"})
    assert res.status_code == 200
    assert res.json()["ok"] is True

    state_data = client.get("/state").json()
    assert state_data["zones"]["z2"]["level"] == 3


# ============================================================================
# 5. GIS SPATIAL LAYERS & VIDEO TESTING ENDPOINTS
# ============================================================================

def test_gis_master_layers():
    client = TestClient(app)
    res = client.get("/api/gis/master")
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "FeatureCollection"
    features = data["features"]
    assert len(features) >= 4
    # Verify zone polygon IDs
    zone_ids = [f["properties"]["id"] for f in features if f["geometry"]["type"] == "Polygon"]
    assert "z1" in zone_ids
    assert "z2" in zone_ids


def test_gis_dynamic_routing():
    client = TestClient(app)
    res = client.get("/api/gis/routes")
    assert res.status_code == 200
    data = res.json()
    assert "evacuation" in data
    assert "responder" in data
    assert "geojson" in data
    assert data["geojson"]["type"] == "FeatureCollection"
    # Ensure evacuation paths calculated
    assert "z1" in data["evacuation"]
    assert data["evacuation"]["z1"]["target_exit"] in ["gate_a", "gate_b", "gate_c"]


def test_sample_video_endpoint():
    client = TestClient(app)
    res = client.post("/api/use_sample_video", json={"zoneId": "ZONE-A", "name": "Test Sample Crowd"})
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert "CAM-SAMPLE" in data["camera"]["id"]


def test_video_upload_endpoint(tmp_path):
    client = TestClient(app)
    # Create a small dummy video file
    dummy_video = tmp_path / "test_upload.mp4"
    dummy_video.write_bytes(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom")
    
    with open(dummy_video, "rb") as f:
        res = client.post(
            "/api/upload_video",
            files={"file": ("test_upload.mp4", f, "video/mp4")},
            data={"name": "Uploaded Hall Cam", "zone_id": "ZONE-B"}
        )
    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert "CAM-VID" in data["camera"]["id"]


def test_video_realtime_pacing_and_looping():
    """
    Verifies that video playback runs at native 1.0x FPS (fluid >= 18 FPS)
    and loops seamlessly without halting or stalling.
    """
    from backend_server import RealCameraFeed
    sample_path = os.path.abspath(r"D:\crowdshield\test_videos\sample_crowd.mp4")
    if not os.path.exists(sample_path):
        pytest.skip("sample_crowd.mp4 not present")

    feed = RealCameraFeed(
        cam_id="CAM-TEST-LOOP",
        name="Loop Test Cam",
        zone_id="z1",
        source=sample_path
    )
    # Allow feed to stream for 1.2s to establish steady-state pacing
    time.sleep(1.2)
    assert feed.running is True
    assert feed.status == "ONLINE"
    assert feed.fps >= 18.0  # Verifies true fluid 1.0x playback speed (25-30 FPS)
    assert feed.latest_jpeg is not None
    assert len(feed.latest_jpeg) > 1000  # Valid encoded JPEG frame
    feed.stop()

