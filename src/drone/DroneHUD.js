/**
 * DroneHUD - Modern flight telemetry overlay.
 * Renders real-time altitude, airspeed, compass, district indicator,
 * flight modes, and obstacle proximity radar.
 */
export class DroneHUD {
  constructor() {
    this.container = null;
    this.initHUD();
  }

  initHUD() {
    this.container = document.createElement('div');
    this.container.id = 'drone-hud';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.fontFamily = "'Courier New', Courier, monospace";
    this.container.style.color = '#00e5ff';
    this.container.style.textShadow = '0 0 6px rgba(0, 229, 255, 0.7)';
    this.container.style.boxSizing = 'border-box';
    this.container.style.padding = '20px';

    this.container.innerHTML = `
      <!-- Top Bar: Flight Mode, District, System Status -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,229,255,0.4); padding-bottom: 8px;">
        <div style="font-size: 16px; font-weight: bold; letter-spacing: 2px;">
          DRONE SIM // <span id="hud-district" style="color: #ffea00;">DOWNTOWN SKYLINE</span>
        </div>
        <div style="font-size: 13px; display: flex; align-items: center; gap: 10px;">
          <span>
            MODE: <span id="hud-speedmode" style="color: #00e676;">MEDIUM</span> |
            CAM: <span id="hud-cammode" style="color: #ff9100;">CHASE</span> |
            GIMBAL: <span id="hud-gimbal" style="color: #00e5ff;">0°</span>
          </span>
          <!-- Interactive Fog Activation Button (Default: OFF) -->
          <button id="btn-toggle-fog" style="pointer-events: auto; background: rgba(0, 229, 255, 0.12); border: 1px solid rgba(0, 229, 255, 0.45); color: #00e5ff; border-radius: 4px; padding: 3px 10px; font-family: 'Courier New', monospace; font-size: 11px; font-weight: bold; cursor: pointer; letter-spacing: 1px; transition: all 0.2s;">
            🌫️ FOG: OFF [F]
          </button>
          <!-- Interactive Rain Activation Button (Default: OFF) -->
          <button id="btn-toggle-rain" style="pointer-events: auto; background: rgba(0, 229, 255, 0.12); border: 1px solid rgba(0, 229, 255, 0.45); color: #00e5ff; border-radius: 4px; padding: 3px 10px; font-family: 'Courier New', monospace; font-size: 11px; font-weight: bold; cursor: pointer; letter-spacing: 1px; transition: all 0.2s;">
            🌧️ RAIN: OFF [R]
          </button>
        </div>
        <div style="font-size: 12px; display: flex; align-items: center; gap: 12px;">
          <span id="hud-env-status" style="color: #00e676; font-size: 11px;">CLEAR (21°C | VIS >5km)</span>
          <span id="hud-fps" style="color: #76ff03;">60 FPS</span>
        </div>
      </div>

      <!-- Left Flight Instruments Column: Airspeed & Altitude -->
      <div style="position: absolute; left: 20px; top: 60px; background: rgba(10,15,22,0.85); padding: 10px 16px; border-left: 3px solid #00e5ff; border-radius: 6px; border: 1px solid rgba(0,229,255,0.25); border-left-width: 3px; min-width: 140px;">
        <div style="font-size: 10px; opacity: 0.8; letter-spacing: 1px;">AIRSPEED</div>
        <div id="hud-speed" style="font-size: 26px; font-weight: bold;">0.0</div>
        <div style="font-size: 10px; color: #b0bec5;">KM/H</div>
        <div style="margin-top: 6px; font-size: 9px; line-height: 1.4; color: #90a4ae;">
          [1] SLOW (18) | [2] MED (36) | [3] FAST (60)
        </div>
      </div>

      <div style="position: absolute; left: 20px; top: 195px; background: rgba(10,15,22,0.85); padding: 10px 16px; border-left: 3px solid #ffea00; border-radius: 6px; border: 1px solid rgba(255,234,0,0.25); border-left-width: 3px; min-width: 140px;">
        <div style="font-size: 10px; opacity: 0.8; letter-spacing: 1px; color: #ffea00;">ALTITUDE (AGL)</div>
        <div id="hud-alt-agl" style="font-size: 26px; font-weight: bold; color: #ffea00;">45.0</div>
        <div style="font-size: 10px; color: #b0bec5;">METERS</div>
        <div style="margin-top: 6px; font-size: 10px; opacity: 0.85;">MSL: <span id="hud-alt-msl">45.0</span> m</div>
      </div>

      <!-- Center Crosshair / Flight Reticle -->
      <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); opacity: 0.75;">
        <div style="width: 40px; height: 40px; border: 1px dashed #00e5ff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <div style="width: 4px; height: 4px; background: #00e5ff; border-radius: 50%;"></div>
        </div>
      </div>

      <!-- Bottom-Left Telemetry & Flight Controls Panel -->
      <div style="position: absolute; bottom: 20px; left: 20px; display: flex; gap: 10px; align-items: flex-end; z-index: 100;">
        <div style="background: rgba(10,15,22,0.85); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(0,229,255,0.25); font-size: 11px;">
          POS: <span id="hud-coords" style="color: #fff;">X: 250, Y: 45, Z: 0</span><br>
          HDG: <span id="hud-heading" style="color: #ffea00;">000°</span>
        </div>

        <div style="background: rgba(10,15,22,0.85); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(0,229,255,0.25); font-size: 10px; line-height: 1.45; color: #cfd8dc;">
          <strong style="color: #00e5ff;">FLIGHT:</strong> W/S: Pitch | A/D: Roll | Q/E: Yaw | Space/Shift: Elevate<br>
          <strong style="color: #ff9100;">CAM (V):</strong> Chase/FPV/Gimbal | <strong style="color: #00e5ff;">GIMBAL:</strong> I/K | <strong style="color: #ffea00;">ENV:</strong> [F] Fog | [R] Rain
        </div>
      </div>

      <!-- Center Bottom Proximity Warning -->
      <div id="hud-collision-warn" style="display: none; position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(213,0,0,0.9); color: #fff; padding: 8px 20px; border-radius: 4px; font-weight: bold; animation: pulse 0.5s infinite alternate; font-size: 12px; letter-spacing: 1px; z-index: 950;">
        TERRAIN / OBSTACLE PROXIMITY
      </div>
    `;

    document.body.appendChild(this.container);

    // Setup Fog & Rain Toggle Buttons and Status Indicators
    this.btnFog = document.getElementById('btn-toggle-fog');
    this.btnRain = document.getElementById('btn-toggle-rain');
    this.envStatusEl = document.getElementById('hud-env-status');
    this.onToggleFog = null;
    this.onToggleRain = null;

    if (this.btnFog) {
      this.btnFog.addEventListener('click', () => {
        if (typeof this.onToggleFog === 'function') {
          this.onToggleFog();
        }
      });
      this.btnFog.addEventListener('mouseenter', () => {
        this.btnFog.style.boxShadow = '0 0 8px rgba(0, 229, 255, 0.5)';
      });
      this.btnFog.addEventListener('mouseleave', () => {
        this.btnFog.style.boxShadow = 'none';
      });
    }

    if (this.btnRain) {
      this.btnRain.addEventListener('click', () => {
        if (typeof this.onToggleRain === 'function') {
          this.onToggleRain();
        }
      });
      this.btnRain.addEventListener('mouseenter', () => {
        this.btnRain.style.boxShadow = '0 0 8px rgba(0, 180, 255, 0.5)';
      });
      this.btnRain.addEventListener('mouseleave', () => {
        this.btnRain.style.boxShadow = 'none';
      });
    }
  }

  setWeatherStatus(weatherTele) {
    if (!this.btnFog || !this.btnRain) return;

    // Update Fog button state
    if (weatherTele.fogActive) {
      this.btnFog.textContent = '🌫️ FOG: ACTIVE [F]';
      this.btnFog.style.background = 'rgba(255, 170, 0, 0.25)';
      this.btnFog.style.border = '1px solid #ffaa00';
      this.btnFog.style.color = '#ffea00';
    } else {
      this.btnFog.textContent = '🌫️ FOG: OFF [F]';
      this.btnFog.style.background = 'rgba(0, 229, 255, 0.12)';
      this.btnFog.style.border = '1px solid rgba(0, 229, 255, 0.45)';
      this.btnFog.style.color = '#00e5ff';
    }

    // Update Rain button state
    if (weatherTele.rainActive) {
      this.btnRain.textContent = '🌧️ RAIN: ACTIVE [R]';
      this.btnRain.style.background = 'rgba(0, 180, 255, 0.25)';
      this.btnRain.style.border = '1px solid #00b4ff';
      this.btnRain.style.color = '#40c4ff';
    } else {
      this.btnRain.textContent = '🌧️ RAIN: OFF [R]';
      this.btnRain.style.background = 'rgba(0, 229, 255, 0.12)';
      this.btnRain.style.border = '1px solid rgba(0, 229, 255, 0.45)';
      this.btnRain.style.color = '#00e5ff';
    }

    // Update Overall Weather Status Banner
    if (this.envStatusEl) {
      if (weatherTele.fogActive && weatherTele.rainActive) {
        this.envStatusEl.textContent = `STORM (${weatherTele.temperature.toFixed(1)}°C | VIS ${weatherTele.visibility.toFixed(0)}m | RAIN ${weatherTele.rainRate.toFixed(0)}mm/h)`;
        this.envStatusEl.style.color = '#ff5252';
      } else if (weatherTele.rainActive) {
        this.envStatusEl.textContent = `RAIN (${weatherTele.temperature.toFixed(1)}°C | VIS ${weatherTele.visibility.toFixed(0)}m | 20mm/h)`;
        this.envStatusEl.style.color = '#40c4ff';
      } else if (weatherTele.fogActive) {
        this.envStatusEl.textContent = `FOG (${weatherTele.temperature.toFixed(1)}°C | VIS ${weatherTele.visibility.toFixed(0)}m | 100% RH)`;
        this.envStatusEl.style.color = '#ffaa00';
      } else {
        this.envStatusEl.textContent = `CLEAR (${weatherTele.temperature.toFixed(1)}°C | VIS >5km)`;
        this.envStatusEl.style.color = '#00e676';
      }
    }
  }

  update(telemetry, hasCollided, fps) {
    document.getElementById('hud-district').textContent = telemetry.district;
    document.getElementById('hud-speedmode').textContent = telemetry.speedMode;
    document.getElementById('hud-cammode').textContent = telemetry.cameraMode;
    const gimbalEl = document.getElementById('hud-gimbal');
    if (gimbalEl && telemetry.gimbalDeg !== undefined) {
      gimbalEl.textContent = `${telemetry.gimbalDeg}°`;
    }
    document.getElementById('hud-speed').textContent = telemetry.speedKMH;
    document.getElementById('hud-alt-agl').textContent = telemetry.altitudeAGL;
    document.getElementById('hud-alt-msl').textContent = telemetry.altitudeMSL;
    document.getElementById('hud-heading').textContent = `${telemetry.heading}°`;
    document.getElementById('hud-coords').textContent = `X: ${telemetry.x}, Y: ${telemetry.y}, Z: ${telemetry.z}`;
    document.getElementById('hud-fps').textContent = `${fps} FPS`;

    const warn = document.getElementById('hud-collision-warn');
    if (warn) {
      warn.style.display = hasCollided ? 'block' : 'none';
    }
  }
}
