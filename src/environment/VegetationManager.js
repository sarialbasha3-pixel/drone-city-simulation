import * as THREE from 'three';

/**
 * VegetationManager - High-performance instanced foliage system.
 * Renders thousands of diverse trees and shrubs across districts with minimal draw calls.
 */
export class VegetationManager {
  constructor(terrain) {
    this.terrain = terrain;
    this.instances = [];
    this.root = new THREE.Group();
    this.root.name = 'vegetation';
  }

  /**
   * Builds the instanced meshes for deciduous trees, conifer pines, and shrubs.
   * STRICT CITY PLANNING:
   * 1. Inside city: only neat sidewalk trees aligned along avenue curbs, plus the Central Park greenway.
   * 2. Outside city: dense evergreen conifer and alpine pine forests covering the Western mountains and peripheral greenbelts.
   */
  generateFoliage() {
    const treePositions = [];
    const pinePositions = [];
    const bushPositions = [];

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
          // Skip near cross-intersections (Z = -160, 0, 160)
          if (Math.abs(z - (-160)) < 16 || Math.abs(z) < 16 || Math.abs(z - 160) < 16) continue;
          const h = this.terrain.getHeight(treeX, z);
          if (h > 2.0) {
            treePositions.push(new THREE.Vector3(treeX, h, z));
          }
        }
      });
    });

    // East-West Cross Streets (Z = -160 and Z = 160, width 16m => sidewalks at offset +/- 9.5m)
    [-160, 160].forEach((az) => {
      [-9.5, 9.5].forEach((sideOffset) => {
        const treeZ = az + sideOffset;
        for (let x = 60; x <= 440; x += 24) {
          // Skip near cross-intersections (X = 120, 250, 380)
          if (Math.abs(x - 120) < 16 || Math.abs(x - 250) < 16 || Math.abs(x - 380) < 16) continue;
          const h = this.terrain.getHeight(x, treeZ);
          if (h > 2.0) {
            treePositions.push(new THREE.Vector3(x, h, treeZ));
          }
        }
      });
    });

    // Grand Downtown Boulevard (Z = 0, width 22m => sidewalks at offset +/- 13m)
    [-13.0, 13.0].forEach((sideOffset) => {
      const treeZ = sideOffset;
      // West of roundabout (X: 45 to 215)
      for (let x = 50; x <= 210; x += 22) {
        if (Math.abs(x - 120) < 16) continue;
        const h = this.terrain.getHeight(x, treeZ);
        if (h > 2.0) {
          treePositions.push(new THREE.Vector3(x, h, treeZ));
        }
      }
      // East of roundabout (X: 285 to 460)
      for (let x = 290; x <= 450; x += 22) {
        if (Math.abs(x - 380) < 16) continue;
        const h = this.terrain.getHeight(x, treeZ);
        if (h > 2.0) {
          treePositions.push(new THREE.Vector3(x, h, treeZ));
        }
      }
    });

    // Coastal Highway Scenic Street Trees (landward sidewalk at X = 34)
    for (let z = -680; z <= 680; z += 28) {
      if (Math.abs(z) < 25) continue; // Bridge junction clearance
      const h = this.terrain.getHeight(34, z);
      if (h > 2.0) {
        treePositions.push(new THREE.Vector3(34, h, z));
      }
    }

    // ========================================================
    // 2. DESIGNATED CENTRAL PARK GREENWAY (X: 190 to 290, Z: -140 to -60)
    // Manicured urban oasis with walking paths, ornamental trees and bushes
    // ========================================================
    for (let i = 0; i < 90; i++) {
      const px = 195 + Math.random() * 90;
      const pz = -135 + Math.random() * 70;
      // Keep clear of surrounding street curbs
      if (px > 240 && px < 260) continue; // Avenue corridor
      const h = this.terrain.getHeight(px, pz);
      if (h > 2.0) {
        treePositions.push(new THREE.Vector3(px, h, pz));
        if (Math.random() < 0.5) {
          bushPositions.push(new THREE.Vector3(px + (Math.random() - 0.5) * 4, h, pz + (Math.random() - 0.5) * 4));
        }
      }
    }

    // ========================================================
    // 3. MAIN DENSE FORESTS STRICTLY OUTSIDE THE CITY
    // Clear transition: City -> Suburbs -> Natural Terrain -> Forest
    // ========================================================

    // A. Western Mountain Pine & Cypress Forest (X: -750 to -190, Z: -750 to 40)
    for (let i = 0; i < 750; i++) {
      const hx = -190 - Math.random() * 540;
      const hz = 40 - Math.random() * 760;
      const h = this.terrain.getHeight(hx, hz);
      // Grow on natural slopes above river valley
      if (h > 8.0) {
        pinePositions.push(new THREE.Vector3(hx, h, hz));
        if (Math.random() < 0.45) {
          bushPositions.push(new THREE.Vector3(hx + (Math.random() - 0.5) * 6, h, hz + (Math.random() - 0.5) * 6));
        }
      }
    }

    // B. Northern Natural Greenbelt Forest (Z < -680, outer boundary beyond residential suburbs)
    for (let i = 0; i < 280; i++) {
      const gx = 40 + Math.random() * 550;
      const gz = -690 - Math.random() * 160;
      const h = this.terrain.getHeight(gx, gz);
      if (h > 2.0) {
        if (Math.random() < 0.6) {
          pinePositions.push(new THREE.Vector3(gx, h, gz));
        } else {
          treePositions.push(new THREE.Vector3(gx, h, gz));
        }
        bushPositions.push(new THREE.Vector3(gx + (Math.random() - 0.5) * 5, h, gz + (Math.random() - 0.5) * 5));
      }
    }

    // C. Southern Natural Coastal Forest (Z > 690, outer boundary beyond commercial district)
    for (let i = 0; i < 260; i++) {
      const gx = 40 + Math.random() * 550;
      const gz = 690 + Math.random() * 160;
      const h = this.terrain.getHeight(gx, gz);
      if (h > 2.0) {
        if (Math.random() < 0.6) {
          pinePositions.push(new THREE.Vector3(gx, h, gz));
        } else {
          treePositions.push(new THREE.Vector3(gx, h, gz));
        }
        bushPositions.push(new THREE.Vector3(gx + (Math.random() - 0.5) * 5, h, gz + (Math.random() - 0.5) * 5));
      }
    }

    // D. Eastern Natural Ridge Forest (X > 490, natural hills buffering the east of the city)
    for (let i = 0; i < 280; i++) {
      const gx = 490 + Math.random() * 220;
      const gz = -600 + Math.random() * 1200;
      const h = this.terrain.getHeight(gx, gz);
      if (h > 2.0) {
        if (Math.random() < 0.5) {
          pinePositions.push(new THREE.Vector3(gx, h, gz));
        } else {
          treePositions.push(new THREE.Vector3(gx, h, gz));
        }
      }
    }

    // Create Instanced Meshes
    if (treePositions.length > 0) {
      this.root.add(this.createInstancedDeciduous(treePositions));
    }
    if (pinePositions.length > 0) {
      this.root.add(this.createInstancedPines(pinePositions));
    }
    if (bushPositions.length > 0) {
      this.root.add(this.createInstancedBushes(bushPositions));
    }

    return this.root;
  }

  createInstancedDeciduous(positions) {
    const group = new THREE.Group();

    // 1. Trunk
    const trunkGeom = new THREE.CylinderGeometry(0.35, 0.55, 3.8, 8);
    trunkGeom.translate(0, 1.9, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4e3629,
      roughness: 0.9,
      metalness: 0.05
    });
    const instTrunks = new THREE.InstancedMesh(trunkGeom, trunkMat, positions.length);
    instTrunks.castShadow = true;

    // 2. Multi-tier leafy canopy
    const canopyGeom = new THREE.DodecahedronGeometry(2.6, 1);
    canopyGeom.translate(0, 4.8, 0);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x33691e, // Vibrant lush green
      roughness: 0.82,
      metalness: 0.02,
      flatShading: true
    });
    const instCanopy = new THREE.InstancedMesh(canopyGeom, canopyMat, positions.length);
    instCanopy.castShadow = true;
    instCanopy.receiveShadow = true;

    const dummy = new THREE.Object3D();
    positions.forEach((pos, idx) => {
      dummy.position.copy(pos);
      const scale = 0.85 + Math.random() * 0.4;
      dummy.scale.set(scale, scale * (0.95 + Math.random() * 0.3), scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();

      instTrunks.setMatrixAt(idx, dummy.matrix);
      instCanopy.setMatrixAt(idx, dummy.matrix);
    });

    instTrunks.instanceMatrix.needsUpdate = true;
    instCanopy.instanceMatrix.needsUpdate = true;

    group.add(instTrunks);
    group.add(instCanopy);
    return group;
  }

  createInstancedPines(positions) {
    const group = new THREE.Group();

    // 1. Pine Trunk
    const trunkGeom = new THREE.CylinderGeometry(0.28, 0.45, 4.5, 8);
    trunkGeom.translate(0, 2.25, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
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
      color: 0x417028,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true
    });

    const instMesh = new THREE.InstancedMesh(bushGeom, mat, positions.length);
    instMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    positions.forEach((pos, idx) => {
      dummy.position.copy(pos);
      const scale = 0.7 + Math.random() * 0.6;
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      instMesh.setMatrixAt(idx, dummy.matrix);
    });

    instMesh.instanceMatrix.needsUpdate = true;
    return instMesh;
  }
}
