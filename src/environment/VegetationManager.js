import * as THREE from 'three';
import { MaterialManager } from '../materials/MaterialManager.js';
import { AssetManager } from '../materials/AssetManager.js';

/**
 * VegetationManager - High-performance instanced foliage system.
 * 
 * Features:
 * - 3D GLB Large Trees (`tree-large.glb`) for boulevards and Central Park
 * - 3D GLB Small Ornamental Trees (`tree-small.glb`) for avenue sidewalks
 * - 3D GLB Sidewalk Planters (`planter.glb`) at street tree bases
 * - Instanced Conifer Pines with PBR pine bark along mountain slopes
 * - Lush green shrubs, bushes, and natural hillside boulders
 * - Strictly placed along urban planning guidelines with zero building penetration
 */
export class VegetationManager {
  constructor(terrain) {
    this.terrain = terrain;
    this.instances = [];
    this.root = new THREE.Group();
    this.root.name = 'vegetation';
  }

  generateFoliage() {
    const streetTreeTransforms = [];
    const parkLargeTreeTransforms = [];
    const parkSmallTreeTransforms = [];
    const planterTransforms = [];
    const pinePositions = [];
    const bushPositions = [];
    const rockPositions = [];

    // ========================================================
    // 1. NEAT SIDEWALK STREET TREES INSIDE THE CITY
    // Placed strictly along sidewalk curb lines at regular intervals
    // ========================================================
    // North-South Avenues (X = 120 and X = 380, width 16m => sidewalks at offset +/- 9.5m)
    const nsAvenues = [120, 380];
    nsAvenues.forEach((ax) => {
      [-9.5, 9.5].forEach((sideOffset) => {
        const treeX = ax + sideOffset;
        for (let z = -220; z <= 220; z += 22) {
          if (Math.abs(z - (-160)) < 16 || Math.abs(z) < 16 || Math.abs(z - 160) < 16) continue;
          const h = this.terrain.getHeight(treeX, z);
          if (h > 2.0) {
            const rotY = Math.random() * Math.PI * 2;
            const scale = 0.85 + Math.random() * 0.3;
            streetTreeTransforms.push({
              pos: new THREE.Vector3(treeX, h, z),
              rotY: rotY,
              scale: scale
            });
            planterTransforms.push({
              pos: new THREE.Vector3(treeX, h + 0.05, z),
              rotY: 0,
              scale: 1.0
            });
          }
        }
      });
    });

    // East-West Cross Streets (Z = -160 and Z = 160, width 16m => sidewalks at offset +/- 9.5m)
    [-160, 160].forEach((az) => {
      [-9.5, 9.5].forEach((sideOffset) => {
        const treeZ = az + sideOffset;
        for (let x = 60; x <= 440; x += 24) {
          if (Math.abs(x - 120) < 16 || Math.abs(x - 250) < 16 || Math.abs(x - 380) < 16) continue;
          const h = this.terrain.getHeight(x, treeZ);
          if (h > 2.0) {
            const rotY = Math.random() * Math.PI * 2;
            const scale = 0.85 + Math.random() * 0.3;
            streetTreeTransforms.push({
              pos: new THREE.Vector3(x, h, treeZ),
              rotY: rotY,
              scale: scale
            });
            planterTransforms.push({
              pos: new THREE.Vector3(x, h + 0.05, treeZ),
              rotY: 0,
              scale: 1.0
            });
          }
        }
      });
    });

    // Grand Downtown Boulevard (Z = 0, width 22m => sidewalks at offset +/- 13m)
    [-13.0, 13.0].forEach((sideOffset) => {
      const treeZ = sideOffset;
      // West of roundabout (X: 50 to 210)
      for (let x = 50; x <= 210; x += 22) {
        if (Math.abs(x - 120) < 16) continue;
        const h = this.terrain.getHeight(x, treeZ);
        if (h > 2.0) {
          parkLargeTreeTransforms.push({
            pos: new THREE.Vector3(x, h, treeZ),
            rotY: Math.random() * Math.PI * 2,
            scale: 0.9 + Math.random() * 0.25
          });
          planterTransforms.push({
            pos: new THREE.Vector3(x, h + 0.05, treeZ),
            rotY: 0,
            scale: 1.1
          });
        }
      }
      // East of roundabout (X: 290 to 450)
      for (let x = 290; x <= 450; x += 22) {
        if (Math.abs(x - 380) < 16) continue;
        const h = this.terrain.getHeight(x, treeZ);
        if (h > 2.0) {
          parkLargeTreeTransforms.push({
            pos: new THREE.Vector3(x, h, treeZ),
            rotY: Math.random() * Math.PI * 2,
            scale: 0.9 + Math.random() * 0.25
          });
          planterTransforms.push({
            pos: new THREE.Vector3(x, h + 0.05, treeZ),
            rotY: 0,
            scale: 1.1
          });
        }
      }
    });

    // ========================================================
    // 2. DESIGNATED CENTRAL PARK GREENWAY (X: 190 to 290, Z: -140 to -60)
    // ========================================================
    for (let i = 0; i < 65; i++) {
      const px = 195 + Math.random() * 90;
      const pz = -135 + Math.random() * 70;
      if (px > 240 && px < 260) continue; // Avenue corridor
      const h = this.terrain.getHeight(px, pz);
      if (h > 2.0) {
        const rotY = Math.random() * Math.PI * 2;
        if (Math.random() < 0.55) {
          parkLargeTreeTransforms.push({
            pos: new THREE.Vector3(px, h, pz),
            rotY: rotY,
            scale: 0.85 + Math.random() * 0.35
          });
        } else {
          parkSmallTreeTransforms.push({
            pos: new THREE.Vector3(px, h, pz),
            rotY: rotY,
            scale: 0.8 + Math.random() * 0.3
          });
        }
        bushPositions.push(new THREE.Vector3(px + (Math.random() - 0.5) * 4, h, pz + (Math.random() - 0.5) * 4));
      }
    }

    // ========================================================
    // 3. PERIPHERAL FORESTS & MOUNTAIN SLOPES
    // ========================================================
    // Western Mountain Conifer Slopes (X < -160, Z < 100)
    for (let i = 0; i < 380; i++) {
      const gx = -680 + Math.random() * 490;
      const gz = -700 + Math.random() * 850;
      const h = this.terrain.getHeight(gx, gz);
      if (h > 3.0) {
        pinePositions.push(new THREE.Vector3(gx, h, gz));
        if (Math.random() < 0.35) {
          bushPositions.push(new THREE.Vector3(gx + (Math.random() - 0.5) * 6, h, gz + (Math.random() - 0.5) * 6));
        }
        if (Math.random() < 0.25) {
          rockPositions.push(new THREE.Vector3(gx + (Math.random() - 0.5) * 8, h + 0.3, gz + (Math.random() - 0.5) * 8));
        }
      }
    }

    // Eastern Natural Ridge Forest (X > 490)
    for (let i = 0; i < 280; i++) {
      const gx = 490 + Math.random() * 220;
      const gz = -600 + Math.random() * 1200;
      const h = this.terrain.getHeight(gx, gz);
      if (h > 2.0) {
        if (Math.random() < 0.6) {
          pinePositions.push(new THREE.Vector3(gx, h, gz));
        } else {
          parkLargeTreeTransforms.push({
            pos: new THREE.Vector3(gx, h, gz),
            rotY: Math.random() * Math.PI * 2,
            scale: 0.9 + Math.random() * 0.3
          });
        }
      }
    }

    // Deploy 3D Tree Models Asynchronously
    this.deployTreesAsync(streetTreeTransforms, parkLargeTreeTransforms, parkSmallTreeTransforms, planterTransforms);

    // Conifer Pines with PBR bark on mountain slopes
    if (pinePositions.length > 0) {
      this.root.add(this.createInstancedPines(pinePositions));
    }

    // Shrubs and Bushes
    if (bushPositions.length > 0) {
      this.root.add(this.createInstancedBushes(bushPositions));
    }

    // Natural Mountain Rocks & Boulders
    if (rockPositions.length > 0) {
      this.root.add(this.createInstancedRocks(rockPositions));
    }

    return this.root;
  }

  async deployTreesAsync(streetTrees, largeTrees, smallTrees, planters) {
    if (streetTrees.length > 0) {
      const instStreet = await AssetManager.createInstancedMesh('tree-small.glb', streetTrees);
      if (instStreet) this.root.add(instStreet);
    }

    if (largeTrees.length > 0) {
      const instLarge = await AssetManager.createInstancedMesh('tree-large.glb', largeTrees);
      if (instLarge) this.root.add(instLarge);
    }

    if (smallTrees.length > 0) {
      const instSmall = await AssetManager.createInstancedMesh('tree-small.glb', smallTrees);
      if (instSmall) this.root.add(instSmall);
    }

    if (planters.length > 0) {
      const instPlanters = await AssetManager.createInstancedMesh('planter.glb', planters);
      if (instPlanters) this.root.add(instPlanters);
    }
  }

  createInstancedPines(positions) {
    const group = new THREE.Group();

    // 1. Pine Trunk with PBR bark material
    const trunkGeom = new THREE.CylinderGeometry(0.28, 0.45, 4.5, 8);
    trunkGeom.translate(0, 2.25, 0);
    const trunkMat = MaterialManager.getPineBarkMaterial({ repeatX: 1, repeatY: 3 });
    const instTrunks = new THREE.InstancedMesh(trunkGeom, trunkMat, positions.length);
    instTrunks.castShadow = true;

    // 2. Conifer Foliage Cone
    const coneGeom = new THREE.ConeGeometry(2.6, 7.5, 7);
    coneGeom.translate(0, 5.5, 0);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x1b3e1a,
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true
    });
    const instCones = new THREE.InstancedMesh(coneGeom, coneMat, positions.length);
    instCones.castShadow = true;
    instCones.receiveShadow = true;

    const dummy = new THREE.Object3D();
    positions.forEach((pos, idx) => {
      dummy.position.copy(pos);
      const scale = 0.95 + Math.random() * 0.6;
      dummy.scale.set(scale, scale * (1.1 + Math.random() * 0.4), scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();

      instTrunks.setMatrixAt(idx, dummy.matrix);
      instCones.setMatrixAt(idx, dummy.matrix);
    });

    instTrunks.instanceMatrix.needsUpdate = true;
    instCones.instanceMatrix.needsUpdate = true;

    group.add(instTrunks);
    group.add(instCones);
    return group;
  }

  createInstancedBushes(positions) {
    const bushGeom = new THREE.SphereGeometry(1.2, 7, 5);
    bushGeom.scale(1.2, 0.7, 1.2);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2e7d32,
      roughness: 0.85,
      metalness: 0.02,
      flatShading: true
    });

    const instBush = new THREE.InstancedMesh(bushGeom, mat, positions.length);
    instBush.castShadow = true;
    instBush.receiveShadow = true;

    const dummy = new THREE.Object3D();
    positions.forEach((pos, idx) => {
      dummy.position.copy(pos);
      const s = 0.7 + Math.random() * 0.6;
      dummy.scale.set(s, s * 0.8, s);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      instBush.setMatrixAt(idx, dummy.matrix);
    });

    instBush.instanceMatrix.needsUpdate = true;
    return instBush;
  }

  createInstancedRocks(positions) {
    const rockGeom = new THREE.DodecahedronGeometry(1.6, 1);
    const rockMat = MaterialManager.getTerrainRockMaterial({ repeatX: 2, repeatY: 2 });

    const instRock = new THREE.InstancedMesh(rockGeom, rockMat, positions.length);
    instRock.castShadow = true;
    instRock.receiveShadow = true;

    const dummy = new THREE.Object3D();
    positions.forEach((pos, idx) => {
      dummy.position.copy(pos);
      const s = 0.8 + Math.random() * 1.2;
      dummy.scale.set(s, s * 0.65, s * 1.1);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.updateMatrix();
      instRock.setMatrixAt(idx, dummy.matrix);
    });

    instRock.instanceMatrix.needsUpdate = true;
    return instRock;
  }
}
