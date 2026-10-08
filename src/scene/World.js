import * as THREE from 'three';
import { Terrain } from '../environment/Terrain.js';
import { Water } from '../environment/Water.js';
import { RoadNetwork } from '../environment/RoadNetwork.js';
import { BridgeGenerator } from '../environment/BridgeGenerator.js';
import { BuildingGenerator } from '../environment/BuildingGenerator.js';
import { VegetationManager } from '../environment/VegetationManager.js';
import { UrbanPropsManager } from '../environment/UrbanPropsManager.js';
import { ChunkManager } from '../environment/ChunkManager.js';
import { SkyDome } from './SkyDome.js';
import { Lighting } from './Lighting.js';

/**
 * World - Master scene orchestrator.
 * Assembles all districts, terrain, road networks, the great bridge,
 * foliage, props, chunks, and atmospheric lighting.
 */
export class World {
  constructor(scene, collisionSystem) {
    this.scene = scene;
    this.collisionSystem = collisionSystem;

    this.terrain = null;
    this.water = null;
    this.roadNetwork = null;
    this.bridgeGen = null;
    this.buildingGen = null;
    this.vegManager = null;
    this.propsManager = null;
    this.chunkManager = null;
    this.skyDome = null;
    this.lighting = null;
  }

  async init() {
    console.log('[World] Initializing Terrain and Topography...');
    this.terrain = new Terrain();
    if (this.collisionSystem) {
      this.collisionSystem.terrain = this.terrain;
    }

    console.log('[World] Initializing Atmospheric Lighting & Sky...');
    this.skyDome = new SkyDome(this.scene);
    this.lighting = new Lighting(this.scene);

    console.log('[World] Initializing Water Body...');
    this.water = new Water(this.scene);

    console.log('[World] Generating Road Infrastructure...');
    this.roadNetwork = new RoadNetwork(this.terrain);
    const roadGroup = this.roadNetwork.buildCityNetwork();
    this.scene.add(roadGroup);

    console.log('[World] Constructing The Great Bay Bridge...');
    this.bridgeGen = new BridgeGenerator(this.terrain);
    const bridgeGroup = this.bridgeGen.generate();
    this.scene.add(bridgeGroup);
    // Register bridge with collision system
    this.collisionSystem.registerObstacles([bridgeGroup], 'BRIDGE');

    console.log('[World] Initializing Building Generator...');
    this.buildingGen = new BuildingGenerator(this.terrain);

    console.log('[World] Spawning Foliage and Forest Systems...');
    this.vegManager = new VegetationManager(this.terrain);
    const foliageGroup = this.vegManager.generateFoliage();
    this.scene.add(foliageGroup);

    console.log('[World] Populating Urban Props and Streetlights...');
    this.propsManager = new UrbanPropsManager(this.terrain, this.roadNetwork, this.bridgeGen);
    const propsGroup = this.propsManager.generateProps();
    this.scene.add(propsGroup);

    console.log('[World] Initializing Dynamic Chunk Streaming Grid...');
    this.chunkManager = new ChunkManager(this.scene, this.terrain, this.buildingGen, this.collisionSystem);
    this.chunkManager.initWorld();

    console.log('[World] Large-Scale 1.5km City World Successfully Built.');
  }

  update(delta, dronePos) {
    if (this.water) this.water.update(delta);
    if (this.lighting) this.lighting.update(dronePos);
    if (this.propsManager) this.propsManager.update(delta);
    if (this.chunkManager) this.chunkManager.update(dronePos);
  }
}
