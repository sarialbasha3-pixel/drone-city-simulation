import * as THREE from 'three';
import { MaterialManager } from './materials/MaterialManager.js';
import { World } from './scene/World.js';
import { Drone } from './drone/Drone.js';
import { FlightController } from './drone/FlightController.js';
import { DroneHUD } from './drone/DroneHUD.js';
import { CollisionSystem } from './physics/CollisionSystem.js';
import { SensorInterface } from './sensors/SensorInterface.js';

// Navigation / GRU integration
import { ESKF } from './navigation/ESKF.js';
import { GRUBridge } from './navigation/GRUBridge.js';
import { RouteController } from './navigation/RouteController.js';
import { NavigationHUD } from './navigation/NavigationHUD.js';

// PULP-DroNet Obstacle Avoidance & Perception Sensor Suite
import { FixedObstacleManager } from './environment/FixedObstacle.js';
import { DroneCameraSensor } from './sensors/DroneCameraSensor.js';
import { DronePerceptionSuite } from './sensors/DronePerceptionSuite.js';
import { ObstacleAvoidanceSystem } from './navigation/ObstacleAvoidanceSystem.js';
import { ObstacleHUD } from './drone/ObstacleHUD.js';
import { WeatherSystem } from './environment/WeatherSystem.js';

// ── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

MaterialManager.initRendererCapabilities(renderer);

// ── Scene & Camera ──────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.2, 3500);

// ── Physics ─────────────────────────────────────────────────────────────────
const collisionSystem = new CollisionSystem(null);

// ── World ───────────────────────────────────────────────────────────────────
const world = new World(scene, collisionSystem);
await world.init();
collisionSystem.terrain = world.terrain;

// ── Drone model ─────────────────────────────────────────────────────────────
const drone = new Drone();
scene.add(drone.mesh);

// ── Manual flight controller ────────────────────────────────────────────────
const flightController = new FlightController(drone, collisionSystem);

// ── Navigation / GRU components ─────────────────────────────────────────────
const eskf = new ESKF();
const gruBridge = new GRUBridge({ correctionInterval: 3.0 });
const routeController = new RouteController(
  world.terrain,
  scene,
  { minX: -750, maxX: 750, minZ: -750, maxZ: 750 },
  () => routeController.isFlying ? drone.mesh.position : flightController.position
);

// ── HUDs ────────────────────────────────────────────────────────────────────
const hud = new DroneHUD();
const navHud = new NavigationHUD(() => routeController.toggleRouteMode());

// ── Sensor interface ────────────────────────────────────────────────────────
const sensors = new SensorInterface(scene, drone);

// ── Fixed Traversable Obstacles & PULP-DroNet Avoidance Suite ──────────────
const fixedObstacleManager = new FixedObstacleManager(scene, collisionSystem);
fixedObstacleManager.spawnDefaultObstacles();

const droneCameraSensor = new DroneCameraSensor(drone, { resolution: 200, fov: 75 });
const perceptionSuite = new DronePerceptionSuite(scene, drone);
const obstacleAvoidance = new ObstacleAvoidanceSystem(drone, droneCameraSensor, perceptionSuite, fixedObstacleManager, { scene, collisionSystem });
const obstacleHud = new ObstacleHUD(droneCameraSensor);

// ── Weather & Atmospheric System (Default: CLEAR SKY, Fog is OFF) ─────────
const weatherSystem = new WeatherSystem(
  scene,
  world.lighting,
  world.skyDome,
  routeController,
  droneCameraSensor
);

// Connect HUD Weather Toggle Buttons
hud.onToggleFog = () => {
  weatherSystem.toggleFog();
};

hud.onToggleRain = () => {
  weatherSystem.toggleRain();
};

weatherSystem.onStateChange((tele) => {
  hud.setWeatherStatus(tele);
});

// Key 'F' toggle Fog environment
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') {
    weatherSystem.toggleFog();
  }
});

// Key 'R' toggle Rain environment
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR') {
    weatherSystem.toggleRain();
  }
});

// Key 'L' toggle 3D laser beams
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyL') {
    perceptionSuite.toggleLaserBeams();
  }
});

// ── State for smooth visual correction lerping ─────────────────────────────
let isVisualLerping = false;
let visualLerpElapsed = 0;
const VISUAL_LERP_TIME = 0.3; // 300ms smooth visual absorption of delta_v
const preCorrectionPos = new THREE.Vector3();

// ── Camera tracking state for route flight ──────────────────────────────────
const idealCamPos = new THREE.Vector3();
const idealLookAt = new THREE.Vector3();

// ── Key: S = Start autonomous flight ───────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyS') {
    if (routeController.hasRoute()) {
      routeController.closePanel();

      const wp0 = routeController.routePointsWorld[0];
      const wp1 = routeController.routePointsWorld[1] || wp0;

      // 1. Compute initial heading towards next waypoint
      const dir = new THREE.Vector3().subVectors(wp1, wp0);
      const heading = dir.lengthSq() > 0.01 ? Math.atan2(-dir.x, -dir.z) : 0;

      // 2. Position drone directly at start waypoint
      drone.mesh.position.copy(wp0);
      drone.mesh.rotation.set(0, heading, 0, 'YXZ');

      // 3. Immediately position camera behind drone at start waypoint (NO clipping, NO blank screen!)
      const startCamOffset = new THREE.Vector3(0, 1.4, 3.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
      camera.position.copy(wp0).add(startCamOffset);
      camera.lookAt(wp0.clone().add(new THREE.Vector3(0, 0.4, 0)));

      // 4. Reset ESKF filter at starting position with matching initial heading
      eskf.reset([wp0.x, wp0.y, wp0.z], [0, 0, 0], heading);

      // 5. Sync flight controller position as fallback
      flightController.position.copy(wp0);
      flightController.velocity.set(0, 0, 0);
      flightController.rotation.y = heading;

      // 6. Reset visual correction state
      isVisualLerping = false;
      preCorrectionPos.copy(wp0);

      // 7. Update terrain chunks around starting point immediately
      world.update(0.01, wp0);

      // 8. Launch autonomous route flight
      routeController.startFlight(wp0, eskf);

      console.log('[Main] Autonomous route flight initiated at wp0:', wp0);
    } else {
      navHud.update({ mode: 'IDLE', noRoute: true });
      setTimeout(() => navHud.update({ noRoute: false }), 3000);
    }
  }
});

// ── Fixed simulation accumulator (100 Hz decoupled from render) ─────────────
const FIXED_DT = 0.01;
let fixedAccumulator = 0;

// ── Resize handler ──────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── FPS tracking ─────────────────────────────────────────────────────────────
let lastTime = performance.now();
let frameCount = 0;
let currentFps = 60;

// ── Main animation loop ─────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  fixedAccumulator += delta;

  // FPS Counter
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 500) {
    currentFps = Math.round((frameCount * 1000) / (now - lastTime));
    frameCount = 0;
    lastTime = now;
  }

  // ── 1. Fixed-step 100 Hz simulation loop ─────────────────────────────────
  while (fixedAccumulator >= FIXED_DT) {
    fixedAccumulator -= FIXED_DT;

    if (routeController.isFlying) {
      // Step autonomous flight controller + IMU synthesis + ESKF predict
      routeController.fixedSimulationStep(FIXED_DT, eskf, gruBridge);

      // Async GRU bridge call (runs every 3.0s, applies delta_v via ESKF update)
      gruBridge.maybeRunGRU(FIXED_DT, eskf, (result) => {
        // Smoothly absorb correction visually over 0.3s (README Section 12)
        preCorrectionPos.copy(drone.mesh.position);
        isVisualLerping = true;
        visualLerpElapsed = 0;
      });

      // Update mesh position from ESKF estimated state
      if (!isVisualLerping) {
        drone.mesh.position.set(eskf.p[0], eskf.p[1], eskf.p[2]);
      }

      // Update mesh rotation from banking dynamics
      drone.mesh.rotation.set(
        routeController.dronePitch,
        routeController.droneHeading,
        routeController.droneRoll,
        'YXZ'
      );
    } else {
      // Manual flight: keep ESKF synced with hover specific force (+1g upward)
      const acc = [0, 9.80665, 0];
      const gyro = [0, 0, 0];
      eskf.predict(acc, gyro, FIXED_DT);
      eskf.p = [flightController.position.x, flightController.position.y, flightController.position.z];
      eskf.v = [flightController.velocity.x, flightController.velocity.y, flightController.velocity.z];
    }
  }

  // ── 2. Visual lerp toward corrected position (visual only) ────────────────
  if (isVisualLerping && routeController.isFlying) {
    visualLerpElapsed += delta;
    const alpha = THREE.MathUtils.clamp(visualLerpElapsed / VISUAL_LERP_TIME, 0, 1);
    const correctedTarget = new THREE.Vector3(eskf.p[0], eskf.p[1], eskf.p[2]);
    drone.mesh.position.lerpVectors(preCorrectionPos, correctedTarget, alpha);
    if (alpha >= 1) isVisualLerping = false;
  }

  // ── 3. Camera & Rendering Updates ─────────────────────────────────────────
  if (routeController.isFlying) {
    const dronePos = drone.mesh.position;
    const heading  = routeController.droneHeading;

    // Smooth third-person chase camera aligned with drone heading
    // Sits 3.2m behind and 1.3m above for ideal visibility of drone & route
    const camOffset = new THREE.Vector3(0, 1.3, 3.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    idealCamPos.copy(dronePos).add(camOffset);
    idealLookAt.copy(dronePos).add(new THREE.Vector3(0, 0.3, 0));

    camera.position.lerp(idealCamPos, Math.min(1.0, delta * 7.0));
    camera.lookAt(idealLookAt);

    // Keep propellers spinning realistically
    const currentSpeed = new THREE.Vector3(eskf.v[0], eskf.v[1], eskf.v[2]).length();
    const throttle = Math.min(1.0, 0.45 + (currentSpeed / routeController.maxSpeed) * 0.55);
    drone.update(delta, throttle, routeController.dronePitch, routeController.droneRoll);

    // Update chunk streaming around drone
    world.update(delta, dronePos);
  } else {
    // Manual flight mode
    flightController.update(delta);
    flightController.updateCamera(camera);
    world.update(delta, flightController.position);
  }

  // ── 4. Weather, Sensor & HUD Updates ─────────────────────────────────────
  const activeDronePos = routeController.isFlying ? drone.mesh.position : flightController.position;
  weatherSystem.update(delta, activeDronePos);
  sensors.updateSensors();
  perceptionSuite.updateSensors();
  droneCameraSensor.update(delta, renderer, scene);
  obstacleAvoidance.update(delta, flightController, routeController);
  obstacleHud.update(obstacleAvoidance.getTelemetry(), perceptionSuite.getTelemetry());

  hud.setWeatherStatus(weatherSystem.getTelemetry());
  if (!routeController.isFlying) {
    const telemetry = flightController.getTelemetry(world.terrain);
    hud.update(telemetry, collisionSystem.hasCollided, currentFps);
  }

  // Navigation HUD
  const gruSt = gruBridge.getStatus();
  const navMode = routeController.routeMode ? 'ROUTE'
                : routeController.isHovering ? 'HOVER'
                : routeController.isFlying  ? 'RUNNING'
                : 'MANUAL';

  navHud.update({
    mode:        navMode,
    gruStatus:   gruSt.bridgeReady ? gruSt.status : 'OFFLINE',
    lastDeltaV:  gruSt.lastDeltaV,
    nextUpdateIn: gruSt.nextUpdateIn,
    nis:         gruSt.lastNIS,
    gate:        gruSt.lastGateResult,
    routeDist:   routeController.isFlying ? routeController.distanceFromRoute() : null,
    progress:    routeController.isFlying ? routeController.completionProgress : null,
    noRoute:     false,
  });

  // ── 5. Render Scene ───────────────────────────────────────────────────────
  renderer.render(scene, camera);
}

animate();
console.log('[DroneSim] Simulation loop active. Press M to open route planner, S to start.');
