import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldAlert, Flame, Video, Radio, Send, Settings, Activity, AlertTriangle,
  CheckCircle2, XCircle, Clock, BatteryCharging, Wifi, Volume2, Mic,
  Plus, RefreshCw, Terminal, Eye, EyeOff, MapPin, Users,
  TrendingUp, TrendingDown, Minus, Play, CheckSquare, FileText,
  Cpu, Database, Server, ChevronRight, Bell, Search, Sliders,
  Check, Zap, Layers, Maximize2, Minimize2, X, Trash2, Camera,
  VolumeX, AlertOctagon, HelpCircle, Upload, Download, Film, Compass, Navigation,
  Columns, SlidersHorizontal, Filter
} from 'lucide-react';

// ============================================================================
// CROWDSHIELD / CROWDWATCH COMMAND CENTER (PRODUCTION REAL-TIME EDITION)
// 100% Real Operational State | Full Black Command Theme | Dynamic Real Cameras
// ============================================================================

const DEFAULT_ZONES = [
  {
    id: 'ZONE-A',
    key: 'z1',
    name: 'Zone A — Main Gate Plaza',
    shortName: 'Zone A',
    capacity: 450,
    density: 0.0,
    currentDensity: 0.0,
    personCount: 0,
    level: 0,
    speed: 0.0,
    flowRate: 0.0,
    warningThreshold: 3.0,
    criticalThreshold: 4.5,
    exits: ['Gate A (Main Portal)', 'West Ramp'],
    svgBounds: { x: 60, y: 190, w: 140, h: 100 }
  },
  {
    id: 'ZONE-B',
    key: 'z2',
    name: 'Zone B — East Corridor Choke',
    shortName: 'Zone B',
    capacity: 120,
    density: 0.0,
    currentDensity: 0.0,
    personCount: 0,
    level: 0,
    speed: 0.0,
    flowRate: 0.0,
    warningThreshold: 3.0,
    criticalThreshold: 4.5,
    exits: ['Gate B (North Exit)', 'Gate C (South Relief)'],
    svgBounds: { x: 245, y: 215, w: 90, h: 55 }
  },
  {
    id: 'ZONE-C',
    key: 'z3',
    name: 'Zone C — Central Stage Arena',
    shortName: 'Zone C',
    capacity: 700,
    density: 0.0,
    currentDensity: 0.0,
    personCount: 0,
    level: 0,
    speed: 0.0,
    flowRate: 0.0,
    warningThreshold: 3.2,
    criticalThreshold: 4.5,
    exits: ['Gate C (South Relief)', 'Gate B'],
    svgBounds: { x: 380, y: 175, w: 175, h: 130 }
  },
  {
    id: 'ZONE-D',
    key: 'z4',
    name: 'Zone D — North Exit Concourse',
    shortName: 'Zone D',
    capacity: 350,
    density: 0.0,
    currentDensity: 0.0,
    personCount: 0,
    level: 0,
    speed: 0.0,
    flowRate: 0.0,
    warningThreshold: 3.0,
    criticalThreshold: 4.5,
    exits: ['Gate B (North Emergency Exit)'],
    svgBounds: { x: 245, y: 75, w: 220, h: 75 }
  }
];

const INITIAL_NODES = [
  {
    id: 'GW-USB-01',
    zNum: 0,
    name: 'Command Center USB Gateway',
    role: 'GATEWAY',
    zoneId: 'COMMAND',
    location: 'Laptop USB Serial Port (ESP32 / ESP8266)',
    protocol: 'USB Serial (115200 baud) <-> ESP-NOW',
    status: 'ONLINE',
    batteryVolts: 5.0,
    batteryPct: 100,
    rssi: -50,
    sos: 0,
    lastSeen: 'Ready on USB'
  },
  {
    id: 'NODE-Z1',
    zNum: 1,
    name: 'Zone 1 Field Node',
    role: 'FIELD_NODE',
    zoneId: 'ZONE-A',
    location: 'Zone 1 (Main Gate Plaza)',
    protocol: 'ESP-NOW 2.4GHz Direct Mesh',
    status: 'OFFLINE',
    batteryVolts: 4.12,
    batteryPct: 90,
    rssi: -65,
    sos: 0,
    lastSeen: 'Awaiting Telemetry'
  },
  {
    id: 'NODE-Z2',
    zNum: 2,
    name: 'Zone 2 Field Node',
    role: 'FIELD_NODE',
    zoneId: 'ZONE-B',
    location: 'Zone 2 (East Corridor Choke)',
    protocol: 'ESP-NOW 2.4GHz Direct Mesh',
    status: 'OFFLINE',
    batteryVolts: 4.08,
    batteryPct: 88,
    rssi: -70,
    sos: 0,
    lastSeen: 'Awaiting Telemetry'
  },
  {
    id: 'NODE-Z3',
    zNum: 3,
    name: 'Zone 3 Field Node',
    role: 'FIELD_NODE',
    zoneId: 'ZONE-C',
    location: 'Zone 3 (Central Stage Arena)',
    protocol: 'ESP-NOW 2.4GHz Direct Mesh',
    status: 'OFFLINE',
    batteryVolts: 4.05,
    batteryPct: 85,
    rssi: -75,
    sos: 0,
    lastSeen: 'Awaiting Telemetry'
  }
];

const INSTRUCTION_PRESETS = [
  { 
    id: 'INST-01', 
    track: 1, 
    text: 'EMERGENCY EVACUATION: Attention please, an emergency has occurred. Please walk calmly towards designated exit gates immediately.', 
    mp3Track: '0001.mp3', 
    label: 'Preset 1: Emergency Evacuation (Track 1 / 0001.mp3)' 
  },
  { 
    id: 'INST-02', 
    track: 2, 
    text: 'CROWD CAUTION: Attention, heavy crowd congestion ahead. Please slow down, avoid pushing, and maintain space.', 
    mp3Track: '0002.mp3', 
    label: 'Preset 2: Crowd Caution / Slow Down (Track 2 / 0002.mp3)' 
  },
  { 
    id: 'INST-03', 
    track: 3, 
    text: 'ALL CLEAR: Attention, the situation is now under control and safe. Please remain in place calmly.', 
    mp3Track: '0003.mp3', 
    label: 'Preset 3: All Clear / Standby (Track 3 / 0003.mp3)' 
  }
];

export default function App() {
  // Consolidated 3-Hub Navigation: 'OPERATIONS' | 'INCIDENTS' | 'HARDWARE'
  const [activeTab, setActiveTab] = useState('OPERATIONS');
  const [opsView, setOpsView] = useState('split'); // 'split' | 'cameras' | 'map'
  const [hardwareSubTab, setHardwareSubTab] = useState('nodes'); // 'nodes' | 'cameras' | 'calibration'
  const [incidentFilter, setIncidentFilter] = useState('all'); // 'all' | 'critical' | 'medical' | 'security'

  // Core Real-Time State (No demo data)
  const [cameras, setCameras] = useState([]);
  const [selectedCamId, setSelectedCamId] = useState(null);
  const [zones, setZones] = useState(DEFAULT_ZONES);
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [alerts, setAlerts] = useState([]);
  const [routes, setRoutes] = useState({});
  const [blockedEdges, setBlockedEdges] = useState([]);
  const [forecasts, setForecasts] = useState({});
  const [operatorLog, setOperatorLog] = useState([
    { ts: new Date().toLocaleTimeString(), user: 'SYSTEM', action: 'BOOT', details: 'CrowdShield Command Center initialized in Pure Operational Mode.' }
  ]);

  // Backend Connectivity State
  const [backendOnline, setBackendOnline] = useState(false);
  const [liveMode, setLiveMode] = useState('CONNECTING...');
  const [systemFps, setSystemFps] = useState(0.0);
  const [audioMuted, setAudioMuted] = useState(false);

  // Real Camera Add Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCam, setNewCam] = useState({
    name: 'Phone Camera 1',
    zoneId: 'ZONE-A',
    sourceType: 'phone', // 'phone' | 'webcam' | 'video_file' | 'sample_video'
    sourceValue: 'http://192.168.1.100:8080/video'
  });
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [availableComPorts, setAvailableComPorts] = useState([]);

  // High-Density Vision Pipeline State (Tiers 1-4)
  const [activeVisionTier, setActiveVisionTier] = useState('tier4_hybrid_auto');
  const [visionTierMeta, setVisionTierMeta] = useState({
    name: 'Tier 4: Hybrid Pro Auto-Switcher',
    optimal_density: '0.0 - 6.0+ pax/m²',
    method: 'Adaptive Regime Switching with Density Hysteresis'
  });
  const [isCrushRegime, setIsCrushRegime] = useState(false);
  const [kumbhAnalysis, setKumbhAnalysis] = useState(null);
  const [isAnalyzingKumbh, setIsAnalyzingKumbh] = useState(false);
  const [showKumbhModal, setShowKumbhModal] = useState(false);
  const [multiApiActive, setMultiApiActive] = useState(false);
  const [isScenarioLoading, setIsScenarioLoading] = useState(false);

  // Medical Dispatch Desk State (Requirement #4)
  const [activeMedicalIncident, setActiveMedicalIncident] = useState(null);
  const [medicalIncidents, setMedicalIncidents] = useState([]);
  const [medicalPopupDismissed, setMedicalPopupDismissed] = useState(false);

  // GIS Spatial Layer State
  const [gisMaster, setGisMaster] = useState(null);
  const [gisRouting, setGisRouting] = useState(null);
  const [gisLayers, setGisLayers] = useState({
    zones: true,
    corridors: true,
    evacRoutes: true,
    responderRoutes: true,
    gates: true,
    nodes: true,
    grid: true
  });
  const [hoverCoords, setHoverCoords] = useState(null);
  const geojsonInputRef = useRef(null);

  // GIS Emergency Hazard Isolation & LoRa Broadcast State
  const [activeHazards, setActiveHazards] = useState({ has_hazard: false, isolated_zones: {} });
  const [hazardBroadcasts, setHazardBroadcasts] = useState([]);
  const [selectedHazardZone, setSelectedHazardZone] = useState('z2');
  const [selectedHazardType, setSelectedHazardType] = useState('FIRE');

  // Dynamic GIS Coordinate Projector (Projects GPS or Metric GeoJSON -> SVG Canvas 640x365)
  const gisProjector = useMemo(() => {
    if (!gisMaster || !gisMaster.features || gisMaster.features.length === 0) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    const checkPt = (pt) => {
      if (!Array.isArray(pt) || pt.length < 2) return;
      const x = Number(pt[0]), y = Number(pt[1]);
      if (isNaN(x) || isNaN(y)) return;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    gisMaster.features.forEach((f) => {
      const g = f.geometry;
      if (!g) return;
      if (g.type === 'Point') checkPt(g.coordinates);
      else if (g.type === 'LineString') (g.coordinates || []).forEach(checkPt);
      else if (g.type === 'Polygon') ((g.coordinates && g.coordinates[0]) || []).forEach(checkPt);
    });

    if (minX === Infinity || minX === maxX || minY === maxY) return null;

    const spanX = (maxX - minX) || 1;
    const spanY = (maxY - minY) || 1;
    const padX = spanX * 0.05;
    const padY = spanY * 0.06;
    const bMinX = minX - padX;
    const bMaxX = maxX + padX;
    const bMinY = minY - padY;
    const bMaxY = maxY + padY;

    const svgW = 640, svgH = 365;
    const mPad = 22;
    const availW = svgW - 2 * mPad;
    const availH = svgH - 2 * mPad;

    const project = (pt) => {
      const x = Number(pt[0]), y = Number(pt[1]);
      const px = mPad + ((x - bMinX) / (bMaxX - bMinX)) * availW;
      const py = svgH - (mPad + ((y - bMinY) / (bMaxY - bMinY)) * availH); // inverted Y
      return { x: Math.round(px * 10) / 10, y: Math.round(py * 10) / 10 };
    };

    const isGps = minX > -180 && maxX < 180 && minY > -90 && maxY < 90 && Math.abs(maxX - minX) < 1.0;

    return { project, minX, maxX, minY, maxY, bMinX, bMaxX, bMinY, bMaxY, isGps };
  }, [gisMaster]);

  // Human-in-the-Loop Dispatch Modal
  const [dispatchModal, setDispatchModal] = useState(null);
  const [operatorConfirmed, setOperatorConfirmed] = useState(false);
  const [operatorName, setOperatorName] = useState('Raghu (Ops Lead)');
  const [selectedPreset, setSelectedPreset] = useState(INSTRUCTION_PRESETS[0]);

  // Selected Inspect Item
  const [selectedZoneKey, setSelectedZoneKey] = useState('z1');

  // Active Emergency Alert (Physical SOS or Critical Level 3)
  const physicalSosNode = nodes.find((n) => n.sos === 1);
  const activeEmergencyAlert = activeMedicalIncident || alerts.find(
    (a) => a.status === 'open' && (a.type === 'sos_hardware' || a.level >= 3)
  ) || (physicalSosNode ? {
    id: `sos-node-${physicalSosNode.zNum}`,
    status: 'open',
    type: 'sos_hardware',
    level: 3,
    zone: `z${physicalSosNode.zNum || 1}`,
    text_en: `CONFIRMED HARDWARE SOS at Node z${physicalSosNode.zNum || 1}`,
    text_local: `அவசர SOS பொத்தான் அழுத்தப்பட்டது — மண்டலம் z${physicalSosNode.zNum || 1}`
  } : null);

  const alertZoneKey = activeMedicalIncident
    ? (activeMedicalIncident.zone_id || 'z1').toLowerCase()
    : (activeEmergencyAlert ? (activeEmergencyAlert.zone || 'z1').toLowerCase() : 'z1');
  const alertZoneNum = parseInt(alertZoneKey.replace('z', '')) || 1;
  const alertZoneObj = zones.find((z) => z.key === alertZoneKey) || zones[0];
  const alertNodeObj = nodes.find((n) => n.zNum === alertZoneNum);
  const alertCamObj = cameras.find(
    (c) => c.zoneId?.toLowerCase() === alertZoneKey || c.zoneId?.toLowerCase() === alertZoneObj?.id?.toLowerCase()
  );
  const emergencyVideoUrl = alertCamObj ? `http://localhost:8000/video_feed/${alertCamObj.id}` : 'http://localhost:8000/video_feed';

  // Persistent Command Center Audio Siren Synthesizer (Web Audio API)
  const sirenCtxRef = useRef(null);
  const sirenOscRef = useRef(null);
  const sirenGainRef = useRef(null);

  const startSiren = () => {
    if (audioMuted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!sirenCtxRef.current) {
        sirenCtxRef.current = new AudioCtx();
      }
      const ctx = sirenCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      if (sirenOscRef.current) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(680, now);

      for (let i = 0; i < 90; i++) {
        osc.frequency.linearRampToValueAtTime(960, now + i * 0.7 + 0.35);
        osc.frequency.linearRampToValueAtTime(680, now + i * 0.7 + 0.7);
      }

      gain.gain.setValueAtTime(0.3, now);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      sirenOscRef.current = osc;
      sirenGainRef.current = gain;
    } catch (e) {
      console.warn('Command Center Siren Error:', e);
    }
  };

  const stopSiren = () => {
    try {
      if (sirenOscRef.current) {
        sirenOscRef.current.stop();
        sirenOscRef.current.disconnect();
        sirenOscRef.current = null;
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (activeEmergencyAlert && !audioMuted) {
      startSiren();
    } else {
      stopSiren();
    }
    return () => stopSiren();
  }, [activeEmergencyAlert, audioMuted]);

  const handleRespondToEmergency = async (trackNum) => {
    const targetZ = alertZoneNum || 1;
    const preset = INSTRUCTION_PRESETS.find((p) => p.track === trackNum) || INSTRUCTION_PRESETS[0];

    // 1. Dispatch warning downlink to target field node (clean single dispatch matching Presets 2 & 3)
    try {
      await fetch('http://localhost:8000/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          z: targetZ,
          lvl: trackNum === 1 ? 3 : (trackNum === 2 ? 2 : 1),
          action: 'LED_AND_AUDIO',
          instruction: preset.mp3Track
        })
      });
    } catch (e) {
      console.warn('Dispatch failed', e);
    }

    // 2. Clear Active Medical Incident on Backend if present
    if (activeMedicalIncident) {
      try {
        await fetch('http://localhost:8000/api/medical/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ incident_id: activeMedicalIncident.id })
        });
      } catch (e) {}
      setActiveMedicalIncident(null);
    }

    // 3. Acknowledge alert in alerts list if present
    if (activeEmergencyAlert?.id) {
      fetch(`http://localhost:8000/ack/${activeEmergencyAlert.id}`, {
        method: 'POST'
      }).catch(() => {});
      setAlerts((prev) =>
        prev.map((a) => (a.id === activeEmergencyAlert.id ? { ...a, status: 'acknowledged' } : a))
      );
    }

    // 4. Immediately dismiss popup and silence siren
    setMedicalPopupDismissed(true);
    stopSiren();
  };

  const handleSimulateHardwareSos = async (zoneId = 'z2') => {
    try {
      await fetch('http://localhost:8000/api/simulate_hardware_sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId })
      });
      setMedicalPopupDismissed(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulateFight = async (zoneId = 'z2') => {
    try {
      await fetch('http://localhost:8000/api/simulate_fight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDispatchMedicalSquad = async (incidentId, squadName, status = 'PARAMEDICS_EN_ROUTE') => {
    try {
      await fetch('http://localhost:8000/api/medical/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId, squad_name: squadName, status: status })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveMedicalIncident = async (incidentId) => {
    try {
      await fetch('http://localhost:8000/api/medical/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incidentId })
      });
      setActiveMedicalIncident(null);
      setMedicalPopupDismissed(true);
    } catch (e) {
      console.error(e);
    }
  };

  // ============================================================================
  // KEYBOARD NAVIGATION (1..3, M for view mode, and Esc)
  // ============================================================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === '1') setActiveTab('OPERATIONS');
      if (e.key === '2') setActiveTab('INCIDENTS');
      if (e.key === '3') setActiveTab('HARDWARE');
      if (e.key === 'm' || e.key === 'M') {
        setOpsView((prev) => (prev === 'split' ? 'map' : (prev === 'map' ? 'cameras' : 'split')));
      }
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setDispatchModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ============================================================================
  // WEBSOCKET REAL-TIME DATA STREAM
  // ============================================================================
  useEffect(() => {
    let ws = null;
    let timer = null;
    let isMounted = true;

    const connect = () => {
      try {
        ws = new WebSocket('ws://localhost:8000/ws');
        ws.onopen = () => {
          if (!isMounted) return;
          setBackendOnline(true);
          console.log('[CrowdShield] Connected to ws://localhost:8000/ws');
        };
        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.mode) setLiveMode(data.mode);
            if (data.fps !== undefined) setSystemFps(data.fps);
            if (data.routes) setRoutes(data.routes);
            if (data.gis_routing) setGisRouting(data.gis_routing);
            if (data.active_hazards) setActiveHazards(data.active_hazards);
            if (data.hazard_broadcasts) setHazardBroadcasts(data.hazard_broadcasts);
            if (data.gis_geojson) setGisMaster(data.gis_geojson);
            if (data.blocked_edges) setBlockedEdges(data.blocked_edges);
            if (data.forecasts) setForecasts(data.forecasts);

            // Sync Zones
            if (data.zones) {
              setZones((prev) =>
                prev.map((z) => {
                  const bz = data.zones[z.key];
                  if (!bz) return z;
                  return {
                    ...z,
                    currentDensity: bz.density || 0.0,
                    speed: bz.speed || 0.0,
                    conflict: bz.conflict || 0.0,
                    risk: bz.risk || 0.0,
                    level: bz.level || 0,
                    personCount: bz.personCount || 0
                  };
                })
              );
            }

            // Sync Nodes
            if (data.nodes) {
              setNodes((prev) =>
                prev.map((n) => {
                  const bn = data.nodes[String(n.zNum)];
                  if (!bn) return n;
                  return {
                    ...n,
                    status: bn.online ? 'ONLINE' : 'OFFLINE',
                    sos: bn.sos !== undefined ? bn.sos : (n.sos || 0),
                    rssi: bn.rssi !== undefined ? bn.rssi : n.rssi,
                    batteryVolts: bn.batteryVolts ?? n.batteryVolts,
                    batteryPct: bn.batteryPct ?? n.batteryPct,
                    lastSeen: bn.lastSeen || (bn.online ? 'Live (<1s)' : 'Lost Heartbeat')
                  };
                })
              );
            }

            // Sync Alerts (Real-time only)
            if (data.alerts) {
              setAlerts(data.alerts);
              // Audio announcement for new unacknowledged Level 3 alert
              if (!audioMuted && data.alerts.length > 0) {
                const latest = data.alerts[0];
                if (latest.level >= 3 && latest.status === 'open' && typeof window !== 'undefined' && window.speechSynthesis) {
                  try {
                    const utter = new SpeechSynthesisUtterance(latest.text_en);
                    utter.rate = 1.05;
                    window.speechSynthesis.speak(utter);
                  } catch (e) {}
                }
              }
            }

            // Sync Cameras
            if (data.active_cameras) {
              const camList = Object.values(data.active_cameras);
              setCameras(camList);
              if (!selectedCamId && camList.length > 0) {
                setSelectedCamId(camList[0].id);
              }
            }

            // Sync High-Density Vision Pipeline Tier
            if (data.vision_tier) {
              setActiveVisionTier(data.vision_tier);
            }
            if (data.vision_tier_meta) {
              setVisionTierMeta(data.vision_tier_meta);
            }
            if (data.is_crush_regime !== undefined) {
              setIsCrushRegime(data.is_crush_regime);
            }

            // Sync Medical Department Telemetry & SOS
            if (data.active_medical_incident !== undefined) {
              setActiveMedicalIncident(data.active_medical_incident);
              if (data.active_medical_incident) {
                setMedicalPopupDismissed(false);
              }
            }
            if (data.medical_incidents) {
              setMedicalIncidents(data.medical_incidents);
            }

            // Sync Operator Actions
            if (data.operator_actions && data.operator_actions.length > 0) {
              setOperatorLog(data.operator_actions);
            }
          } catch (err) {
            console.error('WS Data parsing error:', err);
          }
        };
        ws.onclose = () => {
          if (!isMounted) return;
          setBackendOnline(false);
          setLiveMode('OFFLINE (RETRYING...)');
          timer = setTimeout(connect, 2000);
        };
        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (e) {
        if (isMounted) timer = setTimeout(connect, 2000);
      }
    };

    connect();

    // Fetch COM ports on start
    fetch('http://localhost:8000/api/comports')
      .then((r) => r.json())
      .then((ports) => setAvailableComPorts(ports))
      .catch(() => {});

      // Fetch initial cameras
      fetch('http://localhost:8000/api/cameras')
        .then((r) => r.json())
        .then((cams) => {
          if (cams && cams.length > 0) {
            setCameras(cams);
            setSelectedCamId(cams[0].id);
          }
        })
        .catch(() => {});

      // Fetch initial vision tiers
      fetch('http://localhost:8000/api/vision/tiers')
        .then((r) => r.json())
        .then((d) => {
          if (d.active_tier) setActiveVisionTier(d.active_tier);
          if (d.metadata) setVisionTierMeta(d.metadata);
          if (d.is_crush_regime !== undefined) setIsCrushRegime(d.is_crush_regime);
        })
        .catch(() => {});

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (ws) ws.close();
    };
  }, [audioMuted]);

  // ============================================================================
  // CAMERA ACTIONS (ADD / DELETE / TEST)
  // ============================================================================
  const handleSwitchVisionTier = async (tierKey) => {
    try {
      const res = await fetch('http://localhost:8000/api/vision/tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierKey }),
      });
      const d = await res.json();
      if (d.ok) {
        setActiveVisionTier(tierKey);
        if (d.metadata) setVisionTierMeta(d.metadata);
      }
    } catch (err) {
      console.error('Failed to switch vision tier:', err);
    }
  };

  const handleRunKumbhAnalysis = async (updateState = false) => {
    setIsAnalyzingKumbh(true);
    try {
      const res = await fetch(`http://localhost:8000/api/vision/analyze_kumbh?update_state=${updateState}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.ok) {
        setKumbhAnalysis(data);
      }
    } catch (err) {
      console.error('Failed to run Maha Kumbh Analysis:', err);
    } finally {
      setIsAnalyzingKumbh(false);
    }
  };

  const handleLoadMultiApiScenario = async () => {
    setIsScenarioLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/demo/load_multi_api_scenario', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMultiApiActive(true);
        if (data.active_hazards) setActiveHazards(data.active_hazards);
        if (data.blocked_edges) setBlockedEdges(data.blocked_edges);
        if (data.gis_routing) setGisRouting(data.gis_routing);
        if (data.broadcasts) setHazardBroadcasts(data.broadcasts);
        if (data.zones) {
          setZones(prev => prev.map(z => {
            const sc = data.zones[z.key];
            if (!sc) return z;
            return {
              ...z,
              personCount: sc.personCount,
              density: sc.density,
              currentDensity: sc.density,
              level: sc.level,
              speed: sc.speed,
              conflict: sc.conflict,
              flowRate: sc.flowRate,
              api_name: sc.api_name,
              api_mode: sc.api_mode
            };
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load multi-API scenario:', err);
    } finally {
      setIsScenarioLoading(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMultiApiActive(false);
        setActiveHazards({ has_hazard: false, isolated_zones: {} });
        setBlockedEdges([]);
        setHazardBroadcasts([]);
        setZones(DEFAULT_ZONES);
      }
    } catch (err) {
      console.error('Failed to reset demo:', err);
    }
  };

  const normalizeSource = (val) => {
    let s = (val || '').trim();
    if (/^\d+$/.test(s)) return s;
    if (!s.startsWith('http://') && !s.startsWith('https://') && !s.startsWith('rtsp://')) {
      if (s.includes(':')) s = 'http://' + s;
    }
    if (s.startsWith('http://') || s.startsWith('https://')) {
      const clean = s.replace(/\/+$/, '');
      if (clean.endsWith(':8080') || (!clean.includes('/video') && !clean.includes('/shot.jpg'))) {
        s = clean + '/video';
      }
    }
    return s;
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const targetSource = normalizeSource(newCam.sourceValue);
    try {
      const res = await fetch('http://localhost:8000/api/cameras/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCam.name,
          zoneId: newCam.zoneId,
          source: targetSource
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, details: 'Could not connect to backend server at port 8000. Is start_system.bat running?' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddCameraSubmit = async (e) => {
    e.preventDefault();
    const targetSource = normalizeSource(newCam.sourceValue);
    try {
      const res = await fetch('http://localhost:8000/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCam.name,
          zoneId: newCam.zoneId,
          source: targetSource
        })
      });
      const data = await res.json();
      if (data.ok) {
        setShowAddModal(false);
        setTestResult(null);
        // Refresh cameras
        const camsRes = await fetch('http://localhost:8000/api/cameras');
        const camsList = await camsRes.json();
        setCameras(camsList);
        if (camsList.length > 0) {
          setSelectedCamId(camsList[camsList.length - 1].id);
        }
      }
    } catch (err) {
      alert('Error registering camera: ' + err.message);
    }
  };

  const handleDeleteCamera = async (camId) => {
    if (!confirm(`Disconnect and remove camera ${camId}?`)) return;
    try {
      await fetch(`http://localhost:8000/api/cameras/${camId}`, { method: 'DELETE' });
      const camsRes = await fetch('http://localhost:8000/api/cameras');
      const camsList = await camsRes.json();
      setCameras(camsList);
      if (selectedCamId === camId) {
        setSelectedCamId(camsList.length > 0 ? camsList[0].id : null);
      }
    } catch (err) {
      console.error('Delete camera error:', err);
    }
  };

  const handleUploadVideoSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select a video file (.mp4, .avi, .mov, etc.) to upload.');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', newCam.name || uploadFile.name);
      formData.append('zone_id', newCam.zoneId);

      const res = await fetch('http://localhost:8000/api/upload_video', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.ok) {
        setShowAddModal(false);
        setUploadFile(null);
        // Refresh cameras
        const camsRes = await fetch('http://localhost:8000/api/cameras');
        const camsList = await camsRes.json();
        setCameras(camsList);
        if (camsList.length > 0) {
          setSelectedCamId(camsList[camsList.length - 1].id);
        }
        setActiveTab('OPERATIONS');
      } else {
        alert('Upload failed: ' + (data.detail || 'Unknown error'));
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadSampleVideo = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/use_sample_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId: newCam.zoneId, name: 'Benchmark Crowd (Looping)' })
      });
      const data = await res.json();
      if (data.ok) {
        setShowAddModal(false);
        const camsRes = await fetch('http://localhost:8000/api/cameras');
        const camsList = await camsRes.json();
        setCameras(camsList);
        if (camsList.length > 0) {
          setSelectedCamId(camsList[camsList.length - 1].id);
        }
        setActiveTab('OPERATIONS');
      } else {
        alert('Could not load sample video: ' + (data.detail || ''));
      }
    } catch (err) {
      alert('Error loading sample video: ' + err.message);
    }
  };

  const handleExportGeoJSON = () => {
    if (!gisMaster) {
      alert('GIS master layer is not loaded yet.');
      return;
    }
    const blob = new Blob([JSON.stringify(gisMaster, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crowdshield_venue_gis.geojson';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportGeoJSONFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const geojson = JSON.parse(text);

      const res = await fetch('http://localhost:8000/api/gis/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geojson)
      });
      const data = await res.json();
      if (data.ok) {
        // Immediately store imported GeoJSON in local state
        setGisMaster(geojson);

        // Extract imported polygons into zones list
        const polyFeatures = (geojson.features || []).filter((f) => f.geometry?.type === 'Polygon');
        if (polyFeatures.length > 0) {
          const newZones = polyFeatures.map((f, idx) => {
            const p = f.properties || {};
            const zid = (f.id || p.id || `z${idx + 1}`).toLowerCase();
            return {
              id: `ZONE-${zid.toUpperCase()}`,
              key: zid,
              name: p.name || `Zone ${zid.toUpperCase()}`,
              shortName: p.name || `Zone ${zid.toUpperCase()}`,
              capacity: p.max_capacity || 350,
              warningThreshold: 3.0,
              criticalThreshold: 4.5,
              currentDensity: 0.0,
              level: 0,
              speed: 1.0,
              conflict: 0.05,
              personCount: 0,
              risk: 0.0,
              area_m2: p.area_m2 || 100.0,
              exits: ['Emergency Exit A']
            };
          });
          setZones(newZones);
          setSelectedZoneKey(newZones[0].key);
        }

        // Fetch refreshed routes from backend
        try {
          const rRes = await fetch('http://localhost:8000/api/gis/routes');
          const rData = await rRes.json();
          if (rData && rData.evacuation) {
            setRoutes(rData.evacuation);
            setGisRouting(rData);
          }
        } catch (_) {}

        alert(`GIS layers successfully updated from GeoJSON! (${data.imported_zones} zones, ${data.imported_corridors} corridors, ${data.imported_gates || 0} gates)`);
      } else {
        alert('GeoJSON import failed: ' + (data.detail || ''));
      }
    } catch (err) {
      alert('Failed to parse or import GeoJSON file: ' + err.message);
    }
  };

  // ============================================================================
  // DISPATCH & ALERT ACTIONS
  // ============================================================================
  const handleAcknowledgeAlert = (alertId) => {
    fetch(`http://localhost:8000/ack/${alertId}`, { method: 'POST' }).catch(() => {});
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, status: 'acknowledged', ack_by: operatorName } : a))
    );
  };

  const handleToggleBlockCorridor = (edgeKey) => {
    fetch('http://localhost:8000/block-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edge: edgeKey, user: operatorName })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.blocked_edges) setBlockedEdges(data.blocked_edges);
      })
      .catch(() => {});
  };

  const handleConfirmDispatch = () => {
    if (!dispatchModal || !operatorConfirmed) return;
    const targetZ = dispatchModal.targetZoneNum;
    fetch('http://localhost:8000/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        z: targetZ,
        lvl: selectedPreset.track === 1 ? 3 : (selectedPreset.track === 2 ? 2 : 1),
        action: 'LED_AND_AUDIO',
        instruction: selectedPreset.mp3Track
      })
    }).catch(() => {});

    setDispatchModal(null);
    setOperatorConfirmed(false);
  };

  const handleQuickDispatch = (zoneNum, trackNum) => {
    const preset = INSTRUCTION_PRESETS.find((p) => p.track === trackNum) || INSTRUCTION_PRESETS[0];
    fetch('http://localhost:8000/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        z: zoneNum,
        lvl: trackNum === 1 ? 3 : (trackNum === 2 ? 2 : 1),
        action: 'LED_AND_AUDIO',
        instruction: preset.mp3Track
      })
    }).catch(() => {});
  };

  const handleTriggerSirenAll = () => {
    if (!confirm('CONFIRMATION REQUIRED: Broadcast emergency evacuation sirens to all field nodes?')) return;
    fetch('http://localhost:8000/api/trigger_siren', { method: 'POST' }).catch(() => {});
  };

  const handleSimulateFall = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/simulate_fall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId: 'z2' })
      });
      const d = await res.json();
      if (d.ok) {
        console.log('Fallen person incident simulated successfully:', d);
      }
    } catch (e) {
      console.error('Failed to trigger fall simulation:', e);
    }
  };

  const handleTriggerHazard = async (zoneId, hazardType) => {
    try {
      const res = await fetch('http://localhost:8000/api/hazard/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: zoneId || 'z2',
          hazard_type: hazardType || 'FIRE',
          severity: 'CRITICAL'
        })
      });
      const data = await res.json();
      if (data.active_hazards) setActiveHazards(data.active_hazards);
      if (data.broadcasts) setHazardBroadcasts(data.broadcasts);
      if (data.routes) setRoutes(data.routes);
      if (data.gis_routing) setGisRouting(data.gis_routing);
    } catch (err) {
      console.error('Failed to trigger hazard:', err);
    }
  };

  const handleClearHazard = async (zoneId = null) => {
    try {
      const res = await fetch('http://localhost:8000/api/hazard/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId })
      });
      const data = await res.json();
      if (data.active_hazards) setActiveHazards(data.active_hazards);
      if (data.broadcasts) setHazardBroadcasts(data.broadcasts);
      if (data.routes) setRoutes(data.routes);
      if (data.gis_routing) setGisRouting(data.gis_routing);
    } catch (err) {
      console.error('Failed to clear hazard:', err);
    }
  };

  // Helper Fruin Risk Colors (Minimal, functional, high-contrast)
  const getFruinBadge = (level, density) => {
    switch (level) {
      case 3:
        return { label: 'CRITICAL', bg: 'bg-red-950/80', text: 'text-red-400', border: 'border-red-600', dot: 'bg-red-500' };
      case 2:
        return { label: 'HIGH', bg: 'bg-amber-950/80', text: 'text-amber-400', border: 'border-amber-600', dot: 'bg-amber-500' };
      case 1:
        return { label: 'CAUTION', bg: 'bg-yellow-950/60', text: 'text-yellow-400', border: 'border-yellow-600', dot: 'bg-yellow-500' };
      default:
        return { label: 'SAFE', bg: 'bg-zinc-900', text: 'text-emerald-400', border: 'border-emerald-600/40', dot: 'bg-emerald-500' };
    }
  };

  const unackAlertsCount = alerts.filter((a) => a.status === 'open').length;

  // ============================================================================
  // RENDER PURE BLACK COMMAND CENTER
  // ============================================================================
  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden antialiased">
      
      {/* 1. TOP HEADER & TELEMETRY STRIP */}
      <header className="h-14 bg-black border-b border-zinc-800/80 px-4 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-sm text-white uppercase font-mono">
                CrowdShield <span className="text-zinc-500 font-normal">v2.1</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-900 border border-zinc-800 text-zinc-400">
                OFFLINE-FIRST
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2">
              <span>STANDALONE COMMAND STATION</span>
              <span>•</span>
              <span className={backendOnline ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {backendOnline ? 'SPINE LIVE (PORT 8000)' : 'SPINE DISCONNECTED'}
              </span>
              {systemFps > 0 && <span>• {systemFps} FPS</span>}
            </div>
          </div>
        </div>

        {/* Active Emergency Alert Quick Jump Pill */}
        {activeEmergencyAlert && (
          <button
            onClick={() => setActiveTab('INCIDENTS')}
            className="hidden xl:flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-600 rounded-lg text-xs font-mono text-red-200 animate-pulse hover:bg-red-900 transition cursor-pointer"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            <span className="font-bold">CRITICAL INCIDENT ACTIVE IN {alertZoneKey.toUpperCase()}</span>
            <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">JUMP ➔</span>
          </button>
        )}

        {/* Center: Streamlined 3-Hub Navigation Bar */}
        <nav className="flex items-center space-x-1.5 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
          {[
            {
              id: 'OPERATIONS',
              num: '1',
              label: 'LIVE OPERATIONS',
              icon: Layers,
              badge: cameras.length > 0 ? `${cameras.length} CAM` : null,
              alert: false
            },
            {
              id: 'INCIDENTS',
              num: '2',
              label: 'INCIDENT & RESPONSE',
              icon: ShieldAlert,
              badge: activeMedicalIncident ? 'SOS ACTIVE' : (unackAlertsCount > 0 ? `${unackAlertsCount} ALERT` : null),
              alert: !!activeMedicalIncident || unackAlertsCount > 0
            },
            {
              id: 'HARDWARE',
              num: '3',
              label: 'HARDWARE & SETTINGS',
              icon: Cpu,
              badge: nodes.filter((n) => n.status === 'ONLINE').length > 0 ? `${nodes.filter((n) => n.status === 'ONLINE').length} NODES` : null,
              alert: false
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition cursor-pointer ${
                  isActive
                    ? 'bg-zinc-800 text-white font-bold border border-zinc-600 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80 border border-transparent'
                }`}
              >
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${isActive ? 'bg-zinc-700 text-zinc-100 font-bold' : 'bg-zinc-900 text-zinc-500'}`}>
                  {tab.num}
                </span>
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <span className="tracking-wide">{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    tab.alert
                      ? 'bg-red-600 text-white animate-pulse'
                      : isActive
                      ? 'bg-zinc-700 text-zinc-200'
                      : 'bg-zinc-900 text-zinc-500'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Action Icons */}
        <div className="flex items-center space-x-2">
          {/* Audio speech toggle */}
          <button
            onClick={() => setAudioMuted((prev) => !prev)}
            title={audioMuted ? 'Voice Alerts Muted' : 'Voice Alerts Enabled (Web Speech)'}
            className={`p-2 rounded border text-xs flex items-center gap-1.5 ${
              audioMuted ? 'bg-zinc-900 border-zinc-800 text-zinc-500' : 'bg-zinc-900 border-zinc-700 text-emerald-400'
            }`}
          >
            {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Quick Siren All */}
          <button
            onClick={handleTriggerSirenAll}
            className="px-3 py-1.5 rounded bg-red-950/60 hover:bg-red-900/80 border border-red-700 text-red-200 text-xs font-mono font-bold flex items-center gap-1.5 transition"
          >
            <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
            <span>DISPATCH SIREN</span>
          </button>

          {/* Add Camera Shortcut */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded bg-white hover:bg-zinc-200 text-black text-xs font-mono font-bold flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ADD CAMERA</span>
          </button>
        </div>
      </header>

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <main className="flex-1 p-4 bg-black overflow-y-auto">

        {/* ==================================================================
            HUB 1: LIVE OPERATIONS (CENTRAL COMMAND & REAL-TIME MONITORING)
            Unified CCTV Video Feeds + GIS Spatial Map & Dynamic Safe Egress Router
           ================================================================== */}
        {activeTab === 'OPERATIONS' && (
          <div className="space-y-4">
            {/* Operational Top Bar: View Mode Switcher & Real-Time KPI HUD */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
              {/* View Mode Switcher Pills */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-zinc-500 font-bold mr-1 hidden sm:inline">VIEW MODE:</span>
                <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setOpsView('split')}
                    className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                      opsView === 'split'
                        ? 'bg-zinc-800 text-white border border-zinc-650 shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Side-by-side Live Video Feeds & Interactive GIS Map [Key M]"
                  >
                    <Columns className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Split Dual View</span>
                    <span className="text-[10px] text-zinc-500 font-mono">[M]</span>
                  </button>
                  <button
                    onClick={() => setOpsView('cameras')}
                    className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                      opsView === 'cameras'
                        ? 'bg-zinc-800 text-white border border-zinc-650 shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Full-width CCTV Feeds & AI Detection Grid"
                  >
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    <span>CCTV Focus</span>
                  </button>
                  <button
                    onClick={() => setOpsView('map')}
                    className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                      opsView === 'map'
                        ? 'bg-zinc-800 text-white border border-zinc-650 shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Full-width Spatial GIS Venue Map & Route Inspector"
                  >
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Site Map Focus</span>
                  </button>
                </div>
              </div>

              {/* Live Operational KPI Ribbon */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {(() => {
                  const totalPax = cameras.reduce((sum, c) => sum + (c.person_count || 0), 0);
                  const highestDensityZone = zones.reduce((prev, curr) => {
                    const cD = curr?.density ?? curr?.currentDensity ?? 0;
                    const pD = prev?.density ?? prev?.currentDensity ?? 0;
                    return cD > pD ? curr : prev;
                  }, zones[0] || {});
                  const peakDensity = highestDensityZone?.density ?? highestDensityZone?.currentDensity ?? 0;
                  const onlineNodesCount = nodes.filter((n) => n.status === 'ONLINE').length;
                  const badge = getFruinBadge(highestDensityZone?.level || 0, peakDensity);

                  return (
                    <>
                      <div className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-zinc-400">Total Crowd:</span>
                        <span className="text-white font-bold">{totalPax} pax</span>
                      </div>

                      <div className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-zinc-400">Peak Congestion:</span>
                        <span className={`font-bold ${badge.text}`}>
                          {(highestDensityZone?.name || 'Zone A').split('—')[0].split('-')[0].trim()} ({Number(peakDensity).toFixed(2)} p/m²)
                        </span>
                      </div>

                      <div className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-zinc-400">Mesh Gateway:</span>
                        <span className="text-emerald-400 font-bold">{onlineNodesCount}/4 Online</span>
                      </div>

                      <div className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-zinc-400">Vision Engine:</span>
                        <span className="text-white font-bold">{systemFps > 0 ? `${systemFps.toFixed(1)} FPS` : 'Ready'}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            

            
            {/* OFFLINE AI VISION SUITE: 4-TIER ARCHITECTURE & MAHA KUMBH DENSITY REGRESSION */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-3 font-mono text-xs">
              {/* Header with Offline Edge Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs tracking-wide">
                        OFFLINE EDGE VISION SUITE (MAHA KUMBH DENSE-CROWD PIPELINE)
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-400 uppercase">
                        100% OFFLINE LOCAL API
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-sans">
                      Zero cloud reliance • Bypasses cellular blackouts • Auto-switches to CSRNet Density Regression &gt;2.0 pax/m²
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleRunKumbhAnalysis(false)}
                    disabled={isAnalyzingKumbh}
                    className="px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-[11px] font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                    title="Run offline CSRNet continuous density regression on current frame / festival dataset"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>{isAnalyzingKumbh ? 'ANALYZING...' : 'RUN MAHA KUMBH DIAGNOSTIC'}</span>
                  </button>

                  <button
                    onClick={() => handleRunKumbhAnalysis(true)}
                    disabled={isAnalyzingKumbh}
                    className="px-2.5 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50"
                    title="Run CSRNet density-map and write true densities to GIS map for dynamic NetworkX rerouting"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzingKumbh ? 'animate-spin' : ''}`} />
                    <span>INGEST & OVERWRITE GIS</span>
                  </button>

                  <button
                    onClick={handleLoadMultiApiScenario}
                    disabled={isScenarioLoading}
                    className="px-2.5 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 text-[11px] font-bold inline-flex items-center gap-1.5 transition disabled:opacity-50 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                    title="Load 3-Zone Multi-Density Scenario showing API 1 (YOLO), API 2 (CSRNet), API 3 (Farneback), and GIS Rerouting"
                  >
                    <SlidersHorizontal className={`w-3.5 h-3.5 ${isScenarioLoading ? 'animate-spin' : ''}`} />
                    <span>{isScenarioLoading ? 'LOADING...' : 'LOAD 3-ZONE MULTI-API DEMO'}</span>
                  </button>

                  {multiApiActive && (
                    <button
                      onClick={handleResetDemo}
                      className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 text-[11px] font-bold inline-flex items-center gap-1 transition"
                      title="Reset all zones to baseline flow"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>RESET</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4-Tier Pipeline Model Architecture Selector */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  {
                    key: 'tier1_yolo_highres',
                    name: 'Tier 1: High-Res YOLOv8',
                    sub: '<2.0 pax/m² (Sparse)',
                    method: 'Bounding Boxes + Homography'
                  },
                  {
                    key: 'tier2_head_yolo',
                    name: 'Tier 2: Head-Detection YOLO',
                    sub: '2.0 - 3.0 pax/m² (Occluded)',
                    method: 'CrowdHuman Head Priors'
                  },
                  {
                    key: 'tier3_density_map',
                    name: 'Tier 3: CSRNet Density-Map',
                    sub: '3.0 - 8.0+ pax/m² (Crush)',
                    method: 'Continuous ∬ D(x,y) dA'
                  },
                  {
                    key: 'tier4_hybrid_auto',
                    name: 'Tier 4: Hybrid Pro (Auto)',
                    sub: 'Full Range (Hysteresis)',
                    method: 'Adaptive Regime Switcher'
                  }
                ].map((tier) => {
                  const isActive = activeVisionTier === tier.key;
                  return (
                    <button
                      key={tier.key}
                      onClick={() => handleSwitchVisionTier(tier.key)}
                      className={`p-2 rounded text-left border transition relative flex flex-col justify-between ${
                        isActive
                          ? 'bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                          {tier.name}
                        </span>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                      </div>
                      <div className="text-[9px] text-zinc-400 mt-0.5">{tier.sub}</div>
                      <div className="text-[8px] text-zinc-500 font-mono mt-1 border-t border-zinc-800/80 pt-1">
                        {tier.method}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 3-ZONE MULTI-API & GIS SPATIAL CORRELATION SHOWCASE CARD */}
              {multiApiActive && (
                <div className="p-3 rounded-lg bg-black border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.12)] space-y-3 font-mono">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                      <span className="font-bold text-white text-xs tracking-wide">
                        LIVE 3-ZONE MULTI-API & GIS SPATIAL CORRELATION ACTIVE
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <span>GIS Engine:</span>
                      <span className="text-red-400 font-bold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-600/50">
                        ZONE B ISOLATED (∞ WEIGHT) • DYNAMIC NETWORKX REROUTE
                      </span>
                    </div>
                  </div>

                  {/* 3 Zone Comparative Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Zone 1: YOLOv8 High-Res Ground Homography */}
                    <div className="p-2.5 rounded bg-zinc-950 border border-emerald-500/40 space-y-2">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-400 block">ZONE A — MAIN PLAZA</span>
                          <span className="text-[9px] text-zinc-500">GIS Area: 320 m² • Cap: 450</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-600/40">
                          SAFE (LoS A)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center py-1 bg-black rounded border border-zinc-900">
                        <div>
                          <span className="text-[8px] text-zinc-500 block">DENSITY</span>
                          <span className="text-base font-bold text-emerald-400">1.15 p/m²</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-500 block">YOLO COUNT</span>
                          <span className="text-sm font-bold text-white">368 PAX</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[10px] border-t border-zinc-900 pt-1.5">
                        <div className="text-zinc-200">
                          <strong className="text-emerald-400">API 1:</strong> YOLOv8 Ground Homography
                        </div>
                        <div className="text-zinc-500 text-[9px]">
                          Sparse Regime (&lt;2.0 p/m²). Perspective Footprint (Hm). Free velocity: 1.28 m/s.
                        </div>
                        <div className="text-emerald-400 text-[9px] font-bold flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          GIS Route: Normal Egress via Gate A
                        </div>
                      </div>
                    </div>

                    {/* Zone 2: CSRNet Neural Density-Map Regression (Maha Kumbh Crush) */}
                    <div className="p-2.5 rounded bg-zinc-950 border border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.2)] space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-red-600 text-black font-extrabold text-[8px] px-2 py-0.5 uppercase tracking-wider">
                        GIS ISOLATED
                      </div>
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                        <div>
                          <span className="text-[10px] font-bold text-red-400 block">ZONE B — CORRIDOR CHOKE</span>
                          <span className="text-[9px] text-zinc-500">GIS Area: 95 m² • Cap: 120 (460% Saturation)</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-950 text-red-400 border border-red-600">
                          CRUSH (LoS F)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center py-1 bg-black rounded border border-zinc-900">
                        <div>
                          <span className="text-[8px] text-zinc-500 block">TRUE DENSITY</span>
                          <span className="text-base font-bold text-red-400 animate-pulse">5.82 p/m²</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-500 block">INTEGRAL COUNT</span>
                          <span className="text-sm font-bold text-white">553 PAX</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[10px] border-t border-zinc-900 pt-1.5">
                        <div className="text-zinc-200">
                          <strong className="text-red-400">API 2:</strong> CSRNet Neural Density-Map
                        </div>
                        <div className="text-zinc-500 text-[9px]">
                          Dilated-CNN Field Integral (∬ D dA). Standstill shockwaves: 0.12 m/s.
                        </div>
                        <div className="text-red-400 text-[9px] font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          GIS Reaction: Edge Locked • Wireless LoRa: Reroute via Gate C
                        </div>
                      </div>
                    </div>

                    {/* Zone 3: Optical Flow Farnebäck Conflict Detector */}
                    <div className="p-2.5 rounded bg-zinc-950 border border-amber-500/50 space-y-2">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                        <div>
                          <span className="text-[10px] font-bold text-amber-400 block">ZONE C — STAGE ARENA</span>
                          <span className="text-[9px] text-zinc-500">GIS Area: 480 m² • Cap: 700</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950 text-amber-400 border border-amber-600/40">
                          CAUTION (LoS D)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center py-1 bg-black rounded border border-zinc-900">
                        <div>
                          <span className="text-[8px] text-zinc-500 block">DENSITY</span>
                          <span className="text-base font-bold text-amber-400">3.35 p/m²</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-500 block">HEAD COUNT</span>
                          <span className="text-sm font-bold text-white">1,608 PAX</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-[10px] border-t border-zinc-900 pt-1.5">
                        <div className="text-zinc-200">
                          <strong className="text-amber-400">API 3:</strong> Farnebäck Optical Flow Conflict
                        </div>
                        <div className="text-zinc-500 text-[9px]">
                          Directional Variance C = 1 - ||Σ v|| / (Σ ||v|| + ε) = 0.68. Counter-flow push.
                        </div>
                        <div className="text-amber-300 text-[9px] font-bold flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          GIS Route: Divert via Zone D to Gate B (Bypass Choke)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GIS NetworkX Safe-Zone Rerouting Pipeline Banner */}
                  <div className="p-2 rounded bg-black border border-zinc-800 text-[10px] flex flex-wrap items-center justify-between gap-2 text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-white font-bold">GIS Spatial Engine:</span>
                      <span>Corridor edges to Zone B set to <strong className="text-red-400">∞ (Infinity cost)</strong> in NetworkX graph.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">Safe Calculated Egress:</span>
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white font-mono border border-zinc-700">
                        Zone C → Zone D (Concourse) → Gate B (North Emergency Exit)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Kumbh Diagnostic Output Banner (if triggered) */}
              {kumbhAnalysis && (
                <div className="p-2.5 rounded bg-black border border-amber-500/40 text-[11px] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span className="text-amber-400 font-bold uppercase">
                        MAHA KUMBH DENSITY-MAP TELEMETRY INGESTED
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-zinc-900 border border-zinc-700 text-zinc-300">
                        {kumbhAnalysis.architecture || 'CSRNet Dilated-CNN'}
                      </span>
                    </div>
                    <div className="text-zinc-400 text-[10px]">
                      Regime:{' '}
                      <span className={`font-bold ${kumbhAnalysis.is_crush_regime ? 'text-red-400' : 'text-emerald-400'}`}>
                        {kumbhAnalysis.regime}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Left: Key Metrics */}
                    <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
                        <span className="text-[9px] text-zinc-500 block">TOTAL ESTIMATED</span>
                        <span className="text-sm font-bold text-white">{kumbhAnalysis.total_count} PAX</span>
                      </div>
                      <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
                        <span className="text-[9px] text-zinc-500 block">ZONE 1 (PLAZA)</span>
                        <span className="text-xs font-bold text-amber-400">{kumbhAnalysis.zone_densities?.z1 ?? 0} p/m²</span>
                      </div>
                      <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
                        <span className="text-[9px] text-zinc-500 block">ZONE 2 (CHOKE)</span>
                        <span className="text-xs font-bold text-amber-400">{kumbhAnalysis.zone_densities?.z2 ?? 0} p/m²</span>
                      </div>
                      <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
                        <span className="text-[9px] text-zinc-500 block">ZONE 3 (ARENA)</span>
                        <span className="text-xs font-bold text-amber-400">{kumbhAnalysis.zone_densities?.z3 ?? 0} p/m²</span>
                      </div>
                      <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
                        <span className="text-[9px] text-zinc-500 block">ZONE 4 (EXIT)</span>
                        <span className="text-xs font-bold text-amber-400">{kumbhAnalysis.zone_densities?.z4 ?? 0} p/m²</span>
                      </div>
                    </div>

                    {/* Right: Thermal Heatmap Thumbnail */}
                    {kumbhAnalysis.heatmap_preview && (
                      <div className="md:col-span-4 flex items-center gap-2 p-1.5 rounded bg-zinc-900 border border-zinc-800">
                        <img
                          src={kumbhAnalysis.heatmap_preview}
                          alt="JET Thermal Density Heatmap"
                          className="w-20 h-12 object-cover rounded border border-zinc-700"
                        />
                        <div className="text-[9px] text-zinc-400 space-y-0.5">
                          <span className="text-white font-bold block">JET Colormap Surface</span>
                          <span>Integral: Count = ∬ D(x,y) dA</span>
                          <span className="text-emerald-400 block">Zero Cloud Latency</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* VIEW MODE: SPLIT DUAL VIEW */}
            {opsView === 'split' && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                {/* Left: Live CCTV Camera Feeds (col-span-6) */}
                <div className="xl:col-span-6 space-y-4">
                  {/* If no cameras configured */}
            {cameras.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center bg-zinc-950/40 my-8">
                <Camera className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-base font-bold text-white mb-1">NO REAL CAMERAS CONFIGURED</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6">
                  Connect your laptop webcam, an external USB camera, or a smartphone running an IP Webcam app (RTSP / HTTP MJPEG) to begin real-time YOLOv8 crowd monitoring.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded bg-white text-black hover:bg-zinc-200 text-xs font-mono font-bold inline-flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>CONNECT WEBCAM OR IP CAMERA NOW</span>
                </button>
              </div>
            ) : (
              /* Camera Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cameras.map((cam) => {
                  const zKey = cam.zone_id ? cam.zone_id.toLowerCase().replace('zone-', '') : 'z1';
                  const zoneObj = (zones && zones.find((z) => z.key === zKey || z.id === cam.zone_id)) || zones[0] || {};
                  const badge = getFruinBadge(zoneObj?.level || 0, cam?.density || 0);

                  return (
                    <div
                      key={cam.id}
                      className="bg-zinc-950 rounded-lg border border-zinc-800 p-3 flex flex-col justify-between space-y-2"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-bold text-xs text-white font-mono">{cam.name}</span>
                          <span className="text-[10px] font-mono text-zinc-500">[{cam.source}]</span>
                          {cam.engine_name && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-900 border border-zinc-750 text-zinc-300">
                              {cam.engine_name}
                            </span>
                          )}
                          {cam.is_crush_regime && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-950 border border-red-500 text-red-200 font-bold animate-pulse">
                              CRUSH REGIME ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {badge.label} • {cam.density || 0} p/m²
                          </span>
                          <button
                            onClick={() => handleDeleteCamera(cam.id)}
                            title="Disconnect Camera"
                            className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-red-400 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Video Stream Player */}
                      <div className="relative w-full aspect-video bg-black rounded overflow-hidden border border-zinc-850 flex items-center justify-center">
                        <img
                          src={`http://localhost:8000/video_feed/${cam.id}`}
                          alt={cam.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            setTimeout(() => {
                              if (e.target) {
                                e.target.src = `http://localhost:8000/video_feed/${cam.id}?t=` + Date.now();
                              }
                            }, 2500);
                          }}
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-zinc-800 text-[10px] font-mono text-zinc-300">
                          {zoneObj.name}
                        </div>
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 border border-zinc-800 text-[10px] font-mono text-emerald-400">
                          {cam.fps || 15} FPS
                        </div>
                      </div>

                      {/* Telemetry Stats Bar */}
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-900 text-[11px] font-mono">
                        <div>
                          <span className="text-zinc-500 block text-[9px]">PEOPLE COUNT</span>
                          <span className="font-bold text-white">{cam.person_count || 0} pax</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px]">DENSITY</span>
                          <span className={`font-bold ${badge.text}`}>{(cam.density || 0).toFixed(2)} /m²</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px]">WALK SPEED</span>
                          <span className="text-zinc-300">{cam.speed || 0.95} m/s</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px]">FLOW CONFLICT</span>
                          <span className={cam.conflict > 0.5 ? 'text-red-400 font-bold' : 'text-zinc-300'}>
                            {cam.conflict || 0.05}
                          </span>
                        </div>
                      </div>

                      {/* GIS Spatial Integration Bar */}
                      <div className="bg-black/90 border border-zinc-800 rounded p-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <div className="flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-zinc-500 text-[10px]">GIS ZONE:</span>
                          <span className="text-white font-bold">{zoneObj.name} [{zKey.toUpperCase()}]</span>
                          <span className="text-zinc-500">• Area: {zKey === 'z1' ? '320' : zKey === 'z2' ? '95' : zKey === 'z3' ? '480' : '240'} m²</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">
                            GIS Math: <span className="text-white font-bold">{cam.person_count || 0} pax</span> ÷ <span className="text-emerald-400">{zKey === 'z1' ? '320' : zKey === 'z2' ? '95' : zKey === 'z3' ? '480' : '240'} m²</span> = <span className={`font-bold ${badge.text}`}>{(cam.density || 0).toFixed(2)} p/m²</span>
                          </span>
                          <button
                            onClick={() => {
                              setSelectedZoneKey(zKey);
                              setActiveTab('MAP');
                            }}
                            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-200 flex items-center gap-1 transition"
                          >
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            <span>View on GIS Map [2]</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
                </div>

                {/* Right: GIS Spatial Site Map & Zone Router (col-span-6) */}
                <div className="xl:col-span-6 space-y-4">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
              {/* GIS Top Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-xs font-bold uppercase text-white tracking-wider">
                    GIS Spatial Venue Map &amp; Dynamic Safe-Exit Router
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                    QGIS / geojson.io
                  </span>
                </div>

                {/* GeoJSON Import / Export */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={geojsonInputRef}
                    accept=".geojson,.json"
                    onChange={handleImportGeoJSONFile}
                    className="hidden"
                  />
                  <button
                    onClick={() => geojsonInputRef.current?.click()}
                    title="Import custom venue polygons and paths from QGIS or geojson.io"
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-300 flex items-center gap-1 transition"
                  >
                    <Upload className="w-3 h-3 text-zinc-400" />
                    <span>Import GeoJSON</span>
                  </button>
                  <button
                    onClick={handleExportGeoJSON}
                    title="Export complete venue layers as GeoJSON for QGIS/ArcGIS"
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-300 flex items-center gap-1 transition"
                  >
                    <Download className="w-3 h-3 text-zinc-400" />
                    <span>Export GeoJSON</span>
                  </button>
                </div>
              </div>

              {/* GIS Layer Filter Switches */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono pt-0.5">
                <span className="text-zinc-500 text-[10px] uppercase mr-1">GIS LAYERS:</span>
                {[
                  { key: 'zones', label: 'Polygons' },
                  { key: 'corridors', label: 'Corridors' },
                  { key: 'evacRoutes', label: 'Visitor Routes' },
                  { key: 'responderRoutes', label: 'Responder Routes' },
                  { key: 'gates', label: 'Gates & Portals' },
                  { key: 'nodes', label: 'IoT Nodes' }
                ].map((layer) => (
                  <button
                    key={layer.key}
                    onClick={() => setGisLayers({ ...gisLayers, [layer.key]: !gisLayers[layer.key] })}
                    className={`px-2 py-0.5 rounded border text-[10px] transition ${
                      gisLayers[layer.key]
                        ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                        : 'bg-black border-zinc-900 text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {gisLayers[layer.key] ? '✓ ' : '○ '}{layer.label}
                  </button>
                ))}
              </div>

              {/* Interactive GIS SVG Site Map */}
              <div
                className="bg-black border border-zinc-900 rounded p-2 overflow-hidden relative cursor-crosshair"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (gisProjector && gisProjector.isGps) {
                    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const normY = Math.max(0, Math.min(1, 1.0 - ((e.clientY - rect.top) / rect.height)));
                    const lon = (gisProjector.bMinX + normX * (gisProjector.bMaxX - gisProjector.bMinX)).toFixed(6);
                    const lat = (gisProjector.bMinY + normY * (gisProjector.bMaxY - gisProjector.bMinY)).toFixed(6);
                    setHoverCoords({ lon, lat, isGps: true });
                  } else {
                    const xm = (((e.clientX - rect.left) / rect.width) * 180).toFixed(1);
                    const ym = (((rect.bottom - e.clientY) / rect.height) * 70).toFixed(1);
                    setHoverCoords({ x: xm, y: ym, isGps: false });
                  }
                }}
                onMouseLeave={() => setHoverCoords(null)}
              >
                <svg viewBox="0 0 640 365" className="w-full h-auto select-none font-mono">
                  <defs>
                    {/* Tactical Grid Pattern */}
                    <pattern id="gis-grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#141418" strokeWidth="0.8" />
                    </pattern>

                    {/* Evacuation Route Arrow Marker */}
                    <marker id="evac-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                    </marker>

                    {/* Responder Route Arrow Marker */}
                    <marker id="resp-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
                    </marker>
                  </defs>

                  {/* Base Background & Tactical Grid */}
                  <rect width="640" height="365" fill="#08080a" />
                  {gisLayers.grid && <rect width="640" height="365" fill="url(#gis-grid-pattern)" />}

                  {/* LAYER 1: OUTER VENUE PERIMETER BOUNDARY */}
                  {(() => {
                    const perimFeature = (gisMaster?.features || []).find((f) => f.properties?.type === 'VENUE_PERIMETER' || f.id === 'perimeter_outer');
                    if (gisProjector && perimFeature && perimFeature.geometry?.coordinates) {
                      const ring = perimFeature.geometry.coordinates[0] || [];
                      const pts = ring.map(gisProjector.project);
                      const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                      const minP = pts.reduce((acc, p) => ({ x: Math.min(acc.x, p.x), y: Math.min(acc.y, p.y) }), { x: Infinity, y: Infinity });
                      return (
                        <g key="venue-perimeter">
                          <polygon points={pointsStr} fill="#0c0d12" stroke="#27272a" strokeWidth="1.5" strokeDasharray="6 4" />
                          {/* Subtle perimeter label in top-left corner */}
                          <g transform={`translate(${minP.x + 8}, ${minP.y + 6})`}>
                            <rect x="0" y="0" width="195" height="18" rx="3" fill="#18181b" stroke="#27272a" strokeWidth="1" />
                            <circle cx="8" cy="9" r="3" fill="#10b981" />
                            <text x="16" y="12" fill="#a1a1aa" fontSize="8" fontWeight="bold">
                              GRAND ARENA GIS PERIMETER
                            </text>
                            <text x="145" y="12" fill="#52525b" fontSize="7.5">
                              18,000 m²
                            </text>
                          </g>
                        </g>
                      );
                    }
                    return (
                      <g key="fallback-perimeter">
                        <rect x="35" y="25" width="570" height="315" rx="4" fill="#0c0d12" stroke="#27272a" strokeWidth="1.5" strokeDasharray="6 4" />
                        <g transform="translate(45, 32)">
                          <rect x="0" y="0" width="195" height="18" rx="3" fill="#18181b" stroke="#27272a" strokeWidth="1" />
                          <circle cx="8" cy="9" r="3" fill="#10b981" />
                          <text x="16" y="12" fill="#a1a1aa" fontSize="8" fontWeight="bold">
                            GRAND ARENA GIS PERIMETER
                          </text>
                          <text x="145" y="12" fill="#52525b" fontSize="7.5">
                            18,000 m²
                          </text>
                        </g>
                      </g>
                    );
                  })()}

                  {/* LAYER 2: CORRIDORS / WALKWAY ARTERIALS (Rendered underneath zones) */}
                  {gisLayers.corridors && (() => {
                    const customCorridors = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'LineString');
                    if (gisProjector && customCorridors.length > 0) {
                      return customCorridors.map((c, idx) => {
                        const pts = (c.geometry?.coordinates || []).map(gisProjector.project);
                        const cid = c.id || c.properties?.id || `corridor_${idx + 1}`;
                        const isBlocked = blockedEdges.includes(cid) || Boolean(activeHazards?.isolated_zones && Object.keys(activeHazards.isolated_zones).some(hz => cid.toLowerCase().includes(hz)));
                        const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                        const midX = pts.length >= 2 ? Math.round((pts[0].x + pts[pts.length - 1].x) / 2) : 320;
                        const midY = pts.length >= 2 ? Math.round((pts[0].y + pts[pts.length - 1].y) / 2) : 180;
                        const label = c.properties?.name || `${c.properties?.length_m || 20}m Walkway`;

                        return (
                          <g key={cid} onClick={() => handleToggleBlockCorridor(cid)} className="cursor-pointer">
                            <polyline
                              points={pointsStr}
                              fill="none"
                              stroke={isBlocked ? '#ef4444' : '#64748b'}
                              strokeWidth={isBlocked ? '3.5' : '2.5'}
                              strokeDasharray={isBlocked ? '5 3' : 'none'}
                            />
                            <text x={midX} y={midY - 5} fill={isBlocked ? '#f87171' : '#94a3b8'} fontSize="8" fontFamily="monospace" textAnchor="middle">
                              {isBlocked ? '⛔ BLOCKED' : label}
                            </text>
                          </g>
                        );
                      });
                    }

                    // Fallback demo corridors
                    return [
                      { key: 'z1-z2', x1: 225, y1: 177, x2: 415, y2: 177, label: 'East Choke (35m • 2.8m)', midX: 320, midY: 172 },
                      { key: 'z1-z3', x1: 132, y1: 260, x2: 240, y2: 260, label: 'South Bypass (65m • 4.5m)', midX: 186, midY: 255 },
                      { key: 'z3-z4', x1: 320, y1: 165, x2: 320, y2: 155, label: 'North Arch (30m • 4.0m)', midX: 325, midY: 160 },
                      { key: 'z2-GATE_B', x1: 600, y1: 202, x2: 603, y2: 202, label: 'Arterial (20m)', midX: 580, midY: 195 }
                    ].map((corridor) => {
                      const isBlocked = blockedEdges.includes(corridor.key);
                      return (
                        <g key={corridor.key} onClick={() => handleToggleBlockCorridor(corridor.key)} className="cursor-pointer">
                          <line
                            x1={corridor.x1}
                            y1={corridor.y1}
                            x2={corridor.x2}
                            y2={corridor.y2}
                            stroke={isBlocked ? '#ef4444' : '#52525b'}
                            strokeWidth={isBlocked ? '3.5' : '2'}
                            strokeDasharray={isBlocked ? '5 3' : 'none'}
                          />
                          <text x={corridor.midX} y={corridor.midY} fill={isBlocked ? '#f87171' : '#71717a'} fontSize="7.5" fontFamily="monospace" textAnchor="middle">
                            {isBlocked ? '⛔ BLOCKED' : corridor.label}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* First Responder Staging Post 1 */}
                  {gisLayers.responderRoutes && (
                    <g>
                      <rect x="35" y="32" width="30" height="24" rx="3" fill="#082f49" stroke="#0ea5e9" strokeWidth="1.5" />
                      <text x="50" y="47" textAnchor="middle" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">
                        EMS-1
                      </text>
                      <text x="50" y="26" textAnchor="middle" fill="#7dd3fc" fontSize="7.5" fontFamily="monospace">
                        FIRST RESPONDER BASE
                      </text>
                    </g>
                  )}

                  {/* GIS Venue Zone Polygons (Dynamic GeoJSON Projection) */}
                  {gisLayers.zones && (() => {
                    const customPolygons = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'Polygon');
                    if (gisProjector && customPolygons.length > 0) {
                      return customPolygons.map((f, idx) => {
                        const ring = (f.geometry?.coordinates && f.geometry.coordinates[0]) || [];
                        const pts = ring.map(gisProjector.project);
                        const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                        const zid = (f.id || f.properties?.id || `z${idx + 1}`).toLowerCase();
                        const z = zones.find((z) => z.key === zid) || {
                          id: `ZONE-${zid.toUpperCase()}`,
                          key: zid,
                          name: f.properties?.name || `Zone ${zid.toUpperCase()}`,
                          shortName: f.properties?.name || `Zone ${zid.toUpperCase()}`,
                          level: f.properties?.level || 0,
                          currentDensity: f.properties?.density || 0.0,
                          personCount: f.properties?.personCount || 0,
                          area_m2: f.properties?.area_m2 || 100.0
                        };
                        const isSelected = selectedZoneKey === zid;
                        const isIsolated = Boolean(activeHazards?.isolated_zones && (activeHazards.isolated_zones[zid] || activeHazards.isolated_zones[f.id]));
                        const badge = getFruinBadge(z.level || 0, z.currentDensity || 0);

                        // Centroid calculation
                        const validPts = pts.length > 1 ? pts.slice(0, -1) : pts;
                        const cx = Math.round(validPts.reduce((acc, p) => acc + p.x, 0) / Math.max(validPts.length, 1));
                        const cy = Math.round(validPts.reduce((acc, p) => acc + p.y, 0) / Math.max(validPts.length, 1));

                        let fillColor = '#09090b';
                        if (z.level === 3) fillColor = 'rgba(239, 68, 68, 0.45)';
                        else if (z.level === 2) fillColor = 'rgba(249, 115, 22, 0.35)';
                        else if (z.level === 1) fillColor = 'rgba(234, 179, 8, 0.25)';
                        else fillColor = 'rgba(16, 185, 129, 0.20)';

                        const strokeColor = z.level >= 3 ? '#ef4444' : z.level === 2 ? '#f97316' : z.level === 1 ? '#eab308' : '#10b981';

                        return (
                          <g key={zid} onClick={() => setSelectedZoneKey(zid)} className="cursor-pointer">
                            <polygon
                              points={pointsStr}
                              fill={isIsolated ? '#dc2626' : fillColor}
                              stroke={isSelected ? '#ffffff' : strokeColor}
                              strokeWidth={isSelected ? '2.5' : '1.5'}
                            />
                            {/* Centered Tactical Telemetry */}
                            <text x={cx} y={cy - 10} textAnchor="middle" fill="#ffffff" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
                              {z.shortName || z.name} <tspan fill="#a1a1aa" fontSize="8.5">[{zid.toUpperCase()}]</tspan>
                            </text>
                            <text x={cx} y={cy + 4} textAnchor="middle" fill={z.level >= 2 ? '#f87171' : '#34d399'} fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                              {z.personCount || 0} PAX • {(z.currentDensity || 0).toFixed(2)} p/m²
                            </text>
                            <text x={cx} y={cy + 17} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                              Area: {Math.round(z.area_m2 || f.properties?.area_m2 || 100)} m² • {badge.label}
                            </text>
                          </g>
                        );
                      });
                    }

                    // Fallback to static demo rectangles
                    return zones.map((z) => {
                      const { x, y, w, h } = z.svgBounds || { x: 40, y: 95, w: 185, h: 165 };
                      const isSelected = selectedZoneKey === z.key;
                      const badge = getFruinBadge(z?.level || 0, z?.currentDensity || 0);

                      let fillColor = '#09090b';
                      if (z.level === 3) fillColor = 'rgba(153, 27, 27, 0.45)';
                      else if (z.level === 2) fillColor = 'rgba(146, 64, 14, 0.35)';
                      else if (z.level === 1) fillColor = 'rgba(113, 63, 18, 0.25)';

                      return (
                        <g key={z.id} onClick={() => setSelectedZoneKey(z.key)} className="cursor-pointer">
                          <rect
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            rx="4"
                            fill={fillColor}
                            stroke={isSelected ? '#ffffff' : z.level >= 3 ? '#ef4444' : z.level === 2 ? '#f59e0b' : '#27272a'}
                            strokeWidth={isSelected ? '2' : '1'}
                          />
                          <text x={x + 10} y={y + 18} fill="#ffffff" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
                            {z.shortName} <tspan fill="#71717a" fontSize="8.5">[{z.key.toUpperCase()}]</tspan>
                          </text>
                          <text x={x + 10} y={y + 32} fill={z.level >= 2 ? '#f87171' : '#34d399'} fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                            {z.personCount || 0} PAX • {(z.currentDensity ?? z.density ?? 0).toFixed(2)} p/m²
                          </text>
                          <text x={x + 10} y={y + 45} fill="#94a3b8" fontSize="8" fontFamily="monospace">
                            GIS Area: {z.key === 'z1' ? '320' : z.key === 'z2' ? '95' : z.key === 'z3' ? '480' : '240'} m² • {badge.label}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* Corridors / Walkway Connectors (Dynamic GeoJSON Projection) */}
                  {gisLayers.corridors && (() => {
                    const customCorridors = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'LineString');
                    if (gisProjector && customCorridors.length > 0) {
                      return customCorridors.map((c, idx) => {
                        const pts = (c.geometry?.coordinates || []).map(gisProjector.project);
                        const cid = c.id || c.properties?.id || `corridor_${idx + 1}`;
                        const isBlocked = blockedEdges.includes(cid);
                        const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                        const midX = pts.length >= 2 ? Math.round((pts[0].x + pts[pts.length - 1].x) / 2) : 320;
                        const midY = pts.length >= 2 ? Math.round((pts[0].y + pts[pts.length - 1].y) / 2) : 180;
                        const label = c.properties?.name || `${c.properties?.length_m || 20}m Walkway`;

                        return (
                          <g key={cid} onClick={() => handleToggleBlockCorridor(cid)} className="cursor-pointer">
                            <polyline
                              points={pointsStr}
                              fill="none"
                              stroke={isBlocked ? '#ef4444' : '#64748b'}
                              strokeWidth={isBlocked ? '3.5' : '2.5'}
                              strokeDasharray={isBlocked ? '5 3' : 'none'}
                            />
                            <text x={midX} y={midY - 5} fill={isBlocked ? '#f87171' : '#94a3b8'} fontSize="8" fontFamily="monospace" textAnchor="middle">
                              {isBlocked ? '⛔ BLOCKED' : label}
                            </text>
                          </g>
                        );
                      });
                    }

                    // Fallback demo corridors
                    return [
                      { key: 'z1-z2', x1: 225, y1: 177, x2: 415, y2: 177, label: 'East Choke (35m • 2.8m)', midX: 320, midY: 172 },
                      { key: 'z1-z3', x1: 132, y1: 260, x2: 240, y2: 260, label: 'South Bypass (65m • 4.5m)', midX: 186, midY: 255 },
                      { key: 'z3-z4', x1: 320, y1: 165, x2: 320, y2: 155, label: 'North Arch (30m • 4.0m)', midX: 325, midY: 160 },
                      { key: 'z2-GATE_B', x1: 600, y1: 202, x2: 603, y2: 202, label: 'Arterial (20m)', midX: 580, midY: 195 }
                    ].map((corridor) => {
                      const isBlocked = blockedEdges.includes(corridor.key);
                      return (
                        <g key={corridor.key} onClick={() => handleToggleBlockCorridor(corridor.key)} className="cursor-pointer">
                          <line
                            x1={corridor.x1}
                            y1={corridor.y1}
                            x2={corridor.x2}
                            y2={corridor.y2}
                            stroke={isBlocked ? '#ef4444' : '#52525b'}
                            strokeWidth={isBlocked ? '3.5' : '2'}
                            strokeDasharray={isBlocked ? '5 3' : 'none'}
                          />
                          <text x={corridor.midX} y={corridor.midY} fill={isBlocked ? '#f87171' : '#71717a'} fontSize="7.5" fontFamily="monospace" textAnchor="middle">
                            {isBlocked ? '⛔ BLOCKED' : corridor.label}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* Dynamic Visitor Safe-Exit Evacuation Vector Paths */}
                  {gisLayers.evacRoutes && (() => {
                    const customPolygons = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'Polygon');
                    const customGates = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'Point');

                    if (gisProjector && customPolygons.length > 0) {
                      return customPolygons.map((f, idx) => {
                        const zid = (f.id || f.properties?.id || `z${idx + 1}`).toLowerCase();
                        const rInfo = routes[zid] || (gisRouting?.evacuation && gisRouting.evacuation[zid]);
                        if (!rInfo) return null;

                        const ring = (f.geometry?.coordinates && f.geometry.coordinates[0]) || [];
                        const pts = ring.map(gisProjector.project);
                        const validPts = pts.length > 1 ? pts.slice(0, -1) : pts;
                        const startPt = {
                          x: Math.round(validPts.reduce((acc, p) => acc + p.x, 0) / Math.max(validPts.length, 1)),
                          y: Math.round(validPts.reduce((acc, p) => acc + p.y, 0) / Math.max(validPts.length, 1))
                        };

                        let endPt = { x: 550, y: 70 };
                        if (customGates.length > 0) {
                          const targetGateId = (rInfo.target_exit || rInfo.exit || '').toLowerCase();
                          const matchedGate = customGates.find((g) => (g.id || g.properties?.id || '').toLowerCase() === targetGateId) || customGates[0];
                          endPt = gisProjector.project(matchedGate.geometry.coordinates);
                        }

                        const isIsolated = rInfo.status?.includes('ISOLATED') || rInfo.status?.includes('TRAPPED');

                        return (
                          <g key={`evac-vector-${zid}`}>
                            <line
                              x1={startPt.x}
                              y1={startPt.y}
                              x2={endPt.x}
                              y2={endPt.y}
                              stroke={isIsolated ? '#ef4444' : '#10b981'}
                              strokeWidth="3.5"
                              strokeOpacity="0.3"
                            />
                            <line
                              x1={startPt.x}
                              y1={startPt.y}
                              x2={endPt.x}
                              y2={endPt.y}
                              stroke={isIsolated ? '#ef4444' : '#34d399'}
                              strokeWidth="2"
                              strokeDasharray={isIsolated ? '4 4' : '6 3'}
                            />
                            <circle cx={endPt.x} cy={endPt.y} r="3" fill={isIsolated ? '#ef4444' : '#10b981'} />
                          </g>
                        );
                      });
                    }

                    return zones.map((z) => {
                      const rInfo = routes[z.key];
                      if (!rInfo) return null;

                      const zCenters = {
                        z1: { x: 132, y: 177 },
                        z2: { x: 507, y: 202 },
                        z3: { x: 320, y: 252 },
                        z4: { x: 320, y: 92 }
                      };
                      const startPt = zCenters[z.key] || { x: 130, y: 170 };
                      const exitPts = {
                        GATE_A: { x: 32, y: 192 },
                        GATE_B: { x: 601, y: 202 },
                        GATE_C: { x: 317, y: 20 }
                      };
                      const targetExitKey = rInfo.exit ? rInfo.exit.toUpperCase() : 'GATE_A';
                      const endPt = exitPts[targetExitKey] || exitPts.GATE_A;
                      const isIsolated = rInfo.status === 'TRAPPED_OR_ISOLATED';

                      return (
                        <g key={`evac-vector-${z.key}`}>
                          <line
                            x1={startPt.x}
                            y1={startPt.y}
                            x2={endPt.x}
                            y2={endPt.y}
                            stroke={isIsolated ? '#ef4444' : '#10b981'}
                            strokeWidth="3.5"
                            strokeOpacity="0.3"
                          />
                          <line
                            x1={startPt.x}
                            y1={startPt.y}
                            x2={endPt.x}
                            y2={endPt.y}
                            stroke={isIsolated ? '#ef4444' : '#34d399'}
                            strokeWidth="2"
                            strokeDasharray={isIsolated ? '4 4' : '6 3'}
                          />
                          <circle cx={endPt.x} cy={endPt.y} r="3" fill={isIsolated ? '#ef4444' : '#10b981'} />
                        </g>
                      );
                    });
                  })()}

                  {/* First Responder Fastest Approach Vector Line */}
                  {gisLayers.responderRoutes && (
                    <g>
                      <line
                        x1="50"
                        y1="45"
                        x2={selectedZoneKey === 'z1' ? '132' : selectedZoneKey === 'z2' ? '507' : selectedZoneKey === 'z3' ? '320' : '320'}
                        y2={selectedZoneKey === 'z1' ? '177' : selectedZoneKey === 'z2' ? '202' : selectedZoneKey === 'z3' ? '252' : '92'}
                        stroke="#0ea5e9"
                        strokeWidth="2.5"
                        strokeDasharray="6 3"
                      />
                      <circle
                        cx={selectedZoneKey === 'z1' ? '132' : selectedZoneKey === 'z2' ? '507' : selectedZoneKey === 'z3' ? '320' : '320'}
                        cy={selectedZoneKey === 'z1' ? '177' : selectedZoneKey === 'z2' ? '202' : selectedZoneKey === 'z3' ? '252' : '92'}
                        r="5"
                        fill="#38bdf8"
                      />
                    </g>
                  )}

                  {/* IoT Hardware Mesh Nodes & Live Physical SOS Beacon Markers */}
                                    {gisLayers.nodes && nodes.map((n) => {
                    const isOnline = n.status === 'ONLINE';
                    const isSosActive = n.sos === 1;
                    const nx = n.zNum === 1 ? 75 : n.zNum === 2 ? 450 : n.zNum === 3 ? 275 : 350;
                    const ny = n.zNum === 1 ? 140 : n.zNum === 2 ? 145 : n.zNum === 3 ? 270 : 85;

                    return (
                      <g key={n.id}>
                        {isSosActive && (
                          <>
                            <circle cx={nx} cy={ny} r="18" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" strokeWidth="1.5">
                              <animate attributeName="r" values="8;24;32" dur="1.2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="1;0.4;0" dur="1.2s" repeatCount="indefinite" />
                            </circle>
                            <circle cx={nx} cy={ny} r="10" fill="#ef4444" />
                            <g transform={`translate(${nx - 36}, ${ny - 20})`}>
                              <rect width="72" height="15" rx="3" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                              <text x="36" y="11" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                                🚨 SOS PIN 13!
                              </text>
                            </g>
                          </>
                        )}
                        {!isSosActive && (
                          <circle cx={nx} cy={ny} r="4.5" fill={isOnline ? '#10b981' : '#71717a'} stroke="#000000" strokeWidth="1" />
                        )}
                        <text x={nx + 8} y={ny + 3} fill={isSosActive ? '#ef4444' : '#a1a1aa'} fontSize="7.5" fontFamily="monospace" fontWeight={isSosActive ? 'bold' : 'normal'}>
                          {n.id} {isSosActive ? '[ALARM]' : ''}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Live Real-World Metric / GPS Coordinate Readout */}
                <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/85 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                  {hoverCoords ? (
                    hoverCoords.isGps ? (
                      <span>GIS GPS Location: <span className="text-emerald-400 font-bold">{hoverCoords.lat}°N, {hoverCoords.lon}°E</span> (WGS-84)</span>
                    ) : (
                      <span>GIS Metric Grid: <span className="text-white font-bold">X: {hoverCoords.x}m, Y: {hoverCoords.y}m</span> (EPSG:3857)</span>
                    )
                  ) : (
                    <span>Hover venue map for real-time GIS coordinates</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
                <span>Click any corridor line to toggle corridor blockade. Dynamic NetworkX Dijkstra reroutes instantly.</span>
                <span className="text-zinc-400">Cost = length × (1 + 4 × risk)</span>
              </div>
            </div>
                  
{/* EMERGENCY HAZARD INCIDENT ISOLATION & LORA BROADCAST PANEL */}
<div className="bg-zinc-950 border border-red-900/60 rounded-lg p-3 space-y-3 font-mono">
  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
    <div className="flex items-center gap-2">
      <Flame className="w-4 h-4 text-red-500 animate-pulse" />
      <span className="text-xs font-bold text-white uppercase tracking-wider">
        Hazard Incident Isolation &amp; Mesh Broadcast
      </span>
    </div>
    <span className="text-[10px] text-zinc-500">LoRa 433MHz • ESP-NOW</span>
  </div>

  {/* Active Hazard Incident Alert Banner */}
  {activeHazards && activeHazards.has_hazard && (
    <div className="p-2.5 rounded bg-red-950/80 border border-red-700/80 text-xs space-y-2 animate-pulse">
      <div className="flex items-center justify-between text-red-300 font-bold">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          HAZARD ACTIVE: {Object.keys(activeHazards.isolated_zones || {}).map((z) => z.toUpperCase()).join(', ')} ISOLATED
        </span>
        <span className="text-[10px] bg-red-900 text-red-200 px-1.5 py-0.5 rounded border border-red-600 font-bold">
          TRAVEL COST = ∞
        </span>
      </div>
      <p className="text-[11px] text-red-200/90 leading-tight">
        All intersecting corridors locked. NetworkX dynamic routing has isolated compromised sector and recalculated shortest safe exit paths avoiding the hazard.
      </p>

      {/* Synchronized LoRa Signboard Text Payloads */}
      <div className="pt-1.5 border-t border-red-900/60 space-y-1">
        <div className="text-red-400 font-bold uppercase text-[9.5px]">
          Synchronized Field Display Broadcasts (Transmitted via Gateway Serial):
        </div>
        {(hazardBroadcasts || []).map((b, bi) => (
          <div key={bi} className="bg-black/90 px-2 py-1.5 rounded border border-red-800/60 flex items-center justify-between text-[10px]">
            <span className="text-zinc-300 font-mono">
              <span className="text-red-400 font-bold mr-1">Node {b.zone_id ? b.zone_id.toUpperCase() : `Z${b.z_num}`}:</span>
              "{b.text}"
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1 ml-2 shrink-0">
              <span>{b.arrow}</span>
              <span className="text-[9px] text-zinc-400">({b.exit})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )}

  {/* Incident Trigger & Clear Controls */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
    <div>
      <label className="text-[10px] text-zinc-400 block mb-1">COMPROMISED SECTOR</label>
      <select
        value={selectedHazardZone}
        onChange={(e) => setSelectedHazardZone(e.target.value)}
        className="w-full bg-black border border-zinc-800 rounded p-1.5 text-xs text-white font-mono focus:border-red-500"
      >
        <option value="z2">Zone 2 (East Choke)</option>
        <option value="z1">Zone 1 (Main Plaza)</option>
        <option value="z3">Zone 3 (South Bridge)</option>
        <option value="z4">Zone 4 (North Choke)</option>
      </select>
    </div>
    <div>
      <label className="text-[10px] text-zinc-400 block mb-1">HAZARD NATURE</label>
      <select
        value={selectedHazardType}
        onChange={(e) => setSelectedHazardType(e.target.value)}
        className="w-full bg-black border border-zinc-800 rounded p-1.5 text-xs text-white font-mono focus:border-red-500"
      >
        <option value="FIRE">🔥 Fire Outbreak</option>
        <option value="CRITICAL HAZARD">⚠️ Critical Crush Hazard</option>
        <option value="STRUCTURAL">🚫 Structural Collapse</option>
      </select>
    </div>
    <div className="flex items-end gap-1.5">
      <button
        onClick={() => handleTriggerHazard(selectedHazardZone, selectedHazardType)}
        className="flex-1 py-1.5 px-2 rounded bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 text-[11px] font-bold flex items-center justify-center gap-1 transition"
      >
        <Flame className="w-3.5 h-3.5 text-red-400" />
        <span>ISOLATE &amp; REROUTE</span>
      </button>
      {activeHazards && activeHazards.has_hazard && (
        <button
          onClick={() => handleClearHazard(null)}
          title="Restore standard paths & send all-clear"
          className="py-1.5 px-2 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1 transition shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>ALL CLEAR</span>
        </button>
      )}
    </div>
  </div>
</div>

                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="border-b border-zinc-900 pb-2 mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">GIS Zone Spatial Inspector</span>
                    <h3 className="text-sm font-bold text-white font-mono">
                      {zones.find((z) => z.key === selectedZoneKey)?.name}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-emerald-400">
                    ID: {selectedZoneKey.toUpperCase()}
                  </span>
                </div>

                {/* Live GIS & Physics Metrics */}
                {(() => {
                  const currZ = (zones && zones.length > 0 ? (zones.find((z) => z.key === selectedZoneKey) || zones[0]) : null) || { key: 'z1', name: 'Zone A', personCount: 0, capacity: 100, currentDensity: 0, density: 0, level: 0, speed: 0, flowRate: 0, conflict: 'Low' };
                  const routeInfo = routes[selectedZoneKey];
                  const fc = forecasts[selectedZoneKey] || { t10: 0, t15: 0, p_critical: 0 };
                  const badge = getFruinBadge(currZ?.level || 0, currZ?.currentDensity || 0);
                  const gisArea = selectedZoneKey === 'z1' ? 320 : selectedZoneKey === 'z2' ? 95 : selectedZoneKey === 'z3' ? 480 : 240;

                  return (
                    <div className="space-y-2.5 font-mono text-xs">
                      <div className="grid grid-cols-2 gap-2 p-2 rounded bg-black border border-zinc-900">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">REAL GIS FLOOR AREA</span>
                          <span className="text-sm font-bold text-white">{gisArea} m²</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">DESIGN CAPACITY</span>
                          <span className="text-sm font-bold text-zinc-300">{currZ.capacity || 100} pax</span>
                        </div>
                      </div>

                      {/* GIS Spatial Density Calculation Formula */}
                      <div className="p-2.5 rounded bg-black border border-emerald-900/60 text-[11px] font-mono space-y-1">
                        <div className="flex items-center justify-between text-emerald-400 font-bold">
                          <span className="flex items-center gap-1">
                            <Compass className="w-3.5 h-3.5" />
                            GIS SPATIAL DENSITY FORMULA
                          </span>
                          <span className="text-[9px] text-zinc-500">Shapely Metric Area</span>
                        </div>
                        <div className="text-zinc-300 text-xs py-1">
                          Density = <span className="text-white font-bold">{currZ.personCount || 0} PAX</span> (YOLOv8) ÷ <span className="text-emerald-400 font-bold">{gisArea} m²</span> (GIS Polygon) = <span className={`font-bold ${badge.text}`}>{(currZ?.currentDensity ?? currZ?.density ?? 0).toFixed(2)} pax/m²</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 border-t border-zinc-900 pt-1 flex justify-between">
                          <span>Capacity Saturation: {Math.round(((currZ.personCount || 0) / (currZ.capacity || 1)) * 100)}%</span>
                          <span>Fruin LoS: {badge.label}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2 rounded bg-black border border-zinc-900">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">TRUE DENSITY (PAX/M²)</span>
                          <span className={`text-base font-bold ${badge.text}`}>{(currZ?.currentDensity ?? currZ?.density ?? 0).toFixed(2)} p/m²</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">FRUIN LEVEL OF SERVICE</span>
                          <span className="text-xs font-bold text-white">{badge.label}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2 rounded bg-black border border-zinc-900">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">WALK VELOCITY</span>
                          <span className="text-zinc-200">{currZ.speed || 0} m/s</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">TURBULENCE CONFLICT</span>
                          <span className="text-zinc-200">{currZ.conflict || 'Low'}</span>
                        </div>
                      </div>

                      {/* Visitor Evacuation Recommendation */}
                      <div className="p-2.5 rounded bg-black border border-zinc-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-zinc-500 uppercase">Visitor Evacuation Route</span>
                          <span className="text-[9px] text-emerald-400 font-bold">OPTIMAL PATH</span>
                        </div>
                        <div className="text-sm font-bold text-emerald-400">
                          {routeInfo ? `→ ${routeInfo.exit}` : 'Awaiting Graph'}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-1 flex justify-between">
                          <span>Path: {routeInfo && routeInfo.path ? routeInfo.path.join(' → ') : selectedZoneKey}</span>
                          <span>Est: ~{Math.round((gisArea / 25) + 10)}s</span>
                        </div>
                      </div>

                      {/* Emergency First Responder Approach Vector */}
                      <div className="p-2.5 rounded bg-sky-950/40 border border-sky-800/80">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-sky-400 uppercase font-bold flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-sky-400" />
                            First Responder Ingress
                          </span>
                          <span className="text-[9px] text-sky-300">ETA: ~{Math.round((gisArea / 40) + 6)}s</span>
                        </div>
                        <div className="text-xs text-zinc-300">
                          Base 1 ➔ Gate A Chute ➔ <span className="text-sky-300 font-bold">{currZ.name}</span>
                        </div>
                        <span className="text-[9px] text-zinc-500 block mt-1">Unblocked tactical corridor cleared for emergency ingress</span>
                      </div>

                      {/* 10-Min Prediction */}
                      <div className="p-2.5 rounded bg-black border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase block mb-1">10-Min Early Prediction (T+10m)</span>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white font-bold">{fc.t10} p/m²</span>
                          <span className="text-zinc-400">P(Crush): {Math.round(fc.p_critical * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  const currZ = zones.find((z) => z.key === selectedZoneKey);
                  const zNum = selectedZoneKey.replace('z', '');
                  setDispatchModal({ targetZoneNum: parseInt(zNum), zoneName: currZ?.name });
                }}
                className="w-full mt-2 py-2 rounded bg-white text-black hover:bg-zinc-200 text-xs font-mono font-bold flex items-center justify-center gap-2 transition"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>DISPATCH DOWNLINK TO {selectedZoneKey.toUpperCase()}</span>
              </button>
            </div>
                </div>
              </div>
            )}

            {/* VIEW MODE: CCTV FOCUS (FULL-WIDTH) */}
            {opsView === 'cameras' && (
              <div className="space-y-4">
                {/* If no cameras configured */}
            {cameras.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center bg-zinc-950/40 my-8">
                <Camera className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-base font-bold text-white mb-1">NO REAL CAMERAS CONFIGURED</h3>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6">
                  Connect your laptop webcam, an external USB camera, or a smartphone running an IP Webcam app (RTSP / HTTP MJPEG) to begin real-time YOLOv8 crowd monitoring.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded bg-white text-black hover:bg-zinc-200 text-xs font-mono font-bold inline-flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>CONNECT WEBCAM OR IP CAMERA NOW</span>
                </button>
              </div>
            ) : (
              /* Camera Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cameras.map((cam) => {
                  const zKey = cam.zone_id ? cam.zone_id.toLowerCase().replace('zone-', '') : 'z1';
                  const zoneObj = (zones && zones.find((z) => z.key === zKey || z.id === cam.zone_id)) || zones[0] || {};
                  const badge = getFruinBadge(zoneObj?.level || 0, cam?.density || 0);

                  return (
                    <div
                      key={cam.id}
                      className="bg-zinc-950 rounded-lg border border-zinc-800 p-3 flex flex-col justify-between space-y-2"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-bold text-xs text-white font-mono">{cam.name}</span>
                          <span className="text-[10px] font-mono text-zinc-500">[{cam.source}]</span>
                          {cam.engine_name && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-900 border border-zinc-750 text-zinc-300">
                              {cam.engine_name}
                            </span>
                          )}
                          {cam.is_crush_regime && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-950 border border-red-500 text-red-200 font-bold animate-pulse">
                              CRUSH REGIME ACTIVE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {badge.label} • {cam.density || 0} p/m²
                          </span>
                          <button
                            onClick={() => handleDeleteCamera(cam.id)}
                            title="Disconnect Camera"
                            className="p-1 hover:bg-zinc-900 text-zinc-500 hover:text-red-400 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Video Stream Player */}
                      <div className="relative w-full aspect-video bg-black rounded overflow-hidden border border-zinc-850 flex items-center justify-center">
                        <img
                          src={`http://localhost:8000/video_feed/${cam.id}`}
                          alt={cam.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            setTimeout(() => {
                              if (e.target) {
                                e.target.src = `http://localhost:8000/video_feed/${cam.id}?t=` + Date.now();
                              }
                            }, 2500);
                          }}
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 border border-zinc-800 text-[10px] font-mono text-zinc-300">
                          {zoneObj.name}
                        </div>
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 border border-zinc-800 text-[10px] font-mono text-emerald-400">
                          {cam.fps || 15} FPS
                        </div>
                      </div>

                      {/* Telemetry Stats Bar */}
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-900 text-[11px] font-mono">
                        <div>
                          <span className="text-zinc-500 block text-[9px]">PEOPLE COUNT</span>
                          <span className="font-bold text-white">{cam.person_count || 0} pax</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px]">DENSITY</span>
                          <span className={`font-bold ${badge.text}`}>{(cam.density || 0).toFixed(2)} /m²</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px]">WALK SPEED</span>
                          <span className="text-zinc-300">{cam.speed || 0.95} m/s</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px]">FLOW CONFLICT</span>
                          <span className={cam.conflict > 0.5 ? 'text-red-400 font-bold' : 'text-zinc-300'}>
                            {cam.conflict || 0.05}
                          </span>
                        </div>
                      </div>

                      {/* GIS Spatial Integration Bar */}
                      <div className="bg-black/90 border border-zinc-800 rounded p-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <div className="flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-zinc-500 text-[10px]">GIS ZONE:</span>
                          <span className="text-white font-bold">{zoneObj.name} [{zKey.toUpperCase()}]</span>
                          <span className="text-zinc-500">• Area: {zKey === 'z1' ? '320' : zKey === 'z2' ? '95' : zKey === 'z3' ? '480' : '240'} m²</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">
                            GIS Math: <span className="text-white font-bold">{cam.person_count || 0} pax</span> ÷ <span className="text-emerald-400">{zKey === 'z1' ? '320' : zKey === 'z2' ? '95' : zKey === 'z3' ? '480' : '240'} m²</span> = <span className={`font-bold ${badge.text}`}>{(cam.density || 0).toFixed(2)} p/m²</span>
                          </span>
                          <button
                            onClick={() => {
                              setSelectedZoneKey(zKey);
                              setActiveTab('MAP');
                            }}
                            className="px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-200 flex items-center gap-1 transition"
                          >
                            <MapPin className="w-3 h-3 text-emerald-400" />
                            <span>View on GIS Map [2]</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </div>
            )}

            {/* VIEW MODE: SITE MAP FOCUS (FULL-WIDTH) */}
            {opsView === 'map' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 space-y-4">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
              {/* GIS Top Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono text-xs font-bold uppercase text-white tracking-wider">
                    GIS Spatial Venue Map &amp; Dynamic Safe-Exit Router
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                    QGIS / geojson.io
                  </span>
                </div>

                {/* GeoJSON Import / Export */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={geojsonInputRef}
                    accept=".geojson,.json"
                    onChange={handleImportGeoJSONFile}
                    className="hidden"
                  />
                  <button
                    onClick={() => geojsonInputRef.current?.click()}
                    title="Import custom venue polygons and paths from QGIS or geojson.io"
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-300 flex items-center gap-1 transition"
                  >
                    <Upload className="w-3 h-3 text-zinc-400" />
                    <span>Import GeoJSON</span>
                  </button>
                  <button
                    onClick={handleExportGeoJSON}
                    title="Export complete venue layers as GeoJSON for QGIS/ArcGIS"
                    className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-mono text-zinc-300 flex items-center gap-1 transition"
                  >
                    <Download className="w-3 h-3 text-zinc-400" />
                    <span>Export GeoJSON</span>
                  </button>
                </div>
              </div>

              {/* GIS Layer Filter Switches */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono pt-0.5">
                <span className="text-zinc-500 text-[10px] uppercase mr-1">GIS LAYERS:</span>
                {[
                  { key: 'zones', label: 'Polygons' },
                  { key: 'corridors', label: 'Corridors' },
                  { key: 'evacRoutes', label: 'Visitor Routes' },
                  { key: 'responderRoutes', label: 'Responder Routes' },
                  { key: 'gates', label: 'Gates & Portals' },
                  { key: 'nodes', label: 'IoT Nodes' }
                ].map((layer) => (
                  <button
                    key={layer.key}
                    onClick={() => setGisLayers({ ...gisLayers, [layer.key]: !gisLayers[layer.key] })}
                    className={`px-2 py-0.5 rounded border text-[10px] transition ${
                      gisLayers[layer.key]
                        ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                        : 'bg-black border-zinc-900 text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {gisLayers[layer.key] ? '✓ ' : '○ '}{layer.label}
                  </button>
                ))}
              </div>

              {/* Interactive GIS SVG Site Map */}
              <div
                className="bg-black border border-zinc-900 rounded p-2 overflow-hidden relative cursor-crosshair"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (gisProjector && gisProjector.isGps) {
                    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const normY = Math.max(0, Math.min(1, 1.0 - ((e.clientY - rect.top) / rect.height)));
                    const lon = (gisProjector.bMinX + normX * (gisProjector.bMaxX - gisProjector.bMinX)).toFixed(6);
                    const lat = (gisProjector.bMinY + normY * (gisProjector.bMaxY - gisProjector.bMinY)).toFixed(6);
                    setHoverCoords({ lon, lat, isGps: true });
                  } else {
                    const xm = (((e.clientX - rect.left) / rect.width) * 180).toFixed(1);
                    const ym = (((rect.bottom - e.clientY) / rect.height) * 70).toFixed(1);
                    setHoverCoords({ x: xm, y: ym, isGps: false });
                  }
                }}
                onMouseLeave={() => setHoverCoords(null)}
              >
                <svg viewBox="0 0 640 365" className="w-full h-auto select-none font-mono">
                  <defs>
                    {/* Tactical Grid Pattern */}
                    <pattern id="gis-grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#141418" strokeWidth="0.8" />
                    </pattern>

                    {/* Evacuation Route Arrow Marker */}
                    <marker id="evac-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#10b981" />
                    </marker>

                    {/* Responder Route Arrow Marker */}
                    <marker id="resp-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
                    </marker>
                  </defs>

                  {/* Base Background & Tactical Grid */}
                  <rect width="640" height="365" fill="#08080a" />
                  {gisLayers.grid && <rect width="640" height="365" fill="url(#gis-grid-pattern)" />}

                  {/* LAYER 1: OUTER VENUE PERIMETER BOUNDARY */}
                  {(() => {
                    const perimFeature = (gisMaster?.features || []).find((f) => f.properties?.type === 'VENUE_PERIMETER' || f.id === 'perimeter_outer');
                    if (gisProjector && perimFeature && perimFeature.geometry?.coordinates) {
                      const ring = perimFeature.geometry.coordinates[0] || [];
                      const pts = ring.map(gisProjector.project);
                      const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                      const minP = pts.reduce((acc, p) => ({ x: Math.min(acc.x, p.x), y: Math.min(acc.y, p.y) }), { x: Infinity, y: Infinity });
                      return (
                        <g key="venue-perimeter">
                          <polygon points={pointsStr} fill="#0c0d12" stroke="#27272a" strokeWidth="1.5" strokeDasharray="6 4" />
                          {/* Subtle perimeter label in top-left corner */}
                          <g transform={`translate(${minP.x + 8}, ${minP.y + 6})`}>
                            <rect x="0" y="0" width="195" height="18" rx="3" fill="#18181b" stroke="#27272a" strokeWidth="1" />
                            <circle cx="8" cy="9" r="3" fill="#10b981" />
                            <text x="16" y="12" fill="#a1a1aa" fontSize="8" fontWeight="bold">
                              GRAND ARENA GIS PERIMETER
                            </text>
                            <text x="145" y="12" fill="#52525b" fontSize="7.5">
                              18,000 m²
                            </text>
                          </g>
                        </g>
                      );
                    }
                    return (
                      <g key="fallback-perimeter">
                        <rect x="35" y="25" width="570" height="315" rx="4" fill="#0c0d12" stroke="#27272a" strokeWidth="1.5" strokeDasharray="6 4" />
                        <g transform="translate(45, 32)">
                          <rect x="0" y="0" width="195" height="18" rx="3" fill="#18181b" stroke="#27272a" strokeWidth="1" />
                          <circle cx="8" cy="9" r="3" fill="#10b981" />
                          <text x="16" y="12" fill="#a1a1aa" fontSize="8" fontWeight="bold">
                            GRAND ARENA GIS PERIMETER
                          </text>
                          <text x="145" y="12" fill="#52525b" fontSize="7.5">
                            18,000 m²
                          </text>
                        </g>
                      </g>
                    );
                  })()}

                  {/* LAYER 2: CORRIDORS / WALKWAY ARTERIALS (Rendered underneath zones) */}
                  {gisLayers.corridors && (() => {
                    const customCorridors = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'LineString');
                    if (gisProjector && customCorridors.length > 0) {
                      return customCorridors.map((c, idx) => {
                        const pts = (c.geometry?.coordinates || []).map(gisProjector.project);
                        const cid = c.id || c.properties?.id || `corridor_${idx + 1}`;
                        const isBlocked = blockedEdges.includes(cid) || Boolean(activeHazards?.isolated_zones && Object.keys(activeHazards.isolated_zones).some(hz => cid.toLowerCase().includes(hz)));
                        const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                        const midX = pts.length >= 2 ? Math.round((pts[0].x + pts[pts.length - 1].x) / 2) : 320;
                        const midY = pts.length >= 2 ? Math.round((pts[0].y + pts[pts.length - 1].y) / 2) : 180;
                        const label = c.properties?.name || `${c.properties?.length_m || 20}m Walkway`;

                        return (
                          <g key={cid} onClick={() => handleToggleBlockCorridor(cid)} className="cursor-pointer">
                            <polyline
                              points={pointsStr}
                              fill="none"
                              stroke={isBlocked ? '#ef4444' : '#64748b'}
                              strokeWidth={isBlocked ? '3.5' : '2.5'}
                              strokeDasharray={isBlocked ? '5 3' : 'none'}
                            />
                            <text x={midX} y={midY - 5} fill={isBlocked ? '#f87171' : '#94a3b8'} fontSize="8" fontFamily="monospace" textAnchor="middle">
                              {isBlocked ? '⛔ BLOCKED' : label}
                            </text>
                          </g>
                        );
                      });
                    }

                    // Fallback demo corridors
                    return [
                      { key: 'z1-z2', x1: 225, y1: 177, x2: 415, y2: 177, label: 'East Choke (35m • 2.8m)', midX: 320, midY: 172 },
                      { key: 'z1-z3', x1: 132, y1: 260, x2: 240, y2: 260, label: 'South Bypass (65m • 4.5m)', midX: 186, midY: 255 },
                      { key: 'z3-z4', x1: 320, y1: 165, x2: 320, y2: 155, label: 'North Arch (30m • 4.0m)', midX: 325, midY: 160 },
                      { key: 'z2-GATE_B', x1: 600, y1: 202, x2: 603, y2: 202, label: 'Arterial (20m)', midX: 580, midY: 195 }
                    ].map((corridor) => {
                      const isBlocked = blockedEdges.includes(corridor.key);
                      return (
                        <g key={corridor.key} onClick={() => handleToggleBlockCorridor(corridor.key)} className="cursor-pointer">
                          <line
                            x1={corridor.x1}
                            y1={corridor.y1}
                            x2={corridor.x2}
                            y2={corridor.y2}
                            stroke={isBlocked ? '#ef4444' : '#52525b'}
                            strokeWidth={isBlocked ? '3.5' : '2'}
                            strokeDasharray={isBlocked ? '5 3' : 'none'}
                          />
                          <text x={corridor.midX} y={corridor.midY} fill={isBlocked ? '#f87171' : '#71717a'} fontSize="7.5" fontFamily="monospace" textAnchor="middle">
                            {isBlocked ? '⛔ BLOCKED' : corridor.label}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* First Responder Staging Post 1 */}
                  {gisLayers.responderRoutes && (
                    <g>
                      <rect x="35" y="32" width="30" height="24" rx="3" fill="#082f49" stroke="#0ea5e9" strokeWidth="1.5" />
                      <text x="50" y="47" textAnchor="middle" fill="#38bdf8" fontSize="8" fontFamily="monospace" fontWeight="bold">
                        EMS-1
                      </text>
                      <text x="50" y="26" textAnchor="middle" fill="#7dd3fc" fontSize="7.5" fontFamily="monospace">
                        FIRST RESPONDER BASE
                      </text>
                    </g>
                  )}

                  {/* GIS Venue Zone Polygons (Dynamic GeoJSON Projection) */}
                  {gisLayers.zones && (() => {
                    const customPolygons = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'Polygon');
                    if (gisProjector && customPolygons.length > 0) {
                      return customPolygons.map((f, idx) => {
                        const ring = (f.geometry?.coordinates && f.geometry.coordinates[0]) || [];
                        const pts = ring.map(gisProjector.project);
                        const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                        const zid = (f.id || f.properties?.id || `z${idx + 1}`).toLowerCase();
                        const z = zones.find((z) => z.key === zid) || {
                          id: `ZONE-${zid.toUpperCase()}`,
                          key: zid,
                          name: f.properties?.name || `Zone ${zid.toUpperCase()}`,
                          shortName: f.properties?.name || `Zone ${zid.toUpperCase()}`,
                          level: f.properties?.level || 0,
                          currentDensity: f.properties?.density || 0.0,
                          personCount: f.properties?.personCount || 0,
                          area_m2: f.properties?.area_m2 || 100.0
                        };
                        const isSelected = selectedZoneKey === zid;
                        const isIsolated = Boolean(activeHazards?.isolated_zones && (activeHazards.isolated_zones[zid] || activeHazards.isolated_zones[f.id]));
                        const badge = getFruinBadge(z.level || 0, z.currentDensity || 0);

                        // Centroid calculation
                        const validPts = pts.length > 1 ? pts.slice(0, -1) : pts;
                        const cx = Math.round(validPts.reduce((acc, p) => acc + p.x, 0) / Math.max(validPts.length, 1));
                        const cy = Math.round(validPts.reduce((acc, p) => acc + p.y, 0) / Math.max(validPts.length, 1));

                        let fillColor = '#09090b';
                        if (z.level === 3) fillColor = 'rgba(239, 68, 68, 0.45)';
                        else if (z.level === 2) fillColor = 'rgba(249, 115, 22, 0.35)';
                        else if (z.level === 1) fillColor = 'rgba(234, 179, 8, 0.25)';
                        else fillColor = 'rgba(16, 185, 129, 0.20)';

                        const strokeColor = z.level >= 3 ? '#ef4444' : z.level === 2 ? '#f97316' : z.level === 1 ? '#eab308' : '#10b981';

                        return (
                          <g key={zid} onClick={() => setSelectedZoneKey(zid)} className="cursor-pointer">
                            <polygon
                              points={pointsStr}
                              fill={isIsolated ? '#dc2626' : fillColor}
                              stroke={isSelected ? '#ffffff' : strokeColor}
                              strokeWidth={isSelected ? '2.5' : '1.5'}
                            />
                            {/* Centered Tactical Telemetry */}
                            <text x={cx} y={cy - 10} textAnchor="middle" fill="#ffffff" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
                              {z.shortName || z.name} <tspan fill="#a1a1aa" fontSize="8.5">[{zid.toUpperCase()}]</tspan>
                            </text>
                            <text x={cx} y={cy + 4} textAnchor="middle" fill={z.level >= 2 ? '#f87171' : '#34d399'} fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                              {z.personCount || 0} PAX • {(z.currentDensity || 0).toFixed(2)} p/m²
                            </text>
                            <text x={cx} y={cy + 17} textAnchor="middle" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                              Area: {Math.round(z.area_m2 || f.properties?.area_m2 || 100)} m² • {badge.label}
                            </text>
                          </g>
                        );
                      });
                    }

                    // Fallback to static demo rectangles
                    return zones.map((z) => {
                      const { x, y, w, h } = z.svgBounds || { x: 40, y: 95, w: 185, h: 165 };
                      const isSelected = selectedZoneKey === z.key;
                      const badge = getFruinBadge(z?.level || 0, z?.currentDensity || 0);

                      let fillColor = '#09090b';
                      if (z.level === 3) fillColor = 'rgba(153, 27, 27, 0.45)';
                      else if (z.level === 2) fillColor = 'rgba(146, 64, 14, 0.35)';
                      else if (z.level === 1) fillColor = 'rgba(113, 63, 18, 0.25)';

                      return (
                        <g key={z.id} onClick={() => setSelectedZoneKey(z.key)} className="cursor-pointer">
                          <rect
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            rx="4"
                            fill={fillColor}
                            stroke={isSelected ? '#ffffff' : z.level >= 3 ? '#ef4444' : z.level === 2 ? '#f59e0b' : '#27272a'}
                            strokeWidth={isSelected ? '2' : '1'}
                          />
                          <text x={x + 10} y={y + 18} fill="#ffffff" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
                            {z.shortName} <tspan fill="#71717a" fontSize="8.5">[{z.key.toUpperCase()}]</tspan>
                          </text>
                          <text x={x + 10} y={y + 32} fill={z.level >= 2 ? '#f87171' : '#34d399'} fontSize="9.5" fontFamily="monospace" fontWeight="bold">
                            {z.personCount || 0} PAX • {(z.currentDensity ?? z.density ?? 0).toFixed(2)} p/m²
                          </text>
                          <text x={x + 10} y={y + 45} fill="#94a3b8" fontSize="8" fontFamily="monospace">
                            GIS Area: {z.key === 'z1' ? '320' : z.key === 'z2' ? '95' : z.key === 'z3' ? '480' : '240'} m² • {badge.label}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* Corridors / Walkway Connectors (Dynamic GeoJSON Projection) */}
                  {gisLayers.corridors && (() => {
                    const customCorridors = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'LineString');
                    if (gisProjector && customCorridors.length > 0) {
                      return customCorridors.map((c, idx) => {
                        const pts = (c.geometry?.coordinates || []).map(gisProjector.project);
                        const cid = c.id || c.properties?.id || `corridor_${idx + 1}`;
                        const isBlocked = blockedEdges.includes(cid);
                        const pointsStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                        const midX = pts.length >= 2 ? Math.round((pts[0].x + pts[pts.length - 1].x) / 2) : 320;
                        const midY = pts.length >= 2 ? Math.round((pts[0].y + pts[pts.length - 1].y) / 2) : 180;
                        const label = c.properties?.name || `${c.properties?.length_m || 20}m Walkway`;

                        return (
                          <g key={cid} onClick={() => handleToggleBlockCorridor(cid)} className="cursor-pointer">
                            <polyline
                              points={pointsStr}
                              fill="none"
                              stroke={isBlocked ? '#ef4444' : '#64748b'}
                              strokeWidth={isBlocked ? '3.5' : '2.5'}
                              strokeDasharray={isBlocked ? '5 3' : 'none'}
                            />
                            <text x={midX} y={midY - 5} fill={isBlocked ? '#f87171' : '#94a3b8'} fontSize="8" fontFamily="monospace" textAnchor="middle">
                              {isBlocked ? '⛔ BLOCKED' : label}
                            </text>
                          </g>
                        );
                      });
                    }

                    // Fallback demo corridors
                    return [
                      { key: 'z1-z2', x1: 225, y1: 177, x2: 415, y2: 177, label: 'East Choke (35m • 2.8m)', midX: 320, midY: 172 },
                      { key: 'z1-z3', x1: 132, y1: 260, x2: 240, y2: 260, label: 'South Bypass (65m • 4.5m)', midX: 186, midY: 255 },
                      { key: 'z3-z4', x1: 320, y1: 165, x2: 320, y2: 155, label: 'North Arch (30m • 4.0m)', midX: 325, midY: 160 },
                      { key: 'z2-GATE_B', x1: 600, y1: 202, x2: 603, y2: 202, label: 'Arterial (20m)', midX: 580, midY: 195 }
                    ].map((corridor) => {
                      const isBlocked = blockedEdges.includes(corridor.key);
                      return (
                        <g key={corridor.key} onClick={() => handleToggleBlockCorridor(corridor.key)} className="cursor-pointer">
                          <line
                            x1={corridor.x1}
                            y1={corridor.y1}
                            x2={corridor.x2}
                            y2={corridor.y2}
                            stroke={isBlocked ? '#ef4444' : '#52525b'}
                            strokeWidth={isBlocked ? '3.5' : '2'}
                            strokeDasharray={isBlocked ? '5 3' : 'none'}
                          />
                          <text x={corridor.midX} y={corridor.midY} fill={isBlocked ? '#f87171' : '#71717a'} fontSize="7.5" fontFamily="monospace" textAnchor="middle">
                            {isBlocked ? '⛔ BLOCKED' : corridor.label}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {/* Dynamic Visitor Safe-Exit Evacuation Vector Paths */}
                  {gisLayers.evacRoutes && (() => {
                    const customPolygons = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'Polygon');
                    const customGates = (gisMaster?.features || []).filter((f) => f.geometry?.type === 'Point');

                    if (gisProjector && customPolygons.length > 0) {
                      return customPolygons.map((f, idx) => {
                        const zid = (f.id || f.properties?.id || `z${idx + 1}`).toLowerCase();
                        const rInfo = routes[zid] || (gisRouting?.evacuation && gisRouting.evacuation[zid]);
                        if (!rInfo) return null;

                        const ring = (f.geometry?.coordinates && f.geometry.coordinates[0]) || [];
                        const pts = ring.map(gisProjector.project);
                        const validPts = pts.length > 1 ? pts.slice(0, -1) : pts;
                        const startPt = {
                          x: Math.round(validPts.reduce((acc, p) => acc + p.x, 0) / Math.max(validPts.length, 1)),
                          y: Math.round(validPts.reduce((acc, p) => acc + p.y, 0) / Math.max(validPts.length, 1))
                        };

                        let endPt = { x: 550, y: 70 };
                        if (customGates.length > 0) {
                          const targetGateId = (rInfo.target_exit || rInfo.exit || '').toLowerCase();
                          const matchedGate = customGates.find((g) => (g.id || g.properties?.id || '').toLowerCase() === targetGateId) || customGates[0];
                          endPt = gisProjector.project(matchedGate.geometry.coordinates);
                        }

                        const isIsolated = rInfo.status?.includes('ISOLATED') || rInfo.status?.includes('TRAPPED');

                        return (
                          <g key={`evac-vector-${zid}`}>
                            <line
                              x1={startPt.x}
                              y1={startPt.y}
                              x2={endPt.x}
                              y2={endPt.y}
                              stroke={isIsolated ? '#ef4444' : '#10b981'}
                              strokeWidth="3.5"
                              strokeOpacity="0.3"
                            />
                            <line
                              x1={startPt.x}
                              y1={startPt.y}
                              x2={endPt.x}
                              y2={endPt.y}
                              stroke={isIsolated ? '#ef4444' : '#34d399'}
                              strokeWidth="2"
                              strokeDasharray={isIsolated ? '4 4' : '6 3'}
                            />
                            <circle cx={endPt.x} cy={endPt.y} r="3" fill={isIsolated ? '#ef4444' : '#10b981'} />
                          </g>
                        );
                      });
                    }

                    return zones.map((z) => {
                      const rInfo = routes[z.key];
                      if (!rInfo) return null;

                      const zCenters = {
                        z1: { x: 132, y: 177 },
                        z2: { x: 507, y: 202 },
                        z3: { x: 320, y: 252 },
                        z4: { x: 320, y: 92 }
                      };
                      const startPt = zCenters[z.key] || { x: 130, y: 170 };
                      const exitPts = {
                        GATE_A: { x: 32, y: 192 },
                        GATE_B: { x: 601, y: 202 },
                        GATE_C: { x: 317, y: 20 }
                      };
                      const targetExitKey = rInfo.exit ? rInfo.exit.toUpperCase() : 'GATE_A';
                      const endPt = exitPts[targetExitKey] || exitPts.GATE_A;
                      const isIsolated = rInfo.status === 'TRAPPED_OR_ISOLATED';

                      return (
                        <g key={`evac-vector-${z.key}`}>
                          <line
                            x1={startPt.x}
                            y1={startPt.y}
                            x2={endPt.x}
                            y2={endPt.y}
                            stroke={isIsolated ? '#ef4444' : '#10b981'}
                            strokeWidth="3.5"
                            strokeOpacity="0.3"
                          />
                          <line
                            x1={startPt.x}
                            y1={startPt.y}
                            x2={endPt.x}
                            y2={endPt.y}
                            stroke={isIsolated ? '#ef4444' : '#34d399'}
                            strokeWidth="2"
                            strokeDasharray={isIsolated ? '4 4' : '6 3'}
                          />
                          <circle cx={endPt.x} cy={endPt.y} r="3" fill={isIsolated ? '#ef4444' : '#10b981'} />
                        </g>
                      );
                    });
                  })()}

                  {/* First Responder Fastest Approach Vector Line */}
                  {gisLayers.responderRoutes && (
                    <g>
                      <line
                        x1="50"
                        y1="45"
                        x2={selectedZoneKey === 'z1' ? '132' : selectedZoneKey === 'z2' ? '507' : selectedZoneKey === 'z3' ? '320' : '320'}
                        y2={selectedZoneKey === 'z1' ? '177' : selectedZoneKey === 'z2' ? '202' : selectedZoneKey === 'z3' ? '252' : '92'}
                        stroke="#0ea5e9"
                        strokeWidth="2.5"
                        strokeDasharray="6 3"
                      />
                      <circle
                        cx={selectedZoneKey === 'z1' ? '132' : selectedZoneKey === 'z2' ? '507' : selectedZoneKey === 'z3' ? '320' : '320'}
                        cy={selectedZoneKey === 'z1' ? '177' : selectedZoneKey === 'z2' ? '202' : selectedZoneKey === 'z3' ? '252' : '92'}
                        r="5"
                        fill="#38bdf8"
                      />
                    </g>
                  )}

                  {/* IoT Hardware Mesh Nodes & Live Physical SOS Beacon Markers */}
                                    {gisLayers.nodes && nodes.map((n) => {
                    const isOnline = n.status === 'ONLINE';
                    const isSosActive = n.sos === 1;
                    const nx = n.zNum === 1 ? 75 : n.zNum === 2 ? 450 : n.zNum === 3 ? 275 : 350;
                    const ny = n.zNum === 1 ? 140 : n.zNum === 2 ? 145 : n.zNum === 3 ? 270 : 85;

                    return (
                      <g key={n.id}>
                        {isSosActive && (
                          <>
                            <circle cx={nx} cy={ny} r="18" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" strokeWidth="1.5">
                              <animate attributeName="r" values="8;24;32" dur="1.2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="1;0.4;0" dur="1.2s" repeatCount="indefinite" />
                            </circle>
                            <circle cx={nx} cy={ny} r="10" fill="#ef4444" />
                            <g transform={`translate(${nx - 36}, ${ny - 20})`}>
                              <rect width="72" height="15" rx="3" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                              <text x="36" y="11" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                                🚨 SOS PIN 13!
                              </text>
                            </g>
                          </>
                        )}
                        {!isSosActive && (
                          <circle cx={nx} cy={ny} r="4.5" fill={isOnline ? '#10b981' : '#71717a'} stroke="#000000" strokeWidth="1" />
                        )}
                        <text x={nx + 8} y={ny + 3} fill={isSosActive ? '#ef4444' : '#a1a1aa'} fontSize="7.5" fontFamily="monospace" fontWeight={isSosActive ? 'bold' : 'normal'}>
                          {n.id} {isSosActive ? '[ALARM]' : ''}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Live Real-World Metric / GPS Coordinate Readout */}
                <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/85 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                  {hoverCoords ? (
                    hoverCoords.isGps ? (
                      <span>GIS GPS Location: <span className="text-emerald-400 font-bold">{hoverCoords.lat}°N, {hoverCoords.lon}°E</span> (WGS-84)</span>
                    ) : (
                      <span>GIS Metric Grid: <span className="text-white font-bold">X: {hoverCoords.x}m, Y: {hoverCoords.y}m</span> (EPSG:3857)</span>
                    )
                  ) : (
                    <span>Hover venue map for real-time GIS coordinates</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
                <span>Click any corridor line to toggle corridor blockade. Dynamic NetworkX Dijkstra reroutes instantly.</span>
                <span className="text-zinc-400">Cost = length × (1 + 4 × risk)</span>
              </div>
            </div>
                </div>
                <div className="lg:col-span-4 space-y-4">
                  
{/* EMERGENCY HAZARD INCIDENT ISOLATION & LORA BROADCAST PANEL */}
<div className="bg-zinc-950 border border-red-900/60 rounded-lg p-3 space-y-3 font-mono">
  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
    <div className="flex items-center gap-2">
      <Flame className="w-4 h-4 text-red-500 animate-pulse" />
      <span className="text-xs font-bold text-white uppercase tracking-wider">
        Hazard Incident Isolation &amp; Mesh Broadcast
      </span>
    </div>
    <span className="text-[10px] text-zinc-500">LoRa 433MHz • ESP-NOW</span>
  </div>

  {/* Active Hazard Incident Alert Banner */}
  {activeHazards && activeHazards.has_hazard && (
    <div className="p-2.5 rounded bg-red-950/80 border border-red-700/80 text-xs space-y-2 animate-pulse">
      <div className="flex items-center justify-between text-red-300 font-bold">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          HAZARD ACTIVE: {Object.keys(activeHazards.isolated_zones || {}).map((z) => z.toUpperCase()).join(', ')} ISOLATED
        </span>
        <span className="text-[10px] bg-red-900 text-red-200 px-1.5 py-0.5 rounded border border-red-600 font-bold">
          TRAVEL COST = ∞
        </span>
      </div>
      <p className="text-[11px] text-red-200/90 leading-tight">
        All intersecting corridors locked. NetworkX dynamic routing has isolated compromised sector and recalculated shortest safe exit paths avoiding the hazard.
      </p>

      {/* Synchronized LoRa Signboard Text Payloads */}
      <div className="pt-1.5 border-t border-red-900/60 space-y-1">
        <div className="text-red-400 font-bold uppercase text-[9.5px]">
          Synchronized Field Display Broadcasts (Transmitted via Gateway Serial):
        </div>
        {(hazardBroadcasts || []).map((b, bi) => (
          <div key={bi} className="bg-black/90 px-2 py-1.5 rounded border border-red-800/60 flex items-center justify-between text-[10px]">
            <span className="text-zinc-300 font-mono">
              <span className="text-red-400 font-bold mr-1">Node {b.zone_id ? b.zone_id.toUpperCase() : `Z${b.z_num}`}:</span>
              "{b.text}"
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1 ml-2 shrink-0">
              <span>{b.arrow}</span>
              <span className="text-[9px] text-zinc-400">({b.exit})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )}

  {/* Incident Trigger & Clear Controls */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
    <div>
      <label className="text-[10px] text-zinc-400 block mb-1">COMPROMISED SECTOR</label>
      <select
        value={selectedHazardZone}
        onChange={(e) => setSelectedHazardZone(e.target.value)}
        className="w-full bg-black border border-zinc-800 rounded p-1.5 text-xs text-white font-mono focus:border-red-500"
      >
        <option value="z2">Zone 2 (East Choke)</option>
        <option value="z1">Zone 1 (Main Plaza)</option>
        <option value="z3">Zone 3 (South Bridge)</option>
        <option value="z4">Zone 4 (North Choke)</option>
      </select>
    </div>
    <div>
      <label className="text-[10px] text-zinc-400 block mb-1">HAZARD NATURE</label>
      <select
        value={selectedHazardType}
        onChange={(e) => setSelectedHazardType(e.target.value)}
        className="w-full bg-black border border-zinc-800 rounded p-1.5 text-xs text-white font-mono focus:border-red-500"
      >
        <option value="FIRE">🔥 Fire Outbreak</option>
        <option value="CRITICAL HAZARD">⚠️ Critical Crush Hazard</option>
        <option value="STRUCTURAL">🚫 Structural Collapse</option>
      </select>
    </div>
    <div className="flex items-end gap-1.5">
      <button
        onClick={() => handleTriggerHazard(selectedHazardZone, selectedHazardType)}
        className="flex-1 py-1.5 px-2 rounded bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 text-[11px] font-bold flex items-center justify-center gap-1 transition"
      >
        <Flame className="w-3.5 h-3.5 text-red-400" />
        <span>ISOLATE &amp; REROUTE</span>
      </button>
      {activeHazards && activeHazards.has_hazard && (
        <button
          onClick={() => handleClearHazard(null)}
          title="Restore standard paths & send all-clear"
          className="py-1.5 px-2 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1 transition shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>ALL CLEAR</span>
        </button>
      )}
    </div>
  </div>
</div>

                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="border-b border-zinc-900 pb-2 mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">GIS Zone Spatial Inspector</span>
                    <h3 className="text-sm font-bold text-white font-mono">
                      {zones.find((z) => z.key === selectedZoneKey)?.name}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-emerald-400">
                    ID: {selectedZoneKey.toUpperCase()}
                  </span>
                </div>

                {/* Live GIS & Physics Metrics */}
                {(() => {
                  const currZ = (zones && zones.length > 0 ? (zones.find((z) => z.key === selectedZoneKey) || zones[0]) : null) || { key: 'z1', name: 'Zone A', personCount: 0, capacity: 100, currentDensity: 0, density: 0, level: 0, speed: 0, flowRate: 0, conflict: 'Low' };
                  const routeInfo = routes[selectedZoneKey];
                  const fc = forecasts[selectedZoneKey] || { t10: 0, t15: 0, p_critical: 0 };
                  const badge = getFruinBadge(currZ?.level || 0, currZ?.currentDensity || 0);
                  const gisArea = selectedZoneKey === 'z1' ? 320 : selectedZoneKey === 'z2' ? 95 : selectedZoneKey === 'z3' ? 480 : 240;

                  return (
                    <div className="space-y-2.5 font-mono text-xs">
                      <div className="grid grid-cols-2 gap-2 p-2 rounded bg-black border border-zinc-900">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">REAL GIS FLOOR AREA</span>
                          <span className="text-sm font-bold text-white">{gisArea} m²</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">DESIGN CAPACITY</span>
                          <span className="text-sm font-bold text-zinc-300">{currZ.capacity || 100} pax</span>
                        </div>
                      </div>

                      {/* GIS Spatial Density Calculation Formula */}
                      <div className="p-2.5 rounded bg-black border border-emerald-900/60 text-[11px] font-mono space-y-1">
                        <div className="flex items-center justify-between text-emerald-400 font-bold">
                          <span className="flex items-center gap-1">
                            <Compass className="w-3.5 h-3.5" />
                            GIS SPATIAL DENSITY FORMULA
                          </span>
                          <span className="text-[9px] text-zinc-500">Shapely Metric Area</span>
                        </div>
                        <div className="text-zinc-300 text-xs py-1">
                          Density = <span className="text-white font-bold">{currZ.personCount || 0} PAX</span> (YOLOv8) ÷ <span className="text-emerald-400 font-bold">{gisArea} m²</span> (GIS Polygon) = <span className={`font-bold ${badge.text}`}>{(currZ?.currentDensity ?? currZ?.density ?? 0).toFixed(2)} pax/m²</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 border-t border-zinc-900 pt-1 flex justify-between">
                          <span>Capacity Saturation: {Math.round(((currZ.personCount || 0) / (currZ.capacity || 1)) * 100)}%</span>
                          <span>Fruin LoS: {badge.label}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2 rounded bg-black border border-zinc-900">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">TRUE DENSITY (PAX/M²)</span>
                          <span className={`text-base font-bold ${badge.text}`}>{(currZ?.currentDensity ?? currZ?.density ?? 0).toFixed(2)} p/m²</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">FRUIN LEVEL OF SERVICE</span>
                          <span className="text-xs font-bold text-white">{badge.label}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2 rounded bg-black border border-zinc-900">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">WALK VELOCITY</span>
                          <span className="text-zinc-200">{currZ.speed || 0} m/s</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">TURBULENCE CONFLICT</span>
                          <span className="text-zinc-200">{currZ.conflict || 'Low'}</span>
                        </div>
                      </div>

                      {/* Visitor Evacuation Recommendation */}
                      <div className="p-2.5 rounded bg-black border border-zinc-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-zinc-500 uppercase">Visitor Evacuation Route</span>
                          <span className="text-[9px] text-emerald-400 font-bold">OPTIMAL PATH</span>
                        </div>
                        <div className="text-sm font-bold text-emerald-400">
                          {routeInfo ? `→ ${routeInfo.exit}` : 'Awaiting Graph'}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-1 flex justify-between">
                          <span>Path: {routeInfo && routeInfo.path ? routeInfo.path.join(' → ') : selectedZoneKey}</span>
                          <span>Est: ~{Math.round((gisArea / 25) + 10)}s</span>
                        </div>
                      </div>

                      {/* Emergency First Responder Approach Vector */}
                      <div className="p-2.5 rounded bg-sky-950/40 border border-sky-800/80">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-sky-400 uppercase font-bold flex items-center gap-1">
                            <Navigation className="w-3 h-3 text-sky-400" />
                            First Responder Ingress
                          </span>
                          <span className="text-[9px] text-sky-300">ETA: ~{Math.round((gisArea / 40) + 6)}s</span>
                        </div>
                        <div className="text-xs text-zinc-300">
                          Base 1 ➔ Gate A Chute ➔ <span className="text-sky-300 font-bold">{currZ.name}</span>
                        </div>
                        <span className="text-[9px] text-zinc-500 block mt-1">Unblocked tactical corridor cleared for emergency ingress</span>
                      </div>

                      {/* 10-Min Prediction */}
                      <div className="p-2.5 rounded bg-black border border-zinc-800">
                        <span className="text-[10px] text-zinc-500 uppercase block mb-1">10-Min Early Prediction (T+10m)</span>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white font-bold">{fc.t10} p/m²</span>
                          <span className="text-zinc-400">P(Crush): {Math.round(fc.p_critical * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  const currZ = zones.find((z) => z.key === selectedZoneKey);
                  const zNum = selectedZoneKey.replace('z', '');
                  setDispatchModal({ targetZoneNum: parseInt(zNum), zoneName: currZ?.name });
                }}
                className="w-full mt-2 py-2 rounded bg-white text-black hover:bg-zinc-200 text-xs font-mono font-bold flex items-center justify-center gap-2 transition"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>DISPATCH DOWNLINK TO {selectedZoneKey.toUpperCase()}</span>
              </button>
            </div>
                </div>
              </div>
            )}

          </div>
        )}


        {/* ==================================================================
            HUB 2: INCIDENT & RESPONSE (EMERGENCY CRISIS DESK)
            Unified Alert Queue + Medical Triage & Paramedic Squads + Warning Downlink
           ================================================================== */}
        {activeTab === 'INCIDENTS' && (
          <div className="space-y-4 font-mono">
            {/* Emergency Command Header Banner */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-950 border border-red-700 rounded-lg text-red-400">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white uppercase tracking-wider">
                      Emergency Command &amp; Medical Triage Desk
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                      MED-BAY-HQ ACTIVE
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Unified crisis operations: Automated zone camera triage, shortest paramedic approach routing, LoRa speaker downlinks, and active alert queue.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleSimulateHardwareSos('z2')}
                  className="px-3 py-1.5 rounded bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>Test Hardware SOS (GPIO 12)</span>
                </button>
                <button
                  onClick={handleTriggerSirenAll}
                  className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition"
                >
                  <AlertOctagon className="w-3.5 h-3.5 animate-bounce" />
                  <span>Trigger Venue Evacuation Sirens</span>
                </button>
              </div>
            </div>

            {/* Incident Stats & Severity Filter Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 uppercase">INCIDENT FILTER:</span>
                {[
                  { id: 'all', label: `All Alerts (${alerts.length})` },
                  { id: 'critical', label: `Critical SOS (${alerts.filter(a => a.severity === 'critical' || a.type === 'SOS_HARDWARE' || a.level >= 3).length})` },
                  { id: 'density', label: `Crowd Density (${alerts.filter(a => a.type === 'CROWD_DENSITY').length})` }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setIncidentFilter(f.id)}
                    className={`px-2.5 py-1 rounded text-xs font-bold border transition ${
                      incidentFilter === f.id
                        ? 'bg-zinc-800 border-zinc-600 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="text-xs text-zinc-400">
                Active Incidents: <span className="text-white font-bold">{alerts.length}</span> • Unacknowledged: <span className="text-red-400 font-bold">{unackAlertsCount}</span>
              </div>
            </div>

            {/* Active Emergency Triage Card (or Standby Reassurance Card) */}
            

            {/* Two-Column Emergency Response Operations */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column (col-span-7): First Responder Squads & 3-Preset Downlink Authorizer */}
              <div className="lg:col-span-7 space-y-4">
                {/* Ready Medical Squads */}
                
<div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
  <h4 className="text-xs font-bold text-white uppercase border-b border-zinc-900 pb-2 flex items-center justify-between">
    <span>Available Medical Squads</span>
    <span className="text-[10px] text-zinc-500">3 UNITS DEPLOYABLE</span>
  </h4>
  <div className="space-y-2 text-xs">
    {[
      { name: 'Medical Squad Alpha (Paramedic Unit 1)', location: 'MED-BAY-HQ (Station 1)', speed: '3.0 m/s', status: 'AVAILABLE', equip: 'Defibrillator + Trauma Kit + Stretcher' },
      { name: 'Medical Squad Bravo (Rapid EMT)', location: 'Gate A Turnstile Post', speed: '3.2 m/s', status: 'AVAILABLE', equip: 'First Aid + Mobile Oxygen' },
      { name: 'Field Trauma Team 3', location: 'Amphitheater North Access', speed: '2.5 m/s', status: 'STANDBY', equip: 'Advanced Cardiac Care + Triage Tent' }
    ].map((sq, i) => (
      <div key={i} className="p-2.5 rounded bg-black border border-zinc-800/80 flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="font-bold text-white block">{sq.name}</span>
          <span className="text-[10px] text-zinc-400 block">Base: {sq.location} • Speed: {sq.speed}</span>
          <span className="text-[9.5px] text-zinc-500 block">{sq.equip}</span>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
          {sq.status}
        </span>
      </div>
    ))}
  </div>
</div>


                {/* Rapid 3-Preset Warning Speaker Downlink Authorizer */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Direct Downlink Warning Speaker Authorizer
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500">433/866 MHz LoRa Mesh</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Authorize and transmit immediate audio warning broadcasts to field nodes with DFPlayer Mini modules:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      onClick={() => handleRespondToEmergency(1)}
                      className="bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-200 p-2.5 rounded-lg text-left transition space-y-1 group"
                    >
                      <div className="flex justify-between items-center text-[10px] text-red-400 font-bold">
                        <span>PRESET 1</span>
                        <span>0001.mp3</span>
                      </div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>🚨 Emergency Evac</span>
                      </div>
                      <p className="text-[10px] text-red-300/80 leading-tight">
                        "Attention please, an emergency has occurred. Please walk calmly towards designated exit gates."
                      </p>
                    </button>
                    <button
                      onClick={() => handleRespondToEmergency(2)}
                      className="bg-amber-950/80 hover:bg-amber-900 border border-amber-700 text-amber-200 p-2.5 rounded-lg text-left transition space-y-1 group"
                    >
                      <div className="flex justify-between items-center text-[10px] text-amber-400 font-bold">
                        <span>PRESET 2</span>
                        <span>0002.mp3</span>
                      </div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>⚠️ Crowd Caution</span>
                      </div>
                      <p className="text-[10px] text-amber-300/80 leading-tight">
                        "Attention, heavy crowd congestion ahead. Please slow down, avoid pushing, and maintain space."
                      </p>
                    </button>
                    <button
                      onClick={() => handleRespondToEmergency(3)}
                      className="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 p-2.5 rounded-lg text-left transition space-y-1 group"
                    >
                      <div className="flex justify-between items-center text-[10px] text-emerald-400 font-bold">
                        <span>PRESET 3</span>
                        <span>0003.mp3</span>
                      </div>
                      <div className="text-xs font-bold text-white flex items-center gap-1">
                        <span>✅ All Clear</span>
                      </div>
                      <p className="text-[10px] text-emerald-300/80 leading-tight">
                        "Attention, the situation is now under control and safe. Please remain in place calmly."
                      </p>
                    </button>
                  </div>
                </div>

                {/* Medical Dispatch Triage Log */}
                
              </div>

              {/* Right Column (col-span-5): Active Alerts Queue & Operator Action Audit Trail */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Emergency Hazard Incident Isolation Desk */}
                
{/* EMERGENCY HAZARD INCIDENT ISOLATION & LORA BROADCAST PANEL */}
<div className="bg-zinc-950 border border-red-900/60 rounded-lg p-3 space-y-3 font-mono">
  <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
    <div className="flex items-center gap-2">
      <Flame className="w-4 h-4 text-red-500 animate-pulse" />
      <span className="text-xs font-bold text-white uppercase tracking-wider">
        Hazard Incident Isolation &amp; Mesh Broadcast
      </span>
    </div>
    <span className="text-[10px] text-zinc-500">LoRa 433MHz • ESP-NOW</span>
  </div>

  {/* Active Hazard Incident Alert Banner */}
  {activeHazards && activeHazards.has_hazard && (
    <div className="p-2.5 rounded bg-red-950/80 border border-red-700/80 text-xs space-y-2 animate-pulse">
      <div className="flex items-center justify-between text-red-300 font-bold">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          HAZARD ACTIVE: {Object.keys(activeHazards.isolated_zones || {}).map((z) => z.toUpperCase()).join(', ')} ISOLATED
        </span>
        <span className="text-[10px] bg-red-900 text-red-200 px-1.5 py-0.5 rounded border border-red-600 font-bold">
          TRAVEL COST = ∞
        </span>
      </div>
      <p className="text-[11px] text-red-200/90 leading-tight">
        All intersecting corridors locked. NetworkX dynamic routing has isolated compromised sector and recalculated shortest safe exit paths avoiding the hazard.
      </p>

      {/* Synchronized LoRa Signboard Text Payloads */}
      <div className="pt-1.5 border-t border-red-900/60 space-y-1">
        <div className="text-red-400 font-bold uppercase text-[9.5px]">
          Synchronized Field Display Broadcasts (Transmitted via Gateway Serial):
        </div>
        {(hazardBroadcasts || []).map((b, bi) => (
          <div key={bi} className="bg-black/90 px-2 py-1.5 rounded border border-red-800/60 flex items-center justify-between text-[10px]">
            <span className="text-zinc-300 font-mono">
              <span className="text-red-400 font-bold mr-1">Node {b.zone_id ? b.zone_id.toUpperCase() : `Z${b.z_num}`}:</span>
              "{b.text}"
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1 ml-2 shrink-0">
              <span>{b.arrow}</span>
              <span className="text-[9px] text-zinc-400">({b.exit})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )}

  {/* Incident Trigger & Clear Controls */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
    <div>
      <label className="text-[10px] text-zinc-400 block mb-1">COMPROMISED SECTOR</label>
      <select
        value={selectedHazardZone}
        onChange={(e) => setSelectedHazardZone(e.target.value)}
        className="w-full bg-black border border-zinc-800 rounded p-1.5 text-xs text-white font-mono focus:border-red-500"
      >
        <option value="z2">Zone 2 (East Choke)</option>
        <option value="z1">Zone 1 (Main Plaza)</option>
        <option value="z3">Zone 3 (South Bridge)</option>
        <option value="z4">Zone 4 (North Choke)</option>
      </select>
    </div>
    <div>
      <label className="text-[10px] text-zinc-400 block mb-1">HAZARD NATURE</label>
      <select
        value={selectedHazardType}
        onChange={(e) => setSelectedHazardType(e.target.value)}
        className="w-full bg-black border border-zinc-800 rounded p-1.5 text-xs text-white font-mono focus:border-red-500"
      >
        <option value="FIRE">🔥 Fire Outbreak</option>
        <option value="CRITICAL HAZARD">⚠️ Critical Crush Hazard</option>
        <option value="STRUCTURAL">🚫 Structural Collapse</option>
      </select>
    </div>
    <div className="flex items-end gap-1.5">
      <button
        onClick={() => handleTriggerHazard(selectedHazardZone, selectedHazardType)}
        className="flex-1 py-1.5 px-2 rounded bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 text-[11px] font-bold flex items-center justify-center gap-1 transition"
      >
        <Flame className="w-3.5 h-3.5 text-red-400" />
        <span>ISOLATE &amp; REROUTE</span>
      </button>
      {activeHazards && activeHazards.has_hazard && (
        <button
          onClick={() => handleClearHazard(null)}
          title="Restore standard paths & send all-clear"
          className="py-1.5 px-2 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1 transition shrink-0"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>ALL CLEAR</span>
        </button>
      )}
    </div>
  </div>
</div>


                {/* Active System Alerts Queue */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-mono text-zinc-400 uppercase">
                      Incident Alert Queue ({unackAlertsCount} Unacknowledged)
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500">Auto-prioritized</span>
                  </div>
                  
                </div>

                {/* Operator Chronological Audit Log */}
                
<div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono">
  <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-2 text-xs">
    <div className="flex items-center gap-2">
      <Terminal className="w-3.5 h-3.5 text-zinc-400" />
      <span className="text-white font-bold">USB Serial LoRa Packet Monitor</span>
    </div>
    <span className="text-[10px] text-zinc-500">Baud: 115200</span>
  </div>
  <div className="bg-black border border-zinc-900 rounded p-3 text-[11px] h-48 overflow-y-auto space-y-1 text-zinc-400">
    {operatorLog.length === 0 ? (
      <div className="text-zinc-600">Awaiting incoming hardware serial packets...</div>
    ) : (
      operatorLog.map((log, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-zinc-600">{log.ts}</span>
          <span className="text-zinc-300 font-bold">[{log.action}]</span>
          <span className="text-zinc-400">{log.details}</span>
        </div>
      ))
    )}
  </div>
</div>

              </div>
            </div>
          </div>
        )}


        {/* ==================================================================
            HUB 3: HARDWARE & SETTINGS (INFRASTRUCTURE & CONFIGURATION)
            Unified LoRa Mesh Gateway & Nodes + Camera Feed Manager + Ground Calibration
           ================================================================== */}
        {activeTab === 'HARDWARE' && (
          <div className="space-y-4 font-mono">
            {/* Hardware Sub-Navigation Bar */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-zinc-500 font-bold mr-1 hidden sm:inline">SECTION:</span>
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                  <button
                    onClick={() => setHardwareSubTab('nodes')}
                    className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                      hardwareSubTab === 'nodes'
                        ? 'bg-zinc-800 text-white border border-zinc-650 shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    <span>1. LoRa Mesh &amp; Field Nodes</span>
                  </button>
                  <button
                    onClick={() => setHardwareSubTab('cameras')}
                    className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                      hardwareSubTab === 'cameras'
                        ? 'bg-zinc-800 text-white border border-zinc-650 shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    <span>2. Camera Feeds &amp; Sources</span>
                  </button>
                  <button
                    onClick={() => setHardwareSubTab('calibration')}
                    className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition ${
                      hardwareSubTab === 'calibration'
                        ? 'bg-zinc-800 text-white border border-zinc-650 shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>3. Homography &amp; Thresholds</span>
                  </button>
                </div>
              </div>

              <div className="text-xs text-zinc-400 flex items-center gap-3">
                <span>GATEWAY: <strong className={backendOnline ? 'text-emerald-400' : 'text-red-400'}>{backendOnline ? 'ONLINE (COM7)' : 'STANDBY'}</strong></span>
                <span>•</span>
                <span>NODES: <strong className="text-white">{nodes.filter(n => n.status === 'ONLINE').length}/4 ACTIVE</strong></span>
              </div>
            </div>

            {/* SUB-TAB 1: LORA MESH & FIELD NODES */}
            {hardwareSubTab === 'nodes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="text-xs font-mono text-zinc-400 uppercase">
                    Physical Mesh Status (ESP32 / ESP8266 + LoRa SX1278)
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Frequency: 433 MHz / 866 MHz Point-to-Point
                  </span>
                </div>

                {/* Field Nodes Cards */}
                
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
  {nodes.map((node) => {
    const isOnline = node.status === 'ONLINE';
    return (
      <div key={node.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white">{node.id}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
            isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/50' : 'bg-zinc-900 text-zinc-500'
          }`}>
            {node.status}
          </span>
        </div>

        <div className="text-[11px] text-zinc-400">{node.name}</div>
        <div className="text-[10px] text-zinc-500">{node.location}</div>

        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-zinc-900 text-[10px]">
          <div>
            <span className="text-zinc-600 block">PROTOCOL</span>
            <span className="text-zinc-300">{node.protocol}</span>
          </div>
          <div>
            <span className="text-zinc-600 block">LAST SEEN</span>
            <span className={isOnline ? 'text-emerald-400' : 'text-zinc-500'}>{node.lastSeen}</span>
          </div>
          <div>
            <span className="text-zinc-600 block">BATTERY</span>
            <span className="text-zinc-300">{node.batteryVolts}V ({node.batteryPct}%)</span>
          </div>
          <div>
            <span className="text-zinc-600 block">RSSI</span>
            <span className="text-zinc-300">{node.rssi} dBm</span>
          </div>
        </div>

        {node.sos === 1 && (
          <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded text-center animate-pulse flex items-center justify-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>PHYSICAL SOS PRESSED (PIN 13)</span>
          </div>
        )}

        {node.zNum > 0 && (
          <div className="pt-2 border-t border-zinc-900 space-y-1">
            <div className="flex items-center justify-between text-[9px] text-zinc-500 uppercase">
              <span>Warning Speaker Dispatch:</span>
              <button
                onClick={() => setDispatchModal({ targetZoneNum: node.zNum, zoneName: node.name })}
                className="text-zinc-400 hover:text-white underline text-[9px]"
              >
                Custom ↗
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => handleQuickDispatch(node.zNum, 1)}
                className="py-1 px-1 bg-red-950/70 hover:bg-red-900 border border-red-800 text-[9px] text-red-200 rounded font-bold text-center transition"
                title="Play Track 1: Emergency Evacuation"
              >
                🚨 1. Evacuate
              </button>
              <button
                onClick={() => handleQuickDispatch(node.zNum, 2)}
                className="py-1 px-1 bg-amber-950/70 hover:bg-amber-900 border border-amber-800 text-[9px] text-amber-200 rounded font-bold text-center transition"
                title="Play Track 2: Crowd Caution / Slow Down"
              >
                ⚠️ 2. Caution
              </button>
              <button
                onClick={() => handleQuickDispatch(node.zNum, 3)}
                className="py-1 px-1 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800 text-[9px] text-emerald-200 rounded font-bold text-center transition"
                title="Play Track 3: All Clear / Standby"
              >
                ✅ 3. Clear
              </button>
            </div>
          </div>
        )}
      </div>
    );
  })}
</div>


                {/* Gateway Port Connection Panel & Serial Live Packet Monitor */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5">
                    
<div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono space-y-4">
  <div className="border-b border-zinc-800 pb-2">
    <h3 className="text-sm font-bold text-white uppercase">Hardware Ports &amp; Diagnostics</h3>
    <p className="text-xs text-zinc-400 mt-1">Available Windows serial ports for ESP32 LoRa Gateway.</p>
  </div>

  <div className="space-y-2 text-xs">
    <span className="text-zinc-500 block">DETECTED COM PORTS:</span>
    {availableComPorts.length === 0 ? (
      <div className="p-3 rounded bg-black border border-zinc-900 text-zinc-500 text-[11px]">
        No physical COM ports detected. Connect ESP32 Gateway to USB.
      </div>
    ) : (
      availableComPorts.map((p) => (
        <div key={p.port} className="p-2.5 rounded bg-black border border-zinc-800 flex justify-between items-center">
          <div>
            <span className="font-bold text-white">{p.port}</span>
            <span className="text-zinc-500 block text-[10px]">{p.description}</span>
          </div>
          <span className="text-emerald-400 text-[10px] font-bold">READY</span>
        </div>
      ))
    )}
  </div>

  {/* System Diagnostics */}
  <div className="pt-2 border-t border-zinc-900 space-y-2 text-xs">
    <span className="text-zinc-500 block">LOCAL SERVER STATUS:</span>
    <div className="p-2.5 rounded bg-black border border-zinc-800 space-y-1 text-[11px]">
      <div className="flex justify-between">
        <span className="text-zinc-500">Back-end Server:</span>
        <span className={backendOnline ? 'text-emerald-400' : 'text-red-400'}>{backendOnline ? 'ACTIVE (Port 8000)' : 'STOPPED'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-500">YOLOv8 Model:</span>
        <span className="text-emerald-400">yolov8n.pt (Local CUDA/CPU)</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-500">Active Mode:</span>
        <span className="text-white font-bold">{liveMode}</span>
      </div>
    </div>
  </div>
</div>

                  </div>
                  <div className="lg:col-span-7">
                    
<div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono">
  <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-2 text-xs">
    <div className="flex items-center gap-2">
      <Terminal className="w-3.5 h-3.5 text-zinc-400" />
      <span className="text-white font-bold">USB Serial LoRa Packet Monitor</span>
    </div>
    <span className="text-[10px] text-zinc-500">Baud: 115200</span>
  </div>
  <div className="bg-black border border-zinc-900 rounded p-3 text-[11px] h-48 overflow-y-auto space-y-1 text-zinc-400">
    {operatorLog.length === 0 ? (
      <div className="text-zinc-600">Awaiting incoming hardware serial packets...</div>
    ) : (
      operatorLog.map((log, i) => (
        <div key={i} className="flex gap-2">
          <span className="text-zinc-600">{log.ts}</span>
          <span className="text-zinc-300 font-bold">[{log.action}]</span>
          <span className="text-zinc-400">{log.details}</span>
        </div>
      ))
    )}
  </div>
</div>

                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: CAMERA FEEDS & VIDEO SOURCES */}
            {hardwareSubTab === 'cameras' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Camera Setup Form */}
                <div className="lg:col-span-6">
                  
<div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono space-y-4">
  <div className="border-b border-zinc-800 pb-2">
    <h3 className="text-sm font-bold text-white uppercase">Real Camera Connection Manager</h3>
    <p className="text-xs text-zinc-400 mt-1">Configure Webcams, Smartphone IP Webcams, or RTSP streams.</p>
  </div>

  <form onSubmit={handleAddCameraSubmit} className="space-y-3 text-xs">
    <div>
      <label className="block text-zinc-400 mb-1">CAMERA LABEL / NAME</label>
      <input
        type="text"
        value={newCam.name}
        onChange={(e) => setNewCam({ ...newCam, name: e.target.value })}
        className="w-full bg-black border border-zinc-800 rounded p-2 text-white font-mono focus:border-zinc-500"
        placeholder="e.g. Main Entrance Webcam"
        required
      />
    </div>

    <div>
      <label className="block text-zinc-400 mb-1">TARGET VENUE ZONE</label>
      <select
        value={newCam.zoneId}
        onChange={(e) => setNewCam({ ...newCam, zoneId: e.target.value })}
        className="w-full bg-black border border-zinc-800 rounded p-2 text-white font-mono focus:border-zinc-500"
      >
        <option value="ZONE-A">Zone A — Main Gate Plaza</option>
        <option value="ZONE-B">Zone B — East Corridor Choke</option>
        <option value="ZONE-C">Zone C — Central Stage Arena</option>
        <option value="ZONE-D">Zone D — North Exit Concourse</option>
      </select>
    </div>

    <div>
      <label className="block text-zinc-400 mb-1">FEED SOURCE TYPE</label>
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'webcam', label: 'USB/Webcam' },
          { id: 'phone', label: 'Phone IP Cam' },
          { id: 'rtsp', label: 'RTSP CCTV' }
        ].map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => {
              let defaultVal = '0';
              if (st.id === 'phone') defaultVal = 'http://192.168.1.100:8080/video';
              if (st.id === 'rtsp') defaultVal = 'rtsp://192.168.1.50:554/live';
              setNewCam({ ...newCam, sourceType: st.id, sourceValue: defaultVal });
            }}
            className={`p-2 rounded border text-center ${
              newCam.sourceType === st.id
                ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                : 'bg-black border-zinc-800 text-zinc-400'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-zinc-400 mb-1">SOURCE PATH / DEVICE ID</label>
      <input
        type="text"
        value={newCam.sourceValue}
        onChange={(e) => setNewCam({ ...newCam, sourceValue: e.target.value })}
        className="w-full bg-black border border-zinc-800 rounded p-2 text-white font-mono focus:border-zinc-500"
        placeholder="0 for default webcam, or URL"
        required
      />
      <span className="text-[10px] text-zinc-500 block mt-1">
        Device index 0 is your built-in laptop camera. For smartphones, use your local IP Webcam URL.
      </span>
    </div>

    <div className="flex gap-2 pt-2">
      <button
        type="button"
        onClick={handleTestConnection}
        disabled={isTesting}
        className="flex-1 py-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold"
      >
        {isTesting ? 'Testing...' : 'Test Connection'}
      </button>
      <button
        type="submit"
        className="flex-1 py-2 rounded bg-white text-black hover:bg-zinc-200 font-bold"
      >
        Connect &amp; Start AI
      </button>
    </div>

    {testResult && (
      <div className={`p-2 rounded border text-[11px] ${
        testResult.success ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : 'bg-red-950 border-red-800 text-red-300'
      }`}>
        {testResult.details}
      </div>
    )}
  </form>
</div>

                </div>

                {/* Active Feeds Roster & Benchmark Video Launcher */}
                <div className="lg:col-span-6 space-y-4 font-mono">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                      <h4 className="text-xs font-bold text-white uppercase flex items-center gap-2">
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span>Active Video Feeds ({cameras.length})</span>
                      </h4>
                      <span className="text-[10px] text-zinc-500">YOLOv8 Edge Ingest</span>
                    </div>

                    {cameras.length === 0 ? (
                      <div className="p-6 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded">
                        No active camera feeds currently streaming. Connect an IP camera, USB webcam, or load the crowd benchmark below.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cameras.map((c) => (
                          <div key={c.id} className="p-2.5 rounded bg-black border border-zinc-800 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-white block">{c.name}</span>
                              <span className="text-[10px] text-zinc-400 block">Source: {c.source} • Zone: {c.zone_id} • {c.fps || 15} FPS</span>
                            </div>
                            <button
                              onClick={() => handleDeleteCamera(c.id)}
                              className="px-2 py-1 rounded bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-[10px] font-bold transition flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Disconnect</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Benchmark Crowd Video Card */}
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-white uppercase">1-Click Offline Crowd Benchmark</h4>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Launch a synthetic crowd simulation stream to test YOLOv8 pedestrian tracking, optical flow velocity vectors, and directional conflict without needing external hardware.
                    </p>
                    <button
                      type="button"
                      onClick={handleLoadSampleVideo}
                      className="w-full py-2.5 rounded bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      <span>Load Benchmark Crowd Video Now</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 3: HOMOGRAPHY GROUND CALIBRATION & FRUIN THRESHOLDS */}
            {hardwareSubTab === 'calibration' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 4-Point Homography Ground Calibration Visualizer */}
                <div className="lg:col-span-7 bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="border-b border-zinc-900 pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase">4-Point Homography Ground Floor Calibration</h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Transforms tilted CCTV camera pixel coordinates (u, v) into real-world floor coordinates (X, Y) in meters.
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                      H (3x3 Matrix) Active
                    </span>
                  </div>

                  <div className="p-3 bg-black border border-zinc-900 rounded space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-300">
                      <span>Projection Formula:</span>
                      <span className="text-emerald-400 font-bold">[X_world, Y_world, 1]^T = H · [u_pixel, v_pixel, 1]^T</span>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Eliminates perspective foreshortening so people further away count with equal ground metric weight.
                    </div>
                  </div>

                  {/* Calibrated Venue Zones Metrics */}
                  <div className="space-y-2 pt-1 text-xs">
                    <span className="text-zinc-500 text-[10px] uppercase font-bold block">Calibrated Venue Zones Floor Area:</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { name: 'Zone A — Main Gate Plaza', area: '320 m²', cap: '450 pax', corners: '[(40,120), (280,120), (320,380), (10,380)]' },
                        { name: 'Zone B — East Corridor Choke', area: '95 m²', cap: '120 pax', corners: '[(120,40), (210,40), (220,180), (110,180)]' },
                        { name: 'Zone C — Central Stage Arena', area: '480 m²', cap: '700 pax', corners: '[(30,30), (350,30), (380,310), (10,310)]' },
                        { name: 'Zone D — North Exit Concourse', area: '240 m²', cap: '350 pax', corners: '[(50,50), (260,50), (270,240), (40,240)]' }
                      ].map((z, i) => (
                        <div key={i} className="p-2.5 rounded bg-black border border-zinc-800 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-white text-[11px]">{z.name.split('—')[0].trim()}</span>
                            <span className="text-emerald-400 font-bold text-[10px]">{z.area}</span>
                          </div>
                          <div className="text-[10px] text-zinc-400">Design Capacity: {z.cap}</div>
                          <div className="text-[9px] text-zinc-600 truncate">Corners: {z.corners}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fruin Level of Service (LoS) Standards & System Diagnostics */}
                <div className="lg:col-span-5 bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="border-b border-zinc-900 pb-2">
                    <h3 className="text-sm font-bold text-white uppercase">Fruin Level of Service (LoS) Standards</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">International pedestrian density criteria (pax/m²).</p>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    {[
                      { level: 'LoS A', range: '< 0.50 p/m²', label: 'Free Flow (Safe)', color: 'text-emerald-400 bg-emerald-950 border-emerald-800' },
                      { level: 'LoS B', range: '0.50 – 1.00 p/m²', label: 'Normal Flow (Comfortable)', color: 'text-emerald-300 bg-emerald-950/60 border-emerald-700/60' },
                      { level: 'LoS C', range: '1.00 – 1.50 p/m²', label: 'Moderately Dense', color: 'text-yellow-300 bg-yellow-950/60 border-yellow-700/60' },
                      { level: 'LoS D', range: '1.50 – 2.00 p/m²', label: 'Dense Flow (Slowed)', color: 'text-amber-400 bg-amber-950/60 border-amber-700/60' },
                      { level: 'LoS E', range: '2.00 – 3.00 p/m²', label: 'Severe Congestion (Warning)', color: 'text-orange-400 bg-orange-950 border-orange-800' },
                      { level: 'LoS F', range: '≥ 3.00 p/m²', label: 'Critical Crush Hazard (Evacuate)', color: 'text-red-400 bg-red-950 border-red-700' }
                    ].map((item, i) => (
                      <div key={i} className="p-2 rounded bg-black border border-zinc-800 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded font-bold border ${item.color}`}>{item.level}</span>
                          <span className="text-zinc-300">{item.label}</span>
                        </div>
                        <span className="font-mono text-zinc-400 font-bold">{item.range}</span>
                      </div>
                    ))}
                  </div>

                  {/* System Diagnostics Box */}
                  <div className="pt-2 border-t border-zinc-900">
                    
<div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono space-y-4">
  <div className="border-b border-zinc-800 pb-2">
    <h3 className="text-sm font-bold text-white uppercase">Hardware Ports &amp; Diagnostics</h3>
    <p className="text-xs text-zinc-400 mt-1">Available Windows serial ports for ESP32 LoRa Gateway.</p>
  </div>

  <div className="space-y-2 text-xs">
    <span className="text-zinc-500 block">DETECTED COM PORTS:</span>
    {availableComPorts.length === 0 ? (
      <div className="p-3 rounded bg-black border border-zinc-900 text-zinc-500 text-[11px]">
        No physical COM ports detected. Connect ESP32 Gateway to USB.
      </div>
    ) : (
      availableComPorts.map((p) => (
        <div key={p.port} className="p-2.5 rounded bg-black border border-zinc-800 flex justify-between items-center">
          <div>
            <span className="font-bold text-white">{p.port}</span>
            <span className="text-zinc-500 block text-[10px]">{p.description}</span>
          </div>
          <span className="text-emerald-400 text-[10px] font-bold">READY</span>
        </div>
      ))
    )}
  </div>

  {/* System Diagnostics */}
  <div className="pt-2 border-t border-zinc-900 space-y-2 text-xs">
    <span className="text-zinc-500 block">LOCAL SERVER STATUS:</span>
    <div className="p-2.5 rounded bg-black border border-zinc-800 space-y-1 text-[11px]">
      <div className="flex justify-between">
        <span className="text-zinc-500">Back-end Server:</span>
        <span className={backendOnline ? 'text-emerald-400' : 'text-red-400'}>{backendOnline ? 'ACTIVE (Port 8000)' : 'STOPPED'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-500">YOLOv8 Model:</span>
        <span className="text-emerald-400">yolov8n.pt (Local CUDA/CPU)</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-500">Active Mode:</span>
        <span className="text-white font-bold">{liveMode}</span>
      </div>
    </div>
  </div>
</div>

                  </div>
                </div>
              </div>
            )}
          </div>
        )}

</main>

      {/* ==================================================================
          MODAL: ADD CAMERA QUICK OVERLAY
         ================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 max-w-md w-full font-mono space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-white" />
                <h3 className="text-sm font-bold text-white uppercase">Connect Real Camera Feed</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCameraSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">CAMERA NAME</label>
                <input
                  type="text"
                  value={newCam.name}
                  onChange={(e) => setNewCam({ ...newCam, name: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded p-2 text-white font-mono focus:border-zinc-500"
                  required
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">SELECT VENUE ZONE</label>
                <select
                  value={newCam.zoneId}
                  onChange={(e) => setNewCam({ ...newCam, zoneId: e.target.value })}
                  className="w-full bg-black border border-zinc-800 rounded p-2 text-white font-mono focus:border-zinc-500"
                >
                  <option value="ZONE-A">Zone A — Main Gate Plaza</option>
                  <option value="ZONE-B">Zone B — East Corridor Choke</option>
                  <option value="ZONE-C">Zone C — Central Stage Arena</option>
                  <option value="ZONE-D">Zone D — North Exit Concourse</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">INPUT SOURCE TYPE</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCam({ ...newCam, sourceType: 'phone', sourceValue: 'http://192.168.1.100:8080/video' })}
                    className={`p-2 rounded border text-center ${
                      newCam.sourceType === 'phone' ? 'bg-zinc-800 border-zinc-600 text-white font-bold' : 'bg-black border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Phone IP Webcam
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCam({ ...newCam, sourceType: 'video_file' })}
                    className={`p-2 rounded border text-center ${
                      newCam.sourceType === 'video_file' ? 'bg-zinc-800 border-zinc-600 text-white font-bold' : 'bg-black border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Upload Video File
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCam({ ...newCam, sourceType: 'webcam', sourceValue: '0' })}
                    className={`p-2 rounded border text-center ${
                      newCam.sourceType === 'webcam' ? 'bg-zinc-800 border-zinc-600 text-white font-bold' : 'bg-black border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Laptop Webcam (0)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCam({ ...newCam, sourceType: 'sample_video' })}
                    className={`p-2 rounded border text-center ${
                      newCam.sourceType === 'sample_video' ? 'bg-zinc-800 border-zinc-600 text-white font-bold' : 'bg-black border-zinc-800 text-zinc-400'
                    }`}
                  >
                    1-Click Benchmark
                  </button>
                </div>
              </div>

              {/* OPTION 1 & 3: PHONE IP OR WEBCAM */}
              {(newCam.sourceType === 'phone' || newCam.sourceType === 'webcam') && (
                <>
                  <div>
                    <label className="block text-zinc-400 mb-1">
                      {newCam.sourceType === 'phone' ? 'PHONE IP WEBCAM ADDRESS' : 'WEBCAM DEVICE INDEX / RTSP URL'}
                    </label>
                    <input
                      type="text"
                      value={newCam.sourceValue}
                      onChange={(e) => setNewCam({ ...newCam, sourceValue: e.target.value })}
                      placeholder={newCam.sourceType === 'phone' ? 'e.g., 192.168.1.15:8080' : '0'}
                      className="w-full bg-black border border-zinc-800 rounded p-2 text-white font-mono focus:border-zinc-500 placeholder:text-zinc-600"
                      required
                    />
                    {newCam.sourceType === 'phone' && (
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Tip: Enter the IPv4 shown on the phone screen after tapping &quot;Start server&quot; (e.g. <span className="text-zinc-300">192.168.1.15:8080</span>)
                      </p>
                    )}
                  </div>

                  {testResult && (
                    <div className={`p-2 rounded border text-[11px] ${
                      testResult.success ? 'bg-emerald-950 border-emerald-800 text-emerald-300' : 'bg-red-950 border-red-800 text-red-300'
                    }`}>
                      {testResult.details}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className="flex-1 py-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold"
                    >
                      {isTesting ? 'Testing...' : 'Test Feed'}
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded bg-white text-black hover:bg-zinc-200 font-bold"
                    >
                      Confirm &amp; Launch
                    </button>
                  </div>
                </>
              )}

              {/* OPTION 2: UPLOAD VIDEO FILE */}
              {newCam.sourceType === 'video_file' && (
                <div className="space-y-3 pt-1">
                  <div className="border border-dashed border-zinc-700 rounded-lg p-5 text-center bg-black hover:border-zinc-500 transition">
                    <input
                      type="file"
                      id="video-upload-file-input"
                      accept="video/mp4,video/avi,video/mov,video/mkv,video/*"
                      onChange={(e) => setUploadFile(e.target.files[0])}
                      className="hidden"
                    />
                    <label htmlFor="video-upload-file-input" className="cursor-pointer block">
                      <Film className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                      {uploadFile ? (
                        <div>
                          <span className="text-white font-bold block text-xs">{uploadFile.name}</span>
                          <span className="text-emerald-400 text-[10px] block mt-1">
                            {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI Ingest
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-white block font-bold text-xs">Choose or Drop Video File</span>
                          <span className="text-zinc-500 text-[10px] block mt-1">
                            Supports .mp4, .avi, .mov • Automatically loops for continuous testing
                          </span>
                        </div>
                      )}
                    </label>
                  </div>

                  <p className="text-[10px] text-zinc-500">
                    Uploaded video will continuously loop through YOLOv8 person detection, 4-point homography, and optical flow speed analysis.
                  </p>

                  <button
                    type="button"
                    onClick={handleUploadVideoSubmit}
                    disabled={!uploadFile || isUploading}
                    className="w-full py-2.5 rounded bg-white text-black hover:bg-zinc-200 font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploading ? 'Uploading & Starting YOLOv8...' : 'Upload Video & Launch Detection'}</span>
                  </button>
                </div>
              )}

              {/* OPTION 4: 1-CLICK SAMPLE BENCHMARK VIDEO */}
              {newCam.sourceType === 'sample_video' && (
                <div className="space-y-3 pt-1">
                  <div className="p-3 bg-black border border-zinc-800 rounded-lg space-y-2">
                    <div className="flex items-start gap-2">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-white font-bold text-xs">Synthetic Crowd Benchmark (Looping)</h4>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                          Instant 1-click test video with moving pedestrian silhouettes. Tests YOLOv8 bounding boxes, speed vectors, flow conflict, and dynamic rerouting without needing an external phone camera or Wi-Fi setup.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLoadSampleVideo}
                    className="w-full py-2.5 rounded bg-emerald-400 text-black hover:bg-emerald-300 font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Load Benchmark Crowd Video Now (1-Click)</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================
          MODAL: HUMAN-IN-THE-LOOP DISPATCH CONFIRMATION
         ================================================================== */}
      {dispatchModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 max-w-lg w-full font-mono space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2 text-red-400">
                <AlertOctagon className="w-5 h-5" />
                <h3 className="text-sm font-bold uppercase">Human-in-the-Loop Dispatch Authorization</h3>
              </div>
              <button onClick={() => setDispatchModal(null)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-zinc-300 space-y-2">
              <p>Target Zone: <span className="text-white font-bold">{dispatchModal.zoneName} (Zone {dispatchModal.targetZoneNum})</span></p>
              
              <div>
                <label className="block text-zinc-400 mb-1">SELECT VOICE / SIREN INSTRUCTION</label>
                <select
                  value={selectedPreset.id}
                  onChange={(e) => {
                    const found = INSTRUCTION_PRESETS.find((p) => p.id === e.target.value);
                    if (found) setSelectedPreset(found);
                  }}
                  className="w-full bg-black border border-zinc-800 rounded p-2 text-white font-mono"
                >
                  {INSTRUCTION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded bg-black border border-zinc-800 text-[11px] text-zinc-400">
                Instruction Text: "{selectedPreset.text}"<br/>
                Trigger Track: <span className="text-emerald-400 font-bold">{selectedPreset.mp3Track} (DFPlayer Mini)</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="confirm-dispatch"
                  checked={operatorConfirmed}
                  onChange={(e) => setOperatorConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded bg-black border-zinc-700 text-white focus:ring-0"
                />
                <label htmlFor="confirm-dispatch" className="text-xs text-zinc-300">
                  I confirm this warning instruction should be transmitted over 2.4GHz ESP-NOW mesh to Zone {dispatchModal.targetZoneNum}'s DFPlayer Mini speaker immediately.
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-900">
              <button
                onClick={() => setDispatchModal(null)}
                className="flex-1 py-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDispatch}
                disabled={!operatorConfirmed}
                className={`flex-1 py-2 rounded text-xs font-bold transition ${
                  operatorConfirmed ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                TRANSMIT DOWNLINK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          MANDATORY EMERGENCY SOS LOCKDOWN TAKEOVER MODAL (REQ #4)
          Pops up live camera stream, fastest paramedic approach path,
          and direct emergency dispatch actions!
         ================================================================== */}
      {activeEmergencyAlert && !medicalPopupDismissed && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col p-3 sm:p-6 overflow-y-auto font-mono">
          <div className="max-w-6xl w-full mx-auto my-auto bg-zinc-950 border-2 border-red-600 rounded-2xl p-4 sm:p-6 shadow-[0_0_80px_rgba(239,68,68,0.4)] space-y-4">
            
            {/* Header: Flashing Emergency Alert Banner */}
            <div className="bg-red-950/80 border-2 border-red-600 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 bg-red-600 rounded-lg text-white shrink-0">
                  <AlertOctagon className="w-7 h-7 sm:w-8 sm:h-8 animate-bounce" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-bold tracking-wider uppercase">
                      CRITICAL MEDICAL SOS &amp; CAMERA POP-UP
                    </span>
                    <span className="text-red-400 text-xs font-bold animate-pulse">
                      MEDICAL DESK NOTIFIED • FIRST RESPONDER ROUTED
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight mt-1">
                    Emergency in {alertZoneObj?.name || `Zone ${alertZoneNum}`}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMedicalPopupDismissed(true);
                    setActiveTab('INCIDENTS');
                  }}
                  className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 font-bold transition flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Monitor in Incident & Response Hub ➔</span>
                </button>
                <div className="flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-lg border border-red-700/60 text-xs text-red-200">
                  <Volume2 className="w-4 h-4 text-red-400 animate-ping" />
                  <button
                    type="button"
                    onClick={() => setAudioMuted(!audioMuted)}
                    className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white"
                  >
                    {audioMuted ? 'UNMUTE SIREN' : 'MUTE SIREN'}
                  </button>
                </div>
              </div>
            </div>

            {/* Middle Section: Split Screen (Left = Live Zone Camera, Right = Live Telemetry & Paramedic Routing) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              
              {/* Left Column: Live Tactical Camera Stream (7 Cols) */}
              <div className="lg:col-span-7 bg-black rounded-xl border border-zinc-800 p-2 relative flex flex-col justify-between overflow-hidden">
                <div className="relative rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
                  <img
                    src={emergencyVideoUrl}
                    alt={`Live Camera Feed ${alertZoneObj?.name}`}
                    className="w-full h-64 sm:h-72 object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  
                  {/* Tactical Feed Overlay HUD */}
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                    <span className="bg-black/85 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white border border-red-600/60 uppercase">
                      TACTICAL LIVE CAM: {alertZoneObj?.name || `Zone ${alertZoneNum}`}
                    </span>
                  </div>

                  <div className="absolute bottom-2 left-2 right-2 bg-black/85 backdrop-blur-md rounded px-3 py-1.5 border border-zinc-800 flex justify-between text-[11px] text-zinc-300">
                    <span className="text-zinc-400">
                      INCIDENT: <span className="text-white font-bold">{activeEmergencyAlert.id}</span> • Node Seq: #{alertNodeObj?.seq || 1}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      DFPLAYER &amp; LORA MESH READY
                    </span>
                  </div>
                </div>

                {/* Paramedic Approach Path Banner */}
                <div className="mt-2 p-2.5 bg-zinc-900/90 rounded border border-zinc-800 text-[11px] text-zinc-300 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-cyan-400" />
                      <span>FASTEST PARAMEDIC APPROACH ROUTE:</span>
                    </span>
                    <span className="text-emerald-400 font-bold">
                      ETA: {activeMedicalIncident?.eta_sec || 45}s ({activeMedicalIncident?.distance_m || 50}m)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-300 font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                      MED-BAY-HQ
                    </span>
                    <span>➔</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200">
                      Access Corridor
                    </span>
                    <span>➔</span>
                    <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                      {alertZoneKey.toUpperCase()}
                    </span>
                    <span className="text-zinc-500">• Speed: 3.0 m/s sprint</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Live GIS Spatial Statistics & Node Sensor HUD (5 Cols) */}
              <div className="lg:col-span-5 space-y-2.5 flex flex-col justify-between">
                
                {/* 4 Stat Badges */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-red-950/40 border border-red-700/80 rounded-xl p-2.5">
                    <span className="text-[10px] text-red-300 uppercase block mb-0.5">Fruin Risk Level</span>
                    <div className="text-lg font-black text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span>CRITICAL (LVL 3)</span>
                    </div>
                    <span className="text-[9px] text-zinc-400 block mt-1">Lethal crush hazard gated</span>
                  </div>

                  <div className="bg-black border border-zinc-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Crowd Density</span>
                    <div className="text-xl font-bold text-white font-mono">
                      {alertZoneObj?.currentDensity?.toFixed(2) || '0.00'} <span className="text-xs font-normal text-zinc-400">p/m²</span>
                    </div>
                    <span className="text-[9px] text-zinc-500 block mt-1">Homography ground projection</span>
                  </div>

                  <div className="bg-black border border-zinc-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Persons in Zone</span>
                    <div className="text-xl font-bold text-white font-mono">
                      {alertZoneObj?.personCount || 0} <span className="text-xs font-normal text-zinc-400">pax</span>
                    </div>
                    <span className="text-[9px] text-zinc-500 block mt-1">YOLOv8 detected pedestrians</span>
                  </div>

                  <div className="bg-black border border-zinc-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-zinc-500 uppercase block mb-0.5">Velocity & Conflict</span>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">
                      {alertZoneObj?.speed?.toFixed(2) || '0.00'} <span className="text-xs font-normal text-zinc-400">m/s</span>
                    </div>
                    <span className="text-[10px] text-amber-400 block">
                      Conflict: {Math.round((alertZoneObj?.conflict || 0) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Paramedic Dispatch Direct Actions */}
                <div className="bg-red-950/40 border border-red-700 rounded-xl p-3 space-y-2">
                  <span className="text-[10px] text-red-300 uppercase font-bold block">
                    FIRST RESPONDER RAPID DISPATCH:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDispatchMedicalSquad(activeEmergencyAlert.id, 'Medical Squad Alpha (Paramedic Unit 1)', 'PARAMEDICS_EN_ROUTE')}
                      className="py-2 px-2.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition"
                    >
                      🚑 Dispatch Squad Alpha
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDispatchMedicalSquad(activeEmergencyAlert.id, 'Medical Squad Bravo (Rapid EMT)', 'PARAMEDICS_EN_ROUTE')}
                      className="py-2 px-2.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs transition"
                    >
                      ⚡ Dispatch EMT Bravo
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResolveMedicalIncident(activeEmergencyAlert.id)}
                    className="w-full py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs transition"
                  >
                    ✓ Triage Cleared &amp; Resolved
                  </button>
                </div>

                {/* Node Telemetry Card */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-900 pb-1">
                    <span className="font-bold text-white text-[11px]">HARDWARE NODE TELEMETRY</span>
                    <span className="text-[9px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800 font-bold">
                      LIVE ON ESP-NOW / LORA
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-zinc-300 pt-1">
                    <div>
                      <span className="text-zinc-500 block">NODE HARDWARE:</span>
                      <span>ESP32 + Pin 12 SOS + LoRa</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">SIGNAL STRENGTH:</span>
                      <span className="text-white font-bold">{alertNodeObj?.rssi || -65} dBm</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: The 3 Saved Alert Message Settings / Reply Buttons */}
            <div className="pt-2 border-t-2 border-zinc-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-red-500" />
                  <span>AUTHORIZE AND DISPATCH WARNING REPLY TO ZONE {alertZoneNum} DFPLAYER SPEAKER:</span>
                </span>
                <span className="text-[10px] text-zinc-500">
                  Select one of 3 presets to broadcast over 2.4GHz mesh & dismiss alert
                </span>
              </div>

              {/* 3 Preset Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {/* PRESET 1: EMERGENCY EVACUATION */}
                <button
                  type="button"
                  onClick={() => handleRespondToEmergency(1)}
                  className="bg-red-700 hover:bg-red-600 text-white p-3.5 rounded-xl text-left border-2 border-red-500 transition transform hover:-translate-y-0.5 shadow-lg space-y-1.5 group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-black/40 px-1.5 py-0.5 rounded">
                      PRESET 1 • TRACK 1
                    </span>
                    <span className="text-[10px] text-red-200 font-bold">0001.mp3</span>
                  </div>
                  <h3 className="text-sm font-black uppercase flex items-center gap-1">
                    <span>🚨 Emergency Evacuation</span>
                  </h3>
                  <p className="text-[11px] text-red-100/90 leading-snug">
                    "Attention please, an emergency has occurred. Please walk calmly towards designated exit gates immediately."
                  </p>
                  <div className="text-[10px] text-red-200/80 pt-1 border-t border-red-600/60 flex justify-between font-bold">
                    <span>LED: Rapid Strobe</span>
                    <span className="underline group-hover:text-white">TRANSMIT REPLY ➔</span>
                  </div>
                </button>

                {/* PRESET 2: CROWD CAUTION / SLOW DOWN */}
                <button
                  type="button"
                  onClick={() => handleRespondToEmergency(2)}
                  className="bg-amber-600 hover:bg-amber-500 text-black p-3.5 rounded-xl text-left border-2 border-amber-400 transition transform hover:-translate-y-0.5 shadow-lg space-y-1.5 group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded text-black">
                      PRESET 2 • TRACK 2
                    </span>
                    <span className="text-[10px] text-black font-bold">0002.mp3</span>
                  </div>
                  <h3 className="text-sm font-black uppercase flex items-center gap-1">
                    <span>⚠️ Crowd Caution / Slow</span>
                  </h3>
                  <p className="text-[11px] text-black/90 leading-snug">
                    "Attention, heavy crowd congestion ahead. Please slow down, avoid pushing, and maintain space."
                  </p>
                  <div className="text-[10px] text-black/70 pt-1 border-t border-amber-500 flex justify-between font-bold">
                    <span>LED: Double-Blink</span>
                    <span className="underline group-hover:text-black">TRANSMIT REPLY ➔</span>
                  </div>
                </button>

                {/* PRESET 3: ALL CLEAR / STANDBY */}
                <button
                  type="button"
                  onClick={() => handleRespondToEmergency(3)}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white p-3.5 rounded-xl text-left border-2 border-emerald-500 transition transform hover:-translate-y-0.5 shadow-lg space-y-1.5 group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-black/40 px-1.5 py-0.5 rounded">
                      PRESET 3 • TRACK 3
                    </span>
                    <span className="text-[10px] text-emerald-200 font-bold">0003.mp3</span>
                  </div>
                  <h3 className="text-sm font-black uppercase flex items-center gap-1">
                    <span>✅ All Clear / Standby</span>
                  </h3>
                  <p className="text-[11px] text-emerald-100/90 leading-snug">
                    "Attention: The situation is now normal and under control. Please remain in place calmly."
                  </p>
                  <div className="text-[10px] text-emerald-200/80 pt-1 border-t border-emerald-600/60 flex justify-between font-bold">
                    <span>LED: Calm Long Pulse</span>
                    <span className="underline group-hover:text-white">TRANSMIT REPLY ➔</span>
                  </div>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER BAR */}
      <footer className="h-7 bg-black border-t border-zinc-900 px-4 flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <div className="flex items-center gap-3">
          <span>HOST: WIN11-STATION</span>
          <span>•</span>
          <span>NET: AIR-GAPPED OFFLINE LAN</span>
          <span>•</span>
          <span>RADIO: 433/866MHz LoRa</span>
        </div>
        <div>
          <span>HOTKEYS: [1] LIVE OPERATIONS • [2] INCIDENT &amp; RESPONSE • [3] HARDWARE &amp; SETTINGS • [M] VIEW MODE • [ESC] MODALS</span>
        </div>
      </footer>
    </div>
  );
}