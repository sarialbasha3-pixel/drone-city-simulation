import * as THREE from 'three';

/**
 * FlightController - Responsive 6-DOF drone flight dynamics.
 * Supports Pitch, Roll, Yaw, Vertical Thrust, Aerodynamic Drag, Auto-Leveling,
 * Speed Modes (Survey, Cruise, Turbo), 3-Axis Gimbal Tilt Controls,
 * and Camera Modes (Chase, FPV, Inspect, Overhead).
 */
export class FlightController {
  constructor(drone, collisionSystem) {
    this.drone = drone;
    this.collisionSystem = collisionSystem;

    this.position = new THREE.Vector3(250, 45, 0); // Start airborne above Downtown
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.quaternion = new THREE.Quaternion();

    // Calibrated speed configurations matching specifications
    this.speedMode = 'MEDIUM'; // Default moderate cruise mode ('SLOW', 'MEDIUM', 'FAST')
    this.speeds = {
      SLOW:   { maxSpeed: 18.0 / 3.6, accel: 2.2, decel: 2.8, vertSpeed: 3.0, maxTilt: 0.12 }, // 18 km/h (5.0 m/s) - Precision survey / cinematic
      MEDIUM: { maxSpeed: 36.0 / 3.6, accel: 3.2, decel: 3.0, vertSpeed: 4.5, maxTilt: 0.20 }, // 36 km/h (10.0 m/s) - Default comfortable cruise
      FAST:   { maxSpeed: 60.0 / 3.6, accel: 4.8, decel: 3.8, vertSpeed: 7.0, maxTilt: 0.30 }, // 60 km/h (16.7 m/s) - High-speed sport transit
      // Aliases
      SURVEY: { maxSpeed: 18.0 / 3.6, accel: 2.2, decel: 2.8, vertSpeed: 3.0, maxTilt: 0.12 },
      CRUISE: { maxSpeed: 36.0 / 3.6, accel: 3.2, decel: 3.0, vertSpeed: 4.5, maxTilt: 0.20 },
      TURBO:  { maxSpeed: 60.0 / 3.6, accel: 4.8, decel: 3.8, vertSpeed: 7.0, maxTilt: 0.30 }
    };

    // Flight physics variables
    this.yawSpeed = 1.4; // Radians per second (smooth, controlled rotation)
    this.pitchRollDamping = 8.0;

    // Target visual tilt angles for realistic flight feedback
    this.targetPitch = 0;
    this.targetRoll = 0;
    this.currentPitch = 0;
    this.currentRoll = 0;

    // Gimbal camera tilt angle (radians, -Math.PI/2 = nadir straight down, 0 = level horizon)
    this.gimbalPitchAngle = -0.15; // default slightly down (approx -8.5 degrees)

    this.keys = {};
    this.cameraMode = 'CHASE'; // 'CHASE', 'FPV', 'GIMBAL', 'INSPECT', 'OVERHEAD'

    // Camera smooth transition state
    this.currentCamPos = new THREE.Vector3();
    this.currentCamLookAt = new THREE.Vector3();
    this.isTransitioningCam = false;
    this.camTransitionProgress = 1.0;
    this.transitionStartPos = new THREE.Vector3();
    this.transitionStartLookAt = new THREE.Vector3();

    // Orbit inspection angles
    this.inspectYaw = 0.4;
    this.inspectPitch = 0.35;
    this.inspectDistance = 0.85; // 85cm close orbit for 35cm drone

    this.initInput();
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Camera view toggle
      if (e.code === 'KeyV') {
        this.cycleCamera();
      }

      // Speed mode presets (1: Slow, 2: Medium, 3: Fast)
      if (e.code === 'Digit1') this.speedMode = 'SLOW';
      if (e.code === 'Digit2') this.speedMode = 'MEDIUM';
      if (e.code === 'Digit3') this.speedMode = 'FAST';

      // Gimbal tilt preset quick-toggle (Horizon -> 45deg -> 90deg Nadir)
      if (e.code === 'KeyC') {
        if (this.gimbalPitchAngle > -0.2) {
          this.gimbalPitchAngle = -Math.PI * 0.25; // 45 deg down
        } else if (this.gimbalPitchAngle > -Math.PI * 0.4) {
          this.gimbalPitchAngle = -Math.PI * 0.5;  // 90 deg straight down
        } else {
          this.gimbalPitchAngle = 0.0;             // level horizon
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Mouse drag for inspection mode
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isMouseDown = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (isMouseDown && this.cameraMode === 'INSPECT') {
        const dx = e.clientX - prevMouseX;
        const dy = e.clientY - prevMouseY;
        this.inspectYaw -= dx * 0.008;
        this.inspectPitch = THREE.MathUtils.clamp(this.inspectPitch + dy * 0.008, -0.6, 1.2);
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    });

    // Mouse wheel zoom in inspection mode
    window.addEventListener('wheel', (e) => {
      if (this.cameraMode === 'INSPECT') {
        this.inspectDistance = THREE.MathUtils.clamp(this.inspectDistance + e.deltaY * 0.001, 0.45, 2.5);
      }
    });
  }

  cycleCamera() {
    // Record current camera transform for smooth transition interpolation
    this.transitionStartPos.copy(this.currentCamPos);
    this.transitionStartLookAt.copy(this.currentCamLookAt);
    this.isTransitioningCam = true;
    this.camTransitionProgress = 0.0;

    const modes = ['CHASE', 'FPV', 'GIMBAL', 'INSPECT', 'OVERHEAD'];
    const curIdx = modes.indexOf(this.cameraMode);
    this.cameraMode = modes[(curIdx + 1) % modes.length];
  }

  update(delta) {
    const cfg = this.speeds[this.speedMode];

    // Gimbal tilt adjustment (KeyI or KeyT = Tilt Up, KeyK or KeyG = Tilt Down)
    if (this.keys['KeyI'] || this.keys['KeyT']) {
      this.gimbalPitchAngle = Math.min(0.25, this.gimbalPitchAngle + delta * 0.9);
    }
    if (this.keys['KeyK'] || this.keys['KeyG']) {
      this.gimbalPitchAngle = Math.max(-Math.PI * 0.5, this.gimbalPitchAngle - delta * 0.9);
    }
    this.drone.setGimbalPitch(this.gimbalPitchAngle);

    // 1. Yaw Steering (Q/E or ArrowLeft/ArrowRight)
    let yawInput = 0;
    if (this.keys['KeyQ'] || this.keys['ArrowLeft']) yawInput += 1;
    if (this.keys['KeyE'] || this.keys['ArrowRight']) yawInput -= 1;
    this.rotation.y += yawInput * this.yawSpeed * delta;

    // 2. Translational Direction Inputs (Relative to heading)
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);

    // Forward / Backward (W / S)
    let fwdInput = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) fwdInput += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) fwdInput -= 1;

    // Lateral Strafe (A / D)
    let strafeInput = 0;
    if (this.keys['KeyD']) strafeInput += 1;
    if (this.keys['KeyA']) strafeInput -= 1;

    // Vertical Climb / Descent (Space / Shift)
    let vertInput = 0;
    if (this.keys['Space']) vertInput += 1;
    if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) vertInput -= 1;

    // 3. Realistic Propulsion & Aerodynamic Velocity Integration
    // Target velocity derived from active speed mode maxSpeed (25, 55, or 100 km/h)
    const moveDir = new THREE.Vector3(0, 0, 0);
    moveDir.addScaledVector(forward, fwdInput);
    moveDir.addScaledVector(right, strafeInput);

    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize();
      const targetHorizVel = moveDir.clone().multiplyScalar(cfg.maxSpeed);
      // Smooth exponential acceleration curve towards max speed
      const accelFactor = Math.min(1.0, cfg.accel * delta);
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetHorizVel.x, accelFactor);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetHorizVel.z, accelFactor);
    } else {
      // Natural aerodynamic drag deceleration when throttle released
      const decelFactor = Math.min(1.0, cfg.decel * delta);
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, decelFactor);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, decelFactor);
    }

    // Vertical velocity integration
    if (Math.abs(vertInput) > 0.001) {
      const targetVert = vertInput * cfg.vertSpeed;
      this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetVert, Math.min(1.0, delta * 4.5));
    } else {
      this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, 0, Math.min(1.0, delta * 4.0));
    }

    // 4. Proposed Position Integration
    this.position.addScaledVector(this.velocity, delta);

    // 5. Environmental Collision Resolution
    this.collisionSystem.resolveCollision(this.position, this.velocity);

    // 6. Dynamic Banking (Pitch & Roll proportional to speed mode and inputs)
    this.targetPitch = fwdInput * cfg.maxTilt;
    this.targetRoll = -strafeInput * cfg.maxTilt;

    this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, this.targetPitch, delta * this.pitchRollDamping);
    this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, this.targetRoll, delta * this.pitchRollDamping);

    // Update 3D Mesh transforms
    this.drone.mesh.position.copy(this.position);
    this.drone.mesh.rotation.set(this.currentPitch, this.rotation.y, this.currentRoll, 'YXZ');

    // Update spinning rotor animations and active 3-axis gimbal horizon stabilization
    const throttle = Math.max(0.35, 0.35 + Math.abs(fwdInput) * 0.65 + Math.abs(vertInput) * 0.65);
    this.drone.update(delta, throttle, this.currentPitch, this.currentRoll);
  }

  /**
   * Updates camera position and orientation based on current camera mode:
   * 1. CHASE: Comfortable third-person follow distance (~1.05m behind, 0.36m above)
   * 2. FPV: Cockpit / nose camera fixed to drone body, rolling and pitching with flight
   * 3. GIMBAL: Physically mounted underneath belly, 3-axis horizon-stabilized, tiltable via I/K
   * 4. INSPECT: 360° close orbit examination
   * 5. OVERHEAD: High-altitude survey
   * Plus smooth interpolation when switching modes.
   */
  updateCamera(camera) {
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);
    const targetCamPos = new THREE.Vector3();
    const targetCamLookAt = new THREE.Vector3();

    if (this.cameraMode === 'CHASE') {
      // Third-person chase camera calibrated for 0.35m quadcopter
      // Sits ~1.05m behind and 0.36m above for ideal visibility without clipping
      const offset = new THREE.Vector3(0, 0.36, 1.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation.y);
      targetCamPos.copy(this.position).add(offset);
      targetCamLookAt.copy(this.position).add(new THREE.Vector3(0, 0.05, 0)).add(forward.clone().multiplyScalar(0.4));

    } else if (this.cameraMode === 'FPV') {
      // First-person cockpit view mounted directly on drone nose
      // Tilts and banks with the drone body for authentic piloting experience
      const droneRot = new THREE.Euler(this.currentPitch, this.rotation.y, this.currentRoll, 'YXZ');
      const noseOffset = new THREE.Vector3(0, 0.05, -0.16).applyEuler(droneRot);
      targetCamPos.copy(this.position).add(noseOffset);

      const fpvDir = new THREE.Vector3(0, 0, -1).applyEuler(droneRot);
      targetCamLookAt.copy(targetCamPos).add(fpvDir.multiplyScalar(30.0));

    } else if (this.cameraMode === 'GIMBAL') {
      // 3-Axis Stabilized Gimbal Camera physically mounted underneath the drone body
      // Horizon-stabilized (level with horizon), pitch tiltable via I/K or T/G
      const gimbalWorldPos = new THREE.Vector3();
      this.drone.cameraBody.getWorldPosition(gimbalWorldPos);
      targetCamPos.copy(gimbalWorldPos);

      // Forward direction from gimbal camera's world quaternion
      const gimbalDir = new THREE.Vector3(0, 0, -1);
      gimbalDir.applyQuaternion(this.drone.cameraBody.getWorldQuaternion(new THREE.Quaternion()));
      targetCamLookAt.copy(gimbalWorldPos).add(gimbalDir.multiplyScalar(30.0));

    } else if (this.cameraMode === 'INSPECT') {
      // Orbit inspection camera allowing 360-degree close-up inspection of the drone model
      const cy = Math.cos(this.inspectYaw + this.rotation.y);
      const sy = Math.sin(this.inspectYaw + this.rotation.y);
      const cp = Math.cos(this.inspectPitch);
      const sp = Math.sin(this.inspectPitch);

      const inspectOffset = new THREE.Vector3(
        this.inspectDistance * sy * cp,
        this.inspectDistance * sp,
        this.inspectDistance * cy * cp
      );

      targetCamPos.copy(this.position).add(inspectOffset);
      targetCamLookAt.copy(this.position).add(new THREE.Vector3(0, 0.02, 0));

    } else if (this.cameraMode === 'OVERHEAD') {
      // High altitude god-view surveying the city
      targetCamPos.set(this.position.x, this.position.y + 130, this.position.z + 45);
      targetCamLookAt.copy(this.position);
    }

    // Initialize currentCamPos if first frame
    if (this.currentCamPos.lengthSq() < 0.001) {
      this.currentCamPos.copy(targetCamPos);
      this.currentCamLookAt.copy(targetCamLookAt);
    }

    // Smooth camera mode transition interpolation (S-curve over ~0.28s)
    if (this.isTransitioningCam) {
      this.camTransitionProgress = Math.min(1.0, this.camTransitionProgress + 0.05);
      const t = this.camTransitionProgress;
      const smoothT = t * t * (3 - 2 * t);

      camera.position.lerpVectors(this.transitionStartPos, targetCamPos, smoothT);
      this.currentCamLookAt.lerpVectors(this.transitionStartLookAt, targetCamLookAt, smoothT);
      camera.lookAt(this.currentCamLookAt);

      if (t >= 1.0) {
        this.isTransitioningCam = false;
      }
    } else {
      // Active follow camera smoothing
      camera.position.lerp(targetCamPos, 0.22);
      this.currentCamLookAt.lerp(targetCamLookAt, 0.22);
      camera.lookAt(this.currentCamLookAt);
    }

    this.currentCamPos.copy(camera.position);
  }

  getTelemetry(terrain) {
    const groundH = terrain.getHeight(this.position.x, this.position.z);
    const altitudeAGL = Math.max(0, this.position.y - groundH);
    const speedMS = this.velocity.length();
    const speedKMH = speedMS * 3.6;
    const headingDeg = THREE.MathUtils.radToDeg(this.rotation.y) % 360;
    const gimbalDeg = THREE.MathUtils.radToDeg(-this.gimbalPitchAngle);

    let district = 'UNKNOWN';
    if (this.position.x >= 0 && this.position.z >= -250 && this.position.z <= 250) district = 'DOWNTOWN SKYLINE';
    else if (this.position.x >= 0 && this.position.z > 250) district = 'COMMERCIAL DISTRICT';
    else if (this.position.x >= 0 && this.position.z < -250) district = 'RESIDENTIAL DISTRICT';
    else if (this.position.x < -150 && this.position.z >= 0) district = 'INDUSTRIAL PORT';
    else if (this.position.x < -150 && this.position.z < 0) district = 'SCENIC HILLS';
    else district = 'THE GREAT BAY & BRIDGE';

    return {
      altitudeAGL: altitudeAGL.toFixed(1),
      altitudeMSL: this.position.y.toFixed(1),
      speedKMH: speedKMH.toFixed(1),
      heading: (headingDeg < 0 ? headingDeg + 360 : headingDeg).toFixed(0),
      district: district,
      speedMode: this.speedMode,
      cameraMode: this.cameraMode,
      gimbalDeg: gimbalDeg.toFixed(0),
      x: this.position.x.toFixed(0),
      y: this.position.y.toFixed(0),
      z: this.position.z.toFixed(0)
    };
  }
}

