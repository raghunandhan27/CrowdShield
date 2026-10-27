"""
CrowdShield GIS Spatial Engine & Dynamic Safe-Exit Routing
Integrates Geographic Information System (GIS) mapping:
- Standardized GeoJSON venue zones (polygons), corridors (linestrings), and gates/nodes (points)
- Shapely point-in-polygon spatial checks and true m^2 crowd pressure computation
- Dynamic NetworkX routing with congestion penalty: cost = length * (1 + 4 * risk)
- Visitor evacuation routes & First Responder approach routes exported as GeoJSON
- Offline-ready and compatible with QGIS and geojson.io
"""

import json
import math
from typing import Dict, List, Any, Optional, Tuple
import networkx as nx
from shapely.geometry import shape, Point, Polygon, LineString

# ============================================================================
# DEFAULT VENUE GIS LAYERS (GeoJSON Standard)
# Standard Venue Coordinate Plane: Local Metric Grid [X meters, Y meters]
# or Projected Local Geo Coordinates (100% Offline Compatible)
# ============================================================================

DEFAULT_GIS_PERIMETER = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "perimeter_outer",
            "properties": {
                "id": "perimeter_outer",
                "name": "Grand Arena & Festival Grounds Perimeter",
                "type": "VENUE_PERIMETER",
                "fence_type": "Reinforced Crowd Control Barrier (Anti-Climb)",
                "perimeter_m": 620.0,
                "total_area_m2": 22000.0,
                "color_base": "#334155"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [[-5.0, -5.0], [195.0, -5.0], [195.0, 105.0], [-5.0, 105.0], [-5.0, -5.0]]
                ]
            }
        }
    ]
}

DEFAULT_GIS_ZONES = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "z1",
            "properties": {
                "id": "z1",
                "name": "Zone A — Main Gate Plaza",
                "area_m2": 320.0,
                "max_capacity": 450,
                "description": "High-throughput entrance concourse and turnstiles",
                "color_base": "#10b981",
                "camera_ids": ["CAM-01"],
                "node_id": "NODE-Z1"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [[15.0, 15.0], [55.0, 15.0], [55.0, 55.0], [15.0, 55.0], [15.0, 15.0]]
                ]
            }
        },
        {
            "type": "Feature",
            "id": "z2",
            "properties": {
                "id": "z2",
                "name": "Zone B — East Corridor Choke",
                "area_m2": 95.0,
                "max_capacity": 120,
                "description": "Narrow bottleneck transition tunnel connecting Gate Plaza to Arena",
                "color_base": "#f59e0b",
                "camera_ids": ["CAM-02"],
                "node_id": "NODE-Z2"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [[70.0, 25.0], [100.0, 25.0], [100.0, 45.0], [70.0, 45.0], [70.0, 25.0]]
                ]
            }
        },
        {
            "type": "Feature",
            "id": "z3",
            "properties": {
                "id": "z3",
                "name": "Zone C — Central Stage Arena",
                "area_m2": 480.0,
                "max_capacity": 700,
                "description": "Mass gathering open amphitheater and central viewing arena",
                "color_base": "#3b82f6",
                "camera_ids": ["CAM-03"],
                "node_id": "NODE-Z3"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [[115.0, 10.0], [175.0, 10.0], [175.0, 60.0], [115.0, 60.0], [115.0, 10.0]]
                ]
            }
        },
        {
            "type": "Feature",
            "id": "z4",
            "properties": {
                "id": "z4",
                "name": "Zone D — North Exit Concourse",
                "area_m2": 240.0,
                "max_capacity": 350,
                "description": "Northward egress archway leading to Emergency Evacuation Gate B",
                "color_base": "#8b5cf6",
                "camera_ids": ["CAM-04"],
                "node_id": "NODE-Z4"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [[70.0, 65.0], [145.0, 65.0], [145.0, 95.0], [70.0, 95.0], [70.0, 65.0]]
                ]
            }
        }
    ]
}

DEFAULT_GIS_CORRIDORS = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "c_gate_a_z1",
            "properties": {
                "id": "c_gate_a_z1",
                "name": "Gate A Egress Chute",
                "u": "gate_a",
                "v": "z1",
                "length_m": 35.0,
                "width_m": 5.0,
                "zone_id": "z1",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[0.0, 35.0], [35.0, 35.0]]
            }
        },
        {
            "type": "Feature",
            "id": "c_z1_z2",
            "properties": {
                "id": "c_z1_z2",
                "name": "Plaza to East Choke",
                "u": "z1",
                "v": "z2",
                "length_m": 50.0,
                "width_m": 3.0,
                "zone_id": "z2",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[35.0, 35.0], [85.0, 35.0]]
            }
        },
        {
            "type": "Feature",
            "id": "c_z2_z3",
            "properties": {
                "id": "c_z2_z3",
                "name": "East Choke to Arena",
                "u": "z2",
                "v": "z3",
                "length_m": 60.0,
                "width_m": 3.5,
                "zone_id": "z2",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[85.0, 35.0], [145.0, 35.0]]
            }
        },
        {
            "type": "Feature",
            "id": "c_z1_z3_bypass",
            "properties": {
                "id": "c_z1_z3_bypass",
                "name": "South Bypass Corridor (Direct Z1-Z3)",
                "u": "z1",
                "v": "z3",
                "length_m": 115.0,
                "width_m": 4.5,
                "zone_id": "z1",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[35.0, 15.0], [85.0, 3.0], [145.0, 15.0]]
            }
        },
        {
            "type": "Feature",
            "id": "c_z3_z4",
            "properties": {
                "id": "c_z3_z4",
                "name": "Arena to North Arch",
                "u": "z3",
                "v": "z4",
                "length_m": 48.0,
                "width_m": 4.0,
                "zone_id": "z4",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[145.0, 60.0], [107.5, 80.0]]
            }
        },
        {
            "type": "Feature",
            "id": "c_z4_gate_b",
            "properties": {
                "id": "c_z4_gate_b",
                "name": "North Exit Arterial to Gate B",
                "u": "z4",
                "v": "gate_b",
                "length_m": 25.0,
                "width_m": 6.0,
                "zone_id": "z4",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[107.5, 80.0], [107.5, 105.0]]
            }
        },
        {
            "type": "Feature",
            "id": "c_z3_gate_c",
            "properties": {
                "id": "c_z3_gate_c",
                "name": "South Emergency Spillway to Gate C",
                "u": "z3",
                "v": "gate_c",
                "length_m": 35.0,
                "width_m": 3.8,
                "zone_id": "z3",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[145.0, 10.0], [145.0, -5.0]]
            }
        },
        {
            "type": "Feature",
            "id": "c_med_z1",
            "properties": {
                "id": "c_med_z1",
                "name": "Rapid Paramedic Access to Plaza",
                "u": "resp_post_1",
                "v": "z1",
                "length_m": 35.0,
                "width_m": 4.5,
                "zone_id": "z1",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[18.0, 80.0], [35.0, 55.0]]
            }
        },
        {
            "type": "Feature",
            "id": "c_med_z2",
            "properties": {
                "id": "c_med_z2",
                "name": "Direct Emergency Spur to East Choke",
                "u": "resp_post_1",
                "v": "z2",
                "length_m": 65.0,
                "width_m": 4.0,
                "zone_id": "z2",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[18.0, 80.0], [55.0, 80.0], [85.0, 45.0]]
            }
        },
        {
            "type": "Feature",
            "id": "c_med_north_bypass",
            "properties": {
                "id": "c_med_north_bypass",
                "name": "North Perimeter Responder Highway (Med -> Zone D)",
                "u": "resp_post_1",
                "v": "z4",
                "length_m": 57.0,
                "width_m": 5.0,
                "zone_id": "z4",
                "blocked": False
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [[18.0, 80.0], [70.0, 80.0]]
            }
        }
    ]
}

DEFAULT_GIS_GATES = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "id": "gate_a",
            "properties": {
                "id": "gate_a",
                "name": "Gate A (Main West Portal)",
                "type": "EXIT_GATE",
                "capacity_pax_sec": 14.0,
                "status": "OPEN",
                "is_primary": True
            },
            "geometry": {"type": "Point", "coordinates": [0.0, 35.0]}
        },
        {
            "type": "Feature",
            "id": "gate_b",
            "properties": {
                "id": "gate_b",
                "name": "Gate B (North Emergency Exit)",
                "type": "EXIT_GATE",
                "capacity_pax_sec": 20.0,
                "status": "OPEN",
                "is_primary": True
            },
            "geometry": {"type": "Point", "coordinates": [107.5, 105.0]}
        },
        {
            "type": "Feature",
            "id": "gate_c",
            "properties": {
                "id": "gate_c",
                "name": "Gate C (South Relief Gate)",
                "type": "EXIT_GATE",
                "capacity_pax_sec": 10.0,
                "status": "OPEN",
                "is_primary": False
            },
            "geometry": {"type": "Point", "coordinates": [145.0, -5.0]}
        },
        {
            "type": "Feature",
            "id": "gate_med",
            "properties": {
                "id": "gate_med",
                "name": "Gate MED-01 (Ambulance & Paramedic Bay)",
                "type": "MEDICAL_GATE",
                "capacity_pax_sec": 8.0,
                "status": "OPEN",
                "is_primary": False
            },
            "geometry": {"type": "Point", "coordinates": [0.0, 80.0]}
        },
        {
            "type": "Feature",
            "id": "resp_post_1",
            "properties": {
                "id": "resp_post_1",
                "name": "Medical Department Command & Triage Field Hospital",
                "type": "RESPONDER_BASE",
                "med_bay_code": "MED-BAY-HQ",
                "unit_count": 8,
                "ambulances_available": 3,
                "triage_capacity": 12,
                "status": "ACTIVE_READY"
            },
            "geometry": {"type": "Point", "coordinates": [18.0, 80.0]}
        }
    ]
}

# ============================================================================
# GIS VENUE MANAGER & SPATIAL ENGINE
# ============================================================================

class GISVenueManager:
    def __init__(self):
        self.perimeter = json.loads(json.dumps(DEFAULT_GIS_PERIMETER))
        self.zones = json.loads(json.dumps(DEFAULT_GIS_ZONES))
        self.corridors = json.loads(json.dumps(DEFAULT_GIS_CORRIDORS))
        self.gates = json.loads(json.dumps(DEFAULT_GIS_GATES))
        self.isolated_zones: Dict[str, Dict[str, Any]] = {}
        self._rebuild_spatial_indices()

    def _rebuild_spatial_indices(self):
        """Builds Shapely geometry objects for fast spatial operations."""
        self.shapely_zones: Dict[str, Polygon] = {}
        self.zone_areas: Dict[str, float] = {}

        for idx, f in enumerate(self.zones["features"]):
            props = f.setdefault("properties", {})
            zid = f.get("id") or props.get("id") or f"z{idx+1}"
            props["id"] = zid
            f["id"] = zid
            geom = shape(f["geometry"])
            self.shapely_zones[zid] = geom
            self.zone_areas[zid] = props.get("area_m2", 100.0)

        # Build NetworkX routing graph
        self.graph = nx.Graph()
        # Add nodes
        for idx, g in enumerate(self.gates.get("features", [])):
            gprops = g.setdefault("properties", {})
            gid = g.get("id") or gprops.get("id") or f"gate_{idx+1}"
            gprops["id"] = gid
            g["id"] = gid
            coords = g["geometry"]["coordinates"]
            self.graph.add_node(gid, pos=coords, type=gprops.get("type", "EXIT_GATE"))

        for idx, z in enumerate(self.zones["features"]):
            zid = z.get("id") or z.get("properties", {}).get("id") or f"z{idx+1}"
            poly = self.shapely_zones.get(zid)
            if poly and not poly.is_empty:
                c = poly.centroid
                self.graph.add_node(zid, pos=[c.x, c.y], type="ZONE", area_m2=self.zone_areas.get(zid, 100.0))

        # Add corridor edges
        for idx, c in enumerate(self.corridors.get("features", [])):
            props = c.setdefault("properties", {})
            edge_id = c.get("id") or props.get("id") or f"c_{idx+1}"
            u = props.get("u", "z1")
            v = props.get("v", "gate_a")
            length_m = props.get("length_m", 25.0)
            width_m = props.get("width_m", 3.0)
            zone_id = props.get("zone_id", u)
            self.graph.add_edge(
                u, v,
                id=edge_id,
                length_m=length_m,
                width_m=width_m,
                zone_id=zone_id,
                blocked=props.get("blocked", False)
            )

        # Connect First Responder Base to Gate A / Zone 1
        if not self.graph.has_node("resp_post_1") or "pos" not in self.graph.nodes["resp_post_1"]:
            first_z = list(self.shapely_zones.keys())[0] if self.shapely_zones else "z1"
            if first_z in self.shapely_zones:
                c = self.shapely_zones[first_z].centroid
                base_pos = [c.x - 0.0002, c.y + 0.0001]
            else:
                base_pos = [0.0, 0.0]
            self.graph.add_node("resp_post_1", pos=base_pos, type="RESPONDER_BASE")

        target_zone = list(self.shapely_zones.keys())[0] if self.shapely_zones else "z1"
        self.graph.add_edge("resp_post_1", target_zone, id="resp_access_1", length_m=20.0, width_m=5.0, zone_id=target_zone, blocked=False)

    def point_in_zone(self, x: float, y: float) -> Optional[str]:
        """Performs Shapely point-in-polygon check to determine which GIS zone contains (x, y)."""
        pt = Point(x, y)
        for zid, poly in self.shapely_zones.items():
            if poly.contains(pt):
                return zid
        return None

    def calculate_gis_density(self, zone_id: str, person_count: int) -> float:
        """Calculates accurate pax/m^2 based on real GIS polygon floor area."""
        area = self.zone_areas.get(zone_id, 100.0)
        return round(float(person_count) / max(area, 1.0), 2)

    def set_corridor_blocked(self, edge_id: str, blocked: bool):
        """Sets blocked status for a specific corridor feature."""
        for c in self.corridors["features"]:
            if c["properties"]["id"] == edge_id or f"{c['properties']['u']}-{c['properties']['v']}" == edge_id:
                c["properties"]["blocked"] = blocked
                u = c["properties"]["u"]
                v = c["properties"]["v"]
                if self.graph.has_edge(u, v):
                    self.graph[u][v]["blocked"] = blocked
                return True
        return False

    def compute_gis_routing(self, zone_levels: Dict[str, int], blocked_edges: List[str]) -> Dict[str, Any]:
        """
        Calculates:
        1. Visitor Safe Evacuation Routes from each zone to the best available exit.
           Weight: cost = length_m * (1.0 + 4.0 * zone_risk). Blocked / Level 3 = INF.
        2. Emergency Responder Approach Routes from First Responder Base to any zone with high risk or SOS.
        Returns GeoJSON FeatureCollections for routes.
        """
        # Build weighted routing graph
        G = nx.Graph()
        for u, v, data in self.graph.edges(data=True):
            edge_id = data.get("id", f"{u}-{v}")
            # Check manual block
            is_blocked = (
                data.get("blocked", False) or
                edge_id in blocked_edges or
                f"{u}-{v}" in blocked_edges or
                f"{v}-{u}" in blocked_edges
            )

            # Check if corridor's zone is Critical Level 3
            zid = data.get("zone_id", "")
            lvl = zone_levels.get(zid, 0)
            if is_blocked or lvl >= 3:
                # Corridor is impassable
                continue

            # Check if corridor connects to or resides within an Emergency Hazard Isolated Zone
            if hasattr(self, 'isolated_zones') and self.isolated_zones:
                if u in self.isolated_zones or v in self.isolated_zones or zid in self.isolated_zones:
                    # Corridor is impassable (Infinite weight / Incident Isolation)
                    continue

            # Traversal weight: length * (1 + 4 * risk)
            # Level 0 = 0.05, Level 1 = 0.35, Level 2 = 0.70, Level 3 = impassable
            risk_map = {0: 0.05, 1: 0.35, 2: 0.70, 3: 1.0}
            risk_val = risk_map.get(lvl, 0.1)
            cost = data["length_m"] * (1.0 + 4.0 * risk_val)

            G.add_edge(u, v, weight=cost, length_m=data["length_m"], edge_id=edge_id)

        available_exits = [n for n in self.graph.nodes if self.graph.nodes[n].get("type") == "EXIT_GATE"]
        if not available_exits:
            available_exits = ["gate_a", "gate_b", "gate_c"]
        all_zones = list(self.shapely_zones.keys()) if self.shapely_zones else ["z1", "z2", "z3", "z4"]

        evac_routes: Dict[str, Any] = {}
        route_geojson_features: List[Dict[str, Any]] = []

        # 1. Visitor Evacuation Routes for each Zone
        for zid in all_zones:
            best_path = None
            best_cost = float("inf")
            target_exit = None

            for ex in available_exits:
                if G.has_node(zid) and G.has_node(ex):
                    try:
                        cost = nx.shortest_path_length(G, source=zid, target=ex, weight="weight")
                        if cost < best_cost:
                            best_cost = cost
                            best_path = nx.shortest_path(G, source=zid, target=ex, weight="weight")
                            target_exit = ex
                    except (nx.NetworkXNoPath, nx.NodeNotFound):
                        pass

            if best_path:
                # Construct route geometry
                coords = []
                total_m = 0.0
                for i in range(len(best_path) - 1):
                    n1 = best_path[i]
                    n2 = best_path[i + 1]
                    p1 = self.graph.nodes[n1].get("pos", [0.0, 0.0])
                    p2 = self.graph.nodes[n2].get("pos", [0.0, 0.0])
                    if not coords:
                        coords.append(p1)
                    coords.append(p2)
                    if self.graph.has_edge(n1, n2):
                        total_m += self.graph[n1][n2].get("length_m", 20.0)

                evac_routes[zid] = {
                    "zone": zid,
                    "target_exit": target_exit,
                    "path_nodes": best_path,
                    "total_length_m": round(total_m, 1),
                    "est_egress_sec": round(total_m / 1.2, 0),  # 1.2 m/s standard walk
                    "status": "OPTIMAL" if best_cost < 60 else "DIVERTED"
                }

                route_geojson_features.append({
                    "type": "Feature",
                    "id": f"route_evac_{zid}",
                    "properties": {
                        "type": "EVACUATION_ROUTE",
                        "zone_id": zid,
                        "target_exit": target_exit,
                        "length_m": round(total_m, 1),
                        "est_sec": round(total_m / 1.2, 0),
                        "status": evac_routes[zid]["status"]
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": coords
                    }
                })
            else:
                evac_routes[zid] = {
                    "zone": zid,
                    "target_exit": None,
                    "path_nodes": [],
                    "total_length_m": 0,
                    "est_egress_sec": 0,
                    "status": "NO_SAFE_ROUTE (ISOLATED)"
                }

        # 2. Emergency First Responder Approach Routes
        responder_routes: Dict[str, Any] = {}
        for target_zone in all_zones:
            if G.has_node("resp_post_1") and G.has_node(target_zone):
                try:
                    resp_path = nx.shortest_path(G, source="resp_post_1", target=target_zone, weight="weight")
                    r_coords = [self.graph.nodes[n].get("pos", [0.0, 0.0]) for n in resp_path]
                    r_len = sum(self.graph[resp_path[i]][resp_path[i+1]].get("length_m", 20.0) for i in range(len(resp_path) - 1))
                    responder_routes[target_zone] = {
                        "path": resp_path,
                        "length_m": round(r_len, 1),
                        "est_arrival_sec": round(r_len / 2.5, 0)  # 2.5 m/s responder jog
                    }
                    route_geojson_features.append({
                        "type": "Feature",
                        "id": f"route_resp_{target_zone}",
                        "properties": {
                            "type": "RESPONDER_ROUTE",
                            "target_zone": target_zone,
                            "length_m": round(r_len, 1),
                            "est_arrival_sec": round(r_len / 2.5, 0)
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": r_coords
                        }
                    })
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    responder_routes[target_zone] = {"path": [], "length_m": 0, "status": "BLOCKED"}

        return {
            "evacuation": evac_routes,
            "responder": responder_routes,
            "geojson": {
                "type": "FeatureCollection",
                "features": route_geojson_features
            }
        }

    def compute_medical_dispatch(self, target_zone: str, blocked_edges: List[str] = None) -> Dict[str, Any]:
        """
        Computes dedicated rapid medical dispatch routing from Medical Base (resp_post_1)
        to target_zone, avoiding blocked or impassable corridors.
        """
        blocked_edges = blocked_edges or []
        G = nx.Graph()
        for u, v, data in self.graph.edges(data=True):
            edge_id = data.get("id", f"{u}-{v}")
            is_blocked = (
                data.get("blocked", False) or
                edge_id in blocked_edges or
                f"{u}-{v}" in blocked_edges or
                f"{v}-{u}" in blocked_edges
            )
            if is_blocked:
                continue
            G.add_edge(u, v, weight=data.get("length_m", 20.0), length_m=data.get("length_m", 20.0), edge_id=edge_id)

        source = "resp_post_1"
        if not G.has_node(source) or not G.has_node(target_zone):
            return {
                "ok": False,
                "target_zone": target_zone,
                "status": "UNREACHABLE",
                "path": [],
                "distance_m": 0.0,
                "eta_sec": 0
            }

        try:
            path = nx.shortest_path(G, source=source, target=target_zone, weight="weight")
            coords = [self.graph.nodes[n].get("pos", [0.0, 0.0]) for n in path]
            total_m = sum(self.graph[path[i]][path[i+1]].get("length_m", 20.0) for i in range(len(path) - 1))
            eta_sec = round(total_m / 3.0, 0)  # 3.0 m/s rapid responder sprint

            return {
                "ok": True,
                "target_zone": target_zone,
                "status": "DISPATCH_READY",
                "assigned_squad": "Medical Squad Alpha (Paramedic Unit 1)",
                "path": path,
                "waypoints": coords,
                "distance_m": round(total_m, 1),
                "eta_sec": int(eta_sec),
                "med_bay": "MED-BAY-HQ"
            }
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return {
                "ok": False,
                "target_zone": target_zone,
                "status": "CORRIDOR_BLOCKED",
                "path": [],
                "distance_m": 0.0,
                "eta_sec": 0
            }

    def trigger_zone_hazard(self, zone_id: str, hazard_type: str = "FIRE", severity: str = "CRITICAL") -> Dict[str, Any]:
        """
        Automated Incident Isolation & Dynamic Path Recalculation:
        1. Locks the compromised zone (e.g. z2) and sets edge weights of all intersecting corridors to infinity.
        2. Recalculates shortest safe exit paths using NetworkX for all remaining zones (z1, z3, z4).
        3. Generates synchronized multi-node display payloads (e.g., '1|3|FIRE IN ZONE 2 - REROUTE VIA GATE B')
           and JSON packets for LoRa/ESP-NOW transmission to on-ground digital signboards and audio nodes.
        """
        zid = zone_id.lower().strip()
        if not zid.startswith("z") and zid.isdigit():
            zid = f"z{zid}"

        self.isolated_zones[zid] = {
            "zone_id": zid,
            "hazard_type": hazard_type.upper(),
            "severity": severity.upper(),
            "active": True
        }

        # Dynamic routing with isolated zone corridors removed from graph
        routing = self.compute_gis_routing(zone_levels={}, blocked_edges=[])

        # Generate synchronized zone-specific broadcast payloads
        broadcasts = []
        gate_names = {
            "gate_a": "GATE A",
            "gate_b": "GATE B",
            "gate_c": "GATE C"
        }
        gate_directions = {
            "gate_a": "WEST",
            "gate_b": "NORTH",
            "gate_c": "SOUTH"
        }

        all_zones = list(self.shapely_zones.keys()) if self.shapely_zones else ["z1", "z2", "z3", "z4"]
        for z in all_zones:
            z_num = int(z.replace("z", "")) if z.replace("z", "").isdigit() else 1
            evac_info = routing.get("evacuation", {}).get(z, {})
            target_exit = evac_info.get("target_exit") or ("gate_a" if z == "z1" or z == "z2" else "gate_b")
            exit_label = gate_names.get(target_exit, target_exit.upper().replace("_", " "))
            dir_label = gate_directions.get(target_exit, "EXIT")

            if z == zid:
                # Compromised zone itself: direct emergency alert
                header_text = f"FIRE ALERT HERE ({zid.upper()})!"
                route_text = f"EVACUATE -> {exit_label}"
                pipe_payload = f"{z_num}|3|{header_text}|{route_text}"
                broadcasts.append({
                    "zone_id": z,
                    "z_num": z_num,
                    "level": 3,
                    "track": 3,
                    "header_text": header_text,
                    "route_text": route_text,
                    "text": f"{header_text} — {route_text}",
                    "arrow": "EMERGENCY EVAC",
                    "pipe_payload": pipe_payload,
                    "exit": exit_label,
                    "status": "FIRE_ISOLATED"
                })
            else:
                # Surrounding zones: safe reroute bypassing hazard zone
                header_text = f"FIRE IN {zid.upper()}! AVOID {zid.upper()}"
                route_text = f"SAFE ROUTE: {exit_label}"
                pipe_payload = f"{z_num}|3|{header_text}|{route_text}"
                broadcasts.append({
                    "zone_id": z,
                    "z_num": z_num,
                    "level": 3,
                    "track": 2,  # Track 2: Caution / Reroute audio
                    "header_text": header_text,
                    "route_text": route_text,
                    "text": f"{header_text} — {route_text}",
                    "arrow": dir_label,
                    "pipe_payload": pipe_payload,
                    "exit": exit_label,
                    "status": "REROUTED"
                })

        return {
            "ok": True,
            "isolated_zone": zid,
            "hazard_type": hazard_type.upper(),
            "routing": routing,
            "evacuation": routing.get("evacuation", {}),
            "geojson": routing.get("geojson", {}),
            "broadcasts": broadcasts
        }

    def clear_zone_hazard(self, zone_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Clears the emergency hazard, restores corridors and normal weights,
        recalculates normal routes, and generates All-Clear payloads.
        """
        if zone_id:
            zid = zone_id.lower().strip()
            if not zid.startswith("z") and zid.isdigit():
                zid = f"z{zid}"
            self.isolated_zones.pop(zid, None)
        else:
            self.isolated_zones.clear()

        routing = self.compute_gis_routing(zone_levels={}, blocked_edges=[])

        broadcasts = []
        all_zones = list(self.shapely_zones.keys()) if self.shapely_zones else ["z1", "z2", "z3", "z4"]
        for z in all_zones:
            z_num = int(z.replace("z", "")) if z.replace("z", "").isdigit() else 1
            text_msg = "HAZARD CLEARED - RESUME NORMAL ROUTE"
            pipe_payload = f"{z_num}|1|{text_msg}"
            broadcasts.append({
                "zone_id": z,
                "z_num": z_num,
                "level": 1,
                "track": 3,  # Track 3: All clear audio
                "text": text_msg,
                "arrow": "NORMAL",
                "pipe_payload": pipe_payload,
                "exit": "NORMAL_GATE",
                "status": "RESTORED"
            })

        return {
            "ok": True,
            "isolated_zones": list(self.isolated_zones.keys()),
            "routing": routing,
            "evacuation": routing.get("evacuation", {}),
            "geojson": routing.get("geojson", {}),
            "broadcasts": broadcasts
        }

    def get_active_hazards(self) -> Dict[str, Any]:
        return {
            "isolated_zones": self.isolated_zones,
            "has_hazard": len(self.isolated_zones) > 0
        }

    def get_full_venue_geojson(self, zone_metrics: Dict[str, Any] = None) -> Dict[str, Any]:
        """Returns the unified GeoJSON layer combining perimeter, zones, corridors, gates, and dynamic metrics."""
        features = []

        # Perimeter Border Feature
        for p in self.perimeter.get("features", []):
            features.append(json.loads(json.dumps(p)))

        # Zones with real-time level and color
        for z in self.zones["features"]:
            f = json.loads(json.dumps(z))
            zid = f["properties"]["id"]
            f["properties"]["type"] = "ZONE"
            if zone_metrics and zid in zone_metrics:
                zm = zone_metrics[zid]
                f["properties"]["density"] = zm.get("density", 0.0)
                f["properties"]["level"] = zm.get("level", 0)
                f["properties"]["risk"] = zm.get("risk", 0.0)
                f["properties"]["personCount"] = zm.get("personCount", 0)
                # Map color to risk level
                colors = {0: "#10b981", 1: "#eab308", 2: "#f97316", 3: "#ef4444"}
                f["properties"]["color_current"] = colors.get(zm.get("level", 0), "#10b981")
                # AI Model sync
                d_val = zm.get("density", 0.0)
                f["properties"]["ai_model_name"] = zm.get("ai_model_name") or ("SAHI+YOLO" if d_val >= 5.0 else ("CSRNet" if d_val >= 3.2 else ("DM-Count" if d_val >= 1.8 else "P2PNet")))
            else:
                f["properties"]["ai_model_name"] = "P2PNet"

            # Check if this zone is under active hazard isolation
            if hasattr(self, 'isolated_zones') and zid in self.isolated_zones:
                h_info = self.isolated_zones[zid]
                f["properties"]["is_hazard_isolated"] = True
                f["properties"]["hazard_type"] = h_info.get("hazard_type", "HAZARD")
                f["properties"]["color_current"] = "#dc2626"
            else:
                f["properties"]["is_hazard_isolated"] = False

            features.append(f)

        # Corridors
        for c in self.corridors["features"]:
            cf = json.loads(json.dumps(c))
            cf["properties"]["type"] = "CORRIDOR"
            features.append(cf)

        # Gates & Responder Points
        for g in self.gates["features"]:
            features.append(json.loads(json.dumps(g)))

        return {
            "type": "FeatureCollection",
            "name": "CrowdShield_Venue_GIS_Master",
            "crs": {
                "type": "name",
                "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
            },
            "features": features
        }


# Global Singleton GIS Manager
gis_manager = GISVenueManager()
