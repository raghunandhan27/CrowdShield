"""
CrowdShield Data Contracts & Core Algorithms
System Version: 2.0 (VBYLD Hackathon Edition)
Defines shared Pydantic data schemas, Fruin Level-of-Service calculations,
density-gated physics risk score, and NetworkX dynamic safe-exit graph routing.
"""

import time
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
import networkx as nx


# ============================================================================
# 1. PYDANTIC DATA CONTRACTS (Section D)
# ============================================================================

class ZoneMetric(BaseModel):
    """Real-time physical crowd metrics for a single venue zone."""
    density: float = Field(..., description="People per m^2 computed via 4-point perspective homography")
    speed: float = Field(..., description="Mean optical flow walking velocity in meters/second")
    conflict: float = Field(..., description="Directional flow conflict turbulence index (0.0 to 1.0)")
    risk: float = Field(..., description="Combined physics risk score (0.00 to 1.00)")
    level: int = Field(..., description="Fruin Level of Service: 0=Safe, 1=Caution, 2=High, 3=Critical")


class ZonesPayload(BaseModel):
    """Published by Vision Worker every second."""
    ts: float = Field(default_factory=time.time)
    cam: str = "cam1"
    fps: float = 15.0
    zones: Dict[str, ZoneMetric]


class NodeEvent(BaseModel):
    """Hardware telemetry from ESP32 / ESP8266 field nodes via LoRa/ESP-NOW Gateway."""
    ts: float = Field(default_factory=time.time)
    z: int = Field(..., description="Zone number (1..4)")
    sos: int = Field(0, description="1 if physical SOS button pressed (GPIO 13 LOW), else 0")
    mo: int = Field(0, description="Motion / PIR activity or microphone audio spike flag")
    seq: int = Field(0, description="Incrementing packet sequence counter to detect dropped frames")
    rssi: int = Field(-75, description="LoRa / RF signal strength in dBm")
    batteryVolts: Optional[float] = Field(4.05, description="18650 Battery Voltage")
    batteryPct: Optional[int] = Field(85, description="Calculated Battery Percentage")


class ZoneForecast(BaseModel):
    """Predictive trajectory 10 and 15 minutes ahead."""
    t10: float = Field(..., description="Predicted density in +10 minutes (people/m^2)")
    t15: float = Field(..., description="Predicted density in +15 minutes (people/m^2)")
    p_critical: float = Field(..., description="Probability of crossing Fruin Level 3 (5 p/m^2) [0..1]")


class ForecastPayload(BaseModel):
    """Published by forecasting service every 15-30 seconds."""
    ts: float = Field(default_factory=time.time)
    zones: Dict[str, ZoneForecast]


class AlertObject(BaseModel):
    """Unified system alert object for frontend and emergency notifications."""
    id: str
    ts: float
    zone: str
    type: str  # "sos_hardware", "density_critical", "forecast_critical", "node_silent", "camera_lost"
    level: int  # 1=Caution, 2=High Alert, 3=Critical Imminent Crush
    text_en: str
    text_local: str  # Tamil / Hindi localized safety instruction
    status: str = "open"  # "open", "acknowledged", "resolved"
    ack_by: Optional[str] = None
    ack_ts: Optional[float] = None


class DownlinkCmd(BaseModel):
    """Operator confirmed dispatch command sent back down the LoRa / ESP-NOW mesh to field nodes."""
    z: int = Field(..., description="Target Zone ID (1..4, or 0 for ALL)")
    lvl: int = Field(..., description="Alert Level to display on NeoPixel/LED (0=Green, 1=Yellow, 2=Amber, 3=Red)")
    action: Optional[str] = "LED_AND_AUDIO"
    instruction: Optional[str] = "EVACUATE"  # Matches DFPlayer MP3 track or alert command


class OperatorAction(BaseModel):
    """Immutable audit trail of operator decisions."""
    ts: float = Field(default_factory=time.time)
    user: str = "Operator_Raghu"
    action: str  # "ACK_ALERT", "ROUTE_CHANGE", "DISPATCH_LORA_DOWNLINK", "TOGGLE_DEMO"
    details: str


# ============================================================================
# 2. DENSITY-GATED RISK FORMULA (Stage 4 Fix & Fruin Standard)
# ============================================================================

def compute_risk(d: float, v: float, c: float, w=(0.60, 0.25, 0.15), vmax: float = 1.2):
    """
    Computes crowd danger using Fruin's Level of Service and density-gated physics:
    Risk = w0 * d_n + w1 * (slow * d_n) + w2 * (conflict * d_n)
    
    Slowness and turbulence (conflict) are gated by normalized density (d_n).
    Therefore, an empty or quiet room with zero speed will NEVER trigger a false alarm!
    """
    d_clean = max(float(d), 0.0)
    v_clean = max(float(v), 0.0)
    c_clean = max(min(float(c), 1.0), 0.0)
    
    # Normalized density: 6.0 people/m^2 is lethal crush threshold
    d_n = min(d_clean / 6.0, 1.0)
    
    # Slowness factor: only dangerous when crowded
    slow = (1.0 - min(v_clean / vmax, 1.0)) * d_n
    
    # Combined score
    score = w[0] * d_n + w[1] * slow + w[2] * (c_clean * d_n)
    score = max(0.0, min(1.0, score))
    
    # Fruin's Level of Service (LoS) hard thresholds
    # Level 0 (Safe): < 2.0 p/m^2 (Free flow)
    # Level 1 (Caution): 2.0 - 4.0 p/m^2 (Restricted movement)
    # Level 2 (High): 4.0 - 5.0 p/m^2 (Severe restriction / Choke warning)
    # Level 3 (Critical): > 5.0 p/m^2 (Imminent crush risk)
    if d_clean > 5.0:
        level = 3
    elif d_clean > 4.0:
        level = 2
    elif d_clean > 2.0:
        level = 1
    else:
        level = 0
        
    # Hard safety override: turbulent opposing flow in dense crowd steps up level!
    if c_clean > 0.60 and d_clean > 3.0:
        level = min(3, level + 1)
        
    return round(score, 3), level


# ============================================================================
# 3. NETWORKX DYNAMIC SAFE-EXIT & RESPONDER ROUTER (Stage 9)
# ============================================================================

def build_venue_graph() -> nx.Graph:
    """
    Constructs the physical venue topology graph:
    Zones: z1 (Main Gate Plaza), z2 (East Corridor), z3 (Central Arena), z4 (North Concourse)
    Exits: GATE_A (Main), GATE_B (East Bypass), GATE_C (North Emergency)
    """
    G = nx.Graph()
    edges = [
        ("z1", "GATE_A", {"length": 35.0, "zone": "z1", "blocked": False, "label": "North Main Exit Portal"}),
        ("z1", "z2",     {"length": 45.0, "zone": "z2", "blocked": False, "label": "East Corridor Choke"}),
        ("z1", "z3",     {"length": 50.0, "zone": "z3", "blocked": False, "label": "Central Promenade"}),
        ("z2", "GATE_B", {"length": 30.0, "zone": "z2", "blocked": False, "label": "East Bypass Ramp"}),
        ("z2", "z4",     {"length": 40.0, "zone": "z4", "blocked": False, "label": "South-East Connector"}),
        ("z3", "GATE_B", {"length": 40.0, "zone": "z3", "blocked": False, "label": "Concourse B Access"}),
        ("z3", "z4",     {"length": 35.0, "zone": "z4", "blocked": False, "label": "South Aisleway"}),
        ("z4", "GATE_C", {"length": 25.0, "zone": "z4", "blocked": False, "label": "North Emergency Exit"})
    ]
    G.add_edges_from(edges)
    return G


def compute_safe_routes(G: nx.Graph, zone_levels: Dict[str, int], blocked_edges: List[str]) -> Dict[str, dict]:
    """
    Dynamic Dijkstra path computation:
    Edge Cost: Length * (1 + 4 * Level)
    If an edge is manually blocked by operator OR a zone hits Critical (Level 3),
    the weight becomes INFINITY so crowds are automatically routed away from danger!
    """
    exits = ["GATE_A", "GATE_B", "GATE_C"]
    
    # Update live edge weights
    for u, v, d in G.edges(data=True):
        edge_key = f"{u}-{v}"
        rev_key = f"{v}-{u}"
        is_blocked = (edge_key in blocked_edges) or (rev_key in blocked_edges) or d.get("blocked", False)
        lvl = zone_levels.get(d.get("zone", "z1"), 0)
        
        if is_blocked or lvl == 3:
            d["w"] = float("inf")
        else:
            d["w"] = d["length"] * (1.0 + 4.0 * lvl)
            
    routes = {}
    for start_zone in ["z1", "z2", "z3", "z4"]:
        best = None
        for ex in exits:
            try:
                cost = nx.shortest_path_length(G, start_zone, ex, weight="w")
                path = nx.shortest_path(G, start_zone, ex, weight="w")
                if best is None or cost < best[0]:
                    best = (cost, ex, path)
            except (nx.NetworkXNoPath, nx.NodeNotFound):
                continue
                
        if best and best[0] != float("inf"):
            routes[start_zone] = {
                "exit": best[1],
                "path": best[2],
                "cost": round(best[0], 1),
                "status": "CLEAR"
            }
        else:
            routes[start_zone] = {
                "exit": "EMERGENCY_HOLD",
                "path": [start_zone],
                "cost": 9999.0,
                "status": "TRAPPED_OR_ISOLATED"
            }
            
    return routes
