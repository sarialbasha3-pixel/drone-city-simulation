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
        <div style="font-size: 14px;">
          MODE: <span id="hud-speedmode" style="color: #00e676;">MEDIUM</span> |
          CAM: <span id="hud-cammode" style="color: #ff9100;">CHASE</span> |
          GIMBAL: <span id="hud-gimbal" style="color: #00e5ff;">0°</span>
        </div>
        <div id="hud-fps" style="font-size: 14px; color: #76ff03;">60 FPS</div>
      </div>

      <!-- Left Instrument: Airspeed & Speed Modes -->
      <div style="position: absolute; left: 25px; top: 120px; background: rgba(10,15,22,0.75); padding: 12px 18px; border-left: 3px solid #00e5ff; border-radius: 4px;">
        <div style="font-size: 11px; opacity: 0.8;">AIRSPEED</div>
        <div id="hud-speed" style="font-size: 28px; font-weight: bold;">0.0</div>
        <div style="font-size: 11px; color: #b0bec5;">KM/H</div>
        <div style="margin-top: 10px; font-size: 10px; line-height: 1.5; color: #90a4ae;">
          [1] SLOW   (18 km/h)<br>
          [2] MEDIUM (36 km/h)<br>
          [3] FAST   (60 km/h)
        </div>
      </div>

      <!-- Right Instrument: Altitude AGL & MSL -->
      <div style="position: absolute; right: 25px; top: 120px; background: rgba(10,15,22,0.75); padding: 12px 18px; border-right: 3px solid #00e5ff; border-radius: 4px; text-align: right;">
        <div style="font-size: 11px; opacity: 0.8;">ALTITUDE (AGL)</div>
        <div id="hud-alt-agl" style="font-size: 28px; font-weight: bold; color: #ffea00;">45.0</div>
        <div style="font-size: 11px; color: #b0bec5;">METERS</div>
        <div style="margin-top: 8px; font-size: 11px; opacity: 0.8;">MSL: <span id="hud-alt-msl">45.0</span> m</div>
      </div>

      <!-- Center Crosshair / Flight Reticle -->
      <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); opacity: 0.75;">
        <div style="width: 40px; height: 40px; border: 1px dashed #00e5ff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
          <div style="width: 4px; height: 4px; background: #00e5ff; border-radius: 50%;"></div>
        </div>
      </div>

      <!-- Bottom Bar: Coordinates, Heading, Proximity Warning -->
      <div style="position: absolute; bottom: 20px; left: 20px; right: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div style="background: rgba(10,15,22,0.8); padding: 10px 14px; border-radius: 4px; font-size: 12px;">
          POS: <span id="hud-coords" style="color: #fff;">X: 250, Y: 45, Z: 0</span><br>
          HDG: <span id="hud-heading" style="color: #ffea00;">000°</span>
        </div>

        <div id="hud-collision-warn" style="display: none; background: rgba(213,0,0,0.85); color: #fff; padding: 8px 18px; border-radius: 4px; font-weight: bold; animation: pulse 0.5s infinite alternate;">
          TERRAIN / OBSTACLE PROXIMITY
        </div>

        <div style="background: rgba(10,15,22,0.8); padding: 10px 14px; border-radius: 4px; font-size: 11px; line-height: 1.45; color: #cfd8dc; text-align: right;">
          <strong style="color: #00e5ff;">FLIGHT:</strong> W/S: Pitch | A/D: Roll | Q/E: Yaw | Space/Shift: Elevate<br>
          <strong style="color: #ff9100;">CAM (V):</strong> Chase / FPV (Nose) / Gimbal / Inspect / Overhead<br>
          <strong style="color: #00e5ff;">GIMBAL:</strong> I/K or T/G: Tilt | C: Horizon / 45° / 90° Preset
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
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
