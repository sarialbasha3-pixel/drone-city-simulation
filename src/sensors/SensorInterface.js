import * as THREE from 'three';

/**
 * SensorInterface - Simulated Onboard Perception Suite for Autonomous Obstacle Avoidance.
 * STRICT ARCHITECTURAL RULE:
 * The avoidance algorithm MUST NOT receive pre-built building coordinates or environment maps.
 * It only receives real-time sensory observations (LiDAR rangefinders, depth distances, forward clearance).
 */
export class SensorInterface {
  constructor(scene, drone) {
    this.scene = scene;
    this.drone = drone;

    // 8-Ray LiDAR Array (Forward Cone, Left, Right, Downward altimeter)
    this.raycaster = new THREE.Raycaster();
    this.maxRayDistance = 80.0; // 80 meter detection range

    this.rayDirections = [
      new THREE.Vector3(0, 0, -1),                         // 0: Direct Forward
      new THREE.Vector3(Math.sin(0.25), 0, -Math.cos(0.25)),// 1: Forward Right 15°
      new THREE.Vector3(-Math.sin(0.25), 0, -Math.cos(0.25)),// 2: Forward Left 15°
      new THREE.Vector3(Math.sin(0.55), 0, -Math.cos(0.55)),// 3: Wide Right 30°
      new THREE.Vector3(-Math.sin(0.55), 0, -Math.cos(0.55)),// 4: Wide Left 30°
      new THREE.Vector3(0, Math.sin(0.3), -Math.cos(0.3)), // 5: Forward Up 18°
      new THREE.Vector3(0, -Math.sin(0.3), -Math.cos(0.3)),// 6: Forward Down 18°
      new THREE.Vector3(0, -1, 0)                          // 7: Vertical Down (Altimeter)
    ];

    this.readings = new Float32Array(this.rayDirections.length);
    this.forwardClearance = this.maxRayDistance;
    this.downwardClearance = this.maxRayDistance;
  }

  /**
   * Performs real-time raycast sweeps from the drone's nose sensor mount
   * against the 3D scene geometry.
   */
  updateSensors() {
    const origin = this.drone.mesh.position.clone().add(new THREE.Vector3(0, -0.04, -0.15));
    const droneQuat = this.drone.mesh.quaternion;

    for (let i = 0; i < this.rayDirections.length; i++) {
      const worldDir = this.rayDirections[i].clone().applyQuaternion(droneQuat).normalize();
      this.raycaster.set(origin, worldDir);
      this.raycaster.far = this.maxRayDistance;

      const intersects = this.raycaster.intersectObjects(this.scene.children, true);

      // Filter out self-intersections with the drone mesh
      const hit = intersects.find((hitObj) => !this.isDroneChild(hitObj.object));

      if (hit) {
        this.readings[i] = hit.distance;
      } else {
        this.readings[i] = this.maxRayDistance;
      }
    }

    this.forwardClearance = this.readings[0];
    this.downwardClearance = this.readings[7];
  }

  isDroneChild(obj) {
    let curr = obj;
    while (curr) {
      if (curr === this.drone.mesh) return true;
      curr = curr.parent;
    }
    return false;
  }

  /**
   * Public interface for external obstacle avoidance controllers
   * Only sensory observations are exposed!
   */
  getObservations() {
    return {
      ranges: this.readings,
      forwardClearance: this.forwardClearance,
      downwardClearance: this.downwardClearance,
      maxRange: this.maxRayDistance,
      timestamp: performance.now()
    };
  }
}
