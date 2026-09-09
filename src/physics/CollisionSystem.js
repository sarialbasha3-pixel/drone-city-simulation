import * as THREE from 'three';

/**
 * CollisionSystem - Fast, optimized 3D environment collision detection.
 * Protects the drone from penetrating terrain, buildings, bridge decks, and large obstacles.
 * Implements smooth sliding surface response without sticking or tunneling.
 */
export class CollisionSystem {
  constructor(terrain) {
    this.terrain = terrain;
    this.obstacleBoxes = [];
    this.droneRadius = 0.28; // 28cm collision envelope matching 350mm drone
    this.lastCollisionTime = 0;
    this.hasCollided = false;
  }

  /**
   * Registers an array of 3D objects or groups as collision obstacles
   */
  registerObstacles(objects) {
    objects.forEach((obj) => {
      obj.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(obj);
      // Ensure box is valid
      if (!box.isEmpty()) {
        this.obstacleBoxes.push(box);
      }
    });
  }

  /**
   * Registers a single bounding box directly (e.g., bridge deck, tower pylons)
   */
  registerBox(box) {
    this.obstacleBoxes.push(box);
  }

  /**
   * Resolves drone collision with terrain and obstacle bounding boxes.
   * Modifies drone position and velocity in-place to slide along surfaces.
   */
  resolveCollision(dronePos, droneVel) {
    this.hasCollided = false;

    // 1. Terrain Collision Check (O(1) continuous height check)
    const groundH = this.terrain.getHeight(dronePos.x, dronePos.z);
    const minH = groundH + this.droneRadius;

    if (dronePos.y < minH) {
      dronePos.y = minH;
      if (droneVel.y < 0) droneVel.y = 0;
      this.hasCollided = true;
    }

    // 2. Obstacle Bounding Boxes (Buildings, Towers, Bridges)
    const droneSphere = new THREE.Sphere(dronePos, this.droneRadius);

    for (let i = 0; i < this.obstacleBoxes.length; i++) {
      const box = this.obstacleBoxes[i];

      // Broad-phase distance check (cheap radius test before full Box-Sphere)
      if (Math.abs(dronePos.x - (box.min.x + box.max.x) * 0.5) > 60 ||
          Math.abs(dronePos.z - (box.min.z + box.max.z) * 0.5) > 60) {
        continue;
      }

      if (box.intersectsSphere(droneSphere)) {
        this.hasCollided = true;

        // Find closest point on box to drone center
        const closestPoint = new THREE.Vector3();
        box.clampPoint(dronePos, closestPoint);

        const pushDir = new THREE.Vector3().subVectors(dronePos, closestPoint);
        const dist = pushDir.length();

        if (dist < 0.0001) {
          // Drone is inside box center - push upwards or along nearest face
          pushDir.set(0, 1, 0);
        } else {
          pushDir.normalize();
        }

        // Push drone out of collision
        const penetration = this.droneRadius - dist;
        if (penetration > 0) {
          dronePos.addScaledVector(pushDir, penetration + 0.02);

          // Zero velocity along collision normal (sliding effect)
          const velDot = droneVel.dot(pushDir);
          if (velDot < 0) {
            droneVel.sub(pushDir.clone().multiplyScalar(velDot * 1.2));
          }
        }
      }
    }

    return this.hasCollided;
  }
}
