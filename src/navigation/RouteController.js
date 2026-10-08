import * as THREE from 'three';

/**
 * RouteController.js
 *
 * Manages:
 *  1. The 2D tactical route-drawing overlay panel (Route Mode, M key)
 *     Features a styled city minimap, river, districts, and live drone marker.
 *  2. Resampling and mapping 2D strokes into 3D world waypoints.
 *  3. Rendering a persistent glowing 3D flight corridor (tube + start/finish gates).
 *  4. Autonomous route-following flight controller with smooth deceleration & hover.
 *  5. 100 Hz fixed IMU synthesis (specific force with +g, gyro noise, bias drift).
 *  6. 24-feature extractor feeding the GRUBridge.
 */
export class RouteController {
  constructor(terrain, scene, worldBounds, getDronePos) {
    this.terrain = terrain;
    this.scene   = scene;

    // World coordinate bounds that the drawing panel maps to
    this.worldBounds = worldBounds || { minX: -750, maxX: 750, minZ: -750, maxZ: 750 };
    this.getDronePos = getDronePos || null;

    // Route state
    this.routeMode        = false;
    this.routePoints2D    = [];   // normalized (u, v) coords in [0, 1]
    this.routePointsWorld = [];   // THREE.Vector3 world coordinates
    this.routeAltitude    = 70.0; // Cruise altitude (m above terrain)

    this.isDrawing = false;

    // Route 3D visualization group
    this.routeGroup = new THREE.Group();
    this.routeGroup.name = 'route_visuals';
    this.scene.add(this.routeGroup);

    // Flight state
    this.isFlying    = false;
    this.isHovering  = false;
    this.isFinished  = false;
    this.routeIndex  = 0;        // current waypoint target index
    this.simTime     = 0;        // simulation time (s)

    // Obstacle Avoidance Priority Override Target
    this.bypassOverrideTarget = null;

    // Controller gains
    this.kp_pos     = 1.8;   // proportional position gain (m/s per m)
    this.kp_vel     = 3.2;   // velocity tracking damping
    this.maxSpeed   = 14.0;  // max cruise speed (m/s) (~50 km/h)
    this.WAYPOINT_TOLERANCE = 8.0; // radius to advance to next waypoint (m)

    // IMU synthesis noise parameters
    this.imuAccelNoise  = 0.06;  // m/s²
    this.imuGyroNoise   = 0.004; // rad/s
    this.accelBiasDrift = [0.015, 0.008, 0.012]; // m/s²

    // Reference to drone's actual position for minimap display
    this.currentDronePos = new THREE.Vector3(250, 45, 0);

    // Panel DOM elements
    this.panel    = null;
    this.canvas2D = null;
    this.ctx2D    = null;

    // Callbacks
    this.onFlightStart = null;
    this.onFlightStop  = null;
    this.onRouteDrawn  = null;

    // Drone state in route mode
    this.droneWorldPos = new THREE.Vector3(250, 45, 0);
    this.droneVelocity = new THREE.Vector3(0, 0, 0);
    this.droneHeading  = 0;
    this.dronePitch    = 0;
    this.droneRoll     = 0;

    this._createPanel();
    this._setupKeyBindings();
  }

  // ── 2D GCS Tactical Panel ──────────────────────────────────────────────────

  _createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'route-panel';
    Object.assign(this.panel.style, {
      position: 'fixed',
      top: '0', left: '0',
      width: '100vw', height: '100vh',
      background: 'rgba(5, 10, 18, 0.92)',
      backdropFilter: 'blur(6px)',
      zIndex: '10000',
      display: 'none',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Courier New', monospace",
      color: '#00e5ff',
      userSelect: 'none',
    });

    // Header title bar
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: 'min(940px, 92vw)',
      marginBottom: '10px',
    });

    const title = document.createElement('div');
    title.innerHTML = '⚡ <b>UAV MISSION PLANNER</b> <span style="font-size:12px;color:#90a4ae;">— TACTICAL GROUND CONTROL</span>';
    Object.assign(title.style, { fontSize: '16px', letterSpacing: '2px', color: '#ffea00' });
    header.appendChild(title);

    const rightGroup = document.createElement('div');
    Object.assign(rightGroup.style, { display: 'flex', alignItems: 'center', gap: '15px' });

    const altInfo = document.createElement('div');
    altInfo.innerHTML = `FLIGHT ALTITUDE: <span style="color:#00e676;">${this.routeAltitude}m AGL</span> | GRID: 1.5×1.5 km`;
    Object.assign(altInfo.style, { fontSize: '12px', color: '#80deea' });
    rightGroup.appendChild(altInfo);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ CLOSE (M)';
    Object.assign(closeBtn.style, {
      background: 'rgba(255, 23, 68, 0.25)',
      border: '1px solid #ff1744',
      color: '#ff5252',
      borderRadius: '4px',
      padding: '4px 10px',
      cursor: 'pointer',
      fontFamily: "'Courier New', monospace",
      fontSize: '12px',
      fontWeight: 'bold',
    });
    closeBtn.addEventListener('click', () => this.closePanel());
    rightGroup.appendChild(closeBtn);

    header.appendChild(rightGroup);
    this.panel.appendChild(header);

    // Tactical drawing canvas
    this.canvas2D = document.createElement('canvas');
    this.canvas2D.width  = Math.min(940, window.innerWidth - 60);
    this.canvas2D.height = Math.min(580, window.innerHeight - 150);
    Object.assign(this.canvas2D.style, {
      border: '2px solid rgba(0, 229, 255, 0.7)',
      borderRadius: '8px',
      cursor: 'crosshair',
      background: '#040d1a',
      boxShadow: '0 0 25px rgba(0, 229, 255, 0.25)',
    });
    this.ctx2D = this.canvas2D.getContext('2d');
    this.panel.appendChild(this.canvas2D);

    // Footer command bar
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display: 'flex',
      justifyContent: 'space-between',
      width: 'min(940px, 92vw)',
      marginTop: '10px',
      fontSize: '12px',
      color: '#b0bec5',
    });

    footer.innerHTML = `
      <div>
        <span style="color:#ffea00;"><b>Click & Drag</b></span> to draw flight path &nbsp;|&nbsp;
        <span style="color:#00e676;"><b>[ENTER]</b></span> Confirm &nbsp;|&nbsp;
        <span style="color:#ff5252;"><b>[C]</b></span> Clear &nbsp;|&nbsp;
        <span style="color:#00e5ff;"><b>[M]</b></span> Close
      </div>
      <div id="route-length-hint" style="color:#ff9100;font-weight:bold;">NO ROUTE DRAWN</div>
    `;
    this.panel.appendChild(footer);

    document.body.appendChild(this.panel);

    // Pointer events on canvas
    this.canvas2D.addEventListener('pointerdown', e => {
      this.isDrawing = true;
      this.routePoints2D = [];
      this._drawTacticalMap();
      this._addPoint(e);
    });

    this.canvas2D.addEventListener('pointermove', e => {
      if (!this.isDrawing) return;
      this._addPoint(e);
    });

    this.canvas2D.addEventListener('pointerup', () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this._finalizeRoute();
    });
  }

  _addPoint(e) {
    const rect = this.canvas2D.getBoundingClientRect();
    const u = THREE.MathUtils.clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const v = THREE.MathUtils.clamp((e.clientY - rect.top)  / rect.height, 0, 1);

    if (this.routePoints2D.length > 0) {
      const last = this.routePoints2D[this.routePoints2D.length - 1];
      const d = Math.hypot(u - last[0], v - last[1]);
      if (d < 0.006) return;
    }

    this.routePoints2D.push([u, v]);
    this._drawTacticalMap();
    this._drawDrawnPath();
  }

  // ── Render Styled Tactical Minimap on Canvas ──────────────────────────────

  _drawTacticalMap() {
    const c = this.canvas2D;
    const ctx = this.ctx2D;
    ctx.clearRect(0, 0, c.width, c.height);

    // Coordinate conversion: world X -> canvas px, world Z -> canvas py
    const { minX, maxX, minZ, maxZ } = this.worldBounds;
    const toCanvasX = wx => ((wx - minX) / (maxX - minX)) * c.width;
    const toCanvasY = wz => ((wz - minZ) / (maxZ - minZ)) * c.height;

    // 1. Grid lines
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.12)';
    ctx.lineWidth = 1;
    const gridCount = 12;
    for (let i = 0; i <= gridCount; i++) {
      const gx = (i / gridCount) * c.width;
      const gy = (i / gridCount) * c.height;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, c.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(c.width, gy); ctx.stroke();
    }

    // 2. District Zones (Tinted Polygons)
    // Downtown: X: 0 to 750, Z: -250 to 250
    ctx.fillStyle = 'rgba(255, 170, 0, 0.08)';
    ctx.fillRect(toCanvasX(0), toCanvasY(-250), toCanvasX(750) - toCanvasX(0), toCanvasY(250) - toCanvasY(-250));

    // Commercial: X: 0 to 750, Z: 250 to 750
    ctx.fillStyle = 'rgba(0, 229, 255, 0.06)';
    ctx.fillRect(toCanvasX(0), toCanvasY(250), toCanvasX(750) - toCanvasX(0), toCanvasY(750) - toCanvasY(250));

    // Residential: X: 0 to 750, Z: -750 to -250
    ctx.fillStyle = 'rgba(0, 230, 118, 0.06)';
    ctx.fillRect(toCanvasX(0), toCanvasY(-750), toCanvasX(750) - toCanvasX(0), toCanvasY(-250) - toCanvasY(-750));

    // Western Hills & Bluffs: X: -750 to -150, Z: -750 to 100
    ctx.fillStyle = 'rgba(76, 175, 80, 0.07)';
    ctx.fillRect(toCanvasX(-750), toCanvasY(-750), toCanvasX(-150) - toCanvasX(-750), toCanvasY(100) - toCanvasY(-750));

    // Industrial: X: -750 to 0, Z: 0 to 750
    ctx.fillStyle = 'rgba(156, 39, 176, 0.07)';
    ctx.fillRect(toCanvasX(-750), toCanvasY(0), toCanvasX(0) - toCanvasX(-750), toCanvasY(750) - toCanvasY(0));

    // 3. Water Channel / River Bay (X ≈ -180 to -30)
    ctx.fillStyle = 'rgba(21, 101, 192, 0.35)';
    ctx.fillRect(toCanvasX(-180), 0, toCanvasX(-30) - toCanvasX(-180), c.height);

    ctx.strokeStyle = 'rgba(33, 150, 243, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(toCanvasX(-180), 0); ctx.lineTo(toCanvasX(-180), c.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toCanvasX(-30), 0); ctx.lineTo(toCanvasX(-30), c.height); ctx.stroke();

    // 4. Suspension Bridge: Z ≈ 0, X: -290 to 30
    ctx.strokeStyle = '#ffd600';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(-290), toCanvasY(0));
    ctx.lineTo(toCanvasX(30), toCanvasY(0));
    ctx.stroke();

    // Bridge towers
    ctx.fillStyle = '#ff6d00';
    ctx.fillRect(toCanvasX(-180) - 3, toCanvasY(0) - 5, 6, 10);
    ctx.fillRect(toCanvasX(-60) - 3, toCanvasY(0) - 5, 6, 10);

    // 5. District Labels
    ctx.font = 'bold 11px Courier New';
    ctx.fillStyle = 'rgba(255, 234, 0, 0.7)';
    ctx.fillText('🏢 DOWNTOWN HIGH-RISE', toCanvasX(60), toCanvasY(-20));

    ctx.fillStyle = 'rgba(0, 229, 255, 0.65)';
    ctx.fillText('🛍 COMMERCIAL PLAZA', toCanvasX(60), toCanvasY(480));

    ctx.fillStyle = 'rgba(0, 230, 118, 0.65)';
    ctx.fillText('🏡 RESIDENTIAL DISTRICT', toCanvasX(60), toCanvasY(-500));

    ctx.fillStyle = 'rgba(129, 199, 132, 0.65)';
    ctx.fillText('⛰ WESTERN BLUFFS', toCanvasX(-680), toCanvasY(-400));

    ctx.fillStyle = 'rgba(186, 104, 200, 0.65)';
    ctx.fillText('🏭 INDUSTRIAL DOCKS', toCanvasX(-680), toCanvasY(400));

    ctx.fillStyle = 'rgba(100, 181, 246, 0.8)';
    ctx.fillText('🌊 RIVER BAY', toCanvasX(-145), toCanvasY(-680));

    ctx.fillStyle = '#ffd600';
    ctx.fillText('🌉 SUSPENSION BRIDGE', toCanvasX(-260), toCanvasY(20));

    // 6. Current Drone Position (Pulsing Amber/Orange Marker)
    if (this.currentDronePos) {
      const dx = toCanvasX(this.currentDronePos.x);
      const dy = toCanvasY(this.currentDronePos.z);

      ctx.fillStyle = '#ff9100';
      ctx.beginPath(); ctx.arc(dx, dy, 6, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = 'rgba(255, 145, 0, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(dx, dy, 12, 0, Math.PI * 2); ctx.stroke();

      ctx.font = 'bold 10px Courier New';
      ctx.fillStyle = '#ff9100';
      ctx.fillText('▲ CURRENT DRONE POS', dx + 15, dy + 4);
    }
  }

  // ── Render Drawn Path on Canvas ───────────────────────────────────────────

  _drawDrawnPath() {
    const c = this.canvas2D;
    const ctx = this.ctx2D;
    if (this.routePoints2D.length < 2) return;

    // Glowing stroke
    ctx.save();
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    this.routePoints2D.forEach(([u, v], i) => {
      const px = u * c.width, py = v * c.height;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();

    // Direction arrows
    for (let i = 2; i < this.routePoints2D.length - 1; i += 6) {
      const [u0, v0] = this.routePoints2D[i - 1];
      const [u1, v1] = this.routePoints2D[i];
      const dx = u1 - u0, dy = v1 - v0;
      const ang = Math.atan2(dy, dx);
      const px = u1 * c.width, py = v1 * c.height;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -4); ctx.lineTo(0, 0); ctx.lineTo(-8, 4);
      ctx.stroke();
      ctx.restore();
    }

    // Start Beacon (Green)
    const [us, vs] = this.routePoints2D[0];
    const sx = us * c.width, sy = vs * c.height;
    ctx.fillStyle = '#00e676';
    ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Courier New';
    ctx.fillText('START', sx + 12, sy + 3);

    // End Beacon (Red)
    const [ue, ve] = this.routePoints2D[this.routePoints2D.length - 1];
    const ex = ue * c.width, ey = ve * c.height;
    ctx.fillStyle = '#ff1744';
    ctx.beginPath(); ctx.arc(ex, ey, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Courier New';
    ctx.fillText('FINISH', ex + 12, ey + 3);
  }

  _finalizeRoute() {
    if (this.routePoints2D.length < 3) return;

    // Resample by physical distance: waypoints spaced ~16m apart
    const { minX, maxX, minZ, maxZ } = this.worldBounds;
    const worldW = maxX - minX;
    const worldH = maxZ - minZ;

    // Estimate total world-space stroke length
    let totalLen = 0;
    for (let i = 1; i < this.routePoints2D.length; i++) {
      const du = (this.routePoints2D[i][0] - this.routePoints2D[i - 1][0]) * worldW;
      const dv = (this.routePoints2D[i][1] - this.routePoints2D[i - 1][1]) * worldH;
      totalLen += Math.hypot(du, dv);
    }

    // Ensure waypoints are spaced ~16m apart, bounded between 8 and 90 waypoints
    const targetSpacing = 16.0;
    const numWaypoints = Math.max(8, Math.min(90, Math.round(totalLen / targetSpacing)));

    this.routePoints2D = this._resamplePath(this.routePoints2D, numWaypoints);
    this._drawTacticalMap();
    this._drawDrawnPath();

    // Map 2D waypoints to 3D world space
    this._mapToWorld();

    // Update length hint in footer
    const hintEl = document.getElementById('route-length-hint');
    if (hintEl) {
      hintEl.textContent = `ROUTE: ${totalLen.toFixed(0)}m (${this.routePointsWorld.length} waypoints) — PRESS [ENTER] TO CLOSE, [S] TO FLY`;
      hintEl.style.color = '#00e676';
    }

    if (this.onRouteDrawn) this.onRouteDrawn(this.routePointsWorld);
    console.log(`[RouteController] Route generated: ${this.routePointsWorld.length} waypoints, ${totalLen.toFixed(0)}m total`);
  }

  _resamplePath(points, targetCount) {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
      const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      lengths.push(lengths[lengths.length - 1] + d);
    }
    const totalLen = lengths[lengths.length - 1];
    if (totalLen < 1e-6) return points;

    const result = [];
    for (let k = 0; k < targetCount; k++) {
      const targetDist = (k / (targetCount - 1)) * totalLen;
      let lo = 0;
      for (let j = 0; j < lengths.length - 1; j++) {
        if (lengths[j] <= targetDist && lengths[j + 1] >= targetDist) { lo = j; break; }
      }
      const segLen = lengths[lo + 1] - lengths[lo];
      const t = segLen < 1e-10 ? 0 : (targetDist - lengths[lo]) / segLen;
      result.push([
        points[lo][0] * (1 - t) + points[lo + 1][0] * t,
        points[lo][1] * (1 - t) + points[lo + 1][1] * t,
      ]);
    }
    return result;
  }

  // ── 3D World Mapping & Glowing Tube / Gates Visualization ──────────────────

  _mapToWorld() {
    const { minX, maxX, minZ, maxZ } = this.worldBounds;
    this.routePointsWorld = this.routePoints2D.map(([u, v]) => {
      const wx = minX + u * (maxX - minX);
      const wz = minZ + v * (maxZ - minZ);
      const terrainH = this.terrain ? this.terrain.getHeight(wx, wz) : 5.0;
      const wy = Math.max(terrainH + 15.0, this.routeAltitude);
      return new THREE.Vector3(wx, wy, wz);
    });

    this._build3DRouteVisuals();
  }

  _build3DRouteVisuals() {
    // Clear previous visuals
    while (this.routeGroup.children.length > 0) {
      const obj = this.routeGroup.children[0];
      this.routeGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }

    if (this.routePointsWorld.length < 2) return;

    const points = this.routePointsWorld;

    // 1. Glowing 3D Tube Corridor (impossible to miss against buildings or sky)
    try {
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeom = new THREE.TubeGeometry(curve, Math.max(20, points.length * 2), 0.45, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.75,
        wireframe: false,
        depthWrite: false, // Prevents z-fighting and renders clearly
      });
      const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
      tubeMesh.renderOrder = 1000;
      this.routeGroup.add(tubeMesh);
    } catch (err) {
      // Fallback: BufferGeometry line
      const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9 });
      this.routeGroup.add(new THREE.Line(lineGeom, lineMat));
    }

    // 2. Start Gate (Neon Green Torus)
    const startWp = points[0];
    const nextWp  = points[1] || startWp;
    const startDir = new THREE.Vector3().subVectors(nextWp, startWp).normalize();

    const gateGeom = new THREE.TorusGeometry(2.5, 0.18, 12, 24);
    const startMat = new THREE.MeshBasicMaterial({ color: 0x00e676, wireframe: false });
    const startGate = new THREE.Mesh(gateGeom, startMat);
    startGate.position.copy(startWp);
    startGate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), startDir.lengthSq() > 0.01 ? startDir : new THREE.Vector3(0, 0, 1));
    this.routeGroup.add(startGate);

    // 3. Finish Gate (Neon Amber/Red Torus)
    const endWp = points[points.length - 1];
    const prevWp = points[points.length - 2] || endWp;
    const endDir = new THREE.Vector3().subVectors(endWp, prevWp).normalize();

    const finishMat = new THREE.MeshBasicMaterial({ color: 0xff1744, wireframe: false });
    const finishGate = new THREE.Mesh(gateGeom, finishMat);
    finishGate.position.copy(endWp);
    finishGate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), endDir.lengthSq() > 0.01 ? endDir : new THREE.Vector3(0, 0, 1));
    this.routeGroup.add(finishGate);

    // 4. Waypoint rings every 5 waypoints
    const ringGeom = new THREE.TorusGeometry(1.6, 0.10, 8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00b0ff, transparent: true, opacity: 0.6 });

    for (let i = 4; i < points.length - 1; i += 4) {
      const wp = points[i];
      const d = new THREE.Vector3().subVectors(points[i + 1], wp).normalize();
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.copy(wp);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      this.routeGroup.add(ring);
    }
  }

  // ── Key Bindings ──────────────────────────────────────────────────────────

  _setupKeyBindings() {
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyM') {
        this.toggleRouteMode();
      } else if (e.code === 'Enter' && this.routeMode) {
        this._finalizeRoute();
        this.closePanel();
      } else if (e.code === 'KeyC' && this.routeMode) {
        this.routePoints2D = [];
        this.routePointsWorld = [];
        this._drawTacticalMap();
        this._build3DRouteVisuals();
        const hintEl = document.getElementById('route-length-hint');
        if (hintEl) {
          hintEl.textContent = 'NO ROUTE DRAWN';
          hintEl.style.color = '#ff9100';
        }
      } else if (e.code === 'Escape' && this.routeMode) {
        this.closePanel();
      }
    });
  }

  toggleRouteMode(droneWorldPos) {
    const pos = droneWorldPos || (this.getDronePos ? this.getDronePos() : null);
    if (pos) this.currentDronePos.copy(pos);
    this.routeMode = !this.routeMode;
    if (this.routeMode) {
      this.panel.style.display = 'flex';
      this._drawTacticalMap();
      if (this.routePoints2D.length >= 2) this._drawDrawnPath();
    } else {
      this.panel.style.display = 'none';
    }
  }

  closePanel() {
    this.routeMode = false;
    this.panel.style.display = 'none';
  }

  hasRoute() { return this.routePointsWorld.length >= 2; }

  // ── Flight Lifecycle ──────────────────────────────────────────────────────

  startFlight(startPos, eskf) {
    if (!this.hasRoute()) return false;

    this.routeIndex  = 0;
    this.simTime     = 0;
    this.isFlying    = true;
    this.isHovering  = false;
    this.isFinished  = false;

    // Initialize drone at start waypoint
    const wp0 = this.routePointsWorld[0];
    const wp1 = this.routePointsWorld[1] || wp0;

    this.droneWorldPos.copy(wp0);
    this.droneVelocity.set(0, 0, 0);

    const dir = new THREE.Vector3().subVectors(wp1, wp0);
    this.droneHeading = dir.lengthSq() > 0.01 ? Math.atan2(-dir.x, -dir.z) : 0;
    this.dronePitch   = 0;
    this.droneRoll    = 0;

    // Reset ESKF at starting waypoint with matching initial heading
    if (eskf) eskf.reset([wp0.x, wp0.y, wp0.z], [0, 0, 0], this.droneHeading);

    if (this.onFlightStart) this.onFlightStart();
    console.log('[RouteController] Autonomous flight started at wp0:', wp0);
    return true;
  }

  stopFlight() {
    this.isFlying   = false;
    this.isHovering = false;
    this.bypassOverrideTarget = null;
    if (this.onFlightStop) this.onFlightStop();
  }

  /**
   * Sets temporary obstacle avoidance bypass waypoint (takes absolute priority over route).
   */
  setBypassOverride(targetPos) {
    this.bypassOverrideTarget = targetPos ? targetPos.clone() : null;
  }

  /**
   * Clears bypass override and returns priority to pre-set route waypoints.
   */
  clearBypassOverride() {
    this.bypassOverrideTarget = null;
  }

  // ── Fixed 100 Hz Autonomous Navigation Step ────────────────────────────────

  fixedSimulationStep(dt, eskf, bridge) {
    if (!this.isFlying) return null;

    this.simTime += dt;

    // Estimated drone position & velocity from ESKF
    const estimatedPos = new THREE.Vector3(eskf.p[0], eskf.p[1], eskf.p[2]);
    const estimatedVel = new THREE.Vector3(eskf.v[0], eskf.v[1], eskf.v[2]);

    // Check if reached destination: enter stable hover
    if (this.routeIndex >= this.routePointsWorld.length - 1) {
      const finalWp = this.routePointsWorld[this.routePointsWorld.length - 1];
      const distToFinal = estimatedPos.distanceTo(finalWp);

      if (distToFinal < 4.0 || this.isHovering) {
        this.isHovering = true;
        this.isFinished = true;

        // Hover controller: gently damp velocity and hold position
        const hoverErr = new THREE.Vector3().subVectors(finalWp, estimatedPos);
        const desiredHoverVel = hoverErr.multiplyScalar(1.2);
        const hoverVelErr = desiredHoverVel.sub(estimatedVel);
        const accelCmd = hoverVelErr.multiplyScalar(4.0);

        // Hover specific force in world frame
        const f_w = [accelCmd.x, accelCmd.y + 9.80665, accelCmd.z];
        const R = eskf.R_WB;
        const f_b = [
          R[0] * f_w[0] + R[3] * f_w[1] + R[6] * f_w[2],
          R[1] * f_w[0] + R[4] * f_w[1] + R[7] * f_w[2],
          R[2] * f_w[0] + R[5] * f_w[1] + R[8] * f_w[2],
        ];

        const imuAcc = [
          f_b[0] + this._randn() * this.imuAccelNoise + this.accelBiasDrift[0],
          f_b[1] + this._randn() * this.imuAccelNoise + this.accelBiasDrift[1],
          f_b[2] + this._randn() * this.imuAccelNoise + this.accelBiasDrift[2],
        ];
        const imuGyro = [this._randn() * this.imuGyroNoise, this._randn() * this.imuGyroNoise, this._randn() * this.imuGyroNoise];

        eskf.predict(imuAcc, imuGyro, dt);
        this.droneWorldPos.set(eskf.p[0], eskf.p[1], eskf.p[2]);

        if (bridge) {
          const features = this._buildFeatureRow(imuAcc, imuGyro, eskf);
          bridge.pushFeatureRow(this.simTime, features);
        }
        return { imuAcc, imuGyro };
      }
    }

    // 1. Target Selection with Obstacle Avoidance Priority Override
    const isBypassing = this.bypassOverrideTarget !== null;
    const target = isBypassing ? this.bypassOverrideTarget : this.routePointsWorld[this.routeIndex];
    const err = new THREE.Vector3().subVectors(target, estimatedPos);
    const dist = Math.hypot(err.x, err.z);

    // Only advance route waypoints when NOT actively executing an obstacle bypass detour!
    if (!isBypassing && this.routeIndex < this.routePointsWorld.length - 1) {
      const nextWp = this.routePointsWorld[this.routeIndex + 1];
      const seg = new THREE.Vector3().subVectors(nextWp, target);
      seg.y = 0;
      const segLenSq = seg.lengthSq();
      if (segLenSq > 1e-4) {
        const toDrone = new THREE.Vector3().subVectors(estimatedPos, target);
        toDrone.y = 0;
        const projection = toDrone.dot(seg) / segLenSq;
        // Advance if close to waypoint OR passed it along path
        if (dist < this.WAYPOINT_TOLERANCE || projection > 0.40) {
          this.routeIndex++;
        }
      } else if (dist < this.WAYPOINT_TOLERANCE) {
        this.routeIndex++;
      }
    }

    // 2. Velocity command: proportional to position error, clamped to cruise speed
    const desiredVel = err.clone().normalize().multiplyScalar(
      Math.min(this.maxSpeed, this.kp_pos * dist)
    );

    // 3. Acceleration command: PD velocity damping
    const velErr = desiredVel.clone().sub(estimatedVel);
    const accelCmd = velErr.clone().multiplyScalar(this.kp_vel);

    // Acceleration clamp (prevents huge spikes)
    const MAX_ACCEL = 18.0; // m/s²
    if (accelCmd.length() > MAX_ACCEL) accelCmd.setLength(MAX_ACCEL);

    // 4. Synthesize IMU measurements
    // Specific Force in WORLD FRAME = commanded_accel - gravity
    const f_w = [accelCmd.x, accelCmd.y + 9.80665, accelCmd.z];

    // Transform specific force into BODY FRAME using transpose of R_WB (R_BW = R_WB^T)
    const R = eskf.R_WB;
    const f_b = [
      R[0] * f_w[0] + R[3] * f_w[1] + R[6] * f_w[2],
      R[1] * f_w[0] + R[4] * f_w[1] + R[7] * f_w[2],
      R[2] * f_w[0] + R[5] * f_w[1] + R[8] * f_w[2],
    ];

    const imuAcc = [
      f_b[0] + this._randn() * this.imuAccelNoise + this.accelBiasDrift[0],
      f_b[1] + this._randn() * this.imuAccelNoise + this.accelBiasDrift[1],
      f_b[2] + this._randn() * this.imuAccelNoise + this.accelBiasDrift[2],
    ];

    // Gyroscope measurements (heading turn rate + noise)
    const targetHeading = Math.atan2(-desiredVel.x, -desiredVel.z);
    let headingDiff = targetHeading - this.droneHeading;
    while (headingDiff > Math.PI)  headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

    const yawRate = THREE.MathUtils.clamp(headingDiff * 3.5, -2.5, 2.5);
    this.droneHeading += yawRate * dt;

    const imuGyro = [
      this._randn() * this.imuGyroNoise,
      yawRate + this._randn() * this.imuGyroNoise,
      this._randn() * this.imuGyroNoise,
    ];

    // 5. Dynamic Banking (tilt into turns and acceleration)
    const horizSpeed = Math.hypot(estimatedVel.x, estimatedVel.z);
    const targetPitch = THREE.MathUtils.clamp(-accelCmd.dot(new THREE.Vector3(Math.sin(this.droneHeading), 0, Math.cos(this.droneHeading))) * 0.02, -0.25, 0.25);
    const targetRoll  = THREE.MathUtils.clamp(-yawRate * 0.15, -0.30, 0.30);

    this.dronePitch = THREE.MathUtils.lerp(this.dronePitch, targetPitch, dt * 6.0);
    this.droneRoll  = THREE.MathUtils.lerp(this.droneRoll,  targetRoll,  dt * 6.0);

    // 6. ESKF Predict Step
    eskf.predict(imuAcc, imuGyro, dt);

    // 7. Update visible drone position from ESKF
    this.droneWorldPos.set(eskf.p[0], eskf.p[1], eskf.p[2]);

    // 8. Ground altitude safety floor
    const terrainH = this.terrain ? this.terrain.getHeight(this.droneWorldPos.x, this.droneWorldPos.z) : 5.0;
    const minAlt = terrainH + 2.5;
    if (this.droneWorldPos.y < minAlt) {
      this.droneWorldPos.y = minAlt;
      eskf.p[1] = minAlt;
      if (eskf.v[1] < 0) eskf.v[1] = 0;
    }

    // 9. Build 24 features in exact order and push to bridge
    if (bridge) {
      const features = this._buildFeatureRow(imuAcc, imuGyro, eskf);
      bridge.pushFeatureRow(this.simTime, features);
    }

    return { imuAcc, imuGyro };
  }

  // ── Exact 24 Features Extractor (README Section 4) ─────────────────────────

  _buildFeatureRow(imuAcc, imuGyro, eskf) {
    const [sig_px, sig_py, sig_pz] = eskf.positionSigmas;
    const [sig_vx, sig_vy, sig_vz] = eskf.velocitySigmas;
    const [sig_tx, sig_ty, sig_tz] = eskf.attitudeSigmas;
    const rot6 = eskf.rot6d;

    return [
      // 1-3: Gyroscope (rad/s)
      imuGyro[0], imuGyro[1], imuGyro[2],
      // 4-6: Accelerometer (m/s²)
      imuAcc[0], imuAcc[1], imuAcc[2],
      // 7-9: ESKF velocity (m/s)
      eskf.v[0], eskf.v[1], eskf.v[2],
      // 10-15: Rotation6D (r11, r21, r31, r12, r22, r32)
      rot6[0], rot6[1], rot6[2],
      rot6[3], rot6[4], rot6[5],
      // 16-18: Position sigma (m)
      sig_px, sig_py, sig_pz,
      // 19-21: Velocity sigma (m/s)
      sig_vx, sig_vy, sig_vz,
      // 22-24: Attitude sigma (rad)
      sig_tx, sig_ty, sig_tz,
    ];
  }

  _randn() {
    const u1 = Math.random(), u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1 + 1e-12)) * Math.cos(2 * Math.PI * u2);
  }

  distanceFromRoute() {
    if (this.routePointsWorld.length < 2) return 0;
    let minDist = Infinity;
    for (let i = 0; i < this.routePointsWorld.length - 1; i++) {
      const A = this.routePointsWorld[i];
      const B = this.routePointsWorld[i + 1];
      const AB = B.clone().sub(A);
      const AP = this.droneWorldPos.clone().sub(A);
      const t = Math.max(0, Math.min(1, AP.dot(AB) / (AB.dot(AB) + 1e-10)));
      const closest = A.clone().add(AB.multiplyScalar(t));
      const d = this.droneWorldPos.distanceTo(closest);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  get completionProgress() {
    if (!this.routePointsWorld.length) return 0;
    if (this.isFinished) return 100;
    return Math.min(99, Math.round((this.routeIndex / (this.routePointsWorld.length - 1)) * 100));
  }
}
