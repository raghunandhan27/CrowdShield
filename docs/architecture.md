# CrowdShield Technical Architecture & Mathematical Foundations

## 1. System Overview

CrowdShield is a decentralized, air-gapped crowd surge mitigation and egress routing platform designed for mega-gatherings where cellular infrastructure collapses. The platform decouples surveillance and emergency actuation from the internet using a 3-tier hybrid architecture:

```
[ CCTV / IP Cameras (RTSP) ]
              │
              ▼
[ Tier 1: Edge AI Vision Engine (YOLOv8 + 4-Pt Homography + Farnebäck Flow) ]
              │
              ▼
[ Tier 2: Spatial GIS & Rerouting Engine (FastAPI + Shapely + NetworkX Dijkstra) ]
              │
              ├── WebSocket (ws://localhost:8000/ws) ──► [ React 18 Command Center UI ]
              │
              ▼ PySerial (115200 Baud USB)
[ Tier 3: Master LoRa Mesh Gateway (ESP32 + Semtech SX1278 433MHz) ]
              │
              ▼ Sub-GHz Radio Broadcast (<100ms)
[ Zonal Field Nodes (ESP32 + 1602 LCD Displays + DFPlayer Mini Voice Synthesizers) ]
```

---

## 2. Mathematical Signatures & Formulations

### 2.1 4-Point Ground Perspective Homography Transform
Standard CCTV cameras film obliquely, causing distant crowds to appear compressed and nearby crowds to appear stretched. To compute true metric density ($\text{people/m}^2$), CrowdShield computes a $3 \times 3$ perspective transformation matrix $\mathbf{H}$:

$$\begin{bmatrix} x' \\ y' \\ 1 \end{bmatrix} \sim \mathbf{H} \begin{bmatrix} u \\ v \\ 1 \end{bmatrix} = \begin{bmatrix} h_{11} & h_{12} & h_{13} \\ h_{21} & h_{22} & h_{23} \\ h_{31} & h_{32} & h_{33} \end{bmatrix} \begin{bmatrix} u \\ v \\ 1 \end{bmatrix}$$

Given 4 calibrated ground control points in pixel coordinates $(u_i, v_i)$ mapped to metric venue coordinates $(x_i, y_i)$, $\mathbf{H}$ is solved using Singular Value Decomposition (SVD). Every detected head centroid is projected to metric plane $(X, Y)$, yielding ground-truth spatial density.

### 2.2 Directional Conflict Index (Vector Entropy)
To detect physical collisions, fights, or opposing crowd stampedes without facial recognition or body tracking, Farnebäck Optical Flow calculates dense movement vectors $\vec{v}_i = (v_{x,i}, v_{y,i})$ across all pixels in each zone:

$$\text{Conflict} = 1 - \frac{\left\Vert{} \frac{1}{N}\sum_{i=1}^{N} \vec{v}_i \right\Vert{}}{\frac{1}{N}\sum_{i=1}^{N} \Vert{}\vec{v}_i\Vert{} + \epsilon}$$

* In laminar flow (everyone moving toward Exit A): $\text{Conflict} \approx 0.0$.
* In turbulent collisions (opposing crowds or bottlenecks): $\text{Conflict} > 0.65 \implies \text{CRITICAL CONFLICT ALERT}$.

### 2.3 The Repulsion Ring & Vertical Drop Signature (Fall Detection)
When a victim falls in a dense crowd, standard bounding boxes cannot see the ground. CrowdShield identifies two simultaneous physical anomalies:
1. **Vertical Drop Spike:** A cluster of vectors shoots sharply downwards ($v_y \gg v_x$) as head/shoulders plunge below standing crowd level.
2. **Shockwave Repulsion Ring:** Surrounding pedestrians abruptly split left/right or recoil backward around a stationary $0\text{ m/s}$ ground point, creating a localized $\text{Conflict} > 0.75$ ring around the fallen person.

### 2.4 Fruin Level of Service (LoS) Classification
Venue zones are benchmarked against John J. Fruin's pedestrian safety standards:
* **LoS A:** $< 0.27\text{ p/m}^2$ (Free circulation)
* **LoS B:** $0.27\text{--}0.43\text{ p/m}^2$ (Normal walking)
* **LoS C:** $0.43\text{--}0.72\text{ p/m}^2$ (Restricted flow)
* **LoS D:** $0.72\text{--}1.08\text{ p/m}^2$ (Severe restriction, bypass initiated)
* **LoS E:** $1.08\text{--}2.17\text{ p/m}^2$ (Crush threshold risk, early warning active)
* **LoS F:** $\ge 2.17\text{ p/m}^2$ (Critical breakdown, mandatory automated egress lockout)

---

## 3. Dynamic GIS Graph Rerouting (NetworkX)

CrowdShield models venue corridors as a weighted directed graph $G = (V, E)$:
$$\text{Weight}(e) = \text{Length}(e) \times \left(1 + 4 \times \text{Risk}(e)\right)$$

When an operator or automatic AI trigger flags a hazard in Zone $Z_k$ (e.g., fire, collapsed barrier, extreme crush):
1. Travel impedance for all intersecting corridors is assigned $\infty$:
   $$\forall e \in E(Z_k), \quad \text{Weight}(e) = \infty$$
2. NetworkX runs Dijkstra's algorithm from all surrounding nodes to determine the shortest non-hazard path to open gates (Gate A, Gate B, Gate C).
3. The resulting exit assignments are formatted into pipe-delimited packets and pushed to LoRa mesh field nodes.

---

## 4. Dual-Radio Long-Range Mesh Hardware

### 4.1 Master Gateway ESP32
* **Transceiver:** Semtech SX1278 (433MHz ISM Band)
* **SPI Bus:** Custom locked to 1.0 MHz with hardware CS/RST lines to prevent bus ringing and brownouts.
* **Modulation:** LoRa Spreading Factor SF9, Bandwidth 125 kHz, Coding Rate 4/5, TX Power +10 dBm.
* **USB Interface:** 115200 Baud PySerial with non-blocking async dispatch.

### 4.2 Zonal Field Signboard Nodes
* **Microcontroller:** ESP32-WROOM-32 / ESP8266
* **Visual Display:** 1602 Character LCD via I2C (`0x27`) with auto-scroll directional prompt.
* **Audio Synthesizer:** DFPlayer Mini MP3 module over UART (9600 baud) driving a 3W 8Ω speaker with localized voice recordings.
* **Hardware Interrupt:** LoRa DIO0 pin attached to an ESP32 GPIO interrupt (`RISING`) for 0ms latency packet reception.
* **Redundancy:** Dual-engine receiver architecture pairing LoRa sub-GHz broadcast with connectionless 2.4GHz ESP-NOW mesh fallback.
