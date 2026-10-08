import * as THREE from 'three';

/**
 * ObstacleAvoidanceSystem.js
 *
 * Implements comprehensive multi-type obstacle avoidance, target identification,
 * and controlled approach maneuvers powered by PULP-DroNet v3.
 *
 * Key Capabilities:
 * 1. Universal Obstacle Avoidance:
 *    - Scans and accounts for ALL stationary obstacle types: city buildings, skyscrapers,
 *      warehouses, residential homes, bridges, pylons, and test barriers.
 * 2. Target Identification:
 *    - Automatically acquires and tracks any obstacle or building ahead as an active target.
 *    - Extracts Target ID, classification (BUILDING, BARRIER, BRIDGE), exact 3D dimensions (W x H x D),
 *      distance, and relative bearing.
 * 3. Controlled Approach Maneuver:
 *    - Regulates forward approach velocity smoothly based on target distance and DroNet collision risk.
 *    - Performs steady attitude stabilization as the drone approaches the target object.
 *    - Smoothly transitions to optimal nearest-bypass detour upon reaching proximity threshold.
 * 4. Priority Over Path-Following:
 *    - Takes absolute precedence during autonomous flight without touching or disrupting RouteController.
 */
export class ObstacleAvoidanceSystem {
  constructor(drone, cameraSensor, perceptionSuite, fixedObstacleManager, options = {}) {
    this.drone = drone;
    this.cameraSensor = cameraSensor;
    this.perceptionSuite = perceptionSuite;
    this.fixedObstacleManager = fixedObstacleManager;
    this.collisionSystem = options.collisionSystem || (fixedObstacleManager ? fixedObstacleManager.collisionSystem : null);
    this.scene = options.scene || null;

    this.serverUrl = options.serverUrl || 'http://127.0.0.1:8766/dronet/infer';
    this.healthUrl = options.healthUrl || 'http://127.0.0.1:8766/dronet/health';

    // State parameters
    this.enabled = true;
    this.status = 'CLEAR'; // 'CLEAR', 'APPROACH_MANEUVER', 'BYPASSING_LEFT', 'BYPASSING_RIGHT', 'BYPASSING_OVER', 'RETURNING'

    // DroNet Predictions
    this.collisionProb = 0.0;    // P_coll in [0.0, 1.0]
    this.steeringAngle = 0.0;    // Steering in [-1.0, 1.0]
    this.lastInferenceTimeMs = 0;
    this.inferenceCount = 0;
    this.serverOnline = false;

    // Inference scheduling
    this.inferenceCadence = 0.08; // ~12.5 Hz
    this.timeSinceInfer = 0;
    this.isInferring = false;

    // Target Identification
    this.activeTarget = null; // { id, type, obstacle, distance, lateralDist, dimensions }
    this.targetLockEnabled = true; // Key 'T' toggle
    this.approachManeuverActive = false;

    // Active Bypass State
    this.isBypassing = false;
    this.activeBypass = null; // { type, obstacle, flankPoint, exitPoint, currentStage }
    this.bypassProgress = 0; // 0 to 100%

    // 3D Visual Bypass Trajectory in Scene
    this.bypassVisualGroup = new THREE.Group();
    this.bypassVisualGroup.name = 'bypass_trajectory_visual';
    if (this.scene) {
      this.scene.add(this.bypassVisualGroup);
    }
    this.initBypassVisuals();

    this.checkServerHealth();
    this.initKeyboard();
  }

  initBypassVisuals() {
    const mat = new THREE.LineDashedMaterial({
      color: 0x00e5ff,
      dashSize: 1.5,
      gapSize: 0.8,
      linewidth: 3,
      transparent: true,
      opacity: 0.85
    });
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    this.bypassLine = new THREE.Line(geom, mat);
    this.bypassLine.computeLineDistances();
    this.bypassVisualGroup.add(this.bypassLine);
    this.bypassVisualGroup.visible = false;
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyO') {
        this.enabled = !this.enabled;
        if (!this.enabled && this.isBypassing) {
          this.abortBypass();
        }
        console.log(`[Obstacle Avoidance] System ${this.enabled ? 'ENGAGED (Priority ON)' : 'DISENGAGED'}`);
      } else if (e.code === 'KeyT') {
        this.targetLockEnabled = !this.targetLockEnabled;
        console.log(`[Obstacle Avoidance] Target Lock & Approach Maneuver: ${this.targetLockEnabled ? 'ACTIVE' : 'STANDBY'}`);
      }
    });
  }

  async checkServerHealth() {
    try {
      const res = await fetch(this.healthUrl, { method: 'GET', signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        this.serverOnline = data.ok === true;
        console.log('[Obstacle Avoidance] PULP-DroNet service online:', data.model);
      }
    } catch {
      this.serverOnline = false;
    }
  }

  /**
   * Main per-frame update loop.
   */
  update(delta, flightController, routeController) {
    if (!this.enabled) {
      this.status = 'DISENGAGED';
      this.bypassVisualGroup.visible = false;
      this.activeTarget = null;
      this.approachManeuverActive = false;
      return;
    }

    this.timeSinceInfer += delta;

    // Trigger DroNet inference
    if (this.timeSinceInfer >= this.inferenceCadence && !this.isInferring) {
      this.timeSinceInfer = 0;
      this.runInference();
    }

    // Evaluate obstacles of all types, identify targets, and execute approach / bypass maneuvers
    this.evaluateAndNavigateObstacles(delta, flightController, routeController);
  }

  /**
   * Executes PULP-DroNet inference using compact base64 image data or flat array.
   */
  async runInference() {
    this.isInferring = true;
    try {
      if (this.serverOnline) {
        let payload = null;
        const canvas = this.cameraSensor.getCanvas();
        if (canvas && canvas.toDataURL) {
          const b64 = canvas.toDataURL('image/jpeg', 0.65);
          payload = JSON.stringify({ image_base64: b64 });
        } else {
          payload = JSON.stringify({ pixels_flat: this.cameraSensor.getGrayscaleFloatArray() });
        }

        const res = await fetch(this.serverUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: AbortSignal.timeout(1000)
        });

        if (res.ok) {
          const data = await res.json();
          this.collisionProb = THREE.MathUtils.lerp(this.collisionProb, data.collision_prob, 0.45);
          this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, data.steering, 0.45);
          this.lastInferenceTimeMs = data.inference_time_ms;
          this.inferenceCount++;
        } else {
          this.fallbackPerception();
        }
      } else {
        this.fallbackPerception();
      }
    } catch {
      this.fallbackPerception();
    } finally {
      this.isInferring = false;
    }
  }

  fallbackPerception() {
    const tele = this.perceptionSuite.getTelemetry();
    const forwardDist = tele.forwardClearance;

    let estColl = 0.0;
    if (forwardDist < 10.0) {
      estColl = 1.0;
    } else if (forwardDist < 35.0) {
      estColl = 1.0 - (forwardDist - 10.0) / 25.0;
    } else {
      estColl = 0.0;
    }

    const leftDist = tele.leftFlank;
    const rightDist = tele.rightFlank;
    let estSteer = 0.0;
    if (leftDist < 6.0 || rightDist < 6.0) {
      estSteer = (leftDist < rightDist) ? 0.5 : -0.5;
    }

    this.collisionProb = THREE.MathUtils.lerp(this.collisionProb, estColl, 0.35);
    this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, estSteer, 0.35);
    this.lastInferenceTimeMs = 1.2;
    this.inferenceCount++;
  }

  /**
   * Scans all stationary obstacle types (buildings, towers, bridges, barriers) in the drone's path.
   * Restricts search to a realistic 3.0m flight corridor half-width.
   */
  scanAllObstacleTypes(dronePos, forwardDir) {
    const candidates = [];
    const corridorHalfWidth = 3.0; // 3.0m tight corridor half-width

    // 1. Scan Fixed Obstacle Manager (barriers/gates)
    if (this.fixedObstacleManager) {
      const fixedObs = this.fixedObstacleManager.getObstacleInPath(dronePos, forwardDir, 180.0, corridorHalfWidth);
      if (fixedObs) {
        candidates.push({
          id: fixedObs.obstacle.id,
          type: 'BARRIER',
          obstacle: fixedObs.obstacle,
          distance: fixedObs.distance,
          lateralDist: fixedObs.lateralDist,
          dimensions: fixedObs.obstacle.dimensions,
          centerWorld: fixedObs.obstacle.centerWorld
        });
      }
    }

    // 2. Scan CollisionSystem (ALL solid static buildings, skyscrapers, warehouses, houses, bridges)
    if (this.collisionSystem && this.collisionSystem.getObstaclesInForwardCone) {
      const bldgList = this.collisionSystem.getObstaclesInForwardCone(dronePos, forwardDir, 180.0, corridorHalfWidth);
      bldgList.forEach((b) => {
        candidates.push({
          id: b.obstacle.id,
          type: b.obstacle.type || 'BUILDING',
          obstacle: b.obstacle,
          distance: b.distance,
          lateralDist: b.lateralDist,
          dimensions: b.obstacle.dimensions,
          centerWorld: b.obstacle.centerWorld
        });
      });
    }

    // Sort by distance (closest first)
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Calculates the nearest, safest bypass path around an obstacle of ANY type by analyzing
   * its full 3D bounding geometry, approach flight vector, and surrounding obstacle clearance.
   */
  calculateNearestBypassPath(obstacle, dronePos, forwardDir) {
    const box = obstacle.box3;
    const SAFETY_MARGIN = 6.5; // 6.5m safe buffer around solid building/obstacle

    // Flight frame vectors in horizontal plane
    const uFwd = new THREE.Vector3(forwardDir.x, 0, forwardDir.z).normalize();
    if (uFwd.lengthSq() < 0.001) uFwd.set(0, 0, -1);
    const uRight = new THREE.Vector3(uFwd.z, 0, -uFwd.x); // Perpendicular right horizontal vector

    // Bounding box horizontal 4 corners
    const corners = [
      new THREE.Vector3(box.min.x, dronePos.y, box.min.z),
      new THREE.Vector3(box.min.x, dronePos.y, box.max.z),
      new THREE.Vector3(box.max.x, dronePos.y, box.min.z),
      new THREE.Vector3(box.max.x, dronePos.y, box.max.z),
    ];

    let minFwd = Infinity, maxFwd = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    corners.forEach(c => {
      const rel = new THREE.Vector3().subVectors(c, dronePos);
      const fwdProj = rel.dot(uFwd);
      const latProj = rel.dot(uRight);
      if (fwdProj < minFwd) minFwd = fwdProj;
      if (fwdProj > maxFwd) maxFwd = fwdProj;
      if (latProj < minLat) minLat = latProj;
      if (latProj > maxLat) maxLat = latProj;
    });

    const distToFront = Math.max(0, minFwd);
    const fwdEntry = Math.max(6.0, distToFront * 0.45); // Safely before front face
    const fwdFlank = (minFwd + maxFwd) * 0.5;           // Beside center of obstacle
    const fwdExit = maxFwd + SAFETY_MARGIN + 6.0;        // Past rear face along flight direction

    const leftOffset = minLat - SAFETY_MARGIN;          // Clear left of all corners
    const rightOffset = maxLat + SAFETY_MARGIN;         // Clear right of all corners

    // ── Candidate 1: LEFT FLANK CORRIDOR (3 waypoints: Entry -> Flank -> Exit) ──
    const leftWp0 = dronePos.clone().addScaledVector(uFwd, fwdEntry).addScaledVector(uRight, leftOffset * 0.75);
    const leftWp1 = dronePos.clone().addScaledVector(uFwd, fwdFlank).addScaledVector(uRight, leftOffset);
    const leftWp2 = dronePos.clone().addScaledVector(uFwd, fwdExit).addScaledVector(uRight, leftOffset * 0.35);

    // ── Candidate 2: RIGHT FLANK CORRIDOR (3 waypoints: Entry -> Flank -> Exit) ──
    const rightWp0 = dronePos.clone().addScaledVector(uFwd, fwdEntry).addScaledVector(uRight, rightOffset * 0.75);
    const rightWp1 = dronePos.clone().addScaledVector(uFwd, fwdFlank).addScaledVector(uRight, rightOffset);
    const rightWp2 = dronePos.clone().addScaledVector(uFwd, fwdExit).addScaledVector(uRight, rightOffset * 0.35);

    // ── Candidate 3: OVER THE TOP (3 waypoints: Climb -> Roof -> Descend) ──
    const roofY = box.max.y + SAFETY_MARGIN;
    const topWp0 = dronePos.clone().addScaledVector(uFwd, fwdEntry);
    topWp0.y = THREE.MathUtils.lerp(dronePos.y, roofY, 0.75);
    const topWp1 = dronePos.clone().addScaledVector(uFwd, fwdFlank);
    topWp1.y = roofY;
    const topWp2 = dronePos.clone().addScaledVector(uFwd, fwdExit);
    topWp2.y = THREE.MathUtils.lerp(roofY, dronePos.y, 0.4);

    // Neighbor collision check: verify candidate waypoints are not inside adjacent structures
    const leftBlocked = this.collisionSystem ? (
      this.collisionSystem.isPointObstructed(leftWp0, 3.5) ||
      this.collisionSystem.isPointObstructed(leftWp1, 3.5) ||
      this.collisionSystem.isPointObstructed(leftWp2, 3.5)
    ) : false;

    const rightBlocked = this.collisionSystem ? (
      this.collisionSystem.isPointObstructed(rightWp0, 3.5) ||
      this.collisionSystem.isPointObstructed(rightWp1, 3.5) ||
      this.collisionSystem.isPointObstructed(rightWp2, 3.5)
    ) : false;

    const topBlocked = this.collisionSystem ? (
      this.collisionSystem.isPointObstructed(topWp0, 3.5) ||
      this.collisionSystem.isPointObstructed(topWp1, 3.5) ||
      this.collisionSystem.isPointObstructed(topWp2, 3.5)
    ) : false;

    // Distances & cost evaluation
    const distLeft = leftBlocked ? Infinity : Math.abs(leftOffset) + (fwdExit - minFwd);
    const distRight = rightBlocked ? Infinity : Math.abs(rightOffset) + (fwdExit - minFwd);
    const climbHeight = Math.max(0, roofY - dronePos.y);
    const distTop = topBlocked ? Infinity : (climbHeight * 2.2) + (fwdExit - minFwd);

    let candidate = null;
    if (distLeft <= distRight && distLeft <= distTop && distLeft < Infinity) {
      candidate = {
        type: 'LEFT',
        waypoints: [leftWp0, leftWp1, leftWp2],
        totalDist: distLeft
      };
    } else if (distRight <= distLeft && distRight <= distTop && distRight < Infinity) {
      candidate = {
        type: 'RIGHT',
        waypoints: [rightWp0, rightWp1, rightWp2],
        totalDist: distRight
      };
    } else if (distTop < Infinity) {
      candidate = {
        type: 'OVER_TOP',
        waypoints: [topWp0, topWp1, topWp2],
        totalDist: distTop
      };
    } else {
      // Fallback: pick the lateral direction with smaller displacement
      const fallbackWps = (Math.abs(leftOffset) <= Math.abs(rightOffset))
        ? [leftWp0, leftWp1, leftWp2]
        : [rightWp0, rightWp1, rightWp2];
      candidate = {
        type: (Math.abs(leftOffset) <= Math.abs(rightOffset)) ? 'LEFT' : 'RIGHT',
        waypoints: fallbackWps,
        totalDist: 999
      };
    }

    candidate.obstacle = obstacle;
    candidate.stageIndex = 0;
    candidate.stageNames = ['ENTRY_CLEAR', 'FLANK_CLEAR', 'EXIT_CLEAR'];
    candidate.currentWaypoint = candidate.waypoints[0];
    candidate.startPos = dronePos.clone();

    return candidate;
  }

  /**
   * Main navigation, approach maneuver, and avoidance evaluation.
   */
  evaluateAndNavigateObstacles(delta, flightController, routeController) {
    const dronePos = this.drone.mesh.position;
    const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.drone.mesh.quaternion).normalize();

    // 1. Scan for any obstacle or building in forward path
    const targetObj = this.scanAllObstacleTypes(dronePos, forwardDir);
    this.activeTarget = targetObj;

    // Update Camera Sensor visual target overlay
    this.cameraSensor.setDetectedObstacle(targetObj);

    // 2. If actively executing a bypass detour:
    if (this.isBypassing && this.activeBypass) {
      const b = this.activeBypass;
      const targetWP = b.currentWaypoint;
      const distToTarget = dronePos.distanceTo(targetWP);

      // Speed-scaled dynamic acceptance radius
      const droneSpeed = (routeController && routeController.isFlying)
        ? 12.0
        : (flightController ? flightController.velocity.length() : 8.0);
      const acceptRadius = Math.max(7.0, droneSpeed * 0.70);

      // Along-track segment projection: advance immediately if drone passed waypoint
      let passedWaypoint = false;
      const prevWP = (b.stageIndex === 0) ? b.startPos : b.waypoints[b.stageIndex - 1];
      const segVec = new THREE.Vector3().subVectors(targetWP, prevWP);
      const toDrone = new THREE.Vector3().subVectors(dronePos, targetWP);
      if (segVec.lengthSq() > 1.0) {
        segVec.normalize();
        if (toDrone.dot(segVec) > 0.4) passedWaypoint = true;
      }

      if (distToTarget < acceptRadius || passedWaypoint) {
        b.stageIndex++;
        if (b.stageIndex < b.waypoints.length) {
          b.currentWaypoint = b.waypoints[b.stageIndex];
          console.log(`[Obstacle Avoidance] Advanced to ${b.stageNames[b.stageIndex]} (${b.stageIndex + 1}/${b.waypoints.length})`);
        } else {
          console.log(`[Obstacle Avoidance] Target ${b.obstacle.id} completely bypassed! Resuming route.`);
          this.completeBypass(routeController);
          return;
        }
      }

      // Bypass progress calculation
      this.bypassProgress = Math.round((b.stageIndex / b.waypoints.length) * 100);
      this.status = `BYPASSING_${b.type}`;
      this.approachManeuverActive = false;

      this.updateVisualBypassPath(dronePos, b.waypoints);

      // Apply bypass control commands
      if (routeController && routeController.isFlying) {
        routeController.setBypassOverride(b.currentWaypoint);
      } else if (flightController) {
        // Guided manual flight along bypass corridor
        const toWp = new THREE.Vector3().subVectors(b.currentWaypoint, dronePos);
        const desiredHeading = Math.atan2(-toWp.x, -toWp.z);
        flightController.rotation.y = THREE.MathUtils.lerp(flightController.rotation.y, desiredHeading, delta * 4.5);

        const horizDir = new THREE.Vector3(toWp.x, 0, toWp.z).normalize();
        flightController.velocity.x = THREE.MathUtils.lerp(flightController.velocity.x, horizDir.x * 9.0, delta * 3.5);
        flightController.velocity.z = THREE.MathUtils.lerp(flightController.velocity.z, horizDir.z * 9.0, delta * 3.5);
        if (b.type === 'OVER_TOP') {
          flightController.velocity.y = THREE.MathUtils.lerp(flightController.velocity.y, (toWp.y > 0 ? 5.0 : -2.0), delta * 4.0);
        }
      }

      return;
    }

    // 3. Controlled Approach Maneuver & Standoff Evaluation
    const tele = this.perceptionSuite.getTelemetry();
    const hasTarget = targetObj !== null;

    // Active repulsive deflection in manual mode ONLY if obstacle is directly ahead in flight path
    if (flightController && !routeController?.isFlying && hasTarget) {
      const dist = targetObj.distance;
      const lateral = targetObj.lateralDist || 0;
      if (dist < 28.0 && lateral < 3.0) {
        const toDroneHoriz = new THREE.Vector3(
          dronePos.x - targetObj.centerWorld.x,
          0,
          dronePos.z - targetObj.centerWorld.z
        ).normalize();
        const repulseStrength = Math.min(10.0, (28.0 - dist) * 0.50);
        flightController.velocity.addScaledVector(toDroneHoriz, repulseStrength * delta * 4.0);
      }
    }

    if (hasTarget && targetObj.distance < 90.0) {
      const dist = targetObj.distance;

      // Controlled Approach Maneuver:
      // Regulates approach velocity smoothly based on distance & DroNet collision risk
      this.approachManeuverActive = true;
      const approachFactor = Math.max(0.18, Math.min(1.0, (dist - 14.0) / 50.0) * (1.0 - this.collisionProb * 0.70));

      // Slow down manual flight smoothly as target closes
      if (flightController && !routeController?.isFlying) {
        if (dist < 45.0) {
          flightController.velocity.multiplyScalar(Math.max(0.92, 0.95 * approachFactor));
        }
      }

      // Check if within standoff trigger zone to initiate bypass detour
      let shouldTriggerBypass = false;

      if (routeController && routeController.isFlying) {
        // Autonomous Route Flight:
        // Priority: Follow designated path precisely without veering off course!
        // ONLY trigger bypass detour if the route path actually penetrates this obstacle,
        // or if forward camera / LiDAR detects imminent collision directly ahead
        const pathBlocked = this.isObstacleBlockingRoute(targetObj.obstacle, routeController, dronePos);
        const urgentVisualColl = this.collisionProb > 0.55 && tele.forwardClearance < 28.0;

        if ((pathBlocked && dist < 32.0) || urgentVisualColl) {
          shouldTriggerBypass = true;
        }
      } else {
        // Manual Flight: trigger standoff bypass when approaching within 30m or high collision risk
        if (dist < 30.0 || (this.collisionProb > 0.50 && tele.forwardClearance < 30.0)) {
          shouldTriggerBypass = true;
        }
      }

      if (shouldTriggerBypass) {
        // Calculate nearest bypass path around this target (building or barrier)
        this.activeBypass = this.calculateNearestBypassPath(targetObj.obstacle, dronePos, forwardDir);
        this.isBypassing = true;
        this.bypassProgress = 0;
        this.status = `BYPASSING_${this.activeBypass.type}`;
        this.approachManeuverActive = false;

        console.log(`[Obstacle Avoidance] Target acquired: ${targetObj.id} (${targetObj.type}) at ${dist.toFixed(1)}m`);
        console.log(`[Obstacle Avoidance] Dimensions: ${targetObj.dimensions.width.toFixed(1)}x${targetObj.dimensions.height.toFixed(1)}x${targetObj.dimensions.depth.toFixed(1)}m`);
        console.log(`[Obstacle Avoidance] Executing optimal bypass: [${this.activeBypass.type}]`);

        if (routeController && routeController.isFlying) {
          routeController.setBypassOverride(this.activeBypass.currentWaypoint);
        }

        this.bypassVisualGroup.visible = true;
      } else {
        this.status = `APPROACHING [${targetObj.id}]`;
        this.bypassVisualGroup.visible = false;
      }

    } else {
      this.approachManeuverActive = false;
      this.status = 'CLEAR';
      this.bypassVisualGroup.visible = false;
    }
  }

  /**
   * Tests whether an obstacle's 3D bounding envelope directly obstructs the planned route ahead.
   */
  isObstacleBlockingRoute(obstacle, routeController, dronePos) {
    if (!routeController || !routeController.isFlying || !routeController.routePointsWorld) {
      return true;
    }
    const waypoints = routeController.routePointsWorld;
    const curIdx = routeController.routeIndex || 0;
    if (curIdx >= waypoints.length) return false;

    // Safety clearance buffer around obstacle (2.5m)
    const expandedBox = obstacle.box3.clone().expandByScalar(2.5);

    // Test line segments from drone to next waypoint, and along next 3 segments ahead
    const lookaheadCount = Math.min(waypoints.length - 1, curIdx + 3);
    let prevPoint = dronePos;

    for (let i = curIdx; i <= lookaheadCount; i++) {
      const nextPoint = waypoints[i];
      const dir = new THREE.Vector3().subVectors(nextPoint, prevPoint);
      const segLen = dir.length();
      if (segLen > 0.01) {
        dir.normalize();
        const ray = new THREE.Ray(prevPoint, dir);
        const hit = ray.intersectBox(expandedBox, new THREE.Vector3());
        if (hit && prevPoint.distanceTo(hit) <= segLen) {
          return true; // Path segment penetrates this obstacle!
        }
      }
      prevPoint = nextPoint;
    }
    return false; // Route path passes clear of this obstacle
  }

  updateVisualBypassPath(dronePos, waypoints) {
    if (!this.bypassLine || !waypoints || waypoints.length < 3) return;
    const pts = [dronePos, waypoints[0], waypoints[1], waypoints[2]];
    const pos = this.bypassLine.geometry.attributes.position.array;
    for (let i = 0; i < 4; i++) {
      pos[i * 3]     = pts[i].x;
      pos[i * 3 + 1] = pts[i].y;
      pos[i * 3 + 2] = pts[i].z;
    }
    this.bypassLine.geometry.attributes.position.needsUpdate = true;
    this.bypassLine.computeLineDistances();
    this.bypassVisualGroup.visible = true;
  }

  completeBypass(routeController) {
    this.isBypassing = false;
    this.activeBypass = null;
    this.bypassProgress = 100;
    this.status = 'RETURNING';
    this.approachManeuverActive = false;
    this.bypassVisualGroup.visible = false;

    if (routeController) {
      routeController.clearBypassOverride();
      console.log('[Obstacle Avoidance] Priority returned to route-following system.');
    }

    setTimeout(() => {
      if (!this.isBypassing) this.status = 'CLEAR';
    }, 2000);
  }

  abortBypass() {
    this.isBypassing = false;
    this.activeBypass = null;
    this.bypassProgress = 0;
    this.status = 'CLEAR';
    this.approachManeuverActive = false;
    this.bypassVisualGroup.visible = false;
  }

  getTelemetry() {
    return {
      enabled: this.enabled,
      status: this.status,
      collisionProb: this.collisionProb,
      steeringAngle: this.steeringAngle,
      inferenceTimeMs: this.lastInferenceTimeMs,
      inferenceCount: this.inferenceCount,
      serverOnline: this.serverOnline,
      isBypassing: this.isBypassing,
      bypassType: this.activeBypass ? this.activeBypass.type : 'NONE',
      bypassProgress: this.bypassProgress,
      activeTarget: this.activeTarget,
      approachManeuverActive: this.approachManeuverActive,
      targetLockEnabled: this.targetLockEnabled
    };
  }
}
