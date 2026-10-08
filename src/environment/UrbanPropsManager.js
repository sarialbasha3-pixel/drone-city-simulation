import * as THREE from 'three';
import { AssetManager } from '../materials/AssetManager.js';

/**
 * UrbanPropsManager - High-density urban street details and dynamic ambient traffic.
 *
 * Features:
 * - 3D GLB streetlights (curved and double-arm) with warm night-lighting emissive fixtures
 * - 3D GLB mast-arm and hanging traffic signals at intersections
 * - 3D GLB traffic signs (Stop, Warning, Street name, Highway overhead gantries)
 * - 3D GLB street furniture (dumpsters, sidewalk planters, utility electricity poles, construction barriers)
 * - Diverse vehicle fleet (Sedans, SUVs, Delivery Vans, Transit Buses, Box Trucks)
 * - High-performance single-draw-call THREE.InstancedMesh architecture
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
    this.generateRoadSigns();
    this.generateParkedVehicles();
    this.generateMovingVehicles();
    this.generateStreetFurniture();
    return this.root;
  }

  /**
   * 1. 3D Streetlights along avenues, highways, and boulevards
   */
  async generateStreetLights() {
    const singleLightTransforms = [];
    const doubleLightTransforms = [];
    const bulbTransforms = [];

    // Downtown Boulevard and Avenues
    const avenuesX = [40, 110, 130, 240, 260, 370, 390];
    for (const x of avenuesX) {
      const isGrandBoulevard = (x === 240 || x === 260);
      for (let z = -240; z <= 240; z += 35) {
        if (Math.abs(z) < 25 && isGrandBoulevard) continue; // Roundabout clearance
        const h = this.terrain.getHeight(x, z);
        if (h > 2.0) {
          const rotY = x % 100 < 50 ? 0 : Math.PI;
          if (isGrandBoulevard) {
            doubleLightTransforms.push({ pos: new THREE.Vector3(x, h, z), rotY: rotY });
          } else {
            singleLightTransforms.push({ pos: new THREE.Vector3(x, h, z), rotY: rotY });
          }
          bulbTransforms.push(new THREE.Vector3(x, h + 6.8, z));
        }
      }
    }

    // Coastal Highway streetlights
    for (let z = -700; z <= 700; z += 45) {
      const x = 34;
      const h = this.terrain.getHeight(x, z);
      if (h > 1.5) {
        singleLightTransforms.push({ pos: new THREE.Vector3(x, h, z), rotY: Math.PI * 0.5 });
        bulbTransforms.push(new THREE.Vector3(x, h + 6.8, z));
      }
    }

    // Single-arm curved streetlights
    if (singleLightTransforms.length > 0) {
      const instSingle = await AssetManager.createInstancedMesh('light-curved.glb', singleLightTransforms);
      if (instSingle) this.root.add(instSingle);
    }

    // Double-arm curved streetlights for Grand Boulevard
    if (doubleLightTransforms.length > 0) {
      const instDouble = await AssetManager.createInstancedMesh('light-curved-double.glb', doubleLightTransforms);
      if (instDouble) this.root.add(instDouble);
    }

    // Warm luminous light bulb fixtures
    if (bulbTransforms.length > 0) {
      const bulbGeom = new THREE.SphereGeometry(0.35, 8, 8);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfffae6 });
      const instBulbs = new THREE.InstancedMesh(bulbGeom, bulbMat, bulbTransforms.length);

      const dummy = new THREE.Object3D();
      bulbTransforms.forEach((pos, idx) => {
        dummy.position.copy(pos);
        dummy.updateMatrix();
        instBulbs.setMatrixAt(idx, dummy.matrix);
      });
      instBulbs.instanceMatrix.needsUpdate = true;
      this.root.add(instBulbs);
    }
  }

  /**
   * 2. 3D Mast-Arm & Hanging Traffic Signals at Intersections
   */
  async generateTrafficSignals() {
    const intersections = this.roadNetwork.intersectionPoints;
    if (!intersections || intersections.length === 0) return;

    const signalTransforms = [];
    const hangingTransforms = [];

    intersections.forEach((pt) => {
      // Corner upright traffic signals
      signalTransforms.push({
        pos: new THREE.Vector3(pt.x + 8.5, pt.y, pt.z + 8.5),
        rotY: -Math.PI * 0.25
      });
      signalTransforms.push({
        pos: new THREE.Vector3(pt.x - 8.5, pt.y, pt.z - 8.5),
        rotY: Math.PI * 0.75
      });

      // Overhead hanging signal at major intersections
      if (Math.abs(pt.x - 250) < 10) {
        hangingTransforms.push({
          pos: new THREE.Vector3(pt.x, pt.y, pt.z + 7.0),
          rotY: 0
        });
      }
    });

    if (signalTransforms.length > 0) {
      const instSignals = await AssetManager.createInstancedMesh('traffic-light.glb', signalTransforms);
      if (instSignals) this.root.add(instSignals);
    }

    if (hangingTransforms.length > 0) {
      const instHanging = await AssetManager.createInstancedMesh('traffic-light-hanging.glb', hangingTransforms);
      if (instHanging) this.root.add(instHanging);
    }
  }

  /**
   * 3. 3D Traffic & Road Signs (Stop signs, warning signs, street names, highway gantries)
   */
  async generateRoadSigns() {
    const stopSignTransforms = [];
    const warningSignTransforms = [];
    const streetSignTransforms = [];
    const highwayGantryTransforms = [];

    // A. Stop Signs near crosswalk approaches
    const intersections = this.roadNetwork.intersectionPoints || [];
    intersections.forEach((pt) => {
      stopSignTransforms.push({
        pos: new THREE.Vector3(pt.x + 8.0, pt.y, pt.z - 6.5),
        rotY: Math.PI
      });
      stopSignTransforms.push({
        pos: new THREE.Vector3(pt.x - 8.0, pt.y, pt.z + 6.5),
        rotY: 0
      });
    });

    // B. Warning Signs along curved roads and mountain passes
    [-180, -90, 90, 180].forEach((z) => {
      const h = this.terrain.getHeight(35, z);
      warningSignTransforms.push({
        pos: new THREE.Vector3(35, h, z),
        rotY: Math.PI * 0.5
      });
    });

    // C. Street Name Signs at boulevard junctions
    [
      { x: 120, z: -160 }, { x: 120, z: 0 }, { x: 120, z: 160 },
      { x: 380, z: -160 }, { x: 380, z: 0 }, { x: 380, z: 160 }
    ].forEach((pt) => {
      const h = this.terrain.getHeight(pt.x + 9, pt.z + 9);
      streetSignTransforms.push({
        pos: new THREE.Vector3(pt.x + 9, h, pt.z + 9),
        rotY: -Math.PI * 0.25
      });
    });

    // D. Overhead Highway Gantries at Great Bay Bridge approaches
    highwayGantryTransforms.push({
      pos: new THREE.Vector3(88, this.terrain.getHeight(88, 0) + 0.2, 0),
      rotY: Math.PI * 0.5
    });
    highwayGantryTransforms.push({
      pos: new THREE.Vector3(-275, this.terrain.getHeight(-275, 0) + 0.2, 0),
      rotY: -Math.PI * 0.5
    });

    if (stopSignTransforms.length > 0) {
      const instStop = await AssetManager.createInstancedMesh('road-sign-stop.glb', stopSignTransforms);
      if (instStop) this.root.add(instStop);
    }

    if (warningSignTransforms.length > 0) {
      const instWarn = await AssetManager.createInstancedMesh('road-sign-warning.glb', warningSignTransforms);
      if (instWarn) this.root.add(instWarn);
    }

    if (streetSignTransforms.length > 0) {
      const instStreet = await AssetManager.createInstancedMesh('road-sign-street.glb', streetSignTransforms);
      if (instStreet) this.root.add(instStreet);
    }

    if (highwayGantryTransforms.length > 0) {
      const instHighway = await AssetManager.createInstancedMesh('sign-highway-detailed.glb', highwayGantryTransforms);
      if (instHighway) this.root.add(instHighway);
    }
  }

  /**
   * 4. 3D Street Furniture: Dumpsters, Planters, Electricity Poles, Construction Barriers, Benches
   */
  async generateStreetFurniture() {
    const dumpsterTransforms = [];
    const planterTransforms = [];
    const poleTransforms = [];
    const barrierTransforms = [];
    const coneTransforms = [];
    const hydrantPositions = [];
    const benchPositions = [];
    const busStopPositions = [];

    // Downtown sidewalk planters and fire hydrants
    for (let z = -200; z <= 200; z += 40) {
      [42, 114, 238, 368].forEach((x) => {
        const h = this.terrain.getHeight(x, z);
        if (h > 2.0) {
          planterTransforms.push({ pos: new THREE.Vector3(x, h + 0.16, z), rotY: Math.random() * Math.PI });
          if (z % 80 === 0) {
            hydrantPositions.push(new THREE.Vector3(x, h + 0.16, z + 6));
          }
          if (z % 120 === 0) {
            benchPositions.push(new THREE.Vector3(x + 1.2, h + 0.16, z + 12));
          }
        }
      });
    }

    // Dumpsters behind commercial and industrial service alleys
    for (let z = -180; z <= 180; z += 90) {
      [165, 310, -220, -320].forEach((x) => {
        const h = this.terrain.getHeight(x, z);
        dumpsterTransforms.push({
          pos: new THREE.Vector3(x, h + 0.15, z),
          rotY: Math.random() * Math.PI * 2
        });
      });
    }

    // Utility electricity poles along residential & peripheral hill borders
    for (let x = 60; x <= 440; x += 60) {
      [-260, 260].forEach((z) => {
        const h = this.terrain.getHeight(x, z);
        if (h > 2.0) {
          poleTransforms.push({ pos: new THREE.Vector3(x, h, z), rotY: 0 });
        }
      });
    }

    // Roadway construction safety barriers and cones along western industrial loop
    for (let iz = 140; iz <= 220; iz += 18) {
      const ix = -160;
      const h = this.terrain.getHeight(ix, iz);
      barrierTransforms.push({ pos: new THREE.Vector3(ix, h + 0.1, iz), rotY: Math.PI * 0.5 });
      coneTransforms.push({ pos: new THREE.Vector3(ix + 1.8, h + 0.1, iz + 4), rotY: 0 });
    }

    // Bus stops along avenues
    [
      { x: 42, z: -120 }, { x: 42, z: 120 },
      { x: 238, z: -120 }, { x: 238, z: 120 }
    ].forEach((bp) => {
      const h = this.terrain.getHeight(bp.x, bp.z);
      busStopPositions.push(new THREE.Vector3(bp.x, h + 0.16, bp.z));
    });

    // Deploy 3D Instanced Props
    if (dumpsterTransforms.length > 0) {
      const instDump = await AssetManager.createInstancedMesh('dumpster.glb', dumpsterTransforms);
      if (instDump) this.root.add(instDump);
    }

    if (planterTransforms.length > 0) {
      const instPlant = await AssetManager.createInstancedMesh('planter.glb', planterTransforms);
      if (instPlant) this.root.add(instPlant);
    }

    if (poleTransforms.length > 0) {
      const instPoles = await AssetManager.createInstancedMesh('electricity-pole.glb', poleTransforms);
      if (instPoles) this.root.add(instPoles);
    }

    if (barrierTransforms.length > 0) {
      const instBarriers = await AssetManager.createInstancedMesh('construction-barrier.glb', barrierTransforms);
      if (instBarriers) this.root.add(instBarriers);
    }

    if (coneTransforms.length > 0) {
      const instCones = await AssetManager.createInstancedMesh('construction-cone.glb', coneTransforms);
      if (instCones) this.root.add(instCones);
    }

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

    // Modern Glass Bus Stop Shelters
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
   * 5. Diverse Parked Vehicles across Downtown, Commercial, and Industrial zones
   */
  generateParkedVehicles() {
    const vehicleEntries = [];

    const colors = [
      new THREE.Color('#ffffff'), // Alpine White
      new THREE.Color('#1a1a1c'), // Black Metallic
      new THREE.Color('#9e9e9e'), // Metallic Silver
      new THREE.Color('#b71c1c'), // Crimson Red
      new THREE.Color('#0d47a1'), // Dark Navy Blue
      new THREE.Color('#37474f'), // Charcoal Grey
      new THREE.Color('#f57f17')  // Amber Gold
    ];

    // Downtown curb parking
    for (let z = -220; z <= 220; z += 16) {
      if (Math.abs(z % 160) < 18 || Math.abs(z) < 32) continue;
      [48, 112, 128, 242, 258, 372, 388].forEach((x) => {
        const h = this.terrain.getHeight(x, z);
        if (h > 2.0 && Math.random() < 0.65) {
          const typeRand = Math.random();
          const type = typeRand < 0.5 ? 'SEDAN' : typeRand < 0.8 ? 'SUV' : 'VAN';
          vehicleEntries.push({
            pos: new THREE.Vector3(x, h + 0.15, z),
            rot: Math.random() < 0.5 ? 0 : Math.PI,
            type: type,
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
          const typeRand = Math.random();
          const type = typeRand < 0.55 ? 'SEDAN' : typeRand < 0.85 ? 'SUV' : 'VAN';
          vehicleEntries.push({
            pos: new THREE.Vector3(px, h + 0.15, pz),
            rot: Math.PI / 2,
            type: type,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }
      }
    }

    // Industrial Docks: Parked Semi-Trailers & Heavy Box Trucks
    for (let iz = 120; iz <= 520; iz += 36) {
      const ix = -250;
      const h = this.terrain.getHeight(ix, iz);
      vehicleEntries.push({
        pos: new THREE.Vector3(ix, h + 0.2, iz),
        rot: Math.PI / 2,
        type: 'TRUCK',
        color: new THREE.Color('#37474f')
      });
    }

    if (vehicleEntries.length === 0) return;

    // Build optimized instanced car models
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

      if (entry.type === 'TRUCK') {
        dummy.scale.set(1.25, 2.1, 1.8);
      } else if (entry.type === 'VAN') {
        dummy.scale.set(1.15, 1.6, 1.35);
      } else if (entry.type === 'SUV') {
        dummy.scale.set(1.08, 1.22, 1.05);
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
   * 6. Dynamic Moving Ambient Vehicles with Diverse Typologies (Sedans, SUVs, Vans, Buses, Trucks)
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
      0xd97706, // Amber Yellow
      0x059669  // Forest Green
    ];

    const totalVehicles = 32;

    for (let i = 0; i < totalVehicles; i++) {
      const routeIdx = i % routes.length;
      const waypoints = routes[routeIdx];
      if (waypoints.length < 3) continue;

      const curve = new THREE.CatmullRomCurve3(waypoints, true);
      const paintColor = paintColors[i % paintColors.length];
      const bodyMat = new THREE.MeshStandardMaterial({
        color: paintColor,
        roughness: 0.28,
        metalness: 0.85
      });

      const vehicleTypeSeed = i % 5;
      const carRoot = new THREE.Group();
      carRoot.name = `ambient_veh_${i}`;

      let type = 'SEDAN';
      let length = 4.4;
      let width = 1.95;
      let height = 1.4;

      if (vehicleTypeSeed === 3) {
        // City Passenger Bus
        type = 'BUS';
        length = 9.8;
        width = 2.45;
        height = 3.1;

        const busBody = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.65, length), bodyMat);
        busBody.position.set(0, 0.45 + height * 0.325, 0);
        busBody.castShadow = true;
        carRoot.add(busBody);

        const busCabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, height * 0.35, length * 0.94), glassMat);
        busCabin.position.set(0, 0.45 + height * 0.65 + height * 0.175, 0);
        carRoot.add(busCabin);
      } else if (vehicleTypeSeed === 4) {
        // Commercial Delivery Box Van
        type = 'VAN';
        length = 5.6;
        width = 2.15;
        height = 2.3;

        const cab = new THREE.Mesh(new THREE.BoxGeometry(width, 1.4, 2.0), bodyMat);
        cab.position.set(0, 1.1, length * 0.28);
        cab.castShadow = true;
        carRoot.add(cab);

        const box = new THREE.Mesh(new THREE.BoxGeometry(width * 1.05, height, length * 0.62), bodyMat);
        box.position.set(0, height * 0.5 + 0.4, -length * 0.16);
        box.castShadow = true;
        carRoot.add(box);
      } else if (vehicleTypeSeed === 2) {
        // Compact SUV
        type = 'SUV';
        length = 4.7;
        width = 2.05;
        height = 1.65;

        const chassis = new THREE.Mesh(new THREE.BoxGeometry(width, 0.75, length), bodyMat);
        chassis.position.set(0, 0.75, 0);
        chassis.castShadow = true;
        carRoot.add(chassis);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.8, length * 0.6), glassMat);
        cabin.position.set(0, 1.5, -length * 0.08);
        carRoot.add(cabin);
      } else {
        // Modern Sedan
        type = 'SEDAN';
        length = 4.4;
        width = 1.95;
        height = 1.35;

        const chassis = new THREE.Mesh(new THREE.BoxGeometry(width, 0.65, length), bodyMat);
        chassis.position.set(0, 0.65, 0);
        chassis.castShadow = true;
        carRoot.add(chassis);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, 0.65, length * 0.52), glassMat);
        cabin.position.set(0, 1.3, -length * 0.05);
        carRoot.add(cabin);
      }

      // Functional Headlights (Forward)
      [-width * 0.38, width * 0.38].forEach((lx) => {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.08), headlightMat);
        hl.position.set(lx, 0.65, length * 0.5 + 0.04);
        carRoot.add(hl);
      });

      // Functional Taillights (Rear)
      [-width * 0.38, width * 0.38].forEach((lx) => {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.08), taillightMat);
        tl.position.set(lx, 0.7, -length * 0.5 - 0.04);
        carRoot.add(tl);
      });

      // Four Wheels
      const wheelGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12);
      wheelGeom.rotateZ(Math.PI / 2);

      const halfL = length * 0.32;
      const halfW = width * 0.5;

      [-halfL, halfL].forEach((wz) => {
        [-halfW, halfW].forEach((wx) => {
          const wheel = new THREE.Mesh(wheelGeom, wheelMat);
          wheel.position.set(wx, 0.38, wz);
          carRoot.add(wheel);
        });
      });

      trafficGroup.add(carRoot);

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
   * Updates moving ambient vehicles every frame
   */
  update(delta) {
    if (!this.movingVehicles || this.movingVehicles.length === 0) return;

    for (let i = 0; i < this.movingVehicles.length; i++) {
      const vA = this.movingVehicles[i];
      let minGap = 999;

      for (let j = 0; j < this.movingVehicles.length; j++) {
        if (i === j) continue;
        const vB = this.movingVehicles[j];
        if (vA.routeIdx === vB.routeIdx) {
          let gap = vB.progress - vA.progress;
          if (gap < 0) gap += 1.0;
          if (gap < minGap) minGap = gap;
        }
      }

      // Safe following distance deceleration
      if (minGap < 0.06) {
        vA.currentSpeed = THREE.MathUtils.lerp(vA.currentSpeed, vA.targetSpeed * 0.35, delta * 4.0);
      } else {
        vA.currentSpeed = THREE.MathUtils.lerp(vA.currentSpeed, vA.targetSpeed, delta * 2.0);
      }

      vA.progress = (vA.progress + vA.currentSpeed * delta) % 1.0;

      const pos = vA.curve.getPointAt(vA.progress);
      const tangent = vA.curve.getTangentAt(vA.progress).normalize();

      let h = this.terrain.getHeight(pos.x, pos.z) + 0.18;
      if (this.bridgeGen) {
        const bridgeH = this.bridgeGen.getBridgeHeight(pos.x, pos.z);
        if (bridgeH !== null) {
          h = bridgeH;
        }
      }

      vA.mesh.position.set(pos.x, h, pos.z);

      const yaw = Math.atan2(tangent.x, tangent.z) + Math.PI;
      const pitch = -Math.asin(THREE.MathUtils.clamp(tangent.y, -0.6, 0.6));
      vA.mesh.rotation.set(pitch, yaw, 0, 'YXZ');
    }
  }
}
