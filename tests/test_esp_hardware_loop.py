"""
CrowdShield Direct Async End-to-End ESP Hardware Mesh & Warning Dispatch Test
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend_server import (
    app,
    state,
    downlink_queue,
    post_node,
    dispatch_downlink,
    get_pending_downlink,
    NodeEvent,
    DownlinkCmd
)


async def run_tests():
    print("[1] Testing Normal Zonal Uplink...")
    hb = NodeEvent(z=1, sos=0, mo=0, seq=1, rssi=-62, batteryVolts=4.15, batteryPct=92)
    res1 = await post_node(hb)
    assert res1["ok"] is True
    assert state["nodes"]["1"]["online"] is True
    assert state["nodes"]["1"]["sos"] == 0
    print("    -> Zone 1 online, normal heartbeat registered.")

    print("\n[2] Testing Physical SOS Button Press on Zone 1 (GPIO 13 LOW)...")
    sos = NodeEvent(z=1, sos=1, mo=0, seq=2, rssi=-60, batteryVolts=4.12, batteryPct=90)
    res_sos = await post_node(sos)
    assert res_sos["ok"] is True
    assert state["nodes"]["1"]["sos"] == 1

    sos_alerts = [a for a in state["alerts"] if a["type"] == "sos_hardware" and a["zone"] == "z1"]
    assert len(sos_alerts) > 0, "Hardware SOS alert must be raised on zone z1"
    assert sos_alerts[0]["level"] == 3
    print(f"    -> CONFIRMED HARDWARE SOS Alert Raised: {sos_alerts[0]['text_en']}")

    print("\n[3] Testing Operator Warning Dispatch (3 Presets)...")
    downlink_queue.clear()

    # Preset 1: Emergency Evacuation
    cmd1 = DownlinkCmd(z=1, lvl=3, action="LED_AND_AUDIO", instruction="0001.mp3")
    await dispatch_downlink(cmd1)
    q1 = await get_pending_downlink()
    assert q1["downlink"] is not None
    assert q1["downlink"]["z"] == 1
    assert q1["downlink"]["track"] == 1
    assert q1["downlink"]["cmd"] == "PLAY"
    print(f"    -> Preset 1 dispatched: Track {q1['downlink']['track']} ({q1['downlink']['instruction']}) to Zone {q1['downlink']['z']}")

    # Preset 2: Crowd Caution / Slow Down
    cmd2 = DownlinkCmd(z=2, lvl=2, action="LED_AND_AUDIO", instruction="0002.mp3")
    await dispatch_downlink(cmd2)
    q2 = await get_pending_downlink()
    assert q2["downlink"] is not None
    assert q2["downlink"]["z"] == 2
    assert q2["downlink"]["track"] == 2
    print(f"    -> Preset 2 dispatched: Track {q2['downlink']['track']} ({q2['downlink']['instruction']}) to Zone {q2['downlink']['z']}")

    # Preset 3: All Clear / Standby
    cmd3 = DownlinkCmd(z=3, lvl=1, action="LED_AND_AUDIO", instruction="0003.mp3")
    await dispatch_downlink(cmd3)
    q3 = await get_pending_downlink()
    assert q3["downlink"] is not None
    assert q3["downlink"]["z"] == 3
    assert q3["downlink"]["track"] == 3
    print(f"    -> Preset 3 dispatched: Track {q3['downlink']['track']} ({q3['downlink']['instruction']}) to Zone {q3['downlink']['z']}")

    print("\n[4] Testing Downlink Delivery via Next Telemetry Ingest...")
    downlink_queue.clear()
    await dispatch_downlink(cmd1)
    res_uplink = await post_node(NodeEvent(z=1, sos=0, seq=10, rssi=-64))
    assert res_uplink["downlink"] is not None
    assert res_uplink["downlink"]["track"] == 1
    print(f"    -> Downlink successfully piggybacked in /node response for Gateway: Track {res_uplink['downlink']['track']}")

    print("\n" + "=" * 60)
    print(" [SUCCESS] ALL ESP HARDWARE & PRESET DISPATCH TESTS PASSED 100%!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_tests())
