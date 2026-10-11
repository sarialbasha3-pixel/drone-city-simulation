"""
generate_report_figures.py
Generates high-resolution academic figures based on the verified 1.42M-sample research logs
and system architecture for Chapter 3.
"""
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

out_dir = r"D:\G-P\figures"
os.makedirs(out_dir, exist_ok=True)

# -------------------------------------------------------------------------
# Figure 1: Validation Position & Velocity RMSE Reductions (Page 25-26 of report)
# -------------------------------------------------------------------------
def make_fig_error_reduction():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4.5), dpi=300)
    
    flights = ['Indoor (indoor_1)', 'Rain/Gusts (wicklow_5)', 'Night (seq10)']
    base_pos = [15015.08, 2984.59, 1264.80]
    safe_pos = [614.10, 394.91, 356.71]
    
    x = np.arange(len(flights))
    width = 0.35
    
    rects1 = ax1.bar(x - width/2, base_pos, width, label='Inertial Baseline (ESKF)', color='#2B4C7E')
    rects2 = ax1.bar(x + width/2, safe_pos, width, label='Safe GRU V3 (Aided)', color='#E06D53')
    
    ax1.set_ylabel('Position RMSE (meters, log scale)', fontsize=11, fontweight='bold')
    ax1.set_title('(a) Position RMSE Reduction (Macro: 92.91%)', fontsize=11, fontweight='bold')
    ax1.set_xticks(x)
    ax1.set_xticklabels(flights, fontsize=9.5, rotation=12)
    ax1.set_yscale('log')
    ax1.legend(frameon=True, fontsize=9)
    ax1.grid(True, which='both', linestyle='--', alpha=0.5)
    
    # Add percentage labels
    red_pos = [95.91, 86.77, 71.80]
    for i, r in enumerate(red_pos):
        ax1.text(x[i] + width/2, safe_pos[i] * 1.3, f"-{r:.1f}%", ha='center', va='bottom', fontsize=9, fontweight='bold', color='#B22222')
        
    base_vel = [169.03, 69.88, 28.90]
    safe_vel = [5.95, 6.84, 8.14]
    
    rects3 = ax2.bar(x - width/2, base_vel, width, label='Inertial Baseline (ESKF)', color='#2B4C7E')
    rects4 = ax2.bar(x + width/2, safe_vel, width, label='Safe GRU V3 (Aided)', color='#E06D53')
    
    ax2.set_ylabel('Velocity RMSE (m/s)', fontsize=11, fontweight='bold')
    ax2.set_title('(b) Velocity RMSE Reduction (Macro: 92.18%)', fontsize=11, fontweight='bold')
    ax2.set_xticks(x)
    ax2.set_xticklabels(flights, fontsize=9.5, rotation=12)
    ax2.legend(frameon=True, fontsize=9)
    ax2.grid(True, linestyle='--', alpha=0.5)
    
    red_vel = [96.48, 90.21, 71.82]
    for i, r in enumerate(red_vel):
        ax2.text(x[i] + width/2, safe_vel[i] + 3, f"-{r:.1f}%", ha='center', va='bottom', fontsize=9, fontweight='bold', color='#B22222')
        
    plt.tight_layout()
    path = os.path.join(out_dir, "fig_validation_error_reduction.png")
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print("Saved:", path)

# -------------------------------------------------------------------------
# Figure 2: Corpus Composition Pie Chart (Page 6 of report)
# -------------------------------------------------------------------------
def make_fig_corpus_composition():
    fig, ax = plt.subplots(figsize=(6.5, 4.5), dpi=300)
    
    labels = ['INSANE\n(6 flights, 218,204 rows\n15.34%)', 
              'LandingUAV\n(7 flights, 237,413 rows\n16.69%)', 
              'PanoAir\n(6 flights, 966,731 rows\n67.96%)']
    sizes = [218204, 237413, 966731]
    colors = ['#4A7BB0', '#88B04B', '#F5A623']
    explode = (0.04, 0.04, 0.04)
    
    wedges, texts, autotexts = ax.pie(sizes, explode=explode, labels=labels, autopct='%1.1f%%',
                                      startangle=140, colors=colors, 
                                      textprops=dict(color="black", fontsize=9.5),
                                      wedgeprops=dict(edgecolor='black', linewidth=1))
    for at in autotexts:
        at.set_fontweight('bold')
        at.set_fontsize(10)
        
    ax.set_title('Composition of the 1,422,348-Sample Multi-Source Corpus\n(19 Total Curated Flights)', 
                 fontsize=11.5, fontweight='bold', pad=15)
    
    plt.tight_layout()
    path = os.path.join(out_dir, "fig_corpus_composition.png")
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print("Saved:", path)

# -------------------------------------------------------------------------
# Figure 3: System Microservices Architecture Diagram
# -------------------------------------------------------------------------
def make_fig_architecture():
    fig, ax = plt.subplots(figsize=(10.5, 5.5), dpi=300)
    ax.axis('off')
    
    # Draw background boxes for components
    def draw_box(x, y, w, h, title, subtitle, color, edgecolor='#000000'):
        rect = plt.Rectangle((x, y), w, h, facecolor=color, edgecolor=edgecolor, linewidth=1.5, zorder=2)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 0.22, title, ha='center', va='top', fontsize=10.5, fontweight='bold', zorder=3)
        ax.text(x + w/2, y + 0.15, subtitle, ha='center', va='bottom', fontsize=8.5, color='#333333', zorder=3)

    # 1. Physical / Simulation Core (Three.js WebGL)
    draw_box(0.5, 3.2, 4.0, 1.8, "Client: Three.js Simulation (Port 3000)", 
             "• 100 Hz IMU Mechanization (Gyro + Accel)\n• 6-DoF Quadrotor Rigid-Body Flight Physics\n• Route Controller (Waypoints / Spline Trajectory)\n• Photorealistic PBR Urban Environment & Weather", "#EBF3FB")

    # 2. State Estimation: 15-State ESKF
    draw_box(5.5, 3.2, 4.5, 1.8, "Inertial Estimator: 15-State ESKF", 
             "• Nominal State: [p, v, q, ba, bg] (Continuous Propagation)\n• Error Covariance P (15x15) Propagation (100 Hz)\n• Rotation-6D Extraction & Attitude Orthonormalization\n• Joseph-Form Covariance Measurement Update", "#EAF7EB")

    # 3. Feature Extraction Buffer
    draw_box(5.5, 0.6, 4.5, 1.8, "Feature Buffer & Temporal Grid Resampler", 
             "• 24-Dimensional Multi-Rate Kinematic State Vector\n• Sliding Temporal Window: 1.0 s History (101 Steps)\n• 100 Hz Linear Interpolation (Segment-Bounded)\n• Train-Only Standardization [Z-score Transform]", "#FFF8E7")

    # 4. Neural Network Inference Service
    draw_box(0.5, 0.6, 4.0, 1.8, "Service: GRU V3 Neural Model (Port 8765)", 
             "• PyTorch GRU (2 Layers, 128 Hidden, Dropout 0.20)\n• Input Tensor: [Batch, 101, 24] → Output: Δv [3]\n• Target De-normalization: Physical Velocity Residual\n• Fast REST API Inference (< 15 ms latency)", "#FBEAEB")

    # Arrows
    def arrow(x1, y1, x2, y2, label=""):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(facecolor='black', edgecolor='black', arrowstyle="->", lw=1.5), zorder=4)
        if label:
            mx, my = (x1 + x2)/2, (y1 + y2)/2
            ax.text(mx, my + 0.12, label, ha='center', va='bottom', fontsize=8, fontweight='bold', backgroundcolor='white', zorder=5)

    arrow(4.5, 4.1, 5.5, 4.1, "Raw IMU at 100 Hz")
    arrow(7.75, 3.2, 7.75, 2.4, "State [p, v, q, P]")
    arrow(5.5, 1.5, 4.5, 1.5, "101 x 24 Tensor via HTTP POST")
    arrow(2.5, 2.4, 2.5, 3.2, "Pseudo-Velocity zv via Gate")

    ax.set_xlim(0, 10.5)
    ax.set_ylim(0, 5.5)
    
    plt.tight_layout()
    path = os.path.join(out_dir, "fig_system_architecture.png")
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print("Saved:", path)

# -------------------------------------------------------------------------
# Figure 4: Safety Gating Architecture Flowchart
# -------------------------------------------------------------------------
def make_fig_safety_gates():
    fig, ax = plt.subplots(figsize=(10.0, 3.8), dpi=300)
    ax.axis('off')
    
    def box(x, y, w, h, title, sub, color):
        rect = plt.Rectangle((x, y), w, h, facecolor=color, edgecolor='black', lw=1.2, zorder=2)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h - 0.18, title, ha='center', va='top', fontsize=9.5, fontweight='bold', zorder=3)
        ax.text(x + w/2, y + 0.12, sub, ha='center', va='bottom', fontsize=8, color='#333333', zorder=3)

    box(0.2, 1.0, 1.8, 1.8, "Raw GRU Δv", "Inference Output\n[dvx, dvy, dvz]\nfrom PyTorch", "#EBF3FB")
    box(2.4, 1.0, 1.8, 1.8, "1. OOD Gate", "Mahalanobis Dist.\nThreshold: 74.81\n(Q95 Train-Only)", "#FFF3CD")
    box(4.6, 1.0, 1.8, 1.8, "2. Jump Gate", "Temporal Continuity\n||Δv_k - Δv_{k-1}||₂\nThreshold: 4.59 m/s", "#D1ECF1")
    box(6.8, 1.0, 1.8, 1.8, "3. NIS Gate", "3-DoF Innovation\nNIS ≤ 11.34 (99%)\nSevere NIS: 45.38", "#D4EDDA")
    box(9.0, 1.0, 1.8, 1.8, "4. ESKF Update", "Joseph Covariance\nUpdate z_v into\nState & Matrix P", "#D1E7DD")

    def conn(x1, y1, x2, y2, lbl=""):
        ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(facecolor='black', edgecolor='black', arrowstyle="->", lw=1.4), zorder=4)
        if lbl:
            ax.text((x1+x2)/2, (y1+y2)/2 + 0.1, lbl, ha='center', va='bottom', fontsize=7.5, fontweight='bold', backgroundcolor='white')

    conn(2.0, 1.9, 2.4, 1.9, "Pass")
    conn(4.2, 1.9, 4.6, 1.9, "Pass")
    conn(6.4, 1.9, 6.8, 1.9, "Pass")
    conn(8.6, 1.9, 9.0, 1.9, "Accepted")

    # Reject branch
    ax.annotate('', xy=(5.5, 0.4), xytext=(3.3, 1.0),
                arrowprops=dict(facecolor='#B22222', edgecolor='#B22222', arrowstyle="->", lw=1.2, ls='--'))
    ax.annotate('', xy=(5.5, 0.4), xytext=(5.5, 1.0),
                arrowprops=dict(facecolor='#B22222', edgecolor='#B22222', arrowstyle="->", lw=1.2, ls='--'))
    ax.annotate('', xy=(5.5, 0.4), xytext=(7.7, 1.0),
                arrowprops=dict(facecolor='#B22222', edgecolor='#B22222', arrowstyle="->", lw=1.2, ls='--'))
    
    rect_rej = plt.Rectangle((4.2, 0.05), 2.6, 0.6, facecolor='#F8D7DA', edgecolor='#B22222', lw=1.2)
    ax.add_patch(rect_rej)
    ax.text(5.5, 0.35, "REJECT UPDATE", ha='center', va='center', fontsize=9, fontweight='bold', color='#721C24')
    ax.text(5.5, 0.15, "Pure Inertial Propagation / Cooldown Active", ha='center', va='center', fontsize=7.5, color='#721C24')

    ax.set_xlim(0, 11.0)
    ax.set_ylim(0, 3.2)
    
    plt.tight_layout()
    path = os.path.join(out_dir, "fig_safety_gates.png")
    plt.savefig(path, bbox_inches='tight')
    plt.close()
    print("Saved:", path)

if __name__ == '__main__':
    make_fig_error_reduction()
    make_fig_corpus_composition()
    make_fig_architecture()
    make_fig_safety_gates()
