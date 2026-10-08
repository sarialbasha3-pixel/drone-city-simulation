import * as THREE from 'three';

/**
 * Chunk - Represents one spatial sector (250m x 250m) of the city.
 * Manages terrain mesh, buildings, and collision bodies for its sector.
 */
export class Chunk {
  constructor(cx, cz, size, terrain, buildingGen) {
    this.cx = cx;
    this.cz = cz;
    this.size = size;
    this.terrain = terrain;
    this.buildingGen = buildingGen;

    this.minX = cx * size;
    this.maxX = (cx + 1) * size;
    this.minZ = cz * size;
    this.maxZ = (cz + 1) * size;
    this.center = new THREE.Vector3((this.minX + this.maxX) * 0.5, 0, (this.minZ + this.maxZ) * 0.5);

    this.group = new THREE.Group();
    this.group.name = `chunk_${cx}_${cz}`;

    this.collisionObjects = [];
    this.isLoaded = false;
    this.currentLOD = 'NONE'; // 'HIGH', 'MEDIUM', 'NONE'
    this.districtType = this.determineDistrict();
  }

  determineDistrict() {
    if (this.cx >= 0 && this.cz >= -1 && this.cz <= 0) return 'DOWNTOWN';
    if (this.cx >= 0 && this.cz >= 1) return 'COMMERCIAL';
    if (this.cx >= 0 && this.cz <= -2) return 'RESIDENTIAL';
    if (this.cx <= -1 && this.cz >= 0) return 'INDUSTRIAL';
    if (this.cx <= -1 && this.cz <= -1) return 'HILLS';
    return 'WATER';
  }

  load() {
    if (this.isLoaded) return;

    // 1. Terrain Mesh for this chunk
    const terrainMesh = this.terrain.generateChunkMesh(this.minX, this.maxX, this.minZ, this.maxZ, 20);
    this.group.add(terrainMesh);

    // 2. District Buildings based on sector identity
    this.populateDistrict();

    this.isLoaded = true;
  }

  populateDistrict() {
    const bg = this.buildingGen;
    const seed = (Math.abs(this.cx) * 73856093) ^ (Math.abs(this.cz) * 19349663);

    switch (this.districtType) {
      case 'DOWNTOWN': {
        // High density skyline with genuine architectural variety
        // Supertall towers, exoskeleton towers, skybridge twins, stepped deco, financial HQ
        const isCore = (this.cx === 0 || this.cx === 1) && (this.cz === -1 || this.cz === 0);

        if (isCore) {
          // Iconic Landmark Skyscraper Plot
          const superTall = bg.createDiamondSpireSkyscraper(this.minX + 75, this.minZ + 75, 195 + (seed % 25));
          this.group.add(superTall);
          this.collisionObjects.push(superTall);

          const twinTowers = bg.createTwinTowersWithSkybridge(this.minX + 175, this.minZ + 75, 105);
          this.group.add(twinTowers);
          this.collisionObjects.push(twinTowers);

          const exoTower = bg.createTwistedExoskeletonTower(this.minX + 75, this.minZ + 175, 145);
          this.group.add(exoTower);
          this.collisionObjects.push(exoTower);

          const stepped = bg.createSteppedSkyscraper(this.minX + 175, this.minZ + 175, 135);
          this.group.add(stepped);
          this.collisionObjects.push(stepped);
        } else {
          // Perimeter Downtown Blocks: Mixed high-rises, commercial plazas, and modular skyscrapers
          const b1 = bg.createCylindricalTower(this.minX + 65, this.minZ + 65, 115);
          this.group.add(b1);
          this.collisionObjects.push(b1);

          const b2 = bg.createModularSkyscraper(this.minX + 175, this.minZ + 65, 'a');
          this.group.add(b2);
          this.collisionObjects.push(b2);

          const b3 = bg.createSteppedSkyscraper(this.minX + 65, this.minZ + 175, 120);
          this.group.add(b3);
          this.collisionObjects.push(b3);

          const b4 = bg.createModularBuilding(this.minX + 175, this.minZ + 175, 'b');
          this.group.add(b4);
          this.collisionObjects.push(b4);
        }
        break;
      }

      case 'COMMERCIAL': {
        // Shopping mall plaza, multi-level parking garage, gas station, and office blocks
        const mall = bg.createShoppingMallPlaza(this.minX + 70, this.minZ + 75, 56, 36, 16);
        this.group.add(mall);
        this.collisionObjects.push(mall);

        const garage = bg.createParkingGarage(this.minX + 175, this.minZ + 75, 42, 34, 18);
        this.group.add(garage);
        this.collisionObjects.push(garage);

        if (this.cz % 2 === 0) {
          const gas = bg.createGasStation(this.minX + 75, this.minZ + 175);
          this.group.add(gas);
          this.collisionObjects.push(gas);
        } else {
          const office = bg.createModularBuilding(this.minX + 75, this.minZ + 175, 'd');
          this.group.add(office);
          this.collisionObjects.push(office);
        }

        const commOffice = bg.createModularBuilding(this.minX + 175, this.minZ + 175, 'c');
        this.group.add(commOffice);
        this.collisionObjects.push(commOffice);
        break;
      }

      case 'RESIDENTIAL': {
        // Diverse residential neighborhoods: townhouses, courtyard apartments, modern condos, houses
        if (this.cz <= -3) {
          // Suburban Detached Homes Neighborhood
          const houseOffsets = [
            { dx: 45, dz: 45, rot: 0 },
            { dx: 110, dz: 45, rot: Math.PI },
            { dx: 175, dz: 45, rot: 0 },
            { dx: 45, dz: 130, rot: Math.PI / 2 },
            { dx: 110, dz: 130, rot: -Math.PI / 2 },
            { dx: 175, dz: 130, rot: 0 },
            { dx: 65, dz: 195, rot: 0 },
            { dx: 155, dz: 195, rot: Math.PI }
          ];
          houseOffsets.forEach((ho) => {
            const house = bg.createSuburbanHouse(this.minX + ho.dx, this.minZ + ho.dz, ho.rot);
            this.group.add(house);
            this.collisionObjects.push(house);
          });
        } else {
          // Urban Residential: Brownstones, Courtyard Apartments, Condos & Towers
          const apt1 = bg.createCourtyardApartments(this.minX + 65, this.minZ + 65, 36, 28, 22);
          this.group.add(apt1);
          this.collisionObjects.push(apt1);

          const condo = bg.createModernCondominium(this.minX + 175, this.minZ + 65, 32, 26, 34);
          this.group.add(condo);
          this.collisionObjects.push(condo);

          const town = bg.createBrownstoneTownhouse(this.minX + 65, this.minZ + 175, 24, 20, 15);
          this.group.add(town);
          this.collisionObjects.push(town);

          const tower = bg.createResidentialTower(this.minX + 175, this.minZ + 175, 48);
          this.group.add(tower);
          this.collisionObjects.push(tower);
        }
        break;
      }

      case 'INDUSTRIAL': {
        // Heavy industry, mega warehouses, refinery storage tanks, container yards
        const w1 = bg.createMegaWarehouse(this.minX + 75, this.minZ + 75, 78, 45, 15);
        this.group.add(w1);
        this.collisionObjects.push(w1);

        const tanks = bg.createStorageTanks(this.minX + 180, this.minZ + 75);
        this.group.add(tanks);
        this.collisionObjects.push(tanks);

        const factory = bg.createFactoryWithChimneys(this.minX + 75, this.minZ + 175);
        this.group.add(factory);
        this.collisionObjects.push(factory);

        const yard = bg.createContainerYard(this.minX + 180, this.minZ + 175);
        this.group.add(yard);
        this.collisionObjects.push(yard);
        break;
      }

      case 'HILLS': {
        // Terraced luxury villas, alpine chalets, summit radio mast
        const highPeakX = this.minX + 120;
        const highPeakZ = this.minZ + 120;
        const peakH = this.terrain.getHeight(highPeakX, highPeakZ);

        if (peakH > 40.0) {
          // Highest mountain peak receives the summit telecommunications radio mast
          const mast = bg.createSummitRadioTower(highPeakX, highPeakZ);
          this.group.add(mast);
          this.collisionObjects.push(mast);
        } else {
          // Sloped villas and alpine chalets
          const v1 = bg.createTerracedVilla(this.minX + 65, this.minZ + 70);
          this.group.add(v1);
          this.collisionObjects.push(v1);

          const c1 = bg.createMountainChalet(this.minX + 160, this.minZ + 80);
          this.group.add(c1);
          this.collisionObjects.push(c1);

          const c2 = bg.createMountainChalet(this.minX + 110, this.minZ + 165);
          this.group.add(c2);
          this.collisionObjects.push(c2);
        }
        break;
      }

      default:
        break;
    }
  }

  setLOD(lod) {
    if (this.currentLOD === lod) return;
    this.currentLOD = lod;

    if (lod === 'HIGH') {
      this.group.visible = true;
      // High detail: enable shadows
      this.group.traverse((obj) => {
        if (obj.isMesh) obj.castShadow = true;
      });
    } else if (lod === 'MEDIUM') {
      this.group.visible = true;
      // Medium detail: turn off heavy shadows
      this.group.traverse((obj) => {
        if (obj.isMesh) obj.castShadow = false;
      });
    } else {
      // Unloaded
      this.group.visible = false;
    }
  }

  dispose() {
    this.group.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
      }
    });
    this.isLoaded = false;
  }
}
