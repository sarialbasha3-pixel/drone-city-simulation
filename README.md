# 🚁 Project Ghost — Autonomous Drone City Simulation & GRU V3 Learned Navigation

A high-performance, realistic 3D autonomous drone simulation built with **HTML5, JavaScript, Three.js, and WebGL**, integrated with a **15-state Error-State Kalman Filter (ESKF)** and a frozen **GRU V3 Recurrent Neural Network** for real-time motion-drift residual correction.

---

## 🌟 Key Features

### 🏙️ 1. Large-Scale 1.5 km × 1.5 km Continuous 3D City
- **5 Distinct Urban Districts**:
  - **Downtown Skyline**: Supertall glass towers (up to 160m), stepped skyscrapers, helipads, and urban canyons.
  - **Commercial District**: Mid-rise office complexes, retail storefronts, and parking plazas.
  - **Residential Neighborhood**: Townhouses, courtyard apartments, tree-lined streets, and residential vegetation.
  - **Industrial Logistics Port**: Warehouses, manufacturing facilities with smokestacks, chemical storage tanks, and shipping container yards.
  - **Western Bluffs & River Bay**: Continuous undulating terrain, natural elevation contours, and a 320m suspension bridge spanning the water channel.
- **Dynamic Chunk Streaming & LOD Coordinator**: 6×6 chunk grid (36 sectors) ensuring smooth 60+ FPS rendering across a massive territory.
- **PBR Atmospheric Rendering**: Rayleigh/Mie atmospheric sky dome, dynamic sun shadows with PCF soft filtering, and exponential distance haze.

### 🎮 2. Dual Flight Control: Manual 6-DOF & Tactical Autopilot
- **Realistic Quadcopter Dynamics**: Aerodynamic drag, dynamic pitch/roll banking into turns, vertical climb/descent, and spinning rotor animation.
- **Tactical Ground Control Station (GCS) Planner (`M` key)**:
  - Interactive top-down tactical minimap displaying river boundaries, bridge coordinates, district zones, and real-time pulsing drone position marker.
  - Mouse stroke path drawing mapped into continuous 3D world coordinates.
  - Glowing 3D flight corridor corridor with neon start and finish beacons.
- **Smooth Deceleration & Hover**: Automatically cruises along planned waypoints and transitions into a stable hover at the destination.

### 🧠 3. Project Ghost GRU V3 Learned Navigation Integration
- **Decoupled Physics & Estimator (100 Hz)**: Fixed-step physics accumulator independent of rendering FPS.
- **15-State Error-State Kalman Filter (ESKF)**:
  - State: `[δp(3), δv(3), δθ(3), δba(3), δbg(3)]`
  - Nominal state integration + continuous covariance propagation $P = F P F^T + Q$.
- **Exact 24-Feature Order**:
  1. `feat_gx_rad_s`, `feat_gy_rad_s`, `feat_gz_rad_s` (IMU Gyro)
  2. `feat_ax_m_s2`, `feat_ay_m_s2`, `feat_az_m_s2` (IMU Accel Specific Force)
  3. `feat_eskf_vx_m_s`, `feat_eskf_vy_m_s`, `feat_eskf_vz_m_s` (Nominal Velocity)
  4. `feat_rot6d_r11` ... `feat_rot6d_r32` (Orthonormalized 6D Body-to-World Rotation)
  5. `feat_sigma_px_m` ... `feat_sigma_pz_m` (Position Covariance Sigmas)
  6. `feat_sigma_vx_m_s` ... `feat_sigma_vz_m_s` (Velocity Covariance Sigmas)
  7. `feat_sigma_theta_x_rad` ... `feat_sigma_theta_z_rad` (Attitude Sigmas)
- **FastAPI / PyTorch Inference Bridge**:
  - Resamples sliding 1-second buffer to 101 samples at 100 Hz.
  - Calls local PyTorch GRU V3 model every 3.0s in demonstration mode.
  - Temporal jump gate (4.59 m/s threshold) + Normalized Innovation Squared (NIS) gate ($< 11.345$).
  - Joseph-form covariance measurement update: $v_{pseudo} = v_{ESKF} + \delta v_{predicted}$.

---

## 🕹️ Controls Guide

| Key | Action | Description |
|---|---|---|
| **`M`** / Click HUD Button | **Open Route Planner** | Displays tactical GCS map to draw flight paths |
| **`S`** | **Start Autopilot** | Aligns drone & camera at start gate and launches autonomous route flight |
| **`W` / `S`** | **Pitch Forward / Backward** | Manual flight pitch control |
| **`A` / `D`** | **Roll Left / Right** | Manual flight roll / strafe control |
| **`Q` / `E`** | **Yaw Left / Right** | Rotate drone heading |
| **`Space` / `Shift`** | **Ascend / Descend** | Vertical altitude control |
| **`V`** | **Cycle Camera** | Toggle Third-Person Chase, Cockpit FPV, Overhead |
| **`1` / `2` / `3`** | **Speed Presets** | Survey (18 km/h), Cruise (36 km/h), Turbo (60 km/h) |
| **`C`** | **Cycle Gimbal Pitch** | Level Horizon, 45° Down, 90° Nadir Straight Down |
| **`Enter`** | **Confirm Route** | In route planner: confirm drawn route |
| **`Escape`** | **Close Planner** | Close the tactical route panel |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ (tested on v22)
- **Python**: 3.10+ (tested on 3.11)

### 2. Start the Simulation Frontend
```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 3. Start the Python GRU V3 Bridge
In a separate terminal:
```bash
cd "GRU MODEL"

# Activate virtual environment
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

# Install requirements (torch, fastapi, uvicorn, numpy)
pip install -r requirements.txt

# Launch FastAPI inference service
uvicorn server_fastapi:app --host 127.0.0.1 --port 8765
```

The frontend will automatically connect to `http://127.0.0.1:8765/health` and display **`GRU: READY`** on the top-right HUD.

---

## 📐 Architecture Overview

```text
┌──────────────────────────────────────────────────────────┐
│             Three.js WebGL Simulation (Browser)          │
│                                                          │
│  ┌────────────────────┐       ┌───────────────────────┐  │
│  │  Route Controller  │       │  Flight Controller    │  │
│  │  (GCS Path Planner)│       │  (6-DOF Drone Physics)│  │
│  └─────────┬──────────┘       └───────────┬───────────┘  │
│            │                              │              │
│            ▼                              ▼              │
│  ┌────────────────────────────────────────────────────┐  │
│  │           100 Hz Fixed Physics Accumulator         │  │
│  │  - Synthesized Specific Force + Gyro Rates         │  │
│  │  - Analytical Terrain Altitude Clamping            │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           │                              │
│                           ▼                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │           15-State Error-State Kalman Filter       │  │
│  │  - Propagation: p, v, q, ba, bg                    │  │
│  │  - Covariance: P = F P F^T + Q                     │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           │                              │
│                           ▼                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │           Rolling 1s / 101-step Feature Buffer     │  │
│  │  - 24 Raw Kinematic & Covariance Features          │  │
│  └────────────────────────┬───────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │
               HTTP POST /infer (every 3.0s)
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│               Local Python FastAPI Service               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  PROJECT_GHOST_GRU_V3_BEST_VALIDATION.pt           │  │
│  │  - 2-Layer GRU (128 hidden, LayerNorm, Linear Head)│  │
│  │  - Input / Target Normalization from train set     │  │
│  └────────────────────────┬───────────────────────────┘  │
│                           │                              │
│                           ▼                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Predicted Velocity Residual: δv = [dvx, dvy, dvz] │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────┘
                            │
              Response: delta_v_m_s & pseudo_v
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│               ESKF Velocity Measurement Update           │
│  - NIS Safety Gate check (threshold = 11.345)            │
│  - Temporal Jump Gate check (< 4.59 m/s)                 │
│  - Joseph-form Covariance Update                         │
│  - Corrected state influences path-tracking steering     │
└──────────────────────────────────────────────────────────┘
```

---

## 📜 License
Academic graduation project simulation bundle.
All rights reserved.
