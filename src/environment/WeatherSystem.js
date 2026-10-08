import * as THREE from 'three';

/**
 * WeatherSystem.js
 *
 * Manages dynamic environmental atmospheric conditions and physically grounded
 * sensor degradation for optical cameras and MEMS IMU sensors across multiple
 * weather regimes: CLEAR SKY (default), FOG, RAIN, and STORM.
 *
 * Scientific Background & Grounding:
 * 1. Optical Fog (WMO / ICAO Moderate-to-Dense Fog):
 *    - Meteorological Optical Range (MOR) drops from >5000m to ~85m (extinction coeff beta ~ 0.046 m^-1).
 *    - Direct solar irradiance diminishes from 2.2 to 0.52; skylight shifts to diffuse overcast scattering.
 *    - Three.js scene fog exponentially shrouds both third-person camera and optical sensor camera.
 * 2. Optical Rain (Marshall-Palmer DSD & ITU-R P.838):
 *    - Rainfall rate: 20 mm/h (Moderate-to-Heavy Rain).
 *    - Atmospheric visibility: ~1100m.
 *    - 3D particle rain simulation with falling streaks centered on drone.
 *    - Camera lens droplet splashes and refractive streak distortion.
 * 3. MEMS IMU Degradation in Rain (NASA / IEEE Empirical UAV Rain Studies):
 *    - High-velocity rotor blade impacts against raindrops (kinetic energy E_k = 1/2 m v^2)
 *      and blade droplet mass accumulation induce severe broadband mechanical frame vibration.
 *    - Accelerometer Noise Density: increases from 0.060 m/s² -> 0.115 m/s² (+92%).
 *    - Gyroscope Noise Density: increases from 0.0040 rad/s -> 0.0072 rad/s (+80% from torque buffeting).
 *    - Thermal shock: Ambient temperature drops by ~4.0°C, shifting bias offset.
 */
export class WeatherSystem {
  constructor(scene, lighting, skyDome, routeController, droneCameraSensor, options = {}) {
    this.scene = scene;
    this.lighting = lighting;
    this.skyDome = skyDome;
    this.routeController = routeController;
    this.droneCameraSensor = droneCameraSensor;

    // Environmental states: MUST be false by default (Clear sky is default)
    this.fogActive = false;
    this.rainActive = false;

    this.fogProgress = 0.0;   // 0.0 = clear, 1.0 = fully foggy
    this.rainProgress = 0.0;  // 0.0 = clear, 1.0 = fully rainy
    this.transitionDuration = 1.6; // 1.6 seconds smooth rolling transition

    // ── Researched Physical IMU Parameters ─────────────────────────────────
    this.imuBaseline = {
      accelNoise: 0.060,                    // m/s² (Baseline flight controller noise)
      gyroNoise: 0.0040,                    // rad/s
      accelBias: [0.015, 0.008, 0.012],     // m/s²
      gyroBias: [0.0, 0.0, 0.0],            // rad/s
      temperature: 21.5,                    // °C
      humidity: 48,                         // %
      visibility: 6000.0,                   // m
      precipitation: 0.0                    // mm/h
    };

    this.imuFoggy = {
      accelNoise: 0.088,                    // m/s² (+46% from aerosol blade vibration)
      gyroNoise: 0.0058,                    // rad/s (+45% angular random walk)
      accelBias: [0.034, 0.027, 0.031],     // m/s² (Thermal gradient shift: TCO ~0.35 mg/K * 7.3K)
      gyroBias: [0.0018, 0.0022, 0.0015],   // rad/s (TCO ~22 mdps/K * 7.3K)
      temperature: 14.2,                    // °C (Dew point cooling in 100% saturated air)
      humidity: 100,                        // % (Saturated water vapor)
      visibility: 85.0,                     // m (Moderate/dense radiation fog MOR)
      precipitation: 0.0                    // mm/h
    };

    this.imuRainy = {
      accelNoise: 0.115,                    // m/s² (+92% broadband mechanical vibration from raindrop impacts)
      gyroNoise: 0.0072,                    // rad/s (+80% angular torque buffeting)
      accelBias: [0.029, 0.022, 0.026],     // m/s² (Thermal drop: -4.0°C)
      gyroBias: [0.0012, 0.0015, 0.0010],   // rad/s (TCO ~22 mdps/K * 4.0K)
      temperature: 17.5,                    // °C (Overcast rain temperature)
      humidity: 98,                         // % (Near-saturation)
      visibility: 1100.0,                   // m (Marshall-Palmer rain extinction MOR)
      precipitation: 20.0                   // mm/h (Moderate-to-Heavy Rain)
    };

    // Current live IMU values
    this.currentAccelNoise = this.imuBaseline.accelNoise;
    this.currentGyroNoise = this.imuBaseline.gyroNoise;
    this.currentAccelBias = [...this.imuBaseline.accelBias];
    this.currentGyroBias = [...this.imuBaseline.gyroBias];
    this.currentTemperature = this.imuBaseline.temperature;
    this.currentHumidity = this.imuBaseline.humidity;
    this.currentVisibility = this.imuBaseline.visibility;
    this.currentPrecipitation = 0.0;

    // ── Visual Atmospheric Fog Settings ────────────────────────────────────
    this.clearFog = {
      color: new THREE.Color(0xb0c4de),
      density: 0.00075
    };

    this.denseFog = {
      color: new THREE.Color(0x90a3b2),
      density: 0.0165
    };

    this.rainFog = {
      color: new THREE.Color(0x708290),
      density: 0.0035
    };

    // Save initial lighting values
    this.initLightingValues();

    // Initialize 3D Rain Particle System
    this.initRainSystem();

    // Callback listeners for UI
    this.onStateChangeCallbacks = [];
  }

  initLightingValues() {
    if (this.lighting && this.lighting.sunLight) {
      this.clearSunIntensity = this.lighting.sunLight.intensity || 2.2;
      this.clearSunColor = this.lighting.sunLight.color.clone();
    } else {
      this.clearSunIntensity = 2.2;
      this.clearSunColor = new THREE.Color(0xfffaed);
    }

    this.fogSunIntensity = 0.55;
    this.fogSunColor = new THREE.Color(0xd0dbe5);

    this.rainSunIntensity = 0.35;
    this.rainSunColor = new THREE.Color(0xa0b0c0);

    if (this.lighting && this.lighting.hemiLight) {
      this.clearHemiIntensity = this.lighting.hemiLight.intensity || 0.75;
      this.clearHemiSkyColor = this.lighting.hemiLight.color.clone();
      this.clearHemiGroundColor = this.lighting.hemiLight.groundColor.clone();
    } else {
      this.clearHemiIntensity = 0.75;
      this.clearHemiSkyColor = new THREE.Color(0xddeeff);
      this.clearHemiGroundColor = new THREE.Color(0x443322);
    }

    this.fogHemiIntensity = 1.15;
    this.fogHemiSkyColor = new THREE.Color(0x9aaebc);
    this.fogHemiGroundColor = new THREE.Color(0x5a6875);

    this.rainHemiIntensity = 0.65;
    this.rainHemiSkyColor = new THREE.Color(0x556677);
    this.rainHemiGroundColor = new THREE.Color(0x2a3540);
  }

  initRainSystem() {
    this.rainParticleCount = 4500;
    this.rainGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainParticleCount * 3);
    const velocities = new Float32Array(this.rainParticleCount);

    this.rainBounds = {
      radiusX: 45.0,
      radiusZ: 45.0,
      heightY: 45.0
    };

    for (let i = 0; i < this.rainParticleCount; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * this.rainBounds.radiusX * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * this.rainBounds.heightY * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * this.rainBounds.radiusZ * 2;
      velocities[i] = 28.0 + Math.random() * 12.0; // Terminal velocity ~28 - 40 m/s
    }

    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocities = velocities;

    this.rainMaterial = new THREE.PointsMaterial({
      color: 0xc8e6ff,
      size: 0.35,
      transparent: true,
      opacity: 0.0,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.rainPoints = new THREE.Points(this.rainGeometry, this.rainMaterial);
    this.rainPoints.name = 'environmental_rain_particles';
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);
  }

  toggleFog() {
    this.setFog(!this.fogActive);
    return this.fogActive;
  }

  setFog(active) {
    this.fogActive = Boolean(active);
    console.log(`[WeatherSystem] Fog: ${this.fogActive ? 'ACTIVE' : 'OFF'}`);
    this.notifyStateChange();
  }

  toggleRain() {
    this.setRain(!this.rainActive);
    return this.rainActive;
  }

  setRain(active) {
    this.rainActive = Boolean(active);
    console.log(`[WeatherSystem] Rain: ${this.rainActive ? 'ACTIVE' : 'OFF'}`);
    this.notifyStateChange();
  }

  onStateChange(cb) {
    if (typeof cb === 'function') {
      this.onStateChangeCallbacks.push(cb);
    }
  }

  notifyStateChange() {
    const tele = this.getTelemetry();
    this.onStateChangeCallbacks.forEach((cb) => {
      try { cb(tele); } catch (e) { console.error(e); }
    });
  }

  /**
   * Called in the main per-frame loop to smoothly interpolate atmospheric visuals,
   * animate 3D rain particles, and update IMU parameters.
   */
  update(delta, dronePos = null) {
    const targetFog = this.fogActive ? 1.0 : 0.0;
    const targetRain = this.rainActive ? 1.0 : 0.0;
    const step = delta / this.transitionDuration;

    // Smooth transition for Fog
    if (Math.abs(this.fogProgress - targetFog) > 0.001) {
      this.fogProgress = (this.fogProgress < targetFog)
        ? Math.min(targetFog, this.fogProgress + step)
        : Math.max(targetFog, this.fogProgress - step);
    }

    // Smooth transition for Rain
    if (Math.abs(this.rainProgress - targetRain) > 0.001) {
      this.rainProgress = (this.rainProgress < targetRain)
        ? Math.min(targetRain, this.rainProgress + step)
        : Math.max(targetRain, this.rainProgress - step);
    }

    // Apply atmospheric visual changes
    this.applyAtmosphericVisuals(this.fogProgress, this.rainProgress);

    // Update 3D Rain Particles
    this.updateRainParticles(delta, dronePos);

    // Apply physically researched IMU parameters
    this.applyIMUParameters(this.fogProgress, this.rainProgress);

    // Update camera sensor environmental factors
    if (this.droneCameraSensor) {
      this.droneCameraSensor.setFogFactor(this.fogProgress);
      if (this.droneCameraSensor.setRainFactor) {
        this.droneCameraSensor.setRainFactor(this.rainProgress);
      }
    }
  }

  updateRainParticles(delta, dronePos) {
    if (!this.rainPoints) return;

    if (this.rainProgress <= 0.01) {
      this.rainPoints.visible = false;
      return;
    }

    this.rainPoints.visible = true;
    this.rainMaterial.opacity = this.rainProgress * 0.72;

    const center = dronePos || new THREE.Vector3(0, 45, 0);
    const posAttr = this.rainGeometry.attributes.position;
    const pos = posAttr.array;
    const count = this.rainParticleCount;
    const windTiltX = -4.5 * delta;
    const windTiltZ = 2.0 * delta;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const vy = this.rainVelocities[i];

      pos[idx + 1] -= vy * delta;
      pos[idx]     += windTiltX * (vy / 30.0);
      pos[idx + 2] += windTiltZ * (vy / 30.0);

      // Boundary wrapping centered around drone
      if (pos[idx + 1] < center.y - 18.0) {
        pos[idx + 1] = center.y + 27.0 + (Math.random() * 4.0);
        pos[idx]     = center.x + (Math.random() - 0.5) * this.rainBounds.radiusX * 2;
        pos[idx + 2] = center.z + (Math.random() - 0.5) * this.rainBounds.radiusZ * 2;
      }
      if (Math.abs(pos[idx] - center.x) > this.rainBounds.radiusX) {
        pos[idx] = center.x - Math.sign(pos[idx] - center.x) * this.rainBounds.radiusX * 0.95;
      }
      if (Math.abs(pos[idx + 2] - center.z) > this.rainBounds.radiusZ) {
        pos[idx + 2] = center.z - Math.sign(pos[idx + 2] - center.z) * this.rainBounds.radiusZ * 0.95;
      }
    }

    posAttr.needsUpdate = true;
  }

  applyAtmosphericVisuals(fogAlpha, rainAlpha) {
    // Determine combined weather blend
    const stormAlpha = Math.max(fogAlpha, rainAlpha);

    if (!this.scene.fog || !(this.scene.fog instanceof THREE.FogExp2)) {
      this.scene.fog = new THREE.FogExp2(this.clearFog.color, this.clearFog.density);
    }

    // 1. Fog Density & Color Selection
    let targetDensity = this.clearFog.density;
    let targetColor = this.clearFog.color.clone();

    if (fogAlpha > 0.01 && rainAlpha > 0.01) {
      // Storm: Dense fog + dark rain haze
      targetDensity = THREE.MathUtils.lerp(this.clearFog.density, this.denseFog.density * 1.1, stormAlpha);
      targetColor.lerpColors(this.denseFog.color, this.rainFog.color, 0.5);
    } else if (fogAlpha > 0.01) {
      targetDensity = THREE.MathUtils.lerp(this.clearFog.density, this.denseFog.density, fogAlpha);
      targetColor.lerpColors(this.clearFog.color, this.denseFog.color, fogAlpha);
    } else if (rainAlpha > 0.01) {
      targetDensity = THREE.MathUtils.lerp(this.clearFog.density, this.rainFog.density, rainAlpha);
      targetColor.lerpColors(this.clearFog.color, this.rainFog.color, rainAlpha);
    }

    this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetDensity, 0.15);
    this.scene.fog.color.lerp(targetColor, 0.15);

    // 2. Solar Directional Light Dimming
    let targetSunInt = this.clearSunIntensity;
    let targetSunCol = this.clearSunColor.clone();

    if (rainAlpha > 0.01) {
      targetSunInt = THREE.MathUtils.lerp(this.clearSunIntensity, this.rainSunIntensity, rainAlpha);
      targetSunCol.lerp(this.rainSunColor, rainAlpha);
    } else if (fogAlpha > 0.01) {
      targetSunInt = THREE.MathUtils.lerp(this.clearSunIntensity, this.fogSunIntensity, fogAlpha);
      targetSunCol.lerp(this.fogSunColor, fogAlpha);
    }

    if (this.lighting && this.lighting.sunLight) {
      this.lighting.sunLight.intensity = THREE.MathUtils.lerp(this.lighting.sunLight.intensity, targetSunInt, 0.15);
      this.lighting.sunLight.color.lerp(targetSunCol, 0.15);
    }

    // 3. Hemisphere Ambient Lighting
    let targetHemiInt = this.clearHemiIntensity;
    let targetHemiSky = this.clearHemiSkyColor.clone();
    let targetHemiGnd = this.clearHemiGroundColor.clone();

    if (rainAlpha > 0.01) {
      targetHemiInt = THREE.MathUtils.lerp(this.clearHemiIntensity, this.rainHemiIntensity, rainAlpha);
      targetHemiSky.lerp(this.rainHemiSkyColor, rainAlpha);
      targetHemiGnd.lerp(this.rainHemiGroundColor, rainAlpha);
    } else if (fogAlpha > 0.01) {
      targetHemiInt = THREE.MathUtils.lerp(this.clearHemiIntensity, this.fogHemiIntensity, fogAlpha);
      targetHemiSky.lerp(this.fogHemiSkyColor, fogAlpha);
      targetHemiGnd.lerp(this.fogHemiGroundColor, fogAlpha);
    }

    if (this.lighting && this.lighting.hemiLight) {
      this.lighting.hemiLight.intensity = THREE.MathUtils.lerp(this.lighting.hemiLight.intensity, targetHemiInt, 0.15);
      this.lighting.hemiLight.color.lerp(targetHemiSky, 0.15);
      this.lighting.hemiLight.groundColor.lerp(targetHemiGnd, 0.15);
    }

    // 4. Sky Turbidity & Mie Scattering
    if (this.skyDome && this.skyDome.sky) {
      const uniforms = this.skyDome.sky.material.uniforms;
      const skyTurb = (rainAlpha > 0.01)
        ? THREE.MathUtils.lerp(8.5, 26.0, rainAlpha)
        : THREE.MathUtils.lerp(8.5, 22.0, fogAlpha);
      if (uniforms['turbidity']) uniforms['turbidity'].value = skyTurb;
      if (uniforms['mieCoefficient']) {
        uniforms['mieCoefficient'].value = THREE.MathUtils.lerp(0.005, 0.050, stormAlpha);
      }
    }
  }

  applyIMUParameters(fogAlpha, rainAlpha) {
    // ── Grounded IMU Degradation Blending ──
    // Rain exhibits severe high-frequency mechanical vibration noise (0.115 m/s²)
    // Fog exhibits moderate noise (0.088 m/s²) and higher thermal drift (TCO 7.3°C drop)

    let targetAccelNoise = this.imuBaseline.accelNoise;
    let targetGyroNoise = this.imuBaseline.gyroNoise;
    const targetAccelBias = [...this.imuBaseline.accelBias];
    const targetGyroBias = [...this.imuBaseline.gyroBias];
    let targetTemp = this.imuBaseline.temperature;
    let targetHumidity = this.imuBaseline.humidity;
    let targetVisibility = this.imuBaseline.visibility;
    let targetPrecip = 0.0;

    if (rainAlpha > 0.01 && fogAlpha > 0.01) {
      // Storm: Rain vibration + Fog thermal drift
      targetAccelNoise = THREE.MathUtils.lerp(this.imuBaseline.accelNoise, 0.128, Math.max(rainAlpha, fogAlpha));
      targetGyroNoise  = THREE.MathUtils.lerp(this.imuBaseline.gyroNoise, 0.0080, Math.max(rainAlpha, fogAlpha));
      for (let i = 0; i < 3; i++) {
        targetAccelBias[i] = THREE.MathUtils.lerp(this.imuBaseline.accelBias[i], this.imuFoggy.accelBias[i], fogAlpha);
        targetGyroBias[i]  = THREE.MathUtils.lerp(this.imuBaseline.gyroBias[i], this.imuFoggy.gyroBias[i], fogAlpha);
      }
      targetTemp = 13.5;
      targetHumidity = 100;
      targetVisibility = 75.0;
      targetPrecip = 25.0 * rainAlpha;
    } else if (rainAlpha > 0.01) {
      // Rain only
      targetAccelNoise = THREE.MathUtils.lerp(this.imuBaseline.accelNoise, this.imuRainy.accelNoise, rainAlpha);
      targetGyroNoise  = THREE.MathUtils.lerp(this.imuBaseline.gyroNoise, this.imuRainy.gyroNoise, rainAlpha);
      for (let i = 0; i < 3; i++) {
        targetAccelBias[i] = THREE.MathUtils.lerp(this.imuBaseline.accelBias[i], this.imuRainy.accelBias[i], rainAlpha);
        targetGyroBias[i]  = THREE.MathUtils.lerp(this.imuBaseline.gyroBias[i], this.imuRainy.gyroBias[i], rainAlpha);
      }
      targetTemp = THREE.MathUtils.lerp(this.imuBaseline.temperature, this.imuRainy.temperature, rainAlpha);
      targetHumidity = Math.round(THREE.MathUtils.lerp(this.imuBaseline.humidity, this.imuRainy.humidity, rainAlpha));
      targetVisibility = THREE.MathUtils.lerp(this.imuBaseline.visibility, this.imuRainy.visibility, rainAlpha);
      targetPrecip = 20.0 * rainAlpha;
    } else if (fogAlpha > 0.01) {
      // Fog only
      targetAccelNoise = THREE.MathUtils.lerp(this.imuBaseline.accelNoise, this.imuFoggy.accelNoise, fogAlpha);
      targetGyroNoise  = THREE.MathUtils.lerp(this.imuBaseline.gyroNoise, this.imuFoggy.gyroNoise, fogAlpha);
      for (let i = 0; i < 3; i++) {
        targetAccelBias[i] = THREE.MathUtils.lerp(this.imuBaseline.accelBias[i], this.imuFoggy.accelBias[i], fogAlpha);
        targetGyroBias[i]  = THREE.MathUtils.lerp(this.imuBaseline.gyroBias[i], this.imuFoggy.gyroBias[i], fogAlpha);
      }
      targetTemp = THREE.MathUtils.lerp(this.imuBaseline.temperature, this.imuFoggy.temperature, fogAlpha);
      targetHumidity = Math.round(THREE.MathUtils.lerp(this.imuBaseline.humidity, this.imuFoggy.humidity, fogAlpha));
      targetVisibility = THREE.MathUtils.lerp(this.imuBaseline.visibility, this.imuFoggy.visibility, fogAlpha);
      targetPrecip = 0.0;
    }

    this.currentAccelNoise = targetAccelNoise;
    this.currentGyroNoise = targetGyroNoise;
    this.currentAccelBias = targetAccelBias;
    this.currentGyroBias = targetGyroBias;
    this.currentTemperature = targetTemp;
    this.currentHumidity = targetHumidity;
    this.currentVisibility = targetVisibility;
    this.currentPrecipitation = targetPrecip;

    // Apply directly to routeController without touching routeController code internals
    if (this.routeController) {
      this.routeController.imuAccelNoise = this.currentAccelNoise;
      this.routeController.imuGyroNoise = this.currentGyroNoise;
      this.routeController.accelBiasDrift = this.currentAccelBias;
    }
  }

  getTelemetry() {
    let cond = 'CLEAR SKY';
    if (this.fogActive && this.rainActive) cond = 'STORM (FOG + RAIN)';
    else if (this.rainActive) cond = 'RAIN (20 mm/h)';
    else if (this.fogActive) cond = 'DENSE FOG';

    return {
      fogActive: this.fogActive,
      rainActive: this.rainActive,
      fogProgress: this.fogProgress,
      rainProgress: this.rainProgress,
      visibility: this.currentVisibility,
      temperature: this.currentTemperature,
      humidity: this.currentHumidity,
      precipitation: this.currentPrecipitation,
      accelNoise: this.currentAccelNoise,
      gyroNoise: this.currentGyroNoise,
      accelBias: this.currentAccelBias,
      gyroBias: this.currentGyroBias,
      conditionName: cond
    };
  }
}
