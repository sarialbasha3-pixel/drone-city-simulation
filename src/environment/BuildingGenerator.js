import * as THREE from 'three';
import { ProceduralTextures } from '../utils/ProceduralTextures.js';
import { MaterialManager } from '../materials/MaterialManager.js';
import { AssetManager } from '../materials/AssetManager.js';

/**
 * BuildingGenerator - Comprehensive library of diverse architectural typologies.
 * Eliminates repetitive boxes by providing realistic skyscrapers, residential homes,
 * courtyard apartments, townhouses, industrial plants, logistics hubs, shopping malls,
 * parking garages, and hillside villas with detailed rooftops and PBR materials.
 */
export class BuildingGenerator {
  constructor(terrain) {
    this.terrain = terrain;
    this.materials = {};
    this.initMaterials();
  }

  initMaterials() {
    // Glass Skyscraper Curtain Walls
    this.materials.glassBlue = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getGlassTowerTexture('blue'),
      roughness: 0.18,
      metalness: 0.85
    });

    this.materials.glassGold = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getGlassTowerTexture('gold'),
      roughness: 0.22,
      metalness: 0.8
    });

    this.materials.glassDark = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getGlassTowerTexture('dark'),
      roughness: 0.25,
      metalness: 0.78
    });

    // Commercial & Retail Facades with PBR Plaster / Moldings
    this.materials.commercial = MaterialManager.getPlasterFacadeMaterial({
      repeatX: 3,
      repeatY: 3,
      color: 0xe8e6e1
    });

    // Residential Apartment Facades with PBR Objects / Windows / Metal
    this.materials.residential = MaterialManager.getApartmentFacadeMaterial({
      repeatX: 3,
      repeatY: 3
    });

    // PBR Stacked Brick Walls (Tan / Buff variant)
    this.materials.brickTan = MaterialManager.getBrickMaterial({
      repeatX: 4,
      repeatY: 4,
      color: 0xcdbca8
    });

    // PBR Stacked Brick Walls (Red Clay variant)
    this.materials.brickRed = MaterialManager.getBrickMaterial({
      repeatX: 4,
      repeatY: 4,
      color: 0x9b4d3f
    });

    // PBR Fine Plaster / White Stucco
    this.materials.whiteStucco = MaterialManager.getPlasterFacadeMaterial({
      repeatX: 3,
      repeatY: 3,
      color: 0xf5f3ee
    });

    // Industrial Corrugated Metal & Steel Siding
    this.materials.industrial = MaterialManager.getIndustrialMetalMaterial({
      repeatX: 3,
      repeatY: 3
    });

    // Roof Textures (PBR Asphalt / Tar Gravel)
    this.materials.roofStandard = MaterialManager.getRoofAsphaltMaterial({
      repeatX: 4,
      repeatY: 4
    });

    this.materials.roofHelipad = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getRoofTexture(true),
      roughness: 0.85,
      metalness: 0.15
    });

    this.materials.terracottaRoof = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getTerracottaRoofTexture(),
      roughness: 0.82,
      metalness: 0.08
    });

    this.materials.shingleRoof = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getAsphaltShingleTexture(),
      roughness: 0.92,
      metalness: 0.05
    });

    this.materials.woodFacade = new THREE.MeshStandardMaterial({
      map: ProceduralTextures.getModernWoodFacadeTexture(),
      roughness: 0.75,
      metalness: 0.05
    });

    // Structural Elements (PBR Concrete with aggregate relief)
    this.materials.concrete = MaterialManager.getConcreteMaterial({
      repeatX: 2,
      repeatY: 2,
      color: 0xa5a8ad
    });

    this.materials.metalDetails = new THREE.MeshStandardMaterial({
      color: 0x37474f,
      roughness: 0.35,
      metalness: 0.8
    });

    this.materials.steelWhite = new THREE.MeshStandardMaterial({
      color: 0xe0e6ed,
      roughness: 0.4,
      metalness: 0.7
    });

    this.materials.antenna = new THREE.MeshStandardMaterial({
      color: 0xd32f2f,
      roughness: 0.3,
      metalness: 0.7
    });

    this.materials.beaconRed = new THREE.MeshBasicMaterial({ color: 0xff1744 });
  }

  /**
   * Adds realistic rooftop equipment (HVAC chillers, elevator motor rooms, cooling towers, antennas, water tanks, 3D solar panels)
   */
  addRooftopDetails(parent, roofWidth, roofDepth, roofY, hasHelipad = false) {
    if (hasHelipad && roofWidth >= 22 && roofDepth >= 22) {
      const heliGeom = new THREE.PlaneGeometry(22, 22);
      heliGeom.rotateX(-Math.PI / 2);
      const heli = new THREE.Mesh(heliGeom, this.materials.roofHelipad);
      heli.position.set(0, roofY + 0.1, 0);
      parent.add(heli);
      return;
    }

    // Elevator mechanical penthouse
    const pentW = roofWidth * 0.35;
    const pentD = roofDepth * 0.35;
    const pentH = 4.5;
    const pentGeom = new THREE.BoxGeometry(pentW, pentH, pentD);
    const pent = new THREE.Mesh(pentGeom, this.materials.concrete);
    pent.position.set(roofWidth * 0.18, roofY + pentH * 0.5, roofDepth * 0.15);
    pent.castShadow = true;
    parent.add(pent);

    // HVAC cooling unit cylinders and boxes with fan tops
    const hvacGeom = new THREE.BoxGeometry(pentW * 0.8, 2.8, 4.0);
    const hvac = new THREE.Mesh(hvacGeom, this.materials.metalDetails);
    hvac.position.set(-roofWidth * 0.2, roofY + 1.4, -roofDepth * 0.15);
    hvac.castShadow = true;
    parent.add(hvac);

    // Dual cylindrical cooling fans
    [-1.2, 1.2].forEach((fz) => {
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 12), this.materials.metalDetails);
      fan.position.set(-roofWidth * 0.2, roofY + 3.0, -roofDepth * 0.15 + fz);
      parent.add(fan);
    });

    // 3D Solar Panel Array on wide commercial/residential roofs
    if (!hasHelipad && roofWidth >= 24 && roofDepth >= 22) {
      const solarPos = new THREE.Vector3(0, roofY + 0.1, 0);
      AssetManager.createInstance('solar-panel-landscape-group.glb', solarPos, 0, 1.0).then((inst) => {
        if (inst) parent.add(inst);
      });
    }

    // 3D Rooftop Water Tower or Industrial Tank
    if (roofY > 35 && Math.random() < 0.5) {
      const wtPos = new THREE.Vector3(-roofWidth * 0.22, roofY, roofDepth * 0.22);
      AssetManager.createInstance('water-tower.glb', wtPos, 0, 0.85).then((inst) => {
        if (inst) parent.add(inst);
      });
    } else if (roofWidth > 18 && Math.random() < 0.4) {
      const tankPos = new THREE.Vector3(roofWidth * 0.22, roofY, -roofDepth * 0.22);
      AssetManager.createInstance('detail-tank.glb', tankPos, 0, 0.9).then((inst) => {
        if (inst) parent.add(inst);
      });
    }

    // Spire / Telecommunication mast with red hazard beacon
    if (roofY > 60) {
      const spireH = 16 + Math.random() * 14;
      const spireGeom = new THREE.CylinderGeometry(0.12, 0.55, spireH, 8);
      const spire = new THREE.Mesh(spireGeom, this.materials.antenna);
      spire.position.set(0, roofY + spireH * 0.5, 0);
      spire.castShadow = true;
      parent.add(spire);

      // Flashing red warning beacon at tip
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), this.materials.beaconRed);
      beacon.position.set(0, roofY + spireH, 0);
      parent.add(beacon);
    }
  }

  // =========================================================================
  // DOWNTOWN SKYSCRAPERS & HIGH-RISES
  // =========================================================================

  /**
   * 1. Super-Tall Diamond-Faceted Spire Skyscraper (Height: 180m - 220m)
   */
  createDiamondSpireSkyscraper(x, z, height = 195) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const w = 42;
    const d = 42;

    // Chamfered Octagonal / Diamond Tower Base (0 to 65% height)
    const baseTowerH = height * 0.65;
    const baseGeom = new THREE.CylinderGeometry(w * 0.42, w * 0.52, baseTowerH, 8);
    baseGeom.rotateY(Math.PI / 8);
    const baseMesh = new THREE.Mesh(baseGeom, this.materials.glassBlue);
    baseMesh.position.set(0, baseTowerH * 0.5, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Tapered Upper Spire Shaft (65% to 90% height)
    const upperH = height * 0.25;
    const upperGeom = new THREE.CylinderGeometry(w * 0.18, w * 0.42, upperH, 8);
    upperGeom.rotateY(Math.PI / 8);
    const upperMesh = new THREE.Mesh(upperGeom, this.materials.glassBlue);
    upperMesh.position.set(0, baseTowerH + upperH * 0.5, 0);
    upperMesh.castShadow = true;
    group.add(upperMesh);

    // Crown Architectural Spire Needle (tip rises to total height)
    const needleH = height * 0.12;
    const needleGeom = new THREE.ConeGeometry(w * 0.12, needleH, 8);
    needleGeom.rotateY(Math.PI / 8);
    const needle = new THREE.Mesh(needleGeom, this.materials.metalDetails);
    needle.position.set(0, baseTowerH + upperH + needleH * 0.5, 0);
    needle.castShadow = true;
    group.add(needle);

    // Tip aviation beacon
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), this.materials.beaconRed);
    beacon.position.set(0, baseTowerH + upperH + needleH, 0);
    group.add(beacon);

    // Ground Entrance Plaza
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(w + 12, 1.2, d + 12), this.materials.concrete);
    plaza.position.set(0, 0.6, 0);
    plaza.receiveShadow = true;
    group.add(plaza);

    return group;
  }

  /**
   * 2. Modern Curved Exoskeleton Tower (Height: 130m - 165m)
   */
  createTwistedExoskeletonTower(x, z, height = 145) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const w = 36;
    const d = 36;

    // Glass core
    const coreGeom = new THREE.BoxGeometry(w, height, d);
    const core = new THREE.Mesh(coreGeom, this.materials.glassDark);
    core.position.set(0, height * 0.5, 0);
    core.castShadow = true;
    core.receiveShadow = true;
    group.add(core);

    // External Diagonal Steel Exoskeleton Braces on all 4 faces
    const numBands = 8;
    const bandH = height / numBands;
    for (let b = 0; b < numBands; b++) {
      const by = b * bandH + bandH * 0.5;
      const diagGeom = new THREE.CylinderGeometry(0.45, 0.45, Math.hypot(w, bandH), 6);
      diagGeom.rotateZ(Math.atan2(bandH, w));

      // Front & Back diagonals
      [-d * 0.5 - 0.3, d * 0.5 + 0.3].forEach((faceZ) => {
        const d1 = new THREE.Mesh(diagGeom, this.materials.steelWhite);
        d1.position.set(0, by, faceZ);
        group.add(d1);
      });
    }

    this.addRooftopDetails(group, w, d, height, true);
    return group;
  }

  /**
   * 3. Stepped Art-Deco Skyscraper with Setbacks (Height: 110m - 150m)
   */
  createSteppedSkyscraper(x, z, baseHeight = 130) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const w1 = 40;
    const d1 = 40;
    const h1 = baseHeight * 0.5;

    const w2 = 30;
    const d2 = 30;
    const h2 = baseHeight * 0.3;

    const w3 = 20;
    const d3 = 20;
    const h3 = baseHeight * 0.2;

    const mat = Math.random() < 0.5 ? this.materials.glassBlue : this.materials.glassGold;

    // Tier 1 Base
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(w1, h1, d1), mat);
    m1.position.set(0, h1 * 0.5, 0);
    m1.castShadow = true;
    m1.receiveShadow = true;
    group.add(m1);

    // Tier 2 Middle
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), mat);
    m2.position.set(0, h1 + h2 * 0.5, 0);
    m2.castShadow = true;
    group.add(m2);

    // Tier 3 Top
    const m3 = new THREE.Mesh(new THREE.BoxGeometry(w3, h3, d3), mat);
    m3.position.set(0, h1 + h2 + h3 * 0.5, 0);
    m3.castShadow = true;
    group.add(m3);

    this.addRooftopDetails(group, w3, d3, h1 + h2 + h3, false);
    return group;
  }

  /**
   * 4. Elliptical / Cylindrical High-Rise Tower (Height: 90m - 130m)
   */
  createCylindricalTower(x, z, height = 110) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const radius = 19;
    const geom = new THREE.CylinderGeometry(radius * 0.92, radius, height, 24);
    const mat = Math.random() < 0.5 ? this.materials.glassBlue : this.materials.glassDark;

    const tower = new THREE.Mesh(geom, mat);
    tower.position.set(0, height * 0.5, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);

    this.addRooftopDetails(group, radius * 2, radius * 2, height, true);
    return group;
  }

  /**
   * 5. Double Towers with Mid-Air Skybridge (Height: 85m - 115m)
   */
  createTwinTowersWithSkybridge(x, z, height = 95) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const w = 24;
    const d = 24;
    const spacing = 32;

    // Tower A (West)
    const tA = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), this.materials.glassBlue);
    tA.position.set(-spacing * 0.5, height * 0.5, 0);
    tA.castShadow = true;
    tA.receiveShadow = true;
    group.add(tA);

    // Tower B (East)
    const tB = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), this.materials.glassBlue);
    tB.position.set(spacing * 0.5, height * 0.5, 0);
    tB.castShadow = true;
    tB.receiveShadow = true;
    group.add(tB);

    // Horizontal Glazed Skybridge connecting towers at 65% height
    const bridgeY = height * 0.65;
    const bridgeGeom = new THREE.BoxGeometry(spacing, 5.5, 6.5);
    const skybridge = new THREE.Mesh(bridgeGeom, this.materials.steelWhite);
    skybridge.position.set(0, bridgeY, 0);
    skybridge.castShadow = true;
    group.add(skybridge);

    this.addRooftopDetails(group, w, d, height, false);
    return group;
  }

  /**
   * 6. Classical Financial Plaza / Bank Headquarters (Height: 45m - 65m)
   */
  createFinancialPlazaHQ(x, z, height = 52) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const w = 44;
    const d = 36;

    // Stone facade body
    const bodyGeom = new THREE.BoxGeometry(w, height, d);
    const body = new THREE.Mesh(bodyGeom, this.materials.commercial);
    body.position.set(0, height * 0.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Colonnaded entrance portico
    const colH = 12;
    for (let cx = -w * 0.35; cx <= w * 0.35; cx += 7) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, colH, 12), this.materials.concrete);
      col.position.set(cx, colH * 0.5, d * 0.5 + 2.5);
      col.castShadow = true;
      group.add(col);
    }

    // Heavy classical pediment / entablature above colonnade
    const pediment = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 3.5, 6), this.materials.concrete);
    pediment.position.set(0, colH + 1.75, d * 0.5 + 2.5);
    pediment.castShadow = true;
    group.add(pediment);

    this.addRooftopDetails(group, w, d, height, false);
    return group;
  }

  // =========================================================================
  // RESIDENTIAL DISTRICT BUILDINGS
  // =========================================================================

  /**
   * 7. Detached Suburban House (1.5 - 2 Stories) with Pitched Gabled Roof & Chimney
   */
  createSuburbanHouse(x, z, rotation = 0) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);
    group.rotation.y = rotation;

    const w = 14;
    const d = 16;
    const wallH = 6.5;

    // Main House Box (Clad in stucco or wood siding)
    const houseMat = Math.random() < 0.5 ? this.materials.whiteStucco : this.materials.woodFacade;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), houseMat);
    walls.position.set(0, wallH * 0.5, 0);
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    // Pitched Gabled Roof
    const roofH = 4.2;
    const roofGeom = new THREE.ConeGeometry(Math.max(w, d) * 0.65, roofH, 4);
    roofGeom.rotateY(Math.PI / 4);
    roofGeom.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
    const roof = new THREE.Mesh(roofGeom, this.materials.shingleRoof);
    roof.position.set(0, wallH + roofH * 0.5, 0);
    roof.castShadow = true;
    group.add(roof);

    // Brick Chimney
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.5, 1.2), this.materials.brickRed);
    chimney.position.set(w * 0.28, wallH + 2.5, d * 0.2);
    chimney.castShadow = true;
    group.add(chimney);

    // Front Porch & Entrance Overhang
    const porch = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 2.5), this.materials.concrete);
    porch.position.set(0, 0.2, d * 0.5 + 1.25);
    porch.receiveShadow = true;
    group.add(porch);

    const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 2.8), this.materials.shingleRoof);
    porchRoof.position.set(0, 3.2, d * 0.5 + 1.4);
    porchRoof.castShadow = true;
    group.add(porchRoof);

    // Attached 1-Car Garage
    const garageW = 6.0;
    const garageH = 3.6;
    const garageD = 7.5;
    const garage = new THREE.Mesh(new THREE.BoxGeometry(garageW, garageH, garageD), houseMat);
    garage.position.set(w * 0.5 + garageW * 0.5, garageH * 0.5, -d * 0.15);
    garage.castShadow = true;
    group.add(garage);

    // Garage door
    const gDoor = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.8), this.materials.metalDetails);
    gDoor.position.set(w * 0.5 + garageW * 0.5, 1.4, -d * 0.15 + garageD * 0.5 + 0.05);
    group.add(gDoor);

    return group;
  }

  /**
   * 8. 3-Story Brownstone Urban Townhouse
   */
  createBrownstoneTownhouse(x, z, width = 20, depth = 18, height = 14) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    // Red/Brown brick facade
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.residential);
    body.position.set(0, height * 0.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Cornice Parapet along the roof edge
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.9, depth + 0.8), this.materials.concrete);
    cornice.position.set(0, height + 0.45, 0);
    cornice.castShadow = true;
    group.add(cornice);

    // Front Stone Stoop Entrance (stairs up to 1st floor)
    const stoop = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.6, 3.2), this.materials.concrete);
    stoop.position.set(-width * 0.22, 0.8, depth * 0.5 + 1.6);
    stoop.castShadow = true;
    stoop.receiveShadow = true;
    group.add(stoop);

    // Bay Windows (curved / protruding bay facade)
    const bay = new THREE.Mesh(new THREE.BoxGeometry(4.5, height * 0.65, 1.2), this.materials.whiteStucco);
    bay.position.set(width * 0.2, height * 0.45, depth * 0.5 + 0.6);
    bay.castShadow = true;
    group.add(bay);

    return group;
  }

  /**
   * 9. 5-Story Courtyard Apartment Complex
   */
  createCourtyardApartments(x, z, width = 36, depth = 28, height = 22) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    // Main U-shape or rectangular apartment hull
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.residential);
    body.position.set(0, height * 0.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Balconies with metal railings on floors 2, 3, 4, 5
    const floors = 5;
    for (let f = 1; f < floors; f++) {
      const by = f * 4.2;
      [-1, 1].forEach((side) => {
        [-width * 0.25, width * 0.25].forEach((bx) => {
          const balc = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.4), this.materials.metalDetails);
          balc.position.set(bx, by, side * (depth * 0.5 + 0.7));
          balc.castShadow = true;
          group.add(balc);
        });
      });
    }

    // Mansard roof cap
    const roofCap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 1.8, depth + 0.6), this.materials.shingleRoof);
    roofCap.position.set(0, height + 0.9, 0);
    roofCap.castShadow = true;
    group.add(roofCap);

    this.addRooftopDetails(group, width, depth, height + 1.8, false);
    return group;
  }

  /**
   * 10. 8-Story Modern Luxury Condominiums
   */
  createModernCondominium(x, z, width = 32, depth = 26, height = 32) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    // Hybrid Wood-Clad & Concrete facade
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.woodFacade);
    body.position.set(0, height * 0.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Staggered glass-fronted cantilevered balconies
    for (let f = 1; f < 8; f++) {
      const by = f * 4.0;
      const bx = (f % 2 === 0 ? 1 : -1) * (width * 0.2);
      const balc = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.1, 2.0), this.materials.metalDetails);
      balc.position.set(bx, by, depth * 0.5 + 1.0);
      balc.castShadow = true;
      group.add(balc);
    }

    this.addRooftopDetails(group, width, depth, height, false);
    return group;
  }

  /**
   * 11. 12-Story Brick Residential High-Rise Tower with Rooftop Water Tank
   */
  createResidentialTower(x, z, height = 46) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const w = 26;
    const d = 24;

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), this.materials.brickRed);
    body.position.set(0, height * 0.5, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Fire escape ladder on side
    const fireEscape = new THREE.Mesh(new THREE.BoxGeometry(0.8, height * 0.85, 3.2), this.materials.metalDetails);
    fireEscape.position.set(w * 0.5 + 0.4, height * 0.5, 0);
    group.add(fireEscape);

    this.addRooftopDetails(group, w, d, height, false);
    return group;
  }

  // =========================================================================
  // INDUSTRIAL DISTRICT BUILDINGS
  // =========================================================================

  /**
   * 12. Mega Logistics Distribution Warehouse (75m x 45m x 16m)
   */
  createMegaWarehouse(x, z, width = 75, depth = 45, height = 15) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    // Main steel shed
    const hull = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.industrial);
    hull.position.set(0, height * 0.5, 0);
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);

    // Low-pitch gabled metal roof
    const roofGeom = new THREE.ConeGeometry(Math.max(width, depth) * 0.55, 3.0, 4);
    roofGeom.rotateY(Math.PI / 4);
    roofGeom.scale(width / Math.max(width, depth), 1, depth / Math.max(width, depth));
    const roof = new THREE.Mesh(roofGeom, this.materials.metalDetails);
    roof.position.set(0, height + 1.5, 0);
    group.add(roof);

    // 8 Truck Loading Docks with black rubber dock seals
    for (let d = -width * 0.38; d <= width * 0.38; d += 11) {
      const dock = new THREE.Mesh(new THREE.BoxGeometry(6.5, 4.2, 1.4), this.materials.metalDetails);
      dock.position.set(d, 2.1, depth * 0.5 + 0.7);
      dock.castShadow = true;
      group.add(dock);
    }

    return group;
  }

  /**
   * 13. Heavy Industry Manufacturing Plant with Sawtooth Roofs & Twin Smokestacks
   */
  createFactoryWithChimneys(x, z) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    // Main brick hall
    const hallW = 50;
    const hallD = 32;
    const hallH = 18;
    const hall = new THREE.Mesh(new THREE.BoxGeometry(hallW, hallH, hallD), this.materials.industrial);
    hall.position.set(0, hallH * 0.5, 0);
    hall.castShadow = true;
    hall.receiveShadow = true;
    group.add(hall);

    // Twin industrial smokestacks with red/white aviation bands
    [-12, 12].forEach((sx) => {
      const stackH = 52;
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, stackH, 16), this.materials.brickRed);
      stack.position.set(sx, stackH * 0.5, -hallD * 0.5 - 6);
      stack.castShadow = true;
      group.add(stack);

      // Warning aviation stripes
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.75, 5.0, 16), this.materials.antenna);
      band.position.set(sx, stackH - 2.5, -hallD * 0.5 - 6);
      group.add(band);

      // Red blinking beacon at stack summit
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), this.materials.beaconRed);
      beacon.position.set(sx, stackH + 0.5, -hallD * 0.5 - 6);
      group.add(beacon);
    });

    // 3D Large Storage Tanks on the factory perimeter
    [-18, 18].forEach((tx) => {
      const tankPos = new THREE.Vector3(tx, 0, hallD * 0.5 + 8);
      AssetManager.createInstance('detail-tank-large.glb', tankPos, 0, 1.0).then((inst) => {
        if (inst) group.add(inst);
      });
    });

    return group;
  }

  /**
   * 14. Refinery / Fuel Tank Storage Facility
   */
  createStorageTanks(x, z) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const tankMat = new THREE.MeshStandardMaterial({ color: 0xe0e4e8, roughness: 0.35, metalness: 0.7 });

    [-18, 18].forEach((tx) => {
      [-18, 18].forEach((tz) => {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 16, 24), tankMat);
        tank.position.set(tx, 8, tz);
        tank.castShadow = true;
        group.add(tank);

        // Spherical dome roof
        const dome = new THREE.Mesh(new THREE.SphereGeometry(11, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), tankMat);
        dome.position.set(tx, 16, tz);
        group.add(dome);
      });
    });

    return group;
  }

  /**
   * 15. Stacked Intermodal Shipping Containers with genuine 3D GLB Models
   */
  createContainerYard(x, z) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const transformsA = [];
    const transformsB = [];
    const transformsC = [];

    const cW = 3.2;
    const cL = 6.4;
    const cH = 2.6;

    for (let row = -3; row <= 3; row++) {
      for (let col = -2; col <= 2; col++) {
        if (Math.random() < 0.15) continue; // aisle clearance
        const stackHeight = 1 + Math.floor(Math.random() * 3);
        for (let h = 0; h < stackHeight; h++) {
          const t = {
            pos: new THREE.Vector3(col * cW, h * cH, row * cL),
            rotY: (col % 2 === 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.04
          };
          const r = Math.random();
          if (r < 0.4) transformsA.push(t);
          else if (r < 0.75) transformsB.push(t);
          else transformsC.push(t);
        }
      }
    }

    if (transformsA.length > 0) {
      AssetManager.createInstancedMesh('shipping-container-a.glb', transformsA).then((inst) => {
        if (inst) group.add(inst);
      });
    }
    if (transformsB.length > 0) {
      AssetManager.createInstancedMesh('shipping-container-b.glb', transformsB).then((inst) => {
        if (inst) group.add(inst);
      });
    }
    if (transformsC.length > 0) {
      AssetManager.createInstancedMesh('shipping-container-c.glb', transformsC).then((inst) => {
        if (inst) group.add(inst);
      });
    }

    return group;
  }

  // =========================================================================
  // COMMERCIAL DISTRICT BUILDINGS
  // =========================================================================

  /**
   * 16. Shopping Mall Plaza / Retail Center
   */
  createShoppingMallPlaza(x, z, width = 56, depth = 36, height = 15) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    // Main mall structure
    const mall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.commercial);
    mall.position.set(0, height * 0.5, 0);
    mall.castShadow = true;
    mall.receiveShadow = true;
    group.add(mall);

    // Wide glass entrance atrium
    const atrium = new THREE.Mesh(new THREE.BoxGeometry(width * 0.45, height * 0.85, 4.0), this.materials.glassBlue);
    atrium.position.set(0, height * 0.42, depth * 0.5 + 2.0);
    atrium.castShadow = true;
    group.add(atrium);

    // Large illuminated retail canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 0.8, 6.0), this.materials.metalDetails);
    canopy.position.set(0, 4.5, depth * 0.5 + 4.0);
    canopy.castShadow = true;
    group.add(canopy);

    this.addRooftopDetails(group, width, depth, height, false);
    return group;
  }

  /**
   * 17. Multi-Level Parking Garage Structure
   */
  createParkingGarage(x, z, width = 42, depth = 34, height = 18) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const levels = 4;
    const floorH = height / levels;

    // Open concrete floor slabs with crash barrier parapets
    for (let l = 0; l <= levels; l++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.6, depth), this.materials.concrete);
      slab.position.set(0, l * floorH, 0);
      slab.castShadow = true;
      slab.receiveShadow = true;
      group.add(slab);

      // Guard parapet around edges
      if (l > 0) {
        [-depth * 0.5, depth * 0.5].forEach((pz) => {
          const barrier = new THREE.Mesh(new THREE.BoxGeometry(width, 1.0, 0.3), this.materials.metalDetails);
          barrier.position.set(0, l * floorH + 0.5, pz);
          group.add(barrier);
        });
      }
    }

    // Concrete support pillars
    [-width * 0.35, 0, width * 0.35].forEach((px) => {
      [-depth * 0.35, depth * 0.35].forEach((pz) => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, height, 8), this.materials.concrete);
        pillar.position.set(px, height * 0.5, pz);
        pillar.castShadow = true;
        group.add(pillar);
      });
    });

    return group;
  }

  /**
   * 18. Service / Gas Station with Canopy & Pumps
   */
  createGasStation(x, z) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    // Large overhead fuel canopy (24m x 16m)
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(24, 1.0, 16), this.materials.metalDetails);
    canopy.position.set(0, 5.5, 0);
    canopy.castShadow = true;
    group.add(canopy);

    // 4 Support Columns
    [-8, 8].forEach((cx) => {
      [-4, 4].forEach((cz) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5.0, 8), this.materials.steelWhite);
        col.position.set(cx, 2.5, cz);
        col.castShadow = true;
        group.add(col);
      });
    });

    // 4 Fuel Pump Dispensers
    [-6, 6].forEach((px) => {
      [-3, 3].forEach((pz) => {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.8), this.materials.metalDetails);
        pump.position.set(px, 1.1, pz);
        group.add(pump);
      });
    });

    // Convenience Store Building in background
    const shop = new THREE.Mesh(new THREE.BoxGeometry(18, 5.0, 10), this.materials.commercial);
    shop.position.set(0, 2.5, -16);
    shop.castShadow = true;
    group.add(shop);

    return group;
  }

  /**
   * 19. Mid-Rise Commercial Office Block
   */
  createCommercialBuilding(x, z, width = 38, depth = 30, height = 34) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.materials.commercial);
    mesh.position.set(0, height * 0.5, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Entrance canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(width * 0.4, 0.6, 5.0), this.materials.metalDetails);
    canopy.position.set(0, 3.8, depth * 0.5 + 2.5);
    canopy.castShadow = true;
    group.add(canopy);

    this.addRooftopDetails(group, width, depth, height, false);
    return group;
  }

  // =========================================================================
  // SCENIC HILLS BUILDINGS
  // =========================================================================

  /**
   * 20. Terraced Hillside Luxury Villa with Cantilevered Infinity Deck
   */
  createTerracedVilla(x, z) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    // Tier 1 Base embedding into hill
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(18, 5.0, 16), this.materials.whiteStucco);
    t1.position.set(0, 2.5, 0);
    t1.castShadow = true;
    group.add(t1);

    // Tier 2 Upper Living Pavilion with Terracotta Roof
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(14, 4.0, 12), this.materials.whiteStucco);
    t2.position.set(-2, 7.0, -2);
    t2.castShadow = true;
    group.add(t2);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(12, 3.0, 4), this.materials.terracottaRoof);
    roof.rotateY(Math.PI / 4);
    roof.position.set(-2, 10.5, -2);
    roof.castShadow = true;
    group.add(roof);

    // Cantilevered Infinity Deck overlooking the valley
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 6), this.materials.woodFacade);
    deck.position.set(2, 4.8, 7.0);
    deck.castShadow = true;
    group.add(deck);

    return group;
  }

  /**
   * 21. Mountain Alpine Chalet / Log Cabin
   */
  createMountainChalet(x, z) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const w = 12;
    const d = 14;
    const h = 5.5;

    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.materials.woodFacade);
    walls.position.set(0, h * 0.5, 0);
    walls.castShadow = true;
    group.add(walls);

    // Steep pitched A-frame roof
    const roofH = 5.0;
    const roofGeom = new THREE.ConeGeometry(Math.max(w, d) * 0.65, roofH, 4);
    roofGeom.rotateY(Math.PI / 4);
    roofGeom.scale(w / Math.max(w, d), 1, d / Math.max(w, d));
    const roof = new THREE.Mesh(roofGeom, this.materials.shingleRoof);
    roof.position.set(0, h + roofH * 0.5, 0);
    roof.castShadow = true;
    group.add(roof);

    return group;
  }

  /**
   * 22. Mountain Summit Telecommunications Mast
   */
  createSummitRadioTower(x, z) {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const towerH = 58;

    // Steel lattice mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 2.5, towerH, 4), this.materials.steelWhite);
    mast.position.set(0, towerH * 0.5, 0);
    mast.castShadow = true;
    group.add(mast);

    // Microwave dish antennas
    [22, 38, 48].forEach((dy, idx) => {
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 16), this.materials.metalDetails);
      dish.rotateZ(Math.PI / 2);
      dish.position.set(idx % 2 === 0 ? 1.4 : -1.4, dy, 0);
      group.add(dish);
    });

    // Flashing red summit hazard beacon
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), this.materials.beaconRed);
    beacon.position.set(0, towerH + 0.5, 0);
    group.add(beacon);

    return group;
  }

  // Alias for backward compatibility
  createIndustrialWarehouse(x, z, width = 60, depth = 38, height = 14) {
    return this.createMegaWarehouse(x, z, width, depth, height);
  }

  createResidentialBuilding(x, z, width = 24, depth = 20, height = 20) {
    return this.createCourtyardApartments(x, z, width, depth, height);
  }

  createHelipadTower(x, z, height = 85) {
    return this.createCylindricalTower(x, z, height);
  }

  /**
   * 23. Modular High-Rise Skyscraper from 3D Kenney GLB Library
   */
  createModularSkyscraper(x, z, variant = 'a') {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const modelName = `building-skyscraper-${variant}.glb`;
    AssetManager.createInstance(modelName, new THREE.Vector3(0, 0, 0), 0, 1.0).then((inst) => {
      if (inst) group.add(inst);
    });

    return group;
  }

  /**
   * 24. Modular Commercial Office Building from 3D Kenney GLB Library
   */
  createModularBuilding(x, z, variant = 'a') {
    const group = new THREE.Group();
    const baseH = this.terrain.getHeight(x, z);
    group.position.set(x, baseH, z);

    const modelName = `building-${variant}.glb`;
    AssetManager.createInstance(modelName, new THREE.Vector3(0, 0, 0), 0, 1.0).then((inst) => {
      if (inst) group.add(inst);
    });

    return group;
  }
}
