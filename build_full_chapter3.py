"""
build_full_chapter3.py
Assembles Chapter_3_Methodology.docx with complete technical depth across sections 3.1 to 3.12.
"""

import os
import sys
import shutil
import docx
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

FONT_EN = "Times New Roman"
BLACK = RGBColor(0, 0, 0)

SZ_CHAP = Pt(18)
SZ_H2 = Pt(14)
SZ_H3 = Pt(12)
SZ_BODY = Pt(12)
SZ_TABLE = Pt(9.5)
SZ_CAPTION = Pt(10)

def page_setup(doc):
    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.0)
        section.top_margin = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.gutter = Cm(0)

def add_footer_page_number(doc):
    for section in doc.sections:
        footer = section.footer
        for p in footer.paragraphs:
            for r in p.runs:
                r.clear()
        fp = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fp.paragraph_format.space_before = Pt(0)
        fp.paragraph_format.space_after = Pt(0)

        run = fp.add_run()
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

def format_table(table, col_widths=None):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    tblPr = table._tbl.tblPr
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
            tcPr = cell._tc.get_or_add_tcPr()
            tcMar = parse_xml(
                f'<w:tcMar {nsdecls("w")}>'
                f'<w:top w:w="80" w:type="dxa"/>'
                f'<w:bottom w:w="80" w:type="dxa"/>'
                f'<w:left w:w="120" w:type="dxa"/>'
                f'<w:right w:w="120" w:type="dxa"/>'
                f'</w:tcMar>'
            )
            tcPr.append(tcMar)

            for p in cell.paragraphs:
                pf = p.paragraph_format
                pf.space_before = Pt(2)
                pf.space_after = Pt(2)
                pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
                for run in p.runs:
                    run.font.name = FONT_EN
                    run.font.size = SZ_TABLE
                    run.font.color.rgb = BLACK
                    if r_idx == 0:
                        run.bold = True

            if r_idx == 0:
                shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="E2E8F0" w:val="clear"/>')
                tcPr.append(shd)

def add_heading_2(doc, text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before = Pt(18)
    pf.space_after = Pt(6)
    pf.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.underline = True
    r.font.name = FONT_EN
    r.font.size = SZ_H2
    r.font.color.rgb = BLACK
    return p

def add_heading_3(doc, text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before = Pt(12)
    pf.space_after = Pt(4)
    pf.keep_with_next = True
    r = p.add_run(text)
    r.bold = True
    r.font.name = FONT_EN
    r.font.size = SZ_H3
    r.font.color.rgb = BLACK
    return p

def add_body(doc, text="", first_indent=Cm(1.25)):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before = Pt(0)
    pf.space_after = Pt(6)
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf.first_line_indent = first_indent
    if text:
        r = p.add_run(text)
        r.font.name = FONT_EN
        r.font.size = SZ_BODY
        r.font.color.rgb = BLACK
    return p

def add_bullet(doc, bold_prefix, text, indent=Cm(0.8)):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before = Pt(0)
    pf.space_after = Pt(4)
    pf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pf.left_indent = indent
    pf.first_line_indent = Cm(-0.4)
    rb = p.add_run(bold_prefix)
    rb.bold = True
    rb.font.name = FONT_EN
    rb.font.size = SZ_BODY
    rb.font.color.rgb = BLACK
    rt = p.add_run(text)
    rt.font.name = FONT_EN
    rt.font.size = SZ_BODY
    rt.font.color.rgb = BLACK
    return p

def add_equation(doc, eq_text, eq_number=""):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before = Pt(6)
    pf.space_after = Pt(6)
    pf.alignment = WD_ALIGN_PARAGRAPH.CENTER

    r = p.add_run(eq_text)
    r.font.name = FONT_EN
    r.font.size = Pt(11)
    r.font.color.rgb = BLACK

    if eq_number:
        r_num = p.add_run(f"       {eq_number}")
        r_num.font.name = FONT_EN
        r_num.font.size = Pt(11)
        r_num.font.bold = True
        r_num.font.color.rgb = BLACK

    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    for side in ("top", "bottom", "left", "right"):
        bd = OxmlElement(f"w:{side}")
        bd.set(qn("w:val"), "single")
        bd.set(qn("w:sz"), "4")
        bd.set(qn("w:space"), "4")
        bd.set(qn("w:color"), "CCCCCC")
        pBdr.append(bd)
    pPr.append(pBdr)
    return p

def add_caption(doc, text):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pf.space_before = Pt(4)
    pf.space_after = Pt(8)
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    r = p.add_run(text)
    r.bold = True
    r.italic = True
    r.font.name = FONT_EN
    r.font.size = SZ_CAPTION
    r.font.color.rgb = BLACK
    return p

def add_figure(doc, img_path, caption_text):
    if os.path.exists(img_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(2)
        run = p_img.add_run()
        run.add_picture(img_path, width=Cm(15.5))
        add_caption(doc, caption_text)
    else:
        print(f"Warning: Image path not found: {img_path}")

print("build_full_chapter3.py ready to populate.")
