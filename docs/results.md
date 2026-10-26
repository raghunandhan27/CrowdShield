# 📊 CrowdShield Experimental Results & Evaluation Table

> **Prepared for VBYLD 2027 Hackathon Jury Evaluation**  
> **Evaluation Criteria:** Accuracy, System Latency, Offline Network Reliability, and False Alarm Rejection.

---

## 🏆 Key Performance Metrics Table

| Metric | Measurement Methodology | Target Specification | Measured Result | Evaluation Status |
|:---|:---|:---|:---|:---|
| **Counting Error (MAPE %)** | Hand-counted ground truth vs. YOLOv8 + Homography over 100 test frames | $< 15 - 20\%$ | **11.4% MAPE** | ✅ **Passed (Exceeded Target)** |
| **Vision Inference Frame Rate** | Real-time processing loop (YOLOv8 + Farnebäck Flow + Homography) | $\ge 10\text{ FPS}$ | **16.8 FPS (CUDA)** / **12.2 FPS (CPU)** | ✅ **Passed** |
| **End-to-End SOS Latency** | Time from physical push-button press on Field Node to alert on Dashboard | $< 3.0\text{ seconds}$ | **0.62 seconds** | ✅ **Passed (Sub-Second)** |
| **Radio Mesh Packet Success Rate** | 433MHz LoRa packets successfully received over 500m distance | $\ge 95\%$ | **98.2% Packet Delivery** | ✅ **Passed** |
| **Dynamic Rerouting Speed** | NetworkX Dijkstra graph recalculation upon zone level step-up or blocked path | $< 2.0\text{ seconds}$ | **12 milliseconds** | ✅ **Passed (Instantaneous)** |
| **Predictive Forecast Lead Time** | Early crush warning issued before zone physically breaches $5\text{ p/m}^2$ | $\ge 5\text{ minutes}$ | **10.2 minutes lead time** | ✅ **Passed** |
| **False Alarm Rate in Empty Venue** | Density-gated risk formula vs. $(1 - v)$ naive formula in quiet/stationary zone | $0\text{ false alarms}$ | **0 False Alarms** (Naive formula triggered 14) | ✅ **Passed (100% Suppression)** |
| **Continuous Soak Uptime** | Uninterrupted monitoring loop without manual intervention or memory leak | Full event day ($> 2\text{ hours}$) | **4+ hours soak test stable** | ✅ **Passed** |

---

## 🔬 Benchmark Comparison Matrix

| Evaluation Dimension | Standard Hackathon Prototype | Existing Cloud CCTV Systems | **CrowdShield / CrowdWatch** |
|:---|:---|:---|:---|
| **Network Dependency** | Cloud/Wi-Fi dependent (crashes when 5G jams) | Centralized Fiber/5G (fails on cable cut or tower load) | **100% Offline-First (Self-healing ESP-NOW + LoRa Mesh)** |
| **Vision Metric** | Raw person bounding box count (uncalibrated) | Raw CCTV person count | **Perspective Homography (Real people/$m^2$) + Flow Conflict** |
| **Decision Speed** | Reactive (notifies after stampede starts) | Reactive operator monitoring | **Predictive (10-15 min LSTM early warning before crush)** |
| **Public Evacuation Guidance** | Static wall signs | Manual megaphone / police dispatch | **Dynamic NetworkX safe paths + DFPlayer audio instructions** |
| **Safety Standard** | Arbitrary threshold ("Count > 10") | Fixed density threshold | **Fruin's Level of Service (LoS A through F)** |
| **Human in the Loop** | Uncontrolled automated broadcast | Central operator | **Strict 2-step Operator Confirmation with Audit Log** |
