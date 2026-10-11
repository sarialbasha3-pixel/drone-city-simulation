"""
assemble_chapter3_methodology.py
================================
Master script that imports all modular section builders, configures the
academic Word document according to all university specifications,
and outputs Chapter_3_Methodology.docx.
"""

import os
import sys
import shutil
import docx
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING

from build_full_chapter3 import (
    FONT_EN, BLACK, SZ_CHAP, SZ_H2, SZ_H3, SZ_BODY,
    page_setup, add_footer_page_number
)

from section_3_1_to_3_3 import (
    add_chapter_header, build_section_3_1, build_section_3_2, build_section_3_3
)
from section_3_4_to_3_6 import (
    build_section_3_4, build_section_3_5, build_section_3_6
)
from section_3_7_to_3_9 import (
    build_section_3_7, build_section_3_8, build_section_3_9
)
from section_3_10_to_3_12 import (
    build_section_3_10, build_section_3_11, build_section_3_12
)

def assemble():
    print("[1/5] Initializing Document and applying styles...")
    doc = Document()

    # Normal Style configuration
    style = doc.styles["Normal"]
    style.font.name = FONT_EN
    style.font.size = SZ_BODY
    style.font.color.rgb = BLACK
    style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE

    # Page setup and margins
    page_setup(doc)

    # Footer page numbering
    add_footer_page_number(doc)

    print("[2/5] Building Chapter Header and Sections 3.1 to 3.3...")
    add_chapter_header(doc)
    build_section_3_1(doc)
    build_section_3_2(doc)
    build_section_3_3(doc)

    print("[3/5] Building Sections 3.4 to 3.6...")
    build_section_3_4(doc)
    build_section_3_5(doc)
    build_section_3_6(doc)

    print("[4/5] Building Sections 3.7 to 3.9 (including figures)...")
    build_section_3_7(doc)
    build_section_3_8(doc)
    build_section_3_9(doc)

    print("[5/5] Building Sections 3.10 to 3.12...")
    build_section_3_10(doc)
    build_section_3_11(doc)
    build_section_3_12(doc)

    # Output paths
    out_path_1 = r"D:\G-P\Chapter_3_Methodology.docx"
    doc.save(out_path_1)
    print(f"[SUCCESS] Saved primary document to: {out_path_1}")

    # Copy to Arabic workspace directory if present
    arabic_dir = r"D:\مشروووووووع التخرجججج"
    if os.path.exists(arabic_dir):
        out_path_2 = os.path.join(arabic_dir, "Chapter_3_Methodology.docx")
        shutil.copy2(out_path_1, out_path_2)
        print("[SUCCESS] Copied document to Arabic graduation folder.")

    return out_path_1

if __name__ == "__main__":
    assemble()
