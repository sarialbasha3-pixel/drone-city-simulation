import * as THREE from 'three';

/**
 * DroneCameraSensor.js
 *
 * Implements an active long-range optical camera perception sensor mounted on the drone.
 * Renders the forward scene to a native 200x200 offscreen WebGLRenderTarget
 * matching the input specification of the PULP-DroNet v3 deep neural network.
 *
 * Extended Capabilities:
 * - Extended visual depth range (far plane = 450m) for long-range situational awareness
 * - Frustum-based 3D obstacle projection and spatial dimension analysis
 * - Visual target bounding bracket and range indicators overlaid on the camera feed
 * - High-speed grayscale extraction for neural network inference
 */
export class DroneCameraSensor {
  constructor(drone, options = {}) {
    this.drone = drone;
    this.resolution = options.resolution || 200; // 200x200 for PULP-DroNet v3
    this.fov = options.fov || 75; // 75° optical field of view
    this.near = 0.08;
    this.far = 450.0; // Extended visual range: 450 meters

    // 1. Dedicated Forward-Looking Perspective Sensor Camera
    this.camera = new THREE.PerspectiveCamera(this.fov, 1.0, this.near, this.far);
    this.camera.name = 'drone_forward_vision_sensor';

    // 2. Offscreen WebGL Render Target (200x200 RGBA)
    this.renderTarget = new THREE.WebGLRenderTarget(this.resolution, this.resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      stencilBuffer: false,
      depthBuffer: true
    });

    // 3. Raw RGBA pixel buffer for GPU readback
    this.pixelBuffer = new Uint8Array(this.resolution * this.resolution * 4);
    // 4. Grayscale float buffer normalized in [0.0, 1.0] for DroNet
    this.grayscaleBuffer = new Float32Array(this.resolution * this.resolution);

    // 5. Onscreen Display Canvas for Picture-in-Picture HUD
    this.displayCanvas = document.createElement('canvas');
    this.displayCanvas.width = this.resolution;
    this.displayCanvas.height = this.resolution;
    this.displayCtx = this.displayCanvas.getContext('2d', { willReadFrequently: true });
    this.imageData = this.displayCtx.createImageData(this.resolution, this.resolution);

    // Cadence throttling: run capture at ~15 Hz to keep main 60 FPS thread smooth
    this.captureInterval = 1.0 / 15.0;
    this.timeSinceCapture = 0;
    this.lastCaptureTime = 0;
    this.hasNewFrame = false;

    // Visual obstacle detection state from camera sensor
    this.detectedObstacle = null; // { distance, screenX, screenY, width2D, height2D, obstacle }

    // Atmospheric weather factors [0.0 = clear, 1.0 = fully active]
    this.fogFactor = 0.0;
    this.rainFactor = 0.0;

    // Lens water droplets simulation for rain conditions (dome condensation and splashes)
    this.lensDroplets = [];
    for (let i = 0; i < 36; i++) {
      this.lensDroplets.push({
        x: Math.random() * this.resolution,
        y: Math.random() * this.resolution,
        r: 1.5 + Math.random() * 4.5,
        alpha: 0.35 + Math.random() * 0.45,
        speedY: 0.3 + Math.random() * 0.9,
        streakLen: 8 + Math.random() * 18
      });
    }
  }

  setFogFactor(f) {
    this.fogFactor = THREE.MathUtils.clamp(f, 0, 1);
  }

  setRainFactor(f) {
    this.rainFactor = THREE.MathUtils.clamp(f, 0, 1);
  }

  /**
   * Renders the scene from the drone's forward camera position into the renderTarget.
   */
  update(delta, renderer, scene) {
    this.timeSinceCapture += delta;

    // Synchronize sensor camera position and orientation with drone body / gimbal
    const droneMesh = this.drone.mesh;
    const forwardOffset = new THREE.Vector3(0, -0.04, -0.16); // Optical center at lens
    forwardOffset.applyQuaternion(droneMesh.quaternion);

    this.camera.position.copy(droneMesh.position).add(forwardOffset);
    this.camera.quaternion.copy(droneMesh.quaternion);

    if (this.timeSinceCapture >= this.captureInterval) {
      this.timeSinceCapture = 0;
      this.captureFrame(renderer, scene);
    }
  }

  /**
   * Performs offscreen render pass and pixel extraction.
   */
  captureFrame(renderer, scene) {
    if (!renderer || !scene) return;

    // Temporarily hide drone geometry and virtual UI overlays during forward sensor capture
    // so neural network inference is not disrupted by glowing route tubes, gates, or laser lines
    const wasVisible = this.drone.mesh.visible;
    this.drone.mesh.visible = false;

    const hiddenVisuals = [];
    scene.traverse((child) => {
      if (child !== this.drone.mesh && child.visible) {
        const name = (child.name || '').toLowerCase();
        if (name === 'route_visuals' || name === 'bypass_trajectory_visual' || name === 'sensor_laser_beams') {
          hiddenVisuals.push(child);
          child.visible = false;
        }
      }
    });

    // Save previous render target
    const prevRenderTarget = renderer.getRenderTarget();

    // Render offscreen forward view
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(scene, this.camera);
    renderer.readRenderTargetPixels(
      this.renderTarget,
      0,
      0,
      this.resolution,
      this.resolution,
      this.pixelBuffer
    );

    // Restore render target, drone visibility, and virtual UI overlays
    renderer.setRenderTarget(prevRenderTarget);
    this.drone.mesh.visible = wasVisible;
    hiddenVisuals.forEach((v) => { v.visible = true; });

    // Convert RGBA to Grayscale and flip Y (WebGL origin is bottom-left)
    const W = this.resolution;
    const H = this.resolution;
    const imgData = this.imageData.data;

    for (let y = 0; y < H; y++) {
      const srcRow = (H - 1 - y) * W * 4;
      const dstRow = y * W;
      const dstRowRGBA = y * W * 4;

      for (let x = 0; x < W; x++) {
        const srcIdx = srcRow + (x * 4);
        let r = this.pixelBuffer[srcIdx];
        let g = this.pixelBuffer[srcIdx + 1];
        let b = this.pixelBuffer[srcIdx + 2];

        // Atmospheric aerosol veil scattering in fog conditions
        if (this.fogFactor > 0.02) {
          const veil = this.fogFactor * 0.35;
          const airlight = 175;
          r = Math.round(r * (1.0 - veil) + airlight * veil);
          g = Math.round(g * (1.0 - veil) + (airlight + 6) * veil);
          b = Math.round(b * (1.0 - veil) + (airlight + 14) * veil);
        }

        // Standard ITU-R BT.601 perceptual luminance
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

        const dstIdx = dstRow + x;
        this.grayscaleBuffer[dstIdx] = lum;

        // Copy to display canvas imageData
        const dRGBA = dstRowRGBA + (x * 4);
        imgData[dRGBA] = r;
        imgData[dRGBA + 1] = g;
        imgData[dRGBA + 2] = b;
        imgData[dRGBA + 3] = 255;
      }
    }

    this.displayCtx.putImageData(this.imageData, 0, 0);

    // Overlay rain droplet splashes and streaks on camera lens
    if (this.rainFactor > 0.05) {
      this.drawRainDropletOverlay();
    }

    // Overlay visual detection brackets if obstacle detected
    if (this.detectedObstacle) {
      this.drawDetectionOverlay();
    }

    this.hasNewFrame = true;
  }

  /**
   * Projects detected obstacle onto camera sensor 2D view.
   */
  setDetectedObstacle(obsData) {
    if (!obsData || !obsData.obstacle) {
      this.detectedObstacle = null;
      return;
    }

    const obs = obsData.obstacle;
    const center = obs.centerWorld.clone();
    center.project(this.camera);

    // Must be in front of camera (z in [-1, 1])
    if (center.z > 0 && center.z < 1) {
      const W = this.resolution;
      const H = this.resolution;
      const screenX = ((center.x + 1) / 2) * W;
      const screenY = ((-center.y + 1) / 2) * H;
      const dist = obsData.distance;

      // Estimate 2D projected size from 3D dimensions
      const projW = Math.max(16, Math.min(180, (obs.dimensions.width / dist) * 160));
      const projH = Math.max(16, Math.min(180, (obs.dimensions.height / dist) * 160));

      this.detectedObstacle = {
        screenX,
        screenY,
        width2D: projW,
        height2D: projH,
        distance: dist,
        id: obsData.id || obs.id,
        type: obsData.type || 'OBSTACLE'
      };
    } else {
      this.detectedObstacle = null;
    }
  }

  /**
   * Overlays realistic rain droplets, streaks, and lens sheen onto sensor canvas.
   */
  drawRainDropletOverlay() {
    const ctx = this.displayCtx;
    const factor = this.rainFactor;
    const W = this.resolution;
    const H = this.resolution;

    ctx.save();

    // 1. Water wash / glare sheen across lens
    ctx.fillStyle = `rgba(180, 215, 240, ${0.09 * factor})`;
    ctx.fillRect(0, 0, W, H);

    // 2. Dynamic falling rain streaks across camera FOV
    ctx.strokeStyle = `rgba(225, 240, 255, ${0.42 * factor})`;
    ctx.lineWidth = 1.2;
    const streakCount = Math.floor(16 * factor);
    const now = Date.now();
    for (let s = 0; s < streakCount; s++) {
      const sx = ((Math.sin(s * 77.3 + now * 0.008) * 0.5 + 0.5) * W);
      const sy = ((s * 41.7 + now * 0.14) % (H + 40)) - 20;
      const len = 14 + (s % 5) * 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 3.5, sy + len);
      ctx.stroke();
    }

    // 3. Water beads and splashes on camera glass dome
    const activeDrops = Math.floor(this.lensDroplets.length * factor);
    for (let i = 0; i < activeDrops; i++) {
      const drop = this.lensDroplets[i];
      drop.y += drop.speedY;
      if (drop.y > H + 10) {
        drop.y = -5;
        drop.x = Math.random() * W;
      }

      const r = drop.r;
      // Droplet outer boundary / meniscus
      ctx.strokeStyle = `rgba(255, 255, 255, ${drop.alpha * factor * 0.70})`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Liquid refraction body
      ctx.fillStyle = `rgba(150, 200, 240, ${drop.alpha * factor * 0.30})`;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, r * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight gleam
      ctx.fillStyle = `rgba(255, 255, 255, ${drop.alpha * factor * 0.85})`;
      ctx.beginPath();
      ctx.arc(drop.x - r * 0.3, drop.y - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawDetectionOverlay() {
    const ctx = this.displayCtx;
    const d = this.detectedObstacle;

    // Atmospheric Weather Watermark Indicators
    if (this.fogFactor > 0.15 || this.rainFactor > 0.15) {
      ctx.save();
      let yPos = 14;
      if (this.fogFactor > 0.15) {
        ctx.fillStyle = 'rgba(255, 170, 0, 0.85)';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`🌫️ FOG: VIS ${(85 + (1 - this.fogFactor) * 1500).toFixed(0)}m`, 6, yPos);
        yPos += 11;
      }
      if (this.rainFactor > 0.15) {
        ctx.fillStyle = 'rgba(70, 195, 255, 0.90)';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`🌧️ RAIN: ${(this.rainFactor * 20.0).toFixed(0)}mm/h`, 6, yPos);
      }
      ctx.restore();
    }

    if (!d) return;

    ctx.save();

    // Attenuate optical recognition contrast in heavy fog/rain beyond visual range
    if ((this.fogFactor > 0.35 || this.rainFactor > 0.4) && d.distance > 70.0) {
      const weatherDim = Math.max(0.20, 1.0 - (d.distance - 70.0) / 45.0);
      ctx.globalAlpha = weatherDim;
    }

    const isClose = d.distance < 38.0;
    const color = isClose ? '#ff2244' : '#00e5ff';
    const tagBg = isClose ? 'rgba(255, 34, 68, 0.88)' : 'rgba(0, 229, 255, 0.85)';
    const textColor = isClose ? '#ffffff' : '#05070a';

    const left = d.screenX - d.width2D / 2;
    const top = d.screenY - d.height2D / 2;
    const w = d.width2D;
    const h = d.height2D;

    // Tactical Target Corner Brackets
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const arm = Math.min(10, w * 0.25);

    // Top-left
    ctx.beginPath(); ctx.moveTo(left, top + arm); ctx.lineTo(left, top); ctx.lineTo(left + arm, top); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(left + w - arm, top); ctx.lineTo(left + w, top); ctx.lineTo(left + w, top + arm); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(left, top + h - arm); ctx.lineTo(left, top + h); ctx.lineTo(left + arm, top + h); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(left + w - arm, top + h); ctx.lineTo(left + w, top + h); ctx.lineTo(left + w, top + h - arm); ctx.stroke();

    // Target Tag Banner
    ctx.fillStyle = tagBg;
    ctx.fillRect(left, top - 15, Math.max(90, w), 14);
    ctx.fillStyle = textColor;
    ctx.font = 'bold 9px monospace';

    let weatherSuffix = '';
    if (this.fogFactor > 0.4 && this.rainFactor > 0.4) {
      weatherSuffix = ' (STORM)';
    } else if (this.fogFactor > 0.4) {
      weatherSuffix = ' (FOG)';
    } else if (this.rainFactor > 0.4) {
      weatherSuffix = ' (RAIN)';
    }

    const tagText = `[${d.type}] ${d.distance.toFixed(1)}m${weatherSuffix}`;
    ctx.fillText(tagText, left + 4, top - 4);
    ctx.restore();
  }

  /**
   * Returns a copy of the normalized 200x200 grayscale float array for DroNet inference.
   */
  getGrayscaleFloatArray() {
    return Array.from(this.grayscaleBuffer);
  }

  /**
   * Returns the display canvas containing the current sensor view.
   */
  getCanvas() {
    return this.displayCanvas;
  }
}
