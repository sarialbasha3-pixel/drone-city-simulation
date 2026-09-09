import * as THREE from 'three';
import { ProceduralTextures } from '../utils/ProceduralTextures.js';

/**
 * Water - Realistic animated bay/river water surface
 */
export class Water {
  constructor(scene) {
    this.scene = scene;
    this.waterMesh = null;
    this.normalTexture = null;
    this.init();
  }

  init() {
    // Water surface spanning the river/bay corridor
    const width = 400;
    const length = 1800;
    const geometry = new THREE.PlaneGeometry(width, length, 64, 64);
    geometry.rotateX(-Math.PI / 2);

    this.normalTexture = ProceduralTextures.getWaterNormalTexture();
    this.normalTexture.repeat.set(8, 36);

    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x143c4d,
      roughness: 0.15,
      metalness: 0.85,
      normalMap: this.normalTexture,
      normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true,
      opacity: 0.88
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
