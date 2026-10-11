"""
section_3_4_to_3_6.py
Constructs Sections 3.4, 3.5, 3.6.
"""

from docx.shared import Pt, Cm
from build_full_chapter3 import (
    add_heading_2, add_heading_3, add_body, add_bullet, add_equation, add_caption, format_table
)

def build_section_3_4(doc):
    add_heading_2(doc, "3.4  Machine-Learning Model Architectures")

    add_body(doc, (
        "The navigation and perception pipeline integrates three complementary mathematical and machine-learning models: "
        "(1) a 15-state Error-State Extended Kalman Filter for baseline inertial mechanization; (2) a temporal Gated Recurrent Unit "
        "(GRU v3) neural network for velocity-residual inference; and (3) a lightweight deep residual convolutional neural network "
        "(PULP-DroNet v3) for real-time reactive obstacle avoidance and visual servoing."
    ))

    add_heading_3(doc, "3.4.1  15-State Error-State Extended Kalman Filter (ESKF)")

    add_body(doc, (
        "To eliminate mathematical singularities (gimbal lock) associated with Euler angles and avoid covariance rank deficiencies "
        "inherent in over-parameterized four-dimensional unit quaternions on the S³ sphere, the estimator adopts an Error-State formulation "
        "on the Lie group SO(3). The true state vector is split into a large-signal nominal state x_nom and a small-signal error state δx:"
    ))

    add_equation(doc, "x_true = x_nom ⊕ δx", "(3.1)")

    add_equation(doc, "x_nom = [ p, v, q, b_a, b_ω ]ᵀ ∈ ℝ³ × ℝ³ × S³ × ℝ³ × ℝ³", "(3.2)")

    add_equation(doc, "δx = [ δp, δv, δθ, δb_a, δb_ω ]ᵀ ∈ ℝ¹⁵", "(3.3)")

    add_body(doc, (
        "where p ∈ ℝ³ is position, v ∈ ℝ³ is velocity, q ∈ S³ is the attitude quaternion, b_a ∈ ℝ³ is accelerometer bias, "
        "b_ω ∈ ℝ³ is gyroscope bias, and δθ ∈ ℝ³ is the minimal rotation vector in the tangent space of SO(3). "
        "Between measurement updates, the nominal state is propagated forward at 100 Hz using measured specific force a_m "
        "and angular rate ω_m according to continuous-time rigid-body kinematics:"
    ))

    add_equation(doc, "dp/dt = v", "(3.4a)")
    add_equation(doc, "dv/dt = R(q) · (a_m − b_a) + g", "(3.4b)")
    add_equation(doc, "dq/dt = ½ · q ⊗ (ω_m − b_ω)", "(3.4c)")
    add_equation(doc, "db_a/dt = w_ba ,     db_ω/dt = w_bω", "(3.4d)")

    add_body(doc, (
        "where R(q) is the rotation matrix, g = [0, −9.80665, 0]ᵀ m/s² is gravity, and w_ba, w_bω are Gaussian random walks. "
        "The 15 × 15 error covariance matrix P is propagated discretely at step k:"
    ))

    add_equation(doc, "P_{k|k−1} = F_k · P_{k−1} · F_kᵀ + Q_d", "(3.5)")
    add_equation(doc, "F_k ≈ I₁₅ + F_x · Δt", "(3.6)")

    add_body(doc, (
        "where F_x is the continuous-time error Jacobian capturing acceleration coupling through R(q) and attitude cross-coupling "
        "via the skew-symmetric matrix [a_m − b_a]_×. Q_d is the discrete process noise covariance matrix parameterized by white noise "
        "variances σ_acc = 0.1 m/s²/√Hz, σ_gyro = 0.01 rad/s/√Hz, σ_bias,a = 1e-4 m/s²/√Hz, and σ_bias,g = 1e-5 rad/s²/√Hz."
    ))

    add_heading_3(doc, "3.4.2  Project Ghost GRU v3 Learned Navigation Model")

    add_body(doc, (
        "The velocity residual predictor utilizes a 2-layer Gated Recurrent Unit (GRU) architecture with 128 hidden units per layer. "
        "GRU achieves comparable representational power to Long Short-Term Memory (LSTM) networks while omitting the separate memory "
        "cell, reducing parameter count by 24% and enabling lower inference latency on embedded edge processors. "
        "The recurrence equations for time step t within the 101-step window are defined as:"
    ))

    add_equation(doc, "r_t = σ( W_r · x_t + U_r · h_{t−1} + b_r )     (Reset Gate)", "(3.7)")
    add_equation(doc, "z_t = σ( W_z · x_t + U_z · h_{t−1} + b_z )     (Update Gate)", "(3.8)")
    add_equation(doc, "h̃_t = tanh( W_h · x_t + U_h · (r_t ⊙ h_{t−1}) + b_h )     (Candidate)", "(3.9)")
    add_equation(doc, "h_t = (1 − z_t) ⊙ h_{t−1} + z_t ⊙ h̃_t     (Hidden State Update)", "(3.10)")

    add_body(doc, (
        "where x_t ∈ ℝ²⁴ is the normalized input feature vector, h_t ∈ ℝ¹²⁸ is the hidden state vector, σ(·) is the logistic sigmoid, "
        "and ⊙ denotes the element-wise Hadamard product. Recurrent dropout (p = 0.2) is applied between the two GRU layers. "
        "The final hidden state h₁₀₁ is normalized through LayerNorm(128) and projected through a multi-layer perceptron head: "
        "Linear(128, 64) → ReLU → Dropout(0.1) → Linear(64, 3), outputting the continuous velocity residual Δv = [Δvx, Δvy, Δvz]ᵀ. "
        "The complete GRU v3 network comprises exactly 166,915 trainable parameters."
    ))

    add_heading_3(doc, "3.4.3  PULP-DroNet v3 Deep Residual Vision Model")

    add_body(doc, (
        "To provide reactive collision avoidance from the forward-facing monocular camera without the heavy memory footprint of "
        "general-purpose object detection models, the system implements PULP-DroNet v3. Inspired by the Parallel Ultra-Low-Power (PULP) "
        "robotics computing paradigm, the network ingests a 1 × 200 × 200 grayscale image normalized to [0.0, 1.0] and passes it through "
        "an initial 5 × 5 convolution stem (stride 2) followed by a 2 × 2 max pooling layer, outputting 32 feature channels at 50 × 50 resolution. "
        "The spatial representation is processed through three cascading Residual Blocks (ResBlocks):"
    ))

    add_bullet(doc, "ResBlock 1 (32 channels, 50 × 50): ", "Two 3 × 3 convolutions with identity skip connection and ReLU activations.")
    add_bullet(doc, "ResBlock 2 (64 channels, 25 × 25): ", "Two 3 × 3 convolutions with stride 2 downsampling and 1 × 1 strided projection skip.")
    add_bullet(doc, "ResBlock 3 (128 channels, 13 × 13): ", "Two 3 × 3 convolutions with stride 2 downsampling and 1 × 1 strided projection skip.")

    add_body(doc, (
        "The resulting 128 × 13 × 13 feature tensor is flattened and fed to a shared fully connected layer of 128 units before branching "
        "into two specialized output heads: (1) Head 1 predicts normalized lateral steering angle α ∈ [−1.0, +1.0] via linear activation; "
        "(2) Head 2 predicts the probability of impending collision within 15 meters P_coll ∈ [0.0, 1.0] via a sigmoid activation function."
    ))

    add_caption(doc, "Table 3.5: Structural and Architectural Parameter Comparison of Navigation and Vision Models")

    tbl = doc.add_table(rows=5, cols=5)
    headers = ["Model Component", "Model Paradigm", "Input Shape", "Output Shape", "Trainable Parameters"]
    data = [
        ("15-State ESKF", "Analytical Extended Kalman Filter", "15-D state + IMU", "15-D state + Cov P(15×15)", "0 (Deterministic equations)"),
        ("Baseline LSTM", "2-Layer LSTM + Linear Head", "(101, 24)", "(3,) Velocity Residual Δv", "219,651 parameters"),
        ("Project Ghost GRU v3", "2-Layer GRU + LayerNorm + MLP", "(101, 24)", "(3,) Velocity Residual Δv", "166,915 parameters"),
        ("PULP-DroNet v3", "3-ResBlock CNN + Dual Head", "(1, 200, 200)", "Steering α (1,) + Risk P_coll (1,)", "312,450 parameters"),
    ]
    for j, h in enumerate(headers):
        tbl.rows[0].cells[j].paragraphs[0].text = h
    for i, row in enumerate(data, 1):
        for j, val in enumerate(row):
            tbl.rows[i].cells[j].paragraphs[0].text = val
    format_table(tbl, [Cm(3.4), Cm(4.0), Cm(2.8), Cm(4.0), Cm(2.8)])

def build_section_3_5(doc):
    add_heading_2(doc, "3.5  Model Training Methodology")

    add_body(doc, (
        "The model training strategy evolved across three distinct iterative phases to address closed-loop compounding errors. "
        "While standard supervised training optimizes static window-level loss, deploying a learned residual predictor in a closed-loop "
        "estimator causes recursive distribution shift. The complete training methodology is documented below:"
    ))

    add_heading_3(doc, "3.5.1  Supervised Architecture Selection: LSTM versus GRU")

    add_body(doc, (
        "In the initial exploratory phase, candidate recurrent architectures were benchmarked under identical supervised training conditions "
        "across the 2,771 training windows and evaluated on the 868 validation windows. Optimization was conducted using the Adam optimizer "
        "(learning rate 1e-3, batch size 64) minimizing Mean Squared Error on target velocity residuals: "
        "ℒ_MSE = (1/N) ∑ ||Δv_pred − Δv_target||². As recorded in project training log L07, the GRU achieved a validation macro-flight "
        "velocity RMSE of 41.952 m/s at checkpoint epoch 15, compared to 71.631 m/s for the LSTM at epoch 7. Concurrently, global validation "
        "RMSE dropped from 126.840 m/s (LSTM) to 72.454 m/s (GRU) while utilizing 24.0% fewer model parameters (166,915 vs. 219,651). "
        "Consequently, the GRU architecture was chosen for all subsequent development."
    ))

    add_heading_3(doc, "3.5.2  The Closed-Loop Distribution Shift Discovery (Early C0 Failure)")

    add_body(doc, (
        "Despite achieving strong supervised validation scores, deploying the early GRU model into a recursive closed-loop estimation "
        "pipeline (designated as the C0 integration experiment in log L08) revealed severe performance degradation. In the C0 experiment, "
        "network-predicted velocity pseudo-measurements were applied to the state estimator without safety gates. On held-out test flights, "
        "the macro position RMSE worsened from an unassisted baseline of 8,242.51 m to 16,103.59 m (a negative error reduction of −95.37%). "
        "Specifically, on flight transition_3, position RMSE doubled from 20,040.37 m to 41,209.15 m (−105.63%); on hamburgLock_3, RMSE rose "
        "from 91.48 m to 131.94 m (−44.22%); and on seq9, RMSE rose from 4,595.68 m to 6,969.68 m (−51.66%)."
    ))

    add_body(doc, (
        "Root-cause analysis established that recursive state updates alter downstream feature values (particularly ESKF velocity and "
        "orientation covariances), pushing them outside the static training distribution. Repeated unconstrained pseudo-measurements "
        "then amplified residual estimation errors rather than correcting them. This failure motivated two vital innovations: "
        "(1) iterative on-policy training data augmentation, and (2) rigorous multi-stage statistical safety gating."
    ))

    add_heading_3(doc, "3.5.3  V2 and V3 Balanced On-Policy Training Regimes")

    add_body(doc, (
        "To condition the GRU on feature regimes visited during recursive operation, the training corpus was augmented across multiple regimes. "
        "In iteration V2, recursive feedback states were captured, reducing validation position RMSE to 433.16 m. In iteration V3 (log L09), "
        "a balanced 8,313-window training dataset was created comprising three equal partitions: (1) 2,771 open-loop supervised windows "
        "derived from prediction-only ESKF traces; (2) 2,771 V1 closed-loop windows captured during early integration replays; and (3) 2,771 "
        "V2 on-policy windows sampled directly from the improved aided estimator with matched ground-truth residual targets."
    ))

    add_body(doc, (
        "Training was executed for 44 epochs with balanced batch sampling across regimes, data sources, and flight identities. "
        "The model selected for deployment was checkpoint Epoch 30, which attained a validation macro velocity RMSE of 2.23975 m/s, "
        "a global velocity RMSE of 2.32597 m/s, and a Mean Absolute Error of 1.74749 m/s. For PULP-DroNet v3, multi-task training utilized "
        "a combined objective: ℒ_total = ℒ_MSE(α, α̂) + 1.0 · ℒ_BCE(P_coll, P̂_coll), optimized with Adam (lr = 1e-4) over 50 epochs."
    ))

    add_caption(doc, "Table 3.6: Training Progression and Quantitative Evolution Across Model Iterations")

    tbl_tr = doc.add_table(rows=5, cols=5)
    tr_hdrs = ["Model Iteration", "Training Windows", "Data Composition Regime", "Selected Epoch", "Validation Metric"]
    tr_data = [
        ("C0 Supervised Baseline", "2,771", "Open-loop prediction-only ESKF traces", "Epoch 15", "Val Macro Vel RMSE: 41.952 m/s"),
        ("C0 Closed-Loop Test", "2,771", "Recursive unconstrained integration", "Epoch 15", "Held-out Pos RMSE worsened by −95.37%"),
        ("V2 Recursive Feedback", "5,542", "Open-loop + V1 recursive replay windows", "Epoch 22", "Val Macro Pos RMSE: 433.16 m"),
        ("V3 Balanced On-Policy", "8,313", "Open-loop (2,771) + V1 (2,771) + V2 (2,771)", "Epoch 30", "Val Macro Vel RMSE: 2.23975 m/s"),
    ]
    for j, h in enumerate(tr_hdrs):
        tbl_tr.rows[0].cells[j].paragraphs[0].text = h
    for i, row in enumerate(tr_data, 1):
        for j, val in enumerate(row):
            tbl_tr.rows[i].cells[j].paragraphs[0].text = val
    format_table(tbl_tr, [Cm(3.2), Cm(2.4), Cm(4.8), Cm(2.2), Cm(4.4)])

def build_section_3_6(doc):
    add_heading_2(doc, "3.6  Integration of the Models into the Complete System")

    add_body(doc, (
        "Deploying deep learning residual models within an active flight stack requires rigorous mathematical safety architectures "
        "to prevent catastrophic drift amplification. The complete system integrates the dual-ESKF estimation paradigm, a four-stage "
        "statistical safety gating pipeline, Joseph-form covariance stabilization, and reactive visual arbitration."
    ))

    add_heading_3(doc, "3.6.1  Dual-ESKF Decoupled State Estimation Architecture")

    add_body(doc, (
        "As established in Section 3.1, the navigation stack executes two synchronized 15-state ESKF instances in parallel: "
        "(1) The Feature ESKF integrates raw IMU signals at 100 Hz in pure prediction mode, maintaining a pristine rolling buffer of 24 "
        "features that strictly preserves the input distribution learned during offline training; (2) The Aided ESKF executes identical "
        "IMU propagation but accepts validated pseudo-velocity updates: z_v = v_feature + Δv_pred."
    ))

    add_heading_3(doc, "3.6.2  Four-Stage Statistical Safety Gating Pipeline")

    add_body(doc, (
        "Every candidate velocity correction Δv generated by the GRU v3 model must successfully pass four sequential safety gates "
        "before being admitted into the Aided ESKF measurement update:"
    ))

    add_bullet(doc, "1. Out-Of-Distribution (OOD) Gate (Mahalanobis Distance): ",
        "A 48-dimensional summary vector (concatenating the temporal mean and standard deviation of all 24 normalized features across "
        "the 101-step window) is evaluated against a Ledoit-Wolf shrinkage covariance model fitted strictly on the V2 on-policy training data. "
        "The Mahalanobis squared distance D_M² = (x_summary − μ_train)ᵀ Σ_LW⁻¹ (x_summary − μ_train) must not exceed the calibrated "
        "95th percentile threshold: D_M² ≤ 74.8123. If exceeded, the correction is flagged as out-of-distribution and rejected.")

    add_bullet(doc, "2. Temporal Jump Continuity Gate: ",
        "To prevent abrupt actuator shock and discontinuous velocity transients, the Euclidean L2 norm of the difference between consecutive "
        "GRU velocity residual predictions must not exceed the train-derived 95th percentile threshold: "
        "||Δv_k − Δv_{k−1}||₂ ≤ 4.59027 m/s. Candidates exceeding this threshold are rejected.")

    add_bullet(doc, "3. Normalized Innovation Squared (NIS) Statistical Gate: ",
        "The innovation vector y = z_v − v_aided is tested against the innovation covariance S = H P Hᵀ + R_noise, where "
        "H = [0₃×₃, I₃×₃, 0₃×₉] selects the velocity error states, and R_noise is the empirical 3 × 3 residual covariance matrix "
        "(diag = [10.926, 22.102, 17.566]). The scalar NIS metric is computed as NIS = yᵀ S⁻¹ y. Under the hypothesis of consistent "
        "Gaussian innovations, NIS follows a χ² distribution with 3 degrees of freedom. At the 99% confidence level, updates are admitted "
        "only if NIS ≤ 11.34487.")

    add_bullet(doc, "4. Severe NIS Circuit-Breaker and Cooldown Failsafe: ",
        "If a candidate correction yields an anomalous innovation exceeding four times the nominal threshold (NIS > 45.37947), "
        "a software circuit-breaker trips immediately: the correction is rejected, updates enter a mandatory cooldown lock for "
        "4 consecutive update cycles (12 seconds), and normal fusion resumes only after 3 consecutive healthy updates pass.")

    add_heading_3(doc, "3.6.3  Joseph-Form Covariance Stabilization")

    add_body(doc, (
        "When an update passes all gates, error states are computed via the optimal Kalman gain K = P Hᵀ S⁻¹ and injected into nominal states: "
        "p ← p + δp, v ← v + δv, q ← q ⊗ exp(½ δθ), b_a ← b_a + δb_a, b_ω ← b_ω + δb_ω. To guarantee numerical symmetry and positive "
        "semi-definiteness under floating-point precision, the covariance is updated using the stabilized Joseph formula:"
    ))

    add_equation(doc, "P ← ( I − K · H ) · P · ( I − K · H )ᵀ + K · R_noise · Kᵀ", "(3.11)")

    add_heading_3(doc, "3.6.4  PULP-DroNet Visual Collision Arbitration Matrix")

    add_body(doc, (
        "The guidance layer arbitrates between global waypoint tracking and reactive DroNet obstacle avoidance using a dynamic weighting "
        "matrix based on the collision probability P_coll: v_cmd = (1 − w_avoid) · v_GRU + w_avoid · v_avoid(α). "
        "Three distinct flight regimes are enforced: (1) Free Corridor (P_coll < 0.30): w_avoid = 0.0 (pure waypoint flight); "
        "(2) Active Avoidance (0.30 ≤ P_coll < 0.75): w_avoid = (P_coll − 0.30) / (0.75 − 0.30), injecting a lateral evasion velocity "
        "proportional to steering angle α; (3) Emergency Braking (P_coll ≥ 0.75): w_avoid = 1.0, forward velocity is braked to zero, "
        "full lateral evasion is commanded, and an emergency vertical climb of +2.5 m/s is initiated."
    ))

    add_caption(doc, "Table 3.7: Statistical Safety Gate Parameters, Calibration Quantiles, and Pass Rates")

    tbl_gt = doc.add_table(rows=5, cols=5)
    gt_hdrs = ["Safety Gate Mechanism", "Mathematical Metric", "Threshold Value", "Calibration Baseline", "Validation Pass Rate"]
    gt_data = [
        ("OOD Gate", "48D Mahalanobis D_M² (Ledoit-Wolf)", "74.8123", "Train V2 on-policy Q950", "98.73% (11 rejections)"),
        ("Temporal Jump Gate", "L2 Norm ||Δv_k − Δv_{k−1}||₂", "4.59027 m/s", "Train V2 on-policy Q950", "99.42% (5 rejections)"),
        ("NIS Innovation Gate", "Quadratic Form yᵀ S⁻¹ y", "11.34487", "χ² distribution (3 DoF, 99%)", "96.89% (841 / 868 accepted)"),
        ("Severe NIS Breaker", "Circuit-Breaker Factor (4 × NIS)", "45.37947", "Anomaly rejection threshold", "100% stable recovery"),
    ]
    for j, h in enumerate(gt_hdrs):
        tbl_gt.rows[0].cells[j].paragraphs[0].text = h
    for i, row in enumerate(gt_data, 1):
        for j, val in enumerate(row):
            tbl_gt.rows[i].cells[j].paragraphs[0].text = val
    format_table(tbl_gt, [Cm(3.4), Cm(4.2), Cm(2.2), Cm(3.6), Cm(3.6)])

print("section_3_4_to_3_6.py ready.")
