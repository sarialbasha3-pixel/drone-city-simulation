import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * AssetManager - Centralized 3D Asset Loader & Instanced Mesh Coordinator.
 * 
 * Features:
 * - Asynchronously loads and caches lightweight modular GLTF/GLB models.
 * - Extracts buffer geometries and shared palette materials for single-draw-call InstancedMesh rendering.
 * - Manages automatic scaling and alignment for Kenney City Kit assets.
 * - Eliminates duplicate draw calls and sustains 60 FPS in browser.
 */
class AssetManagerSingleton {
  constructor() {
    this.loader = new GLTFLoader();
    this.basePath = '/materials/models/';
    this.rawGltfCache = new Map(); // modelName -> GLTF Scene
    this.modelDataCache = new Map(); // modelName -> { geometry, material, multiPrimitives }
    this.pendingPromises = new Map();

    // Default recommended scaling for Kenney City Kit models
    this.defaultScales = {
      'light-curved.glb': 10.0,
      'light-curved-double.glb': 10.0,
      'light-square.glb': 10.0,
      'traffic-light.glb': 11.0,
      'traffic-light-hanging.glb': 11.0,
      'traffic-light-object-vertical.glb': 11.0,
      'road-sign-stop.glb': 5.5,
      'road-sign-warning.glb': 5.5,
      'road-sign-street.glb': 5.5,
      'sign-highway.glb': 6.0,
      'sign-highway-detailed.glb': 6.5,
      'construction-barrier.glb': 6.0,
      'construction-cone.glb': 5.5,
      'construction-fence.glb': 6.0,
      'dumpster.glb': 6.5,
      'planter.glb': 6.5,
      'electricity-pole.glb': 8.5,
      'tree-large.glb': 12.0,
      'tree-small.glb': 9.0,
      'solar-panel-landscape-group.glb': 5.0,
      'solar-panel-flat.glb': 5.0,
      'solar-panel-portrait-group.glb': 5.0,
      'water-tower.glb': 5.5,
      'detail-tank.glb': 6.0,
      'detail-tank-large.glb': 6.5,
      'chimney-large.glb': 6.0,
      'chimney-medium.glb': 5.5,
      'chimney-basic.glb': 5.5,
      'shipping-container-a.glb': 2.0,
      'shipping-container-b.glb': 2.0,
      'shipping-container-c.glb': 2.0,
      'building-skyscraper-a.glb': 25.0,
      'building-skyscraper-b.glb': 25.0,
      'building-skyscraper-c.glb': 25.0,
      'building-skyscraper-d.glb': 25.0,
      'building-skyscraper-e.glb': 25.0,
      'building-a.glb': 16.0,
      'building-b.glb': 16.0,
      'building-c.glb': 16.0,
      'building-d.glb': 16.0,
      'building-type-a.glb': 16.0,
      'building-type-b.glb': 16.0,
      'bridge-pillar.glb': 12.0
    };
  }

  /**
   * Load GLTF/GLB model by filename with caching
   */
  async loadModel(modelName) {
    if (this.modelDataCache.has(modelName)) {
      return this.modelDataCache.get(modelName);
    }

    if (this.pendingPromises.has(modelName)) {
      return this.pendingPromises.get(modelName);
    }

    const promise = new Promise((resolve, reject) => {
      const url = `${this.basePath}${modelName}`;
      this.loader.load(
        url,
        (gltf) => {
          this.rawGltfCache.set(modelName, gltf);

          // Extract first valid mesh or collect primitives
          let primaryMesh = null;
          const meshes = [];

          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              meshes.push(child);
              if (!primaryMesh) primaryMesh = child;
            }
          });

          if (!primaryMesh) {
            console.warn(`[AssetManager] No mesh found in model "${modelName}"`);
            resolve(null);
            return;
          }

          // Ensure material adheres to scene lighting
          if (primaryMesh.material) {
            primaryMesh.material.roughness = 0.75;
            primaryMesh.material.metalness = 0.15;
            if (primaryMesh.material.map) {
              primaryMesh.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          }

          const modelData = {
            geometry: primaryMesh.geometry.clone(),
            material: primaryMesh.material,
            scene: gltf.scene,
            meshes: meshes
          };

          this.modelDataCache.set(modelName, modelData);
          this.pendingPromises.delete(modelName);
          resolve(modelData);
        },
        undefined,
        (err) => {
          console.warn(`[AssetManager] Failed to load model "${modelName}":`, err);
          this.pendingPromises.delete(modelName);
          resolve(null);
        }
      );
    });

    this.pendingPromises.set(modelName, promise);
    return promise;
  }

  /**
   * Preload a list of essential models in parallel
   */
  async preloadModels(modelNames) {
    const promises = modelNames.map((name) => this.loadModel(name));
    return Promise.all(promises);
  }

  /**
   * Build a single THREE.InstancedMesh for an array of transforms
   * @param {string} modelName - e.g. 'light-curved.glb'
   * @param {Array<{pos: THREE.Vector3, rotY?: number, scale?: number|THREE.Vector3}>} transforms
   * @param {Object} options - { castShadow: true, receiveShadow: true }
   */
  async createInstancedMesh(modelName, transforms, options = {}) {
    if (!transforms || transforms.length === 0) return null;

    const data = await this.loadModel(modelName);
    if (!data || !data.geometry || !data.material) return null;

    const baseScale = this.defaultScales[modelName] || 1.0;
    const instMesh = new THREE.InstancedMesh(data.geometry, data.material, transforms.length);
    instMesh.castShadow = options.castShadow !== undefined ? options.castShadow : true;
    instMesh.receiveShadow = options.receiveShadow !== undefined ? options.receiveShadow : true;
    instMesh.name = `inst_${modelName.replace('.glb', '')}`;

    const dummy = new THREE.Object3D();

    transforms.forEach((t, i) => {
      dummy.position.copy(t.pos);

      if (t.rotY !== undefined) {
        dummy.rotation.set(0, t.rotY, 0);
      } else if (t.rot) {
        dummy.rotation.copy(t.rot);
      } else {
        dummy.rotation.set(0, 0, 0);
      }

      if (t.scale !== undefined) {
        if (typeof t.scale === 'number') {
          dummy.scale.setScalar(t.scale * baseScale);
        } else {
          dummy.scale.copy(t.scale).multiplyScalar(baseScale);
        }
      } else {
        dummy.scale.setScalar(baseScale);
      }

      dummy.updateMatrix();
      instMesh.setMatrixAt(i, dummy.matrix);
    });

    instMesh.instanceMatrix.needsUpdate = true;
    return instMesh;
  }

  /**
   * Create an individual cloned scene hierarchy for landmark placement
   */
  async createInstance(modelName, pos, rotY = 0, scaleMultiplier = 1.0) {
    const data = await this.loadModel(modelName);
    if (!data || !data.scene) return null;

    const clone = data.scene.clone(true);
    const baseScale = (this.defaultScales[modelName] || 1.0) * scaleMultiplier;
    clone.position.copy(pos);
    clone.rotation.y = rotY;
    clone.scale.setScalar(baseScale);

    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return clone;
  }
}

export const AssetManager = new AssetManagerSingleton();
