/**
 * GRUBridge.js
 *
 * Manages all communication between the Three.js simulation and the
 * local Python FastAPI GRU V3 inference bridge.
 *
 * Architecture (from README Section 14):
 *   fixedSimulationStep() → featureBuffer → resampleLatestSecondTo100Hz()
 *   → POST /infer (every 3 s) → delta_v → ESKF.updateVelocity()
 */
export class GRUBridge {
  constructor(options = {}) {
    this.MODEL_URL = options.url || 'http://127.0.0.1:8765/infer';
    this.HEALTH_URL = options.healthUrl || 'http://127.0.0.1:8765/health';

    // Configurable cadence (README §3)
    this.MODEL_CORRECTION_INTERVAL_S = options.correctionInterval ?? 3.0;
    this.MODEL_WINDOW_S   = 1.0;
    this.MODEL_HZ         = 100;
    this.MODEL_STEPS      = 101;

    this.timeSinceLastUpdate = 0;
    this.bridgeReady    = false;
    this.lastDeltaV     = null;   // [dvx, dvy, dvz]
    this.lastNIS        = null;
    this.lastGateResult = null;   // 'APPLIED' | 'REJECTED' | null
    this.nextUpdateIn   = this.MODEL_CORRECTION_INTERVAL_S;
    this.status         = 'WAITING'; // 'WAITING' | 'READY' | 'UPDATE'
    this.updateCount    = 0;

    // Rolling feature buffer: entries = { t_sim: number, features: number[24] }
    this.featureBuffer = [];

    // GRU measurement noise covariance R (from config JSON)
    this.R_noise = [
      [10.926068738358813,  8.467179724140863,  6.626947338769674],
      [ 8.467179724140863, 22.101554253742748,  8.100015736297278],
      [ 6.626947338769674,  8.10001573629728,  17.565651871856858],
    ];

    // Temporal jump threshold from safety gate (§13)
    this.TEMPORAL_JUMP_THRESHOLD = 4.590267; // m/s

    // Check health on startup and keep status updated continuously
    this._checkHealth();
    this._healthInterval = setInterval(() => this._checkHealth(), 2500);
  }

  async _checkHealth() {
    try {
      const res = await fetch(this.HEALTH_URL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        if (!this.bridgeReady) {
          console.log('[GRUBridge] Connected to FastAPI bridge — GRU V3 model is ready.');
        }
        this.bridgeReady = true;
        if (this.status === 'WAITING') this.status = 'READY';
      } else {
        this.bridgeReady = false;
        this.status = 'WAITING';
      }
    } catch {
      if (this.bridgeReady) {
        console.warn('[GRUBridge] FastAPI bridge connection lost at', this.HEALTH_URL);
      }
      this.bridgeReady = false;
      this.status = 'WAITING';
    }
  }

  get isReady() { return this.bridgeReady; }

  /**
   * Push one feature row into the rolling buffer.
   * Called from the 100 Hz fixed simulation step.
   *
   * @param {number} t_sim - simulation time in seconds
   * @param {number[24]} features - raw physical feature values in exact order
   */
  pushFeatureRow(t_sim, features) {
    this.featureBuffer.push({ t_sim, features: [...features] });
    // Keep a 2-second sliding window (extra margin for interpolation)
    const cutoff = t_sim - 2.0;
    while (this.featureBuffer.length > 0 && this.featureBuffer[0].t_sim < cutoff) {
      this.featureBuffer.shift();
    }
  }

  /**
   * Returns true when at least 1 second of feature history exists.
   */
  haveFullOneSecondHistory() {
    if (this.featureBuffer.length < 2) return false;
    const dt = this.featureBuffer[this.featureBuffer.length - 1].t_sim - this.featureBuffer[0].t_sim;
    return dt >= this.MODEL_WINDOW_S;
  }

  /**
   * Resamples the latest 1 second of feature data to exactly 101 rows at 100 Hz.
   * Uses linear interpolation. Rotation6D values are gram-schmidt orthonormalized.
   */
  resampleLatestSecondTo100Hz() {
    const buf = this.featureBuffer;
    const tEnd = buf[buf.length - 1].t_sim;
    const tStart = tEnd - this.MODEL_WINDOW_S;

    const window101 = [];
    for (let step = 0; step <= 100; step++) {
      const t = tStart + step * 0.01;

      // Find surrounding entries
      let lo = 0, hi = buf.length - 1;
      for (let k = 0; k < buf.length - 1; k++) {
        if (buf[k].t_sim <= t && buf[k + 1].t_sim >= t) {
          lo = k; hi = k + 1;
          break;
        }
      }

      const a = buf[lo], b = buf[hi];
      const span = b.t_sim - a.t_sim;
      const alpha = span < 1e-8 ? 0 : (t - a.t_sim) / span;

      // Linear interpolation of all 24 features
      const row = new Array(24);
      for (let f = 0; f < 24; f++) {
        row[f] = a.features[f] * (1 - alpha) + b.features[f] * alpha;
      }

      // Re-orthonormalize Rotation6D columns (features 9-14)
      // col1 = r11,r21,r31 (indices 9,10,11)
      // col2 = r12,r22,r32 (indices 12,13,14)
      const c1 = [row[9], row[10], row[11]];
      const c2 = [row[12], row[13], row[14]];

      // Normalize c1
      const c1n = Math.sqrt(c1[0]**2 + c1[1]**2 + c1[2]**2) || 1;
      const u1 = c1.map(x => x / c1n);

      // Gram-Schmidt: c2 -= (c2·u1)*u1
      const dot = c2[0]*u1[0] + c2[1]*u1[1] + c2[2]*u1[2];
      const c2gs = c2.map((x, i) => x - dot * u1[i]);
      const c2n = Math.sqrt(c2gs[0]**2 + c2gs[1]**2 + c2gs[2]**2) || 1;
      const u2 = c2gs.map(x => x / c2n);

      row[9]  = u1[0]; row[10] = u1[1]; row[11] = u1[2];
      row[12] = u2[0]; row[13] = u2[1]; row[14] = u2[2];

      window101.push(row);
    }

    return window101;
  }

  /**
   * Called every fixed sim step (dt=0.01s).
   * Handles the 3-second GRU call cadence and applies results via ESKF.
   *
   * @param {number} dt         - fixed timestep (0.01 s)
   * @param {ESKF}   eskf       - reference to the running ESKF instance
   * @param {Function} onUpdate - callback(result) called on accepted correction
   */
  async maybeRunGRU(dt, eskf, onUpdate) {
    if (!this.bridgeReady) return;

    this.timeSinceLastUpdate += dt;
    this.nextUpdateIn = this.MODEL_CORRECTION_INTERVAL_S - this.timeSinceLastUpdate;

    if (this.timeSinceLastUpdate < this.MODEL_CORRECTION_INTERVAL_S) return;
    if (!this.haveFullOneSecondHistory()) return;

    this.timeSinceLastUpdate = 0;
    this.status = 'UPDATE';

    const window101 = this.resampleLatestSecondTo100Hz();
    const eskf_velocity = [...eskf.v];

    try {
      const res = await fetch(this.MODEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          features: window101,
          eskf_velocity_m_s: eskf_velocity,
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        console.warn('[GRUBridge] Inference HTTP error:', res.status);
        this.status = 'READY';
        return;
      }

      const data = await res.json();
      const dv = data.delta_v_m_s;          // [dvx, dvy, dvz]
      const vPseudo = data.pseudo_velocity_m_s; // optional

      // Temporal jump gate (§13)
      const jumpMag = Math.sqrt(dv[0]**2 + dv[1]**2 + dv[2]**2);
      if (jumpMag > this.TEMPORAL_JUMP_THRESHOLD) {
        this.lastDeltaV = dv;
        this.lastGateResult = 'REJECTED (temporal jump)';
        console.warn('[GRUBridge] Correction rejected: temporal jump', jumpMag.toFixed(3));
        this.status = 'READY';
        return;
      }

      // Form pseudo velocity
      const v_pseudo = vPseudo || [
        eskf_velocity[0] + dv[0],
        eskf_velocity[1] + dv[1],
        eskf_velocity[2] + dv[2],
      ];

      // Apply via ESKF velocity update (NIS gate inside)
      const { nis, applied } = eskf.updateVelocity(v_pseudo, this.R_noise);

      this.lastDeltaV = dv;
      this.lastNIS = nis;
      this.lastGateResult = applied ? 'APPLIED' : 'REJECTED (NIS)';
      this.updateCount++;

      if (applied && onUpdate) onUpdate({ dv, v_pseudo, nis });

      console.log(`[GRUBridge] Update #${this.updateCount}: ${this.lastGateResult} | NIS=${nis?.toFixed(2)} | dv=[${dv.map(x=>x.toFixed(3)).join(', ')}]`);
    } catch (e) {
      console.error('[GRUBridge] Fetch error:', e.message);
    }

    this.status = 'READY';
  }

  getStatus() {
    return {
      bridgeReady:    this.bridgeReady,
      status:         this.status,
      lastDeltaV:     this.lastDeltaV,
      lastNIS:        this.lastNIS,
      lastGateResult: this.lastGateResult,
      nextUpdateIn:   Math.max(0, this.nextUpdateIn),
      updateCount:    this.updateCount,
      bufferSamples:  this.featureBuffer.length,
    };
  }
}
