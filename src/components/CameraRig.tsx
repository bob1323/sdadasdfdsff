import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sim } from '../sim/store';

export default function CameraRig() {
  const { camera } = useThree();
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const curLook = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const cineCam = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const lastMode = useRef<string>('');
  const shake = useRef(0);
  const initialised = useRef(false);

  useEffect(() => {
    camera.far = 5000;
    camera.near = 0.3;
    camera.updateProjectionMatrix();
  }, [camera]);

  useFrame((state, dt) => {
    const s = sim.state;
    const cam = camera as THREE.PerspectiveCamera;
    const fwdX = Math.sin(s.yaw);
    const fwdZ = Math.cos(s.yaw);
    const leftX = Math.cos(s.yaw);
    const leftZ = -Math.sin(s.yaw);
    const speed = s.speed;
    const t = state.clock.elapsedTime;

    let mode = sim.camera;
    if (!sim.running) mode = 'orbit' as never;
    const modeChanged = lastMode.current !== mode;
    lastMode.current = mode;

    // velocity direction blend for drift camera
    const vlen = Math.hypot(sim.worldVx, sim.worldVz);
    let dirX = fwdX;
    let dirZ = fwdZ;
    if (vlen > 2 && s.vx > 0) {
      const k = Math.min(0.55, vlen / 25);
      dirX = fwdX * (1 - k) + (sim.worldVx / vlen) * k;
      dirZ = fwdZ * (1 - k) + (sim.worldVz / vlen) * k;
      const n = Math.hypot(dirX, dirZ);
      dirX /= n;
      dirZ /= n;
    }

    let targetFov = 62;
    let smooth = 6;

    if ((mode as string) === 'orbit') {
      const ang = t * 0.25;
      const rad = 7.5;
      pos.set(s.x + Math.sin(ang) * rad, 1.9 + Math.sin(t * 0.4) * 0.4, s.z + Math.cos(ang) * rad);
      look.set(s.x, 0.7, s.z);
      smooth = 3;
      targetFov = 45;
    } else if (mode === 'chase' || mode === 'far') {
      const dist = mode === 'chase' ? 6.2 + speed * 0.03 : 10 + speed * 0.05;
      const height = mode === 'chase' ? 2.0 + speed * 0.008 : 3.6 + speed * 0.01;
      pos.set(s.x - dirX * dist, height, s.z - dirZ * dist);
      look.set(s.x + fwdX * 2.5, 0.9, s.z + fwdZ * 2.5);
      targetFov = 62 + Math.min(18, speed * 0.28);
      smooth = 7;
    } else if (mode === 'hood') {
      const L = sim.spec.bodyLength;
      pos.set(s.x + fwdX * (L * 0.28) + leftX * 0, 1.12, s.z + fwdZ * (L * 0.28));
      look.set(s.x + fwdX * 40, 0.9, s.z + fwdZ * 40);
      targetFov = 70 + Math.min(15, speed * 0.25);
      smooth = 40;
    } else if (mode === 'cockpit') {
      const L = sim.spec.bodyLength;
      const ox = 0.38;
      const oz = -0.05 * L;
      pos.set(s.x + fwdX * oz + leftX * ox, 1.16, s.z + fwdZ * oz + leftZ * ox);
      // look slightly toward the drift direction
      look.set(pos.x + dirX * 30, 1.0, pos.z + dirZ * 30);
      targetFov = 75 + Math.min(12, speed * 0.2);
      smooth = 40;
    } else {
      // cinematic trackside camera
      const dx = cineCam.x - s.x;
      const dz = cineCam.z - s.z;
      const d = Math.hypot(dx, dz);
      const behind = dx * sim.worldVx + dz * sim.worldVz < -vlen * 40;
      if (modeChanged || d > 110 || (behind && d > 30)) {
        const ahead = 35 + Math.min(60, vlen * 1.5);
        const side = Math.random() > 0.5 ? 1 : -1;
        cineCam.set(
          s.x + dirX * ahead + leftX * side * (10 + Math.random() * 8),
          2.5 + Math.random() * 6,
          s.z + dirZ * ahead + leftZ * side * (10 + Math.random() * 8),
        );
        cam.position.copy(cineCam);
      }
      pos.copy(cineCam);
      look.set(s.x, 0.8, s.z);
      const dd = Math.max(5, Math.hypot(cineCam.x - s.x, cineCam.z - s.z));
      targetFov = THREE.MathUtils.clamp(900 / dd, 18, 70);
      smooth = 60;
    }

    // impact shake
    if (s.collisionTimer > 0.25) shake.current = Math.min(0.5, s.collision * 0.02);
    shake.current *= Math.exp(-dt * 6);

    if (!initialised.current || modeChanged) {
      cam.position.copy(pos);
      curLook.copy(look);
      initialised.current = true;
    } else {
      const k = 1 - Math.exp(-dt * smooth);
      cam.position.lerp(pos, k);
      curLook.lerp(look, Math.min(1, k * 1.5));
    }
    if (mode === 'hood' || mode === 'cockpit') {
      // vibration on rough ground and at high rpm
      const vib = (s.surface === 'grass' && speed > 2 ? 0.02 : 0.003) + (s.rpm / sim.spec.redline) * 0.003;
      cam.position.y += Math.sin(t * 61) * vib;
    }
    tmp.copy(curLook);
    tmp.x += (Math.random() - 0.5) * shake.current;
    tmp.y += (Math.random() - 0.5) * shake.current;
    cam.lookAt(tmp);
    if (mode === 'cockpit' || mode === 'hood') {
      // roll the view slightly with lateral g
      cam.rotateZ(THREE.MathUtils.clamp(-s.ay * 0.004, -0.04, 0.04));
    }
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 4);
    cam.updateProjectionMatrix();
  }, -5);

  return null;
}
