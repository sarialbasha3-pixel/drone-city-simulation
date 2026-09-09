import * as THREE from 'three';

/**
 * Lighting - Realistic daylight solar lighting with calibrated sun direction,
 * PCF soft shadows, and sky/ground bounce hemisphere illumination.
 */
export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.sunLight = null;
    this.hemiLight = null;
    this.initLights();
  }

  initLights() {
    // 1. Hemisphere Light (Sky ambient + warm ground bounce)
    this.hemiLight = new THREE.HemisphereLight(0xddeeff, 0x443322, 0.75);
    this.hemiLight.position.set(0, 500, 0);
    this.scene.add(this.hemiLight);

    // 2. Main Directional Sunlight
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    this.sunLight.position.set(350, 600, 250);
    this.sunLight.castShadow = true;

    // High quality shadow configuration
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 50;
    this.sunLight.shadow.camera.far = 1200;

    // Shadow orthographic frustum covering the active district
    const d = 350;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  /**
   * Tracks sunlight and shadow camera to the drone's position
   */
  update(dronePos) {
    if (this.sunLight) {
      this.sunLight.position.set(dronePos.x + 350, dronePos.y + 600, dronePos.z + 250);
      this.sunLight.target.position.copy(dronePos);
      this.sunLight.target.updateMatrixWorld();
    }
  }
}
