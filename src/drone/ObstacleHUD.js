/**
 * ObstacleHUD.js
 *
 * Implements a modern telemetry display and live Camera Sensor monitor:
 * 1. Live 200x200 Camera Sensor Picture-in-Picture (PiP) viewport
 * 2. Visual targeting crosshairs, obstacle dimension brackets & horizon indicator
 * 3. Multi-type target identification (BUILDING, BARRIER, BRIDGE) with exact 3D dimensions
 * 4. Controlled approach maneuver telemetry and nearest-bypass route status
 * 5. Autonomous route priority status (Avoidance Override vs Route Tracking)
 * 6. Interactive controls [O] Avoidance, [T] Target Lock/Approach, [L] 3D Lasers, [P] Sensor View
 */
export class ObstacleHUD {
  constructor(cameraSensor) {
    this.cameraSensor = cameraSensor;
    this.visible = true;
    this.pipVisible = true;

    this.createElements();
    this.initKeyboard();
  }

  createElements() {
    // ── 1. Master Container (Organized Bottom-Right Cockpit Layout) ─────────
    this.container = document.createElement('div');
    this.container.id = 'dronet-obstacle-hud';
    this.container.style.position = 'fixed';
    this.container.style.right = '20px';
    this.container.style.bottom = '20px';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'row';
    this.container.style.alignItems = 'flex-end';
    this.container.style.gap = '12px';
    this.container.style.fontFamily = "'JetBrains Mono', 'Roboto Mono', Consolas, monospace";
    this.container.style.zIndex = '900';
    this.container.style.pointerEvents = 'none';

    // ── 2. Live Camera Sensor PiP Panel ──────────────────────────────────────
    this.pipCard = document.createElement('div');
    this.pipCard.style.background = 'rgba(10, 14, 20, 0.88)';
    this.pipCard.style.border = '1px solid rgba(0, 229, 255, 0.45)';
    this.pipCard.style.borderRadius = '8px';
    this.pipCard.style.padding = '8px';
    this.pipCard.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 229, 255, 0.15)';
    this.pipCard.style.backdropFilter = 'blur(6px)';
    this.pipCard.style.width = '216px';

    const pipHeader = document.createElement('div');
    pipHeader.style.display = 'flex';
    pipHeader.style.justifyContent = 'space-between';
    pipHeader.style.alignItems = 'center';
    pipHeader.style.fontSize = '10px';
    pipHeader.style.color = '#00e5ff';
    pipHeader.style.fontWeight = 'bold';
    pipHeader.style.letterSpacing = '1px';
    pipHeader.style.marginBottom = '6px';
    pipHeader.innerHTML = `<span>● OPTICAL SENSOR CAM</span><span>200×200</span>`;
    this.pipCard.appendChild(pipHeader);

    // Canvas wrapper with visual crosshair overlay
    const canvasWrap = document.createElement('div');
    canvasWrap.style.position = 'relative';
    canvasWrap.style.width = '200px';
    canvasWrap.style.height = '200px';
    canvasWrap.style.margin = '0 auto';
    canvasWrap.style.overflow = 'hidden';
    canvasWrap.style.borderRadius = '4px';
    canvasWrap.style.border = '1px solid rgba(255, 255, 255, 0.15)';

    // Attach camera sensor display canvas
    const sensorCanvas = this.cameraSensor.getCanvas();
    sensorCanvas.style.width = '100%';
    sensorCanvas.style.height = '100%';
    sensorCanvas.style.display = 'block';
    canvasWrap.appendChild(sensorCanvas);

    // Optical Reticle & Crosshair Overlay
    this.reticleOverlay = document.createElement('div');
    this.reticleOverlay.style.position = 'absolute';
    this.reticleOverlay.style.top = '0';
    this.reticleOverlay.style.left = '0';
    this.reticleOverlay.style.width = '100%';
    this.reticleOverlay.style.height = '100%';
    this.reticleOverlay.style.pointerEvents = 'none';
    this.reticleOverlay.innerHTML = `
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border:1px dashed rgba(0,229,255,0.7);border-radius:50%;"></div>
      <div style="position:absolute;top:50%;left:30%;width:40%;height:1px;background:rgba(0,229,255,0.4);"></div>
      <div style="position:absolute;top:30%;left:50%;width:1px;height:40%;background:rgba(0,229,255,0.4);"></div>
      <div id="obstacle-target-box" style="display:none;position:absolute;border:2px solid #ff2244;box-shadow:0 0 10px #ff2244;transition:all 0.1s;"></div>
    `;
    canvasWrap.appendChild(this.reticleOverlay);
    this.pipCard.appendChild(canvasWrap);
    this.container.appendChild(this.pipCard);

    // ── 3. PULP-DroNet & Target Telemetry Card ────────────────────────────────
    this.teleCard = document.createElement('div');
    this.teleCard.style.background = 'rgba(10, 14, 20, 0.92)';
    this.teleCard.style.border = '1px solid rgba(0, 229, 255, 0.35)';
    this.teleCard.style.borderRadius = '8px';
    this.teleCard.style.padding = '10px 12px';
    this.teleCard.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.6)';
    this.teleCard.style.backdropFilter = 'blur(6px)';
    this.teleCard.style.width = '216px';
    this.teleCard.style.color = '#e0e6ed';
    this.teleCard.style.fontSize = '11px';

    this.teleCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:5px;margin-bottom:8px;">
        <span style="font-weight:bold;color:#00e5ff;font-size:11px;letter-spacing:0.8px;">PULP-DRONET v3</span>
        <span id="dronet-status-badge" style="background:#00e5ff;color:#05070a;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:bold;">READY</span>
      </div>

      <!-- Priority Mode Indicator -->
      <div style="margin-bottom:6px;padding:4px 6px;border-radius:4px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.2);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:9px;color:#8a99a8;">SYSTEM PRIORITY:</span>
        <span id="dronet-priority-badge" style="font-size:9px;font-weight:bold;color:#00e5ff;">ROUTE TRACKING</span>
      </div>

      <!-- Active Target Identification & Controlled Approach Box -->
      <div id="dronet-target-box" style="display:none;margin-bottom:6px;padding:6px;border-radius:4px;background:rgba(0,229,255,0.1);border:1px solid #00e5ff;">
        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;color:#00e5ff;margin-bottom:2px;">
          <span id="dronet-target-id">TARGET: BLDG_01</span>
          <span id="dronet-target-range" style="color:#ffaa00;">45.0m</span>
        </div>
        <div style="font-size:9px;color:#cbd5e1;margin-bottom:2px;">
          DIMS: <span id="dronet-target-dims">32.0×48.0×26.0m</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#00ff66;font-weight:bold;">
          <span id="dronet-maneuver-state">CONTROLLED APPROACH</span>
        </div>
      </div>

      <!-- Nearest Bypass Info -->
      <div id="dronet-bypass-box" style="display:none;margin-bottom:6px;padding:6px;border-radius:4px;background:rgba(255,170,0,0.1);border:1px solid #ffaa00;">
        <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:bold;color:#ffaa00;margin-bottom:2px;">
          <span>OPTIMAL BYPASS:</span>
          <span id="dronet-bypass-type">LEFT</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#8a99a8;margin-bottom:2px;">
          <span>DETOUR PROGRESS</span>
          <span id="dronet-bypass-pct">0%</span>
        </div>
        <div style="width:100%;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
          <div id="dronet-bypass-bar" style="width:0%;height:100%;background:#ffaa00;transition:width 0.15s;"></div>
        </div>
      </div>

      <!-- Collision Probability -->
      <div style="margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#8a99a8;margin-bottom:2px;">
          <span>COLLISION RISK (P_coll)</span>
          <span id="dronet-risk-pct" style="color:#fff;font-weight:bold;">0%</span>
        </div>
        <div style="width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
          <div id="dronet-risk-bar" style="width:0%;height:100%;background:#00e5ff;transition:width 0.15s, background-color 0.2s;"></div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:10px;">
        <span style="color:#8a99a8;">STEERING YAW</span>
        <span id="dronet-steer-val" style="color:#00e5ff;font-weight:bold;">0.00 rad</span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:10px;">
        <span style="color:#8a99a8;">FWD CLEARANCE</span>
        <span id="dronet-fwd-clearance" style="color:#fff;font-weight:bold;">180.0 m</span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:10px;">
        <span style="color:#8a99a8;">SAFETY RADAR</span>
        <span id="dronet-radar-alert" style="color:#00ff66;font-weight:bold;">CLEAR</span>
      </div>

      <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;margin-top:6px;font-size:9px;color:#6b7c8f;line-height:1.4;">
        <div>[O] Avoidance: <span id="dronet-avoid-toggle" style="color:#00ff66;font-weight:bold;">ON</span> | [T] Target Lock</div>
        <div>[L] 3D Lasers: <span id="dronet-laser-toggle" style="color:#8a99a8;">OFF</span> | [P] Sensor View</div>
      </div>
    `;

    this.container.appendChild(this.teleCard);
    document.body.appendChild(this.container);

    // Cache DOM references
    this.elStatusBadge = document.getElementById('dronet-status-badge');
    this.elPriorityBadge = document.getElementById('dronet-priority-badge');
    this.elTargetBox = document.getElementById('dronet-target-box');
    this.elTargetId = document.getElementById('dronet-target-id');
    this.elTargetRange = document.getElementById('dronet-target-range');
    this.elTargetDims = document.getElementById('dronet-target-dims');
    this.elManeuverState = document.getElementById('dronet-maneuver-state');
    this.elBypassBox = document.getElementById('dronet-bypass-box');
    this.elBypassType = document.getElementById('dronet-bypass-type');
    this.elBypassPct = document.getElementById('dronet-bypass-pct');
    this.elBypassBar = document.getElementById('dronet-bypass-bar');
    this.elRiskPct = document.getElementById('dronet-risk-pct');
    this.elRiskBar = document.getElementById('dronet-risk-bar');
    this.elSteerVal = document.getElementById('dronet-steer-val');
    this.elFwdClear = document.getElementById('dronet-fwd-clearance');
    this.elRadarAlert = document.getElementById('dronet-radar-alert');
    this.elAvoidToggle = document.getElementById('dronet-avoid-toggle');
    this.elLaserToggle = document.getElementById('dronet-laser-toggle');
    this.elReticleBox = document.getElementById('obstacle-target-box');
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') {
        this.pipVisible = !this.pipVisible;
        this.pipCard.style.display = this.pipVisible ? 'block' : 'none';
      }
    });
  }

  update(dronetTelemetry, perceptionTelemetry) {
    if (!this.visible) return;

    const pColl = dronetTelemetry.collisionProb;
    const steer = dronetTelemetry.steeringAngle;
    const status = dronetTelemetry.status;
    const enabled = dronetTelemetry.enabled;
    const isBypassing = dronetTelemetry.isBypassing;
    const bypassType = dronetTelemetry.bypassType;
    const bypassPct = dronetTelemetry.bypassProgress || 0;
    const target = dronetTelemetry.activeTarget;
    const approachActive = dronetTelemetry.approachManeuverActive;

    // 1. System Enabled & Status Badge
    if (!enabled) {
      this.elStatusBadge.textContent = 'OFF';
      this.elStatusBadge.style.background = '#555';
      this.elStatusBadge.style.color = '#fff';
      this.elAvoidToggle.textContent = 'OFF';
      this.elAvoidToggle.style.color = '#ff4444';
      this.elPriorityBadge.textContent = 'AVOIDANCE DISABLED';
      this.elPriorityBadge.style.color = '#ff4444';
      this.elTargetBox.style.display = 'none';
      this.elBypassBox.style.display = 'none';
    } else {
      this.elAvoidToggle.textContent = 'ON';
      this.elAvoidToggle.style.color = '#00ff66';

      this.elStatusBadge.textContent = status;

      // Target Identification display
      if (target) {
        this.elTargetBox.style.display = 'block';
        this.elTargetId.textContent = `TARGET: ${target.id} [${target.type}]`;
        this.elTargetRange.textContent = `${target.distance.toFixed(1)}m`;
        const dims = target.dimensions;
        this.elTargetDims.textContent = `${dims.width.toFixed(1)}×${dims.height.toFixed(1)}×${dims.depth.toFixed(1)}m`;

        if (approachActive) {
          this.elManeuverState.textContent = '● CONTROLLED APPROACH LOCK';
          this.elManeuverState.style.color = '#00e5ff';
        } else if (isBypassing) {
          this.elManeuverState.textContent = `● EXECUTING BYPASS [${bypassType}]`;
          this.elManeuverState.style.color = '#ffaa00';
        } else {
          this.elManeuverState.textContent = '● TARGET TRACKED';
          this.elManeuverState.style.color = '#00ff66';
        }
      } else {
        this.elTargetBox.style.display = 'none';
      }

      // Bypass Panel
      if (isBypassing) {
        this.elStatusBadge.style.background = '#ffaa00';
        this.elStatusBadge.style.color = '#000';
        this.elPriorityBadge.textContent = 'AVOIDANCE OVERRIDE (PRIORITY)';
        this.elPriorityBadge.style.color = '#ffaa00';

        this.elBypassBox.style.display = 'block';
        this.elBypassType.textContent = bypassType;
        this.elBypassPct.textContent = `${bypassPct}%`;
        this.elBypassBar.style.width = `${bypassPct}%`;
      } else {
        this.elBypassBox.style.display = 'none';
        this.elPriorityBadge.textContent = 'ROUTE TRACKING (NORMAL)';
        this.elPriorityBadge.style.color = '#00e5ff';

        if (approachActive) {
          this.elStatusBadge.style.background = '#00e5ff';
          this.elStatusBadge.style.color = '#000';
        } else if (status === 'RETURNING') {
          this.elStatusBadge.style.background = '#00e5ff';
          this.elStatusBadge.style.color = '#000';
        } else {
          this.elStatusBadge.style.background = '#00ff66';
          this.elStatusBadge.style.color = '#000';
        }
      }
    }

    // 2. Collision Risk Gauge
    const pct = Math.round(Math.min(1.0, Math.max(0.0, pColl)) * 100);
    this.elRiskPct.textContent = `${pct}%`;
    this.elRiskBar.style.width = `${pct}%`;

    if (pct > 65) {
      this.elRiskBar.style.background = '#ff2244';
      this.elRiskPct.style.color = '#ff2244';
    } else if (pct > 30) {
      this.elRiskBar.style.background = '#ffaa00';
      this.elRiskPct.style.color = '#ffaa00';
    } else {
      this.elRiskBar.style.background = '#00e5ff';
      this.elRiskPct.style.color = '#00e5ff';
    }

    // 3. Steering Angle
    const steerPrefix = steer > 0 ? '+' : '';
    this.elSteerVal.textContent = `${steerPrefix}${steer.toFixed(2)} rad`;

    // 4. Extended Perception Readouts
    if (perceptionTelemetry) {
      const fwd = perceptionTelemetry.forwardClearance;
      this.elFwdClear.textContent = fwd >= 180 ? '>180.0 m' : `${fwd.toFixed(1)} m`;

      const alert = perceptionTelemetry.alertLevel;
      this.elRadarAlert.textContent = alert;
      if (alert === 'CRITICAL') {
        this.elRadarAlert.style.color = '#ff2244';
      } else if (alert === 'WARNING') {
        this.elRadarAlert.style.color = '#ffaa00';
      } else {
        this.elRadarAlert.style.color = '#00ff66';
      }

      this.elLaserToggle.textContent = perceptionTelemetry.lasersActive ? 'ON' : 'OFF';
      this.elLaserToggle.style.color = perceptionTelemetry.lasersActive ? '#00ff66' : '#8a99a8';
    }

    // 5. Target Obstacle Bracket in Camera Sensor
    if (target) {
      this.elReticleBox.style.display = 'block';
      const boxSize = Math.max(28, Math.min(130, Math.round(pColl * 140)));
      this.elReticleBox.style.width = `${boxSize}px`;
      this.elReticleBox.style.height = `${boxSize}px`;
      this.elReticleBox.style.top = `calc(50% - ${boxSize / 2}px)`;
      this.elReticleBox.style.left = `calc(50% - ${boxSize / 2}px)`;
    } else {
      this.elReticleBox.style.display = 'none';
    }
  }
}
