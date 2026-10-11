"""
section_3_1_to_3_3.py
Constructs Chapter Title and Sections 3.1, 3.2, 3.3.
"""

from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from build_full_chapter3 import (
    FONT_EN, BLACK, SZ_CHAP, SZ_H2, SZ_H3, SZ_BODY, SZ_TABLE, SZ_CAPTION,
    add_heading_2, add_heading_3, add_body, add_bullet, add_caption, format_table
)

def add_chapter_header(doc):
    p_num = doc.add_paragraph()
    p_num.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_num.paragraph_format.space_before = Cm(2.5)
    p_num.paragraph_format.space_after = Pt(4)
    p_num.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    r_num = p_num.add_run("Chapter Three")
    r_num.bold = True
    r_num.font.name = FONT_EN
    r_num.font.size = SZ_CHAP
    r_num.font.color.rgb = BLACK

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(4)
    p_title.paragraph_format.space_after = Cm(2.0)
    p_title.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    r_title = p_title.add_run("System Methodology and Architecture")
    r_title.bold = True
    r_title.font.name = FONT_EN
    r_title.font.size = SZ_CHAP
    r_title.font.color.rgb = BLACK

def build_section_3_1(doc):
    add_heading_2(doc, "3.1  Overall System Architecture")

    add_body(doc, (
        "The autonomous unmanned aerial vehicle (UAV) navigation system operates through a decoupled, "
        "multi-tiered microservice architecture designed to maintain deterministic 100 Hz state estimation "
        "and real-time 60 FPS three-dimensional visualization while asynchronously executing deep learning models "
        "for learned residual navigation and vision-based obstacle avoidance. In dense urban canyons, Global Navigation "
        "Satellite System (GNSS) signals suffer from severe multipath reflections, signal attenuation, and complete outages. "
        "Executing heavy deep learning tensor operations directly within the graphics rendering loop or numerical physics "
        "integrator introduces unacceptable thread blocking, non-deterministic latency spikes, and frame drops. "
        "To guarantee real-time flight stability while leveraging high-capacity neural network models, the system divides "
        "functional responsibilities into three dedicated microservices connected via high-speed loopback TCP/IP protocols:"
    ))

    add_bullet(doc, "Tier 1 — Real-Time WebGL/Three.js Simulation Client (Port 3000): ",
        "Hosts the procedural 3D urban environment, rigid-body 6-DoF quadrotor flight dynamics, synthetic sensor suite "
        "(IMU, GPS, barometric altimeter, 3-axis magnetometer, and forward-looking monocular camera), the dual 15-state "
        "Error-State Extended Kalman Filter (ESKF) pipelines, route controller, and the telemetry heads-up display (HUD).")

    add_bullet(doc, "Tier 2 — Project Ghost GRU v3 Navigation Inference Service (Port 8765): ",
        "An asynchronous Python/FastAPI microservice executing a 2-layer Gated Recurrent Unit (GRU) neural network. "
        "The service ingests normalized sliding temporal windows of 24 kinematic and geometric features over 101 time steps "
        "(1.0 second of history sampled at 100 Hz) and outputs three-dimensional velocity correction vectors (Δv = [Δvx, Δvy, Δvz]ᵀ) "
        "to compensate for unobserved inertial drift and dynamic aerodynamic disturbances.")

    add_bullet(doc, "Tier 3 — PULP-DroNet v3 Deep Vision Obstacle Avoidance Service (Port 8766): ",
        "An asynchronous Python/FastAPI microservice executing a lightweight residual convolutional neural network (CNN) "
        "tailored for micro-UAV edge deployment. The service ingests 200 × 200 pixel grayscale camera streams rendered from "
        "the UAV's front airframe and concurrently predicts a continuous lateral steering angle (α ∈ [−1.0, +1.0]) and a sigmoidal "
        "collision probability (P_coll ∈ [0.0, 1.0]) in under 12 milliseconds per frame.")

    add_body(doc, (
        "A foundational methodological principle of the system architecture is the strict decoupling between the Feature ESKF "
        "and the Aided ESKF. In naive closed-loop neural-aided inertial navigation systems, feeding the neural network's own corrected "
        "state back into its input feature buffer alters the input distribution, causing compound distribution shift and severe divergence. "
        "To preserve input distribution stability, the Feature ESKF operates purely in prediction mode using raw IMU integration, "
        "guaranteeing that the 24 input features fed to the GRU model precisely match the uncorrupted state distribution established "
        "during offline supervised training. Meanwhile, the Aided ESKF applies accepted pseudo-velocity innovations through statistical "
        "trust gates, generating the filtered state estimate required for closed-loop flight guidance and trajectory tracking."
    ))

    add_caption(doc, "Table 3.1: Microservice Specifications, Protocols, and Real-Time Interface Contracts")

    tbl = doc.add_table(rows=4, cols=5)
    headers = ["Service Name", "Port / Protocol", "Technology Stack", "Input → Output Payload", "Target Latency"]
    data = [
        ("Simulation Engine", "3000 (HTTP/WS)", "Three.js, Vite 6.0, WebGL2, JavaScript", "Sensor feeds → 3D Scene, Physics, ESKF", "60 FPS (≤ 16.6 ms)"),
        ("GRU Navigation AI", "8765 (REST/JSON)", "FastAPI, PyTorch 2.2+, NumPy", "[101 × 24] Features → Velocity Δv (vx, vy, vz)", "< 15 ms / call"),
        ("PULP-DroNet AI", "8766 (REST/Base64)", "FastAPI, PyTorch, Pillow", "200 × 200 Image → Steering α, Risk P_coll", "< 12 ms / frame"),
    ]
    for j, h in enumerate(headers):
        tbl.rows[0].cells[j].paragraphs[0].text = h
    for i, row in enumerate(data, 1):
        for j, val in enumerate(row):
            tbl.rows[i].cells[j].paragraphs[0].text = val
    format_table(tbl, [Cm(3.2), Cm(2.4), Cm(3.2), Cm(5.0), Cm(2.2)])

def build_section_3_2(doc):
    add_heading_2(doc, "3.2  Development Environment and Tools")

    add_body(doc, (
        "The software architecture, model training pipelines, and simulation environments are developed and executed "
        "using a unified modern development stack spanning numerical Python machine learning frameworks and high-performance "
        "browser-based graphics engines. The host system configuration and toolchains are structured as follows:"
    ))

    add_bullet(doc, "Machine Learning Runtime: ",
        "Python 3.11 with PyTorch 2.2.0 (leveraging CUDA 12.x GPU acceleration with CPU fallback capabilities). "
        "NumPy (>= 1.26.0) is utilized for tensor array manipulation, and Scikit-learn is utilized for Ledoit-Wolf "
        "shrinkage covariance estimation in statistical out-of-distribution detection.")

    add_bullet(doc, "Asynchronous API Framework: ",
        "FastAPI (>= 0.115.0) powered by the Uvicorn ASGI server (>= 0.30.0). Endpoints implement asynchronous non-blocking "
        "request handling with Cross-Origin Resource Sharing (CORS) middleware configured for zero-latency local communication.")

    add_bullet(doc, "Web Simulation Framework: ",
        "Node.js 18+ runtime with the Vite 6.0 build tool and Three.js (r170) 3D WebGL rendering engine. Three.js provides "
        "hardware-accelerated scene graphs, custom shader materials, matrix transformation batching, and instanced mesh rendering.")

    add_bullet(doc, "Computer Vision & Image Processing: ",
        "Pillow (PIL >= 10.0.0) for high-speed Base64 decoding, bilinear interpolation, grayscale luminance extraction, "
        "and floating-point pixel tensor normalization.")

    add_bullet(doc, "Automation & Orchestration: ",
        "Windows Batch scripting (`run_simulation.bat`) and PowerShell utilities provide one-click initialization of the multi-process "
        "architecture, dependency validation, virtual environment activation, and automated browser dispatch.")

    add_caption(doc, "Table 3.2: Development Toolchain, Libraries, and Runtime Dependencies")

    tbl = doc.add_table(rows=7, cols=4)
    headers = ["Software / Library", "Version", "Functional Domain", "Key Responsibility"]
    data = [
        ("Python Runtime", "3.11.x", "Core AI Engine", "Execution of PyTorch training, evaluation, and FastAPI services"),
        ("PyTorch", "2.2.0+", "Deep Learning", "GRU v3 recurrent inference and PULP-DroNet residual CNN modeling"),
        ("FastAPI / Uvicorn", "0.115.0 / 0.30.0", "Inference Microservices", "REST API bridge endpoints on Ports 8765 and 8766"),
        ("Node.js / Vite", "18.x / 6.0.x", "Frontend Build System", "Development server hosting WebGL simulation on Port 3000"),
        ("Three.js", "0.170.0", "3D Simulation Engine", "6-DoF quadrotor physics, procedural urban synthesis, PBR shaders"),
        ("Scikit-learn", "1.4.x", "Statistical Safety", "Ledoit-Wolf covariance modeling for 48D Mahalanobis OOD detection"),
    ]
    for j, h in enumerate(headers):
        tbl.rows[0].cells[j].paragraphs[0].text = h
    for i, row in enumerate(data, 1):
        for j, val in enumerate(row):
            tbl.rows[i].cells[j].paragraphs[0].text = val
    format_table(tbl, [Cm(3.2), Cm(2.2), Cm(3.6), Cm(7.0)])

def build_section_3_3(doc):
    add_heading_2(doc, "3.3  Dataset Preparation and Data Integration")

    add_body(doc, (
        "The empirical foundation of the learned navigation system is a curated real-data archive comprising 1,422,348 preserved "
        "feature rows gathered across 19 physical UAV flights from three distinct public and institutional research datasets: "
        "INSANE, LandingUAV, and PanoAir. Rather than training models on synthetic or uncalibrated flight simulations, this multi-source "
        "corpus encompasses diverse vehicle dynamics, flight corridors, environmental contexts, and sensor noise characteristics."
    ))

    add_heading_3(doc, "3.3.1  Composition of the Multi-Source Flight Corpus")

    add_body(doc, (
        "The 1,422,348 feature rows are distributed across three distinct dataset sources as detailed below:"
    ))

    add_bullet(doc, "1. INSANE Dataset (6 Flights, 218,204 Rows, 15.34% Share): ",
        "Contributes challenging Mars-analog desert terrain, cliff edges, canyons, indoor flight spaces, and outdoor-to-indoor "
        "transitions. Initial inspection revealed that raw curated inertial channels in the INSANE corpus contained synchronization "
        "and coordinate frame irregularities. Consequently, a dedicated PX4 native inertial rebuild was executed, reconstructing "
        "calibrated angular rate and specific force streams directly from raw PX4 autopilot ULog telemetry files.")

    add_bullet(doc, "2. LandingUAV Dataset (7 Flights, 237,413 Rows, 16.69% Share): ",
        "Contributes real-world maritime environments, port lock structures, boat houses, and Wicklow mountain flights recorded "
        "under adverse meteorological tags including rain, wind gusts, and calm coastal winds. These recordings expose the filter "
        "to severe aerodynamic turbulence, lateral gusts, and precipitation-induced platform perturbations.")

    add_bullet(doc, "3. PanoAir Dataset (6 Flights, 966,731 Rows, 67.96% Share): ",
        "Contributes extensive urban corridor flights spanning diverse illumination regimes including bright sunlight, heavy cloud cover, "
        "and night-time flight. Captured with high-rate native timestamps and accurate RTK-GPS / optical motion capture ground truth, "
        "PanoAir provides high-density trajectory data representing 67.96% of the retained training corpus.")

    add_heading_3(doc, "3.3.2  Flight-Disjoint Data Partitioning Protocol")

    add_body(doc, (
        "Temporal windows extracted from consecutive time steps of the same physical flight exhibit extreme autocorrelation. "
        "Randomly shuffling overlapping time windows between training and evaluation splits represents severe data leakage, "
        "yielding deceptively low training loss while failing completely in deployment. To prevent data leakage, the corpus implements "
        "a strict flight-disjoint partitioning protocol where entire physical flight identities are locked prior to window generation:"
    ))

    add_bullet(doc, "Training Partition (13 Flights, 923,976 Rows, 64.96%): ",
        "Comprises mars_11, mars_12, mars_14, outdoor_1 (INSANE); hamburgBoathouse_1, hamburgLock_2, wicklowTest_4, wicklowTest_7, "
        "wicklowTest_8 (LandingUAV); and seq1, seq5, seq6, seq17 (PanoAir). All z-score normalization scalers, target distributions, "
        "and statistical safety gate thresholds are fitted strictly on this partition.")

    add_bullet(doc, "Validation Partition (3 Flights, 240,977 Rows, 16.94%): ",
        "Comprises indoor_1 (INSANE), wicklowTest_5 (LandingUAV, rain/wind gusts), and seq10 (PanoAir, night). This partition is reserved "
        "for model architecture selection (LSTM vs. GRU), checkpoint epoch selection, and safety gate threshold calibration.")

    add_bullet(doc, "Held-Out Test Partition (3 Flights, 257,395 Rows, 18.10%): ",
        "Comprises transition_3 (INSANE, outdoor/indoor transition), hamburgLock_3 (LandingUAV, rain/maritime), and seq9 (PanoAir, sunny). "
        "This split remains completely isolated from model selection and parameter fitting to evaluate out-of-domain generalization.")

    add_caption(doc, "Table 3.3: Complete Flight-by-Flight Dataset Catalog and Partitioning Ledger")

    tbl_fl = doc.add_table(rows=20, cols=5)
    fl_hdrs = ["Flight No.", "Source", "Flight Identifier", "Environmental Tag", "Retained Rows"]
    fl_data = [
        ("01", "INSANE", "mars_11 (TRAIN)", "Mars analog desert", "29,980"),
        ("02", "INSANE", "mars_12 (TRAIN)", "Mars analog / cliff", "18,125"),
        ("03", "INSANE", "mars_14 (TRAIN)", "Mars analog / canyon", "34,522"),
        ("04", "INSANE", "outdoor_1 (TRAIN)", "Outdoor daylight", "38,755"),
        ("05", "LandingUAV", "hamburgBoathouse_1 (TRAIN)", "Rain / calm wind / maritime", "16,160"),
        ("06", "LandingUAV", "hamburgLock_2 (TRAIN)", "Rain / calm wind / maritime", "10,720"),
        ("07", "LandingUAV", "wicklowTest_4 (TRAIN)", "Light rain / wind gusts", "39,506"),
        ("08", "LandingUAV", "wicklowTest_7 (TRAIN)", "Light rain / wind gusts", "61,210"),
        ("09", "LandingUAV", "wicklowTest_8 (TRAIN)", "Light rain / wind gusts", "38,465"),
        ("10", "PanoAir", "seq1 (TRAIN)", "Cloudy daylight", "78,621"),
        ("11", "PanoAir", "seq17 (TRAIN)", "Night flight", "228,501"),
        ("12", "PanoAir", "seq5 (TRAIN)", "Cloudy daylight", "152,272"),
        ("13", "PanoAir", "seq6 (TRAIN)", "Sunny daylight", "177,139"),
        ("14", "INSANE", "indoor_1 (VAL)", "Indoor GNSS-denied", "61,323"),
        ("15", "LandingUAV", "wicklowTest_5 (VAL)", "Light rain / wind gusts", "58,236"),
        ("16", "PanoAir", "seq10 (VAL)", "Night flight", "121,418"),
        ("17", "INSANE", "transition_3 (TEST)", "Outdoor-to-indoor transition", "35,499"),
        ("18", "LandingUAV", "hamburgLock_3 (TEST)", "Rain / calm wind / maritime", "13,116"),
        ("19", "PanoAir", "seq9 (TEST)", "Sunny daylight", "208,780"),
    ]
    for j, h in enumerate(fl_hdrs):
        tbl_fl.rows[0].cells[j].paragraphs[0].text = h
    for i, row in enumerate(fl_data, 1):
        for j, val in enumerate(row):
            tbl_fl.rows[i].cells[j].paragraphs[0].text = val
    format_table(tbl_fl, [Cm(2.0), Cm(2.6), Cm(4.4), Cm(4.6), Cm(2.4)])

    add_heading_3(doc, "3.3.3  24-Dimensional Input Feature Vector and Target Definition")

    add_body(doc, (
        "At each discrete time step, the feature generation pipeline extracts 24 continuous physical variables combining raw inertial "
        "observations, kinematic ESKF predictions, continuous rotation representations, and formal estimator uncertainties. "
        "The exact feature ordering and mathematical definitions are established in Table 3.4:"
    ))

    add_caption(doc, "Table 3.4: Complete 24-Dimensional Feature Vector Ordering and Physical Channels")

    tbl_feat = doc.add_table(rows=8, cols=4)
    feat_hdrs = ["Indices", "Feature Category", "Channel Identifiers", "Physical Definition & Units"]
    feat_data = [
        ("0 – 2", "Raw Gyroscope", "feat_gx, feat_gy, feat_gz", "Body-frame angular velocities (rad/s)"),
        ("3 – 5", "Raw Accelerometer", "feat_ax, feat_ay, feat_az", "Body-frame specific forces including gravity (m/s²)"),
        ("6 – 8", "ESKF Velocity", "feat_eskf_vx, feat_eskf_vy, feat_eskf_vz", "Estimated velocity vector in world coordinate frame (m/s)"),
        ("9 – 14", "Rotation-6D Attitude", "feat_rot6d_r11, r21, r31, r12, r22, r32", "First two columns of rotation matrix R_WB on SO(3)"),
        ("15 – 17", "Position Covariance", "feat_sigma_px, feat_sigma_py, feat_sigma_pz", "1-sigma standard deviations of position error (m)"),
        ("18 – 20", "Velocity Covariance", "feat_sigma_vx, feat_sigma_vy, feat_sigma_vz", "1-sigma standard deviations of velocity error (m/s)"),
        ("21 – 23", "Attitude Covariance", "feat_sigma_thetax, thetay, thetaz", "1-sigma standard deviations of orientation error (rad)"),
    ]
    for j, h in enumerate(feat_hdrs):
        tbl_feat.rows[0].cells[j].paragraphs[0].text = h
    for i, row in enumerate(feat_data, 1):
        for j, val in enumerate(row):
            tbl_feat.rows[i].cells[j].paragraphs[0].text = val
    format_table(tbl_feat, [Cm(2.0), Cm(3.2), Cm(5.0), Cm(5.8)])

    add_body(doc, (
        "The three supervised training targets represent the instantaneous velocity residual between the reference ground-truth velocity "
        "and the prediction-only ESKF velocity at the window endpoint: Δv = [v_GT,x − v_ESKF,x, v_GT,y − v_ESKF,y, v_GT,z − v_ESKF,z]ᵀ. "
        "Ground truth coordinates and flight labels are strictly excluded from input channels to prevent data leakage."
    ))

    add_heading_3(doc, "3.3.4  Temporal Engineering, 100-Hz Grid Resampling, and Normalization")

    add_body(doc, (
        "Because native IMU logging rates vary across platforms (ranging from 50 Hz to 200 Hz), candidate context windows are resampled "
        "to a locked 100 Hz temporal grid. The final model utilizes a 1.0-second context window spanning exactly 101 discrete time steps "
        "with a 0.5-second stride. Windows are constrained strictly within continuous flight segments (`NEVER_CROSS_RNN_SEGMENT_ID`). "
        "To preserve attitude validity following linear interpolation across the 101 steps, the Rotation-6D components (features 9–14) "
        "are dynamically re-orthonormalized via Gram-Schmidt projection: the first column u₁ = c₁ / ||c₁|| is normalized, and the second "
        "column is orthogonalized as u₂ = (c₂ − (c₂ · u₁)u₁) / ||c₂ − (c₂ · u₁)u₁||."
    ))

    add_body(doc, (
        "Normalization statistics are fitted exclusively on the training partition to prevent test distribution leakage: "
        "each input feature is standardized as x_norm = (x − μ_train) / σ_train, and targets are standardized as y_norm = (y − μ_y,train) / σ_y,train. "
        "This locked pipeline produced 2,771 model-ready training windows, 868 validation windows, and 677 held-out test windows, "
        "establishing the standardized (101, 24) input tensor format."
    ))

print("section_3_1_to_3_3.py ready.")
