import * as THREE from 'three';
import { ProceduralTextures } from '../utils/ProceduralTextures.js';
import { MaterialManager } from '../materials/MaterialManager.js';

/**
 * Water - Realistic animated bay/river water surface with PBR riverbed geology
 */
export class Water {
  constructor(scene) {
    this.scene = scene;
    this.waterMesh = null;
    this.riverbedMesh = null;
    this.normalTexture = null;
    this.init();
  }

  init() {
    // Water corridor bounds
    const width = 400;
    const length = 1800;

    // 1. Realistic PBR Riverbed Floor
    const bedGeom = new THREE.PlaneGeometry(width, length, 16, 32);
    bedGeom.rotateX(-Math.PI / 2);
    const riverbedMat = MaterialManager.getTerrainMudMaterial({ repeatX: 8, repeatY: 36 });
    this.riverbedMesh = new THREE.Mesh(bedGeom, riverbedMat);
    this.riverbedMesh.position.set(-100, -3.5, 0);
    this.riverbedMesh.receiveShadow = true;
    this.scene.add(this.riverbedMesh);

    // 2. Animated Water Surface with realistic PBR dielectric parameters
    const geometry = new THREE.PlaneGeometry(width, length, 64, 64);
    geometry.rotateX(-Math.PI / 2);

    this.normalTexture = ProceduralTextures.getWaterNormalTexture();
    this.normalTexture.repeat.set(8, 36);

    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x164658,
      roughness: 0.12,
      metalness: 0.08,
      normalMap: this.normalTexture,
      normalScale: new THREE.Vector2(0.4, 0.4),
      transparent: true,
      opacity: 0.84,
      depthWrite: false
    });

    this.waterMesh = new THREE.Mesh(geometry, waterMaterial);
    this.waterMesh.position.set(-100, 0.5, 0); // Positioned inside the bay channel
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  update(delta) {
    if (this.normalTexture) {
      this.normalTexture.offset.x += delta * 0.02;
      this.normalTexture.offset.y += delta * 0.04;
    }
  }
}
