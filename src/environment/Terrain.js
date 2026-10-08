import * as THREE from 'three';
import { globalNoise } from '../utils/Noise.js';
import { ProceduralTextures } from '../utils/ProceduralTextures.js';
import { MaterialManager } from '../materials/MaterialManager.js';

/**
 * Terrain - Multi-district continuous 3D terrain system
 * Defines the macro-geography of the city (hills, downtown plain, river bay, coastal bluffs).
 */
export class Terrain {
  constructor() {
    this.waterLevel = 1.0;
    this.grassMaterial = null;
    this.initMaterials();
  }

  initMaterials() {
    this.terrainMaterial = MaterialManager.getTerrainGrassMaterial({ repeatX: 16, repeatY: 16 });
  }

  /**
   * Deterministic height function at any world coordinate (x, z)
   * High performance O(1) query used by Chunk, RoadNetwork, Buildings, and Collision.
   */
  getHeight(x, z) {
    // 1. Water Channel / River Bay running through X: -180 to -30
    const riverCenter = -100;
    const riverWidth = 90;
    const distToRiver = Math.abs(x - riverCenter);

    let riverTrench = 0;
    if (distToRiver < riverWidth) {
      const t = distToRiver / riverWidth; // 0 at center, 1 at bank
      riverTrench = (1.0 - Math.sin(t * Math.PI * 0.5)) * 14.0;
    }

    // 2. Coastal Hills & Bluffs (North-West: X < -180, Z < 100)
    let hillHeight = 0;
    if (x < -150) {
      const westFactor = Math.min(1.0, (-150 - x) / 300.0);
      const northFactor = Math.max(0.0, (150 - z) / 400.0);
      const hillBase = westFactor * (25.0 + northFactor * 45.0);

      // Multi-octave natural ridges
      const n1 = globalNoise.fbm(x * 0.003, z * 0.003, 3, 0.5) * 30.0;
      const n2 = globalNoise.fbm(x * 0.015, z * 0.015, 2, 0.4) * 8.0;
      hillHeight = hillBase + n1 + n2;
    }

    // 3. Downtown & Commercial Plateaus (East: X > 0)
    let plainHeight = 5.0; // elevated 5m above sea level
    if (x > 0) {
      const microRoll = globalNoise.fbm(x * 0.004, z * 0.004, 2, 0.5) * 4.0;
      plainHeight += microRoll;
    }

    // 4. Industrial Port (South-West: X < -150, Z > 100)
    if (x < -150 && z > 50) {
      const portFlat = 4.0 + globalNoise.fbm(x * 0.005, z * 0.005, 2, 0.5) * 2.0;
      const blend = Math.min(1.0, (z - 50) / 100.0);
      hillHeight = (1.0 - blend) * hillHeight + blend * portFlat;
    }

    // Combine base elevation
    let finalHeight = (x < -100 ? hillHeight : plainHeight) - riverTrench;

    // Smooth shoreline near water level
    if (finalHeight < -10.0) finalHeight = -10.0;

    return finalHeight;
  }

  /**
   * Generates a mesh chunk for terrain at given bounds
   */
  generateChunkMesh(minX, maxX, minZ, maxZ, segments = 32) {
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const geom = new THREE.PlaneGeometry(width, depth, segments, segments);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const colors = [];
    const colorGrass = new THREE.Color('#3f662a');
    const colorRock = new THREE.Color('#686259');
    const colorSand = new THREE.Color('#968a6f');
    const colorDirt = new THREE.Color('#554832');

    const tempColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      // Local plane geometry coords -> world coords
      const localX = pos.getX(i);
      const localZ = pos.getZ(i);
      const worldX = minX + (localX + width * 0.5);
      const worldZ = minZ + (localZ + depth * 0.5);

      const h = this.getHeight(worldX, worldZ);
      pos.setY(i, h);

      // Slope-based and altitude-based vertex coloring
      const hRight = this.getHeight(worldX + 2, worldZ);
      const hForward = this.getHeight(worldX, worldZ + 2);
      const slope = Math.max(Math.abs(hRight - h), Math.abs(hForward - h)) * 0.5;

      if (h < this.waterLevel + 1.2) {
        // Sand/shoreline near water
        tempColor.copy(colorSand);
      } else if (slope > 1.2 || h > 55.0) {
        // Steep cliff or high peak rock
        tempColor.copy(colorRock).lerp(colorDirt, Math.random() * 0.3);
      } else {
        // Grass with subtle tonal variations
        const variation = (globalNoise.noise(worldX * 0.05, worldZ * 0.05) + 1.0) * 0.5;
        tempColor.copy(colorGrass).lerp(colorDirt, variation * 0.25);
      }

      colors.push(tempColor.r, tempColor.g, tempColor.b);
    }

    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, this.terrainMaterial);
    mesh.position.set(minX + width * 0.5, 0, minZ + depth * 0.5);
    mesh.receiveShadow = true;
    mesh.name = `terrain_${minX}_${minZ}`;

    return mesh;
  }
}
