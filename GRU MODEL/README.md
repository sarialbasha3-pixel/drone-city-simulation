# Project Ghost — GRU V3 Simulation Integration Bundle

This bundle is for connecting the frozen **Project Ghost GRU V3** motion-drift correction model to an existing **HTML / CSS / JavaScript / Three.js** drone simulation.

## 1. What is in this bundle

- `model/PROJECT_GHOST_GRU_V3_BEST_VALIDATION.pt` — frozen PyTorch GRU V3 checkpoint.
- `config/PROJECT_GHOST_GRU_V3_INPUT_NORMALIZATION_TRAIN_ONLY.csv` — exact train-only input mean/std values.
- `config/PROJECT_GHOST_GRU_V3_TARGET_NORMALIZATION_TRAIN_ONLY.csv` — exact train-only target mean/std values.
- `config/PROJECT_GHOST_GRU_ITERATION_3_CONFIG.json` — GRU V3 experiment configuration.
- `config/PROJECT_GHOST_RNN_GRID100HZ_NORMALIZATION_V1_CONFIG.json` — exact 100 Hz / 101-step model input contract.
- `config/PROJECT_GHOST_RNN_FEATURES_V1_CONFIG.json` — exact 24-feature order and target definition.
- `config/PROJECT_GHOST_RNN_WINDOWS_1S_FINAL_V1_CONFIG.json` — selected 1-second context window details.
- `config/PROJECT_GHOST_GRU_V3_SELECTED_SAFETY_GATE.json` — saved safety-gate calibration metadata.
- `model_runtime.py` — verified Python loader/inference runtime for the checkpoint.
- `server_fastapi.py` — small HTTP bridge so a browser simulation can call the PyTorch model.
- `integration_contract.json` — machine-readable integration contract for another coding AI.

The V3 data source contains **1,422,348 synchronized feature rows across 19 flights**. The final GRU V3 training experiment used **8,313 windows** across three balanced regimes: 2,771 OPEN_LOOP + 2,771 V1_CLOSED + 2,771 V2_ONPOLICY. Do not describe this as 1.422 million independent GRU windows.

---

# 2. Critical model facts — DO NOT CHANGE

The frozen model expects:

- Input shape: **`[batch, 101, 24]`**
- Time context: **1.0 second**
- Common input grid: **100 Hz**
- 101 samples include both endpoints of the 1-second interval.
- Output: **3 values** = normalized velocity-residual prediction.
- After target de-normalization, output is:

`delta_v = [dvx, dvy, dvz]` in m/s

The model does **not** predict absolute position and does **not** replace the ESKF.

Runtime pseudo measurement:

`v_pseudo = v_ESKF + delta_v_predicted`

Then use `v_pseudo` as the learned velocity measurement in the ESKF update.

### Exact frozen network

- PyTorch GRU
- input size: 24
- hidden size: 128
- GRU layers: 2
- GRU dropout: 0.20
- LayerNorm(128)
- Linear 128 -> 64
- **ReLU**
- Dropout 0.10
- Linear 64 -> 3
- parameter count: 166,915

The `model_runtime.py` architecture was verified against the saved validation rollout and reproduces the checkpoint validation macro-flight RMSE (~2.23975 m/s under the saved metric definition). Do not replace ReLU with GELU/SiLU/Tanh.

---

# 3. Important timing distinction

The trained pipeline selected a **1-second input window** and a **0.5-second native correction stride**.

For the requested simulation demonstration, the UI should call the model **once every 3 seconds**.

Therefore:

- Keep collecting IMU + ESKF features continuously.
- Keep a rolling 1-second buffer.
- When 3 seconds have elapsed, send the **latest 1 second / 101 samples**, not a 3-second model window.
- The 3-second cadence is a demonstration choice. It is not the cadence used in the original V3 evaluation and may reduce correction performance.
- Keep this constant configurable:

`MODEL_CORRECTION_INTERVAL_S = 3.0`

For a later fidelity mode, change it to:

`MODEL_CORRECTION_INTERVAL_S = 0.5`

Do not retrain or change the GRU window shape just to support the 3-second UI cadence.

---

# 4. Exact 24 input features, in exact order

Every row sent to the model must contain these 24 values in this exact order:

1. `feat_gx_rad_s`
2. `feat_gy_rad_s`
3. `feat_gz_rad_s`
4. `feat_ax_m_s2`
5. `feat_ay_m_s2`
6. `feat_az_m_s2`
7. `feat_eskf_vx_m_s`
8. `feat_eskf_vy_m_s`
9. `feat_eskf_vz_m_s`
10. `feat_rot6d_r11`
11. `feat_rot6d_r21`
12. `feat_rot6d_r31`
13. `feat_rot6d_r12`
14. `feat_rot6d_r22`
15. `feat_rot6d_r32`
16. `feat_sigma_px_m`
17. `feat_sigma_py_m`
18. `feat_sigma_pz_m`
19. `feat_sigma_vx_m_s`
20. `feat_sigma_vy_m_s`
21. `feat_sigma_vz_m_s`
22. `feat_sigma_theta_x_rad`
23. `feat_sigma_theta_y_rad`
24. `feat_sigma_theta_z_rad`

### Feature sources inside the simulation

**IMU:**
- gyro x/y/z in rad/s
- accelerometer x/y/z in m/s²

**ESKF nominal state:**
- current predicted velocity x/y/z
- current attitude

**Rotation6D:**
- build body-to-world rotation matrix `R_WB` from the ESKF attitude.
- use the first two columns exactly in this order:
  `r11, r21, r31, r12, r22, r32`.
- if values are interpolated onto the 100 Hz grid, re-orthonormalize the two rotation columns with Gram-Schmidt before use.

**ESKF covariance:**
- position sigma = square root of diagonal position variances.
- velocity sigma = square root of diagonal velocity variances.
- attitude sigma = square root of diagonal small-angle variances, in radians.

Do not feed Ground Truth, route coordinates, target waypoints, or true drone position to the GRU.

---

# 5. Browser / PyTorch architecture

Do **not** attempt to load the `.pt` checkpoint directly in ordinary browser JavaScript.

Recommended architecture:

```text
HTML/CSS/Three.js simulation
        |
        | POST /infer every 3 s in demo mode
        v
Local Python FastAPI bridge
        |
        v
GRU V3 PyTorch checkpoint
        |
        | delta_v = [dvx,dvy,dvz]
        v
JavaScript ESKF Update
        |
        v
corrected state -> path controller -> visible drone
```

The model runs locally in Python. The Three.js page communicates with it over localhost HTTP.

---

# 6. Start the model service

From this bundle directory:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn server_fastapi:app --host 127.0.0.1 --port 8765
```

Health check:

```text
GET http://127.0.0.1:8765/health
```

Inference:

```text
POST http://127.0.0.1:8765/infer
Content-Type: application/json
```

Request body:

```json
{
  "features": [[24 values], "... exactly 101 rows total ..."],
  "eskf_velocity_m_s": [1.0, 0.2, -0.1]
}
```

Response:

```json
{
  "delta_v_m_s": [0.12, -0.08, 0.03],
  "prediction_norm_m_s": 0.147,
  "pseudo_velocity_m_s": [1.12, 0.12, -0.07]
}
```

Numbers above are only an API-format example, not a saved model result.

---

# 7. Required Three.js feature: Route Mode (`M`)

The coding AI integrating this bundle into the existing simulation must implement the following without replacing the current scene architecture.

## Press `M`

Enter **Route Mode**.

Show a clean, empty 2D drawing panel/canvas above the simulation. The user draws a path with mouse or pointer input.

Recommended state:

```js
routeMode = true;
routePoints2D = [];
routePointsWorld = [];
```

Capture:

- `pointerdown` -> start stroke
- `pointermove` -> append normalized `(u,v)` coordinates
- `pointerup` -> finish stroke

Remove duplicate/very-close points and resample the drawn curve to a smooth sequence.

Map the 2D panel path into the simulation ground plane. The exact world scale must use the existing simulation bounds; do not hard-code a new scene scale if the current simulation already has one.

Typical mapping concept:

```text
panel x -> world X
panel y -> world Z
route altitude -> existing configured flight altitude / current planned altitude
```

Render the planned route in Three.js as a **transparent/semi-transparent line**. It should remain visible after Route Mode closes.

Use the existing visual language of the simulation. Do not rebuild the whole UI.

Pressing `M` again may exit drawing mode while preserving the route. `S` must also be able to start directly after a valid route is drawn.

---

# 8. Required Three.js feature: Start (`S`)

When the user presses `S`:

1. Validate that a route exists.
2. Reset/initialize simulation run state and ESKF state.
3. Start the route-following controller.
4. Start the fixed-step IMU/ESKF loop.
5. Continuously build the 24-feature buffer.
6. Once 101 valid 100 Hz samples exist, GRU inference is possible.
7. In requested demo mode, trigger GRU inference every 3 seconds.
8. Apply accepted velocity correction through the ESKF update.
9. Continue predicting until the next correction.

If there is no route, `S` must not start flight; show a small non-blocking message instead.

---

# 9. Simulation timing: decouple physics from rendering

Three.js `requestAnimationFrame()` is usually around 60 Hz and must not be treated as the model sample clock.

Use a fixed simulation/IMU time step of 0.01 s (100 Hz), or timestamp raw higher/lower-rate simulation samples and resample the latest one-second interval to the exact grid:

```text
t_now - 1.00 s
t_now - 0.99 s
...
t_now
```

This produces exactly 101 rows.

Original preprocessing used **timestamp-aware linear interpolation**, with no extrapolation. Rotation6D values were re-orthonormalized after interpolation.

Rendering stays on `requestAnimationFrame()` independently.

---

# 10. Input normalization and output de-normalization

Do not implement arbitrary normalization in JavaScript.

The included Python runtime performs the exact frozen transform:

```text
x_norm[j] = (x[j] - train_mean[j]) / train_std[j]
```

using `PROJECT_GHOST_GRU_V3_INPUT_NORMALIZATION_TRAIN_ONLY.csv`.

After GRU inference:

```text
delta_v[j] = pred_norm[j] * target_train_std[j] + target_train_mean[j]
```

using `PROJECT_GHOST_GRU_V3_TARGET_NORMALIZATION_TRAIN_ONLY.csv`.

Therefore the browser should send **raw physical feature values in the exact units above**, and the Python bridge should handle normalization.

---

# 11. ESKF + GRU update loop

The visual demonstration must represent the real intended architecture:

```text
IMU
 -> ESKF Predict
 -> build 24 features
 -> rolling 1 s / 101x24 buffer
 -> GRU V3
 -> predicted delta_v
 -> v_pseudo = v_ESKF + delta_v
 -> ESKF velocity measurement update
 -> corrected ESKF state
 -> next ESKF Predict
```

Do not directly add the predicted delta-v to the drone world position.

The GRU output is a **velocity residual**. It must become a pseudo-velocity measurement for the Kalman update.

For a 15-state error ESKF ordered as:

```text
[delta_p, delta_v, delta_theta, delta_ba, delta_bg]
```

the velocity measurement Jacobian selects the velocity error block. Use the existing project ESKF conventions rather than introducing a second incompatible Kalman implementation.

The saved V3 pseudo-measurement covariance matrix `R` and NIS threshold are in `PROJECT_GHOST_GRU_ITERATION_3_CONFIG.json`.

Use a Joseph-form covariance update if that is already the project convention.

---

# 12. How to make corrections visible without falsifying the estimator

The simulation should visually demonstrate drift correction:

- The transparent line is the planned route.
- The path controller attempts to follow it using the **estimated/corrected** state.
- IMU noise and bias should cause prediction-only drift between learned updates.
- Each accepted GRU/ESKF update should reduce the estimator error and influence subsequent control, causing the drone to return closer to the planned route.

Do not secretly snap the drone to the planned route or Ground Truth when an update occurs.

For appearance only, the Three.js mesh may interpolate over ~0.2–0.4 s toward the newly corrected rendered pose so that the correction is visible but not an ugly teleport. The underlying ESKF state update should remain mathematically immediate.

Recommended debug HUD fields:

```text
MODE: ROUTE / RUNNING
GRU: READY / WAITING / UPDATE
Last correction: +dvx, +dvy, +dvz m/s
Next GRU update: 2.4 s
Distance from planned route: ... m
NIS: ...
Gate: APPLIED / REJECTED
```

---

# 13. Safety gating

The bundle includes the selected safety-gate metadata. Important details:

- NIS threshold: `11.344866730144373` for 3 DOF at 99% confidence.
- Selected temporal prediction-jump threshold: about `4.590267 m/s`.
- Circuit breaker metadata is saved in the safety-gate JSON.

However, the selected OOD detector was a **LedoitWolf covariance model fitted on a 48D mean+std summary of V2_ONPOLICY_TRAIN_ONLY windows**. The fitted covariance/precision matrix itself is not present in the compact saved model folder provided here. A threshold alone is not enough to reproduce that detector exactly.

Therefore the coding AI must **not pretend the original OOD gate is reproduced**. For the first simulation integration:

- connect the frozen GRU correctly,
- keep NIS / temporal-jump handling if the required ESKF covariance is available,
- label OOD gate as unavailable/disabled unless its fitted estimator parameters are separately exported later.

Never reject or apply corrections using invented OOD statistics.

---

# 14. JavaScript-side control flow

Use this as the integration blueprint, adapting names to the existing simulation code rather than replacing everything:

```js
const MODEL_URL = 'http://127.0.0.1:8765/infer';
const MODEL_CORRECTION_INTERVAL_S = 3.0; // requested demo mode
const MODEL_WINDOW_S = 1.0;
const MODEL_HZ = 100;
const MODEL_STEPS = 101;

let featureBuffer = [];
let timeSinceLastModelUpdate = 0;

function fixedSimulationStep(dt = 0.01) {
  // 1) physics / path controller
  // 2) synthesize/read IMU
  // 3) ESKF prediction
  // 4) build exact 24 raw features
  // 5) push {timestamp, features} into rolling buffer
  // 6) preserve at least latest 1 second
}

async function maybeRunGRU(dt) {
  timeSinceLastModelUpdate += dt;
  if (timeSinceLastModelUpdate < MODEL_CORRECTION_INTERVAL_S) return;
  if (!haveFullOneSecondHistory()) return;

  timeSinceLastModelUpdate = 0;
  const window101x24 = resampleLatestSecondTo100Hz();

  const response = await fetch(MODEL_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      features: window101x24,
      eskf_velocity_m_s: [eskf.vx, eskf.vy, eskf.vz]
    })
  });

  const correction = await response.json();

  // IMPORTANT: do not alter position directly.
  // Run velocity pseudo-measurement through ESKF Update.
  applyLearnedVelocityMeasurement(correction.pseudo_velocity_m_s);
}
```

Do not call the endpoint once per render frame.

---

# 15. What the later coding AI must preserve

When this bundle is given together with the existing HTML/CSS/JS/Three.js simulation, the coding AI must:

1. Read this entire README before editing code.
2. Inspect the existing simulation architecture first.
3. Add Route Mode on `M` rather than rebuilding the project.
4. Add Start on `S`.
5. Keep the planned route visible as a transparent Three.js line.
6. Keep IMU/ESKF sampling independent of render FPS.
7. Build the exact 24 features in exact order and units.
8. Build a 101x24 one-second 100 Hz input window.
9. Call the Python GRU bridge every 3 seconds in the requested demo mode.
10. Apply `delta_v` as a pseudo-velocity measurement through ESKF Update.
11. Never use route coordinates or Ground Truth as GRU inputs.
12. Never directly snap the drone to the route when a model update occurs.
13. Add clear debug status so the demonstration visibly distinguishes prediction drift and GRU/ESKF corrections.
14. Keep all original simulation features working unless a change is strictly required for integration.

---

# 16. Acceptance test for the finished simulation

The integration is considered successful only when all of the following work:

- Pressing `M` opens the path drawing panel.
- Drawing with the mouse creates a route.
- The route appears in Three.js as a persistent semi-transparent line.
- Pressing `S` starts the drone along that route.
- A 100 Hz ESKF/feature loop runs independently of rendering.
- `/health` reports the GRU model loaded.
- Every 3 seconds after sufficient history exists, the browser sends exactly 101x24 raw features.
- The server returns a 3D `delta_v` correction.
- The correction is applied through ESKF Update, not direct position editing.
- The HUD logs each model update and whether it was applied/rejected.
- The visible drone exhibits drift between updates and observable course correction after accepted updates.
- No Ground Truth or planned-route coordinate is passed to GRU V3.

---

# 17. Scientific note

This simulation integration is a demonstration bridge for the frozen GRU V3 model. The model was developed from the Project Ghost V3 dataset and learned to predict ESKF velocity residuals. The simulation should demonstrate the intended learned-aiding mechanism faithfully; it must not manufacture better results by using route or Ground Truth information as an estimator correction.
