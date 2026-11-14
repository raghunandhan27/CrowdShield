import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

EQUATIONS_DIR = r"D:\crowdshield\patent_equations"
os.makedirs(EQUATIONS_DIR, exist_ok=True)

plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = ['Times New Roman', 'DejaVu Serif']
plt.rcParams['mathtext.fontset'] = 'cm'

def render_equation_card(filename, main_math_list, subtitle_text=None, figsize=(7.2, 1.35)):
    fig, ax = plt.subplots(figsize=figsize, dpi=300)
    ax.axis('off')
    
    # Elegant card border and background
    card = plt.Rectangle((0.01, 0.05), 0.98, 0.90, facecolor='#fafbfc', edgecolor='#1a252f', linewidth=1.2, transform=ax.transAxes)
    ax.add_patch(card)
    
    # Left accent bar (Navy / deep black)
    bar = plt.Rectangle((0.01, 0.05), 0.015, 0.90, facecolor='#1a252f', edgecolor='none', transform=ax.transAxes)
    ax.add_patch(bar)
    
    if len(main_math_list) == 1 and not subtitle_text:
        ax.text(0.51, 0.50, main_math_list[0], ha='center', va='center', fontsize=12.5, transform=ax.transAxes)
    elif len(main_math_list) == 1 and subtitle_text:
        ax.text(0.51, 0.62, main_math_list[0], ha='center', va='center', fontsize=12.5, transform=ax.transAxes)
        ax.text(0.51, 0.24, subtitle_text, ha='center', va='center', fontsize=9.2, style='italic', color='#333333', transform=ax.transAxes)
    elif len(main_math_list) == 2 and not subtitle_text:
        ax.text(0.51, 0.68, main_math_list[0], ha='center', va='center', fontsize=11.5, transform=ax.transAxes)
        ax.text(0.51, 0.32, main_math_list[1], ha='center', va='center', fontsize=11.5, transform=ax.transAxes)
    elif len(main_math_list) == 2 and subtitle_text:
        ax.text(0.51, 0.72, main_math_list[0], ha='center', va='center', fontsize=11.2, transform=ax.transAxes)
        ax.text(0.51, 0.40, main_math_list[1], ha='center', va='center', fontsize=11.2, transform=ax.transAxes)
        ax.text(0.51, 0.16, subtitle_text, ha='center', va='center', fontsize=8.8, style='italic', color='#333333', transform=ax.transAxes)
        
    out_path = os.path.join(EQUATIONS_DIR, filename)
    plt.savefig(out_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()
    print("Generated equation card:", out_path)

# 1. Homography
render_equation_card(
    "eq1_homography.png",
    [
        r"$\mathbf{X}_w \sim \mathbf{H} \cdot \mathbf{x} \qquad \mathrm{where} \quad \mathbf{H} \in \mathbf{R}^{3 \times 3}, \quad \mathbf{x} = [u, \, v, \, 1]^T$",
        r"$X_w = \frac{h_{11}u + h_{12}v + h_{13}}{h_{31}u + h_{32}v + h_{33}}, \qquad Y_w = \frac{h_{21}u + h_{22}v + h_{23}}{h_{31}u + h_{32}v + h_{33}} \qquad \mathbf{(Equation\ 1)}$"
    ],
    subtitle_text="Direct Linear Transformation (DLT) mapping optical camera pixels (u, v) to metric ground coordinates (X, Y in meters)",
    figsize=(7.5, 1.55)
)

# 2. Continuous Density Integration
render_equation_card(
    "eq2_density_integration.png",
    [
        r"$N_z = \iint_{(x,y) \in \Omega_z} D(x, y) \, dx \, dy \qquad \mathrm{and} \qquad \rho_z = \frac{N_z}{\mathrm{Area}(\Omega_z)} \qquad \mathbf{(Equation\ 2)}$"
    ],
    subtitle_text="Continuous surface double integration of CSRNet dilated density map D(x, y) across zone polygon boundaries",
    figsize=(7.5, 1.35)
)

# 3. Fruin Composite Risk
render_equation_card(
    "eq3_fruin_risk.png",
    [
        r"$R_z = w_0 \cdot d_n + w_1 \cdot \mathrm{slow}_z + w_2 \cdot \mathrm{turb}_z \qquad \mathbf{(Equation\ 3)}$",
        r"$\mathrm{where} \quad d_n = \mathrm{clamp}\left(\frac{\rho_z}{6.0}, \, 0, \, 1\right), \quad w_0 = 0.40, \quad w_1 = 0.35, \quad w_2 = 0.25$"
    ],
    subtitle_text="Level-of-Service (LoS) density-gated composite hazard index (Emergency Alarm Trigger: R_z ≥ 0.70)",
    figsize=(7.5, 1.45)
)

# 4. Farneback Kinematics
render_equation_card(
    "eq4_farneback_kinematics.png",
    [
        r"$\mathrm{slow}_z = 1 - \frac{\|\bar{\mathbf{v}}_z\|}{v_{\mathrm{free}}}, \qquad \mathrm{turb}_z = \frac{\sigma_{v, z}}{\|\bar{\mathbf{v}}_z\| + \epsilon} \qquad \mathbf{(Equation\ 4)}$"
    ],
    subtitle_text="Dense Farnebäck optical flow velocity deficit and local vector turbulence across sequential frames",
    figsize=(7.5, 1.35)
)

# 5. Dynamic Routing Cost
render_equation_card(
    "eq5_dynamic_routing_cost.png",
    [
        r"$\mathrm{Cost}(e) = \mathrm{Length}(e) \cdot \left[1 + 4 \cdot R_z\right] \qquad \mathbf{(Equation\ 5)}$",
        r"$\mathrm{If} \quad R_z \geq 0.70 \quad \mathrm{or\ SOS\ Panic\ Triggered:} \quad \mathrm{Cost}(e) \leftarrow \infty \quad \mathrm{[SEVERED\ CORRIDOR]}$"
    ],
    subtitle_text="Dynamic Dijkstra edge cost penalty and instantaneous topological isolation of high-risk choke corridors",
    figsize=(7.6, 1.45)
)

# 6. Directional Conflict Index (DCI)
render_equation_card(
    "eq6_directional_conflict.png",
    [
        r"$\mathrm{DCI}_z = 1 - \frac{\left\|\sum_{i \in \Omega_z} \mathbf{v}_i\right\|}{\sum_{i \in \Omega_z} \|\mathbf{v}_i\|} \qquad \mathbf{(Equation\ 6)}$"
    ],
    subtitle_text="Directional Conflict Index: DCI_z ≥ 0.65 triggers localized fall, crush, or physical altercation alarms",
    figsize=(7.5, 1.35)
)

print("All 6 mathematical equation cards rendered successfully!")
