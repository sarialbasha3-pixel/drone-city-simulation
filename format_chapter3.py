"""
format_chapter3.py
==================
Builds a properly formatted Chapter 3 Word document that exactly matches
the university formatting specifications shown in the reference image:

  - Paper size       : A4
  - English font     : Times New Roman
  - Arabic font      : Simplified Arabic
  - Line spacing     : 1.5 lines
  - Space before     : 2.5 cm  (Before Text)
  - Space after      : 2.0 cm  (After Text)
  - Margins          : Left (binding) 2.5 cm  |  Top / Right / Bottom  2.0 cm
  - Page numbers     : Arabic numerals, bottom-centre
  - All text colour  : pure black  #000000
  - Font sizes       : Chapter title 18 pt  |  H2 14 pt  |  H3 12 pt  |  Body 12 pt
"""

import copy
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

# ─────────────────────────────────────────────────────────────────────────────
# Constants matching the reference image specifications
# ─────────────────────────────────────────────────────────────────────────────
FONT_EN   = "Times New Roman"
FONT_AR   = "Simplified Arabic"
BLACK     = RGBColor(0, 0, 0)
WHITE     = RGBColor(255, 255, 255)
NAVY      = RGBColor(0, 0, 0)        # all headings → pure black per spec

SZ_CHAP   = Pt(18)    # Chapter title / number
SZ_H1     = Pt(16)    # (same section, not used separately)
SZ_H2     = Pt(14)    # e.g. "3.1 Overview …"
SZ_H3     = Pt(12)    # e.g. "3.1.1 …"
SZ_BODY   = Pt(12)    # normal body text
SZ_TABLE  = Pt(11)    # inside table cells
SZ_CAPTION= Pt(10)    # table / figure captions

SP_BEFORE = Cm(2.5)   # paragraph spacing before  (Before Text)
SP_AFTER  = Cm(2.0)   # paragraph spacing after   (After Text)
SP_H2_BEF = Cm(2.5)
SP_H2_AFT = Cm(0.5)
SP_H3_BEF = Cm(1.5)
SP_H3_AFT = Cm(0.3)

# ─────────────────────────────────────────────────────────────────────────────
# Helper – add Oxml page-number field to a paragraph
# ─────────────────────────────────────────────────────────────────────────────
def _add_page_number(paragraph):
    run = paragraph.add_run()
    fld = OxmlElement("w:fldChar")
    fld.set(qn("w:fldCharType"), "begin")
    run._r.append(fld)

    ins = OxmlElement("w:instrText")
    ins.set(qn("xml:space"), "preserve")
    ins.text = " PAGE "
    run._r.append(ins)

    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    run._r.append(fld2)
    run.font.name = FONT_EN
    run.font.size = Pt(11)
    run.font.color.rgb = BLACK

# ─────────────────────────────────────────────────────────────────────────────
# Helper – apply 1.5 line spacing + before/after to a paragraph
# ─────────────────────────────────────────────────────────────────────────────
def _fmt_body(para, before=SP_BEFORE, after=SP_AFTER, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
    pf = para.paragraph_format
    pf.line_spacing_rule  = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before       = before
    pf.space_after        = after
    pf.alignment          = align

def _run(para, text, bold=False, italic=False, sz=SZ_BODY, font=FONT_EN, color=BLACK):
    r = para.add_run(text)
    r.bold              = bold
    r.italic            = italic
    r.font.name         = font
    r.font.size         = sz
    r.font.color.rgb    = color
    return r

# ─────────────────────────────────────────────────────────────────────────────
# Helper – format table
# ─────────────────────────────────────────────────────────────────────────────
def _format_table(table, col_widths=None):
    """Apply clean black-border academic table formatting."""
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl = table._tbl
    tblPr = tbl.tblPr

    # borders: thin black
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
        f'<w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>'
        f'<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        f'<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        f'<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

    for r_idx, row in enumerate(table.rows):
        for c_idx, cell in enumerate(row.cells):
            if col_widths and c_idx < len(col_widths):
                cell.width = col_widths[c_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            # cell padding
            tcPr = cell._tc.get_or_add_tcPr()
            tcMar = parse_xml(
                f'<w:tcMar {nsdecls("w")}>'
                f'<w:top w:w="80" w:type="dxa"/>'
                f'<w:bottom w:w="80" w:type="dxa"/>'
                f'<w:left w:w="108" w:type="dxa"/>'
                f'<w:right w:w="108" w:type="dxa"/>'
                f'</w:tcMar>'
            )
            tcPr.append(tcMar)

            for para in cell.paragraphs:
                pf = para.paragraph_format
                pf.space_before = Pt(2)
                pf.space_after  = Pt(2)
                pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
                for run in para.runs:
                    run.font.name       = FONT_EN
                    run.font.size       = SZ_TABLE
                    run.font.color.rgb  = BLACK
                    if r_idx == 0:
                        run.bold = True

            # header row shading: light grey
            if r_idx == 0:
                shd = parse_xml(
                    f'<w:shd {nsdecls("w")} w:fill="D9D9D9" w:val="clear"/>'
                )
                tcPr.append(shd)


# ─────────────────────────────────────────────────────────────────────────────
# Helper – heading paragraph
# ─────────────────────────────────────────────────────────────────────────────
def _heading(doc, text, level=2):
    """Add a heading paragraph with correct Times New Roman, black, sizing."""
    if level == 1:
        sz, bf, sb, sa = SZ_CHAP, True, Cm(3.0), Cm(0.8)
    elif level == 2:
        sz, bf, sb, sa = SZ_H2,  True, SP_H2_BEF, SP_H2_AFT
    else:
        sz, bf, sb, sa = SZ_H3,  True, SP_H3_BEF, SP_H3_AFT

    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before      = sb
    pf.space_after       = sa
    pf.alignment         = WD_ALIGN_PARAGRAPH.LEFT
    pf.keep_with_next    = True
    r = p.add_run(text)
    r.bold           = bf
    r.font.name      = FONT_EN
    r.font.size      = sz
    r.font.color.rgb = BLACK
    # underline for H2 level only (common in academic formatting)
    if level == 2:
        r.underline = True
    return p


# ─────────────────────────────────────────────────────────────────────────────
# Helper – body paragraph
# ─────────────────────────────────────────────────────────────────────────────
def _body(doc, text="", first_indent=Cm(1.25)):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule  = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before       = Pt(0)
    pf.space_after        = Pt(8)
    pf.alignment          = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf.first_line_indent  = first_indent
    if text:
        r = p.add_run(text)
        r.font.name      = FONT_EN
        r.font.size      = SZ_BODY
        r.font.color.rgb = BLACK
    return p


def _bullet(doc, label, body_text, indent=Cm(0.8)):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before      = Pt(0)
    pf.space_after       = Pt(6)
    pf.alignment         = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf.left_indent       = indent
    pf.first_line_indent = Cm(-0.4)
    rl = p.add_run(label)
    rl.bold           = True
    rl.font.name      = FONT_EN
    rl.font.size      = SZ_BODY
    rl.font.color.rgb = BLACK
    rb = p.add_run(body_text)
    rb.font.name      = FONT_EN
    rb.font.size      = SZ_BODY
    rb.font.color.rgb = BLACK
    return p


def _equation_box(doc, eq_text, label=""):
    """Render equation in a simple centred paragraph with monospace-like formatting."""
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before      = Pt(6)
    pf.space_after       = Pt(6)
    pf.alignment         = WD_ALIGN_PARAGRAPH.CENTER

    r = p.add_run(eq_text)
    r.font.name      = FONT_EN
    r.font.size      = Pt(11)
    r.font.color.rgb = BLACK

    if label:
        tab_run = p.add_run(f"\t{label}")
        tab_run.font.name      = FONT_EN
        tab_run.font.size      = Pt(11)
        tab_run.font.color.rgb = BLACK

    # Border box around equation
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    for side in ("top", "bottom", "left", "right"):
        bd = OxmlElement(f"w:{side}")
        bd.set(qn("w:val"), "single")
        bd.set(qn("w:sz"), "4")
        bd.set(qn("w:space"), "4")
        bd.set(qn("w:color"), "AAAAAA")
        pBdr.append(bd)
    pPr.append(pBdr)
    return p


def _spacer(doc, lines=1):
    for _ in range(lines):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after  = Pt(0)
        _run(p, "")


# ─────────────────────────────────────────────────────────────────────────────
# Helper – caption
# ─────────────────────────────────────────────────────────────────────────────
def _caption(doc, text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.alignment         = WD_ALIGN_PARAGRAPH.CENTER
    pf.space_before      = Pt(4)
    pf.space_after       = Pt(10)
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    r = p.add_run(text)
    r.bold           = True
    r.italic         = True
    r.font.name      = FONT_EN
    r.font.size      = SZ_CAPTION
    r.font.color.rgb = BLACK
    return p


# ─────────────────────────────────────────────────────────────────────────────
# PAGE SETUP – A4, margins per reference image
# ─────────────────────────────────────────────────────────────────────────────
def _page_setup(doc):
    from docx.oxml.ns import qn
    for section in doc.sections:
        # A4 dimensions: 21 cm × 29.7 cm
        section.page_width  = Cm(21.0)
        section.page_height = Cm(29.7)
        # Margins: Left(binding)=2.5cm, others=2.0cm
        section.left_margin   = Cm(2.5)
        section.right_margin  = Cm(2.0)
        section.top_margin    = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.gutter        = Cm(0)


# ─────────────────────────────────────────────────────────────────────────────
# PAGE FOOTER – Arabic numerals, bottom centre
# ─────────────────────────────────────────────────────────────────────────────
def _add_footer(doc):
    for section in doc.sections:
        footer  = section.footer
        # Clear existing content
        for p in footer.paragraphs:
            for r in p.runs:
                r.clear()
        if footer.paragraphs:
            fp = footer.paragraphs[0]
        else:
            fp = footer.add_paragraph()
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.paragraph_format.space_before = Pt(0)
        fp.paragraph_format.space_after  = Pt(0)
        _add_page_number(fp)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN BUILD FUNCTION
# ─────────────────────────────────────────────────────────────────────────────
def build():
    doc = Document()

    # ── Document defaults ────────────────────────────────────────────────────
    style = doc.styles["Normal"]
    style.font.name      = FONT_EN
    style.font.size      = SZ_BODY
    style.font.color.rgb = BLACK

    _page_setup(doc)
    _add_footer(doc)

    # ════════════════════════════════════════════════════════════════════════
    # CHAPTER 3 TITLE
    # ════════════════════════════════════════════════════════════════════════
    p_top = doc.add_paragraph()
    pf = p_top.paragraph_format
    pf.alignment    = WD_ALIGN_PARAGRAPH.CENTER
    pf.space_before = Cm(2.5)
    pf.space_after  = Pt(4)
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    r = p_top.add_run("Chapter Three")
    r.bold = True; r.font.name = FONT_EN; r.font.size = SZ_CHAP; r.font.color.rgb = BLACK

    p_title = doc.add_paragraph()
    pf = p_title.paragraph_format
    pf.alignment    = WD_ALIGN_PARAGRAPH.CENTER
    pf.space_before = Pt(4)
    pf.space_after  = Cm(2.0)
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    r = p_title.add_run("System Methodology and Architecture")
    r.bold = True; r.font.name = FONT_EN; r.font.size = SZ_CHAP; r.font.color.rgb = BLACK

    # ════════════════════════════════════════════════════════════════════════
    # 3.1  Overview and Research Objectives
    # ════════════════════════════════════════════════════════════════════════
    _heading(doc, "3.1  Overview and Research Objectives", level=2)

    _body(doc, (
        "Autonomous navigation of Unmanned Aerial Vehicles (UAVs) in dense urban environments "
        "presents profound interdisciplinary challenges across robotics, computer vision, control "
        "theory, and high-performance simulation. Unlike open-field or rural flight corridors, "
        "metropolitan areas feature severe Global Navigation Satellite System (GNSS) degradation "
        "due to signal attenuation and multipath reflections caused by tall structures—commonly "
        "referred to as 'urban canyons'. Simultaneously, micro-UAVs must negotiate complex "
        "three-dimensional aerodynamic profiles, sudden crosswinds, tight spatial boundaries, and "
        "unexpected dynamic obstacles (such as construction cranes, utility poles, and moving "
        "infrastructure) while adhering to rigorous SWaP-C (Size, Weight, Power, and Cost) "
        "constraints."
    ))

    _body(doc, (
        "To address these formidable challenges, this research proposes a comprehensive, "
        "closed-loop autonomous navigation methodology that harmoniously integrates four "
        "interconnected subsystems: (1) high-fidelity photorealistic three-dimensional urban "
        "simulation with physics engine and synthetic sensor generation; (2) a mathematically "
        "rigorous 15-state Error-State Extended Kalman Filter (ESKF) for optimal kinematic state "
        "estimation under multi-sensor fusion; (3) a learned temporal trajectory controller driven "
        "by a Gated Recurrent Unit (GRU v3) deep neural network; and (4) an onboard edge-computing "
        "vision model—PULP-DroNet v3—for real-time reactive collision avoidance and lateral visual "
        "servoing."
    ))

    # Objective callout box
    p_box = doc.add_paragraph()
    pf = p_box.paragraph_format
    pf.alignment  = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf.space_before = Pt(6); pf.space_after = Pt(10)
    pf.left_indent = Cm(1.0); pf.right_indent = Cm(1.0)
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pPr = p_box._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    for side in ("top","bottom","left","right"):
        bd = OxmlElement(f"w:{side}")
        bd.set(qn("w:val"),"single"); bd.set(qn("w:sz"),"12")
        bd.set(qn("w:space"),"8"); bd.set(qn("w:color"),"000000")
        pBdr.append(bd)
    pPr.append(pBdr)
    rl = p_box.add_run("Primary Research Objective:  ")
    rl.bold = True; rl.font.name = FONT_EN; rl.font.size = SZ_BODY; rl.font.color.rgb = BLACK
    rb = p_box.add_run(
        "Formulate, implement, and validate an integrated navigation architecture capable of "
        "guiding an autonomous quadrotor through GPS-degraded, obstacle-dense three-dimensional "
        "urban corridors without human intervention, maintaining sub-metre trajectory tracking "
        "fidelity while reactively avoiding sudden obstacles at thirty or more frames per second."
    )
    rb.font.name = FONT_EN; rb.font.size = SZ_BODY; rb.font.color.rgb = BLACK

    # ════════════════════════════════════════════════════════════════════════
    # 3.2  Overall System Architecture
    # ════════════════════════════════════════════════════════════════════════
    _heading(doc, "3.2  Overall System Architecture and Microservice Topology", level=2)

    _body(doc, (
        "The system is designed around a decoupled, asynchronous microservices architecture that "
        "separates the heavy graphical and physical rendering loop from computationally intensive "
        "deep learning inference engines. In conventional monolithic simulation frameworks, running "
        "deep convolutional neural networks and recurrent models inside the main graphics loop "
        "causes severe frame drops, unstable delta-time physics integration, and thread locking. "
        "The proposed architecture decouples the system into three distinct microservice tiers "
        "operating over dedicated high-speed local TCP/IP communication channels:"
    ))

    _bullet(doc, "Tier 1 — WebGL Simulation Client (Three.js / Vite, Port 3000):  ",
        "Executes the procedural three-dimensional urban synthesis, six-degree-of-freedom rigid-body "
        "quadrotor flight dynamics, synthetic sensor generation (IMU, GPS, Barometer, Magnetometer, "
        "Monocular Vision), real-time Error-State Kalman Filtering, and cinematic / onboard camera "
        "rendering.")

    _bullet(doc, "Tier 2 — GRU Learned Navigation Service (FastAPI / PyTorch, Port 8765):  ",
        "Receives sliding temporal sequences of 24 kinematic and geometric features over 101 "
        "historical timesteps, providing smooth velocity correction vectors (Δv) that optimise "
        "global trajectory tracking and compensate for nonlinear aerodynamic disturbances.")

    _bullet(doc, "Tier 3 — PULP-DroNet Obstacle Avoidance Service (FastAPI / PyTorch, Port 8766):  ",
        "Receives real-time 200 × 200 grayscale visual feeds from the UAV's forward-facing sensor "
        "camera, executing deep residual convolutional inference to output continuous steering "
        "commands and collision probability estimates in fewer than twelve milliseconds per frame.")

    _caption(doc, "Table 3.1: Functional Roles, Technology Stacks, and Interface Contracts of Each Microservice")

    # Table 3.1
    tbl1 = doc.add_table(rows=4, cols=5)
    headers1 = ["Service", "Port / Protocol", "Technology Stack", "Input → Output", "Latency Target"]
    data1 = [
        ("Simulation Engine",   "3000 (HTTP/WS)",  "Three.js, Vite, WebGL 2",  "Controls → 3D Scene & Sensor Data",      "60 FPS (≤ 16.6 ms)"),
        ("GRU Navigation AI",   "8765 (REST/JSON)", "FastAPI, PyTorch, NumPy",   "[101 × 24] Features → Δv (vx, vy, vz)", "< 15 ms"),
        ("PULP-DroNet AI",      "8766 (REST)",      "FastAPI, PyTorch, Pillow",  "200 × 200 Image → Steering α, P_coll",  "< 12 ms"),
    ]
    for j, h in enumerate(headers1):
        tbl1.rows[0].cells[j].paragraphs[0].text = h
    for i, row_data in enumerate(data1, 1):
        for j, val in enumerate(row_data):
            tbl1.rows[i].cells[j].paragraphs[0].text = val
    _format_table(tbl1, col_widths=[Cm(3.2), Cm(2.4), Cm(3.0), Cm(5.0), Cm(2.2)])
    _spacer(doc)

    # ════════════════════════════════════════════════════════════════════════
    # 3.3  Simulation Environment
    # ════════════════════════════════════════════════════════════════════════
    _heading(doc, "3.3  Simulation Environment and Three-Dimensional Urban Synthesis", level=2)

    _body(doc, (
        "A critical prerequisite for validating vision-based and neural-network navigation "
        "algorithms is a simulation environment that accurately reproduces the visual distribution "
        "and physical scale of modern metropolitan infrastructure. Low-fidelity block worlds suffer "
        "from an acute simulation-to-reality (sim-to-real) gap, causing deep visual models such as "
        "DroNet to fail completely when exposed to real-world textures, lighting variations, and "
        "geometric shadows. The simulation environment in this project combines procedural city "
        "synthesis with high-end Physically Based Rendering (PBR) and hardware-accelerated instanced "
        "three-dimensional asset streaming."
    ))

    _heading(doc, "3.3.1  Procedural City Generation and Spatial Zoning", level=3)

    _body(doc, (
        "The procedural generation pipeline divides the world space into structured Cartesian grids "
        "comprising diverse urban zones: (1) a Commercial Central Business District (CBD) characterised "
        "by dense skyscrapers ranging from 60 to 180 metres in height; (2) a mid-rise Residential Sector "
        "featuring brick, plaster, and concrete apartment blocks (20 to 45 metres); (3) an Industrial "
        "Zone with wide steel warehouses, oil tanks, and utility bridges; and (4) an Infrastructure and "
        "Transportation Network with multi-lane asphalt avenues, intersection crosswalks, sidewalk "
        "boundaries, and perimeter green spaces. Roads are mathematically indexed as spatial flight "
        "corridors with explicit waypoint sequences that allow the autonomous route controller to "
        "simulate corridor-constrained urban drone delivery missions."
    ))

    _heading(doc, "3.3.2  Physically Based Rendering (PBR) Material Architecture", level=3)

    _body(doc, (
        "To achieve visual realism without sacrificing real-time performance, the rendering engine "
        "utilises a standard Metallic-Roughness PBR material pipeline conforming to the microfacet "
        "Cook-Torrance specular reflectance model. Texture maps are loaded dynamically from the "
        "production asset library and assigned according to surface typology:"
    ))

    _bullet(doc, "Diffuse / Albedo Map (sRGB Colour Space):  ",
        "Encodes the base surface colour free of directional lighting and shadow information. "
        "Stored in sRGB space (THREE.SRGBColorSpace) to guarantee correct gamma correction across "
        "display devices.")

    _bullet(doc, "Normal Map (Linear Colour Space, Tangent-Space OpenGL):  ",
        "Encodes micro-surface perturbations—cracks in asphalt, mortar joints in brick, panel seams "
        "in concrete—using three-channel RGB vectors, enabling convincing specular highlights and "
        "surface relief without increasing vertex counts.")

    _bullet(doc, "Roughness and Metalness Maps (Linear Colour Space):  ",
        "Define microfacet distribution and electrical conductivity respectively. Road surfaces "
        "exhibit high roughness with specular water puddle appearance, while glass and metallic "
        "facades feature high specular reflectivity.")

    _bullet(doc, "Texture Wrapping and UV Repetition:  ",
        "Large structures utilise THREE.RepeatWrapping with proportional UV scaling factors "
        "calibrated to metric world coordinates (repeating road textures every 25 metres), "
        "eliminating both visual tiling patterns and blurred oversized textures.")

    _heading(doc, "3.3.3  Three-Dimensional GLB Asset Pipeline and Hardware-Accelerated Instancing", level=3)

    _body(doc, (
        "In addition to procedural geometry, the environment integrates a library of detailed "
        "three-dimensional assets in binary glTF format (.glb). These include realistic streetlights, "
        "traffic signals, road barriers, guardrails, bridges, rooftop air-conditioning chillers, "
        "satellite antennas, and multi-species urban vegetation. To prevent catastrophic GPU draw-call "
        "bottlenecks, repeated assets are rendered using THREE.InstancedMesh. A single GPU draw call "
        "renders thousands of trees and street props by feeding transformation matrices (position, "
        "rotation, scale) directly into vertex buffer attributes, maintaining sixty frames per second "
        "rendering speed across the full city environment."
    ))

    # ════════════════════════════════════════════════════════════════════════
    # 3.4  Error-State Extended Kalman Filter (ESKF)
    # ════════════════════════════════════════════════════════════════════════
    _heading(doc, "3.4  State Estimation: 15-State Error-State Extended Kalman Filter (ESKF)", level=2)

    _body(doc, (
        "Accurate state estimation is the bedrock of autonomous flight. In real-world quadrotors, "
        "raw Inertial Measurement Unit (IMU) sensors suffer from stochastic thermal drift, bias "
        "instability, and high-frequency vibration noise. Integrating raw accelerometer and gyroscope "
        "signals directly causes estimated position to diverge quadratically within seconds—a "
        "phenomenon known as dead-reckoning drift. To resolve this fundamental limitation, the "
        "navigation stack formulates a 15-State Error-State Extended Kalman Filter (ESKF)."
    ))

    _heading(doc, "3.4.1  State Vector Parameterisation and Lie Group Formulation", level=3)

    _body(doc, (
        "In standard Extended Kalman Filters (EKFs), attitude orientation is either parameterised "
        "by Euler angles—which suffer from mathematical singularities known as gimbal lock—or by "
        "four-dimensional unit quaternions, which require over-parameterised covariance matrices and "
        "suffer from covariance rank deficiency on the unit sphere S³. The Error-State formulation "
        "solves this elegantly by splitting the true kinematic state into a large-signal nominal "
        "state propagated by IMU integration, and a small-signal error state corrected by sensor "
        "measurements:"
    ))

    _equation_box(doc,
        "x_true  =  x_nom  ⊕  δx",
        "(3.1)")

    _body(doc,
        "The complete 15-dimensional state vector is partitioned as follows:", first_indent=Cm(0))

    _equation_box(doc,
        "x_nom  =  [ p,  v,  q,  b_a,  b_ω ]ᵀ   ∈  ℝ³ × ℝ³ × S³ × ℝ³ × ℝ³",
        "(3.2)")

    _equation_box(doc,
        "δx  =  [ δp,  δv,  δθ,  δb_a,  δb_ω ]ᵀ   ∈  ℝ¹⁵",
        "(3.3)")

    _body(doc, (
        "where p ∈ ℝ³ is three-dimensional position (m), v ∈ ℝ³ is velocity (m s⁻¹), "
        "q ∈ S³ is the unit quaternion encoding attitude, b_a ∈ ℝ³ is the accelerometer "
        "bias vector (m s⁻²), b_ω ∈ ℝ³ is the gyroscope bias vector (rad s⁻¹), and "
        "δθ ∈ ℝ³ is the minimal three-dimensional rotation vector in the tangent space "
        "of SO(3)—avoiding both gimbal lock and rank deficiency. Because the error state δx "
        "always remains near zero between measurement updates, its dynamics are strictly "
        "linear, eliminating the higher-order linearisation errors that degrade conventional EKFs."
    ))

    _heading(doc, "3.4.2  Continuous-Time Kinematics and IMU Propagation", level=3)

    _body(doc, (
        "Between sensor measurements, the nominal state is propagated forward at 100 Hz using "
        "raw IMU measurements—specific force a_m from the accelerometer and angular rate ω_m "
        "from the gyroscope—according to continuous-time rigid-body kinematics:"
    ))

    _equation_box(doc,  "dp/dt  =  v",                                "(3.4a)")
    _equation_box(doc,  "dv/dt  =  R(q) · (a_m − b_a) + g",          "(3.4b)")
    _equation_box(doc,  "dq/dt  =  ½ · q ⊗ (ω_m − b_ω)",            "(3.4c)")
    _equation_box(doc,  "db_a/dt  =  w_ba       (accelerometer bias random walk)",  "(3.4d)")
    _equation_box(doc,  "db_ω/dt  =  w_bω       (gyroscope bias random walk)",      "(3.4e)")

    _body(doc, (
        "Here R(q) ∈ SO(3) is the rotation matrix derived from the nominal quaternion q, "
        "g = [0, 0, −9.81]ᵀ m s⁻² is the gravitational acceleration vector, and w_ba, w_bω "
        "are zero-mean Gaussian process noise terms. Simultaneously, the 15 × 15 error "
        "covariance matrix P is propagated in discrete time:"
    ))

    _equation_box(doc,
        "P_{k|k−1}  =  Φ_k · P_{k−1} · Φ_kᵀ  +  Q_d",
        "(3.5)")

    _equation_box(doc,
        "Φ_k  ≈  I₁₅  +  F_x · Δt",
        "(3.6)")

    _body(doc, (
        "where F_x is the linearised error dynamics matrix capturing cross-coupling between "
        "error states—specifically, accelerometer errors couple into velocity through the "
        "rotation matrix R(q), and attitude errors couple into velocity through the "
        "skew-symmetric matrix of the corrected specific force [a_m − b_a]×. Q_d is the "
        "discrete-time process noise covariance derived from IMU noise spectral density parameters."
    ))

    _heading(doc, "3.4.3  Multi-Sensor Measurement Update and Error Injection", level=3)

    _body(doc, (
        "When discrete sensor measurements arrive asynchronously, the filter executes a standard "
        "Kalman correction step. Three external sensors provide independent measurement updates:"
    ))

    _bullet(doc, "GPS Position and Velocity (10 Hz):  ",
        "Updates δp (position error) and δv (velocity error) with measurement noise covariance R_GPS.")
    _bullet(doc, "Barometric Altimeter (20 Hz):  ",
        "Updates the vertical position error component δp_z with high vertical precision "
        "(σ_baro ≈ 0.2 m), compensating for GPS vertical inaccuracy.")
    _bullet(doc, "Three-Axis Magnetometer (25 Hz):  ",
        "Corrects heading yaw drift around the gravity vector by measuring the Earth's "
        "magnetic field direction, providing the linearised attitude heading error δθ_z.")

    _body(doc, "The optimal Kalman gain matrix K ∈ ℝ¹⁵ˣⁿ is computed as:", first_indent=Cm(0))

    _equation_box(doc,
        "K  =  P_{k|k−1} · Hᵀ · ( H · P_{k|k−1} · Hᵀ  +  R )⁻¹",
        "(3.7)")

    _body(doc, "The optimal error state correction is then:", first_indent=Cm(0))

    _equation_box(doc,
        "δx̂  =  K · ( y  −  h( x_nom ) )",
        "(3.8)")

    _body(doc, (
        "where y is the measurement vector, h(·) is the nonlinear measurement function, and "
        "H = ∂h/∂δx is its Jacobian with respect to the error state. "
        "The estimated error δx̂ is injected back into the nominal state:"
    ))

    _equation_box(doc,  "p  ←  p + δp̂",                              "(3.9a)")
    _equation_box(doc,  "v  ←  v + δv̂",                              "(3.9b)")
    _equation_box(doc,  "q  ←  q ⊗ exp( ½ · δθ̂ )",                  "(3.9c)")
    _equation_box(doc,  "b_a  ←  b_a + δb̂_a",                       "(3.9d)")
    _equation_box(doc,  "b_ω  ←  b_ω + δb̂_ω",                       "(3.9e)")

    _body(doc, (
        "Following error injection, the error state is mathematically reset to zero: "
        "δx ← 0, and the covariance is updated via the Joseph form for numerical stability:"
    ))

    _equation_box(doc,
        "P  ←  ( I − K · H ) · P_{k|k−1} · ( I − K · H )ᵀ  +  K · R · Kᵀ",
        "(3.10)")

    # ════════════════════════════════════════════════════════════════════════
    # 3.5  GRU v3 Learned Navigation Model
    # ════════════════════════════════════════════════════════════════════════
    _heading(doc, "3.5  Gated Recurrent Unit (GRU v3) Learned Navigation Model", level=2)

    _body(doc, (
        "Classical linear controllers—such as cascaded PID loops—perform adequately in calm, "
        "structured air environments, but struggle severely when navigating high-speed trajectories "
        "through urban corridors where aerodynamic drag, rotor downwash, building wake vortices, "
        "and actuator delays induce non-negligible tracking errors. The GRU v3 Learned Navigation "
        "Model acts as an intelligent predictive guidance layer that continuously adapts the "
        "quadrotor's velocity commands based on its temporal flight history."
    ))

    _heading(doc, "3.5.1  Temporal Feature Buffer Formulation (101 × 24)", level=3)

    _body(doc, (
        "At each simulation step, the navigation system captures a 24-dimensional feature vector "
        "encoding the UAV's complete kinematic state and trajectory context, then appends it to a "
        "historical sliding-window buffer spanning T = 101 consecutive timesteps (approximately "
        "2.0 seconds of flight history at 50 Hz). Table 3.2 details the precise mathematical "
        "ordering and physical semantics of these 24 features:"
    ))

    _caption(doc, "Table 3.2: 24-Dimensional Feature Vector — Ordering, Categories, and Physical Semantics")

    tbl2 = doc.add_table(rows=8, cols=4)
    headers2 = ["Feature Indices", "Category", "Variable Names", "Physical Description"]
    data2 = [
        ("0 – 2",   "Relative Position",    "dx, dy, dz",             "Vector from current ESKF position to target waypoint (m)"),
        ("3 – 5",   "ESKF Velocity",         "vx, vy, vz",             "Filtered 3-D velocity vector in world frame (m s⁻¹)"),
        ("6 – 9",   "Attitude Quaternion",   "qw, qx, qy, qz",        "Estimated orientation quaternion on S³ unit sphere"),
        ("10 – 12", "Angular Velocity",      "ωx, ωy, ωz",             "Filtered body-frame rotational rates (rad s⁻¹)"),
        ("13 – 15", "Linear Acceleration",   "ax, ay, az",             "Body-frame linear acceleration, gravity removed (m s⁻²)"),
        ("16 – 19", "Tracking Metrics",      "dist, CTE, ATE, speed",  "Target distance, cross-track and along-track errors, speed"),
        ("20 – 23", "Control History",       "cmd_vx, cmd_vy, cmd_vz, ψ̇", "Preceding velocity commands and yaw rate dispatched (m s⁻¹, rad s⁻¹)"),
    ]
    for j, h in enumerate(headers2):
        tbl2.rows[0].cells[j].paragraphs[0].text = h
    for i, row_data in enumerate(data2, 1):
        for j, val in enumerate(row_data):
            tbl2.rows[i].cells[j].paragraphs[0].text = val
    _format_table(tbl2, col_widths=[Cm(2.2), Cm(2.8), Cm(3.0), Cm(7.8)])
    _spacer(doc)

    _heading(doc, "3.5.2  Gated Recurrent Unit Architecture and Gating Mechanism", level=3)

    _body(doc, (
        "Standard Recurrent Neural Networks (RNNs) suffer from vanishing and exploding gradients "
        "when processing long sequences, causing them to forget relevant flight history beyond a "
        "few timesteps. While Long Short-Term Memory (LSTM) networks resolve this with three "
        "gates, the Gated Recurrent Unit (GRU) achieves comparable representational power with "
        "only two gates—the Reset Gate and the Update Gate—reducing the parameter count by "
        "approximately 25% and enabling ultra-low-latency inference. The GRU internal recurrence "
        "mechanics at timestep t are defined as:"
    ))

    _equation_box(doc,
        "r_t  =  σ( W_r · x_t  +  U_r · h_{t−1}  +  b_r )",
        "(3.11)  Reset Gate")

    _equation_box(doc,
        "z_t  =  σ( W_z · x_t  +  U_z · h_{t−1}  +  b_z )",
        "(3.12)  Update Gate")

    _equation_box(doc,
        "h̃_t  =  tanh( W_h · x_t  +  U_h · ( r_t ⊙ h_{t−1} )  +  b_h )",
        "(3.13)  Candidate Hidden State")

    _equation_box(doc,
        "h_t  =  ( 1 − z_t ) ⊙ h_{t−1}  +  z_t ⊙ h̃_t",
        "(3.14)  Hidden State Update")

    _body(doc, (
        "where σ(·) denotes the sigmoid activation function, ⊙ is the element-wise Hadamard "
        "product, and h_t ∈ ℝ¹²⁸ encodes the accumulated spatio-temporal aerodynamic state "
        "of the quadrotor. The final hidden state h₁₀₁ is projected through a fully connected "
        "multi-layer perceptron (Linear(128, 64) → ReLU → Dropout(0.1) → Linear(64, 3)) to "
        "produce the three-dimensional velocity correction vector:"
    ))

    _equation_box(doc,
        "Δv  =  [ Δv_x,  Δv_y,  Δv_z ]ᵀ  =  MLP( h₁₀₁ )",
        "(3.15)")

    _body(doc, (
        "This correction is summed with the nominal kinematic waypoint guidance velocity: "
        "v_guidance = v_nominal + Δv, effectively compensating for cross-track drift, "
        "momentum overshoot, and wind-induced track deviation."
    ))

    # ════════════════════════════════════════════════════════════════════════
    # 3.6  PULP-DroNet v3
    # ════════════════════════════════════════════════════════════════════════
    _heading(doc, "3.6  PULP-DroNet v3 Deep Vision Obstacle Avoidance Model", level=2)

    _body(doc, (
        "While the 15-state ESKF and GRU model ensure precision following of pre-planned global "
        "waypoints, real-world urban flight inevitably encounters unmapped, dynamic, or sudden "
        "obstacles—construction scaffolding, cranes, fallen trees, utility cables, and other "
        "aerial vehicles. The PULP-DroNet v3 deep vision model serves as the UAV's reactive "
        "obstacle avoidance cortex, inspired by the DroNet architecture tailored for micro-aerial "
        "vehicles operating on Parallel Ultra-Low-Power (PULP) embedded computing."
    ))

    _heading(doc, "3.6.1  Monocular Synthetic Sensor Camera Pipeline", level=3)

    _body(doc, (
        "The simulation pipeline renders a dedicated forward-facing monocular sensor viewport "
        "rigidly mounted to the UAV's front airframe. The sensor camera operates at an effective "
        "resolution of 200 × 200 pixels in eight-bit grayscale format with a 75-degree horizontal "
        "Field of View (FoV). Grayscale conversion suppresses distracting colour variations while "
        "preserving structural edge contrast critical for obstacle detection. Pixel intensities are "
        "normalised to the floating-point range [0.0, 1.0] and packaged into a PyTorch input "
        "tensor of shape [1, 1, 200, 200]."
    ))

    _heading(doc, "3.6.2  Deep Residual Architecture (ResBlock-1.0)", level=3)

    _body(doc, (
        "PULP-DroNet v3 utilises a lightweight Residual Convolutional Neural Network (CNN) designed "
        "to extract multi-scale spatial features without the prohibitive computational burden of "
        "full-scale networks such as ResNet-50. The architecture consists of an initial strided "
        "convolution stem followed by three cascading Residual Blocks with identity and projection "
        "skip connections. Table 3.3 summarises the complete layer-wise topology:"
    ))

    _caption(doc, "Table 3.3: PULP-DroNet v3 Layer-Wise Architecture (Input: 1 × 200 × 200)")

    tbl3 = doc.add_table(rows=7, cols=5)
    headers3 = ["Stage", "Kernel / Stride", "Output Shape", "Activation", "Functionality"]
    data3 = [
        ("Input",       "—",              "1 × 200 × 200",  "—",              "Normalised monocular grayscale feed"),
        ("Conv Stem",   "5 × 5, s = 2 + MaxPool 2 × 2", "32 × 50 × 50", "ReLU",  "Low-level edge and gradient features"),
        ("ResBlock 1",  "3 × 3, s = 1 (×2)", "32 × 50 × 50", "ReLU + Add",  "Surface texture and boundary details"),
        ("ResBlock 2",  "3 × 3, s = 2 (×2)", "64 × 25 × 25", "ReLU + Conv Skip", "Spatial downsampling, obstacle profiles"),
        ("ResBlock 3",  "3 × 3, s = 2 (×2)", "128 × 13 × 13","ReLU + Conv Skip", "High-level corridor geometry"),
        ("Dual FC Head","FC(128) → two heads","α: scalar | P_coll: scalar","Linear / Sigmoid","Steering angle and collision risk"),
    ]
    for j, h in enumerate(headers3):
        tbl3.rows[0].cells[j].paragraphs[0].text = h
    for i, row_data in enumerate(data3, 1):
        for j, val in enumerate(row_data):
            tbl3.rows[i].cells[j].paragraphs[0].text = val
    _format_table(tbl3, col_widths=[Cm(2.2), Cm(3.4), Cm(2.8), Cm(2.4), Cm(4.0)])
    _spacer(doc)

    _heading(doc, "3.6.3  Dual-Head Output and Multi-Task Loss Formulation", level=3)

    _body(doc, (
        "A defining strength of DroNet is its unified dual-head prediction architecture. Unlike "
        "standard object detectors that require complex bounding-box post-processing pipelines, "
        "DroNet directly outputs two compact, immediately actionable flight navigation variables:"
    ))

    _bullet(doc, "Steering Angle Head  α ∈ [−1.0, +1.0]:  ",
        "A continuous regression output predicting normalised lateral steering offset. "
        "α = 0 corresponds to straight flight; negative values command left evasion; "
        "positive values command right evasion relative to the current heading.")

    _bullet(doc, "Collision Probability Head  P_coll ∈ [0.0, 1.0]:  ",
        "A sigmoidal probability output predicting the likelihood of impending collision "
        "within a 15-metre forward stopping horizon. P_coll < 0.3 indicates a clear "
        "corridor; P_coll > 0.7 indicates immediate collision danger.")

    _body(doc, "The model is trained with a multi-task loss function:", first_indent=Cm(0))

    _equation_box(doc,
        "ℒ_total  =  ℒ_MSE( α,  α̂ )  +  λ · ℒ_BCE( P_coll,  P̂_coll )",
        "(3.16)")

    _body(doc, (
        "where ℒ_MSE is Mean Squared Error applied to the continuous steering angle regression, "
        "ℒ_BCE is Binary Cross-Entropy applied to the binary collision label, and λ = 1.0 is "
        "a balancing hyperparameter that ensures equal gradient propagation across both output "
        "heads during training."
    ))

    # ════════════════════════════════════════════════════════════════════════
    # 3.7  Interconnection and Hybrid Control
    # ════════════════════════════════════════════════════════════════════════
    _heading(doc, "3.7  Model Interconnection and Hybrid Control Arbitration", level=2)

    _body(doc, (
        "A central innovation of this project is the hierarchical interconnection and dynamic "
        "arbitration between the 15-state ESKF, the GRU learned navigation model, and the "
        "PULP-DroNet visual obstacle avoidance network. The following description outlines the "
        "complete inter-model control topology:"
    ))

    _body(doc, (
        "At each control cycle, the ESKF outputs the filtered kinematic state [p, v, q, b_a, b_ω]. "
        "This state is used to construct the 24-dimensional feature vector, which—together with "
        "its 101-step history—is transmitted asynchronously to the GRU service (Port 8765). The "
        "GRU service returns the velocity correction Δv, which is added to the nominal waypoint "
        "guidance velocity to form the planned command v_GRU. Concurrently, the forward sensor "
        "camera renders a 200 × 200 grayscale frame that is transmitted to the DroNet service "
        "(Port 8766), which returns steering angle α and collision probability P_coll. The "
        "Hybrid Control Arbitrator then blends these two signals according to:"
    ))

    _equation_box(doc,
        "v_cmd  =  ( 1 − w_avoid ) · v_GRU  +  w_avoid · v_avoid( α )",
        "(3.17)")

    _body(doc, (
        "where the avoidance weight w_avoid ∈ [0, 1] transitions continuously through three "
        "operating regimes based on the instantaneous collision probability P_coll:"
    ))

    _bullet(doc, "Regime 1 — Free Corridor Flight  (P_coll < 0.30):  ",
        "The avoidance weight w_avoid = 0. The quadrotor executes nominal waypoint navigation "
        "governed entirely by the GRU model: v_cmd = v_GRU.")

    _bullet(doc, "Regime 2 — Active Blended Avoidance  (0.30 ≤ P_coll < 0.75):  ",
        "A proximate obstacle has been detected. The avoidance weight scales smoothly as "
        "w_avoid = (P_coll − 0.30) / (0.75 − 0.30). The guidance vector is rotated laterally "
        "by a component proportional to DroNet's steering angle: "
        "v_avoid = v_nominal + k_steer · α · n̂_lat.")

    _bullet(doc, "Regime 3 — Emergency Critical Braking  (P_coll ≥ 0.75):  ",
        "The obstacle is inside the emergency safety bubble. The arbitrator overrides all "
        "waypoint guidance (w_avoid = 1.0): forward velocity is actively braked to zero, "
        "a maximum lateral evasion thrust is commanded in direction sign(α), and an emergency "
        "vertical climb of Δv_z = +2.5 m s⁻¹ is initiated until P_coll falls below the "
        "recovery threshold of 0.30.")

    # ════════════════════════════════════════════════════════════════════════
    # 3.8  Project Execution and Deployment Guide
    # ════════════════════════════════════════════════════════════════════════
    _heading(doc, "3.8  Project Execution and Deployment Guide", level=2)

    _body(doc, (
        "To ensure complete reproducibility and straightforward deployment on any workstation, "
        "the project is containerised into standardised Node.js and Python microservices with "
        "unified launch scripts. The following subsections describe all prerequisites and "
        "step-by-step procedures."
    ))

    _heading(doc, "3.8.1  Hardware and Software Prerequisites", level=3)

    _bullet(doc, "Operating System:  ", "Windows 10 / 11, Ubuntu 22.04 LTS, or macOS (Apple Silicon or Intel).")
    _bullet(doc, "Runtime Environments:  ", "Node.js version 18.0 or higher and Python version 3.10 or 3.11.")
    _bullet(doc, "Python Libraries:  ", "PyTorch (≥ 2.2.0), FastAPI (≥ 0.115.0), Uvicorn (≥ 0.30.0), NumPy (≥ 1.26.0), Pillow (≥ 10.0.0), Pydantic (≥ 2.0.0).")
    _bullet(doc, "Node.js Libraries:  ", "Three.js (≥ 0.170.0), Vite (≥ 6.0.0).")
    _bullet(doc, "GPU Acceleration:  ", "A dedicated NVIDIA GPU with CUDA 12.x is strongly recommended. CPU inference fallback is automatically supported.")
    _bullet(doc, "Web Browser:  ", "Google Chrome (v120+), Microsoft Edge (v120+), or Mozilla Firefox (v121+) with WebGL 2 support.")

    _heading(doc, "3.8.2  Repository Structure", level=3)

    _bullet(doc, "src/:  ", "Core Three.js simulation modules (DronePhysics.js, ESKF.js, RouteController.js, CityGenerator.js, WeatherSystem.js).")
    _bullet(doc, "public/materials/:  ", "Photorealistic PBR texture maps and binary glTF (.glb) urban models.")
    _bullet(doc, "GRU MODEL/:  ", "PyTorch GRU v3 implementation (model_runtime.py, server_fastapi.py) with pre-trained weights.")
    _bullet(doc, "dronet_service/:  ", "PULP-DroNet v3 PyTorch model (dronet_model.py, server.py) and ResBlock-1.0 weights.")
    _bullet(doc, "run_simulation.bat:  ", "One-click Windows launcher that configures environments and starts all services automatically.")
    _bullet(doc, "requirements.txt:  ", "Python dependency specification file for all AI model services.")

    _heading(doc, "3.8.3  Method 1: One-Click Automated Launch (Windows)", level=3)

    _body(doc, (
        "On any Windows workstation, the complete simulation stack—three-dimensional city, "
        "GRU navigation model, and DroNet obstacle avoidance—can be launched in a single step:"
    ))

    _bullet(doc, "Step 1:  ", "Clone or download the repository from https://github.com/sarialbasha3-pixel/drone-city-simulation.")
    _bullet(doc, "Step 2:  ", "Open the project root folder in Windows Explorer.")
    _bullet(doc, "Step 3:  ", "Double-click run_simulation.bat, or execute .\\run_simulation.bat in PowerShell.")
    _bullet(doc, "Automatic:  ",
        "The batch launcher checks for Node.js modules (running npm install if absent), creates a "
        "Python virtual environment (.venv) and installs requirements.txt if needed, launches both "
        "FastAPI microservices in titled background consoles (Ports 8765 and 8766), starts the Vite "
        "development server on port 3000, and automatically opens the simulation in the default browser.")

    _heading(doc, "3.8.4  Method 2: Manual Multi-Terminal Startup (Cross-Platform)", level=3)

    _body(doc, "For Linux, macOS, or advanced debugging, the services are initialised manually across three terminal sessions:", first_indent=Cm(0))

    for cmd_text in [
        "Step 1 — Install dependencies (once only):\n    npm install\n    python -m venv .venv\n    .venv/Scripts/pip install -r requirements.txt",
        "Step 2 — Terminal A: Launch GRU Navigation AI:\n    python -m uvicorn server_fastapi:app --app-dir \"GRU MODEL\" --host 127.0.0.1 --port 8765",
        "Step 3 — Terminal B: Launch PULP-DroNet Vision AI:\n    python -m uvicorn server:app --app-dir dronet_service --host 127.0.0.1 --port 8766",
        "Step 4 — Terminal C: Launch Three.js Simulation:\n    npx vite --host --port 3000",
        "Step 5 — Open http://localhost:3000 in Chrome / Edge / Firefox.",
    ]:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(1.0)
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after  = Pt(4)
        p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
        r = p.add_run(cmd_text)
        r.font.name      = "Courier New"
        r.font.size      = Pt(9.5)
        r.font.color.rgb = BLACK

    _heading(doc, "3.8.5  Service Health Verification and Telemetry Validation", level=3)

    _body(doc, (
        "Once all three services are active, the analyst can verify operational status using the "
        "built-in REST health endpoints before beginning flight experiments:"
    ))

    _bullet(doc, "GRU Service:  ", "Visit http://127.0.0.1:8765/health → Returns {\"ok\": true, \"model\": \"Project Ghost GRU V3\", \"input_shape\": [101, 24]}.")
    _bullet(doc, "DroNet Service:  ", "Visit http://127.0.0.1:8766/health → Returns {\"ok\": true, \"model\": \"PULP-DroNet v3 (ResBlock-1.0)\", \"device\": \"cuda\" or \"cpu\"}.")
    _bullet(doc, "Simulation HUD:  ", "The top-right telemetry overlay in the Three.js viewport displays live green 'AI CONNECTED' status indicators for both models.")

    # ════════════════════════════════════════════════════════════════════════
    # 3.9  Summary
    # ════════════════════════════════════════════════════════════════════════
    _heading(doc, "3.9  Chapter Summary", level=2)

    _body(doc, (
        "This chapter has established the comprehensive architectural and methodological foundation "
        "of the autonomous urban drone navigation system. A modular, decoupled microservices framework "
        "was formulated that unites photorealistic three-dimensional urban simulation with real-time "
        "state estimation and multi-tiered artificial intelligence. The specific contributions of "
        "this chapter are summarised as follows:"
    ))

    _bullet(doc, "Photorealistic Simulation Environment:  ",
        "Leverages procedural generation, PBR Metallic-Roughness materials, and GPU-instanced "
        "three-dimensional assets to create visually realistic, performance-optimised urban flight corridors.")

    _bullet(doc, "15-State Error-State Extended Kalman Filter (ESKF):  ",
        "Provides singularity-free, minimal-parameter state estimation on the SO(3) Lie group by "
        "propagating nominal kinematics at 100 Hz and correcting 15 error states using asynchronous "
        "multi-sensor updates from GPS, barometer, and magnetometer.")

    _bullet(doc, "GRU v3 Learned Navigation Model:  ",
        "Ingests a 101 × 24 historical feature tensor through a two-gate recurrent architecture "
        "to predict smooth velocity adjustments Δv that compensate for dynamic aerodynamic disturbances, "
        "momentum overshoot, and path curvature.")

    _bullet(doc, "PULP-DroNet v3 Deep Vision Model:  ",
        "Processes monocular 200 × 200 grayscale sensor feeds through three cascading Residual "
        "Convolutional Blocks, outputting continuous steering angles and sigmoidal collision "
        "hazard probabilities in fewer than 12 ms.")

    _bullet(doc, "Hybrid Control Arbitration:  ",
        "Harmonises global route guidance and reactive visual avoidance through a mathematically "
        "grounded arbitration matrix, transitioning continuously between free flight, active "
        "blended avoidance, and emergency critical braking according to the instantaneous DroNet "
        "collision probability P_coll.")

    _body(doc, (
        "With the system architecture and theoretical methodology thoroughly formalised, "
        "Chapter Four presents the experimental setup, trajectory tracking performance metrics, "
        "obstacle avoidance benchmarks, and comparative performance analyses conducted under "
        "varied weather conditions and synthetic sensor noise profiles."
    ))

    # ────────────────────────────────────────────────────────────────────────
    # Save
    # ────────────────────────────────────────────────────────────────────────
    out = r"D:\G-P\Chapter_3_Final_Formatted.docx"
    doc.save(out)
    print("[SUCCESS] Saved to: " + out)
    return out


if __name__ == "__main__":
    build()
