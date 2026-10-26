import sys
sys.path.append(r'D:\crowdshield')
from gis_engine import gis_manager

print('=== 1. TRIGGERING FIRE HAZARD IN ZONE 2 ===')
trigger_res = gis_manager.trigger_zone_hazard('z2', 'FIRE', 'CRITICAL')
print('OK:', trigger_res['ok'])
print('Isolated Zone:', trigger_res['isolated_zone'])
print('Active Hazards:', gis_manager.get_active_hazards())

print('\n=== 2. EVACUATION PATHFINDING RESULTS (NetworkX) ===')
evac = trigger_res['evacuation']
for z, info in evac.items():
    print(f'  {z.upper()} -> Target Exit: {info.get("target_exit")} | Length: {info.get("total_length_m")}m | Path: {info.get("path_nodes")}')

print('\n=== 3. GENERATED FIELD DISPLAY / SIGNBOARD BROADCAST PAYLOADS ===')
for b in trigger_res['broadcasts']:
    print(f'  [Node {b["zone_id"].upper()}] Pipe: "{b["pipe_payload"]}" | Arrow: {b["arrow"]} | Track: {b["track"]}')

print('\n=== 4. CLEARING HAZARD ===')
clear_res = gis_manager.clear_zone_hazard('z2')
print('OK:', clear_res['ok'])
for b in clear_res['broadcasts']:
    print(f'  [Node {b["zone_id"].upper()}] Pipe: "{b["pipe_payload"]}" | Track: {b["track"]}')
