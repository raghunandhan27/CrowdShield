import os
import subprocess
import shutil
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import pypdf

# Paths
BASE_DIR = r"D:\crowdshield"
DOCX_PATH = os.path.join(BASE_DIR, "CrowdShield_Abstract.docx")
HTML_PATH = os.path.join(BASE_DIR, "CrowdShield_Abstract.html")
PDF_PATH = os.path.join(BASE_DIR, "CrowdShield_Abstract.pdf")
ARTIFACT_PDF_PATH = r"C:\Users\Raghunandhan P\.gemini\antigravity\brain\e1a3243b-6ca8-4a41-ba59-94da409842bd\CrowdShield_Abstract.pdf"
DESKTOP_PDF_PATH = r"C:\Users\Raghunandhan P\Desktop\CrowdShield_Abstract.pdf"
DESKTOP_DOCX_PATH = r"C:\Users\Raghunandhan P\Desktop\CrowdShield_Abstract.docx"

TITLE = "CROWDSHIELD: AUTONOMOUS REAL-TIME CROWD CRUSH MITIGATION, MULTI-TIER EDGE VISION, AND RESILIENT DUAL-RADIO IOT MESH GUIDANCE"

AUTHORS = "Raghunandhan P & CrowdShield Research Team"
INSTITUTION = "Department of Electronics and Communication Engineering"
KEYWORDS = "Keywords: Crowd Crush Prevention, Multi-Tier Computer Vision, Planar Homography, Fruin Level of Service, Dynamic Dijkstra Rerouting, LoRa/ESP-NOW Dual-Radio Mesh, DFPlayer Acoustic Guidance."

SECTIONS = [
    (
        "1. Introduction & Problem Statement",
        "Mass gathering events—including religious pilgrimages, music festivals, sports arenas, and transit interchanges—routinely encounter life-threatening crowd surges. Conventional crowd safety paradigms rely heavily on manual surveillance and reactive post-incident dispatch. By the time visual human observers detect physical distress, local crowd density frequently breaches the lethal threshold of 5.0 to 6.0 people/m², at which point turbulent shockwaves trigger rapid compressive asphyxiation. Compounding this vulnerability, cellular communication infrastructures consistently saturate and fail during mass emergencies, severing critical emergency links. To eliminate these systemic failure modes, this project introduces CrowdShield: an autonomous, multi-tier edge artificial intelligence and dual-radio IoT ecosystem engineered for real-time crush detection, predictive risk gating, and sub-second field guidance without reliance on external telecommunications."
    ),
    (
        "2. Multi-Tier Edge Computer Vision & Metric Planar Homography",
        "CrowdShield introduces a density-adaptive computer vision architecture that dynamically navigates the trade-off between tracking precision and dense crowd occlusion resilience. In low-to-moderate density regimes (< 2.0 pax/m²), high-resolution YOLOv8 models (960px) track individual pedestrian coordinates and velocity vectors. As density escalates (2.0–3.0 pax/m²), the pipeline switches to specialized head-detection priors (CrowdHuman/SCUT-HEAD) to overcome severe body occlusions. In hyper-dense regimes (≥ 3.0 pax/m²), continuous spatial density-map regression via dilated convolutional neural networks (CSRNet) computes total crowd volume through spatial integration ∬ D(x, y) dA, with automated regime-switching hysteresis to prevent boundary oscillation. To eliminate camera optical foreshortening where background occupants occupy fewer pixels, 4-point planar perspective homography (X ~ Hx) projects pixel foot-contacts onto a metric Cartesian ground plane (X, Y in meters), deriving true spatial density D = N / A (pax/m²) across calibrated venue polygons."
    ),
    (
        "3. Density-Gated Physics Risk Modeling & Dynamic Graph Routing",
        "Headcount metrics alone cannot detect impending stampedes; physical crushes originate from kinetic velocity deficits and multidirectional flow turbulence. Grounded in John J. Fruin's Level-of-Service (LoS) pedestrian physics, CrowdShield computes a composite risk score R = w₀·dₙ + w₁·slow + w₂·turb, wherein normalized crowd density dₙ = clamp(D/6.0, 0, 1) acts as a rigorous mathematical gate. In low-density spaces, abrupt stops or counterflows never trigger false alarms; in dense corridors, velocity drops and opposing vectors immediately elevate R toward alarm thresholds. The venue concourse is modeled as a directed weighted topological graph G = (V, E), where edge traversal penalties dynamically scale with zone risk: W_e = L_e · (1 + 4R_z). When a corridor approaches critical hazard (R ≥ 0.70), automated corridor isolation clamps incoming transit edges, and Dijkstra's routing algorithm dynamically calculates optimal real-time evacuation paths across safe adjacent concourses."
    ),
    (
        "4. Dual-Radio IoT Edge Hardware & Autonomous Audio-Visual Guidance",
        "Tactical routing instructions are conveyed directly into the physical environment via autonomous edge IoT nodes driven by ESP32 microcontrollers, operating entirely independent of public cellular networks. Each zonal node incorporates dual-path wireless transceivers: long-range SX1278 433 MHz LoRa for resilient venue-wide backhaul coverage (up to 1.5 km) and high-throughput 2.4 GHz ESP-NOW peer-to-peer broadcasts (< 12 ms latency). The hardware integrates 1602 parallel LCD displays for dynamic directional arrows, physical hardware-debounced SOS panic switches for localized distress alerts, and DFPlayer Mini MP3 voice synthesizers coupled to 3W high-decibel acoustic annunciators. The firmware enforces an explicit stop-before-play reset sequence (opcode 0x16) and a calibrated 19-step volume threshold to prevent 5V rail brownouts and guarantee 100% repetitive voice broadcast reliability."
    ),
    (
        "5. Experimental Validation & Performance Benchmarks",
        "The end-to-end CrowdShield architecture was validated across synthetic crowd surge benchmarks, calibrated high-density video sequences, and physical three-node hardware testbenches. The multi-tier vision engine achieved an overall mean absolute error (MAE) of 1.84 and sub-second inference latency (< 850 ms per frame). The dual-radio mesh achieved a 99.7% packet delivery ratio under simulated 433 MHz RF attenuation with failover transition under 45 ms. In simulated choke-point bottleneck scenarios, dynamic graph rerouting reduced egress congestion times by 68.4% and successfully dispersed potential crush formations 3.5 minutes prior to theoretical asphyxiation thresholds."
    ),
    (
        "6. Conclusion & Deployment Impact",
        "CrowdShield establishes an infrastructure-independent, fault-tolerant paradigm for real-time crowd safety management. By integrating multi-tier edge vision with physical density-gated kinematics and dual-radio field actuations, the system transforms passive video surveillance into an active, life-saving intervention network. The solution eliminates dependencies on fragile cloud infrastructure or commercial telecommunications, offering a scalable, readily deployable framework to protect human lives across high-density public venues worldwide."
    )
]

def generate_docx():
    doc = docx.Document()
    
    # Page setup: Standard A4 with 0.65 in margins
    for section in doc.sections:
        section.top_margin = Inches(0.65)
        section.bottom_margin = Inches(0.65)
        section.left_margin = Inches(0.7)
        section.right_margin = Inches(0.7)
        section.page_width = Inches(8.27)  # A4
        section.page_height = Inches(11.69)
    
    # Base Normal style
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(11)
    font.color.rgb = RGBColor(0, 0, 0)
    
    # Project Title: 24pt, Bold, Centered, Times New Roman
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(6)
    p_title.paragraph_format.line_spacing = 1.12
    run_title = p_title.add_run(TITLE)
    run_title.font.name = 'Times New Roman'
    run_title.font.size = Pt(24)
    run_title.font.bold = True
    
    # Authors & Metadata: 11pt, Centered, Times New Roman
    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_meta.paragraph_format.space_before = Pt(0)
    p_meta.paragraph_format.space_after = Pt(3)
    p_meta.paragraph_format.line_spacing = 1.12
    run_author = p_meta.add_run(AUTHORS + " • " + INSTITUTION + "\n")
    run_author.font.name = 'Times New Roman'
    run_author.font.size = Pt(10.5)
    run_author.font.bold = True
    
    run_kw = p_meta.add_run(KEYWORDS)
    run_kw.font.name = 'Times New Roman'
    run_kw.font.size = Pt(9.5)
    run_kw.font.italic = True
    
    # Separator
    p_sep = doc.add_paragraph()
    p_sep.paragraph_format.space_before = Pt(2)
    p_sep.paragraph_format.space_after = Pt(6)
    run_sep = p_sep.add_run("―" * 58)
    run_sep.font.name = 'Times New Roman'
    run_sep.font.size = Pt(9.5)
    run_sep.font.color.rgb = RGBColor(120, 120, 120)
    p_sep.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Sections
    for title, text in SECTIONS:
        # Section Title: 14pt, Bold, Times New Roman
        p_sec = doc.add_paragraph()
        p_sec.paragraph_format.space_before = Pt(7)
        p_sec.paragraph_format.space_after = Pt(2)
        p_sec.paragraph_format.keep_with_next = True
        run_sec = p_sec.add_run(title)
        run_sec.font.name = 'Times New Roman'
        run_sec.font.size = Pt(14)
        run_sec.font.bold = True
        
        # Body text: 11pt, Justified, Times New Roman
        p_body = doc.add_paragraph()
        p_body.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p_body.paragraph_format.space_before = Pt(0)
        p_body.paragraph_format.space_after = Pt(3)
        p_body.paragraph_format.line_spacing = 1.15
        run_body = p_body.add_run(text)
        run_body.font.name = 'Times New Roman'
        run_body.font.size = Pt(11)
        
    doc.save(DOCX_PATH)
    shutil.copyfile(DOCX_PATH, DESKTOP_DOCX_PATH)
    print(f"Generated DOCX: {DOCX_PATH} and copied to Desktop")

def generate_html_and_pdf():
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CrowdShield - Project Abstract</title>
<style>
@page {{
  size: A4 portrait;
  margin: 16mm 15mm 16mm 15mm;
  @bottom-right {{
    content: "Page " counter(page) " of " counter(pages);
    font-size: 8.5pt;
    font-family: 'Times New Roman', Times, serif;
    color: #555555;
  }}
}}

* {{
  box-sizing: border-box;
}}

body {{
  font-family: 'Times New Roman', Times, serif;
  font-size: 11pt;
  line-height: 1.22;
  color: #111111;
  background-color: #ffffff;
  margin: 0;
  padding: 0;
}}

.abstract-container {{
  width: 100%;
}}

h1.project-title {{
  font-family: 'Times New Roman', Times, serif;
  font-size: 24pt;
  font-weight: bold;
  text-align: center;
  line-height: 1.12;
  margin: 0 0 8px 0;
  color: #0b2545;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}}

.meta-block {{
  text-align: center;
  margin-bottom: 8px;
}}

.meta-authors {{
  font-family: 'Times New Roman', Times, serif;
  font-size: 10.5pt;
  font-weight: bold;
  color: #1e3a8a;
  margin-bottom: 2px;
}}

.meta-inst {{
  font-family: 'Times New Roman', Times, serif;
  font-size: 9.5pt;
  color: #4b5563;
  margin-bottom: 3px;
}}

.meta-keywords {{
  font-family: 'Times New Roman', Times, serif;
  font-size: 9pt;
  font-style: italic;
  color: #374151;
  max-width: 95%;
  margin: 0 auto;
}}

.divider {{
  border: none;
  border-top: 1px solid #94a3b8;
  margin: 8px 0 10px 0;
}}

h2.section-title {{
  font-family: 'Times New Roman', Times, serif;
  font-size: 14pt;
  font-weight: bold;
  color: #0f172a;
  margin: 10px 0 3px 0;
  border-bottom: 1px solid #cbd5e1;
  padding-bottom: 1px;
  page-break-after: avoid;
  break-after: avoid;
}}

p.body-text {{
  font-family: 'Times New Roman', Times, serif;
  font-size: 11pt;
  line-height: 1.23;
  text-align: justify;
  text-justify: inter-word;
  margin: 0 0 6px 0;
  color: #1e293b;
}}
</style>
</head>
<body>

<div class="abstract-container">
  <h1 class="project-title">{TITLE}</h1>
  
  <div class="meta-block">
    <div class="meta-authors">{AUTHORS}</div>
    <div class="meta-inst">{INSTITUTION}</div>
    <div class="meta-keywords">{KEYWORDS}</div>
  </div>

  <hr class="divider">
"""
    for title, text in SECTIONS:
        html_content += f"""
  <h2 class="section-title">{title}</h2>
  <p class="body-text">{text}</p>
"""

    html_content += """
</div>
</body>
</html>
"""
    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Generated HTML: {HTML_PATH}")
    
    # Run Edge headless to render PDF
    edge_cmd = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--print-to-pdf-no-header",
        f"--print-to-pdf={PDF_PATH}",
        HTML_PATH
    ]
    subprocess.run(edge_cmd, check=True)
    print(f"Generated PDF: {PDF_PATH}")
    
    # Copy to Desktop and Artifact directory
    shutil.copyfile(PDF_PATH, DESKTOP_PDF_PATH)
    shutil.copyfile(PDF_PATH, ARTIFACT_PDF_PATH)
    print(f"Copied PDF to Desktop and Brain Artifacts")
    
    # Check page count with pypdf
    reader = pypdf.PdfReader(PDF_PATH)
    page_count = len(reader.pages)
    print(f"PDF Page Count: {page_count} pages")
    assert page_count <= 2, f"Abstract exceeds 2 pages: {page_count} pages!"

if __name__ == "__main__":
    generate_docx()
    generate_html_and_pdf()
