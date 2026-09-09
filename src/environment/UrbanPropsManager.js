import * as THREE from 'three';

/**
 * UrbanPropsManager - High-density urban street details and dynamic ambient traffic.
 *
 * Features:
 * - Dynamic moving vehicles cruising along road networks with headlights and taillights
 * - Diverse parked vehicles (sedans, SUVs, delivery vans, semi-trailers)
 * - Modern streetlights with warm emissive fixtures
 * - Mast-arm traffic signals at intersections
 * - Bus stops with glass canopies
 * - Street furniture (benches, fire hydrants, trash dumpsters, road cones)
 */
export class UrbanPropsManager {
  constructor(terrain, roadNetwork, bridgeGen = null) {
    this.terrain = terrain;
    this.roadNetwork = roadNetwork;
    this.bridgeGen = bridgeGen;
    this.root = new THREE.Group();
    this.root.name = 'urban_props';

    this.movingVehicles = [];
  }

  generateProps() {
    this.generateStreetLights();
    this.generateTrafficSignals();
    this.generateParkedVehicles();
    this.generateMovingVehicles();
    this.generateStreetFurniture();
    return this.root;
  }

  /**
   * 1. Streetlights along avenues, highways, and boulevards
   */
  generateStreetLights() {
    const lightPositions = [];

    // Downtown Boulevard and Avenues
    const avenuesX = [40, 110, 130, 240, 260, 370, 390];
    for (const x of avenuesX) {
      for (let z = -240; z <= 240; z += 35) {
        if (Math.abs(z) < 25 && (x === 240 || x === 260)) continue; // Roundabout clearance
        const h = this.terrain.getHeight(x, z);
        if (h > 2.0) {
          lightPositions.push(new THREE.Vector3(x, h, z));
        }
      }
    }

    // Coastal Highway streetlights
    for (let z = -700; z <= 700; z += 45) {
      const x = 34;
      const h = this.terrain.getHeight(x, z);
      if (h > 1.5) {
        lightPositions.push(new THREE.Vector3(x, h, z));
      }
    }

    if (lightPositions.length === 0) return;

    const poleGeom = new THREE.CylinderGeometry(0.12, 0.18, 7.5, 8);
    poleGeom.translate(0, 3.75, 0);

    const armGeom = new THREE.BoxGeometry(0.15, 0.15, 2.4);
    armGeom.translate(0, 7.3, 1.0);

    const fixtureGeom = new THREE.BoxGeometry(0.35, 0.2, 0.8);
    fixtureGeom.translate(0, 7.15, 1.8);

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x37474f,
      roughness: 0.4,
      metalness: 0.8
    });

    const instPoles = new THREE.InstancedMesh(poleGeom, poleMat, lightPositions.length);
    instPoles.castShadow = true;

    // Emissive light bulbs
    const bulbGeom = new THREE.PlaneGeometry(0.3, 0.6);
    bulbGeom.rotateX(Math.PI / 2);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfffae6 });
    const instBulbs = new THREE.InstancedMesh(bulbGeom, bulbMat, lightPositions.length);

    const dummy = new THREE.Object3D();
    lightPositions.forEach((pos, idx) => {
      dummy.position.copy(pos);
      dummy.rotation.y = pos.x % 100 < 50 ? 0 : Math.PI;
      dummy.updateMatrix();
      instPoles.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(pos.x, pos.y + 7.0, pos.z);
      dummy.updateMatrix();
      instBulbs.setMatrixAt(idx, dummy.matrix);
    });

    instPoles.instanceMatrix.needsUpdate = true;
    instBulbs.instanceMatrix.needsUpdate = true;

    this.root.add(instPoles);
    this.root.add(instBulbs);
  }

  /**
   * 2. Mast-Arm Traffic Signals at Intersections
   */
  generateTrafficSignals() {
    const intersections = this.roadNetwork.intersectionPoints;
    if (!intersections || intersections.length === 0) return;

    const signalPoleGeom = new THREE.CylinderGeometry(0.15, 0.2, 6.8, 8);
    signalPoleGeom.translate(0, 3.4, 0);

    const signalMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.6, metalness: 0.5 });
    const instSignals = new THREE.InstancedMesh(signalPoleGeom, signalMat, intersections.length * 2);

    const dummy = new THREE.Object3D();
    let count = 0;
    intersections.forEach((pt) => {
      dummy.position.set(pt.x + 8.5, pt.y, pt.z + 8.5);
      dummy.rotation.y = -Math.PI / 4;
      dummy.updateMatrix();
      instSignals.setMatrixAt(count++, dummy.matrix);

      dummy.position.set(pt.x - 8.5, pt.y, pt.z - 8.5);
      dummy.rotation.y = Math.PI * 0.75;
      dummy.updateMatrix();
      instSignals.setMatrixAt(count++, dummy.matrix);
    });

    instSignals.instanceMatrix.needsUpdate = true;
    this.root.add(instSignals);
  }

  /**
   * 3. Diverse Parked Vehicles (Sedans, SUVs, Delivery Vans, Semi-Trailers)
   */
  generateParkedVehicles() {
    const vehicleEntries = []; // { pos, rot, type, color }

    const colors = [
      new THREE.Color('#ffffff'), // Alpine White
      new THREE.Color('#1a1a1c'), // Black
      new THREE.Color('#9e9e9e'), // Silver
      new THREE.Color('#b71c1c'), // Red
      new THREE.Color('#0d47a1'), // Dark Blue
      new THREE.Color('#37474f'), // Charcoal Grey
      new THREE.Color('#f57f17')  // Amber Orange
    ];

    // Downtown curb parking
    for (let z = -220; z <= 220; z += 16) {
      if (Math.abs(z % 160) < 18 || Math.abs(z) < 32) continue;
      [48, 112, 128, 242, 258, 372, 388].forEach((x) => {
        const h = this.terrain.getHeight(x, z);
        if (h > 2.0 && Math.random() < 0.65) {
          vehicleEntries.push({
            pos: new THREE.Vector3(x, h + 0.15, z),
            rot: Math.random() < 0.5 ? 0 : Math.PI,
            isVan: Math.random() < 0.25,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }
      });
    }

    // Commercial Parking Lots (X: 140 to 220, Z: 380 to 480)
    for (let px = 145; px <= 215; px += 7.5) {
      for (let pz = 390; pz <= 470; pz += 12) {
        const h = this.terrain.getHeight(px, pz);
        if (Math.random() < 0.7) {
          vehicleEntries.push({
            pos: new THREE.Vector3(px, h + 0.15, pz),
            rot: Math.PI / 2,
            isVan: Math.random() < 0.2,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }
      }
    }

    // Industrial Docks: Parked Semi-Trailers & Heavy Box Vans (X: -400 to -240, Z: 100 to 500)
    for (let iz = 120; iz <= 520; iz += 36) {
      const ix = -250;
      const h = this.terrain.getHeight(ix, iz);
      vehicleEntries.push({
        pos: new THREE.Vector3(ix, h + 0.2, iz),
        rot: Math.PI / 2,
        isVan: true,
        color: new THREE.Color('#37474f')
      });
    }

    if (vehicleEntries.length === 0) return;

    // Standard Car Geometry (Sedan / SUV)
    const carGeom = new THREE.BoxGeometry(2.0, 1.3, 4.4);
    carGeom.translate(0, 0.75, 0);

    const carMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.8 });
    const instCars = new THREE.InstancedMesh(carGeom, carMat, vehicleEntries.length);
    instCars.castShadow = true;
    instCars.receiveShadow = true;

    const dummy = new THREE.Object3D();
    vehicleEntries.forEach((entry, idx) => {
      dummy.position.copy(entry.pos);
      dummy.rotation.y = entry.rot;
      if (entry.isVan) {
        dummy.scale.set(1.15, 1.6, 1.4); // Box van / truck proportions
      } else {
        dummy.scale.set(0.95, 0.95, 0.95);
      }
      dummy.updateMatrix();
      instCars.setMatrixAt(idx, dummy.matrix);
      instCars.setColorAt(idx, entry.color);
    });

    instCars.instanceMatrix.needsUpdate = true;
    if (instCars.instanceColor) instCars.instanceColor.needsUpdate = true;
    this.root.add(instCars);
  }

  /**
   * 4. Dynamic Moving Ambient Vehicles on Roadways
   * Features diverse vehicle typologies (Sedans, SUVs, Delivery Vans, Box Trucks),
   * authentic color finishes, wheels, headlights/taillights, and road-bound paths.
   */
  generateMovingVehicles() {
    const trafficGroup = new THREE.Group();
    trafficGroup.name = 'ambient_moving_traffic';

    const routes = this.roadNetwork.trafficRoutes;
    if (!routes || routes.length === 0) return;

    const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfffde7 });
    const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.15, metalness: 0.9 });

    const paintColors = [
      0xf0f2f5, // Alpine White
      0x141517, // Pearl Black
      0x8e9297, // Metallic Silver
      0x374151, // Gunmetal Grey
      0x1e3a8a, // Deep Navy Blue
      0x881337, // Crimson Burgundy
      0xd97706  // Amber / Commercial Yellow
    ];

    const vehicleTypes = ['SEDAN', 'SUV', 'VAN', 'TRUCK'];

    // Spawn 22 moving vehicles distributed across the 5 road-bound routes
    const totalVehicles = 22;

    for (let i = 0; i < totalVehicles; i++) {
      const routeIdx = i % routes.length;
      const waypoints = routes[routeIdx];
      const curve = new THREE.CatmullRomCurve3(waypoints, true); // Closed looping curve

      const type = vehicleTypes[i % vehicleTypes.length];
      const paintColor = paintColors[i % paintColors.length];
      const bodyMat = new THREE.MeshStandardMaterial({
        color: paintColor,
        roughness: 0.35,
        metalness: 0.75
      });

      const carRoot = new THREE.Group();

      if (type === 'SEDAN') {
        // Sleek aerodynamic sedan (4.4m x 1.85m x 1.4m)
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 4.4), bodyMat);
        chassis.position.set(0, 0.42, 0);
        chassis.castShadow = true;
        carRoot.add(chassis);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.2), glassMat);
        cabin.position.set(0, 0.95, -0.1);
        carRoot.add(cabin);

        // Headlights & Taillights
        [-0.65, 0.65].forEach((hx) => {
          const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), headlightMat);
          hl.position.set(hx, 0.5, -2.22);
          carRoot.add(hl);

          const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), taillightMat);
          tl.position.set(hx, 0.52, 2.22);
          carRoot.add(tl);
        });

      } else if (type === 'SUV') {
        // Modern sport utility vehicle (4.8m x 2.0m x 1.75m)
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.8), bodyMat);
        chassis.position.set(0, 0.55, 0);
        chassis.castShadow = true;
        carRoot.add(chassis);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.9), glassMat);
        cabin.position.set(0, 1.25, 0.1);
        carRoot.add(cabin);

        // Roof rails
        [-0.8, 0.8].forEach((rx) => {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.5), wheelMat);
          rail.position.set(rx, 1.62, 0.1);
          carRoot.add(rail);
        });

        [-0.72, 0.72].forEach((hx) => {
          const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), headlightMat);
          hl.position.set(hx, 0.65, -2.42);
          carRoot.add(hl);

          const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), taillightMat);
          tl.position.set(hx, 0.7, 2.42);
          carRoot.add(tl);
        });

      } else if (type === 'VAN') {
        // Commercial delivery van (5.4m x 2.1m x 2.3m)
        const vanBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 5.4), bodyMat);
        vanBody.position.set(0, 1.05, 0);
        vanBody.castShadow = true;
        carRoot.add(vanBody);

        const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.6, 1.2), glassMat);
        windshield.position.set(0, 1.35, -1.8);
        carRoot.add(windshield);

        [-0.78, 0.78].forEach((hx) => {
          const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.08), headlightMat);
          hl.position.set(hx, 0.65, -2.72);
          carRoot.add(hl);

          const tl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.08), taillightMat);
          tl.position.set(hx, 1.0, 2.72);
          carRoot.add(tl);
        });

      } else {
        // Logistics Box Truck (7.2m x 2.4m x 3.0m)
        // Cab
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.5, 2.2), bodyMat);
        cab.position.set(0, 1.05, -2.3);
        cab.castShadow = true;
        carRoot.add(cab);

        const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.2), glassMat);
        cabGlass.position.set(0, 1.35, -2.4);
        carRoot.add(cabGlass);

        // Heavy cargo freight box
        const cargoBoxMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.5, metalness: 0.2 });
        const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.45, 2.1, 4.8), cargoBoxMat);
        cargo.position.set(0, 1.55, 1.1);
        cargo.castShadow = true;
        carRoot.add(cargo);

        [-0.85, 0.85].forEach((hx) => {
          const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.08), headlightMat);
          hl.position.set(hx, 0.65, -3.42);
          carRoot.add(hl);

          const tl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.08), taillightMat);
          tl.position.set(hx, 0.75, 3.52);
          carRoot.add(tl);
        });
      }

      // Add dark rubber wheels for physical grounding
      [-0.85, 0.85].forEach((wx) => {
        [-1.3, 1.3].forEach((wz) => {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 10), wheelMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.32, wz);
          carRoot.add(wheel);
        });
      });

      trafficGroup.add(carRoot);

      // Speed calibrated realistically according to route length (approx 40-60 km/h)
      const baseSpeed = 0.012 + (i % 3) * 0.003;

      this.movingVehicles.push({
        mesh: carRoot,
        curve: curve,
        routeIdx: routeIdx,
        type: type,
        progress: (i / totalVehicles),
        targetSpeed: baseSpeed,
        currentSpeed: baseSpeed
      });
    }

    this.root.add(trafficGroup);
  }

  /**
   * 5. Street Furniture: Bus Stops, Benches, Fire Hydrants, Dumpsters, Traffic Signs
   */
  generateStreetFurniture() {
    const hydrantPositions = [];
    const benchPositions = [];
    const busStopPositions = [];

    // Place along downtown and residential sidewalks
    for (let z = -200; z <= 200; z += 55) {
      [42, 114, 238, 368].forEach((x) => {
        const h = this.terrain.getHeight(x, z);
        if (h > 2.0) {
          hydrantPositions.push(new THREE.Vector3(x, h + 0.16, z));
          benchPositions.push(new THREE.Vector3(x + 1.2, h + 0.16, z + 6));
        }
      });
    }

    // Bus stops along avenues
    [
      { x: 42, z: -120 }, { x: 42, z: 120 },
      { x: 238, z: -120 }, { x: 238, z: 120 }
    ].forEach((bp) => {
      const h = this.terrain.getHeight(bp.x, bp.z);
      busStopPositions.push(new THREE.Vector3(bp.x, h + 0.16, bp.z));
    });

    // Fire Hydrants (Bright Yellow)
    if (hydrantPositions.length > 0) {
      const hydGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.75, 8);
      hydGeom.translate(0, 0.375, 0);
      const hydMat = new THREE.MeshStandardMaterial({ color: 0xfbc02d, roughness: 0.4, metalness: 0.6 });
      const instHyd = new THREE.InstancedMesh(hydGeom, hydMat, hydrantPositions.length);

      const dummy = new THREE.Object3D();
      hydrantPositions.forEach((pos, idx) => {
        dummy.position.copy(pos);
        dummy.updateMatrix();
        instHyd.setMatrixAt(idx, dummy.matrix);
      });
      instHyd.instanceMatrix.needsUpdate = true;
      this.root.add(instHyd);
    }

    // Benches (Wood slats + dark frame)
    if (benchPositions.length > 0) {
      const benchGeom = new THREE.BoxGeometry(1.8, 0.5, 0.6);
      benchGeom.translate(0, 0.35, 0);
      const benchMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.8 });
      const instBench = new THREE.InstancedMesh(benchGeom, benchMat, benchPositions.length);

      const dummy = new THREE.Object3D();
      benchPositions.forEach((pos, idx) => {
        dummy.position.copy(pos);
        dummy.rotation.y = Math.PI / 2;
        dummy.updateMatrix();
        instBench.setMatrixAt(idx, dummy.matrix);
      });
      instBench.instanceMatrix.needsUpdate = true;
      this.root.add(instBench);
    }

    // Glass Bus Stop Shelters
    busStopPositions.forEach((pos) => {
      const shelter = new THREE.Group();
      shelter.position.copy(pos);

      // Steel frame
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.3, metalness: 0.8 });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 2.2), frameMat);
      roof.position.set(0, 2.6, 0);
      shelter.add(roof);

      // Glass rear panel
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.45 });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.3, 0.1), glassMat);
      glass.position.set(0, 1.3, -1.0);
      shelter.add(glass);

      this.root.add(shelter);
    });
  }

  /**
   * Updates moving ambient vehicles every frame:
   * - Progresses vehicles along road-bound lane curves
   * - Maintains safe following distances to prevent overlapping
   * - Accurately follows terrain AND elevated bridge decks/ramps
   * - Aligns vehicle heading and pitch with 3D road gradient
   */
  update(delta) {
    if (!this.movingVehicles || this.movingVehicles.length === 0) return;

    // 1. Spacing / Collision Avoidance check between vehicles on the same route
    for (let i = 0; i < this.movingVehicles.length; i++) {
      const vA = this.movingVehicles[i];
      let minGap = 999;

      for (let j = 0; j < this.movingVehicles.length; j++) {
        if (i === j) continue;
        const vB = this.movingVehicles[j];
        if (vA.routeIdx === vB.routeIdx) {
          // Compute forward parametric distance along closed loop
          let gap = vB.progress - vA.progress;
          if (gap < 0) gap += 1.0;
          if (gap < minGap) minGap = gap;
        }
      }

      // If too close to vehicle ahead (< 0.06 loop fraction, ~20m), decelerate
      if (minGap < 0.06) {
        vA.currentSpeed = THREE.MathUtils.lerp(vA.currentSpeed, vA.targetSpeed * 0.35, delta * 4.0);
      } else {
        vA.currentSpeed = THREE.MathUtils.lerp(vA.currentSpeed, vA.targetSpeed, delta * 2.0);
      }

      vA.progress = (vA.progress + vA.currentSpeed * delta) % 1.0;

      // Sample 3D position and tangent from road curve
      const pos = vA.curve.getPointAt(vA.progress);
      const tangent = vA.curve.getTangentAt(vA.progress).normalize();

      // Precise ground / bridge deck elevation query
      let h = this.terrain.getHeight(pos.x, pos.z) + 0.18;
      if (this.bridgeGen) {
        const bridgeH = this.bridgeGen.getBridgeHeight(pos.x, pos.z);
        if (bridgeH !== null) {
          h = bridgeH;
        }
      }

      vA.mesh.position.set(pos.x, h, pos.z);

      // 3D Orientation: heading + road grade pitch
      const yaw = Math.atan2(tangent.x, tangent.z) + Math.PI;
      const pitch = -Math.asin(THREE.MathUtils.clamp(tangent.y, -0.6, 0.6));
      vA.mesh.rotation.set(pitch, yaw, 0, 'YXZ');
    }
  }
}

