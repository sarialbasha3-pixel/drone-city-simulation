import * as THREE from 'three';
import { ProceduralTextures } from '../utils/ProceduralTextures.js';

/**
 * RoadNetwork - Generates a realistic, intentionally designed urban road infrastructure.
 * Eliminates repetitive square grids by using sweeping curved coastal highways,
 * a central multi-lane roundabout, organic residential streets and cul-de-sacs,
 * industrial logistics loops, and winding hillside mountain switchbacks.
 *
 * Details include:
 * - PBR asphalt with aggregate noise and tire wear
 * - Pedestrian zebra crosswalks, stop lines, and lane dividers
 * - Concrete curbs with bevels and flagstone sidewalks
 * - Crash barriers and guardrails along bridges and hill drop-offs
 * - Waypoint paths exported for dynamic moving traffic
 */
export class RoadNetwork {
  constructor(terrain) {
    this.terrain = terrain;
    this.roadSegments = [];
    this.intersectionPoints = [];
    this.trafficRoutes = []; // Array of waypoint arrays for moving ambient vehicles
    this.materials = {};
    this.initMaterials();
  }

  initMaterials() {
    const bumpMap = ProceduralTextures.getAsphaltBumpTexture();
    const roughnessMap = ProceduralTextures.getAsphaltRoughnessTexture();

    this.materials.urbanRoad = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getRoadTexture(),
      bumpMap: bumpMap,
      bumpScale: 0.035,
      roughnessMap: roughnessMap,
      roughness: 0.88,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0
    });

    this.materials.avenue = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getAvenueTexture(),
      bumpMap: bumpMap,
      bumpScale: 0.035,
      roughnessMap: roughnessMap,
      roughness: 0.85,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0
    });

    this.materials.highway = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getHighwayTexture(),
      bumpMap: bumpMap,
      bumpScale: 0.04,
      roughnessMap: roughnessMap,
      roughness: 0.82,
      metalness: 0.12,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0
    });

    this.materials.intersection = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getIntersectionTexture(),
      bumpMap: bumpMap,
      bumpScale: 0.03,
      roughnessMap: roughnessMap,
      roughness: 0.88,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1.5,
      polygonOffsetUnits: -1.5
    });

    this.materials.roundabout = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getRoundaboutTexture(),
      bumpMap: bumpMap,
      bumpScale: 0.035,
      roughnessMap: roughnessMap,
      roughness: 0.85,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1.2,
      polygonOffsetUnits: -1.2
    });

    this.materials.sidewalk = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getSidewalkTexture(),
      roughness: 0.9,
      metalness: 0.05
    });

    this.materials.curb = new THREE.MeshStandardMaterial({
      color: 0x909498,
      roughness: 0.82,
      metalness: 0.08
    });

    this.materials.guardrail = new THREE.MeshStandardMaterial({
      color: 0xb8bcc0,
      roughness: 0.35,
      metalness: 0.82
    });
  }

  /**
   * Generates a road strip following terrain between two points
   */
  createRoadSegment(p1, p2, width = 14, roadType = 'urbanRoad', hasSidewalks = true, hasGuardrail = false) {
    const group = new THREE.Group();
    const dir = new THREE.Vector2(p2.x - p1.x, p2.z - p1.z);
    const length = dir.length();
    if (length < 1) return group;

    const angle = Math.atan2(dir.y, dir.x);
    const normal = new THREE.Vector2(-Math.sin(angle), Math.cos(angle));

    const numSteps = Math.max(2, Math.ceil(length / 10));
    const geom = new THREE.PlaneGeometry(width, length, 2, numSteps);
    geom.rotateX(-Math.PI / 2);
    geom.rotateY(-angle + Math.PI / 2);

    const pos = geom.attributes.position;
    const halfW = width * 0.5;

    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const midX = p1.x + dir.x * t;
      const midZ = p1.z + dir.y * t;
      const baseH = this.terrain.getHeight(midX, midZ) + 0.14;

      const lx = midX - normal.x * halfW;
      const lz = midZ - normal.y * halfW;
      const lh = this.terrain.getHeight(lx, lz) + 0.14;

      const rx = midX + normal.x * halfW;
      const rz = midZ + normal.y * halfW;
      const rh = this.terrain.getHeight(rx, rz) + 0.14;

      pos.setXYZ(i * 3, lx, lh, lz);
      pos.setXYZ(i * 3 + 1, midX, baseH, midZ);
      pos.setXYZ(i * 3 + 2, rx, rh, rz);
    }

    geom.computeVertexNormals();

    const roadMesh = new THREE.Mesh(geom, this.materials[roadType] || this.materials.urbanRoad);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // Sidewalks on both sides if requested
    if (hasSidewalks) {
      const sidewalkW = 3.2;
      const curbH = 0.18;

      [-1, 1].forEach((side) => {
        const swGeom = new THREE.PlaneGeometry(sidewalkW, length, 1, numSteps);
        swGeom.rotateX(-Math.PI / 2);
        const swPos = swGeom.attributes.position;

        for (let i = 0; i <= numSteps; i++) {
          const t = i / numSteps;
          const midX = p1.x + dir.x * t;
          const midZ = p1.z + dir.y * t;

          const inX = midX + normal.x * (halfW * side);
          const inZ = midZ + normal.y * (halfW * side);
          const inH = this.terrain.getHeight(inX, inZ) + curbH;

          const outX = midX + normal.x * ((halfW + sidewalkW) * side);
          const outZ = midZ + normal.y * ((halfW + sidewalkW) * side);
          const outH = this.terrain.getHeight(outX, outZ) + curbH;

          swPos.setXYZ(i * 2, inX, inH, inZ);
          swPos.setXYZ(i * 2 + 1, outX, outH, outZ);
        }
        swGeom.computeVertexNormals();
        const swMesh = new THREE.Mesh(swGeom, this.materials.sidewalk);
        swMesh.receiveShadow = true;
        group.add(swMesh);
      });
    }

    // Guardrail along edge if requested (for hills or highway drops)
    if (hasGuardrail) {
      [-1, 1].forEach((side) => {
        const railGeom = new THREE.BoxGeometry(0.3, 0.9, length);
        railGeom.rotateY(-angle + Math.PI / 2);
        const rail = new THREE.Mesh(railGeom, this.materials.guardrail);
        const midH = this.terrain.getHeight((p1.x + p2.x) * 0.5, (p1.z + p2.z) * 0.5) + 0.6;
        rail.position.set(
          (p1.x + p2.x) * 0.5 + normal.x * (halfW * side),
          midH,
          (p1.z + p2.z) * 0.5 + normal.y * (halfW * side)
        );
        rail.castShadow = true;
        group.add(rail);
      });
    }

    return group;
  }

  /**
   * Generates a smooth, curved multi-waypoint road spline hugging terrain
   */
  createCurvedRoad(waypoints, width = 14, roadType = 'urbanRoad', hasSidewalks = false, hasGuardrail = false) {
    const group = new THREE.Group();
    if (waypoints.length < 2) return group;

    const curve = new THREE.CatmullRomCurve3(waypoints);
    const numPoints = waypoints.length * 8;
    const sampledPoints = curve.getPoints(numPoints);

    for (let i = 0; i < sampledPoints.length - 1; i++) {
      const p1 = sampledPoints[i];
      const p2 = sampledPoints[i + 1];
      group.add(this.createRoadSegment(p1, p2, width, roadType, hasSidewalks, hasGuardrail));
    }

    return group;
  }

  /**
   * Generates a circular multi-lane roundabout with center landscaped island
   */
  createRoundabout(x, z, diameter = 48) {
    const group = new THREE.Group();
    const geom = new THREE.PlaneGeometry(diameter, diameter);
    geom.rotateX(-Math.PI / 2);

    const h = this.terrain.getHeight(x, z) + 0.16;
    const mesh = new THREE.Mesh(geom, this.materials.roundabout);
    mesh.position.set(x, h, z);
    mesh.receiveShadow = true;
    group.add(mesh);

    // Raised landscaped center island
    const islandRadius = diameter * 0.16;
    const islandCurbGeom = new THREE.CylinderGeometry(islandRadius, islandRadius + 0.4, 0.45, 24);
    const islandCurb = new THREE.Mesh(islandCurbGeom, this.materials.curb);
    islandCurb.position.set(x, h + 0.22, z);
    islandCurb.castShadow = true;
    group.add(islandCurb);

    // Center decorative monument / obelisk
    const obeliskGeom = new THREE.CylinderGeometry(0.8, 1.4, 8.0, 8);
    const obeliskMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.3, metalness: 0.6 });
    const obelisk = new THREE.Mesh(obeliskGeom, obeliskMat);
    obelisk.position.set(x, h + 4.25, z);
    obelisk.castShadow = true;
    group.add(obelisk);

    this.intersectionPoints.push(new THREE.Vector3(x, h, z));
    return group;
  }

  /**
   * 4-Way or T-Junction Intersection Square with crosswalk zebra markings
   */
  createIntersection(x, z, size = 18) {
    const geom = new THREE.PlaneGeometry(size, size);
    geom.rotateX(-Math.PI / 2);

    const h = this.terrain.getHeight(x, z) + 0.16;
    const mesh = new THREE.Mesh(geom, this.materials.intersection);
    mesh.position.set(x, h, z);
    mesh.receiveShadow = true;

    this.intersectionPoints.push(new THREE.Vector3(x, h, z));
    return mesh;
  }

  /**
   * Builds the comprehensive city-wide road network with natural layout
   */
  buildCityNetwork() {
    const root = new THREE.Group();
    root.name = 'road_network';

    // ========================================================
    // 1. CENTRAL MULTI-LANE ROUNDABOUT (X: 250, Z: 0)
    // ========================================================
    const roundaboutCenter = new THREE.Vector3(250, 0, 0);
    root.add(this.createRoundabout(roundaboutCenter.x, roundaboutCenter.z, 56));

    // ========================================================
    // 2. GRAND DOWNTOWN BOULEVARD (4-Lane with Landscaped Median)
    // ========================================================
    // Connects from the Bay Bridge East exit ramp (X: 90, Z: 0) directly east to Roundabout (X: 250, Z: 0)
    // and continues east to the commercial border (X: 470, Z: 0)
    root.add(this.createRoadSegment(
      new THREE.Vector3(90, 0, 0),
      new THREE.Vector3(220, 0, 0),
      22, 'avenue', true, false
    ));

    root.add(this.createRoadSegment(
      new THREE.Vector3(280, 0, 0),
      new THREE.Vector3(480, 0, 0),
      22, 'avenue', true, false
    ));

    // North-South Boulevard from Roundabout
    root.add(this.createRoadSegment(
      new THREE.Vector3(250, 0, -250),
      new THREE.Vector3(250, 0, -30),
      20, 'avenue', true, false
    ));

    root.add(this.createRoadSegment(
      new THREE.Vector3(250, 0, 30),
      new THREE.Vector3(250, 0, 250),
      20, 'avenue', true, false
    ));

    // ========================================================
    // 3. SWEEPING CURVED COASTAL HIGHWAY (X: 20 to 35, Z: -720 to +720)
    // ========================================================
    // Follows the shoreline with gentle curves and protective guardrails
    const coastalWaypoints = [
      new THREE.Vector3(22, 0, -720),
      new THREE.Vector3(20, 0, -500),
      new THREE.Vector3(28, 0, -280),
      new THREE.Vector3(30, 0, -60),
      new THREE.Vector3(25, 0, 140),
      new THREE.Vector3(32, 0, 380),
      new THREE.Vector3(20, 0, 560),
      new THREE.Vector3(24, 0, 720)
    ];
    root.add(this.createCurvedRoad(coastalWaypoints, 20, 'highway', true, true));

    // ========================================================
    // 4. DOWNTOWN ASTERISK & CROSS ARTERIALS
    // ========================================================
    const dtAvenuesX = [120, 380];
    dtAvenuesX.forEach((x) => {
      root.add(this.createRoadSegment(
        new THREE.Vector3(x, 0, -240),
        new THREE.Vector3(x, 0, 240),
        16, 'urbanRoad', true, false
      ));
    });

    [-160, 160].forEach((z) => {
      root.add(this.createRoadSegment(
        new THREE.Vector3(30, 0, z),
        new THREE.Vector3(470, 0, z),
        16, 'urbanRoad', true, false
      ));
    });

    // Intersections at cross junctions
    dtAvenuesX.forEach((x) => {
      [-160, 0, 160].forEach((z) => {
        if (z !== 0 || x !== 250) {
          root.add(this.createIntersection(x, z, 18));
        }
      });
    });

    // ========================================================
    // 5. WINDING HILLSIDE SCENIC HIGHWAY (Western Peaks Pass)
    // ========================================================
    // Sweeps up the mountain slopes with realistic switchbacks and metal guardrails
    const mountainSwitchbacks = [
      new THREE.Vector3(-190, 0, -40),
      new THREE.Vector3(-250, 0, -100),
      new THREE.Vector3(-310, 0, -140),
      new THREE.Vector3(-380, 0, -220),
      new THREE.Vector3(-340, 0, -320), // Sharp mountain hairpin turn
      new THREE.Vector3(-440, 0, -390),
      new THREE.Vector3(-520, 0, -460),
      new THREE.Vector3(-600, 0, -540),
      new THREE.Vector3(-660, 0, -640)  // High mountain scenic lookout
    ];
    root.add(this.createCurvedRoad(mountainSwitchbacks, 12, 'urbanRoad', false, true));

    // ========================================================
    // 6. RESIDENTIAL DISTRICT WINDING NEIGHBORHOOD ROADS & CUL-DE-SACS
    // ========================================================
    // Organic neighborhood streets with branching T-intersections and cul-de-sacs
    [-340, -480, -620].forEach((z) => {
      root.add(this.createRoadSegment(
        new THREE.Vector3(30, 0, z),
        new THREE.Vector3(460, 0, z),
        12, 'urbanRoad', true, false
      ));
    });

    // Curved residential connector
    const resCurveWaypoints = [
      new THREE.Vector3(120, 0, -240),
      new THREE.Vector3(140, 0, -400),
      new THREE.Vector3(110, 0, -540),
      new THREE.Vector3(130, 0, -680)
    ];
    root.add(this.createCurvedRoad(resCurveWaypoints, 12, 'urbanRoad', true, false));

    const resCurveWaypoints2 = [
      new THREE.Vector3(340, 0, -240),
      new THREE.Vector3(360, 0, -400),
      new THREE.Vector3(320, 0, -550),
      new THREE.Vector3(350, 0, -680)
    ];
    root.add(this.createCurvedRoad(resCurveWaypoints2, 12, 'urbanRoad', true, false));

    // Cul-de-sac turnaround stubs
    [
      { x: 440, z: -340 },
      { x: 440, z: -480 },
      { x: 440, z: -620 }
    ].forEach((cds) => {
      root.add(this.createIntersection(cds.x, cds.z, 20));
    });

    // ========================================================
    // 7. COMMERCIAL DISTRICT RING ROAD & SERVICE LANES
    // ========================================================
    [360, 520, 660].forEach((z) => {
      root.add(this.createRoadSegment(
        new THREE.Vector3(30, 0, z),
        new THREE.Vector3(460, 0, z),
        16, 'urbanRoad', true, false
      ));
    });

    [130, 360].forEach((x) => {
      root.add(this.createRoadSegment(
        new THREE.Vector3(x, 0, 240),
        new THREE.Vector3(x, 0, 680),
        16, 'urbanRoad', true, false
      ));
    });

    // Commercial intersections
    [130, 360].forEach((x) => {
      [360, 520, 660].forEach((z) => {
        root.add(this.createIntersection(x, z, 18));
      });
    });

    // ========================================================
    // 8. INDUSTRIAL LOGISTICS CORRIDORS (West Bank: X: -650 to -200, Z: 60 to 660)
    // ========================================================
    [-580, -420, -260].forEach((x) => {
      root.add(this.createRoadSegment(
        new THREE.Vector3(x, 0, 60),
        new THREE.Vector3(x, 0, 650),
        18, 'highway', false, false
      ));
    });

    [120, 280, 440, 600].forEach((z) => {
      root.add(this.createRoadSegment(
        new THREE.Vector3(-620, 0, z),
        new THREE.Vector3(-220, 0, z),
        18, 'highway', false, false
      ));
    });

    // Connects from the Bay Bridge West ramp (X: -280, Z: 0) directly west through industrial district
    root.add(this.createRoadSegment(
      new THREE.Vector3(-280, 0, 0),
      new THREE.Vector3(-620, 0, 0),
      20, 'highway', false, true
    ));

    // North-South connecting stub linking bridge exit to industrial grid
    root.add(this.createRoadSegment(
      new THREE.Vector3(-280, 0, 0),
      new THREE.Vector3(-280, 0, 140),
      16, 'highway', false, false
    ));

    // ========================================================
    // 9. EXPORT STRICT ROAD-BOUND TRAFFIC ROUTES
    // Every waypoint is strictly on road asphalt in a closed loop with lane offsets
    // ========================================================
    // Route 1: Grand Downtown Boulevard & Roundabout Loop (Right-Hand Driving)
    // Eastbound on South lane (Z = +4.5), around Roundabout, Westbound on North lane (Z = -4.5)
    this.trafficRoutes.push([
      new THREE.Vector3(98, 0, 4.5),
      new THREE.Vector3(150, 0, 4.5),
      new THREE.Vector3(210, 0, 4.5),
      new THREE.Vector3(232, 0, 16.0), // Enter Roundabout SE quadrant
      new THREE.Vector3(250, 0, 20.0), // South quadrant
      new THREE.Vector3(268, 0, 10.0), // SE quadrant
      new THREE.Vector3(270, 0, -4.0), // East quadrant
      new THREE.Vector3(258, 0, -18.0), // NE quadrant
      new THREE.Vector3(240, 0, -20.0), // North quadrant
      new THREE.Vector3(228, 0, -14.0), // NW exit towards west boulevard
      new THREE.Vector3(210, 0, -4.5), // Westbound North lane
      new THREE.Vector3(150, 0, -4.5),
      new THREE.Vector3(98, 0, -4.5),
      new THREE.Vector3(94, 0, 0)      // U-turn arc on bridge entrance plaza back to South lane
    ]);

    // Route 2: Great Bay Bridge Cross-Channel Highway & Industrial Loop
    // Vehicles elevate onto bridge deck (Y = 22m), drive across bay, and return
    this.trafficRoutes.push([
      // Westbound across bridge (North lane Z = -4.5)
      new THREE.Vector3(85, 0, -4.5),   // East approach ramp entrance
      new THREE.Vector3(40, 0, -4.5),   // Climbing ramp
      new THREE.Vector3(-10, 0, -4.5),  // Reaching deck
      new THREE.Vector3(-100, 0, -4.5), // Center span
      new THREE.Vector3(-190, 0, -4.5), // Approaching west tower
      new THREE.Vector3(-240, 0, -4.5), // West approach ramp descending
      new THREE.Vector3(-285, 0, -4.5), // West abutment landing
      new THREE.Vector3(-340, 0, -4.5), // West industrial connector
      new THREE.Vector3(-380, 0, 0),    // Industrial turnaround curve
      new THREE.Vector3(-340, 0, 4.5),  // Heading back east
      new THREE.Vector3(-285, 0, 4.5),  // West approach ramp start
      new THREE.Vector3(-240, 0, 4.5),  // Climbing west ramp
      new THREE.Vector3(-190, 0, 4.5),  // Reaching deck
      new THREE.Vector3(-100, 0, 4.5), // Center span
      new THREE.Vector3(-10, 0, 4.5),  // Approaching east span
      new THREE.Vector3(40, 0, 4.5),   // Descending east ramp
      new THREE.Vector3(85, 0, 4.5),   // East plaza landing
      new THREE.Vector3(92, 0, 0)      // Turnaround arc back to westbound lane
    ]);

    // Route 3: Coastal Highway Divided Lanes Loop (Northbound lane X=28, Southbound lane X=20)
    this.trafficRoutes.push([
      // Northbound
      new THREE.Vector3(26, 0, -680),
      new THREE.Vector3(24, 0, -450),
      new THREE.Vector3(30, 0, -150),
      new THREE.Vector3(32, 0, 50),
      new THREE.Vector3(28, 0, 350),
      new THREE.Vector3(24, 0, 680),
      // Northern turnaround loop
      new THREE.Vector3(20, 0, 695),
      new THREE.Vector3(17, 0, 680),
      // Southbound
      new THREE.Vector3(20, 0, 350),
      new THREE.Vector3(24, 0, 50),
      new THREE.Vector3(22, 0, -150),
      new THREE.Vector3(16, 0, -450),
      new THREE.Vector3(18, 0, -680),
      // Southern turnaround loop
      new THREE.Vector3(22, 0, -695)
    ]);

    // Route 4: Downtown Avenue Grid Loop (X = 120 and X = 380, Z = -160 and Z = 160)
    this.trafficRoutes.push([
      new THREE.Vector3(124, 0, -150),
      new THREE.Vector3(124, 0, 0),
      new THREE.Vector3(124, 0, 150),
      new THREE.Vector3(135, 0, 164),
      new THREE.Vector3(250, 0, 164),
      new THREE.Vector3(370, 0, 164),
      new THREE.Vector3(376, 0, 150),
      new THREE.Vector3(376, 0, 0),
      new THREE.Vector3(376, 0, -150),
      new THREE.Vector3(365, 0, -164),
      new THREE.Vector3(250, 0, -164),
      new THREE.Vector3(135, 0, -164)
    ]);

    // Route 5: Industrial Port Logistics Loop (West of bay)
    this.trafficRoutes.push([
      new THREE.Vector3(-264, 0, 80),
      new THREE.Vector3(-264, 0, 420),
      new THREE.Vector3(-275, 0, 436),
      new THREE.Vector3(-415, 0, 436),
      new THREE.Vector3(-424, 0, 420),
      new THREE.Vector3(-424, 0, 80),
      new THREE.Vector3(-415, 0, 64),
      new THREE.Vector3(-275, 0, 64)
    ]);

    return root;
  }
}

