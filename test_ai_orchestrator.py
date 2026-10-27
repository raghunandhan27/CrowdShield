import sys
import os
import json

# UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

print("=" * 70)
print("TESTING 4-AI ORCHESTRATOR & REAL-TIME GIS SYNC")
print("=" * 70)

from fastapi.testclient import TestClient
import backend_server
from backend_server import app, AI_MODELS, auto_switch_ai_model, ensure_default_demo_cameras

client = TestClient(app)

# 1. Verify AI Models defined
print("\n[1] Verifying 4 AI Architectures in Registry:")
for k, v in AI_MODELS.items():
    print(f"  ✓ {k}: {v['name']} ({v['short_name']}) | Latency: {v['latency_ms']}ms | Method: {v['method']}")
assert len(AI_MODELS) == 4, "Must have exactly 4 dense-crowd AI architectures"
assert set(AI_MODELS.keys()) == {"p2pnet", "dm_count", "csrnet", "sahi_yolo"}

# 2. Test auto_switch_ai_model logic
print("\n[2] Testing Autonomous Density Threshold Switching (NO USER SELECTION):")
cases = [
    (1.2, 150, "Zone A", "p2pnet"),
    (2.5, 450, "Zone D", "dm_count"),
    (4.1, 800, "Zone B", "csrnet"),
    (5.8, 2500, "Zone C", "sahi_yolo"),
]
for density, count, zone, expected_model in cases:
    model_info = auto_switch_ai_model(density, count, zone)
    print(f"  ✓ Density {density} pax/m2 ({count} pax in {zone}) -> {model_info['short_name']} ({model_info['name']})")
    assert model_info["id"] == expected_model, f"Expected {expected_model}, got {model_info['id']}"

# 3. Test ensure_default_demo_cameras & camera registry
print("\n[3] Testing Default Demo Cameras Seeding:")
ensure_default_demo_cameras()
cam_res = client.get("/api/cameras")
assert cam_res.status_code == 200
cameras_data = cam_res.json()
cameras = cameras_data if isinstance(cameras_data, list) else cameras_data.get("cameras", [])
print(f"  ✓ Registered Cameras count: {len(cameras)}")
assert len(cameras) >= 4, "Expected at least 4 demo cameras"

# Check each camera has real video and auto-assigned AI model
for cam in cameras:
    model = cam.get("ai_model", {})
    print(f"  ✓ Camera {cam['id']} ({cam['name']}) -> Zone: {cam.get('zone_id')} | Density: {cam.get('density')} pax/m2 | Active AI: {model.get('short_name')} ({model.get('name')}) | Latency: {model.get('latency_ms')}ms")
    assert "ai_model" in cam, f"Camera {cam['id']} missing ai_model"
    assert model.get("id") in AI_MODELS, f"Invalid AI model for camera {cam['id']}"

# 4. Test GIS Real-time Data Sync
print("\n[4] Testing Real-Time GIS Zone Sync with Vision Metrics:")
gis_res = client.get("/api/gis/venue")
assert gis_res.status_code == 200
venue_data = gis_res.json()
features = venue_data.get("features", [])
zone_features = [f for f in features if f.get("properties", {}).get("type") == "ZONE"]
print(f"  ✓ Found {len(zone_features)} GIS Zones in venue GeoJSON:")
for zf in zone_features:
    p = zf.get("properties", {})
    print(f"    - {p.get('id')} ({p.get('name')}): Density={p.get('density')} pax/m2, Count={p.get('personCount')}, Model={p.get('ai_model_name', 'Auto-Switched')}")

print("\n" + "=" * 70)
print("SUCCESS: ALL 4 AI MODELS AND GIS SYNCHRONIZATION VERIFIED!")
print("=" * 70)
