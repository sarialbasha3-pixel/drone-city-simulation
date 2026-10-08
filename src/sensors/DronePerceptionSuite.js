import * as THREE from 'three';

/**
 * DronePerceptionSuite.js
 *
 * Comprehensive extended-range perception sensor array for the UAV:
 * 1. Forward 8-Ray LiDAR array (extended 180m range for early obstacle detection)
 * 2. Left & Right Flank Proximity Sensors (clearance detection when bypassing obstacles)
 * 3. Overhead Clearance Sensor (vertical obstruction detection)
 * 4. Precision Laser Altimeter (accurate distance to terrain / obstacles)
 * 5. Ultrasonic Proximity Safety Radar (close-range collision warnings)
 * 6. Visual 3D Laser Beams in the scene (toggled with 'L' key)
 */
export class DronePerceptionSuite {
  constructor(scene, drone) {
    this.scene = scene;
    this.drone = drone;

    this.raycaster = new THREE.Raycaster();
    this.maxLidarDistance = 180.0; // Extended to 180 meters
    this.maxFlankDistance = 25.0;
    this.maxCeilingDistance = 30.0;

    // Laser visualization toggle
    this.showVisualBeams = false;
    this.beamsGroup = new THREE.Group();
    this.beamsGroup.name = 'sensor_laser_beams';
    this.beamsGroup.visible = this.showVisualBeams;
    this.scene.add(this.beamsGroup);

    // Extended sensor ray directions defined in drone local body coordinates:
    this.sensorRays = [
      { id: 'FORWARD_CENTER', dir: new THREE.Vector3(0, 0, -1), maxDist: 180.0 },
      { id: 'FORWARD_RIGHT_15', dir: new THREE.Vector3(Math.sin(0.26), 0, -Math.cos(0.26)), maxDist: 180.0 },
      { id: 'FORWARD_LEFT_15', dir: new THREE.Vector3(-Math.sin(0.26), 0, -Math.cos(0.26)), maxDist: 180.0 },
      { id: 'FORWARD_RIGHT_35', dir: new THREE.Vector3(Math.sin(0.61), 0, -Math.cos(0.61)), maxDist: 140.0 },
      { id: 'FORWARD_LEFT_35', dir: new THREE.Vector3(-Math.sin(0.61), 0, -Math.cos(0.61)), maxDist: 140.0 },
      { id: 'FLANK_RIGHT_90', dir: new THREE.Vector3(1, 0, 0), maxDist: 25.0 },
      { id: 'FLANK_LEFT_90', dir: new THREE.Vector3(-1, 0, 0), maxDist: 25.0 },
      { id: 'UPWARD_CEILING', dir: new THREE.Vector3(0, 1, 0), maxDist: 30.0 },
      { id: 'DOWNWARD_ALTIMETER', dir: new THREE.Vector3(0, -1, 0), maxDist: 80.0 }
    ];

    // Readout storage
    this.readings = {};
    this.sensorRays.forEach(r => { this.readings[r.id] = r.maxDist; });

    // Safety radar alerts
    this.proximityAlertLevel = 'CLEAR'; // 'CLEAR', 'WARNING', 'CRITICAL'
    this.closestObstacleDist = this.maxLidarDistance;

    this.initVisualBeams();
  }

  initVisualBeams() {
    this.beamLines = [];
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.65
    });

    for (let i = 0; i < this.sensorRays.length; i++) {
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -20)
      ]);
      const line = new THREE.Line(geom, lineMat.clone());
      this.beamsGroup.add(line);
      this.beamLines.push(line);
    }
  }

  toggleLaserBeams() {
    this.showVisualBeams = !this.showVisualBeams;
    this.beamsGroup.visible = this.showVisualBeams;
    console.log(`[Perception] Extended 3D Sensor Laser Beams: ${this.showVisualBeams ? 'ON' : 'OFF'}`);
    return this.showVisualBeams;
  }

  updateSensors(sceneObjects) {
    const origin = this.drone.mesh.position.clone().add(new THREE.Vector3(0, -0.04, -0.15));
    const droneQuat = this.drone.mesh.quaternion;

    let minDist = 999.0;

    for (let i = 0; i < this.sensorRays.length; i++) {
      const def = this.sensorRays[i];
      const worldDir = def.dir.clone().applyQuaternion(droneQuat).normalize();

      this.raycaster.set(origin, worldDir);
      this.raycaster.far = def.maxDist;

      const intersects = this.raycaster.intersectObjects(sceneObjects || this.scene.children, true);
      const hit = intersects.find((h) => !this.isIgnoredObject(h.object));

      let dist = def.maxDist;
      let hitPoint = null;

      if (hit) {
        dist = hit.distance;
        hitPoint = hit.point;
      } else {
        hitPoint = origin.clone().addScaledVector(worldDir, def.maxDist);
      }

      this.readings[def.id] = dist;

      if (dist < minDist) minDist = dist;

      // Update visual beam line
      if (this.showVisualBeams && this.beamLines[i]) {
        const line = this.beamLines[i];
        const positions = line.geometry.attributes.position.array;
        positions[0] = origin.x;
        positions[1] = origin.y;
        positions[2] = origin.z;
        positions[3] = hitPoint.x;
        positions[4] = hitPoint.y;
        positions[5] = hitPoint.z;
        line.geometry.attributes.position.needsUpdate = true;

        // Color coding based on distance
        if (dist < 12.0) {
          line.material.color.setHex(0xff2244);
        } else if (dist < 35.0) {
          line.material.color.setHex(0xffaa00);
        } else {
          line.material.color.setHex(0x00e5ff);
        }
      }
    }

    this.closestObstacleDist = minDist;

    // Safety radar determination for early bypass calculation
    if (minDist < 12.0) {
      this.proximityAlertLevel = 'CRITICAL';
    } else if (minDist < 35.0) {
      this.proximityAlertLevel = 'WARNING';
    } else {
      this.proximityAlertLevel = 'CLEAR';
    }
  }

  /**
   * Identifies whether a raycasted 3D object should be ignored
   * (drone body, route corridor tube, UI visual overlays, laser lines, sky dome, etc.)
   */
  isIgnoredObject(obj) {
    if (!obj || !obj.visible) return true;
    if (obj.isPoints || obj.isLine) return true; // Ignore particle fields (rain) and visual laser/line overlays

    let current = obj;
    while (current) {
      if (!current.visible) return true;
      if (current === this.drone.mesh) return true;
      if (current === this.beamsGroup) return true;

      const name = (current.name || '').toLowerCase();
      if (
        name.includes('route') ||
        name.includes('bypass') ||
        name.includes('laser') ||
        name.includes('beam') ||
        name.includes('sky') ||
        name.includes('rain') ||
        name.includes('helper') ||
        name.includes('debug')
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  isDroneChild(obj) {
    let current = obj;
    while (current) {
      if (current === this.drone.mesh) return true;
      current = current.parent;
    }
    return false;
  }

  getTelemetry() {
    return {
      forwardClearance: this.readings['FORWARD_CENTER'] || 180.0,
      forwardLeft15: this.readings['FORWARD_LEFT_15'] || 180.0,
      forwardRight15: this.readings['FORWARD_RIGHT_15'] || 180.0,
      leftFlank: this.readings['FLANK_LEFT_90'] || 25.0,
      rightFlank: this.readings['FLANK_RIGHT_90'] || 25.0,
      ceiling: this.readings['UPWARD_CEILING'] || 30.0,
      altitude: this.readings['DOWNWARD_ALTIMETER'] || 0.0,
      closestDist: this.closestObstacleDist,
      alertLevel: this.proximityAlertLevel,
      lasersActive: this.showVisualBeams
    };
  }
}
