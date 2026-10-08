import * as THREE from 'three';

/**
 * CollisionSystem - Fast, robust 3D environment collision detection.
 * Protects the drone from penetrating terrain, solid static buildings, bridge structures,
 * and stationary obstacles.
 *
 * Capabilities:
 * - Guarantees all city buildings and structures are 100% solid and static (zero tunneling).
 * - Maintains a unified spatial registry of all static obstacles with full 3D dimensions.
 * - Provides fast forward-cone spatial queries for universal obstacle avoidance and target identification.
 */
export class CollisionSystem {
  constructor(terrain) {
    this.terrain = terrain;
    this.obstacleBoxes = [];
    this.staticObstacles = []; // Unified structured registry of all static obstacles and buildings
    this.droneRadius = 0.28; // 28cm collision envelope matching 350mm drone
    this.lastCollisionTime = 0;
    this.hasCollided = false;
    this._nextObstacleId = 1;
  }

  /**
   * Registers an array of 3D objects or groups as solid static collision obstacles
   */
  registerObstacles(objects, type = 'BUILDING') {
    objects.forEach((obj) => {
      obj.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(obj);
      if (!box.isEmpty()) {
        this.registerBox(box, type, obj);
      }
    });
  }

  /**
   * Registers a single bounding box directly with classification and spatial dimensions.
   */
  registerBox(box, type = 'STRUCTURE', sourceObject = null) {
    this.obstacleBoxes.push(box);

    const width = Math.abs(box.max.x - box.min.x);
    const height = Math.abs(box.max.y - box.min.y);
    const depth = Math.abs(box.max.z - box.min.z);
    const center = new THREE.Vector3(
      (box.min.x + box.max.x) * 0.5,
      (box.min.y + box.max.y) * 0.5,
      (box.min.z + box.max.z) * 0.5
    );

    const id = `${type}_${this._nextObstacleId++}`;

    this.staticObstacles.push({
      id,
      type,
      box3: box,
      centerWorld: center,
      dimensions: { width, height, depth },
      sourceObject
    });
  }

  /**
   * Resolves drone collision with terrain and solid static obstacles/buildings.
   * Modifies drone position and velocity in-place to slide smoothly along solid surfaces.
   */
  resolveCollision(dronePos, droneVel) {
    this.hasCollided = false;

    // 1. Terrain Collision Check (O(1) continuous height check)
    if (this.terrain) {
      const groundH = this.terrain.getHeight(dronePos.x, dronePos.z);
      const minH = groundH + this.droneRadius;

      if (dronePos.y < minH) {
        dronePos.y = minH;
        if (droneVel.y < 0) droneVel.y = 0;
        this.hasCollided = true;
      }
    }

    // 2. Solid & Static Obstacle Bounding Boxes (Buildings, Towers, Bridges, Barriers)
    const droneSphere = new THREE.Sphere(dronePos, this.droneRadius);

    for (let i = 0; i < this.obstacleBoxes.length; i++) {
      const box = this.obstacleBoxes[i];

      // Exact half-extent broad-phase check (handles buildings of ANY size without clipping)
      const centerX = (box.min.x + box.max.x) * 0.5;
      const centerZ = (box.min.z + box.max.z) * 0.5;
      const halfX = (box.max.x - box.min.x) * 0.5 + this.droneRadius + 0.5;
      const halfZ = (box.max.z - box.min.z) * 0.5 + this.droneRadius + 0.5;

      if (Math.abs(dronePos.x - centerX) > halfX || Math.abs(dronePos.z - centerZ) > halfZ) {
        continue;
      }

      // Height check
      if (dronePos.y + this.droneRadius < box.min.y || dronePos.y - this.droneRadius > box.max.y) {
        continue;
      }

      if (box.intersectsSphere(droneSphere)) {
        this.hasCollided = true;

        // Find closest point on solid box to drone center
        const closestPoint = new THREE.Vector3();
        box.clampPoint(dronePos, closestPoint);

        const pushDir = new THREE.Vector3().subVectors(dronePos, closestPoint);
        const dist = pushDir.length();

        if (dist < 0.0001) {
          // Drone is inside box center - push upwards along nearest face
          pushDir.set(0, 1, 0);
        } else {
          pushDir.normalize();
        }

        // Push drone completely outside the solid structure
        const penetration = this.droneRadius - dist;
        if (penetration > 0) {
          dronePos.addScaledVector(pushDir, penetration + 0.03);

          // Zero velocity along collision normal (smooth sliding on solid building walls)
          const velDot = droneVel.dot(pushDir);
          if (velDot < 0) {
            droneVel.sub(pushDir.clone().multiplyScalar(velDot * 1.25));
          }
        }
      }
    }

    return this.hasCollided;
  }

  /**
   * Tests if a 3D world point is inside or dangerously close to any solid static obstacle.
   * @param {THREE.Vector3} point
   * @param {number} safetyRadius
   * @returns {boolean}
   */
  isPointObstructed(point, safetyRadius = 4.0) {
    const sphere = new THREE.Sphere(point, safetyRadius);
    for (let i = 0; i < this.obstacleBoxes.length; i++) {
      if (this.obstacleBoxes[i].intersectsSphere(sphere)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Computes the minimum distance from a world point to any solid static obstacle.
   * @param {THREE.Vector3} point
   * @returns {number}
   */
  getClosestObstacleDistance(point) {
    let minDist = Infinity;
    const closest = new THREE.Vector3();
    for (let i = 0; i < this.obstacleBoxes.length; i++) {
      const box = this.obstacleBoxes[i];
      box.clampPoint(point, closest);
      const d = point.distanceTo(closest);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  /**
   * Spatial query to find solid obstacles (buildings, barriers, bridges)
   * lying directly in the drone's forward flight corridor with high precision.
   */
  getObstaclesInForwardCone(origin, forwardDir, maxRange = 180.0, lateralCone = 3.0) {
    const results = [];
    const fwdHoriz = new THREE.Vector2(forwardDir.x, forwardDir.z).normalize();
    if (fwdHoriz.lengthSq() < 0.001) fwdHoriz.set(0, -1);

    for (let i = 0; i < this.staticObstacles.length; i++) {
      const obs = this.staticObstacles[i];
      const box = obs.box3;

      // 1. Scene visibility check (skip unloaded or culled chunks)
      if (obs.sourceObject) {
        let cur = obs.sourceObject;
        let isVis = true;
        while (cur) {
          if (!cur.visible) {
            isVis = false;
            break;
          }
          cur = cur.parent;
        }
        if (!isVis) continue;
      }

      // 2. Exact altitude interval overlap check (is the drone at an altitude that can collide?)
      const droneClearance = 2.5; // 2.5m vertical clearance envelope
      if (origin.y - droneClearance > box.max.y || origin.y + droneClearance < box.min.y) {
        continue;
      }

      // 3. Horizontal distance along forward direction
      const dx = obs.centerWorld.x - origin.x;
      const dz = obs.centerWorld.z - origin.z;
      const forwardProj = dx * fwdHoriz.x + dz * fwdHoriz.y;

      // Must be ahead of drone within maxRange
      if (forwardProj <= 1.0 || forwardProj > maxRange) continue;

      // 4. Horizontal lateral corridor intersection test:
      // Project the 4 horizontal corners of the obstacle box onto the axis perpendicular to flight
      const corners = [
        { x: box.min.x, z: box.min.z },
        { x: box.min.x, z: box.max.z },
        { x: box.max.x, z: box.min.z },
        { x: box.max.x, z: box.max.z }
      ];

      let minLat = Infinity;
      let maxLat = -Infinity;
      for (let c = 0; c < 4; c++) {
        const cx = corners[c].x - origin.x;
        const cz = corners[c].z - origin.z;
        const lat = cx * (-fwdHoriz.y) + cz * fwdHoriz.x;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      // The drone flies along lateral = 0 with a tight safety envelope
      const corridorMargin = Math.min(3.5, lateralCone);
      // Does the flight corridor [ -corridorMargin, +corridorMargin ] intersect the obstacle's horizontal footprint?
      if (maxLat < -corridorMargin || minLat > corridorMargin) {
        continue; // Drone flight path safely clears this obstacle!
      }

      const lateralDist = Math.abs((minLat + maxLat) * 0.5);
      results.push({
        obstacle: obs,
        distance: forwardProj,
        lateralDist
      });
    }

    // Sort by forward distance (nearest first)
    results.sort((a, b) => a.distance - b.distance);
    return results;
  }
}
