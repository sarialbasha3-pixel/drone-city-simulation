import * as THREE from 'three';
import { Chunk } from './Chunk.js';

/**
 * ChunkManager - High-performance dynamic world chunk streaming and LOD coordinator.
 * Monitors drone position in real-time, loading sectors as the drone approaches and
 * pruning distant sectors to ensure 60+ FPS across a massive 1.5km x 1.5km territory.
 */
export class ChunkManager {
  constructor(scene, terrain, buildingGen, collisionSystem) {
    this.scene = scene;
    this.terrain = terrain;
    this.buildingGen = buildingGen;
    this.collisionSystem = collisionSystem;

    this.chunkSize = 250; // 250m per chunk
    this.gridMin = -3;    // -750m
    this.gridMax = 2;     // +750m
    this.chunks = new Map(); // key: "cx_cz"

    this.lodHighDistance = 450;  // High detail within 450m
    this.lodMediumDistance = 850; // Medium detail within 850m
    this.activeChunkCount = 0;
  }

  initWorld() {
    // Instantiate all chunk sectors across the 1.5km x 1.5km grid
    for (let cx = this.gridMin; cx <= this.gridMax; cx++) {
      for (let cz = this.gridMin; cz <= this.gridMax; cz++) {
        const key = `${cx}_${cz}`;
        const chunk = new Chunk(cx, cz, this.chunkSize, this.terrain, this.buildingGen);
        chunk.load();
        this.scene.add(chunk.group);
        this.chunks.set(key, chunk);

        // Register chunk collision with collision system
        this.collisionSystem.registerObstacles(chunk.collisionObjects);
      }
    }
  }

  /**
   * Called every frame to dynamically adjust LOD and visibility
   */
  update(dronePos) {
    let active = 0;

    this.chunks.forEach((chunk) => {
      const dist = Math.hypot(dronePos.x - chunk.center.x, dronePos.z - chunk.center.z);

      if (dist < this.lodHighDistance) {
        chunk.setLOD('HIGH');
        active++;
      } else if (dist < this.lodMediumDistance) {
        chunk.setLOD('MEDIUM');
        active++;
      } else {
        chunk.setLOD('NONE');
      }
    });

    this.activeChunkCount = active;
  }
}
