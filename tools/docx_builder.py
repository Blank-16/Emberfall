import os
import sys
import zipfile
import xml.sax.saxutils

def escape(s):
    return xml.sax.saxutils.escape(str(s))

class DocxBuilder:
    def __init__(self, filename):
        self.filename = filename
        self.paragraphs = []
        self.page_count = 1

    def add_page_break(self):
        self.paragraphs.append('<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>')
        self.page_count += 1

    def add_title(self, title, subtitle=None):
        xml = ['<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="720" w:after="240"/></w:pPr>']
        xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="52"/><w:color w:val="1B365D"/></w:rPr>')
        xml.append(f'<w:t>{escape(title)}</w:t></w:r></w:p>')
        if subtitle:
            xml.append('<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="480"/></w:pPr>')
            xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:i/><w:sz w:val="28"/><w:color w:val="4A607A"/></w:rPr>')
            xml.append(f'<w:t>{escape(subtitle)}</w:t></w:r></w:p>')
        self.paragraphs.append("".join(xml))

    def add_meta_block(self, lines):
        xml = ['<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="480"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="8" w:color="CCCCCC"/></w:pBdr></w:pPr>']
        for line in lines:
            xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/><w:color w:val="555555"/></w:rPr>')
            xml.append(f'<w:t>{escape(line)}</w:t><w:br/></w:r>')
        xml.append('</w:p>')
        self.paragraphs.append("".join(xml))

    def add_heading_1(self, text):
        xml = ['<w:p><w:pPr><w:spacing w:before="360" w:after="160"/><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="6" w:color="1B365D"/></w:pBdr></w:pPr>']
        xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="34"/><w:color w:val="1B365D"/></w:rPr>')
        xml.append(f'<w:t>{escape(text)}</w:t></w:r></w:p>')
        self.paragraphs.append("".join(xml))

    def add_heading_2(self, text):
        xml = ['<w:p><w:pPr><w:spacing w:before="260" w:after="120"/></w:pPr>']
        xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="26"/><w:color w:val="2B4C7E"/></w:rPr>')
        xml.append(f'<w:t>{escape(text)}</w:t></w:r></w:p>')
        self.paragraphs.append("".join(xml))

    def add_heading_3(self, text):
        xml = ['<w:p><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>']
        xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:i/><w:sz w:val="22"/><w:color w:val="333333"/></w:rPr>')
        xml.append(f'<w:t>{escape(text)}</w:t></w:r></w:p>')
        self.paragraphs.append("".join(xml))

    def add_paragraph(self, text, bold_prefix=None, indent=False):
        xml = ['<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto" w:after="120"/>']
        if indent:
            xml.append('<w:ind w:left="360"/>')
        xml.append('</w:pPr>')
        if bold_prefix:
            xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="22"/><w:color w:val="1B365D"/></w:rPr>')
            xml.append(f'<w:t xml:space="preserve">{escape(bold_prefix)} </w:t></w:r>')
        xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="222222"/></w:rPr>')
        xml.append(f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')
        self.paragraphs.append("".join(xml))

    def add_bullet(self, bold_prefix, text):
        xml = ['<w:p><w:pPr><w:spacing w:line="260" w:lineRule="auto" w:after="80"/><w:ind w:left="480" w:hanging="240"/></w:pPr>']
        xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="1B365D"/></w:rPr>')
        xml.append('<w:t xml:space="preserve">&#8226; </w:t></w:r>')
        if bold_prefix:
            xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="22"/><w:color w:val="2B4C7E"/></w:rPr>')
            xml.append(f'<w:t xml:space="preserve">{escape(bold_prefix)}: </w:t></w:r>')
        xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="222222"/></w:rPr>')
        xml.append(f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')
        self.paragraphs.append("".join(xml))

    def add_callout(self, text, title=None):
        xml = ['<w:p><w:pPr><w:spacing w:line="260" w:lineRule="auto" w:before="140" w:after="160"/>']
        xml.append('<w:ind w:left="480" w:right="240"/>')
        xml.append('<w:pBdr><w:left w:val="single" w:sz="24" w:space="12" w:color="1B365D"/></w:pBdr>')
        xml.append('<w:shd w:val="clear" w:color="auto" w:fill="F0F4F8"/>')
        xml.append('</w:pPr>')
        if title:
            xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="20"/><w:color w:val="1B365D"/></w:rPr>')
            xml.append(f'<w:t xml:space="preserve">{escape(title)}: </w:t></w:r>')
        xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:i/><w:sz w:val="20"/><w:color w:val="333333"/></w:rPr>')
        xml.append(f'<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>')
        self.paragraphs.append("".join(xml))

    def add_code_block(self, lines, caption=None):
        if caption:
            cxml = ['<w:p><w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>']
            cxml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:i/><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr>')
            cxml.append(f'<w:t xml:space="preserve">Listing: {escape(caption)}</w:t></w:r></w:p>')
            self.paragraphs.append("".join(cxml))
        xml = ['<w:p><w:pPr><w:spacing w:line="220" w:lineRule="auto" w:before="80" w:after="160"/>']
        xml.append('<w:ind w:left="360" w:right="240"/>')
        xml.append('<w:shd w:val="clear" w:color="auto" w:fill="F4F6F9"/>')
        xml.append('<w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="B0C4DE"/>')
        xml.append('<w:top w:val="single" w:sz="4" w:space="4" w:color="E0E6ED"/>')
        xml.append('<w:bottom w:val="single" w:sz="4" w:space="4" w:color="E0E6ED"/>')
        xml.append('<w:right w:val="single" w:sz="4" w:space="4" w:color="E0E6ED"/></w:pBdr></w:pPr>')
        for idx, line in enumerate(lines):
            xml.append('<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:color w:val="222222"/></w:rPr>')
            xml.append(f'<w:t xml:space="preserve">{escape(line)}</w:t>')
            if idx < len(lines) - 1:
                xml.append('<w:br/>')
            xml.append('</w:r>')
        xml.append('</w:p>')
        self.paragraphs.append("".join(xml))

    def add_table(self, headers, rows, col_widths, caption=None):
        if caption:
            cxml = ['<w:p><w:pPr><w:spacing w:before="160" w:after="60"/></w:pPr>']
            cxml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="20"/><w:color w:val="1B365D"/></w:rPr>')
            cxml.append(f'<w:t xml:space="preserve">Table: {escape(caption)}</w:t></w:r></w:p>')
            self.paragraphs.append("".join(cxml))
        xml = ['<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/>']
        xml.append('<w:tblBorders>')
        xml.append('<w:top w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>')
        xml.append('<w:left w:val="none"/>')
        xml.append('<w:bottom w:val="single" w:sz="6" w:space="0" w:color="CCCCCC"/>')
        xml.append('<w:right w:val="none"/>')
        xml.append('<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E0E0E0"/>')
        xml.append('<w:insideV w:val="none"/>')
        xml.append('</w:tblBorders></w:tblPr>')
        
        # Header row
        xml.append('<w:tr><w:trPr><w:tblHeader/></w:trPr>')
        for idx, h in enumerate(headers):
            w = col_widths[idx] if idx < len(col_widths) else 2000
            xml.append(f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="1B365D"/><w:tcMar><w:top w:w="120"/><w:bottom w:w="120"/><w:left w:w="140"/><w:right w:w="140"/></w:tcMar></w:tcPr>')
            xml.append('<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>')
            xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="20"/><w:color w:val="FFFFFF"/></w:rPr>')
            xml.append(f'<w:t>{escape(h)}</w:t></w:r></w:p></w:tc>')
        xml.append('</w:tr>')

        # Body rows
        for r_idx, r in enumerate(rows):
            shd = "F8F9FA" if r_idx % 2 == 1 else "FFFFFF"
            xml.append('<w:tr>')
            for c_idx, cell in enumerate(r):
                w = col_widths[c_idx] if c_idx < len(col_widths) else 2000
                xml.append(f'<w:tc><w:tcPr><w:tcW w:w="{w}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="{shd}"/><w:tcMar><w:top w:w="100"/><w:bottom w:w="100"/><w:left w:w="140"/><w:right w:w="140"/></w:tcMar></w:tcPr>')
                xml.append('<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>')
                xml.append('<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="222222"/></w:rPr>')
                xml.append(f'<w:t>{escape(cell)}</w:t></w:r></w:p></w:tc>')
            xml.append('</w:tr>')
        xml.append('</w:tbl>')
        xml.append('<w:p><w:pPr><w:spacing w:before="60" w:after="140"/></w:pPr></w:p>')
        self.paragraphs.append("".join(xml))

    def save(self):
        content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>"""

        rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

        doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>"""

        header = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="right"/>
      <w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="CCCCCC"/></w:pBdr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="16"/><w:color w:val="777777"/></w:rPr>
      <w:t>Project Emberfall: Academic Literature Review &amp; Architecture Specification</w:t>
    </w:r>
  </w:p>
</w:hdr>"""

        footer = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="CCCCCC"/></w:pBdr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr>
      <w:t xml:space="preserve">Page </w:t>
    </w:r>
    <w:fldSimple w:instr="PAGE"/>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="666666"/></w:rPr>
      <w:t xml:space="preserve"> of </w:t>
    </w:r>
    <w:fldSimple w:instr="NUMPAGES"/>
  </w:p>
</w:ftr>"""

        styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="222222"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:line="276" w:lineRule="auto" w:after="140"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
</w:styles>"""

        body_content = "".join(self.paragraphs)
        doc = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    {body_content}
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId2"/>
      <w:footerReference w:type="default" r:id="rId3"/>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""

        with zipfile.ZipFile(self.filename, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("[Content_Types].xml", content_types)
            z.writestr("_rels/.rels", rels)
            z.writestr("word/_rels/document.xml.rels", doc_rels)
            z.writestr("word/document.xml", doc)
            z.writestr("word/header1.xml", header)
            z.writestr("word/footer1.xml", footer)
            z.writestr("word/styles.xml", styles)
        print(f"Generated {self.filename} successfully ({len(self.paragraphs)} blocks, ~{self.page_count} section pages).")

if __name__ == "__main__":
    print("DocxBuilder initialized.")
