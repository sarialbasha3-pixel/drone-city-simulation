"""
section_3_10_to_3_12.py
Constructs Sections 3.10, 3.11, 3.12.
"""

from docx.shared import Pt, Cm
from build_full_chapter3 import (
    add_heading_2, add_heading_3, add_body, add_bullet, add_caption, format_table
)

def build_section_3_10(doc):
    add_heading_2(doc, "3.10  Performance Evaluation and Discussion")

    add_body(doc, (
        "A rigorous scientific evaluation of the proposed navigation architecture requires contextualizing both the relative "
        "percentage improvements and the absolute physical error magnitudes. An objective analysis of the experimental findings "
        "yields several vital technical insights:"
    ))

    add_heading_3(doc, "3.10.1  Interpreting the 92.91% Error Reduction")

    add_body(doc, (
        "In academic engineering reporting, an error reduction against an unassisted baseline must never be conflated with classification "
        "accuracy. The 92.91% figure documented in Section 3.9 represents a relative attenuation of uncorrected inertial drift across "
        "the three validation flights: (RMSE_baseline − RMSE_aided) / RMSE_baseline. Because the baseline ESKF operates in pure dead-reckoning "
        "mode without external GNSS position fixes, uncorrected accelerometer and gyroscope biases integrate quadratically over time: "
        "p(t) ≈ ½ (a_meas − b_a) t². On long flights (such as indoor_1, spanning over 15 minutes of continuous maneuvering), "
        "unassisted drift accumulates to over 15,000 meters. The Safe GRU V3 policy successfully reduces this error to 614.10 meters."
    ))

    add_body(doc, (
        "While a relative reduction of 92.91% proves that the recurrent network extracts highly informative velocity corrections from temporal "
        "IMU patterns, an absolute residual position RMSE of 455.24 meters remains too large for meter-level waypoint delivery across "
        "unconstrained 15-minute missions without occasional absolute landmark resets. Conversely, within bounded closed-loop flight "
        "corridors (as demonstrated in the live simulation tests in Section 3.8, spanning 50 to 72 seconds), the system achieves sub-4-meter "
        "position RMSE (3.830 m on the 268.3 m path), proving that the learned residual architecture provides effective drift suppression "
        "during tactical flight intervals."
    ))

    add_heading_3(doc, "3.10.2  Distinguishing Environmental Labels from Sensor Telemetry")

    add_body(doc, (
        "The environmental metadata associated with the 19 flights (e.g., 'Rain / calm wind / maritime', 'Light rain / wind gusts', "
        "'Night', and 'Mars analog desert') provide valuable stratification categories for evaluating model robustness across diverse "
        "operating regimes. However, as emphasized in the research progress audit, these tags represent collection metadata rather than "
        "synchronized physical weather telemetry. The source datasets do not provide calibrated numerical wind velocity vectors (in m/s), "
        "barometric humidity, or rain precipitation rates (in mm/h). Consequently, the superior tracking observed in Wicklow mountain "
        "recordings demonstrates that the model generalizes across recordings tagged with wind gusts, but cannot be interpreted as a "
        "causal aerodynamic ablation across specific wind velocity gradients."
    ))

    add_heading_3(doc, "3.10.3  Computational Latency and Real-Time Feasibility")

    add_body(doc, (
        "Deploying deep learning on resource-constrained UAV flight computers requires strict latency compliance. In the implemented "
        "architecture, the GRU v3 model executes an inference cycle in 12.1 ms to 26.4 ms on standard workstation hardware (with a 3.0-second "
        "call cadence), consuming less than 1% of total processor throughput. Concurrently, PULP-DroNet v3 processes 200 × 200 grayscale "
        "frames in 8.5 ms to 12.0 ms per frame at 30 Hz. The Three.js WebGL simulation maintains a rock-solid 60 FPS graphics rendering rate "
        "and 100 Hz physics integration, proving that the decoupled microservice architecture successfully resolves real-time execution bottlenecks."
    ))

def build_section_3_11(doc):
    add_heading_2(doc, "3.11  Methodological Limitations and Reproducibility")

    add_body(doc, (
        "Transparently reporting system boundaries and methodological constraints is essential for scientific integrity. "
        "The following operational limitations and reproducibility protocols characterize the current research implementation:"
    ))

    add_heading_3(doc, "3.11.1  Methodological Boundaries and Constraints")

    add_bullet(doc, "1. Vulnerability to Closed-Loop Distribution Shift (C0 Failure): ",
        "As established in Section 3.5.2, naive unconstrained recursive feedback causes estimator divergence when model errors compound. "
        "Although the four-stage safety gating pipeline and on-policy training successfully mitigate this in the reported validation flights, "
        "the estimator remains sensitive to extreme out-of-distribution dynamic maneuvers.")

    add_bullet(doc, "2. Requirement for Independent Pristine External Testing: ",
        "Because early exploratory diagnostics (such as the C0 experiment) were examined during iterative development, a truly unbiased "
        "claim of operational generalization requires future validation on an entirely new, external flight dataset recorded under "
        "independent physical hardware and environmental conditions.")

    add_bullet(doc, "3. Ground-Truth Reference Status: ",
        "Ground-truth position and velocity channels are strictly utilized offline to generate supervised residual training labels "
        "(Δv = v_GT − v_ESKF) and compute evaluation error metrics. Ground truth is never an online measurement in the navigation loop.")

    add_bullet(doc, "4. Absence of Calibrated Wind Anemometer Ground Truth: ",
        "Because source datasets lack measured atmospheric wind telemetry, aerodynamic disturbance compensation cannot be isolated "
        "from sensor noise or airframe vibrations.")

    add_heading_3(doc, "3.11.2  Reproducibility Protocols and Artifact Preservation")

    add_body(doc, (
        "To guarantee complete scientific reproducibility, all project artifacts, configurations, model weights, and execution scripts "
        "are strictly versioned and preserved within the project repository:"
    ))

    add_bullet(doc, "Deterministic Config Files: ",
        "`PROJECT_GHOST_GRU_ITERATION_3_CONFIG.json`, `PROJECT_GHOST_GRU_V3_SELECTED_SAFETY_GATE.json`, and "
        "`PROJECT_GHOST_RNN_WINDOWS_1S_FINAL_V1_CONFIG.json` define all model dimensions, random seeds, and gate thresholds.")

    add_bullet(doc, "Frozen Pre-Trained Weights: ",
        "`PROJECT_GHOST_GRU_V3_BEST_VALIDATION.pt` (checkpoint epoch 30) and `pulp-dronet-v3-resblock-1.0.pth` are stored in the repository "
        "with cryptographically verified parameter counts.")

    add_bullet(doc, "Train-Only Normalization Scalers: ",
        "`PROJECT_GHOST_GRU_V3_INPUT_NORMALIZATION_TRAIN_ONLY.csv` and `PROJECT_GHOST_GRU_V3_TARGET_NORMALIZATION_TRAIN_ONLY.csv` "
        "preserve the exact feature means and standard deviations fitted on the 13 training flights.")

    add_bullet(doc, "Automated Multi-Service Orchestrator: ",
        "`run_simulation.bat` and `package.json` ensure that any standard workstation can replicate the complete multi-service "
        "environment with a single command.")

def build_section_3_12(doc):
    add_heading_2(doc, "3.12  Chapter Summary")

    add_body(doc, (
        "This chapter has established the comprehensive methodological, architectural, and mathematical foundation of the autonomous "
        "UAV urban navigation system. By addressing the critical challenge of GPS-denied navigation through a principled combination of "
        "classical estimation theory, deep recurrent neural networks, and reactive computer vision, the proposed framework accomplishes "
        "the following core technical contributions:"
    ))

    add_bullet(doc, "Decoupled Microservice Topology: ",
        "Successfully isolated high-rate 100 Hz state estimation and 60 FPS WebGL simulation from deep learning inference across "
        "three dedicated TCP/IP services (Ports 3000, 8765, and 8766), eliminating thread blocking and non-deterministic latency spikes.")

    add_bullet(doc, "1.42M-Sample Multi-Source Dataset: ",
        "Curated 1,422,348 preserved real-data feature rows across 19 physical flights (INSANE, LandingUAV, PanoAir) under a flight-disjoint "
        "protocol, standardized to a 100 Hz temporal grid with Gram-Schmidt Rotation-6D orthonormalization and 24 continuous features.")

    add_bullet(doc, "Dual-ESKF and Learned Residual Architecture: ",
        "Formulated the 15-state Error-State Extended Kalman Filter on the Lie group SO(3) paired with the 166,915-parameter Project Ghost "
        "GRU v3 network, predicting 3D velocity residuals from 101-step historical context windows.")

    add_bullet(doc, "Multi-Stage Statistical Safety Gating: ",
        "Engineered four sequential safety filters—48D Ledoit-Wolf Mahalanobis OOD gating (threshold 74.81), temporal jump continuity "
        "(threshold 4.59 m/s), 3-DoF NIS statistical gating (threshold 11.34), and severe NIS circuit-breakers with Joseph-form covariance "
        "stabilization—preventing estimator divergence during closed-loop recursive feedback.")

    add_bullet(doc, "PULP-DroNet v3 Reactive Visual Servoing: ",
        "Implemented a lightweight 3-ResBlock convolutional vision model processing 200 × 200 grayscale streams to dynamically arbitrate "
        "between waypoint guidance and emergency obstacle avoidance based on real-time collision probability P_coll.")

    add_bullet(doc, "Empirical Validation & Benchmark Results: ",
        "Demonstrated a 92.91% macro position RMSE reduction (6,421.49 m to 455.24 m) and 92.18% velocity RMSE reduction on offline "
        "validation flights, alongside sub-4-meter trajectory tracking (3.830 m RMSE) in closed-loop 3D urban simulation.")

    add_body(doc, (
        "With the system methodology, model architectures, safety gating mechanics, and operational workflows thoroughly formulated "
        "and documented, the technical foundation is complete for proceeding to Chapter 4, which presents extensive experimental "
        "evaluations, closed-loop trajectory tracking benchmarks, and ablation studies under complex urban operating conditions."
    ))

print("section_3_10_to_3_12.py ready.")
