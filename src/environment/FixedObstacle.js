import * as THREE from 'three';

/**
 * FixedObstacle.js
 *
 * Implements solid stationary 3D obstacle structures with complete physical collision
 * boundaries that the drone CANNOT pass through.
 *
 * Each obstacle features:
 * - Solid reinforced structural core with high-visibility aeronautical hazard styling
 * - Full 3D dimensions (width, height, depth) and exact Box3 spatial envelope
 * - Complete collision registration in CollisionSystem (100% solid, non-penetrable)
 * - Dimension analysis query methods for optimal nearest-bypass route calculation
 */
export class FixedObstacleManager {
  constructor(scene, collisionSystem) {
    this.scene = scene;
    this.collisionSystem = collisionSystem;
    this.obstaclesGroup = new THREE.Group();
    this.obstaclesGroup.name = 'fixed_obstacles';
    this.scene.add(this.obstaclesGroup);

    this.obstacles = [];
    this.materials = this.initMaterials();
  }

  initMaterials() {
    // 1. High-Visibility Hazard Striped Texture (Aeronautical Caution)
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#181a1d';
    const stripeW = 32;
    for (let x = -256; x < 512; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW + 256, 256);
      ctx.lineTo(x + 256, 256);
      ctx.closePath();
      ctx.fill();
    }
    const hazardTex = new THREE.CanvasTexture(canvas);
    hazardTex.wrapS = THREE.RepeatWrapping;
    hazardTex.wrapT = THREE.RepeatWrapping;
    hazardTex.repeat.set(1, 3);

    const pylonMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      roughness: 0.45,
      metalness: 0.35
    });

    // 2. Solid Central Reinforced Armor Core (Non-penetrable barrier)
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1f2329,
      roughness: 0.50,
      metalness: 0.70
    });

    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x24272c,
      roughness: 0.38,
      metalness: 0.65
    });

    const foundationMat = new THREE.MeshStandardMaterial({
      color: 0x3a3d40,
      roughness: 0.85,
      metalness: 0.15
    });

    const beaconOrangeMat = new THREE.MeshBasicMaterial({
      color: 0xff3300
    });

    const beaconWhiteMat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    });

    return {
      pylonMat,
      coreMat,
      beamMat,
      foundationMat,
      beaconOrangeMat,
      beaconWhiteMat
    };
  }

  /**
   * Spawns a solid, stationary obstacle structure that cannot be penetrated.
   */
  createObstacleGate(config) {
    const {
      position = new THREE.Vector3(250, 40.5, -45),
      rotationY = 0,
      width = 12.0,
      height = 10.0,
      depth = 5.0,
      pillarWidth = 2.2,
      baseHeight = 1.2,
      id = 'obstacle_solid_01'
    } = config;

    const obstacleGroup = new THREE.Group();
    obstacleGroup.name = `obstacle_${id}`;
    obstacleGroup.position.copy(position);
    obstacleGroup.rotation.y = rotationY;

    const halfW = width / 2;
    const halfH = height / 2;
    const halfD = depth / 2;

    // ── 1. Solid Left Support Pylon ─────────────────────────────────────────────
    const leftPylonGeom = new THREE.BoxGeometry(pillarWidth, height, depth);
    const leftPylonMesh = new THREE.Mesh(leftPylonGeom, this.materials.pylonMat);
    leftPylonMesh.position.set(-halfW + (pillarWidth / 2), halfH, 0);
    leftPylonMesh.castShadow = true;
    leftPylonMesh.receiveShadow = true;
    obstacleGroup.add(leftPylonMesh);

    // ── 2. Solid Right Support Pylon ────────────────────────────────────────────
    const rightPylonGeom = new THREE.BoxGeometry(pillarWidth, height, depth);
    const rightPylonMesh = new THREE.Mesh(rightPylonGeom, this.materials.pylonMat);
    rightPylonMesh.position.set(halfW - (pillarWidth / 2), halfH, 0);
    rightPylonMesh.castShadow = true;
    rightPylonMesh.receiveShadow = true;
    obstacleGroup.add(rightPylonMesh);

    // ── 3. Solid Central Barrier Core (Blocks entire center - completely impassable!) ──
    const coreWidth = width - (pillarWidth * 1.6);
    const coreHeight = height - baseHeight;
    const coreGeom = new THREE.BoxGeometry(coreWidth, coreHeight, depth * 0.85);
    const coreMesh = new THREE.Mesh(coreGeom, this.materials.coreMat);
    coreMesh.position.set(0, baseHeight + (coreHeight / 2), 0);
    coreMesh.castShadow = true;
    coreMesh.receiveShadow = true;
    obstacleGroup.add(coreMesh);

    // Hazard cross-chevrons on central barrier face
    const chevronGeom = new THREE.BoxGeometry(coreWidth * 0.9, 0.5, depth * 0.88);
    [-2.0, 0, 2.0].forEach((cy) => {
      const chMesh = new THREE.Mesh(chevronGeom, this.materials.pylonMat);
      chMesh.position.set(0, baseHeight + (coreHeight / 2) + cy, 0);
      obstacleGroup.add(chMesh);
    });

    // ── 4. Overhead Lintel Crossbeam (Solid) ───────────────────────────────────
    const lintelHeight = 1.6;
    const lintelGeom = new THREE.BoxGeometry(width + 0.4, lintelHeight, depth + 0.4);
    const lintelMesh = new THREE.Mesh(lintelGeom, this.materials.beamMat);
    lintelMesh.position.set(0, height + (lintelHeight / 2), 0);
    lintelMesh.castShadow = true;
    lintelMesh.receiveShadow = true;
    obstacleGroup.add(lintelMesh);

    // ── 5. Foundation Base Plinth (Solid) ──────────────────────────────────────
    const baseGeom = new THREE.BoxGeometry(width + 0.8, baseHeight, depth + 0.8);
    const baseMesh = new THREE.Mesh(baseGeom, this.materials.foundationMat);
    baseMesh.position.set(0, baseHeight / 2, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    obstacleGroup.add(baseMesh);

    // ── 6. Warning Obstruction Beacons (Red/Orange flashing alert lights) ──────
    [-halfW, 0, halfW].forEach((bx) => {
      const beaconGeom = new THREE.SphereGeometry(0.24, 12, 12);
      const beaconMesh = new THREE.Mesh(beaconGeom, this.materials.beaconOrangeMat);
      beaconMesh.position.set(bx, height + lintelHeight + 0.3, 0);
      obstacleGroup.add(beaconMesh);
    });

    this.obstaclesGroup.add(obstacleGroup);

    // Update transform
    obstacleGroup.updateMatrixWorld(true);

    // ── 7. Register COMPLETE Solid Collision Bounding Box ──────────────────────
    // Covers the entire outer volume of the obstacle so the drone CANNOT penetrate it!
    const solidBox = new THREE.Box3().setFromObject(obstacleGroup);
    if (!solidBox.isEmpty() && this.collisionSystem) {
      this.collisionSystem.registerBox(solidBox);
    }

    const obstacleData = {
      id,
      position: position.clone(),
      centerWorld: new THREE.Vector3(position.x, position.y + (height / 2), position.z),
      dimensions: {
        width,
        height: height + lintelHeight,
        depth
      },
      box3: solidBox,
      group: obstacleGroup
    };

    this.obstacles.push(obstacleData);
    console.log(`[FixedObstacle] Registered SOLID stationary obstacle "${id}" at`, position, `Dimensions: ${width}x${height}x${depth}m`);
    return obstacleData;
  }

  /**
   * Spawns default scenario obstacles positioned along flight corridors.
   */
  spawnDefaultObstacles() {
    // Obstacle 1: Directly ahead of drone takeoff at (250, 40.5, -45)
    this.createObstacleGate({
      id: 'solid_barrier_alpha',
      position: new THREE.Vector3(250, 39.0, -48),
      rotationY: 0,
      width: 12.0,
      height: 10.0,
      depth: 5.0,
      pillarWidth: 2.2,
      baseHeight: 1.2
    });

    // Obstacle 2: Corridor obstacle at (250, 42.0, -108)
    this.createObstacleGate({
      id: 'solid_barrier_beta',
      position: new THREE.Vector3(250, 41.0, -108),
      rotationY: 0.15,
      width: 11.0,
      height: 10.0,
      depth: 4.5,
      pillarWidth: 2.0,
      baseHeight: 1.2
    });

    // Obstacle 3: River bay boundary obstacle at (180, 40.0, -180)
    this.createObstacleGate({
      id: 'solid_barrier_gamma',
      position: new THREE.Vector3(180, 40.0, -180),
      rotationY: -0.30,
      width: 14.0,
      height: 11.0,
      depth: 5.5,
      pillarWidth: 2.5,
      baseHeight: 1.2
    });
  }

  /**
   * Returns all stationary obstacles for spatial analysis.
   */
  getAllObstacles() {
    return this.obstacles;
  }

  /**
   * Finds the nearest obstacle lying directly in the drone's forward flight corridor within maxRange.
   * Enforces vertical altitude clearance and tight lateral safety corridor.
   */
  getObstacleInPath(origin, forwardDir, maxRange = 160.0, corridorSafety = 3.0) {
    let nearestObs = null;
    let minDist = maxRange;

    const fwdHoriz = new THREE.Vector2(forwardDir.x, forwardDir.z).normalize();
    if (fwdHoriz.lengthSq() < 0.001) fwdHoriz.set(0, -1);

    for (const obs of this.obstacles) {
      const box = obs.box3;

      // 1. Scene visibility check
      if (obs.group && !obs.group.visible) continue;

      // 2. Vertical collision envelope check
      // Only obstacles that intersect the drone's altitude interval can cause collision!
      const droneClearance = 2.5; // 2.5m vertical clearance buffer
      if (origin.y - droneClearance > box.max.y || origin.y + droneClearance < box.min.y) {
        continue; // Drone is safely flying above or below this barrier!
      }

      // 3. Longitudinal distance along forward direction
      const dx = obs.centerWorld.x - origin.x;
      const dz = obs.centerWorld.z - origin.z;
      const forwardProj = dx * fwdHoriz.x + dz * fwdHoriz.y;

      // Must be ahead of drone within maxRange
      if (forwardProj <= 1.0 || forwardProj > maxRange) continue;

      // 4. Horizontal lateral distance from forward ray
      const lateralDist = Math.abs(dx * (-fwdHoriz.y) + dz * fwdHoriz.x);
      const halfWidth = (obs.dimensions.width * 0.5) + corridorSafety;

      // Only consider obstacle if the forward flight corridor actually intersects the obstacle!
      if (lateralDist < halfWidth && forwardProj < minDist) {
        minDist = forwardProj;
        nearestObs = {
          obstacle: obs,
          distance: forwardProj,
          lateralDist
        };
      }
    }

    return nearestObs;
  }
}
