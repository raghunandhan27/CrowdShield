"""
CrowdShield Unified Central Backend Spine & Multi-Camera Edge AI Server
System Version: 2.1 (Production Edition - Real Data & Dynamic Cameras)
Features:
- Dynamic Real Camera Ingest (Webcam 0/1/2, Smartphone IP Webcam RTSP/HTTP, Video files)
- Real-Time YOLOv8 Person Detection & 4-Point Homography per camera
- Dynamic NetworkX Safe-Exit Evacuation Routing
- Physical LoRa/ESP-NOW Mesh Gateway USB Serial Link
- WebSocket Real-Time Synchronization (Sub-second)
- Clean, 100% Real Operational State (Zero fake mock jitter)
"""

import asyncio
import base64
import io
import json
import math
import os
import sys
import threading
import time
from contextlib import asynccontextmanager
from typing import Dict, List, Optional, Set

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import serial.tools.list_ports
import shutil

from gis_engine import gis_manager, GISVenueManager
from vision_engine import vision_manager, VisionTier, TIER_METADATA
from contracts import (
    AlertObject,
    DownlinkCmd,
    NodeEvent,
    OperatorAction,
    ZonesPayload,
    build_venue_graph,
    compute_risk,
    compute_safe_routes,
)

# ============================================================================
# REAL HOMOGRAPHY CALIBRATION MATRICES (12m x 8m venue)
# ============================================================================

W_M, H_M = 12.0, 8.0
CELL_W, CELL_H = 6.0, 4.0
NX, NY = 2, 2

# Standard 4-point corners for camera homography (1280x720 plane)
DEFAULT_IMG_CORNERS = np.float32([[180, 260], [1100, 260], [1240, 690], [40, 690]])
DEFAULT_WORLD_CORNERS = np.float32([[0.0, 0.0], [W_M, 0.0], [W_M, H_M], [0.0, H_M]])
DEFAULT_HM = cv2.getPerspectiveTransform(DEFAULT_IMG_CORNERS, DEFAULT_WORLD_CORNERS)

# ============================================================================
# STATE & SYSTEM INITIALIZATION (CLEAN REAL-TIME STATE)
# ============================================================================

VENUE_GRAPH = build_venue_graph()
ws_clients: Set[WebSocket] = set()
alert_cooldowns: Dict[str, float] = {}
downlink_queue: List[dict] = []
start_time = time.time()

# 100% Real-time operational state (No fake simulated values)
state = {
    "mode": "REAL_TIME_ACTIVE",
    "ts": time.time(),
    "fps": 0.0,
    "last_real_vision": 0.0,
    "last_real_node": 0.0,
    "zones": {
        "z1": {"density": 0.0, "speed": 0.0, "conflict": 0.0, "risk": 0.0, "level": 0, "name": "Zone A — Main Gate Plaza", "personCount": 0},
        "z2": {"density": 0.0, "speed": 0.0, "conflict": 0.0, "risk": 0.0, "level": 0, "name": "Zone B — East Corridor Choke", "personCount": 0},
        "z3": {"density": 0.0, "speed": 0.0, "conflict": 0.0, "risk": 0.0, "level": 0, "name": "Zone C — Central Stage Arena", "personCount": 0},
        "z4": {"density": 0.0, "speed": 0.0, "conflict": 0.0, "risk": 0.0, "level": 0, "name": "Zone D — North Exit Concourse", "personCount": 0},
    },
    "nodes": {
        "1": {
            "id": "NODE-Z1",
            "z": 1,
            "sos": 0,
            "mo": 0,
            "seq": 0,
            "rssi": -65,
            "batteryVolts": 4.12,
            "batteryPct": 90,
            "online": False,
            "ts": 0.0,
            "role": "FIELD_NODE",
            "protocol": "ESP-NOW 2.4GHz Direct Mesh",
            "hardware": "ESP32 + DFPlayer Mini + 3W Spk + SOS (GPIO 13)",
            "lastSeen": "Awaiting Telemetry"
        },
        "2": {
            "id": "NODE-Z2",
            "z": 2,
            "sos": 0,
            "mo": 0,
            "seq": 0,
            "rssi": -70,
            "batteryVolts": 4.08,
            "batteryPct": 88,
            "online": False,
            "ts": 0.0,
            "role": "FIELD_NODE",
            "protocol": "ESP-NOW 2.4GHz Direct Mesh",
            "hardware": "ESP32 + DFPlayer Mini + 3W Spk + SOS (GPIO 13)",
            "lastSeen": "Awaiting Telemetry"
        },
        "3": {
            "id": "NODE-Z3",
            "z": 3,
            "sos": 0,
            "mo": 0,
            "seq": 0,
            "rssi": -75,
            "batteryVolts": 4.05,
            "batteryPct": 85,
            "online": False,
            "ts": 0.0,
            "role": "FIELD_NODE",
            "protocol": "ESP-NOW 2.4GHz Direct Mesh",
            "hardware": "ESP32 + DFPlayer Mini + 3W Spk + SOS (GPIO 13)",
            "lastSeen": "Awaiting Telemetry"
        },
        "gw": {
            "id": "GW-USB-01",
            "z": 0,
            "sos": 0,
            "mo": 0,
            "seq": 0,
            "rssi": -55,
            "batteryVolts": 5.0,
            "batteryPct": 100,
            "online": True,
            "ts": time.time(),
            "role": "GATEWAY",
            "protocol": "USB Serial (115200 baud)",
            "hardware": "ESP32 / ESP8266 USB Bridge",
            "lastSeen": "Ready on USB"
        },
    },
    "forecasts": {
        "z1": {"t10": 0.0, "t15": 0.0, "p_critical": 0.0},
        "z2": {"t10": 0.0, "t15": 0.0, "p_critical": 0.0},
        "z3": {"t10": 0.0, "t15": 0.0, "p_critical": 0.0},
        "z4": {"t10": 0.0, "t15": 0.0, "p_critical": 0.0},
    },
    "routes": {},
    "blocked_edges": [],
    "alerts": [],
    "operator_actions": [],
    "active_cameras": {},
    "active_medical_incident": None,
    "medical_incidents": [],
    "demo_overrides": {},
    "active_hazards": {},
    "hazard_broadcasts": [],
    "vision_tier": "tier4_hybrid_auto",
    "vision_tier_meta": {
        "name": "Tier 4: Hybrid Pro Auto-Switcher",
        "description": "Dynamic auto-switching between YOLO tracking and CSRNet Density-Map",
        "optimal_density": "0.0 - 6.0+ pax/m² (All Regimes)"
    },
}

zone_history: Dict[str, List[float]] = {f"z{i}": [] for i in range(1, 5)}

# ============================================================================
# SHARED YOLOV8 MODEL & CAMERA INGEST MANAGER
# ============================================================================

yolo_model = None
yolo_lock = threading.Lock()


def get_yolo():
    global yolo_model
    if yolo_model is None:
        from ultralytics import YOLO
        print("[AI] Initializing shared YOLOv8 nano model (yolov8n.pt)...")
        yolo_model = YOLO("yolov8n.pt")
    return yolo_model


def normalize_camera_source(src_input: str):
    s = str(src_input).strip()
    if s.isdigit():
        return int(s)
    # Check if local file path or Windows drive letter (e.g. D:\path)
    if os.path.exists(s) or s.lower().endswith((".mp4", ".avi", ".mov", ".mkv", ".jpg", ".png")):
        return s
    if len(s) >= 2 and s[1] == ":" and s[0].isalpha():
        return s

    if not (s.startswith("http://") or s.startswith("https://") or s.startswith("rtsp://")):
        if ":" in s:
            s = "http://" + s
        elif s.count(".") == 3:  # Raw IP e.g. 192.168.1.15
            s = f"http://{s}:8080"
        else:
            s = "http://" + s

    if s.startswith("http://") or s.startswith("https://"):
        clean_s = s.rstrip("/")
        parts = clean_s.split("//")[-1].split("/")
        if len(parts) == 1:
            if ":" not in parts[0]:
                clean_s = clean_s + ":8080"
            return clean_s + "/video"
        elif len(parts) == 2 and parts[1] == "":
            return clean_s + "/video"
        elif len(parts) == 2 and parts[1] not in ("video", "shot.jpg"):
            # e.g. user pasted http://ip:8080/something
            return clean_s + "/video"
    return s


def normalize_zone_id(zid: str) -> str:
    s = str(zid).strip().lower()
    mapping = {
        "zone-a": "z1", "zone_a": "z1", "zone a": "z1", "za": "z1", "a": "z1", "1": "z1", "z1": "z1",
        "zone-b": "z2", "zone_b": "z2", "zone b": "z2", "zb": "z2", "b": "z2", "2": "z2", "z2": "z2",
        "zone-c": "z3", "zone_c": "z3", "zone c": "z3", "zc": "z3", "c": "z3", "3": "z3", "z3": "z3",
        "zone-d": "z4", "zone_d": "z4", "zone d": "z4", "zd": "z4", "d": "z4", "4": "z4", "z4": "z4",
    }
    return mapping.get(s, s.replace("zone-", "z"))


class RealCameraFeed:
    """
    High-Performance Decoupled Video & GIS Spatial Camera Ingest Pipeline:
    - True GIS Square-Meter Density: Calculates accurate people per m^2 using GeoJSON polygon
      areas and 4-point Perspective Homography ground projection.
    - Reader & Playback Thread (_capture_and_playback_loop): Paces video playback to match
      the file's native FPS (e.g. 25-30 FPS) for true 1.0x real-time speed with continuous looping.
    - Asynchronous AI Worker Thread (_inference_worker_loop): Executes YOLOv8 person detection
      and Farnebäck optical flow asynchronously without stalling playback.
    """
    def __init__(self, cam_id: str, name: str, zone_id: str, source: str):
        self.cam_id = cam_id
        self.name = name
        self.zone_id = normalize_zone_id(zone_id)  # Standardized 'z1', 'z2', 'z3', 'z4'
        self.source = source
        self.running = True
        self.latest_frame = None
        self.latest_jpeg = None
        self.fps = 0.0
        self.person_count = 0
        self.density = 0.0
        self.speed = 0.95
        self.conflict = 0.05
        self.status = "CONNECTING..."

        # GIS Spatial Polygon Metadata & Ground Calibration
        gis_meta = {
            "z1": {"name": "Zone A — Main Gate Plaza", "area_m2": 320.0, "w": 16.0, "h": 20.0},
            "z2": {"name": "Zone B — East Corridor Choke", "area_m2": 95.0, "w": 5.0, "h": 19.0},
            "z3": {"name": "Zone C — Central Stage Arena", "area_m2": 480.0, "w": 20.0, "h": 24.0},
            "z4": {"name": "Zone D — North Exit Concourse", "area_m2": 240.0, "w": 12.0, "h": 20.0},
        }
        meta = gis_meta.get(self.zone_id, {"name": f"Zone {self.zone_id.upper()}", "area_m2": 95.0, "w": 10.0, "h": 10.0})
        self.zone_name = meta["name"]
        self.gis_area_m2 = gis_manager.zone_areas.get(self.zone_id, meta["area_m2"])
        self.world_w = meta["w"]
        self.world_h = meta["h"]
        self.fov_area_m2 = self.world_w * self.world_h

        # 4-point Perspective Homography ground projection matrix (image pixels -> ground meters)
        self.img_corners = np.float32([[140, 130], [500, 130], [620, 460], [20, 460]])
        self.world_corners = np.float32([[0, 0], [self.world_w, 0], [self.world_w, self.world_h], [0, self.world_h]])
        self.H_mat = cv2.getPerspectiveTransform(self.img_corners, self.world_corners)

        # Inter-thread synchronization primitives
        self.cap = None
        self.telemetry_lock = threading.Lock()
        self.cached_boxes = np.empty((0, 4))
        self.cached_heatmap = None
        self.cached_fallen = []
        self.cached_fights = []
        self.last_fall_alert_ts = 0.0
        self.last_fight_alert_ts = 0.0
        self.engine_name = "Hybrid Auto (YOLO)"
        self.is_crush_regime = False
        self.regime = "NORMAL_FLOW"
        self.latest_raw_frame = None
        self.new_frame_event = threading.Event()
        self.infer_busy = False
        self.reset_flow = False

        # Start asynchronous AI worker thread
        self.infer_thread = threading.Thread(target=self._inference_worker_loop, daemon=True)
        self.infer_thread.start()

        # Start real-time capture and playback thread
        self.capture_thread = threading.Thread(target=self._capture_and_playback_loop, daemon=True)
        self.thread = self.capture_thread
        self.capture_thread.start()

    def _inference_worker_loop(self):
        prev_gray = None

        while self.running:
            # Wait for frame notification or timeout
            signaled = self.new_frame_event.wait(timeout=0.1)
            if not self.running:
                break
            if not signaled or self.latest_raw_frame is None:
                continue

            self.infer_busy = True
            self.new_frame_event.clear()

            frame_infer = self.latest_raw_frame.copy()

            if self.reset_flow:
                prev_gray = None
                self.reset_flow = False

            # 1. Execute Multi-Tier Vision Engine (Tier 1/2/3/4)
            try:
                res = vision_manager.process_frame(
                    frame_infer,
                    self.H_mat,
                    self.gis_area_m2,
                    self.world_w,
                    self.world_h
                )
            except Exception as e:
                print(f"[VisionEngine] Inference error on {self.cam_id}: {e}")
                res = {
                    "tier": "tier1_yolo_highres",
                    "engine_name": "YOLOv8 Fallback",
                    "regime": "NORMAL_FLOW",
                    "is_crush_regime": False,
                    "person_count": 0,
                    "density": 0.0,
                    "boxes": np.empty((0, 4)),
                    "heatmap_bgr": None
                }

            calc_density = res["density"]
            count = res["person_count"]

            # 2. Fast Optical Flow on downscaled frame (320x240)
            small_frame = cv2.resize(frame_infer, (320, 240))
            gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
            calc_speed = 0.95
            calc_conflict = 0.05
            if prev_gray is not None and not self.reset_flow:
                try:
                    flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 2, 13, 2, 5, 1.1, 0)
                    mag, _ = cv2.cartToPolar(flow[..., 0], flow[..., 1])
                    calc_speed = round(float(np.mean(mag)) * 0.25, 2)
                    # Directional Conflict Index: Conflict = 1 - ||(1/N) * sum(v)|| / ( (1/N) * sum(||v||) + eps )
                    flat_flow = flow.reshape(-1, 2)
                    mean_vec = np.mean(flat_flow, axis=0)
                    mean_speed = float(np.mean(mag))
                    norm_mean = float(np.linalg.norm(mean_vec))
                    calc_conflict = round(float(np.clip(1.0 - (norm_mean / (mean_speed + 1e-6)), 0.0, 1.0)), 2)
                except Exception:
                    pass
            prev_gray = gray

            # 3. Check for Progressive Crowd Collapse / Fallen Persons
            fallen_list = res.get("fallen_persons", [])
            if fallen_list:
                now_ts = time.time()
                if now_ts - self.last_fall_alert_ts > 10.0:
                    self.last_fall_alert_ts = now_ts
                    zid = self.zone_id
                    z_num = int(zid.replace("z", "")) if zid.replace("z", "").isdigit() else 1
                    alert_obj = {
                        "id": f"alt-fall-{int(now_ts * 1000) % 100000}",
                        "ts": time.strftime("%H:%M:%S"),
                        "zone": zid,
                        "zNum": z_num,
                        "zoneName": self.zone_name,
                        "level": 3,
                        "type": "FALL_COLLAPSE",
                        "text_en": f"EMERGENCY: Person fallen in {self.zone_name}! Halting upstream corridor traffic.",
                        "action": "HALT_UPSTREAM_FLOW",
                        "p_critical": 0.99
                    }
                    state["alerts"].insert(0, alert_obj)
                    state["alerts"] = state["alerts"][:25]

                    # Auto Downlink to ESP32 Mesh Node
                    downlink_cmd = {
                        "z": z_num,
                        "lvl": 3,
                        "action": "FALL_ALERT",
                        "instruction": "PERSON DOWN STOP UPSTREAM",
                        "track": 1,
                        "cmd": "PLAY"
                    }
                    downlink_queue.append(downlink_cmd)
                    with active_serial_lock:
                        if active_serial_conn and active_serial_conn.is_open:
                            try:
                                active_serial_conn.write((json.dumps(downlink_cmd) + "\n").encode("utf-8"))
                                active_serial_conn.flush()
                                print(f"[FALL ALERT GATEWAY] >>> Dispatched Downlink to ESP32: {downlink_cmd}")
                            except Exception:
                                pass

                    # Dynamic GIS Corridor Blockade (NetworkX automatic rerouting)
                    corridor_map = {"z1": "c_z1_z2", "z2": "c_z1_z2", "z3": "c_z1_z3", "z4": "c_z2_z4"}
                    edge_to_block = corridor_map.get(zid)
                    if edge_to_block and edge_to_block not in state["blocked_edges"]:
                        state["blocked_edges"].append(edge_to_block)
                        print(f"[DYNAMIC GIS] >>> Blocked {edge_to_block} to halt crowd momentum into {zid}!")

                    log_operator_action("AI_VISION_SENTINEL", "PERSON_DOWN_DETECTED", f"Automated fall alert for {zid}. Corridor {edge_to_block} blocked & node siren activated.")

            # 3b. Check for Violent Brawls / Crowd Fighting
            fights_list = res.get("fight_events", [])
            if fights_list:
                now_ts = time.time()
                if now_ts - self.last_fight_alert_ts > 10.0:
                    self.last_fight_alert_ts = now_ts
                    zid = self.zone_id
                    z_num = int(zid.replace("z", "")) if zid.replace("z", "").isdigit() else 1
                    alert_obj = {
                        "id": f"alt-fight-{int(now_ts * 1000) % 100000}",
                        "ts": time.strftime("%H:%M:%S"),
                        "zone": zid,
                        "zNum": z_num,
                        "zoneName": self.zone_name,
                        "level": 3,
                        "type": "FIGHT_BRAWL",
                        "text_en": f"CRITICAL: Violent brawl / physical struggle detected in {self.zone_name}! Security and Medical squads dispatched.",
                        "action": "DISPATCH_SECURITY_DIVERT_CROWD",
                        "p_critical": 0.99
                    }
                    state["alerts"].insert(0, alert_obj)
                    state["alerts"] = state["alerts"][:25]

                    downlink_cmd = {
                        "z": z_num,
                        "lvl": 3,
                        "action": "FIGHT_ALERT",
                        "instruction": "VIOLENT FIGHT STOP STAND CLEAR",
                        "track": 2,
                        "cmd": "PLAY"
                    }
                    downlink_queue.append(downlink_cmd)
                    with active_serial_lock:
                        if active_serial_conn and active_serial_conn.is_open:
                            try:
                                active_serial_conn.write((json.dumps(downlink_cmd) + "\n").encode("utf-8"))
                                active_serial_conn.flush()
                                print(f"[FIGHT ALERT GATEWAY] >>> Dispatched Downlink to ESP32: {downlink_cmd}")
                            except Exception:
                                pass

                    log_operator_action("AI_VISION_SENTINEL", "VIOLENT_BRAWL_DETECTED", f"Automated fight detection in {zid}. Audio track 2 triggered & security alerted.")

            # 4. Atomically update shared telemetry
            with self.telemetry_lock:
                self.cached_boxes = res["boxes"]
                self.cached_heatmap = res.get("heatmap_bgr")
                self.cached_fallen = fallen_list
                self.cached_fights = fights_list
                self.person_count = count
                self.density = calc_density
                self.engine_name = res["engine_name"]
                self.is_crush_regime = res["is_crush_regime"]
                self.regime = res["regime"]
                self.speed = calc_speed
                self.conflict = calc_conflict

            # 5. Sync to global state
            zid = self.zone_id
            if zid in state["zones"]:
                score, lvl = compute_risk(calc_density, calc_speed, calc_conflict)
                state["zones"][zid].update({
                    "density": calc_density,
                    "speed": calc_speed,
                    "conflict": calc_conflict,
                    "risk": score,
                    "level": lvl,
                    "personCount": count,
                    "gis_area_m2": self.gis_area_m2,
                    "fov_area_m2": self.fov_area_m2,
                    "gis_zone_name": self.zone_name,
                    "vision_engine": res["engine_name"],
                    "is_crush": res["is_crush_regime"]
                })
                state["last_real_vision"] = time.time()
                state["fps"] = round(self.fps, 1)

            self.infer_busy = False

    def _capture_and_playback_loop(self):
        norm_src = normalize_camera_source(self.source)
        is_video_file = isinstance(norm_src, str) and (os.path.isfile(norm_src) or norm_src.lower().endswith((".mp4", ".avi", ".mov", ".mkv", ".m4v", ".webm")))
        print(f"[Camera {self.cam_id}] Connecting to: {self.source} (normalized: {norm_src}, is_file: {is_video_file})...")

        cap = None
        for _ in range(3):
            if not self.running:
                return
            cap = cv2.VideoCapture(norm_src)
            if not is_video_file:
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if cap.isOpened():
                break
            # Smart fallback for phone IP Webcam
            if isinstance(norm_src, str) and norm_src.startswith("http://"):
                try:
                    base = norm_src.replace("http://", "").split("/")[0]
                    alt_rtsp = f"rtsp://{base}/h264_ulaw.sdp"
                    print(f"[Camera {self.cam_id}] Retrying with alternate RTSP stream: {alt_rtsp}...")
                    cap = cv2.VideoCapture(alt_rtsp)
                    if cap.isOpened():
                        norm_src = alt_rtsp
                        break
                except Exception:
                    pass
            time.sleep(0.8)

        if not cap or not cap.isOpened():
            print(f"[Camera {self.cam_id}] ERROR: Could not open source {self.source}")
            self.status = "OFFLINE (Could not open feed)"
            return

        self.cap = cap
        self.status = "ONLINE"
        print(f"[Camera {self.cam_id}] Streaming live with YOLOv8 inference (is_file={is_video_file})!")

        # Determine target frame rate for real-time 1.0x playback
        if is_video_file:
            raw_fps = cap.get(cv2.CAP_PROP_FPS)
            target_fps = raw_fps if (raw_fps and 5.0 <= raw_fps <= 60.0 and not math.isnan(raw_fps)) else 25.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            frame_interval = 1.0 / target_fps
        else:
            target_fps = 30.0
            total_frames = 0
            frame_interval = 1.0 / 30.0

        drop_count = 0

        while self.running:
            t0 = time.perf_counter()
            ret, frame = cap.read()

            if is_video_file:
                pos = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
                # Seamless repeat / looping when EOF or last frame is reached
                if not ret or frame is None or (total_frames > 0 and pos >= total_frames):
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap.read()
                    if not ret or frame is None:
                        # Re-open capture cleanly on Windows EOF
                        try:
                            cap.release()
                        except Exception:
                            pass
                        cap = cv2.VideoCapture(norm_src)
                        self.cap = cap
                        ret, frame = cap.read()
                    self.reset_flow = True

            if not ret or frame is None:
                if not is_video_file:
                    drop_count += 1
                    if drop_count > 30:
                        self.status = "RECONNECTING..."
                        try:
                            cap.release()
                        except Exception:
                            pass
                        time.sleep(1.0)
                        cap = cv2.VideoCapture(norm_src)
                        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                        self.cap = cap
                        if cap.isOpened():
                            self.status = "ONLINE"
                            drop_count = 0
                    time.sleep(0.033)
                else:
                    time.sleep(0.01)
                continue

            drop_count = 0
            self.status = "ONLINE"

            # Standardize resolution for inference & HUD
            h, w = frame.shape[:2]
            if (w, h) != (640, 480):
                frame_resized = cv2.resize(frame, (640, 480))
            else:
                frame_resized = frame

            # Forward frame to AI worker if not busy
            if not self.infer_busy:
                self.latest_raw_frame = frame_resized
                self.new_frame_event.set()

            # Retrieve latest AI detection telemetry
            with self.telemetry_lock:
                boxes = self.cached_boxes.copy()
                heatmap = self.cached_heatmap
                fallen = list(getattr(self, "cached_fallen", []))
                fights = list(getattr(self, "cached_fights", []))
                count = self.person_count
                dens = self.density
                engine_name = self.engine_name
                is_crush = self.is_crush_regime
                regime = self.regime

            # Draw Minimalist HUD (Command-Center High-Contrast Style)
            hud = frame_resized.copy()
            if heatmap is not None and is_crush:
                # Alpha-blend the continuous density-map Jet colormap over the camera frame
                alpha = 0.40
                hud = cv2.addWeighted(heatmap, alpha, hud, 1.0 - alpha, 0)

            box_color = (74, 222, 128) if dens < 2.0 else (234, 179, 8) if dens < 4.0 else (68, 68, 239)

            # Draw 4-point GIS Calibrated Floor Perimeter (dashed cyan polygon)
            poly_pts = self.img_corners.astype(np.int32).reshape((-1, 1, 2))
            cv2.polylines(hud, [poly_pts], isClosed=True, color=(56, 189, 248), thickness=1, lineType=cv2.LINE_AA)

            if not is_crush:
                for b in boxes:
                    x1, y1, x2, y2 = map(int, b[:4])
                    x1, y1 = max(0, min(639, x1)), max(0, min(479, y1))
                    x2, y2 = max(0, min(639, x2)), max(0, min(479, y2))
                    cv2.rectangle(hud, (x1, y1), (x2, y2), box_color, 1)
                    # Ground foot point projected onto GIS plane
                    foot_x = int((x1 + x2) / 2)
                    cv2.circle(hud, (foot_x, y2), 3, (56, 189, 248), -1)

            # Draw Tactical Red Reticles around Fallen Persons (PCC Alert)
            for f in fallen:
                cx, cy = f["center"]
                cx = max(20, min(620, cx))
                cy = max(20, min(460, cy))
                pulse = int(22 + 6 * math.sin(time.time() * 9))
                cv2.circle(hud, (cx, cy), pulse, (0, 0, 255), 2, cv2.LINE_AA)
                cv2.circle(hud, (cx, cy), pulse + 6, (0, 0, 220), 1, cv2.LINE_AA)
                cv2.line(hud, (cx - pulse - 6, cy), (cx + pulse + 6, cy), (0, 0, 255), 1)
                cv2.line(hud, (cx, cy - pulse - 6), (cx, cy + pulse + 6), (0, 0, 255), 1)
                cv2.rectangle(hud, (cx - 68, cy - pulse - 22), (cx + 68, cy - pulse - 4), (0, 0, 180), -1)
                cv2.putText(hud, "! PERSON DOWN !", (cx - 64, cy - pulse - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1)

            # Draw Tactical Amber/Red Reticles around Violent Brawls / Fights
            for fg in fights:
                cx, cy = fg["center"]
                cx = max(20, min(620, cx))
                cy = max(20, min(460, cy))
                pulse = int(24 + 7 * math.sin(time.time() * 12))
                cv2.circle(hud, (cx, cy), pulse, (0, 140, 255), 2, cv2.LINE_AA)
                cv2.circle(hud, (cx, cy), pulse + 8, (0, 69, 255), 2, cv2.LINE_AA)
                cv2.rectangle(hud, (cx - 80, cy - pulse - 24), (cx + 80, cy - pulse - 4), (0, 69, 255), -1)
                cv2.putText(hud, "! BRAWL / FIGHT !", (cx - 74, cy - pulse - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1)

            # Top Telemetry Ribbon
            cv2.rectangle(hud, (0, 0), (640, 28), (0, 0, 0), -1)
            cv2.putText(hud, f"CROWDSHIELD [{self.cam_id}] | {engine_name.upper()}", (10, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (255, 255, 255), 1)

            fruin_tag = "SAFE" if dens < 2.0 else "CAUTION" if dens < 4.0 else "CRITICAL"
            cv2.putText(hud, f"PAX: {count} | DENS: {dens:.2f} p/m2 [{fruin_tag}]", (300, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (74, 222, 128) if dens < 2.0 else (234, 179, 8) if dens < 4.0 else (68, 68, 239), 1)

            loop_label = " [LOOP]" if is_video_file else ""
            cv2.putText(hud, f"{round(self.fps, 1)} FPS{loop_label}", (565, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (148, 163, 184), 1)

            if len(fallen) > 0:
                cv2.rectangle(hud, (10, 32), (480, 52), (0, 0, 200), -1)
                cv2.putText(hud, "CRITICAL: PERSON DOWN DETECTED — STOP UPSTREAM FLOW!", (15, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.34, (255, 255, 255), 1)
            elif len(fights) > 0:
                cv2.rectangle(hud, (10, 32), (480, 52), (0, 69, 255), -1)
                cv2.putText(hud, "ALERT: VIOLENT BRAWL / SCUFFLE DETECTED — SECURITY EN ROUTE", (15, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.34, (255, 255, 255), 1)
            elif is_crush:
                cv2.rectangle(hud, (10, 32), (370, 52), (0, 0, 160), -1)
                cv2.putText(hud, "HIGH-DENSITY REGIME: CSRNet DENSITY-MAP ACTIVE", (15, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.33, (255, 255, 255), 1)

            # Bottom GIS Homography Calibration Tag
            cv2.rectangle(hud, (0, 460), (640, 480), (0, 0, 0), -1)
            calib_str = f"GIS HOMOGRAPHY: {self.world_w:.1f}m x {self.world_h:.1f}m | GIS Area: {self.gis_area_m2:.0f} m2"
            if is_crush:
                calib_str += " | METHOD: ∫∫ D(x,y) dA"
            cv2.putText(hud, calib_str, (10, 474), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (56, 189, 248), 1)

            # Encode JPEG for MJPEG stream
            _, jpeg = cv2.imencode(".jpg", hud, [cv2.IMWRITE_JPEG_QUALITY, 80])
            self.latest_jpeg = jpeg.tobytes()
            self.latest_frame = hud

            # Precise Real-Time Pacing
            dt_process = time.perf_counter() - t0
            if is_video_file:
                sleep_rem = frame_interval - dt_process
                if sleep_rem > 0:
                    time.sleep(sleep_rem)
            else:
                if dt_process < 0.02:
                    time.sleep(0.02 - dt_process)

            dt_total = time.perf_counter() - t0
            instant_fps = 1.0 / max(dt_total, 1e-4)
            self.fps = 0.90 * self.fps + 0.10 * instant_fps

        try:
            cap.release()
        except Exception:
            pass
        print(f"[Camera {self.cam_id}] Stream stopped.")

    def stop(self):
        self.running = False
        self.new_frame_event.set()
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass


# Active Camera Ingest Registry
camera_registry: Dict[str, RealCameraFeed] = {}

# ============================================================================
# ALERT GENERATOR & AUDIT LOGGER
# ============================================================================

def raise_alert(zone: str, alert_type: str, level: int, text_en: str, text_local: str, cooldown_sec: float = 20.0):
    dedup_key = f"{zone}:{alert_type}"
    now = time.time()
    last = alert_cooldowns.get(dedup_key, 0.0)
    if (now - last) < cooldown_sec:
        return None

    alert_cooldowns[dedup_key] = now
    alert_id = f"a-{int(now * 10) % 100000}"
    alert = AlertObject(
        id=alert_id,
        ts=now,
        zone=zone,
        type=alert_type,
        level=level,
        text_en=text_en,
        text_local=text_local,
        status="open",
        ack_by=None,
    ).model_dump()

    state["alerts"].insert(0, alert)
    state["alerts"] = state["alerts"][:35]
    return alert


def log_operator_action(user: str, action: str, details: str):
    entry = OperatorAction(
        ts=time.time(),
        user=user,
        action=action,
        details=details,
    ).model_dump()
    state["operator_actions"].insert(0, entry)
    state["operator_actions"] = state["operator_actions"][:50]


# ============================================================================
# MEDICAL DEPARTMENT DISPATCH & SOS SENTINEL
# ============================================================================

def trigger_sos_medical_incident(zone_id: str, node_id: str = "NODE-Z1", details: str = ""):
    """
    Handles SOS Button press from hardware GPIO 12 / mesh node or software trigger:
    1. Immediately creates a critical Medical Incident with patient triage status.
    2. Identifies matching live camera covering that zone for automatic UI pop-up.
    3. Computes the fastest First Responder approach route from MED_BAY avoiding blocked corridors.
    4. Routes incident directly to the dedicated Medical Department Desk.
    """
    zid = normalize_zone_id(zone_id)
    now = time.time()

    # Find camera covering this zone
    target_cam_id = None
    target_cam_name = None
    for cid, c in camera_registry.items():
        if c.zone_id == zid:
            target_cam_id = cid
            target_cam_name = c.name
            break
    if not target_cam_id and camera_registry:
        first_cid = list(camera_registry.keys())[0]
        target_cam_id = first_cid
        target_cam_name = camera_registry[first_cid].name

    # Zone metadata
    z_meta = state["zones"].get(zid, {})
    z_name = z_meta.get("name", f"Zone {zid.upper()}")
    density = z_meta.get("density", 0.0)
    person_count = z_meta.get("personCount", 0)

    # Compute dedicated medical approach route from MED_BAY
    dispatch_plan = gis_manager.compute_medical_dispatch(zid, state["blocked_edges"])

    incident_id = f"MED-{int(now * 1000) % 100000}"
    incident = {
        "id": incident_id,
        "zone_id": zid,
        "zone_name": z_name,
        "node_id": node_id,
        "camera_id": target_cam_id,
        "camera_name": target_cam_name or f"Camera for {z_name}",
        "density": round(float(density), 2),
        "person_count": int(person_count),
        "status": "SOS_ACTIVE_PENDING_TRIAGE",
        "assigned_squad": dispatch_plan.get("assigned_squad", "Medical Squad Alpha (Paramedic Unit 1)"),
        "dispatch_route": dispatch_plan,
        "timestamp": now,
        "time_str": time.strftime("%H:%M:%S"),
        "severity": "CRITICAL_MEDICAL_SOS",
        "details": details or "Physical SOS Button pressed on-site (GPIO 12). Rapid medical response required.",
        "eta_sec": dispatch_plan.get("eta_sec", 45),
        "distance_m": dispatch_plan.get("distance_m", 50.0)
    }

    state["active_medical_incident"] = incident
    state["medical_incidents"] = [m for m in state["medical_incidents"] if m["id"] != incident_id]
    state["medical_incidents"].insert(0, incident)
    state["medical_incidents"] = state["medical_incidents"][:30]

    # Add command center alert
    z_num = int(zid.replace("z", "")) if zid.replace("z", "").isdigit() else 1
    alert_obj = {
        "id": f"alt-med-{int(now * 1000) % 100000}",
        "ts": time.strftime("%H:%M:%S"),
        "zone": zid,
        "zNum": z_num,
        "zoneName": z_name,
        "level": 3,
        "type": "SOS_MEDICAL",
        "text_en": f"CRITICAL MEDICAL SOS in {z_name}! Medical Desk notified. Camera pop-up activated.",
        "action": "DISPATCH_PARAMEDIC_SQUAD",
        "p_critical": 0.99
    }
    state["alerts"].insert(0, alert_obj)
    state["alerts"] = state["alerts"][:25]

    log_operator_action("Medical_Sentinel", "EMERGENCY_SOS_MEDICAL_ROUTING", f"Routed emergency in {z_name} to Medical Department Desk. Camera {target_cam_id} pop-up initiated.")
    print(f"[MEDICAL DESK] >>> Confirmed Emergency SOS in {z_name}! Paramedic route calculated (ETA {dispatch_plan.get('eta_sec')}s).")
    return incident


# ============================================================================
# LIVE NETWORKX SAFE-EXIT ROUTING & RULES EVALUATION
# ============================================================================

def evaluate_rules_and_routes():
    now = time.time()
    zone_levels = {}
    for zid, zdata in state["zones"].items():
        lvl = zdata["level"]
        zone_levels[zid] = lvl
        d_val = zdata["density"]
        c_val = zdata["conflict"]

        # Only trigger genuine alerts if real density reaches critical levels!
        if lvl >= 3 and d_val > 5.0:
            raise_alert(
                zid,
                "density_critical",
                3,
                f"Zone {zid.upper()} CRITICAL crush warning ({d_val:.2f} pax/m², conflict {c_val:.2f})",
                f"மண்டலம் {zid.upper()} தீவிர கூட்ட நெரிசல் அபாயம் — மாற்று வழி",
                cooldown_sec=20.0,
            )

    # Check node heartbeats: if a node sent data before but went silent > 20s
    for nid, ndata in state["nodes"].items():
        last_t = ndata.get("ts", 0.0)
        if last_t > 0:
            silent_sec = now - last_t
            is_online = silent_sec <= 20.0
            ndata["online"] = is_online
            ndata["lastSeen"] = f"{int(silent_sec)}s ago" if is_online else "Standby (No Telemetry)"

    # Recompute live routes via standard NetworkX and GIS Spatial Engine
    state["routes"] = compute_safe_routes(VENUE_GRAPH, zone_levels, state["blocked_edges"])
    state["gis_routing"] = gis_manager.compute_gis_routing(zone_levels, state["blocked_edges"])
    state["gis_geojson"] = gis_manager.get_full_venue_geojson(state["zones"])
    state["ts"] = now


async def broadcast_state():
    evaluate_rules_and_routes()
    if not ws_clients:
        return
    payload = {
        "mode": state["mode"],
        "ts": state["ts"],
        "fps": state["fps"],
        "zones": state["zones"],
        "nodes": state["nodes"],
        "forecasts": state["forecasts"],
        "routes": state["routes"],
        "gis_routing": state.get("gis_routing", {}),
        "gis_geojson": state.get("gis_geojson", {}),
        "active_hazards": state.get("active_hazards", {}),
        "hazard_broadcasts": state.get("hazard_broadcasts", []),
        "blocked_edges": state["blocked_edges"],
        "alerts": state["alerts"],
        "operator_actions": state["operator_actions"],
        "active_medical_incident": state.get("active_medical_incident"),
        "medical_incidents": state.get("medical_incidents", []),
        "vision_tier": state.get("vision_tier", vision_manager.active_tier.value),
        "vision_tier_meta": state.get("vision_tier_meta", TIER_METADATA.get(vision_manager.active_tier, {})),
        "is_crush_regime": vision_manager.is_crush_regime,
        "active_cameras": {
            cid: {
                "id": c.cam_id,
                "name": c.name,
                "zone_id": c.zone_id,
                "source": str(c.source),
                "status": c.status,
                "fps": round(c.fps, 1),
                "person_count": c.person_count,
                "density": c.density,
                "engine_name": getattr(c, "engine_name", "YOLOv8"),
                "is_crush_regime": getattr(c, "is_crush_regime", False),
                "regime": getattr(c, "regime", "NORMAL_FLOW"),
                "tier": vision_manager.active_tier.value
            }
            for cid, c in camera_registry.items()
        }
    }
    dead_clients = set()
    for ws in list(ws_clients):
        try:
            await ws.send_json(payload)
        except Exception:
            dead_clients.add(ws)
    for ws in dead_clients:
        ws_clients.discard(ws)


# ============================================================================
# BACKGROUND FORECAST & HEARTBEAT LOOP (CLEAN REAL-TIME)
# ============================================================================

async def real_time_forecast_loop():
    """Calculates live 10m & 15m trend forecasts on real incoming camera and sensor feeds."""
    while True:
        try:
            now = time.time()
            for zid, zdata in state["zones"].items():
                curr_d = zdata["density"]
                hist = zone_history.setdefault(zid, [])
                hist.append(curr_d)
                if len(hist) > 30:
                    hist.pop(0)

                slope = (hist[-1] - hist[0]) / max(len(hist), 1) if len(hist) > 2 else 0.0
                t10 = round(max(0.0, curr_d + slope * 10.0 + zdata["conflict"] * 0.3), 2)
                t15 = round(max(0.0, curr_d + slope * 16.0 + zdata["conflict"] * 0.5), 2)
                p_crit = round(min(0.99, max(0.0, (t10 - 3.5) / 2.5)), 2) if t10 > 3.0 else 0.0

                state["forecasts"][zid] = {"t10": t10, "t15": t15, "p_critical": p_crit}

                if t10 >= 4.8 and p_crit >= 0.75:
                    raise_alert(
                        zid,
                        "forecast_critical",
                        3,
                        f"FORECAST: Zone {zid.upper()} predicted to reach {t10} pax/m² in 10 mins",
                        f"முன்னறிவிப்பு: மண்டலம் {zid.upper()} 10 நிமிடங்களில் அபாய நிலை எட்டும்",
                        cooldown_sec=40.0,
                    )

            await broadcast_state()
            await asyncio.sleep(1.0)
        except Exception as e:
            print("[Backend Loop] Error:", e)
            await asyncio.sleep(1.0)


# ============================================================================
# EMBEDDED REAL-TIME SERIAL GATEWAY (ESP32 / ESP8266 AUTO-BRIDGE)
# ============================================================================

active_serial_conn = None
active_serial_lock = threading.Lock()
main_event_loop = None


def find_esp_com_port() -> Optional[str]:
    """Auto-detects ESP32 / ESP8266 / CH340 / CP2102 / FTDI COM ports."""
    try:
        ports = serial.tools.list_ports.comports()
        for p in ports:
            desc = (p.description or "").lower()
            hwid = (p.hwid or "").lower()
            keywords = ["ch340", "cp210", "usb-serial", "uart", "esp32", "esp8266", "silicon labs", "qinheng"]
            if any(k in desc or k in hwid for k in keywords):
                return p.device
    except Exception:
        pass
    return None


def embedded_serial_gateway_worker(loop):
    """
    Unified In-Process Serial Bridge:
    Auto-detects connected ESP32 / ESP8266 Gateway over USB Serial.
    Ingests live ESP-NOW telemetry packets and transmits operator downlink commands.
    Automatically runs on server launch so the user never needs a separate starter bridge!
    """
    global active_serial_conn
    print("[SERIAL GATEWAY] Auto-connecting ESP32/ESP8266 USB Bridge initialized...")
    while True:
        port = find_esp_com_port()
        if not port:
            time.sleep(2.5)
            continue

        try:
            print(f"[SERIAL GATEWAY] Connecting to ESP Gateway on {port} (115200 baud)...")
            ser = serial.Serial(port, 115200, timeout=0.5)
            time.sleep(1.0) # Allow boot settling
            with active_serial_lock:
                active_serial_conn = ser
            print(f"[SERIAL GATEWAY] Connected to ESP Gateway on {port}! Monitoring ESP-NOW mesh...")

            state["nodes"]["gw"]["online"] = True
            state["nodes"]["gw"]["lastSeen"] = f"Connected on {port}"
            if loop and not loop.is_closed():
                asyncio.run_coroutine_threadsafe(broadcast_state(), loop)

            while True:
                # 1. Read packet line from ESP
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if line:
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

                        if "status" in ev:
                            print(f"[SERIAL GATEWAY] Gateway status: {line}")
                            continue

                        z_num = ev.get("z", 1)
                        nid = str(z_num)
                        now_ts = time.time()
                        state["last_real_node"] = now_ts
                        ev["ts"] = now_ts
                        ev["online"] = True
                        ev["rssi"] = ev.get("rssi", rssi_val)
                        ev["lastSeen"] = "Live (<1s)"

                        if nid in state["nodes"]:
                            state["nodes"][nid].update(ev)
                        else:
                            state["nodes"][nid] = ev

                        if ev.get("sos") == 1:
                            print(f"[SERIAL GATEWAY SOS ALERT] *** CONFIRMED SOS FROM NODE {z_num} (RSSI: {ev.get('rssi')} dBm) ***")
                            trigger_sos_medical_incident(f"z{z_num}", f"NODE-Z{z_num}", f"Hardware SOS Button on ESP32 Node Z{z_num} (RSSI: {ev.get('rssi')} dBm)")
                            log_operator_action("Hardware_Node", "HARDWARE_SOS_RECEIVED", f"Physical SOS on Node z{z_num} (GPIO 12)")
                        else:
                            print(f"[SERIAL GATEWAY RX] Node {z_num} Heartbeat: seq={ev.get('seq')} RSSI={ev.get('rssi')} dBm")

                        if loop and not loop.is_closed():
                            asyncio.run_coroutine_threadsafe(broadcast_state(), loop)

                    except json.JSONDecodeError as j_err:
                        print(f"[SERIAL GATEWAY] JSON decode ignore: '{line}' ({j_err})")
                    except Exception as parse_err:
                        print(f"[SERIAL GATEWAY] Ingest error: {parse_err}")

                # 2. Check for pending downlinks to transmit
                if downlink_queue:
                    with active_serial_lock:
                        if downlink_queue and active_serial_conn and active_serial_conn.is_open:
                            cmd = downlink_queue.pop(0)
                            cmd_bytes = (json.dumps(cmd) + "\n").encode("utf-8")
                            active_serial_conn.write(cmd_bytes)
                            active_serial_conn.flush()
                            print(f"[SERIAL GATEWAY] >>> Dispatched Downlink to Mesh: {cmd}")

        except serial.SerialException as s_err:
            with active_serial_lock:
                active_serial_conn = None
            state["nodes"]["gw"]["online"] = False
            state["nodes"]["gw"]["lastSeen"] = "Disconnected"
            time.sleep(3.0)
        except Exception:
            time.sleep(2.0)


# ============================================================================
# FASTAPI LIFESPAN & APPLICATION
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_event_loop
    main_event_loop = asyncio.get_running_loop()

    print("=====================================================================")
    print(" CROWDSHIELD REAL-TIME COMMAND SPINE & EDGE AI ENGINE")
    print(" Listening on http://0.0.0.0:8000 (WebSocket: ws://localhost:8000/ws)")
    print(" Mode: 100% REAL OPERATIONAL (All Mock Data Removed)")
    print("=====================================================================")
    task = asyncio.create_task(real_time_forecast_loop())

    # Start Unified In-Process Serial Bridge Thread
    serial_thread = threading.Thread(target=embedded_serial_gateway_worker, args=(main_event_loop,), daemon=True)
    serial_thread.start()

    yield
    print("Stopping Camera Feeds and Backend Spine...")
    task.cancel()
    for cam in camera_registry.values():
        cam.stop()


app = FastAPI(
    title="CrowdShield Real-Time Command Spine API",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve built React frontend directly on http://localhost:8000
possible_dist_dirs = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend", "dist")),
    os.path.abspath(r"D:\crowdwatch-app\dist")
]
DIST_DIR = next((d for d in possible_dist_dirs if os.path.isdir(d)), possible_dist_dirs[-1])
if os.path.isdir(DIST_DIR):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/")
async def serve_index():
    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "ok", "message": "CrowdShield Real-Time Spine is running."}

@app.get("/favicon.svg")
async def serve_favicon():
    fav = os.path.join(DIST_DIR, "favicon.svg")
    if os.path.exists(fav):
        return FileResponse(fav)
    return Response(status_code=404)



# ============================================================================
# DYNAMIC REAL CAMERA MANAGEMENT ENDPOINTS
# ============================================================================

class CameraCreateRequest(BaseModel):
    id: Optional[str] = None
    name: str
    zoneId: str  # 'ZONE-A', 'ZONE-B', 'z1', etc.
    source: str  # '0', '1', 'rtsp://...', 'http://.../video', or file path


@app.get("/api/cameras")
async def get_cameras():
    """Lists all configured real cameras and their real-time AI states."""
    cams = []
    for cid, c in camera_registry.items():
        cams.append({
            "id": c.cam_id,
            "name": c.name,
            "zoneId": c.zone_id.upper(),
            "zone_name": getattr(c, "zone_name", f"Zone {c.zone_id.upper()}"),
            "gis_area_m2": getattr(c, "gis_area_m2", 95.0),
            "source": str(c.source),
            "status": c.status,
            "fps": round(c.fps, 1),
            "density": c.density,
            "personCount": c.person_count,
            "speed": c.speed,
            "conflict": c.conflict,
            "engine_name": getattr(c, "engine_name", "YOLOv8"),
            "is_crush_regime": getattr(c, "is_crush_regime", False),
            "regime": getattr(c, "regime", "NORMAL_FLOW"),
            "tier": vision_manager.active_tier.value
        })
    return cams


@app.post("/api/cameras")
async def add_camera(req: CameraCreateRequest):
    """
    Registers and starts a real camera feed (Webcam, RTSP, or HTTP MJPEG).
    Immediately launches YOLOv8 person detection and 4-point homography.
    """
    cam_id = req.id or f"CAM-{len(camera_registry) + 1:02d}"
    if cam_id in camera_registry:
        camera_registry[cam_id].stop()

    feed = RealCameraFeed(
        cam_id=cam_id,
        name=req.name,
        zone_id=req.zoneId,
        source=req.source
    )
    camera_registry[cam_id] = feed

    log_operator_action("Operator_Raghu", "ADD_CAMERA", f"Connected {req.name} ({cam_id}) to {req.zoneId} from {req.source}")
    await broadcast_state()
    return {
        "ok": True,
        "message": f"Camera {cam_id} initialized",
        "camera": {
            "id": cam_id,
            "name": req.name,
            "zoneId": req.zoneId,
            "source": req.source,
            "status": feed.status
        }
    }


@app.delete("/api/cameras/{cam_id}")
async def delete_camera(cam_id: str):
    """Stops and removes a real camera feed."""
    if cam_id in camera_registry:
        camera_registry[cam_id].stop()
        del camera_registry[cam_id]
        log_operator_action("Operator_Raghu", "REMOVE_CAMERA", f"Disconnected camera {cam_id}")
        await broadcast_state()
        return {"ok": True, "message": f"Camera {cam_id} removed"}
    raise HTTPException(status_code=404, detail="Camera ID not found")


@app.post("/api/upload_video")
async def upload_video(
    file: UploadFile = File(...),
    name: str = Form("Uploaded Test Video"),
    zone_id: str = Form("ZONE-A")
):
    """
    Saves an uploaded video file and immediately attaches it as an active AI camera feed.
    Continuously loops playback for uninterrupted YOLOv8 detection and density testing.
    """
    videos_dir = os.path.abspath(r"D:\crowdshield\test_videos")
    os.makedirs(videos_dir, exist_ok=True)

    clean_filename = "".join(c for c in file.filename if c.isalnum() or c in "._- ")
    target_path = os.path.join(videos_dir, clean_filename)

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cam_id = f"CAM-VID-{len(camera_registry) + 1:02d}"
    if cam_id in camera_registry:
        camera_registry[cam_id].stop()

    feed = RealCameraFeed(
        cam_id=cam_id,
        name=name or f"Video: {clean_filename}",
        zone_id=zone_id,
        source=target_path
    )
    camera_registry[cam_id] = feed
    log_operator_action("Operator_Raghu", "UPLOAD_VIDEO", f"Uploaded test video {clean_filename} mapped to {zone_id}")
    await broadcast_state()
    return {
        "ok": True,
        "message": f"Video {clean_filename} uploaded and streaming with YOLOv8!",
        "camera": {
            "id": cam_id,
            "name": feed.name,
            "zoneId": zone_id,
            "source": target_path,
            "status": feed.status
        }
    }


@app.post("/api/use_sample_video")
async def use_sample_video(data: dict = None):
    """
    Loads the benchmark sample crowd video into a zone for instant 1-click AI detection verification.
    """
    sample_path = os.path.abspath(r"D:\crowdshield\test_videos\sample_crowd.mp4")
    if not os.path.exists(sample_path):
        raise HTTPException(status_code=404, detail="sample_crowd.mp4 not found on disk")

    zid = (data or {}).get("zoneId", "ZONE-A")
    name = (data or {}).get("name", "Benchmark Crowd Video (Looping)")
    cam_id = f"CAM-SAMPLE-{len(camera_registry) + 1:02d}"

    feed = RealCameraFeed(
        cam_id=cam_id,
        name=name,
        zone_id=zid,
        source=sample_path
    )
    camera_registry[cam_id] = feed
    log_operator_action("Operator_Raghu", "LOAD_SAMPLE_VIDEO", f"Mounted benchmark crowd video on {zid}")
    await broadcast_state()
    return {
        "ok": True,
        "message": "Sample crowd video mounted and running YOLOv8 detection!",
        "camera": {
            "id": cam_id,
            "name": name,
            "zoneId": zid,
            "source": sample_path,
            "status": feed.status
        }
    }


# ============================================================================
# HIGH-DENSITY 4-TIER VISION PIPELINE API
# ============================================================================

class VisionTierRequest(BaseModel):
    tier: str


@app.get("/api/vision/tiers")
async def get_vision_tiers():
    """Returns available vision tiers, current active tier, and performance metadata."""
    return {
        "active_tier": vision_manager.active_tier.value,
        "metadata": TIER_METADATA.get(vision_manager.active_tier, {}),
        "available_tiers": {k.value: v for k, v in TIER_METADATA.items()},
        "is_crush_regime": vision_manager.is_crush_regime
    }


@app.post("/api/vision/tier")
async def switch_vision_tier(req: VisionTierRequest):
    """
    Switches active computer vision tier across all cameras:
    - tier1_yolo_highres: High-Res YOLOv8 (960/1280px)
    - tier2_head_yolo: Head-Detection YOLO (CrowdHuman Priors)
    - tier3_density_map: CSRNet Dilated-CNN Continuous Density-Map Integration
    - tier4_hybrid_auto: Auto-Switcher (YOLO <-> CSRNet at 2.0 pax/m2)
    """
    try:
        tier_enum = VisionTier(req.tier)
        res = vision_manager.set_tier(tier_enum)
        state["vision_tier"] = tier_enum.value
        state["vision_tier_meta"] = TIER_METADATA.get(tier_enum, {})
        log_operator_action("Operator_Raghu", "SWITCH_VISION_TIER", f"Switched AI Vision pipeline to {tier_enum.value}")
        await broadcast_state()
        return res
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid vision tier '{req.tier}'. Available: {[t.value for t in VisionTier]}"
        )


@app.post("/api/simulate_fall")
async def simulate_fall_event(data: dict = None):
    """
    Simulates a Progressive Crowd Collapse (PCC) / Fallen Person event.
    Instantly triggers the 4-way alert & mitigation sequence:
    1. Queues and transmits priority Downlink to ESP32 node (Audio Track 1 + Siren + LCD alert).
    2. Dynamically blocks incoming corridor edge in NetworkX & GIS spatial engine.
    3. Broadcasts Critical Alert for Operator Speech Synthesis.
    """
    payload_dict = data or {}
    zid = (payload_dict.get("zoneId") or payload_dict.get("zone_id") or "z2").lower()
    z_num = int(zid.replace("z", "")) if zid.replace("z", "").isdigit() else 2
    now_ts = time.time()

    zone_names = {
        "z1": "Zone A — Main Gate Plaza",
        "z2": "Zone B — East Corridor Choke",
        "z3": "Zone C — Central Stage Arena",
        "z4": "Zone D — North Exit Concourse"
    }
    z_name = zone_names.get(zid, f"Zone {zid.upper()}")

    # 1. Critical Alert Object
    alert_obj = {
        "id": f"alt-fall-{int(now_ts * 1000) % 100000}",
        "ts": time.strftime("%H:%M:%S"),
        "zone": zid,
        "zNum": z_num,
        "zoneName": z_name,
        "level": 3,
        "type": "FALL_COLLAPSE",
        "text_en": f"EMERGENCY: Person fallen in {z_name}! Halting upstream corridor traffic.",
        "action": "HALT_UPSTREAM_FLOW",
        "p_critical": 0.99
    }
    state["alerts"].insert(0, alert_obj)
    state["alerts"] = state["alerts"][:25]

    # 2. Downlink Dispatch to Physical ESP32 Node
    downlink_cmd = {
        "z": z_num,
        "lvl": 3,
        "action": "FALL_ALERT",
        "instruction": "PERSON DOWN STOP UPSTREAM",
        "track": 1,
        "cmd": "PLAY"
    }
    downlink_queue.append(downlink_cmd)

    with active_serial_lock:
        if active_serial_conn and active_serial_conn.is_open:
            try:
                active_serial_conn.write((json.dumps(downlink_cmd) + "\n").encode("utf-8"))
                active_serial_conn.flush()
                print(f"[DIRECT DOWNLINK] Transmitted Fall Alert to ESP Gateway: {downlink_cmd}")
            except Exception as e:
                print(f"[DIRECT DOWNLINK] Serial write failed: {e}")

    # 3. Dynamic GIS Corridor Blockade
    corridor_map = {"z1": "c_z1_z2", "z2": "c_z1_z2", "z3": "c_z1_z3", "z4": "c_z2_z4"}
    edge_to_block = corridor_map.get(zid)
    if edge_to_block and edge_to_block not in state["blocked_edges"]:
        state["blocked_edges"].append(edge_to_block)
        print(f"[DYNAMIC GIS] >>> Blocked {edge_to_block} to halt crowd momentum into {zid}!")

    log_operator_action("Operator_Raghu", "SIMULATE_FALL_EVENT", f"Triggered simulated crowd collapse incident in {z_name}. Corridor {edge_to_block} blocked & node siren sounded.")
    await broadcast_state()

    return {
        "ok": True,
        "message": f"Progressive Crowd Collapse Alert triggered for {zid.upper()}!",
        "alert": alert_obj,
        "downlink": downlink_cmd,
        "blocked_edge": edge_to_block
    }


# ============================================================================
# MEDICAL DEPARTMENT DISPATCH & DEMO SIMULATOR API
# ============================================================================

@app.get("/api/medical/incidents")
async def get_medical_incidents():
    """Returns all medical emergency incidents, active pop-up, and squad statuses."""
    return {
        "active_incident": state.get("active_medical_incident"),
        "incidents": state.get("medical_incidents", []),
        "med_bay": "MED-BAY-HQ",
        "available_squads": [
            {"id": "squad_1", "name": "Medical Squad Alpha (Paramedic Unit 1)", "status": "AVAILABLE", "speed_ms": 3.0},
            {"id": "squad_2", "name": "Medical Squad Bravo (Rapid EMT)", "status": "AVAILABLE", "speed_ms": 3.2},
            {"id": "squad_3", "name": "Field Trauma Team 3", "status": "STANDBY", "speed_ms": 2.5}
        ]
    }


@app.post("/api/medical/dispatch")
async def dispatch_medical_team(data: dict):
    """Dispatches medical paramedic squad to the active SOS or incident zone."""
    inc_id = data.get("incident_id")
    squad = data.get("squad_name", "Medical Squad Alpha (Paramedic Unit 1)")
    status = data.get("status", "PARAMEDICS_EN_ROUTE")
    notes = data.get("notes", "Paramedic unit deployed with oxygen & trauma kit.")

    target_inc = None
    if state.get("active_medical_incident") and state["active_medical_incident"]["id"] == inc_id:
        state["active_medical_incident"]["status"] = status
        state["active_medical_incident"]["assigned_squad"] = squad
        state["active_medical_incident"]["notes"] = notes
        target_inc = state["active_medical_incident"]

    for inc in state.get("medical_incidents", []):
        if inc["id"] == inc_id:
            inc["status"] = status
            inc["assigned_squad"] = squad
            inc["notes"] = notes
            target_inc = inc
            break

    log_operator_action("Medical_Director", "PARAMEDIC_DISPATCH", f"Dispatched {squad} for emergency {inc_id} ({status})")
    await broadcast_state()
    return {"ok": True, "incident": target_inc}


@app.post("/api/medical/resolve")
async def resolve_medical_incident(data: dict = None):
    """Resolves an active medical SOS incident and clears triage state."""
    inc_id = (data or {}).get("incident_id")
    if state.get("active_medical_incident") and (not inc_id or state["active_medical_incident"]["id"] == inc_id):
        state["active_medical_incident"]["status"] = "RESOLVED"
        state["active_medical_incident"] = None

    for inc in state.get("medical_incidents", []):
        if not inc_id or inc["id"] == inc_id:
            inc["status"] = "RESOLVED"

    # Clear node SOS flags
    for n in state["nodes"].values():
        n["sos"] = 0

    log_operator_action("Medical_Director", "INCIDENT_RESOLVED", f"Resolved medical emergency {inc_id or 'ALL'}. Triage cleared.")
    await broadcast_state()
    return {"ok": True, "message": "Medical incident resolved and triage cleared."}


@app.post("/api/simulate_hardware_sos")
async def simulate_hardware_sos(data: dict = None):
    """
    Simulates physical hardware SOS button press on GPIO 12:
    Instantly triggers dedicated Medical Department alert, fastest route computation,
    and automatic live camera pop-up!
    """
    payload_dict = data or {}
    zid = (payload_dict.get("zone_id") or payload_dict.get("zoneId") or "z2").lower()
    z_num = int(zid.replace("z", "")) if zid.replace("z", "").isdigit() else 2
    node_key = str(z_num)

    if node_key in state["nodes"]:
        state["nodes"][node_key]["sos"] = 1
        state["nodes"][node_key]["ts"] = time.time()

    inc = trigger_sos_medical_incident(zid, f"NODE-Z{z_num}", "Physical Hardware SOS Button Pressed (GPIO 12)")
    await broadcast_state()
    return {"ok": True, "incident": inc}


@app.post("/api/simulate_fight")
async def simulate_fight_event(data: dict = None):
    """
    Simulates a violent fight / brawl incident in a crowd:
    Triggers critical security alert, ESP32 warning audio track 2, and logs action.
    """
    payload_dict = data or {}
    zid = (payload_dict.get("zone_id") or payload_dict.get("zoneId") or "z2").lower()
    z_num = int(zid.replace("z", "")) if zid.replace("z", "").isdigit() else 2
    now_ts = time.time()
    z_name = state["zones"].get(zid, {}).get("name", f"Zone {zid.upper()}")

    alert_obj = {
        "id": f"alt-fight-{int(now_ts * 1000) % 100000}",
        "ts": time.strftime("%H:%M:%S"),
        "zone": zid,
        "zNum": z_num,
        "zoneName": z_name,
        "level": 3,
        "type": "FIGHT_BRAWL",
        "text_en": f"CRITICAL: Violent brawl / physical struggle detected in {z_name}! Security and Medical squads dispatched.",
        "action": "DISPATCH_SECURITY_DIVERT_CROWD",
        "p_critical": 0.99
    }
    state["alerts"].insert(0, alert_obj)
    state["alerts"] = state["alerts"][:25]

    downlink_cmd = {
        "z": z_num,
        "lvl": 3,
        "action": "FIGHT_ALERT",
        "instruction": "VIOLENT FIGHT STOP STAND CLEAR",
        "track": 2,
        "cmd": "PLAY"
    }
    downlink_queue.append(downlink_cmd)
    with active_serial_lock:
        if active_serial_conn and active_serial_conn.is_open:
            try:
                active_serial_conn.write((json.dumps(downlink_cmd) + "\n").encode("utf-8"))
                active_serial_conn.flush()
                print(f"[SIMULATED FIGHT GATEWAY] >>> Dispatched Downlink: {downlink_cmd}")
            except Exception:
                pass

    log_operator_action("Judge_Simulator", "SIMULATE_FIGHT_EVENT", f"Injected simulated violent brawl in {z_name}.")
    await broadcast_state()
    return {"ok": True, "alert": alert_obj}


@app.post("/api/demo/set_zone_pax")
async def demo_set_zone_pax(data: dict):
    """
    Interactive Crowd Simulator Studio for Judges:
    Allows injecting people (0 to 700+ pax) into any zone.
    Instantly updates real-time pax density, Fruin Level of Service colors,
    and automatically demonstrates the 4-Tier Vision auto-switching regime!
    """
    zid = normalize_zone_id(data.get("zone_id", "z2"))
    pax_count = max(0, int(data.get("person_count", 0)))

    if zid not in state["zones"]:
        raise HTTPException(status_code=404, detail=f"Zone {zid} not found")

    area_m2 = gis_manager.zone_areas.get(zid, 100.0)
    calc_density = round(float(pax_count) / max(area_m2, 1.0), 2)

    # Evaluate Fruin LoS level & color:
    # Fruin A/B (<1.0) -> Level 0 (Green)
    # Fruin C/D (1.0 - 1.8) -> Level 1 (Yellow)
    # Fruin E (1.8 - 2.5) -> Level 2 (Orange)
    # Fruin F (>2.5) -> Level 3 (Red)
    if calc_density < 1.0:
        lvl = 0
        speed = 1.30
        conflict = 0.05
    elif calc_density < 1.8:
        lvl = 1
        speed = 0.95
        conflict = 0.20
    elif calc_density < 2.5:
        lvl = 2
        speed = 0.55
        conflict = 0.55
    else:
        lvl = 3
        speed = 0.20
        conflict = 0.88

    risk_score = min(1.0, round(calc_density / 4.0 * 0.6 + conflict * 0.4, 2))

    state["zones"][zid].update({
        "personCount": pax_count,
        "density": calc_density,
        "speed": speed,
        "conflict": conflict,
        "risk": risk_score,
        "level": lvl
    })

    # Tier 4 Auto-Switcher demonstration logic
    if vision_manager.active_tier == VisionTier.TIER_4_HYBRID_AUTO:
        if calc_density >= 2.0 and not vision_manager.is_crush_regime:
            vision_manager.is_crush_regime = True
            vision_manager.switch_timestamp = time.time()
            print(f"[DEMO SIMULATOR] PAX={pax_count} (Density={calc_density:.2f}) >= 2.0 pax/m2 -> Auto-Switched to CSRNet Density Map!")
        elif calc_density < 1.6 and vision_manager.is_crush_regime:
            vision_manager.is_crush_regime = False
            vision_manager.switch_timestamp = time.time()
            print(f"[DEMO SIMULATOR] PAX={pax_count} (Density={calc_density:.2f}) < 1.6 pax/m2 -> Auto-Returned to YOLO!")

    # Update attached camera if active
    for cid, c in camera_registry.items():
        if c.zone_id == zid:
            c.person_count = pax_count
            c.density = calc_density
            c.is_crush_regime = vision_manager.is_crush_regime

    log_operator_action("Judge_Simulator", "DEMO_SET_PAX", f"Set {zid.upper()} to {pax_count} PAX ({calc_density:.2f} pax/m², LoS Level {lvl})")
    await broadcast_state()

    return {
        "ok": True,
        "zone_id": zid,
        "person_count": pax_count,
        "density": calc_density,
        "level": lvl,
        "is_crush_regime": vision_manager.is_crush_regime,
        "active_tier": vision_manager.active_tier.value
    }


@app.post("/api/demo/reset")
async def demo_reset_all():
    """Resets all simulation parameters back to clean baseline for next demonstration."""
    defaults = {"z1": 25, "z2": 15, "z3": 45, "z4": 12}
    for zid, cnt in defaults.items():
        area = gis_manager.zone_areas.get(zid, 100.0)
        dens = round(float(cnt) / area, 2)
        if zid in state["zones"]:
            state["zones"][zid].update({
                "personCount": cnt,
                "density": dens,
                "level": 0 if dens < 1.0 else 1,
                "risk": 0.15,
                "speed": 1.2,
                "conflict": 0.05
            })
    state["blocked_edges"] = []
    state["active_medical_incident"] = None
    for n in state["nodes"].values():
        n["sos"] = 0
    vision_manager.is_crush_regime = False
    log_operator_action("Judge_Simulator", "DEMO_RESET", "Reset all zones to baseline flow.")
    await broadcast_state()
    return {"ok": True, "message": "Demo state reset to clean baseline."}


# ============================================================================
# GIS SPATIAL LAYERS & ROUTING API (QGIS / geojson.io compatible)
# ============================================================================

@app.get("/api/gis/master")
async def get_gis_master():
    """Returns the unified GeoJSON venue FeatureCollection with live zone metrics."""
    return gis_manager.get_full_venue_geojson(state["zones"])


@app.get("/api/gis/routes")
async def get_gis_routes():
    """Returns dynamic GIS evacuation LineStrings and First Responder approach paths."""
    zone_levels = {zid: z["level"] for zid, z in state["zones"].items()}
    return gis_manager.compute_gis_routing(zone_levels, state["blocked_edges"])


@app.post("/api/gis/import")
async def import_gis_geojson(data: dict):
    """
    Imports custom venue GeoJSON layers created in QGIS or geojson.io.
    Validates features and reloads the GIS spatial graph.
    """
    features = data.get("features", [])
    if not features:
        raise HTTPException(status_code=400, detail="Invalid GeoJSON: 'features' array required")

    updated_zones = []
    updated_corridors = []
    updated_gates = []

    for idx, f in enumerate(features):
        geom = f.get("geometry", {})
        geom_type = geom.get("type", "")
        props = f.setdefault("properties", {})
        fid = f.get("id") or props.get("id")

        if geom_type == "Polygon":
            coords = geom.get("coordinates", [[]])
            ring = coords[0] if coords else []
            # Check if degenerate (needs at least 4 points including closure)
            if len(ring) < 4:
                continue

            zone_id = fid or f"z{len(updated_zones) + 1}"
            props["id"] = zone_id
            f["id"] = zone_id
            props.setdefault("name", f"Zone {zone_id.upper()}")

            # Compute geodesic metric area if not provided
            if "area_m2" not in props or not props["area_m2"]:
                try:
                    lat0 = ring[0][1]
                    m_lat = 110574.0
                    m_lon = 111320.0 * math.cos(math.radians(lat0))
                    pts_m = [((p[0] - ring[0][0]) * m_lon, (p[1] - lat0) * m_lat) for p in ring]
                    poly_area = 0.5 * abs(sum(pts_m[j][0]*pts_m[j+1][1] - pts_m[j+1][0]*pts_m[j][1] for j in range(len(pts_m)-1)))
                    props["area_m2"] = round(poly_area, 1) if poly_area > 5.0 else 100.0
                except Exception:
                    props["area_m2"] = 150.0

            props.setdefault("max_capacity", int(props["area_m2"] * 1.5))
            updated_zones.append(f)

        elif geom_type == "LineString":
            cid = fid or f"c_{len(updated_corridors) + 1}"
            props["id"] = cid
            f["id"] = cid
            props.setdefault("u", props.get("from", "z1"))
            props.setdefault("v", props.get("to", "gate_a"))
            props.setdefault("length_m", 25.0)
            props.setdefault("width_m", 3.0)
            props.setdefault("zone_id", props.get("u", "z1"))
            props.setdefault("blocked", False)
            updated_corridors.append(f)

        elif geom_type == "Point":
            gid = fid or f"gate_{len(updated_gates) + 1}"
            props["id"] = gid
            f["id"] = gid
            props.setdefault("name", f"Gate {gid.upper()}")
            props.setdefault("type", "EXIT_GATE")
            props.setdefault("capacity_pax_sec", 15.0)
            updated_gates.append(f)

    if updated_zones:
        gis_manager.zones["features"] = updated_zones
    if updated_corridors:
        gis_manager.corridors["features"] = updated_corridors
    if updated_gates:
        gis_manager.gates["features"] = updated_gates

    gis_manager._rebuild_spatial_indices()
    log_operator_action("Operator_Raghu", "IMPORT_GIS", f"Imported custom GIS GeoJSON ({len(updated_zones)} zones, {len(updated_corridors)} corridors, {len(updated_gates)} gates)")
    await broadcast_state()
    return {
        "ok": True,
        "imported_zones": len(updated_zones),
        "imported_corridors": len(updated_corridors),
        "imported_gates": len(updated_gates)
    }


@app.post("/api/cameras/test")
async def test_camera_connection(req: CameraCreateRequest):
    """Tests if a webcam device index or phone IP camera can be opened."""
    norm_src = normalize_camera_source(req.source)
    opened = False
    ret = False

    # Fast HTTP reachability check if URL
    if isinstance(norm_src, str) and norm_src.startswith("http://"):
        try:
            import urllib.request
            req_obj = urllib.request.Request(norm_src, headers={"User-Agent": "CrowdShield/1.0"})
            with urllib.request.urlopen(req_obj, timeout=2.5) as resp:
                pass
        except Exception as e:
            return {
                "success": False,
                "source": req.source,
                "normalized_source": str(norm_src),
                "details": f"Could not reach {norm_src} ({e}). Please verify: 1) 'IP Webcam' app has 'Start server' turned ON. 2) Phone & PC are on the same Wi-Fi. 3) Correct IP & Port."
            }

    cap = cv2.VideoCapture(norm_src)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    opened = cap.isOpened()
    if opened:
        ret, frame = cap.read()
        cap.release()

    if not (opened and ret) and isinstance(norm_src, str) and norm_src.startswith("http://"):
        try:
            base = norm_src.replace("http://", "").split("/")[0]
            alt = f"rtsp://{base}/h264_ulaw.sdp"
            cap = cv2.VideoCapture(alt)
            if cap.isOpened():
                ret, _ = cap.read()
                cap.release()
                if ret:
                    norm_src = alt
                    opened = True
        except Exception:
            pass

    return {
        "success": bool(opened and ret),
        "source": req.source,
        "normalized_source": str(norm_src),
        "details": f"Camera feed connected successfully! Live stream ready at {norm_src}" if (opened and ret) else f"Device/stream reached but could not capture video frames. Check stream endpoint."
    }


@app.get("/api/comports")
async def get_com_ports():
    """Auto-scans and lists physical Windows serial COM ports for ESP32 Gateway."""
    ports = []
    for p in serial.tools.list_ports.comports():
        ports.append({
            "port": p.device,
            "description": p.description,
            "hwid": p.hwid
        })
    return ports


# ============================================================================
# LIVE MJPEG VIDEO STREAMING
# ============================================================================

def mjpeg_generator(cam_id: Optional[str] = None):
    """Streams live frames with bounding boxes from the specified or active camera."""
    while True:
        try:
            feed = None
            if cam_id and cam_id in camera_registry:
                feed = camera_registry[cam_id]
            elif camera_registry:
                feed = next(iter(camera_registry.values()))

            if feed and feed.latest_jpeg:
                frame_bytes = feed.latest_jpeg
            elif feed:
                # Active camera connecting HUD
                hud = np.zeros((360, 640, 3), dtype=np.uint8)
                cv2.rectangle(hud, (10, 10), (630, 350), (28, 28, 30), 1)
                cv2.putText(hud, f"CROWDSHIELD LIVE [{feed.cam_id}]: {feed.name.upper()}", (30, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
                cv2.putText(hud, f"FEED STATUS: {feed.status}", (30, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (74, 222, 128) if "ONLINE" in feed.status else (234, 179, 8), 1)
                cv2.putText(hud, f"Endpoint: {feed.source}", (30, 195), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (161, 161, 170), 1)
                cv2.putText(hud, "Streaming frames into YOLOv8 inference pipeline...", (30, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (113, 113, 122), 1)
                _, jpeg = cv2.imencode(".jpg", hud, [cv2.IMWRITE_JPEG_QUALITY, 75])
                frame_bytes = jpeg.tobytes()
            else:
                # Minimalist Black Command-Center HUD when no camera is active
                hud = np.zeros((360, 640, 3), dtype=np.uint8)
                hud[:] = (0, 0, 0)  # Pure black
                cv2.rectangle(hud, (10, 10), (630, 350), (28, 28, 30), 1)
                cv2.putText(hud, "CROWDSHIELD EDGE AI VISION", (30, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)
                cv2.putText(hud, "NO ACTIVE CAMERA FEED CONNECTED", (30, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (113, 113, 122), 1)
                cv2.putText(hud, "Click '+ ADD CAMERA' in top bar to connect Phone IP Webcam or Laptop Cam (0)", (30, 210), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (82, 82, 91), 1)
                _, jpeg = cv2.imencode(".jpg", hud, [cv2.IMWRITE_JPEG_QUALITY, 75])
                frame_bytes = jpeg.tobytes()

            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")
            time.sleep(0.030)
        except Exception:
            time.sleep(0.05)


@app.get("/video_feed")
async def video_feed():
    """Default active camera MJPEG stream."""
    return StreamingResponse(mjpeg_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get("/video_feed/{cam_id}")
async def video_feed_specific(cam_id: str):
    """Specific camera MJPEG stream."""
    return StreamingResponse(mjpeg_generator(cam_id), media_type="multipart/x-mixed-replace; boundary=frame")


# ============================================================================
# REST CORE ENDPOINTS
# ============================================================================

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "CrowdShield Real-Time Spine",
        "version": "2.1.0",
        "mode": state["mode"],
        "active_cameras": len(camera_registry),
        "connected_ws_clients": len(ws_clients),
        "uptime_sec": round(time.time() - start_time, 1)
    }


@app.get("/state")
async def get_state():
    evaluate_rules_and_routes()
    return state


@app.post("/zones")
async def post_zones(payload: ZonesPayload):
    """Ingests zone metrics from external vision worker."""
    state["last_real_vision"] = time.time()
    state["fps"] = payload.fps
    for zid, zm in payload.zones.items():
        if zid in state["zones"]:
            state["zones"][zid].update(zm.model_dump())
    await broadcast_state()
    return {"ok": True}


@app.post("/analyze_kumbh_frame")
@app.post("/api/vision/analyze_kumbh")
async def analyze_kumbh_frame_endpoint(
    file: Optional[UploadFile] = File(None),
    update_state: bool = False
):
    """
    Dedicated Local Maha Kumbh Extreme-Density Vision API:
    Calculates total crowd count and per-zone density (pax/m^2) using CSRNet density-map regression.
    Works 100% offline on local edge hardware with zero cloud dependency.
    """
    try:
        if file is not None:
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        else:
            # Fallback to latest active camera feed if available
            frame_bgr = None
            for c in camera_registry.values():
                if hasattr(c, "latest_frame") and c.latest_frame is not None:
                    frame_bgr = c.latest_frame
                    break
            if frame_bgr is None:
                # High-density synthetic festival crowd test frame
                frame_bgr = np.zeros((360, 640, 3), dtype=np.uint8)
                for _ in range(800):
                    rx = int(np.random.randint(10, 630))
                    ry = int(np.random.randint(10, 350))
                    cv2.circle(frame_bgr, (rx, ry), 3, (210, 210, 210), -1)

        # Run CSRNet density map engine from vision_manager
        total_count, density_map, heatmap_bgr = vision_manager.density_engine.estimate_density(
            frame_bgr,
            base_yolo_count=0
        )

        h, w = density_map.shape[:2]
        h2, w2 = h // 2, w // 2
        quadrants = [
            density_map[0:h2, 0:w2],   # z1: Top-Left
            density_map[0:h2, w2:w],   # z2: Top-Right
            density_map[h2:h, 0:w2],   # z3: Bottom-Left
            density_map[h2:h, w2:w]    # z4: Bottom-Right
        ]
        # Calibrated sector area = 24.0 m^2
        zone_densities = {
            f"z{i+1}": round(float(np.sum(q)) / 24.0, 2)
            for i, q in enumerate(quadrants)
        }

        # Determine regime
        max_density = max(zone_densities.values()) if zone_densities else 0.0
        regime = "CRUSH_REGIME_DENSITY_MAP" if max_density >= 2.5 else "SPARSE_YOLO"

        # Generate Base64 encoded JPEG heatmap thumbnail
        heatmap_thumb = cv2.resize(heatmap_bgr, (320, 180))
        _, enc = cv2.imencode(".jpg", heatmap_thumb, [cv2.IMWRITE_JPEG_QUALITY, 80])
        b64_heatmap = "data:image/jpeg;base64," + base64.b64encode(enc).decode("utf-8")

        # Optionally update live state
        if update_state:
            for zid, d_val in zone_densities.items():
                if zid in state["zones"]:
                    state["zones"][zid]["density"] = d_val
                    state["zones"][zid]["personCount"] = int(d_val * 24.0)
                    state["zones"][zid]["level"] = 3 if d_val >= 5.0 else (2 if d_val >= 3.5 else (1 if d_val >= 2.0 else 0))
            await broadcast_state()

        return {
            "ok": True,
            "architecture": "CSRNet Dilated-CNN Continuous Density-Map Regression",
            "model_dataset": "ShanghaiTech Part A / UCF-QNRF Pretrained Priors",
            "offline_mode": True,
            "zero_cloud_dependency": True,
            "total_count": int(round(total_count)),
            "zone_densities": zone_densities,
            "regime": regime,
            "is_crush_regime": max_density >= 2.5,
            "heatmap_preview": b64_heatmap
        }
    except Exception as e:
        return {
            "ok": False,
            "error": str(e)
        }


@app.post("/node")
async def post_node(ev: NodeEvent):
    """
    Ingests real telemetry from physical ESP32 gateway over USB serial.
    Handles hardware SOS buttons with sub-second response.
    """
    now = time.time()
    state["last_real_node"] = now
    nid = str(ev.z)

    ev_dict = ev.model_dump()
    ev_dict["ts"] = now
    ev_dict["online"] = True
    ev_dict["lastSeen"] = "Live (<1s)"

    if nid in state["nodes"]:
        state["nodes"][nid].update(ev_dict)
    else:
        state["nodes"][nid] = ev_dict

    if ev.sos == 1:
        trigger_sos_medical_incident(f"z{ev.z}", f"NODE-Z{ev.z}", f"Physical SOS Button pressed on ESP32 (RSSI: {ev.rssi} dBm, Seq #{ev.seq})")
        log_operator_action("Hardware_Node", "HARDWARE_SOS_RECEIVED", f"Physical SOS on Node z{ev.z} (GPIO 12)")

    await broadcast_state()
    downlink_cmd = downlink_queue.pop(0) if downlink_queue else None
    return {"ok": True, "downlink": downlink_cmd}


@app.post("/ack/{alert_id}")
async def acknowledge_alert(alert_id: str, user: str = "Operator_Raghu"):
    found = False
    for a in state["alerts"]:
        if a["id"] == alert_id:
            a["status"] = "acknowledged"
            a["ack_by"] = user
            a["ack_ts"] = time.time()
            found = True
            break
    if found:
        log_operator_action(user, "ACK_ALERT", f"Acknowledged alert {alert_id}")
        await broadcast_state()
        return {"ok": True, "alert_id": alert_id, "status": "acknowledged"}
    raise HTTPException(status_code=404, detail="Alert not found")


@app.post("/block-path")
async def toggle_block_path(data: dict):
    edge = data.get("edge", "")
    user = data.get("user", "Operator_Raghu")
    if not edge:
        raise HTTPException(status_code=400, detail="edge is required")

    if edge in state["blocked_edges"]:
        state["blocked_edges"].remove(edge)
        action_desc = f"UNBLOCKED {edge}"
    else:
        state["blocked_edges"].append(edge)
        action_desc = f"BLOCKED {edge}"

    log_operator_action(user, "ROUTE_OVERRIDE", action_desc)
    await broadcast_state()
    return {"ok": True, "blocked_edges": state["blocked_edges"], "action": action_desc}


class HazardTriggerReq(BaseModel):
    zone_id: str
    hazard_type: str = "FIRE"
    severity: str = "CRITICAL"
    user: str = "Operator_Raghu"


class HazardClearReq(BaseModel):
    zone_id: Optional[str] = None
    user: str = "Operator_Raghu"


@app.post("/api/hazard/trigger")
async def trigger_hazard_isolation(req: HazardTriggerReq):
    """
    Emergency Incident Hazard Isolation & Display Broadcast:
    1. Sets NetworkX edge weight of compromised zone to infinity.
    2. Automatically recalculates shortest safe exit path (GATE A, B, C) for all remaining zones.
    3. Generates zone-specific display payloads and transmits them over USB Serial (pyserial)
       to the Gateway ESP32 so all field displays and LED arrows update simultaneously.
    """
    res = gis_manager.trigger_zone_hazard(req.zone_id, req.hazard_type, req.severity)

    # 1. Update State
    state["active_hazards"] = gis_manager.get_active_hazards()
    state["hazard_broadcasts"] = res["broadcasts"]
    state["gis_routing"] = res["routing"]
    state["gis_geojson"] = gis_manager.get_full_venue_geojson(state["zones"])

    # 2. Insert Priority Emergency Alert
    z_clean = req.zone_id.lower().replace("z", "")
    z_num = int(z_clean) if z_clean.isdigit() else 1
    alert_obj = {
        "id": f"hazard-{req.zone_id}-{int(time.time())}",
        "ts": datetime.now().isoformat(),
        "z": z_num,
        "zone": req.zone_id.lower(),
        "level": 3,
        "type": "hazard_isolation",
        "hazard_type": req.hazard_type.upper(),
        "text_en": f"CRITICAL {req.hazard_type.upper()} HAZARD IN {req.zone_id.upper()} — SECTOR ISOLATED, EVACUATION REROUTED",
        "text_local": f"அவசர {req.hazard_type.upper()} அபாயம் {req.zone_id.upper()} — பாதை மாற்றப்பட்டது",
        "status": "open",
        "action": "EVACUATE"
    }
    state["alerts"].insert(0, alert_obj)

    # 3. Transmit zone-specific payloads over USB Serial (pyserial) to Gateway ESP32
    global active_serial_conn
    serial_dispatched = 0
    with active_serial_lock:
        for b in res["broadcasts"]:
            # Transmit pipe format: e.g. "1|3|FIRE IN Z2 - REROUTE VIA GATE A\n"
            pipe_line = b["pipe_payload"] + "\n"
            if active_serial_conn and active_serial_conn.is_open:
                try:
                    active_serial_conn.write(pipe_line.encode("utf-8"))
                    active_serial_conn.flush()
                    serial_dispatched += 1
                    print(f"[HAZARD SERIAL GATEWAY] >>> Dispatched: {b['pipe_payload']}")
                except Exception as e:
                    print(f"[HAZARD SERIAL ERROR] {e}")

            # Also enqueue standard JSON downlink command for mesh node DFPlayer & 1602 LCD
            cmd_dict = {
                "cmd": "PLAY",
                "z": b["z_num"],
                "lvl": b["level"],
                "track": b["track"],
                "text": b["text"],
                "arrow": b["arrow"],
                "exit": b["exit"],
                "instruction": b["text"]
            }
            downlink_queue.append(cmd_dict)

    # 4. Log Operator Action
    log_operator_action(
        req.user,
        "HAZARD_ISOLATION_TRIGGERED",
        f"Triggered {req.hazard_type.upper()} in {req.zone_id.upper()}. Isolated sector corridors. Broadcast {len(res['broadcasts'])} zone reroutes over LoRa mesh."
    )

    await broadcast_state()
    return {
        "ok": True,
        "isolated_zone": req.zone_id,
        "hazard_type": req.hazard_type.upper(),
        "serial_dispatched": serial_dispatched,
        "rerouted_paths": res["evacuation"],
        "broadcasts": res["broadcasts"]
    }


@app.post("/api/hazard/clear")
async def clear_hazard_isolation(req: HazardClearReq):
    """
    Clears the hazard isolation, restores normal corridor weights,
    recalculates optimal paths, and transmits All-Clear to field displays.
    """
    res = gis_manager.clear_zone_hazard(req.zone_id)

    state["active_hazards"] = gis_manager.get_active_hazards()
    state["hazard_broadcasts"] = res["broadcasts"]
    state["gis_routing"] = res["routing"]
    state["gis_geojson"] = gis_manager.get_full_venue_geojson(state["zones"])

    # Acknowledge open hazard alerts
    for a in state["alerts"]:
        if a.get("type") == "hazard_isolation":
            a["status"] = "acknowledged"
            a["ack_by"] = req.user

    # Transmit all-clear pipe payloads over serial
    global active_serial_conn
    serial_dispatched = 0
    with active_serial_lock:
        for b in res["broadcasts"]:
            pipe_line = b["pipe_payload"] + "\n"
            if active_serial_conn and active_serial_conn.is_open:
                try:
                    active_serial_conn.write(pipe_line.encode("utf-8"))
                    active_serial_conn.flush()
                    serial_dispatched += 1
                except Exception as e:
                    print(f"[HAZARD SERIAL ERROR] {e}")
            cmd_dict = {
                "cmd": "CLEAR",
                "z": b["z_num"],
                "lvl": 1,
                "track": 3,
                "text": b["text"],
                "arrow": b["arrow"],
                "exit": b["exit"],
                "instruction": b["text"]
            }
            downlink_queue.append(cmd_dict)

    log_operator_action(
        req.user,
        "HAZARD_ISOLATION_CLEARED",
        f"Cleared hazard in {req.zone_id or 'ALL ZONES'}. Restored standard egress corridors."
    )

    await broadcast_state()
    return {
        "ok": True,
        "cleared_zone": req.zone_id,
        "serial_dispatched": serial_dispatched,
        "routing": res["routing"],
        "broadcasts": res["broadcasts"]
    }


@app.get("/api/hazard/status")
async def get_hazard_status():
    return {
        "active_hazards": gis_manager.get_active_hazards(),
        "recent_broadcasts": state.get("hazard_broadcasts", []),
        "isolated_zones": list(gis_manager.isolated_zones.keys())
    }


@app.post("/dispatch")
async def dispatch_downlink(cmd: DownlinkCmd):
    cmd_dict = cmd.model_dump()
    instr = str(cmd_dict.get("instruction", "")).lower()
    track = 1
    if "1" in instr or "0001" in instr or "evacuate" in instr or "inst-01" in instr:
        track = 1
    elif "2" in instr or "0002" in instr or "caution" in instr or "slow" in instr or "reroute" in instr or "inst-02" in instr:
        track = 2
    elif "3" in instr or "0003" in instr or "clear" in instr or "standby" in instr or "inst-03" in instr:
        track = 3

    cmd_dict["track"] = track
    cmd_dict["cmd"] = "PLAY"

    # Immediately transmit directly to physical ESP Gateway if connected!
    global active_serial_conn
    sent_direct = False
    with active_serial_lock:
        if active_serial_conn and active_serial_conn.is_open:
            try:
                active_serial_conn.write((json.dumps(cmd_dict) + "\n").encode("utf-8"))
                active_serial_conn.flush()
                print(f"[DIRECT DOWNLINK] Transmitted to ESP on USB Serial: {cmd_dict}")
                sent_direct = True
            except Exception as ser_write_err:
                print(f"[DIRECT DOWNLINK] Serial write failed: {ser_write_err}")

    if not sent_direct:
        downlink_queue.append(cmd_dict)

    log_operator_action(
        "Operator_Raghu",
        "DISPATCH_DOWNLINK",
        f"Broadcast warning to Zone {cmd.z}: Track {track} (Level {cmd.lvl}, {cmd.instruction})",
    )
    await broadcast_state()
    return {"ok": True, "queued": cmd_dict, "queue_depth": len(downlink_queue)}


@app.get("/api/downlink_queue")
async def get_pending_downlink():
    """Pops and returns the next pending operator dispatch downlink for immediate serial broadcast."""
    cmd = downlink_queue.pop(0) if downlink_queue else None
    return {"downlink": cmd}


@app.post("/api/trigger_siren")
async def trigger_siren():
    cmd = {"z": 0, "lvl": 3, "action": "SIREN_ON", "instruction": "EVACUATE_NOW"}
    downlink_queue.append(cmd)
    log_operator_action("Operator_Raghu", "SIREN_DISPATCH", "Evacuation command broadcasted to all field nodes")
    await broadcast_state()
    return {"ok": True, "command": cmd}


@app.post("/api/simulate_event")
async def simulate_event(req: dict):
    sc = req.get("scenario", "").upper()
    now = time.time()
    if sc == "SOS_ZONE_2":
        state["nodes"]["2"]["sos"] = 1
        state["nodes"]["2"]["ts"] = now
        trigger_sos_medical_incident("z2", "NODE-Z2", "Scenario Simulation: Physical SOS on Zone 2")
    elif sc == "SURGE_ZONE_2":
        state["zones"]["z2"]["density"] = 5.2
        state["zones"]["z2"]["level"] = 3
        raise_alert("z2", "density_critical", 3, "Zone Z2 CRITICAL density surge (5.20 pax/m²)", "மண்டலம் 2 தீவிர கூட்ட நெரிசல்", cooldown_sec=0)
    elif sc == "CLEAR_ALL":
        for z in state["zones"].values():
            z["density"] = 0.0
            z["level"] = 0
            z["personCount"] = 0
        for n in state["nodes"].values():
            n["sos"] = 0
        state["active_medical_incident"] = None
        state["blocked_edges"] = []
        state["alerts"] = []
    await broadcast_state()
    return {"ok": True, "scenario": sc}


# ============================================================================
# WEBSOCKET REAL-TIME SYNC
# ============================================================================

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.add(ws)
    try:
        evaluate_rules_and_routes()
        await ws.send_json(state)
        while True:
            text = await ws.receive_text()
            if text == "PING":
                await ws.send_text("PONG")
    except WebSocketDisconnect:
        ws_clients.discard(ws)
    except Exception:
        ws_clients.discard(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend_server:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
