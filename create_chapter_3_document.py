import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, color_hex):
    """Set background color of a table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    """Set padding/margins for a table cell in dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tcPr.append(tcMar)

def set_table_borders(table, color_hex="D3D3D3"):
    """Set subtle modern borders for a table."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="{color_hex}"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="{color_hex}"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="{color_hex}"/>
            <w:insideV w:val="none"/>
            <w:left w:val="none"/>
            <w:right w:val="none"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

def add_callout(doc, text, title="TECHNICAL SPECIFICATION"):
    """Adds a callout quote box with navy left border and light shading."""
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    cell.width = Inches(6.5)
    
    # Left border thick navy, other borders none
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:left w:val="single" w:sz="24" w:space="0" w:color="1B365D"/>
            <w:top w:val="none"/>
            <w:bottom w:val="none"/>
            <w:right w:val="none"/>
        </w:tcBorders>
    ''')
    tcPr.append(borders)
    set_cell_background(cell, "F7FAFC")
    set_cell_margins(cell, top=140, bottom=140, left=200, right=160)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    run_title = p.add_run(f"[{title}]\n")
    run_title.font.name = "Calibri"
    run_title.font.size = Pt(9.5)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(27, 54, 93)
    
    run_body = p.add_run(text)
    run_body.font.name = "Calibri"
    run_body.font.size = Pt(10)
    run_body.font.italic = True
    run_body.font.color.rgb = RGBColor(45, 55, 72)
    
    # Empty paragraph after table for spacing
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(6)

def format_table(table, header_bg="1B365D", alt_bg="F7FAFC", col_widths=None):
    """Formats table headers, row backgrounds, and alignments."""
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table, "CBD5E0")
    
    # Format header row
    hdr_cells = table.rows[0].cells
    for i, cell in enumerate(hdr_cells):
        set_cell_background(cell, header_bg)
        set_cell_margins(cell, top=140, bottom=140, left=140, right=140)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        if col_widths and i < len(col_widths):
            cell.width = Inches(col_widths[i])
        for p in cell.paragraphs:
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in p.runs:
                run.font.name = "Calibri"
                run.font.size = Pt(10)
                run.font.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                
    # Format data rows
    for r_idx, row in enumerate(table.rows[1:], start=1):
        bg = alt_bg if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, cell in enumerate(row.cells):
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            if col_widths and c_idx < len(col_widths):
                cell.width = Inches(col_widths[c_idx])
            for p in cell.paragraphs:
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                for run in p.runs:
                    run.font.name = "Calibri"
                    run.font.size = Pt(9.5)
                    run.font.color.rgb = RGBColor(45, 55, 72)

def build_document():
    doc = docx.Document()
    
    # Page Setup: Standard 1 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        
    # Color Palette Definitions
    COLOR_NAVY = RGBColor(27, 54, 93)      # #1B365D - Heading 1 & Brand
    COLOR_SLATE = RGBColor(44, 82, 130)    # #2C5282 - Heading 2
    COLOR_STEEL = RGBColor(49, 130, 206)   # #3182CE - Heading 3
    COLOR_BODY = RGBColor(45, 55, 72)      # #2D3748 - Main text
    COLOR_MUTED = RGBColor(113, 128, 150)  # #718096 - Captions / Subtitles
    
    # Configure Normal Style
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = COLOR_BODY
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(6)
    
    # =========================================================================
    # DOCUMENT COVER / TITLE HEADER
    # =========================================================================
    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run_meta = p_meta.add_run("GRADUATION PROJECT THESIS | ACADEMIC YEAR 2025-2026")
    run_meta.font.name = 'Calibri'
    run_meta.font.size = Pt(9)
    run_meta.font.bold = True
    run_meta.font.color.rgb = COLOR_MUTED
    p_meta.paragraph_format.space_after = Pt(18)
    
    p_proj = doc.add_paragraph()
    run_proj = p_proj.add_run("Autonomous 3D Urban UAV Navigation System\nUtilizing Error-State Extended Kalman Filtering, Recurrent Neural Networks, and Deep Vision Obstacle Avoidance")
    run_proj.font.name = 'Calibri'
    run_proj.font.size = Pt(16)
    run_proj.font.bold = True
    run_proj.font.color.rgb = COLOR_SLATE
    p_proj.paragraph_format.space_after = Pt(24)
    
    # CHAPTER 3 HEADING
    p_chap = doc.add_paragraph()
    p_chap.paragraph_format.space_before = Pt(12)
    p_chap.paragraph_format.space_after = Pt(4)
    p_chap.paragraph_format.keep_with_next = True
    run_chap_num = p_chap.add_run("CHAPTER 3\n")
    run_chap_num.font.name = 'Calibri'
    run_chap_num.font.size = Pt(14)
    run_chap_num.font.bold = True
    run_chap_num.font.color.rgb = COLOR_STEEL
    
    run_chap_title = p_chap.add_run("SYSTEM METHODOLOGY AND ARCHITECTURE")
    run_chap_title.font.name = 'Calibri'
    run_chap_title.font.size = Pt(22)
    run_chap_title.font.bold = True
    run_chap_title.font.color.rgb = COLOR_NAVY
    
    # Horizontal rule
    p_rule = doc.add_paragraph()
    p_rule.paragraph_format.space_after = Pt(18)
    r_rule = p_rule.add_run("―" * 52)
    r_rule.font.color.rgb = COLOR_STEEL
    
    # =========================================================================
    # SECTION 3.1: OVERVIEW AND RESEARCH OBJECTIVES
    # =========================================================================
    h2_1 = doc.add_heading(level=2)
    h2_1.paragraph_format.space_before = Pt(14)
    h2_1.paragraph_format.space_after = Pt(4)
    r = h2_1.add_run("3.1 Overview and Research Objectives")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_SLATE
    r.font.bold = True
    
    doc.add_paragraph(
        "Autonomous navigation of Unmanned Aerial Vehicles (UAVs) in dense urban environments presents profound "
        "interdisciplinary challenges across robotics, computer vision, control theory, and high-performance simulation. "
        "Unlike open-field or rural flight corridors, metropolitan areas feature severe Global Navigation Satellite System "
        "(GNSS) degradation due to signal attenuation and multipath reflections caused by tall structures ('urban canyons'). "
        "Simultaneously, micro-UAVs must negotiate complex 3D aerodynamic profiles, sudden crosswinds, tight spatial boundaries, "
        "and unexpected dynamic obstacles (such as construction cranes, utility poles, and moving infrastructure) while adhering "
        "to rigorous SWaP-C (Size, Weight, Power, and Cost) constraints."
    )
    
    doc.add_paragraph(
        "To address these formidable challenges, this research proposes a comprehensive, closed-loop autonomous navigation "
        "methodology that harmoniously integrates three interconnected subsystems: (1) high-fidelity photorealistic 3D urban "
        "simulation with physics and synthetic sensor generation; (2) a mathematically rigorous 15-state Error-State Extended "
        "Kalman Filter (ESKF) for optimal kinematic state estimation; (3) a learned temporal trajectory controller driven by a "
        "Gated Recurrent Unit (GRU v3) neural network; and (4) an onboard edge-computing vision model (PULP-DroNet v3) for real-time "
        "reactive collision avoidance and lateral visual servoing."
    )
    
    add_callout(
        doc,
        "Primary Research Objective: Formulate, implement, and validate an integrated navigation architecture capable of "
        "guiding an autonomous quadrotor through GPS-degraded, obstacle-dense 3D urban canyons without human intervention, "
        "maintaining sub-meter trajectory tracking fidelity while reactively avoiding sudden obstacles at 30+ frames per second.",
        title="CORE RESEARCH OBJECTIVE"
    )
    
    # =========================================================================
    # SECTION 3.2: SYSTEM ARCHITECTURE AND PIPELINE
    # =========================================================================
    h2_2 = doc.add_heading(level=2)
    h2_2.paragraph_format.space_before = Pt(14)
    h2_2.paragraph_format.space_after = Pt(4)
    r = h2_2.add_run("3.2 Overall System Architecture and Microservice Topology")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_SLATE
    r.font.bold = True
    
    doc.add_paragraph(
        "The system is designed around a decoupled, asynchronous microservices architecture that separates the heavy graphical "
        "and physical rendering loop from computationally intensive deep learning inference engines. In conventional monolithic "
        "simulation frameworks, running deep convolutional neural networks and recurrent models inside the main game/graphics loop "
        "causes severe frame drops, unstable delta-time physics integration, and thread locking. Our architecture decouples the "
        "system into three distinct microservice tiers operating over dedicated high-speed local TCP/IP communication channels:"
    )
    
    p = doc.add_paragraph()
    p.add_run("1. WebGL Simulation Client (Three.js & Vite - Port 3000): ").bold = True
    p.add_run("Executes the procedural 3D urban synthesis, 6-DoF rigid-body quadrotor flight dynamics, synthetic sensor generation "
              "(IMU, GPS, Barometer, Magnetometer, Monocular Vision), real-time Error-State Kalman Filtering, and cinematic/onboard camera rendering.")
    
    p = doc.add_paragraph()
    p.add_run("2. GRU Learned Navigation Service (FastAPI & PyTorch - Port 8765): ").bold = True
    p.add_run("Receives sliding temporal sequences of 24 kinematic and geometric features over 101 historical timesteps, providing "
              "smooth velocity correction vectors (delta-v) that optimize global trajectory tracking and compensate for nonlinear aerodynamic disturbances.")
    
    p = doc.add_paragraph()
    p.add_run("3. PULP-DroNet Obstacle Avoidance Service (FastAPI & PyTorch - Port 8766): ").bold = True
    p.add_run("Receives real-time 200x200 grayscale visual feeds from the UAV's forward-facing sensor camera, executing deep residual "
              "convolutional inference to output continuous steering commands and collision probability estimates in under 12 milliseconds.")
    
    # Architecture Table
    doc.add_paragraph("Table 3.1 summarizes the functional roles, technology stacks, and interface contracts of each microservice component:")
    tbl_arch = doc.add_table(rows=4, cols=5)
    tbl_arch.rows[0].cells[0].paragraphs[0].text = "Service Name"
    tbl_arch.rows[0].cells[1].paragraphs[0].text = "Port / Protocol"
    tbl_arch.rows[0].cells[2].paragraphs[0].text = "Technology Stack"
    tbl_arch.rows[0].cells[3].paragraphs[0].text = "Primary Input / Output"
    tbl_arch.rows[0].cells[4].paragraphs[0].text = "Target Latency"
    
    data_arch = [
        ("Simulation Engine", "3000 (HTTP/WS)", "Three.js, Vite, WebGL2, JS", "Controls -> 3D Visuals & Sensor Data", "60 FPS (16.6 ms)"),
        ("GRU Navigation AI", "8765 (REST/JSON)", "FastAPI, PyTorch, NumPy", "[101 x 24] Features -> Velocity Delta (vx, vy, vz)", "< 15 ms"),
        ("PULP-DroNet AI", "8766 (REST/Base64)", "FastAPI, PyTorch, TorchVision", "200x200 Image -> Steering Angle & Collision Prob", "< 12 ms"),
    ]
    for row_idx, data in enumerate(data_arch, start=1):
        for col_idx, text in enumerate(data):
            tbl_arch.rows[row_idx].cells[col_idx].paragraphs[0].text = text
    format_table(tbl_arch, col_widths=[1.3, 1.1, 1.5, 1.8, 0.8])
    
    doc.add_paragraph()
    
    # =========================================================================
    # SECTION 3.3: 3D CITY SIMULATION & PBR ENVIRONMENT
    # =========================================================================
    h2_3 = doc.add_heading(level=2)
    h2_3.paragraph_format.space_before = Pt(14)
    h2_3.paragraph_format.space_after = Pt(4)
    r = h2_3.add_run("3.3 Simulation Environment and 3D Urban Synthesis")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_SLATE
    r.font.bold = True
    
    doc.add_paragraph(
        "A critical prerequisite for validating vision-based and neural-network navigation algorithms is a simulation environment "
        "that accurately reproduces the visual distribution and physical scale of modern metropolitan infrastructure. Low-fidelity "
        "block worlds suffer from an acute 'sim-to-real' gap, causing deep visual models like DroNet to fail completely when exposed "
        "to real-world textures, lighting variations, and geometric shadows. The simulation environment in this project combines procedural "
        "city synthesis with high-end Physically Based Rendering (PBR) and hardware-accelerated instanced 3D asset streaming."
    )
    
    h3_31 = doc.add_heading(level=3)
    r = h3_31.add_run("3.3.1 Procedural City Generation and Spatial Zoning")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "The procedural generation pipeline divides the world space into structured Cartesian grids comprising diverse urban zones: "
        "(1) a Commercial Central Business District (CBD) characterized by dense skyscrapers ranging from 60 to 180 meters in height; "
        "(2) a Mid-rise Residential Sector featuring brick, plaster, and concrete apartment blocks (20 to 45 meters); (3) an Industrial "
        "Zone with wide steel warehouses, oil tanks, and utility bridges; and (4) an Infrastructure and Transportation Network with "
        "multi-lane asphalt avenues, intersection crosswalks, sidewalk boundaries, and perimeter green spaces. Roads are mathematically "
        "indexed as spatial flight corridors with explicit waypoint waypaths that allow the autonomous route controller to simulate "
        "corridor-constrained urban drone delivery."
    )
    
    h3_32 = doc.add_heading(level=3)
    r = h3_32.add_run("3.3.2 Physically Based Rendering (PBR) Material Architecture")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "To achieve visual realism without sacrificing real-time performance, the rendering engine utilizes a standard Metallic-Roughness "
        "PBR material pipeline conforming to the microfacet Cook-Torrance specular reflectance model. Texture maps are loaded dynamically "
        "from the production asset library and assigned according to surface typology:"
    )
    
    p = doc.add_paragraph()
    p.add_run("• Diffuse / Albedo Map (sRGB Color Space): ").bold = True
    p.add_run("Encodes the base surface color free of directional lighting and shadow information. Stored strictly in sRGB space (`THREE.SRGBColorSpace`) to guarantee correct gamma correction across display devices.")
    
    p = doc.add_paragraph()
    p.add_run("• Normal Map (Linear Color Space, Tangent-Space OpenGL): ").bold = True
    p.add_run("Encodes micro-surface surface perturbations (cracks in asphalt, mortar joints in brick, panel seams in concrete) using 3-channel RGB vectors, enabling convincing specular highlights and surface relief without increasing vertex counts.")
    
    p = doc.add_paragraph()
    p.add_run("• Roughness & Metalness Maps (Linear Color Space): ").bold = True
    p.add_run("Define microfacet distribution and electrical conductivity. Road surfaces exhibit high roughness with specular water puddles, while glass and metallic facades feature high specular reflectivity.")
    
    p = doc.add_paragraph()
    p.add_run("• Texture Wrapping & UV Repetition Optimization: ").bold = True
    p.add_run("Large structures utilize `THREE.RepeatWrapping` with proportional UV scaling factors calibrated to metric world coordinates (e.g., repeating road textures every 25 meters), eliminating both visual tiling patterns and blurred oversized textures.")
    
    h3_33 = doc.add_heading(level=3)
    r = h3_33.add_run("3.3.3 3D GLB Asset Pipeline and Hardware-Accelerated Instancing")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "In addition to procedural geometry, the environment integrates a library of detailed 3D assets in binary glTF format (`.glb`). "
        "These include realistic streetlights, traffic signals, road barriers, guardrails, bridges, rooftop air conditioning chillers, "
        "satellite antennas, and multi-species urban vegetation. To prevent catastrophic GPU draw call bottlenecks, repeated assets "
        "are rendered using `THREE.InstancedMesh`. A single GPU draw call renders thousands of trees and street props by feeding transformation "
        "matrices (position, rotation, scale) directly into vertex buffer attributes, maintaining 60 FPS rendering speed."
    )
    
    # =========================================================================
    # SECTION 3.4: 15-STATE ERROR-STATE EXTENDED KALMAN FILTER (ESKF)
    # =========================================================================
    h2_4 = doc.add_heading(level=2)
    h2_4.paragraph_format.space_before = Pt(14)
    h2_4.paragraph_format.space_after = Pt(4)
    r = h2_4.add_run("3.4 State Estimation: 15-State Error-State Extended Kalman Filter (ESKF)")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_SLATE
    r.font.bold = True
    
    doc.add_paragraph(
        "Accurate state estimation is the bedrock of autonomous flight. In real-world quadrotors, raw Inertial Measurement Unit (IMU) "
        "sensors suffer from stochastic thermal drift, bias instability, and high-frequency vibration noise. Integrating raw accelerometer "
        "and gyroscope signals directly causes estimated position to diverge quadratically within seconds. To resolve this, we formulate "
        "a 15-State Error-State Extended Kalman Filter (ESKF)."
    )
    
    h3_41 = doc.add_heading(level=3)
    r = h3_41.add_run("3.4.1 State Vector Parameterization and Lie Group Formulation")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "In standard Extended Kalman Filters, orientation is either parameterized by Euler angles (which suffer from mathematical "
        "singularities known as gimbal lock) or by 4D quaternions (which require covariance matrices for non-minimal 4D parameters "
        "and suffer from covariance rank deficiency). The Error-State formulation solves this by splitting the true kinematic state "
        "into a large-signal nominal state and a small-signal error state:"
    )
    
    add_callout(
        doc,
        "True State (x) = Nominal State (x_nom) ⊕ Error State (δx)\n\n"
        "Nominal State:  x_nom = [ p,  v,  q,  a_bias,  ω_bias ]^T  ∈ ℝ³ × ℝ³ × S³ × ℝ³ × ℝ³\n"
        "Error State:    δx    = [ δp, δv, δθ, δa_bias, δω_bias ]^T ∈ ℝ¹⁵\n\n"
        "Where p is 3D position, v is 3D velocity, q is orientation quaternion, a_bias is accelerometer bias, "
        "ω_bias is gyroscope bias, and δθ ∈ ℝ³ represents minimal 3D angular rotation vector in tangent space SO(3).",
        title="ESKF STATE VECTOR DEFINITION"
    )
    
    doc.add_paragraph(
        "Because the error state δx always remains close to zero between measurement updates, the kinematic dynamics of the error state "
        "are strictly linear, eliminating the higher-order linearization errors that degrade traditional EKFs."
    )
    
    h3_42 = doc.add_heading(level=3)
    r = h3_42.add_run("3.4.2 Continuous-Time Kinematics and Propagation Mechanics")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "Between sensor measurements, the nominal state is propagated forward at high frequency (100 Hz) using raw IMU measurements "
        "(accelerometer a_m and gyroscope ω_m) according to continuous-time rigid-body kinematics:"
    )
    
    doc.add_paragraph(
        "    dp/dt = v\n"
        "    dv/dt = R(q) · (a_m - a_bias) + g\n"
        "    dq/dt = 0.5 · q ⊗ (ω_m - ω_bias)\n"
        "    d(a_bias)/dt = w_ab   (random walk)\n"
        "    d(ω_bias)/dt = w_wb   (random walk)"
    )
    
    doc.add_paragraph(
        "Simultaneously, the error covariance matrix P (15x15) is propagated forward in time using the discrete-time state transition "
        "matrix Φ_k and discrete process noise covariance matrix Q_d:"
    )
    
    doc.add_paragraph(
        "    P_{k|k-1} = Φ_k · P_{k-1} · Φ_k^T + Q_d\n"
        "    where Φ_k ≈ I_{15} + F_x · Δt"
    )
    
    doc.add_paragraph(
        "The error system matrix F_x captures cross-coupling terms: acceleration errors couple into velocity through rotation matrix R(q), "
        "and attitude errors couple into velocity through the skew-symmetric matrix of measured specific force [a_m - a_bias]_×."
    )
    
    h3_43 = doc.add_heading(level=3)
    r = h3_43.add_run("3.4.3 Multi-Sensor Measurement Update and Error Injection")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "When discrete sensor measurements arrive, the filter executes a Kalman correction step:\n"
        "• GPS Position and Velocity (10 Hz): Updates δp and δv with measurement noise covariance R_gps.\n"
        "• Barometric Altimeter (20 Hz): Updates vertical position altitude δp_z with high vertical precision.\n"
        "• 3-Axis Magnetometer (25 Hz): Corrects heading yaw drift around the gravity vector."
    )
    
    doc.add_paragraph(
        "The standard Kalman gain K is calculated: K = P_{k|k-1} H^T (H P_{k|k-1} H^T + R)^{-1}. The optimal error correction is "
        "computed as δx = K (y - h(x_nom)). Crucially, the error correction is injected back into the nominal state: "
        "p ← p + δp, v ← v + δv, q ← q ⊗ exp(0.5 · δθ), a_bias ← a_bias + δa_bias, and ω_bias ← ω_bias + δω_bias. "
        "Following error injection, the error state is mathematically reset to zero: δx ← 0, and the covariance is updated: P ← (I - KH) P."
    )
    
    # =========================================================================
    # SECTION 3.5: GRU V3 LEARNED NAVIGATION MODEL
    # =========================================================================
    h2_5 = doc.add_heading(level=2)
    h2_5.paragraph_format.space_before = Pt(14)
    h2_5.paragraph_format.space_after = Pt(4)
    r = h2_5.add_run("3.5 Gated Recurrent Unit (GRU v3) Learned Navigation Model")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_SLATE
    r.font.bold = True
    
    doc.add_paragraph(
        "Classical linear controllers (such as PID cascaded loops) perform adequately in static air, but struggle severely "
        "when navigating high-speed trajectories through urban corridors where aerodynamic drag, rotor downwash, building wake vortices, "
        "and actuator delays induce non-negligible tracking errors. The GRU v3 Learned Navigation Model acts as an intelligent predictive "
        "guidance layer that continuously adapts the quadrotor's velocity commands based on temporal flight history."
    )
    
    h3_51 = doc.add_heading(level=3)
    r = h3_51.add_run("3.5.1 Temporal Feature Buffer Formulation (101 x 24)")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "At each simulation step, the navigation system captures a 24-dimensional feature vector and appends it to a historical sliding "
        "window buffer spanning T = 101 historical timesteps (approximately 2.0 seconds of flight history at 50 Hz). Table 3.2 details the "
        "precise mathematical ordering and physical semantics of these 24 features:"
    )
    
    tbl_gru = doc.add_table(rows=8, cols=4)
    tbl_gru.rows[0].cells[0].paragraphs[0].text = "Feature Indices"
    tbl_gru.rows[0].cells[1].paragraphs[0].text = "Feature Category"
    tbl_gru.rows[0].cells[2].paragraphs[0].text = "Variable Names"
    tbl_gru.rows[0].cells[3].paragraphs[0].text = "Physical Description"
    
    data_gru = [
        ("0 - 2", "Relative Position", "dx, dy, dz", "Vector from current ESKF position to target waypoint (m)"),
        ("3 - 5", "ESKF Velocity", "vx, vy, vz", "Filtered 3D velocity vector in world coordinates (m/s)"),
        ("6 - 9", "Attitude Quaternion", "qw, qx, qy, qz", "Estimated orientation quaternion on S³ unit sphere"),
        ("10 - 12", "Angular Velocity", "wx, wy, wz", "Body-frame rotational rates from filtered gyro (rad/s)"),
        ("13 - 15", "Linear Acceleration", "ax, ay, az", "Body-frame linear acceleration without gravity (m/s²)"),
        ("16 - 19", "Tracking Metrics", "dist, cte, ate, speed", "Euclidean target distance, cross-track & along-track errors"),
        ("20 - 23", "Control History", "cmd_vx, cmd_vy, cmd_vz, yaw_rate", "Preceding control command signals dispatched to quadrotor"),
    ]
    for row_idx, data in enumerate(data_gru, start=1):
        for col_idx, text in enumerate(data):
            tbl_gru.rows[row_idx].cells[col_idx].paragraphs[0].text = text
    format_table(tbl_gru, col_widths=[1.2, 1.4, 1.5, 2.4])
    
    doc.add_paragraph()
    
    h3_52 = doc.add_heading(level=3)
    r = h3_52.add_run("3.5.2 Gated Recurrent Unit Architecture and Gating Mechanism")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "Standard Recurrent Neural Networks (RNNs) suffer from vanishing and exploding gradients when processing long sequences. "
        "While Long Short-Term Memory (LSTM) networks solve this with three gates, the Gated Recurrent Unit (GRU) achieves comparable "
        "representational power with only two gates (Reset and Update), reducing parameter count by 25% and enabling ultra-low-latency "
        "inference on edge hardware. The internal recurrence mechanics for timestep t are defined as:"
    )
    
    add_callout(
        doc,
        "1. Reset Gate:            r_t = σ( W_r · x_t + U_r · h_{t-1} + b_r )\n"
        "2. Update Gate:           z_t = σ( W_z · x_t + U_z · h_{t-1} + b_z )\n"
        "3. Candidate Hidden:      h̃_t = tanh( W_h · x_t + U_h · (r_t ⊙ h_{t-1}) + b_h )\n"
        "4. Hidden State Update:   h_t = (1 - z_t) ⊙ h_{t-1} + z_t ⊙ h̃_t\n\n"
        "Where σ(·) is the sigmoid activation function, ⊙ is element-wise Hadamard product, and h_t ∈ ℝ¹²⁸ "
        "encodes the accumulated spatio-temporal aerodynamic state of the quadrotor.",
        title="GRU RECURRENT GATING FORMULATION"
    )
    
    doc.add_paragraph(
        "The final hidden state h_101 is projected through a Multi-Layer Perceptron (Linear(128, 64) → ReLU → Linear(64, 3)) to produce "
        "a 3D velocity correction vector Δv = [Δvx, Δvy, Δvz]^T. This correction is added to the nominal kinematic waypoint guidance "
        "velocity: v_guidance = v_nominal + Δv, compensating for cross-track drift, momentum overshoot, and wind-induced track errors."
    )
    
    # =========================================================================
    # SECTION 3.6: PULP-DRONET V3 DEEP VISION AVOIDANCE
    # =========================================================================
    h2_6 = doc.add_heading(level=2)
    h2_6.paragraph_format.space_before = Pt(14)
    h2_6.paragraph_format.space_after = Pt(4)
    r = h2_6.add_run("3.6 PULP-DroNet v3 Deep Vision Obstacle Avoidance Model")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_SLATE
    r.font.bold = True
    
    doc.add_paragraph(
        "While the 15-state ESKF and GRU model ensure precision following of pre-planned global waypaths, real-world urban flight "
        "inevitably encounters unmapped, dynamic, or sudden obstacles (construction scaffolds, cranes, fallen trees, utility cables, "
        "and other aerial vehicles). The PULP-DroNet v3 deep vision model serves as the UAV's reactive obstacle avoidance cortex, "
        "inspired by the pioneering DroNet architecture tailored for micro-aerial vehicles operating on Parallel Ultra-Low-Power (PULP) computing."
    )
    
    h3_61 = doc.add_heading(level=3)
    r = h3_61.add_run("3.6.1 Monocular Synthetic Sensor Camera Pipeline")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "The simulation pipeline renders a dedicated forward-facing monocular sensor viewport mounted rigidly to the UAV's front airframe. "
        "The sensor camera operates at an effective resolution of 200 x 200 pixels in 8-bit grayscale format with a 75-degree horizontal "
        "Field of View (FOV). Grayscale conversion suppresses distracting color variations while preserving structural edge contrast. "
        "Pixel intensities are normalized to the floating-point range [0.0, 1.0] and packaged into a PyTorch tensor with dimensions "
        "[1, 1, 200, 200]."
    )
    
    h3_62 = doc.add_heading(level=3)
    r = h3_62.add_run("3.6.2 Deep Residual Architecture (ResBlock-1.0)")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "PULP-DroNet v3 utilizes a lightweight Residual Convolutional Neural Network (CNN) designed to extract multi-scale spatial "
        "features without the prohibitive computational burden of full-scale networks (like ResNet-50). The architecture consists of an "
        "initial strided convolution followed by three cascading Residual Blocks with identity/projection skip connections:"
    )
    
    tbl_dronet = doc.add_table(rows=7, cols=5)
    tbl_dronet.rows[0].cells[0].paragraphs[0].text = "Stage / Layer"
    tbl_dronet.rows[0].cells[1].paragraphs[0].text = "Kernel / Stride"
    tbl_dronet.rows[0].cells[2].paragraphs[0].text = "Output Shape"
    tbl_dronet.rows[0].cells[3].paragraphs[0].text = "Activation / Op"
    tbl_dronet.rows[0].cells[4].paragraphs[0].text = "Functionality"
    
    data_dronet = [
        ("Input Stream", "-", "1 x 200 x 200", "Normalized [0, 1]", "Monocular Grayscale Sensor Feed"),
        ("Conv1 + MaxPool", "5x5, s=2; 2x2, s=2", "32 x 50 x 50", "ReLU + MaxPool", "Low-level edge & gradient extraction"),
        ("ResBlock 1", "3x3, s=1 (x2)", "32 x 50 x 50", "ReLU + Skip Add", "Surface texture & boundary features"),
        ("ResBlock 2", "3x3, s=2 (x2)", "64 x 25 x 25", "ReLU + Conv Skip", "Spatial downsampling & obstacle profiles"),
        ("ResBlock 3", "3x3, s=2 (x2)", "128 x 13 x 13", "ReLU + Conv Skip", "High-level visual corridor geometry"),
        ("Dense Dual Head", "FC(128) -> Heads", "Head1: 1 | Head2: 1", "Linear / Sigmoid", "Steering Angle & Collision Risk"),
    ]
    for row_idx, data in enumerate(data_dronet, start=1):
        for col_idx, text in enumerate(data):
            tbl_dronet.rows[row_idx].cells[col_idx].paragraphs[0].text = text
    format_table(tbl_dronet, col_widths=[1.3, 1.4, 1.2, 1.2, 1.4])
    
    doc.add_paragraph()
    
    h3_63 = doc.add_heading(level=3)
    r = h3_63.add_run("3.6.3 Dual-Head Output and Loss Formulation")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "A defining strength of DroNet is its unified dual-head prediction architecture. Unlike standard object detectors that require "
        "complex bounding box post-processing, DroNet directly outputs two compact, actionable flight navigation variables:"
    )
    
    p = doc.add_paragraph()
    p.add_run("1. Steering Angle Head (α ∈ [-1.0, +1.0]): ").bold = True
    p.add_run("A continuous regression output predicting normalized steering offset. α = 0 corresponds to straight flight; negative values command left evasion; positive values command right evasion.")
    
    p = doc.add_paragraph()
    p.add_run("2. Collision Probability Head (P_coll ∈ [0.0, 1.0]): ").bold = True
    p.add_run("A sigmoidal probability output predicting the likelihood of impending collision within a 15-meter forward stopping horizon. P_coll < 0.3 indicates clear corridor; P_coll > 0.7 indicates immediate collision danger.")
    
    add_callout(
        doc,
        "Multi-Task Loss Function:\n\n"
        "    ℒ_total = ℒ_MSE( α, α̂ ) + λ · ℒ_BCE( P_coll, P̂_coll )\n\n"
        "Where ℒ_MSE is Mean Squared Error on continuous steering angles, ℒ_BCE is Binary Cross-Entropy on collision labels, "
        "and λ = 1.0 is a balancing hyperparameter ensuring equal gradient propagation across both perception heads.",
        title="PULP-DRONET DUAL-HEAD OBJECTIVE"
    )
    
    # =========================================================================
    # SECTION 3.7: MODEL INTERCONNECTION AND HYBRID CONTROL
    # =========================================================================
    h2_7 = doc.add_heading(level=2)
    h2_7.paragraph_format.space_before = Pt(14)
    h2_7.paragraph_format.space_after = Pt(4)
    r = h2_7.add_run("3.7 Model Interconnection and Multi-Tiered Hybrid Control Arbitration")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_SLATE
    r.font.bold = True
    
    doc.add_paragraph(
        "A central innovation of this project is the hierarchical interconnection and dynamic arbitration between the 15-state ESKF, "
        "the learned GRU navigation model, and the PULP-DroNet visual obstacle avoidance network. Figure 3.1 illustrates the complete "
        "inter-model control topology:"
    )
    
    # ASCII Pipeline Diagram Box
    add_callout(
        doc,
        "   [ Raw Sensors: IMU / GPS / Baro / Mag ]          [ Forward Sensor Camera (200x200) ]\n"
        "                     │                                              │\n"
        "                     ▼                                              ▼\n"
        "      ┌───────────────────────────────┐              ┌───────────────────────────────┐\n"
        "      │   15-State ESKF Estimator     │              │     PULP-DroNet v3 Model      │\n"
        "      │   (Optimal 6-DoF State: p, v) │              │  (Steering: α, Risk: P_coll)  │\n"
        "      └──────────────┬────────────────┘              └──────────────┬────────────────┘\n"
        "                     │                                              │\n"
        "                     ▼                                              │\n"
        "      ┌───────────────────────────────┐                             │\n"
        "      │   Feature Buffer (101 x 24)   │                             │\n"
        "      │   & GRU v3 Navigation Model   │                             │\n"
        "      │   (Planned Velocity: v_gru)   │                             │\n"
        "      └──────────────┬────────────────┘                             │\n"
        "                     │                                              │\n"
        "                     ▼                                              ▼\n"
        "             ┌──────────────────────────────────────────────────────────────┐\n"
        "             │          HYBRID CONTROL ARBITRATION MATRIX                    │\n"
        "             │   Blends Nominal Route Guidance with Reactive Avoidance      │\n"
        "             │   v_cmd = (1 - w_avoid) · v_gru  +  w_avoid · v_avoid(α)     │\n"
        "             └──────────────────────────────┬───────────────────────────────┘\n"
        "                                            ▼\n"
        "                             [ 6-DoF Quadrotor Flight Physics ]",
        title="SYSTEM CONTROL TOPOLOGY & DATA FLOW PIPELINE"
    )
    
    doc.add_paragraph(
        "The control arbitrator operates as a hierarchical finite-state switching manager based on the instantaneous collision "
        "probability P_coll reported by PULP-DroNet:"
    )
    
    p = doc.add_paragraph()
    p.add_run("1. Free Corridor Flight (P_coll < 0.30): ").bold = True
    p.add_run("The avoidance weight w_avoid = 0.0. The quadrotor executes nominal waypoint navigation. Velocity commands are governed "
              "entirely by the GRU v3 model: v_cmd = v_gru = v_nominal + Δv_gru.")
    
    p = doc.add_paragraph()
    p.add_run("2. Active Blended Avoidance (0.30 ≤ P_coll < 0.75): ").bold = True
    p.add_run("The UAV detects a proximate obstacle within its safety corridor. The avoidance weight scales smoothly according to: "
              "w_avoid = (P_coll - 0.30) / (0.75 - 0.30). The guidance vector is dynamically rotated away from the obstacle by injecting "
              "a lateral velocity component proportional to DroNet's predicted steering angle α: v_avoid = v_nominal + k_steer · α · n_lat.")
    
    p = doc.add_paragraph()
    p.add_run("3. Emergency Critical Braking (P_coll ≥ 0.75): ").bold = True
    p.add_run("The obstacle is inside the emergency safety bubble. The arbitrator overrides waypoint following completely (w_avoid = 1.0). "
              "Forward velocity is actively braked to zero, a lateral evasion thrust is commanded in direction sign(α), and an emergency "
              "vertical climb (Δz = +2.5 m/s) is initiated until P_coll drops below the recovery threshold.")
    
    # =========================================================================
    # SECTION 3.8: PROJECT EXECUTION AND DEPLOYMENT GUIDE
    # =========================================================================
    h2_8 = doc.add_heading(level=2)
    h2_8.paragraph_format.space_before = Pt(14)
    h2_8.paragraph_format.space_after = Pt(4)
    r = h2_8.add_run("3.8 Project Execution and Deployment Guide")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_SLATE
    r.font.bold = True
    
    doc.add_paragraph(
        "To ensure complete reproducibility and straightforward deployment on any workstation or laptop, the project has been "
        "containerized into standardized Node.js and Python microservices with unified launch scripts."
    )
    
    h3_81 = doc.add_heading(level=3)
    r = h3_81.add_run("3.8.1 Hardware and Software Prerequisites")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "• Operating System: Windows 10/11, Ubuntu 22.04 LTS, or macOS (Apple Silicon / Intel).\n"
        "• Runtime Environments: Node.js (v18.0 or higher) and Python (v3.10 or v3.11 recommended).\n"
        "• Python Dependencies: PyTorch (>= 2.2.0), FastAPI (>= 0.115.0), Uvicorn (>= 0.30.0), NumPy (>= 1.26.0), Pillow (>= 10.0.0), Pydantic (>= 2.0.0).\n"
        "• Node.js Dependencies: Three.js (>= 0.170.0), Vite (>= 6.0.0).\n"
        "• GPU Acceleration: Dedicated NVIDIA GPU with CUDA 12.x recommended (CPU fallback is automatically supported)."
    )
    
    h3_82 = doc.add_heading(level=3)
    r = h3_82.add_run("3.8.2 Repository Structure and Microservice Layout")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "The project repository is organized into distinct functional directories:\n"
        "• `src/`: Core Three.js simulation modules (DronePhysics.js, ESKF.js, RouteController.js, CityGenerator.js, WeatherSystem.js).\n"
        "• `public/materials/`: Photorealistic PBR texture maps and 3D `.glb` urban models.\n"
        "• `GRU MODEL/`: PyTorch implementation of the GRU v3 learned navigation model (`model_runtime.py`, `server_fastapi.py`).\n"
        "• `dronet_service/`: PyTorch implementation of PULP-DroNet v3 (`dronet_model.py`, weights, `server.py`).\n"
        "• `run_simulation.bat`: 1-click Windows master launcher that automatically configures environments and runs all services.\n"
        "• `requirements.txt`: Root Python dependency definition file."
    )
    
    h3_83 = doc.add_heading(level=3)
    r = h3_83.add_run("3.8.3 Method 1: 1-Click Automated Launch (Windows)")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "On Windows workstations, the complete simulation stack can be launched with a single click:\n"
        "1. Open the project root folder.\n"
        "2. Double-click `run_simulation.bat` (or execute `.\\run_simulation.bat` in PowerShell/CMD).\n"
        "The batch launcher will automatically check for Node.js modules (running `npm install` if absent), create a Python virtual "
        "environment (`.venv`) and install `requirements.txt` if needed, launch both FastAPI microservices in titled background windows, "
        "start the Vite development server on port 3000, and immediately open the simulation in your default web browser."
    )
    
    h3_84 = doc.add_heading(level=3)
    r = h3_84.add_run("3.8.4 Method 2: Manual Multi-Terminal Startup (Cross-Platform)")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "For Linux, macOS, or advanced debugging, the three microservices can be initialized manually across three terminal tabs:\n\n"
        "Step 1: Install Dependencies (Run once):\n"
        "    npm install\n"
        "    python -m venv .venv\n"
        "    .venv/bin/pip install -r requirements.txt  (or .venv\\Scripts\\pip install on Windows)\n\n"
        "Step 2: Terminal 1 - Launch GRU Navigation Service:\n"
        "    python -m uvicorn server_fastapi:app --app-dir \"GRU MODEL\" --host 127.0.0.1 --port 8765\n\n"
        "Step 3: Terminal 2 - Launch PULP-DroNet Vision Service:\n"
        "    python -m uvicorn server:app --app-dir \"dronet_service\" --host 127.0.0.1 --port 8766\n\n"
        "Step 4: Terminal 3 - Launch Three.js Web Simulation:\n"
        "    npx vite --host --port 3000\n\n"
        "Step 5: Access the Simulation:\n"
        "    Open http://localhost:3000 in Google Chrome, Microsoft Edge, or Mozilla Firefox."
    )
    
    h3_85 = doc.add_heading(level=3)
    r = h3_85.add_run("3.8.5 Service Health Verification and Telemetry Validation")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_STEEL
    r.font.bold = True
    
    doc.add_paragraph(
        "Once initialized, users can verify active microservice status via built-in REST health endpoints:\n"
        "• GRU Service Health Check: Visit `http://127.0.0.1:8765/health` → Returns `{\"ok\": true, \"model\": \"Project Ghost GRU V3\"}`.\n"
        "• DroNet Service Health Check: Visit `http://127.0.0.1:8766/health` → Returns `{\"ok\": true, \"model\": \"PULP-DroNet v3 (ResBlock-1.0)\"}`.\n"
        "Inside the 3D simulation interface, the top-right telemetry HUD displays live status indicators confirming that both the GRU "
        "and DroNet models are actively streaming inference predictions."
    )
    
    # =========================================================================
    # SECTION 3.9: SUMMARY OF THE CHAPTER
    # =========================================================================
    h2_9 = doc.add_heading(level=2)
    h2_9.paragraph_format.space_before = Pt(14)
    h2_9.paragraph_format.space_after = Pt(4)
    r = h2_9.add_run("3.9 Summary of the Chapter")
    r.font.name = 'Calibri'
    r.font.color.rgb = COLOR_SLATE
    r.font.bold = True
    
    doc.add_paragraph(
        "This chapter has established the comprehensive architectural and methodological foundation of the autonomous urban drone "
        "navigation system. We formulated a modular, decoupled microservices framework that unites photorealistic 3D urban simulation "
        "with real-time state estimation and multi-tiered artificial intelligence. Specifically:"
    )
    
    p = doc.add_paragraph()
    p.add_run("• Photorealistic Simulation Environment: ").bold = True
    p.add_run("Leverages procedural generation, PBR Metallic-Roughness materials, and GPU-instanced 3D assets to create visually realistic, performance-optimized urban flight corridors.")
    
    p = doc.add_paragraph()
    p.add_run("• 15-State Error-State Extended Kalman Filter: ").bold = True
    p.add_run("Provides singularity-free, minimal-parameter state estimation by propagating nominal kinematics at 100 Hz and correcting error states using multi-sensor updates (GPS, Baro, Mag).")
    
    p = doc.add_paragraph()
    p.add_run("• GRU v3 Learned Navigation Model: ").bold = True
    p.add_run("Ingests a 101 x 24 historical feature tensor to predict smooth velocity adjustments (Δv) that compensate for dynamic aerodynamic disturbances and path curvature.")
    
    p = doc.add_paragraph()
    p.add_run("• PULP-DroNet v3 Deep Vision Model: ").bold = True
    p.add_run("Processes monocular 200x200 grayscale sensor feeds through residual convolutional blocks, outputting continuous steering angles and collision hazard probabilities.")
    
    p = doc.add_paragraph()
    p.add_run("• Hybrid Control Arbitration: ").bold = True
    p.add_run("Harmonizes global route guidance and reactive visual avoidance through a mathematically grounded arbitration matrix, transitioning smoothly between free flight, active avoidance, and emergency braking.")
    
    doc.add_paragraph(
        "With the system architecture and theoretical methodology thoroughly articulated, Chapter 4 presents the experimental "
        "setup, trajectory tracking metrics, obstacle avoidance benchmarks, and comparative performance analyses under varying "
        "weather conditions and sensor noise profiles."
    )
    
    # Save the document to destination paths
    out_path_1 = r"D:\G-P\Chapter_3_Methodology_and_System_Architecture.docx"
    doc.save(out_path_1)
    print(f"[SUCCESS] Saved to {out_path_1}")
    
    # Also save to Arabic workspace folder if accessible
    arabic_dir = r"D:\مشروووووووع التخرجججج"
    if os.path.exists(arabic_dir):
        out_path_2 = os.path.join(arabic_dir, "Chapter_3_Methodology_and_System_Architecture.docx")
        doc.save(out_path_2)
        print(f"[SUCCESS] Saved to {out_path_2}")

if __name__ == "__main__":
    build_document()
