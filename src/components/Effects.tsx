import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sim } from '../sim/store';
import { getTexture } from '../three/textures';

const MAX_QUADS = 6000;

interface WheelTrack {
  lx: number;
  lz: number;
  rx: number;
  rz: number;
  active: boolean;
}

export function SkidMarks() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_QUADS * 6 * 3);
    const col = new Float32Array(MAX_QUADS * 6 * 4);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5000);
    return g;
  }, []);
  const head = useRef(0);
  const count = useRef(0);
  const tracks = useRef<WheelTrack[]>([
    { lx: 0, lz: 0, rx: 0, rz: 0, active: false },
    { lx: 0, lz: 0, rx: 0, rz: 0, active: false },
    { lx: 0, lz: 0, rx: 0, rz: 0, active: false },
    { lx: 0, lz: 0, rx: 0, rz: 0, active: false },
  ]);

  useFrame(() => {
    const s = sim.state;
    if (!sim.running || sim.paused) return;
    const spec = sim.spec;
    const fwdX = Math.sin(s.yaw);
    const fwdZ = Math.cos(s.yaw);
    const leftX = Math.cos(s.yaw);
    const leftZ = -Math.sin(s.yaw);
    const half = spec.track / 2;
    const w = 0.13;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const pa = posAttr.array as Float32Array;
    const ca = colAttr.array as Float32Array;
    let dirty = false;

    // wheel definitions: index 0,1 rear L/R, 2,3 front L/R
    for (let i = 0; i < 4; i++) {
      const rear = i < 2;
      const side = i % 2 === 0 ? 1 : -1;
      const along = rear ? -spec.b : spec.a;
      const cx = s.x + fwdX * along + leftX * side * half;
      const cz = s.z + fwdZ * along + leftZ * side * half;
      const skid = rear ? s.skidR : s.skidF;
      const onHard = s.surface !== 'grass';
      const intensity = onHard ? skid : skid * 0.35;
      const tr = tracks.current[i];
      // perpendicular to travel direction: use velocity direction of the wheel
      const vx = sim.worldVx;
      const vz = sim.worldVz;
      const vl = Math.hypot(vx, vz);
      if (intensity < 0.08 || vl < 1) {
        tr.active = false;
        continue;
      }
      const px = -vz / vl;
      const pz = vx / vl;
      const lx = cx + px * w;
      const lz = cz + pz * w;
      const rx = cx - px * w;
      const rz = cz - pz * w;
      if (!tr.active) {
        tr.active = true;
        tr.lx = lx;
        tr.lz = lz;
        tr.rx = rx;
        tr.rz = rz;
        continue;
      }
      const dist = Math.hypot(cx - (tr.lx + tr.rx) / 2, cz - (tr.lz + tr.rz) / 2);
      if (dist < 0.25) continue;
      if (dist > 6) {
        tr.lx = lx;
        tr.lz = lz;
        tr.rx = rx;
        tr.rz = rz;
        continue;
      }
      const q = head.current;
      const base = q * 18;
      const y = 0.045 + (q % 7) * 0.0015;
      const verts = [tr.lx, tr.lz, tr.rx, tr.rz, lx, lz, rx, rz, lx, lz, tr.rx, tr.rz];
      // triangle 1: oldL, oldR, newL ; triangle 2: newR, newL, oldR
      const order = [0, 1, 2, 3, 2, 1];
      for (let k = 0; k < 6; k++) {
        const vi = order[k];
        pa[base + k * 3] = verts[vi * 2];
        pa[base + k * 3 + 1] = y;
        pa[base + k * 3 + 2] = verts[vi * 2 + 1];
        const cb = (q * 6 + k) * 4;
        const dark = onHard ? 0.06 : 0.25;
        ca[cb] = dark;
        ca[cb + 1] = dark * (onHard ? 1 : 0.8);
        ca[cb + 2] = dark * (onHard ? 1 : 0.5);
        ca[cb + 3] = Math.min(0.85, intensity * 0.8);
      }
      head.current = (q + 1) % MAX_QUADS;
      count.current = Math.min(MAX_QUADS, count.current + 1);
      tr.lx = lx;
      tr.lz = lz;
      tr.rx = rx;
      tr.rz = rz;
      dirty = true;
    }
    if (dirty) {
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      geo.setDrawRange(0, count.current * 6);
    }
  });

  return (
    <mesh geometry={geo} frustumCulled={false} renderOrder={2}>
      <meshBasicMaterial vertexColors transparent depthWrite={false} polygonOffset polygonOffsetFactor={-4} side={THREE.DoubleSide} />
    </mesh>
  );
}

const MAX_P = 400;

export function Smoke() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(MAX_P), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(MAX_P), 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(MAX_P * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5000);
    return g;
  }, []);
  const particles = useMemo(
    () =>
      Array.from({ length: MAX_P }, () => ({
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        r: 1,
        g: 1,
        b: 1,
      })),
    [],
  );
  const next = useRef(0);
  const emitAcc = useRef(0);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { map: { value: getTexture('smoke') } },
        vertexShader: `
          attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
          varying float vAlpha; varying vec3 vColor;
          void main(){
            vAlpha = aAlpha; vColor = aColor;
            vec4 mv = modelViewMatrix * vec4(position,1.0);
            gl_PointSize = aSize * (420.0 / max(1.0,-mv.z));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D map; varying float vAlpha; varying vec3 vColor;
          void main(){
            vec4 t = texture2D(map, gl_PointCoord);
            gl_FragColor = vec4(vColor, t.a * vAlpha);
          }`,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  useFrame((_, dt) => {
    const s = sim.state;
    const spec = sim.spec;
    const dtc = Math.min(dt, 0.05);
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute;
    const alphaAttr = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('aColor') as THREE.BufferAttribute;

    if (sim.running && !sim.paused) {
      const fwdX = Math.sin(s.yaw);
      const fwdZ = Math.cos(s.yaw);
      const leftX = Math.cos(s.yaw);
      const leftZ = -Math.sin(s.yaw);
      const grass = s.surface === 'grass';
      const emitters: [number, number, number][] = [];
      const half = spec.track / 2;
      const addAxle = (skid: number, along: number) => {
        const amt = grass ? Math.min(1, s.speed / 15) * (s.speed > 3 ? 0.6 : 0) + skid * 0.5 : skid;
        if (amt < 0.25) return;
        for (const side of [1, -1]) {
          emitters.push([s.x + fwdX * along + leftX * side * half, s.z + fwdZ * along + leftZ * side * half, amt]);
        }
      };
      addAxle(s.skidR, -spec.b);
      addAxle(s.skidF, spec.a);
      emitAcc.current += dtc * 90;
      while (emitAcc.current >= 1 && emitters.length) {
        emitAcc.current -= 1;
        for (const [ex, ez, amt] of emitters) {
          const p = particles[next.current];
          next.current = (next.current + 1) % MAX_P;
          p.x = ex + (Math.random() - 0.5) * 0.3;
          p.y = 0.15;
          p.z = ez + (Math.random() - 0.5) * 0.3;
          p.vx = sim.worldVx * 0.25 + (Math.random() - 0.5) * 1.5;
          p.vy = 0.8 + Math.random() * 1.2;
          p.vz = sim.worldVz * 0.25 + (Math.random() - 0.5) * 1.5;
          p.life = 0;
          p.maxLife = grass ? 1.2 + Math.random() * 0.8 : 1.4 + Math.random() * 1.2;
          p.size = (grass ? 1.2 : 1.6) * (0.6 + amt);
          if (grass) {
            p.r = 0.55;
            p.g = 0.47;
            p.b = 0.33;
          } else {
            const c = 0.82 + Math.random() * 0.15;
            p.r = c;
            p.g = c;
            p.b = c;
          }
        }
      }
    }
    const pa = posAttr.array as Float32Array;
    const sa = sizeAttr.array as Float32Array;
    const aa = alphaAttr.array as Float32Array;
    const ca = colAttr.array as Float32Array;
    for (let i = 0; i < MAX_P; i++) {
      const p = particles[i];
      if (p.life >= p.maxLife) {
        aa[i] = 0;
        pa[i * 3 + 1] = -10;
        continue;
      }
      p.life += dtc;
      p.x += p.vx * dtc;
      p.y += p.vy * dtc;
      p.z += p.vz * dtc;
      p.vx *= 0.985;
      p.vz *= 0.985;
      p.vy *= 0.99;
      const k = p.life / p.maxLife;
      pa[i * 3] = p.x;
      pa[i * 3 + 1] = p.y;
      pa[i * 3 + 2] = p.z;
      sa[i] = p.size * (0.5 + k * 2.2);
      aa[i] = 0.35 * (1 - k) * Math.min(1, k * 8);
      ca[i * 3] = p.r;
      ca[i * 3 + 1] = p.g;
      ca[i * 3 + 2] = p.b;
    }
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={3} />;
}
