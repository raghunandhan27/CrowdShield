import os
import re
import subprocess
import markdown
import pypdf

MD_PATH = r"D:\crowdshield\REPORT.md"
HTML_PATH = r"D:\crowdshield\report.html"
PDF_PATH = r"D:\crowdshield\CrowdShield_Technical_Report.pdf"
ARTIFACT_PDF_PATH = r"C:\Users\Raghunandhan P\.gemini\antigravity\brain\e1a3243b-6ca8-4a41-ba59-94da409842bd\CrowdShield_Technical_Report.pdf"

with open(MD_PATH, "r", encoding="utf-8") as f:
    raw_md = f.read()

# 1. Transform mermaid code blocks to <div class="mermaid">
def replace_mermaid(match):
    code = match.group(1).strip()
    return f'\n<div class="mermaid">\n{code}\n</div>\n'

processed_md = re.sub(r'```mermaid\s*\n([\s\S]*?)\n```', replace_mermaid, raw_md)

# 2. Preserve math blocks from markdown processing
math_blocks = []
def save_math(match):
    math_blocks.append(match.group(0))
    return f"MATHBLOCKPLACEHOLDER{len(math_blocks)-1}END"

# Protect $$...$$ and $...$
processed_md = re.sub(r'\$\$[\s\S]*?\$\$', save_math, processed_md)
processed_md = re.sub(r'(?<!\\)\$[^$\n]+\$', save_math, processed_md)

# 3. Convert Markdown to HTML
html_body = markdown.markdown(processed_md, extensions=['extra', 'toc'])

# Restore math blocks
for idx, mb in enumerate(math_blocks):
    html_body = html_body.replace(f"MATHBLOCKPLACEHOLDER{idx}END", mb)

# 4. Wrap in a publication-grade HTML template with CSS, MathJax, and Mermaid
html_document = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CrowdShield Technical & Engineering Report</title>
<!-- MathJax 3 for Vector Math (SVG) -->
<script>
window.MathJax = {{
  tex: {{
    inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
    displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
    processEscapes: true
  }},
  svg: {{
    fontCache: 'global'
  }}
}};
</script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>

<!-- Mermaid JS for Visual Flowcharts & Diagrams -->
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
mermaid.initialize({{
  startOnLoad: true,
  theme: 'neutral',
  securityLevel: 'loose',
  flowchart: {{ useMaxWidth: false, htmlLabels: true, curve: 'basis' }},
  sequence: {{ useMaxWidth: false }}
}});
</script>

<style>
@page {{
  size: A4 portrait;
  margin: 18mm 16mm 18mm 16mm;
  @bottom-right {{
    content: "Page " counter(page) " of " counter(pages);
    font-size: 8pt;
    color: #64748b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }}
}}

body {{
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #1e293b;
  line-height: 1.6;
  font-size: 10pt;
  background: #ffffff;
  margin: 0;
  padding: 0;
}}

/* Header Banner */
.doc-header {{
  border-bottom: 3px solid #0284c7;
  padding-bottom: 14px;
  margin-bottom: 22px;
}}
.doc-title {{
  font-size: 20pt;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 6px 0;
  letter-spacing: -0.5px;
}}
.doc-subtitle {{
  font-size: 11pt;
  color: #475569;
  font-weight: 500;
  margin: 0 0 12px 0;
}}
.doc-meta {{
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 8.5pt;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}}
.meta-badge {{
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 3px 8px;
  border-radius: 4px;
  color: #0f172a;
  font-weight: 600;
}}
.badge-version {{
  background: #e0f2fe;
  border-color: #7dd3fc;
  color: #0369a1;
}}

/* Headings */
h1, h2, h3, h4 {{
  color: #0f172a;
  font-weight: 700;
  page-break-after: avoid;
  letter-spacing: -0.3px;
}}
h1 {{
  font-size: 14pt;
  border-bottom: 1.5px solid #e2e8f0;
  padding-bottom: 5px;
  margin-top: 24px;
  margin-bottom: 12px;
  color: #0369a1;
}}
h2 {{
  font-size: 12pt;
  margin-top: 18px;
  margin-bottom: 8px;
  color: #0f172a;
}}
h3 {{
  font-size: 10.5pt;
  margin-top: 14px;
  margin-bottom: 6px;
  color: #334155;
}}

p {{
  margin: 0 0 10px 0;
  text-align: justify;
}}

/* Tables */
table {{
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0;
  font-size: 8.5pt;
  page-break-inside: avoid;
}}
th, td {{
  border: 1px solid #cbd5e1;
  padding: 6px 10px;
  text-align: left;
}}
th {{
  background: #f8fafc;
  color: #0f172a;
  font-weight: 700;
  border-bottom: 2px solid #94a3b8;
}}
tr:nth-child(even) {{
  background: #f8fafc;
}}

/* Code & Preformatted */
code {{
  font-family: "JetBrains Mono", Consolas, "Liberation Mono", Menlo, Courier, monospace;
  font-size: 8.5pt;
  background: #f1f5f9;
  color: #0f172a;
  padding: 2px 5px;
  border-radius: 3px;
  border: 1px solid #e2e8f0;
}}
pre {{
  background: #0f172a;
  color: #f8fafc;
  padding: 12px 14px;
  border-radius: 6px;
  font-size: 8pt;
  overflow-x: auto;
  line-height: 1.45;
  page-break-inside: avoid;
  margin: 12px 0;
}}
pre code {{
  background: transparent;
  color: inherit;
  padding: 0;
  border: none;
}}

/* Diagrams */
.mermaid {{
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  page-break-inside: avoid;
}}
.mermaid svg {{
  max-width: 95% !important;
  height: auto !important;
}}

/* Math */
.MathJax {{
  font-size: 10.5pt !important;
}}

/* Blockquotes / Callouts */
blockquote {{
  margin: 12px 0;
  padding: 8px 14px;
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  border-radius: 0 4px 4px 0;
  color: #1e3a8a;
  font-size: 9pt;
}}

/* Print utilities */
.page-break {{
  page-break-before: always;
}}
</style>
</head>
<body>

<div class="doc-header">
  <div class="doc-title">CrowdShield: Autonomous Crowd Crush Prevention & Guidance System</div>
  <div class="doc-subtitle">Comprehensive Technical Specification, Mathematical Models, Multi-Tier Computer Vision, and Dual-Radio Edge IoT Engineering</div>
  <div class="doc-meta">
    <span class="meta-badge badge-version">VERSION 2.1 (PROD)</span>
    <span class="meta-badge">PROJECT LEAD: RAGHUNANDHAN P</span>
    <span class="meta-badge">OCTOBER 2026</span>
    <span class="meta-badge">OFFICIAL DEFENSE & JUDGING SPECIFICATION</span>
  </div>
</div>

<div class="doc-body">
{html_body}
</div>

</body>
</html>
"""

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html_document)

print(f"HTML successfully generated at: {HTML_PATH}")

# 5. Convert to PDF using Microsoft Edge Headless with JS execution budget
edge_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(edge_exe):
    edge_exe = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(edge_exe):
    edge_exe = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

print(f"Using browser rendering engine: {edge_exe}")

cmd = [
    edge_exe,
    "--headless=new",
    "--disable-gpu",
    "--virtual-time-budget=6000",
    "--run-all-compositor-stages-before-draw",
    f"--print-to-pdf={PDF_PATH}",
    "--no-pdf-header-footer",
    HTML_PATH
]

print("Executing PDF generation...")
res = subprocess.run(cmd, capture_output=True, text=True)
print("Browser Return Code:", res.returncode)

if os.path.exists(PDF_PATH):
    size_bytes = os.path.getsize(PDF_PATH)
    print(f"PDF generated successfully at {PDF_PATH} ({size_bytes / 1024:.1f} KB)")
    
    # Copy to Artifact directory for instant UI download & presentation
    with open(PDF_PATH, "rb") as src, open(ARTIFACT_PDF_PATH, "wb") as dst:
        dst.write(src.read())
    print(f"Copied to Artifact path: {ARTIFACT_PDF_PATH}")
    
    # Read with PyPDF to verify page count
    reader = pypdf.PdfReader(PDF_PATH)
    print(f"Verified PDF page count: {len(reader.pages)} pages")
else:
    print("ERROR: PDF was not generated. Stderr:", res.stderr)
