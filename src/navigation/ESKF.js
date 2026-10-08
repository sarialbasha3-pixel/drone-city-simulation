/**
 * ESKF.js — 15-state Error-State Kalman Filter
 *
 * State vector: [delta_p(3), delta_v(3), delta_theta(3), delta_ba(3), delta_bg(3)]
 * Nominal state: position p, velocity v, quaternion q, accel_bias ba, gyro_bias bg
 *
 * This runs the prediction step at every 100Hz fixed-step and applies
 * GRU pseudo-velocity measurements through the update step.
 */
export class ESKF {
  constructor() {
    // ── Nominal state ────────────────────────────────────────────────────────
    this.p  = [0, 0, 0];          // position (m)
    this.v  = [0, 0, 0];          // velocity (m/s)
    // quaternion [w, x, y, z]
    this.q  = [1, 0, 0, 0];
    this.ba = [0, 0, 0];          // accelerometer bias (m/s²)
    this.bg = [0, 0, 0];          // gyroscope bias (rad/s)

    // ── Error covariance P (15×15) stored as flat Float64Array ─────────────
    this.P = new Float64Array(225);
    this._initP();

    // ── Process noise parameters ─────────────────────────────────────────────
    this.sigmaAcc   = 0.1;          // m/s²/√Hz  (accelerometer white noise)
    this.sigmaGyro  = 0.01;         // rad/s/√Hz (gyroscope white noise)
    this.sigmaBiasA = 1e-4;         // m/s²/√Hz  (accel bias random walk)
    this.sigmaBiasG = 1e-5;         // rad/s²/√Hz(gyro bias random walk)

    // gravity
    this.g_vec = [0, -9.80665, 0];

    // cached last rotation matrix (3×3 row-major)
    this.R_WB = this._quatToRotMat(this.q);
  }

  _initP() {
    this.P.fill(0);
    // Small initial uncertainties on each block
    const diag = [
      1e-4, 1e-4, 1e-4,   // position
      1e-2, 1e-2, 1e-2,   // velocity
      1e-4, 1e-4, 1e-4,   // attitude
      1e-6, 1e-6, 1e-6,   // accel bias
      1e-6, 1e-6, 1e-6,   // gyro bias
    ];
    for (let i = 0; i < 15; i++) {
      this.P[i * 15 + i] = diag[i];
    }
  }

  // ── Matrix helpers (row-major flat arrays) ──────────────────────────────

  static _matMul(A, B, n, m, p) {
    const C = new Float64Array(n * p);
    for (let i = 0; i < n; i++)
      for (let k = 0; k < m; k++) {
        const aik = A[i * m + k];
        for (let j = 0; j < p; j++)
          C[i * p + j] += aik * B[k * p + j];
      }
    return C;
  }

  static _matAdd(A, B, n, m) {
    const C = new Float64Array(n * m);
    for (let i = 0; i < n * m; i++) C[i] = A[i] + B[i];
    return C;
  }

  static _matSub(A, B, n, m) {
    const C = new Float64Array(n * m);
    for (let i = 0; i < n * m; i++) C[i] = A[i] - B[i];
    return C;
  }

  static _transpose(A, n, m) {
    const T = new Float64Array(m * n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++)
        T[j * n + i] = A[i * m + j];
    return T;
  }

  static _inv3x3(M) {
    // Returns inverse of 3×3 matrix
    const [a,b,c, d,e,f, g,h,k] = M;
    const det = a*(e*k-f*h) - b*(d*k-f*g) + c*(d*h-e*g);
    if (Math.abs(det) < 1e-14) return null;
    const inv = 1/det;
    return new Float64Array([
      (e*k-f*h)*inv, (c*h-b*k)*inv, (b*f-c*e)*inv,
      (f*g-d*k)*inv, (a*k-c*g)*inv, (c*d-a*f)*inv,
      (d*h-e*g)*inv, (b*g-a*h)*inv, (a*e-b*d)*inv,
    ]);
  }

  // ── Quaternion utilities ────────────────────────────────────────────────

  _quatToRotMat(q) {
    const [w, x, y, z] = q;
    return [
      1-2*(y*y+z*z), 2*(x*y-w*z),   2*(x*z+w*y),
      2*(x*y+w*z),   1-2*(x*x+z*z), 2*(y*z-w*x),
      2*(x*z-w*y),   2*(y*z+w*x),   1-2*(x*x+y*y),
    ];
  }

  _quatNormalize(q) {
    const n = Math.sqrt(q[0]**2+q[1]**2+q[2]**2+q[3]**2);
    return [q[0]/n, q[1]/n, q[2]/n, q[3]/n];
  }

  /** Rotate a 3-vector by rotation matrix R (3×3 row-major) */
  _rotVec(R, v) {
    return [
      R[0]*v[0] + R[1]*v[1] + R[2]*v[2],
      R[3]*v[0] + R[4]*v[1] + R[5]*v[2],
      R[6]*v[0] + R[7]*v[1] + R[8]*v[2],
    ];
  }

  /** Skew-symmetric matrix of a 3-vector */
  _skew(v) {
    return [
         0, -v[2],  v[1],
      v[2],     0, -v[0],
     -v[1],  v[0],     0,
    ];
  }

  // ── ESKF Predict step (dt = 0.01 s at 100 Hz) ──────────────────────────

  predict(acc_meas, gyro_meas, dt) {
    // Remove biases
    const am = [acc_meas[0]-this.ba[0], acc_meas[1]-this.ba[1], acc_meas[2]-this.ba[2]];
    const wm = [gyro_meas[0]-this.bg[0], gyro_meas[1]-this.bg[1], gyro_meas[2]-this.bg[2]];

    const R = this.R_WB;

    // World-frame acceleration
    const a_w = this._rotVec(R, am);
    const a_net = [a_w[0]+this.g_vec[0], a_w[1]+this.g_vec[1], a_w[2]+this.g_vec[2]];

    // Nominal state integration (Euler)
    this.p = [
      this.p[0] + this.v[0]*dt + 0.5*a_net[0]*dt*dt,
      this.p[1] + this.v[1]*dt + 0.5*a_net[1]*dt*dt,
      this.p[2] + this.v[2]*dt + 0.5*a_net[2]*dt*dt,
    ];
    this.v = [
      this.v[0] + a_net[0]*dt,
      this.v[1] + a_net[1]*dt,
      this.v[2] + a_net[2]*dt,
    ];

    // Quaternion integration via axis-angle (small angle)
    const angle = Math.sqrt(wm[0]**2+wm[1]**2+wm[2]**2)*dt;
    if (angle > 1e-10) {
      const s = Math.sin(angle*0.5)/angle;
      const dq = [Math.cos(angle*0.5), wm[0]*dt*s, wm[1]*dt*s, wm[2]*dt*s];
      // q = q * dq
      const [w0,x0,y0,z0] = this.q;
      const [w1,x1,y1,z1] = dq;
      this.q = this._quatNormalize([
        w0*w1 - x0*x1 - y0*y1 - z0*z1,
        w0*x1 + x0*w1 + y0*z1 - z0*y1,
        w0*y1 - x0*z1 + y0*w1 + z0*x1,
        w0*z1 + x0*y1 - y0*x1 + z0*w1,
      ]);
    }
    this.R_WB = this._quatToRotMat(this.q);

    // ── Linearized error dynamics F (15×15) ─────────────────────────────
    const F = new Float64Array(225);
    // Identity on diagonal
    for (let i = 0; i < 15; i++) F[i*15+i] = 1;

    // dp/dv block (rows 0-2, cols 3-5)
    F[0*15+3]=dt; F[1*15+4]=dt; F[2*15+5]=dt;

    // dv/dtheta = -R*[am_skew] (rows 3-5, cols 6-8)
    const Sk = this._skew(am);
    const RS = ESKF._matMul(R, Sk, 3, 3, 3);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        F[(3+i)*15+(6+j)] = -RS[i*3+j]*dt;

    // dv/dba = -R (rows 3-5, cols 9-11)
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        F[(3+i)*15+(9+j)] = -R[i*3+j]*dt;

    // dtheta/dbg = -I (rows 6-8, cols 12-14)
    F[6*15+12]=-dt; F[7*15+13]=-dt; F[8*15+14]=-dt;

    // ── Discrete process noise Q ─────────────────────────────────────────
    const Q = new Float64Array(225);
    const qv = this.sigmaAcc**2 * dt;
    const qa = this.sigmaGyro**2 * dt;
    const qba = this.sigmaBiasA**2 * dt;
    const qbg = this.sigmaBiasG**2 * dt;

    // velocity noise from accelerometer
    for (let i=3;i<6;i++) Q[i*15+i] = qv;
    // attitude noise from gyroscope
    for (let i=6;i<9;i++) Q[i*15+i] = qa;
    // bias random walks
    for (let i=9;i<12;i++) Q[i*15+i] = qba;
    for (let i=12;i<15;i++) Q[i*15+i] = qbg;

    // ── P = F*P*Fᵀ + Q ──────────────────────────────────────────────────
    const FP  = ESKF._matMul(F, this.P, 15, 15, 15);
    const Ft  = ESKF._transpose(F, 15, 15);
    const FPFt= ESKF._matMul(FP, Ft, 15, 15, 15);
    const newP= ESKF._matAdd(FPFt, Q, 15, 15);
    for (let i = 0; i < 225; i++) this.P[i] = newP[i];
  }

  // ── ESKF velocity pseudo-measurement update ──────────────────────────────

  /**
   * Applies a GRU pseudo-velocity measurement: v_pseudo = v_ESKF + delta_v
   *
   * H selects the velocity error block (rows 3-5 of state).
   * Uses Joseph-form covariance update.
   *
   * @param {number[]} v_pseudo  - [vx, vy, vz] in m/s
   * @param {number[][]} R_noise - 3×3 measurement noise covariance
   * @returns {{ nis: number, applied: boolean }}
   */
  updateVelocity(v_pseudo, R_noise) {
    // H = [0₃₃, I₃₃, 0₃₉] (3×15), selects velocity block
    const H = new Float64Array(3*15);
    H[0*15+3]=1; H[1*15+4]=1; H[2*15+5]=1;

    const Ht = ESKF._transpose(H, 3, 15);

    // Innovation
    const y = [
      v_pseudo[0] - this.v[0],
      v_pseudo[1] - this.v[1],
      v_pseudo[2] - this.v[2],
    ];

    // S = H*P*Hᵀ + R
    const HP  = ESKF._matMul(H, this.P, 3, 15, 15);
    const HPHt= ESKF._matMul(HP, Ht, 3, 15, 3);
    const R_flat = new Float64Array(9);
    for (let i=0;i<3;i++) for(let j=0;j<3;j++) R_flat[i*3+j] = R_noise[i][j];
    const S   = ESKF._matAdd(HPHt, R_flat, 3, 3);

    // NIS = yᵀ * S⁻¹ * y
    const Sinv = ESKF._inv3x3(S);
    let nis = 0;
    if (Sinv) {
      const Sy = ESKF._matMul(Sinv, new Float64Array(y), 3, 3, 1);
      for (let i=0;i<3;i++) nis += y[i]*Sy[i];
    } else {
      return { nis: Infinity, applied: false };
    }

    // NIS gate (99% confidence for 3 DOF)
    const NIS_THRESHOLD = 11.344866730144373;
    if (nis > NIS_THRESHOLD) {
      return { nis, applied: false };
    }

    // K = P*Hᵀ*S⁻¹
    const PHt = ESKF._matMul(this.P, Ht, 15, 15, 3);
    const K   = ESKF._matMul(PHt, Sinv, 15, 3, 3);

    // Error state correction: dx = K*y
    const dx = ESKF._matMul(K, new Float64Array(y), 15, 3, 1);

    // Inject correction into nominal state
    this.p[0]  += dx[0];  this.p[1]  += dx[1];  this.p[2]  += dx[2];
    this.v[0]  += dx[3];  this.v[1]  += dx[4];  this.v[2]  += dx[5];

    // Attitude correction via rotation vector -> quaternion
    const dth = [dx[6], dx[7], dx[8]];
    const ang = Math.sqrt(dth[0]**2+dth[1]**2+dth[2]**2);
    if (ang > 1e-10) {
      const s = Math.sin(ang*0.5)/ang;
      const dq = [Math.cos(ang*0.5), dth[0]*s, dth[1]*s, dth[2]*s];
      const [w0,x0,y0,z0] = this.q;
      const [w1,x1,y1,z1] = dq;
      this.q = this._quatNormalize([
        w0*w1-x0*x1-y0*y1-z0*z1,
        w0*x1+x0*w1+y0*z1-z0*y1,
        w0*y1-x0*z1+y0*w1+z0*x1,
        w0*z1+x0*y1-y0*x1+z0*w1,
      ]);
      this.R_WB = this._quatToRotMat(this.q);
    }

    this.ba[0]+=dx[9];  this.ba[1]+=dx[10]; this.ba[2]+=dx[11];
    this.bg[0]+=dx[12]; this.bg[1]+=dx[13]; this.bg[2]+=dx[14];

    // Joseph-form covariance update: P = (I-KH)*P*(I-KH)ᵀ + K*R*Kᵀ
    const I = new Float64Array(225);
    for (let i=0;i<15;i++) I[i*15+i]=1;
    const KH  = ESKF._matMul(K, H, 15, 3, 15);
    const IKH = ESKF._matSub(I, KH, 15, 15);
    const IKHt= ESKF._transpose(IKH, 15, 15);
    const A   = ESKF._matMul(IKH, this.P, 15, 15, 15);
    const B   = ESKF._matMul(A, IKHt, 15, 15, 15);
    const KRKt_inner = ESKF._matMul(K, R_flat, 15, 3, 3);
    const Kt  = ESKF._transpose(K, 15, 3);
    const KRKt = ESKF._matMul(KRKt_inner, Kt, 15, 3, 15);
    const newP = ESKF._matAdd(B, KRKt, 15, 15);
    for (let i=0;i<225;i++) this.P[i]=newP[i];

    return { nis, applied: true };
  }

  /** Reset to a starting state (call at each new route start) */
  reset(startPos, startVel, initialHeading = 0) {
    this.p  = [...startPos];
    this.v  = startVel ? [...startVel] : [0, 0, 0];
    const halfH = initialHeading * 0.5;
    this.q  = [Math.cos(halfH), 0, Math.sin(halfH), 0];
    this.ba = [0, 0, 0];
    this.bg = [0, 0, 0];
    this.R_WB = this._quatToRotMat(this.q);
    this._initP();
  }

  /** Velocity sigma diagonal (for features) */
  get velocitySigmas() {
    return [
      Math.sqrt(Math.max(0, this.P[3*15+3])),
      Math.sqrt(Math.max(0, this.P[4*15+4])),
      Math.sqrt(Math.max(0, this.P[5*15+5])),
    ];
  }
  get positionSigmas() {
    return [
      Math.sqrt(Math.max(0, this.P[0*15+0])),
      Math.sqrt(Math.max(0, this.P[1*15+1])),
      Math.sqrt(Math.max(0, this.P[2*15+2])),
    ];
  }
  get attitudeSigmas() {
    return [
      Math.sqrt(Math.max(0, this.P[6*15+6])),
      Math.sqrt(Math.max(0, this.P[7*15+7])),
      Math.sqrt(Math.max(0, this.P[8*15+8])),
    ];
  }

  /** First two columns of R_WB in exact feature order: r11,r21,r31,r12,r22,r32 */
  get rot6d() {
    const R = this.R_WB;
    return [R[0],R[3],R[6],  R[1],R[4],R[7]];
  }
}
