import * as THREE from 'three';
import { ProceduralTextures } from '../utils/ProceduralTextures.js';

/**
 * BridgeGenerator - Realistic Engineered Suspension & Viaduct Bridge
 * Connects the West Industrial Coast across the Great Bay to Downtown Mainland.
 *
 * Engineering Features:
 * - Reinforced concrete foundation caissons rooted in riverbed
 * - Twin steel suspension towers with cross-portal bracing & aviation beacons
 * - Heavy longitudinal steel I-beams & transverse floor beams under the deck
 * - Jersey concrete center median barrier & outer crash barriers with safety railings
 * - Realistic PBR highway asphalt deck
 * - Seamless approach ramps on BOTH east and west banks integrating into road networks
 * - Public elevation function getBridgeHeight(x, z) for road-bound vehicles
 */
export class BridgeGenerator {
  constructor(terrain) {
    this.terrain = terrain;
    this.deckY = 22.0;       // Deck elevation above water (22m clearance)
    this.deckWidth = 22.0;   // 4 lanes + center barrier + walkways
    this.westAbutmentX = -280;
    this.westSpanX = -200;
    this.eastSpanX = 0;
    this.eastAbutmentX = 90;
    this.initMaterials();
  }

  initMaterials() {
    const bumpMap = ProceduralTextures.getAsphaltBumpTexture();
    const roughnessMap = ProceduralTextures.getAsphaltRoughnessTexture();

    this.deckMaterial = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getHighwayTexture(),
      bumpMap: bumpMap,
      bumpScale: 0.04,
      roughnessMap: roughnessMap,
      roughness: 0.85,
      metalness: 0.12
    });

    this.concreteMaterial = new THREE.MeshStandardMaterial({
      color: 0x9eabb3,
      roughness: 0.82,
      metalness: 0.1
    });

    this.steelPylonMaterial = new THREE.MeshStandardMaterial({
      color: 0xc63b1e, // Golden Gate International Orange
      roughness: 0.42,
      metalness: 0.65
    });

    this.steelBeamMaterial = new THREE.MeshStandardMaterial({
      color: 0x37474f, // Heavy dark structural steel
      roughness: 0.5,
      metalness: 0.8
    });

    this.cableMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e2227,
      roughness: 0.3,
      metalness: 0.85
    });

    this.barrierMaterial = new THREE.MeshStandardMaterial({
      color: 0xbac0c5,
      roughness: 0.65,
      metalness: 0.25
    });

    this.beaconMaterial = new THREE.MeshBasicMaterial({
      color: 0xff1744
    });
  }

  /**
   * Returns bridge deck height at coordinate (x, z) if on the bridge, or null if off bridge.
   * High performance O(1) query used for road-bound vehicle traffic.
   */
  getBridgeHeight(x, z) {
    if (Math.abs(z) > this.deckWidth * 0.5 + 0.5) return null;
    if (x < this.westAbutmentX || x > this.eastAbutmentX) return null;

    // Main Suspension Span
    if (x >= this.westSpanX && x <= this.eastSpanX) {
      return this.deckY + 0.15;
    }

    // West Approach Ramp (X: -280 to -200)
    if (x >= this.westAbutmentX && x < this.westSpanX) {
      const t = (x - this.westAbutmentX) / (this.westSpanX - this.westAbutmentX);
      const groundH = this.terrain.getHeight(this.westAbutmentX, 0) + 0.18;
      // Smooth S-curve interpolation
      const smoothT = t * t * (3 - 2 * t);
      return THREE.MathUtils.lerp(groundH, this.deckY, smoothT) + 0.15;
    }

    // East Approach Ramp (X: 0 to 90)
    if (x > this.eastSpanX && x <= this.eastAbutmentX) {
      const t = (x - this.eastSpanX) / (this.eastAbutmentX - this.eastSpanX);
      const groundH = this.terrain.getHeight(this.eastAbutmentX, 0) + 0.18;
      const smoothT = t * t * (3 - 2 * t);
      return THREE.MathUtils.lerp(this.deckY, groundH, smoothT) + 0.15;
    }

    return null;
  }

  generate() {
    const bridge = new THREE.Group();
    bridge.name = 'great_bay_engineered_bridge';

    const mainSpanLen = this.eastSpanX - this.westSpanX; // 200m
    const deckThickness = 1.8;

    // ========================================================
    // 1. MAIN SUSPENSION SPAN DECK (X: -200 to 0)
    // ========================================================
    const mainDeckGeom = new THREE.BoxGeometry(mainSpanLen, deckThickness, this.deckWidth);
    const mainDeck = new THREE.Mesh(mainDeckGeom, this.concreteMaterial);
    mainDeck.position.set((this.westSpanX + this.eastSpanX) * 0.5, this.deckY - deckThickness * 0.5, 0);
    mainDeck.castShadow = true;
    mainDeck.receiveShadow = true;
    bridge.add(mainDeck);

    // Main span asphalt road surface
    const roadGeom = new THREE.PlaneGeometry(this.deckWidth, mainSpanLen);
    roadGeom.rotateX(-Math.PI / 2);
    roadGeom.rotateY(Math.PI / 2);
    const mainRoad = new THREE.Mesh(roadGeom, this.deckMaterial);
    mainRoad.position.set((this.westSpanX + this.eastSpanX) * 0.5, this.deckY + 0.03, 0);
    mainRoad.receiveShadow = true;
    bridge.add(mainRoad);

    // ========================================================
    // 2. UNDER-DECK STRUCTURAL STEEL BEAMS & FLOOR TRUSSES
    // ========================================================
    // Longitudinal Steel I-Girders (Left, Center, Right)
    [-this.deckWidth * 0.45, 0, this.deckWidth * 0.45].forEach((gz) => {
      const girderGeom = new THREE.BoxGeometry(mainSpanLen, 1.6, 0.6);
      const girder = new THREE.Mesh(girderGeom, this.steelBeamMaterial);
      girder.position.set((this.westSpanX + this.eastSpanX) * 0.5, this.deckY - deckThickness - 0.8, gz);
      girder.castShadow = true;
      bridge.add(girder);
    });

    // Transverse Floor Beams every 8 meters
    for (let bx = this.westSpanX + 4; bx < this.eastSpanX; bx += 8) {
      const beamGeom = new THREE.BoxGeometry(0.5, 1.2, this.deckWidth);
      const beam = new THREE.Mesh(beamGeom, this.steelBeamMaterial);
      beam.position.set(bx, this.deckY - deckThickness - 0.6, 0);
      beam.castShadow = true;
      bridge.add(beam);
    }

    // ========================================================
    // 3. SAFETY BARRIERS & RAILINGS (Main Span)
    // ========================================================
    // Center Median Jersey Barrier (dividing eastbound & westbound lanes)
    const medianGeom = new THREE.BoxGeometry(mainSpanLen, 0.95, 0.6);
    const median = new THREE.Mesh(medianGeom, this.barrierMaterial);
    median.position.set((this.westSpanX + this.eastSpanX) * 0.5, this.deckY + 0.48, 0);
    median.castShadow = true;
    bridge.add(median);

    // Outer crash barriers and safety railings
    [-1, 1].forEach((side) => {
      const edgeZ = side * (this.deckWidth * 0.5 - 0.35);

      // Concrete crash barrier
      const barrierGeom = new THREE.BoxGeometry(mainSpanLen, 1.1, 0.45);
      const barrier = new THREE.Mesh(barrierGeom, this.barrierMaterial);
      barrier.position.set((this.westSpanX + this.eastSpanX) * 0.5, this.deckY + 0.55, edgeZ);
      barrier.castShadow = true;
      bridge.add(barrier);

      // Steel safety railing on top
      const railGeom = new THREE.BoxGeometry(mainSpanLen, 0.1, 0.1);
      const rail = new THREE.Mesh(railGeom, this.steelBeamMaterial);
      rail.position.set((this.westSpanX + this.eastSpanX) * 0.5, this.deckY + 1.25, edgeZ);
      bridge.add(rail);
    });

    // ========================================================
    // 4. TWIN SUSPENSION TOWERS (Pylons at X = -155 and X = -45)
    // ========================================================
    const towerXCoords = [-155, -45];
    const towerHeight = 75.0; // Y = 75m high

    towerXCoords.forEach((tx) => {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(tx, 0, 0);

      // Deep foundation pier caisson in riverbed
      const pierGeom = new THREE.BoxGeometry(16, 26, this.deckWidth + 10);
      const pier = new THREE.Mesh(pierGeom, this.concreteMaterial);
      pier.position.set(0, 1.0, 0);
      pier.castShadow = true;
      pier.receiveShadow = true;
      towerGroup.add(pier);

      // Two tapered vertical tower legs
      [-1, 1].forEach((legSide) => {
        const legGeom = new THREE.BoxGeometry(4.2, towerHeight - 12, 4.2);
        const leg = new THREE.Mesh(legGeom, this.steelPylonMaterial);
        leg.position.set(0, 12 + (towerHeight - 12) * 0.5, legSide * (this.deckWidth * 0.5 + 1.8));
        leg.castShadow = true;
        towerGroup.add(leg);

        // Flashing red aviation warning beacon on top
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), this.beaconMaterial);
        beacon.position.set(0, towerHeight + 0.5, legSide * (this.deckWidth * 0.5 + 1.8));
        towerGroup.add(beacon);
      });

      // Horizontal cross-struts (Portal Bracing at 3 levels)
      [this.deckY - 1.5, this.deckY + 22, towerHeight - 4].forEach((sy) => {
        const strutGeom = new THREE.BoxGeometry(3.6, 2.8, this.deckWidth + 6);
        const strut = new THREE.Mesh(strutGeom, this.steelPylonMaterial);
        strut.position.set(0, sy, 0);
        strut.castShadow = true;
        towerGroup.add(strut);
      });

      bridge.add(towerGroup);
    });

    // ========================================================
    // 5. MAIN SUSPENSION CATENARY CABLES & SUSPENDERS
    // ========================================================
    [-1, 1].forEach((cableSide) => {
      const zOffset = cableSide * (this.deckWidth * 0.5 + 1.8);
      const points = [
        new THREE.Vector3(this.westAbutmentX + 10, this.deckY, zOffset), // West Anchor
        new THREE.Vector3(towerXCoords[0], towerHeight - 2, zOffset),    // West Tower Top
        new THREE.Vector3((towerXCoords[0] + towerXCoords[1]) * 0.5, this.deckY + 2.8, zOffset), // Center Sag
        new THREE.Vector3(towerXCoords[1], towerHeight - 2, zOffset),    // East Tower Top
        new THREE.Vector3(this.eastAbutmentX - 10, this.deckY, zOffset)  // East Anchor
      ];

      const curve = new THREE.CatmullRomCurve3(points);
      const cableGeom = new THREE.TubeGeometry(curve, 64, 0.42, 8, false);
      const mainCable = new THREE.Mesh(cableGeom, this.steelPylonMaterial);
      mainCable.castShadow = true;
      bridge.add(mainCable);

      // Vertical Suspender Wire Cables (every 6 meters between towers)
      for (let x = towerXCoords[0] + 6; x < towerXCoords[1]; x += 6) {
        const t = (x - (this.westAbutmentX + 10)) / ((this.eastAbutmentX - 10) - (this.westAbutmentX + 10));
        const pt = curve.getPointAt(Math.max(0, Math.min(1, t)));
        const hangerH = Math.max(1.0, pt.y - this.deckY);

        const hangerGeom = new THREE.CylinderGeometry(0.08, 0.08, hangerH, 6);
        const hanger = new THREE.Mesh(hangerGeom, this.cableMaterial);
        hanger.position.set(x, this.deckY + hangerH * 0.5, zOffset);
        bridge.add(hanger);
      }
    });

    // ========================================================
    // 6. WEST APPROACH VIADUCT & RAMP (X: -280 to -200)
    // Connects seamlessly to the West Industrial Highway grid at ground level
    // ========================================================
    const westGroundH = this.terrain.getHeight(this.westAbutmentX, 0) + 0.18;

    // Sloping Deck Box
    const westRampGroup = this.createEngineeredRamp(
      this.westAbutmentX, westGroundH,
      this.westSpanX, this.deckY,
      this.deckWidth, deckThickness
    );
    bridge.add(westRampGroup);

    // Heavy Concrete Abutment Retaining Block at X = -280
    const westAbutGeom = new THREE.BoxGeometry(10, 10, this.deckWidth + 4);
    const westAbut = new THREE.Mesh(westAbutGeom, this.concreteMaterial);
    westAbut.position.set(this.westAbutmentX - 3, westGroundH - 3, 0);
    westAbut.castShadow = true;
    westAbut.receiveShadow = true;
    bridge.add(westAbut);

    // Concrete Support Double-Piers under West Ramp
    for (let cx = this.westAbutmentX + 25; cx < this.westSpanX - 10; cx += 25) {
      const rampH = this.getBridgeHeight(cx, 0) - deckThickness;
      const groundH = this.terrain.getHeight(cx, 0);
      const pierH = Math.max(2.0, rampH - groundH);

      const pierGeom = new THREE.CylinderGeometry(1.6, 2.0, pierH, 12);
      const pier = new THREE.Mesh(pierGeom, this.concreteMaterial);
      pier.position.set(cx, groundH + pierH * 0.5, 0);
      pier.castShadow = true;
      pier.receiveShadow = true;
      bridge.add(pier);
    }

    // ========================================================
    // 7. EAST APPROACH VIADUCT & RAMP (X: 0 to 90)
    // Connects seamlessly into Grand Downtown Boulevard at X = 90
    // ========================================================
    const eastGroundH = this.terrain.getHeight(this.eastAbutmentX, 0) + 0.18;

    const eastRampGroup = this.createEngineeredRamp(
      this.eastSpanX, this.deckY,
      this.eastAbutmentX, eastGroundH,
      this.deckWidth, deckThickness
    );
    bridge.add(eastRampGroup);

    // Heavy Concrete Abutment Retaining Block at X = 90
    const eastAbutGeom = new THREE.BoxGeometry(10, 10, this.deckWidth + 4);
    const eastAbut = new THREE.Mesh(eastAbutGeom, this.concreteMaterial);
    eastAbut.position.set(this.eastAbutmentX + 3, eastGroundH - 3, 0);
    eastAbut.castShadow = true;
    eastAbut.receiveShadow = true;
    bridge.add(eastAbut);

    // Concrete Support Double-Piers under East Ramp
    for (let cx = this.eastSpanX + 25; cx < this.eastAbutmentX - 10; cx += 25) {
      const rampH = this.getBridgeHeight(cx, 0) - deckThickness;
      const groundH = this.terrain.getHeight(cx, 0);
      const pierH = Math.max(2.0, rampH - groundH);

      const pierGeom = new THREE.CylinderGeometry(1.6, 2.0, pierH, 12);
      const pier = new THREE.Mesh(pierGeom, this.concreteMaterial);
      pier.position.set(cx, groundH + pierH * 0.5, 0);
      pier.castShadow = true;
      pier.receiveShadow = true;
      bridge.add(pier);
    }

    return bridge;
  }

  /**
   * Helper to build a physically accurate sloping viaduct ramp with asphalt surface and barriers
   */
  createEngineeredRamp(x1, y1, x2, y2, width, thickness) {
    const group = new THREE.Group();
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // 1. Concrete Deck Structure
    const deckGeom = new THREE.BoxGeometry(length, thickness, width);
    const deckMesh = new THREE.Mesh(deckGeom, this.concreteMaterial);
    deckMesh.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5 - thickness * 0.5, 0);
    deckMesh.rotation.z = angle;
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    group.add(deckMesh);

    // 2. Asphalt Highway Surface
    const roadGeom = new THREE.PlaneGeometry(width, length);
    roadGeom.rotateX(-Math.PI / 2);
    roadGeom.rotateY(Math.PI / 2);
    const roadMesh = new THREE.Mesh(roadGeom, this.deckMaterial);
    roadMesh.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5 + 0.03, 0);
    roadMesh.rotation.z = angle;
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // 3. Center Median Barrier
    const medianGeom = new THREE.BoxGeometry(length, 0.9, 0.55);
    const median = new THREE.Mesh(medianGeom, this.barrierMaterial);
    median.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5 + 0.45, 0);
    median.rotation.z = angle;
    median.castShadow = true;
    group.add(median);

    // 4. Outer Barriers
    [-1, 1].forEach((side) => {
      const barrierGeom = new THREE.BoxGeometry(length, 1.1, 0.45);
      const barrier = new THREE.Mesh(barrierGeom, this.barrierMaterial);
      barrier.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5 + 0.55, side * (width * 0.5 - 0.35));
      barrier.rotation.z = angle;
      barrier.castShadow = true;
      group.add(barrier);
    });

    return group;
  }
}
