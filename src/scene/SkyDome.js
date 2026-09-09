import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * SkyDome - Physically-based atmospheric sky & fog.
 * Simulates Rayleigh & Mie scattering, sun position, and atmospheric haze.
 */
export class SkyDome {
  constructor(scene) {
    this.scene = scene;
    this.sky = null;
    this.sun = new THREE.Vector3();
    this.initSky();
  }

  initSky() {
    // 1. Physically-based Atmospheric Sky
    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    this.scene.add(this.sky);

    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['turbidity'].value = 8.5;
    skyUniforms['rayleigh'].value = 1.8;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.82;

    // Sun position (Crisp mid-afternoon sunlight)
    const elevation = 45; // Degrees above horizon
    const azimuth = 135;  // South-East
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);

    this.sun.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(this.sun);

    // 2. Realistic Aerial Distance Fog (Exp2 haze)
    this.scene.fog = new THREE.FogExp2(0xb0c4de, 0.00075);
  }
}
