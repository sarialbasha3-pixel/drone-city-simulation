import * as THREE from 'three';

/**
 * Drone - High-precision 3D Quadcopter UAV model matching the provided reference model sheet.
 *
 * Specifications from Model Sheet:
 * - Configuration: X-Quad
 * - Dimensions: 350 mm x 350 mm x 196 mm (0.35m x 0.35m x 0.196m)
 * - Wheelbase: 250 mm motor-to-motor
 * - Weight: ~1.2 kg
 * - Camera: 3-Axis Stabilized 4K Gimbal Camera mounted underneath
 *
 * Color Palette:
 * - Body (Plastic): #E6E6E6 (white / light-gray aerodynamic shell)
 * - Motor Arms (Plastic): #D0D0D0
 * - Motors (Metal): #2B2B2B
 * - Propellers (Plastic): #1A1A1A
 * - LED / Accent: #FFA500 (glowing orange rings under motors)
 * - Camera Lens: #111111 (dark optical glass)
 */
export class Drone {
  constructor() {
    this.mesh = new THREE.Group();
    this.mesh.name = 'drone_uav_reference';

    this.rotors = [];
    this.orangeLeds = [];

    // Gimbal joints for 3-axis independent stabilization
    this.gimbalYawGroup = new THREE.Group();
    this.gimbalRollGroup = new THREE.Group();
    this.gimbalPitchGroup = new THREE.Group();
    this.cameraBody = new THREE.Group();

    // User-controlled gimbal pitch angle (radians, 0 = forward, -PI/2 = straight down)
    this.gimbalTargetPitch = 0.0;
    this.currentGimbalPitch = 0.0;

    this.initMaterials();
    this.buildModel();
  }

  initMaterials() {
    // 1. White/Light Gray Aerodynamic Body Plastic (#E6E6E6)
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe6e6e6,
      roughness: 0.32,
      metalness: 0.08,
      shadowSide: THREE.DoubleSide
    });

    // 2. Motor Arms Plastic (#D0D0D0)
    this.armMat = new THREE.MeshStandardMaterial({
      color: 0xd0d0d0,
      roughness: 0.38,
      metalness: 0.12
    });

    // 3. Dark Metallic Motors (#2B2B2B)
    this.motorMat = new THREE.MeshStandardMaterial({
      color: 0x2b2b2b,
      roughness: 0.25,
      metalness: 0.88
    });

    // 4. Matte Dark Propellers (#1A1A1A)
    this.propMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.45,
      metalness: 0.15
    });

    // 5. Bright Orange LED Accent Rings (#FFA500)
    this.ledMat = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      emissive: 0xffa500,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.1
    });

    // 6. Camera Body Dark Alloy (#2B2B2B)
    this.cameraBodyMat = new THREE.MeshStandardMaterial({
      color: 0x242426,
      roughness: 0.3,
      metalness: 0.75
    });

    // 7. Dark Optical Glass Camera Lens (#111111)
    this.lensMat = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      roughness: 0.04,
      metalness: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 0.9
    });

    // Anti-reflective cyan/blue rim coating
    this.lensRimMat = new THREE.MeshStandardMaterial({
      color: 0x00bcd4,
      roughness: 0.2,
      metalness: 0.8
    });

    // 8. Dark Grille / Vent Louver Inset
    this.grilleMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.8,
      metalness: 0.2
    });

    // 9. Black Rubber Landing Skid Pads & Dampers
    this.rubberMat = new THREE.MeshStandardMaterial({
      color: 0x1f1f1f,
      roughness: 0.9,
      metalness: 0.02
    });
  }

  buildModel() {
    // Model root is centered at origin (0, 0, 0)
    // Overall dimensions: 350mm x 350mm x 196mm
    // Motor wheelbase: 250mm diagonal/motor-to-motor

    // ========================================================
    // 1. AERODYNAMIC CENTRAL BODY SHELL
    // ========================================================
    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'fuselage';

    // Top Upper Shell: Smooth aerodynamic arched fuselage
    // Main upper canopy with longitudinal taper
    const upperCanopyGeom = new THREE.CylinderGeometry(0.045, 0.075, 0.18, 16);
    upperCanopyGeom.rotateX(Math.PI / 2);
    upperCanopyGeom.scale(1.0, 0.32, 1.0); // Flattened dome profile
    const upperCanopy = new THREE.Mesh(upperCanopyGeom, this.bodyMat);
    upperCanopy.position.set(0, 0.025, 0);
    upperCanopy.castShadow = true;
    upperCanopy.receiveShadow = true;
    bodyGroup.add(upperCanopy);

    // Aerodynamic Nose Cone (smooth forward taper)
    const noseGeom = new THREE.ConeGeometry(0.052, 0.07, 16);
    noseGeom.rotateX(-Math.PI / 2);
    noseGeom.scale(1.0, 0.32, 1.0);
    const nose = new THREE.Mesh(noseGeom, this.bodyMat);
    nose.position.set(0, 0.025, -0.115);
    nose.castShadow = true;
    bodyGroup.add(nose);

    // Aerodynamic Tail Taper
    const tailGeom = new THREE.ConeGeometry(0.052, 0.07, 16);
    tailGeom.rotateX(Math.PI / 2);
    tailGeom.scale(1.0, 0.32, 1.0);
    const tail = new THREE.Mesh(tailGeom, this.bodyMat);
    tail.position.set(0, 0.025, 0.115);
    tail.castShadow = true;
    bodyGroup.add(tail);

    // Central Longitudinal Spine Ridge (subtle top ridge from reference)
    const spineGeom = new THREE.BoxGeometry(0.012, 0.008, 0.22);
    const spine = new THREE.Mesh(spineGeom, this.bodyMat);
    spine.position.set(0, 0.045, 0);
    bodyGroup.add(spine);

    // Lower Underside Fuselage Shell (belly housing battery and gimbal mount)
    const lowerCanopyGeom = new THREE.CylinderGeometry(0.075, 0.048, 0.16, 16);
    lowerCanopyGeom.rotateX(Math.PI / 2);
    lowerCanopyGeom.scale(1.0, 0.28, 1.0);
    const lowerCanopy = new THREE.Mesh(lowerCanopyGeom, this.bodyMat);
    lowerCanopy.position.set(0, -0.008, 0);
    lowerCanopy.castShadow = true;
    lowerCanopy.receiveShadow = true;
    bodyGroup.add(lowerCanopy);

    // Front Cooling Vents / Louver Grille (Vertical Slats from reference front view)
    const frontVentPlate = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.016, 0.006), this.grilleMat);
    frontVentPlate.position.set(0, 0.022, -0.145);
    bodyGroup.add(frontVentPlate);

    for (let s = -3; s <= 3; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.012, 0.008), this.bodyMat);
      slat.position.set(s * 0.0055, 0.022, -0.146);
      bodyGroup.add(slat);
    }

    // Rear Cooling Vents / Exhaust Slats (from reference rear view)
    const rearVentPlate = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.016, 0.006), this.grilleMat);
    rearVentPlate.position.set(0, 0.022, 0.145);
    bodyGroup.add(rearVentPlate);

    for (let s = -3; s <= 3; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.012, 0.008), this.bodyMat);
      slat.position.set(s * 0.0055, 0.022, 0.146);
      bodyGroup.add(slat);
    }

    // Underbelly Downward Sensor Ports (Optical Flow & Ultrasonic Rangefinder)
    const sensorBase = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.045), this.grilleMat);
    sensorBase.position.set(0, -0.028, 0.035);
    bodyGroup.add(sensorBase);

    [-0.01, 0.01].forEach((so) => {
      const sensorLens = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.008, 12), this.lensMat);
      sensorLens.position.set(so, -0.03, 0.035);
      bodyGroup.add(sensorLens);
    });

    // Battery status indicator dots (4 micro LEDs on top spine)
    for (let b = 0; b < 4; b++) {
      const bDot = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 6, 6), new THREE.MeshBasicMaterial({ color: 0x00e676 }));
      bDot.position.set(0, 0.049, -0.03 + b * 0.018);
      bodyGroup.add(bDot);
    }

    this.mesh.add(bodyGroup);

    // ========================================================
    // 2. FOUR CURVED MOTOR ARMS & MOTOR PODS
    // ========================================================
    // Exact wheelbase: 250mm (distance between adjacent motors = 250mm or diagonal wheelbase)
    // Motor center positions: x = ±0.105m, z = ±0.105m (wheelbase = sqrt(210^2) ~ 210-250mm)
    const armConfigs = [
      { x: 0.105,  z: -0.105, angle: Math.PI * 0.25 },  // Front Right
      { x: -0.105, z: -0.105, angle: -Math.PI * 0.25 }, // Front Left
      { x: 0.105,  z: 0.105,  angle: Math.PI * 0.75 },  // Rear Right
      { x: -0.105, z: 0.105,  angle: -Math.PI * 0.75 }  // Rear Left
    ];

    armConfigs.forEach((cfg, idx) => {
      // Smooth curved aerodynamic arm sweeping outward and slightly upward
      const armCurvePoints = [
        new THREE.Vector3(0, 0.015, 0),
        new THREE.Vector3(cfg.x * 0.45, 0.022, cfg.z * 0.45),
        new THREE.Vector3(cfg.x * 0.85, 0.030, cfg.z * 0.85),
        new THREE.Vector3(cfg.x, 0.032, cfg.z)
      ];
      const armCurve = new THREE.CatmullRomCurve3(armCurvePoints);
      const armGeom = new THREE.TubeGeometry(armCurve, 16, 0.013, 10, false);
      armGeom.scale(1.0, 0.65, 1.0); // Aerodynamic flattened profile
      const armMesh = new THREE.Mesh(armGeom, this.armMat);
      armMesh.castShadow = true;
      this.mesh.add(armMesh);

      // Motor Mount Housing Nacelle at arm tip
      const nacelleGeom = new THREE.CylinderGeometry(0.018, 0.016, 0.024, 16);
      const nacelle = new THREE.Mesh(nacelleGeom, this.armMat);
      nacelle.position.set(cfg.x, 0.032, cfg.z);
      nacelle.castShadow = true;
      this.mesh.add(nacelle);

      // BRIGHT ORANGE LED ACCENT RING (#FFA500)
      // Reference explicitly highlights: "orange LED/accent rings near the motors"
      const ledRingGeom = new THREE.TorusGeometry(0.0175, 0.0035, 8, 20);
      ledRingGeom.rotateX(Math.PI / 2);
      const ledRing = new THREE.Mesh(ledRingGeom, this.ledMat);
      ledRing.position.set(cfg.x, 0.022, cfg.z);
      this.mesh.add(ledRing);
      this.orangeLeds.push(ledRing);

      // DARK METALLIC BRUSHLESS MOTOR POD (#2B2B2B)
      const motorBase = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.018, 16), this.motorMat);
      motorBase.position.set(cfg.x, 0.046, cfg.z);
      motorBase.castShadow = true;
      this.mesh.add(motorBase);

      // Motor top bell with stator cooling slots
      const motorTop = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.008, 16), this.motorMat);
      motorTop.position.set(cfg.x, 0.058, cfg.z);
      this.mesh.add(motorTop);

      // Knurled Propeller Lock Nut / Hub Spinner
      const spinner = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.012, 12), this.motorMat);
      spinner.position.set(cfg.x, 0.066, cfg.z);
      this.mesh.add(spinner);

      // ========================================================
      // 3. AERODYNAMIC DUAL-BLADE PROPELLERS (#1A1A1A)
      // ========================================================
      const rotorGroup = new THREE.Group();
      rotorGroup.position.set(cfg.x, 0.068, cfg.z);

      // Propeller Hub Disc
      const propHub = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), this.propMat);
      rotorGroup.add(propHub);

      // Two realistic curved airfoil blades
      // Diameter: 130mm (radius 65mm), perfectly fits 350mm total span!
      [-1, 1].forEach((bladeDir) => {
        const bladePoints = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.022 * bladeDir, 0.001, 0.004 * bladeDir),
          new THREE.Vector3(0.048 * bladeDir, 0.002, 0.005 * bladeDir),
          new THREE.Vector3(0.068 * bladeDir, 0.001, 0.001 * bladeDir)
        ];
        const bladeCurve = new THREE.CatmullRomCurve3(bladePoints);
        const bladeGeom = new THREE.TubeGeometry(bladeCurve, 12, 0.004, 6, false);
        bladeGeom.scale(1.0, 0.28, 2.2); // Thin, wide realistic airfoil chord
        bladeGeom.rotateZ(0.12 * bladeDir); // Pitch attack angle twist

        const bladeMesh = new THREE.Mesh(bladeGeom, this.propMat);
        bladeMesh.castShadow = true;
        rotorGroup.add(bladeMesh);
      });

      this.rotors.push(rotorGroup);
      this.mesh.add(rotorGroup);
    });

    // ========================================================
    // 4. ARCHED LANDING GEAR LEGS
    // ========================================================
    // The reference model sheet shows two arched landing skids on left and right,
    // curving smoothly down from the underbody/arms and leaving center clear for gimbal.
    // Total height clearance gives 196mm overall height.
    const legXPositions = [-0.075, 0.075];

    legXPositions.forEach((lx) => {
      const skidGroup = new THREE.Group();
      const sign = lx > 0 ? 1 : -1;

      // Front Curved Strut
      const frontLegPoints = [
        new THREE.Vector3(sign * 0.045, -0.015, -0.045),
        new THREE.Vector3(sign * 0.070, -0.060, -0.060),
        new THREE.Vector3(sign * 0.082, -0.105, -0.070)
      ];
      const frontLegCurve = new THREE.CatmullRomCurve3(frontLegPoints);
      const frontLegMesh = new THREE.Mesh(new THREE.TubeGeometry(frontLegCurve, 12, 0.0045, 8, false), this.bodyMat);
      frontLegMesh.castShadow = true;
      skidGroup.add(frontLegMesh);

      // Rear Curved Strut
      const rearLegPoints = [
        new THREE.Vector3(sign * 0.045, -0.015, 0.045),
        new THREE.Vector3(sign * 0.070, -0.060, 0.060),
        new THREE.Vector3(sign * 0.082, -0.105, 0.070)
      ];
      const rearLegCurve = new THREE.CatmullRomCurve3(rearLegPoints);
      const rearLegMesh = new THREE.Mesh(new THREE.TubeGeometry(rearLegCurve, 12, 0.0045, 8, false), this.bodyMat);
      rearLegMesh.castShadow = true;
      skidGroup.add(rearLegMesh);

      // Horizontal Arched Landing Skid Rail with curved front & rear tips
      const skidPoints = [
        new THREE.Vector3(sign * 0.080, -0.095, -0.105), // Front upturn tip
        new THREE.Vector3(sign * 0.082, -0.105, -0.075),
        new THREE.Vector3(sign * 0.084, -0.106, 0.0),
        new THREE.Vector3(sign * 0.082, -0.105, 0.075),
        new THREE.Vector3(sign * 0.080, -0.095, 0.105)  // Rear upturn tip
      ];
      const skidCurve = new THREE.CatmullRomCurve3(skidPoints);
      const skidMesh = new THREE.Mesh(new THREE.TubeGeometry(skidCurve, 16, 0.005, 8, false), this.bodyMat);
      skidMesh.castShadow = true;
      skidGroup.add(skidMesh);

      // Rubber Foot Pads at front and rear
      [-0.075, 0.075].forEach((fz) => {
        const footPad = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.016, 8), this.rubberMat);
        footPad.position.set(sign * 0.082, -0.108, fz);
        skidGroup.add(footPad);
      });

      this.mesh.add(skidGroup);
    });

    // ========================================================
    // 5. 3-AXIS GIMBAL ASSEMBLY & 4K CAMERA UNDERNEATH
    // ========================================================
    // Suspended directly underneath the belly between the landing legs
    const gimbalBase = new THREE.Group();
    gimbalBase.position.set(0, -0.028, -0.02);

    // Vibration Damping Mount Plate
    const dampPlate = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.004, 0.038), this.cameraBodyMat);
    dampPlate.castShadow = true;
    gimbalBase.add(dampPlate);

    // 4 Miniature Rubber Isolation Dampers
    [[-0.013, -0.013], [0.013, -0.013], [-0.013, 0.013], [0.013, 0.013]].forEach(([dx, dz]) => {
      const damp = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), this.rubberMat);
      damp.position.set(dx, -0.004, dz);
      gimbalBase.add(damp);
    });

    // 1st Axis: Yaw Gimbal Motor & Bracket
    this.gimbalYawGroup.position.set(0, -0.008, 0);
    const yawMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.010, 14), this.cameraBodyMat);
    this.gimbalYawGroup.add(yawMotor);

    // Vertical Yaw-to-Roll Drop Arm
    const dropArmGeom = new THREE.BoxGeometry(0.007, 0.018, 0.008);
    const dropArm = new THREE.Mesh(dropArmGeom, this.cameraBodyMat);
    dropArm.position.set(0.012, -0.012, 0);
    this.gimbalYawGroup.add(dropArm);

    // 2nd Axis: Roll Gimbal Motor & Cradle Arm
    this.gimbalRollGroup.position.set(0.012, -0.022, 0);
    const rollMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.008, 14), this.cameraBodyMat);
    rollMotor.rotateZ(Math.PI / 2);
    this.gimbalRollGroup.add(rollMotor);

    // Roll Bracket curving around to pitch motor
    const rollBracketGeom = new THREE.BoxGeometry(0.024, 0.006, 0.008);
    const rollBracket = new THREE.Mesh(rollBracketGeom, this.cameraBodyMat);
    rollBracket.position.set(-0.012, 0, 0);
    this.gimbalRollGroup.add(rollBracket);

    // 3rd Axis: Pitch Gimbal Motor & Camera Housing Cradle
    this.gimbalPitchGroup.position.set(-0.024, 0, 0);
    const pitchMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.007, 14), this.cameraBodyMat);
    pitchMotor.rotateX(Math.PI / 2);
    this.gimbalPitchGroup.add(pitchMotor);

    // Camera Housing Body (rounded rectangular 4K camera)
    this.cameraBody.position.set(0.012, 0, 0);

    const camBoxGeom = new THREE.BoxGeometry(0.026, 0.022, 0.028);
    const camBox = new THREE.Mesh(camBoxGeom, this.cameraBodyMat);
    camBox.castShadow = true;
    this.cameraBody.add(camBox);

    // Status recording LED on camera side
    const recLed = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 6, 6), new THREE.MeshBasicMaterial({ color: 0x00e676 }));
    recLed.position.set(0.014, 0.006, 0.008);
    this.cameraBody.add(recLed);

    // 4K Optical Camera Lens Barrel
    const lensBarrelGeom = new THREE.CylinderGeometry(0.009, 0.009, 0.012, 16);
    lensBarrelGeom.rotateX(Math.PI / 2);
    const lensBarrel = new THREE.Mesh(lensBarrelGeom, this.cameraBodyMat);
    lensBarrel.position.set(0, 0, -0.018);
    lensBarrel.castShadow = true;
    this.cameraBody.add(lensBarrel);

    // Anti-reflective coating cyan accent ring
    const arRingGeom = new THREE.TorusGeometry(0.009, 0.0012, 6, 16);
    const arRing = new THREE.Mesh(arRingGeom, this.lensRimMat);
    arRing.position.set(0, 0, -0.024);
    this.cameraBody.add(arRing);

    // Front Glass Element (#111111)
    const glassGeom = new THREE.CircleGeometry(0.0085, 16);
    const glass = new THREE.Mesh(glassGeom, this.lensMat);
    glass.position.set(0, 0, -0.0245);
    this.cameraBody.add(glass);

    // Assemble Gimbal Hierarchy
    this.gimbalPitchGroup.add(this.cameraBody);
    this.gimbalRollGroup.add(this.gimbalPitchGroup);
    this.gimbalYawGroup.add(this.gimbalRollGroup);
    gimbalBase.add(this.gimbalYawGroup);
    this.mesh.add(gimbalBase);

    // Save camera world anchor point for FPV camera tracking
    this.cameraSensorAnchor = this.cameraBody;
  }

  /**
   * Sets manual tilt angle for camera gimbal (0 = horizon, -Math.PI/2 = straight down)
   */
  setGimbalPitch(angleRad) {
    this.gimbalTargetPitch = THREE.MathUtils.clamp(angleRad, -Math.PI / 2, 0.3);
  }

  /**
   * Updates rotor spin animation and 3-axis gimbal stabilization
   * @param {number} delta Delta time in seconds
   * @param {number} throttle Flight throttle factor (0.4 to 1.0)
   * @param {number} dronePitch Current drone body pitch
   * @param {number} droneRoll Current drone body roll
   */
  update(delta, throttle = 1.0, dronePitch = 0, droneRoll = 0) {
    // 1. Spinning Rotor Blades (Clockwise & Counter-Clockwise pairs)
    const spinSpeed = delta * 65.0 * throttle;
    this.rotors.forEach((rotor, idx) => {
      const dir = (idx === 0 || idx === 3) ? 1 : -1;
      rotor.rotation.y += spinSpeed * dir;
    });

    // 2. Active 3-Axis Gimbal Horizon Stabilization
    // The gimbal motors counter-rotate against the drone body's tilt to keep camera level
    this.currentGimbalPitch = THREE.MathUtils.lerp(this.currentGimbalPitch, this.gimbalTargetPitch, delta * 8.0);

    // Stabilize roll: cancel out body roll
    this.gimbalRollGroup.rotation.z = -droneRoll;

    // Stabilize pitch: apply user target pitch minus drone pitch
    this.gimbalPitchGroup.rotation.x = this.currentGimbalPitch - dronePitch;
  }
}
