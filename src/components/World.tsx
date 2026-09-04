import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  BLOCK,
  blockCenter,
  blockTypes,
  BUILD_HALF,
  buildings,
  CITY_HALF,
  CITY_N,
  cones,
  DRIFT_CIRCLE,
  INNER_HALF,
  lamps,
  LOT_CENTER,
  LOT_HALF_X,
  LOT_HALF_Z,
  RING_R,
  RING_W,
  ROAD_W,
  trees,
} from '../sim/world';
import { getTexture } from '../three/textures';

const ROAD_LEN = CITY_HALF * 2 + ROAD_W;

function Ground() {
  const grass = useMemo(() => {
    const t = getTexture('grass');
    t.repeat.set(600, 600);
    return t;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[4000, 4000]} />
      <meshStandardMaterial map={grass} roughness={1} color="#b7c9a0" />
    </mesh>
  );
}

function Roads() {
  const roadTex = useMemo(() => {
    const t = getTexture('roadZ');
    t.repeat.set(1, ROAD_LEN / ROAD_W);
    return t;
  }, []);
  const connectorTex = useMemo(() => {
    const t = getTexture('roadZ').clone();
    t.needsUpdate = true;
    t.repeat.set(1, (RING_R - CITY_HALF) / ROAD_W);
    return t;
  }, []);
  const interTex = useMemo(() => getTexture('intersection'), []);
  const hwLen = RING_R * 2 + RING_W;
  const hwTex = useMemo(() => {
    const t = getTexture('highway');
    t.repeat.set(1, hwLen / RING_W);
    return t;
  }, [hwLen]);
  const hwTexShort = useMemo(() => {
    const t = getTexture('highway').clone();
    t.needsUpdate = true;
    t.repeat.set(1, (RING_R * 2 - RING_W) / RING_W);
    return t;
  }, []);

  const lines: number[] = [];
  for (let k = 0; k <= CITY_N; k++) lines.push(-CITY_HALF + k * BLOCK);

  const roadMat = <meshStandardMaterial map={roadTex} roughness={0.92} metalness={0} polygonOffset polygonOffsetFactor={-1} />;
  const connLen = RING_R - CITY_HALF - RING_W / 2 + 1;

  return (
    <group>
      {lines.map((x) => (
        <mesh key={'z' + x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]} receiveShadow>
          <planeGeometry args={[ROAD_W, ROAD_LEN]} />
          {roadMat}
        </mesh>
      ))}
      {lines.map((z) => (
        <mesh key={'x' + z} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.012, z]} receiveShadow>
          <planeGeometry args={[ROAD_W, ROAD_LEN]} />
          {roadMat}
        </mesh>
      ))}
      {lines.map((x) =>
        lines.map((z) => (
          <mesh key={'i' + x + '_' + z} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]} receiveShadow>
            <planeGeometry args={[ROAD_W, ROAD_W]} />
            <meshStandardMaterial map={interTex} roughness={0.92} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        )),
      )}
      {/* connectors from city to ring */}
      {[1, -1].map((d) => (
        <group key={'c' + d}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, d * (CITY_HALF + ROAD_W / 2 + connLen / 2)]} receiveShadow>
            <planeGeometry args={[ROAD_W, connLen]} />
            <meshStandardMaterial map={connectorTex} roughness={0.92} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[d * (CITY_HALF + ROAD_W / 2 + connLen / 2), 0.01, 0]} receiveShadow>
            <planeGeometry args={[ROAD_W, connLen]} />
            <meshStandardMaterial map={connectorTex} roughness={0.92} />
          </mesh>
        </group>
      ))}
      {/* ring highway */}
      {[1, -1].map((d) => (
        <group key={'r' + d}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[d * RING_R, 0.012, 0]} receiveShadow>
            <planeGeometry args={[RING_W, hwLen]} />
            <meshStandardMaterial map={hwTex} roughness={0.9} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.011, d * RING_R]} receiveShadow>
            <planeGeometry args={[RING_W, RING_R * 2 - RING_W]} />
            <meshStandardMaterial map={hwTexShort} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Blocks() {
  const concrete = useMemo(() => {
    const t = getTexture('concrete');
    t.repeat.set(INNER_HALF / 2, INNER_HALF / 2);
    return t;
  }, []);
  const grassInner = useMemo(() => {
    const t = getTexture('grass').clone();
    t.needsUpdate = true;
    t.repeat.set(12, 12);
    return t;
  }, []);
  const lotTex = useMemo(() => {
    const t = getTexture('lot');
    t.repeat.set(LOT_HALF_X / 6, LOT_HALF_Z / 6);
    return t;
  }, []);
  const circle = useMemo(() => getTexture('circle'), []);

  const items: React.ReactNode[] = [];
  for (let i = 0; i < CITY_N; i++) {
    for (let j = 0; j < CITY_N; j++) {
      const type = blockTypes[i][j];
      if (type === 'lot') continue;
      const [cx, cz] = blockCenter(i, j);
      items.push(
        <mesh key={`sw${i}_${j}`} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, cz]} receiveShadow>
          <planeGeometry args={[INNER_HALF * 2, INNER_HALF * 2]} />
          <meshStandardMaterial map={concrete} roughness={0.95} />
        </mesh>,
      );
      if (type === 'park' || type === 'buildings') {
        items.push(
          <mesh key={`gr${i}_${j}`} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.035, cz]} receiveShadow>
            <planeGeometry args={[BUILD_HALF * 2, BUILD_HALF * 2]} />
            <meshStandardMaterial map={grassInner} roughness={1} color="#a9bf92" />
          </mesh>,
        );
      }
      if (type === 'plaza') {
        items.push(
          <group key={`pl${i}_${j}`} position={[cx, 0, cz]}>
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[5, 5.3, 1.2, 32]} />
              <meshStandardMaterial color="#8d99a6" roughness={0.6} />
            </mesh>
            <mesh position={[0, 1.15, 0]}>
              <cylinderGeometry args={[4.6, 4.6, 0.2, 32]} />
              <meshPhysicalMaterial color="#3f7fb8" roughness={0.05} metalness={0.1} transmission={0.2} />
            </mesh>
            <mesh position={[0, 2.5, 0]} castShadow>
              <cylinderGeometry args={[0.4, 1.2, 3, 12]} />
              <meshStandardMaterial color="#9aa4ae" roughness={0.5} />
            </mesh>
          </group>,
        );
      }
    }
  }
  return (
    <group>
      {items}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LOT_CENTER[0], 0.02, LOT_CENTER[1]]} receiveShadow>
        <planeGeometry args={[LOT_HALF_X * 2, LOT_HALF_Z * 2]} />
        <meshStandardMaterial map={lotTex} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[DRIFT_CIRCLE[0], 0.04, DRIFT_CIRCLE[1]]}>
        <planeGeometry args={[DRIFT_CIRCLE[2] * 2.2, DRIFT_CIRCLE[2] * 2.2]} />
        <meshBasicMaterial map={circle} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function Buildings() {
  const meshes = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    return buildings.map((b, idx) => {
      const w = b.maxX - b.minX;
      const d = b.maxZ - b.minZ;
      const h = b.height;
      if (b.style === 3) return null; // fountain already rendered
      const t = getTexture('windows' + b.style).clone();
      t.needsUpdate = true;
      t.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 6.4)));
      const side = new THREE.MeshStandardMaterial({ map: t, color: b.color, roughness: 0.75, metalness: 0.05 });
      const t2 = t.clone();
      t2.needsUpdate = true;
      t2.repeat.set(Math.max(1, Math.round(d / 8)), Math.max(1, Math.round(h / 6.4)));
      const side2 = new THREE.MeshStandardMaterial({ map: t2, color: b.color, roughness: 0.75, metalness: 0.05 });
      const roof = new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.95 });
      const mesh = new THREE.Mesh(geo, [side2, side2, roof, roof, side, side]);
      mesh.position.set((b.minX + b.maxX) / 2, h / 2, (b.minZ + b.maxZ) / 2);
      mesh.scale.set(w, h, d);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      // rooftop detail
      const group = new THREE.Group();
      group.add(mesh);
      if (idx % 3 === 0) {
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(Math.min(4, w * 0.3), 1.6, Math.min(3, d * 0.3)),
          new THREE.MeshStandardMaterial({ color: '#8b8f94', roughness: 0.8 }),
        );
        ac.position.set(mesh.position.x + w * 0.2, h + 0.8, mesh.position.z - d * 0.15);
        ac.castShadow = true;
        group.add(ac);
      }
      if (idx % 5 === 1) {
        const ledge = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
          new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.9 }),
        );
        ledge.position.set(mesh.position.x, h - 0.25, mesh.position.z);
        group.add(ledge);
      }
      return group;
    });
  }, []);
  return (
    <group>
      {meshes.map((m, i) => (m ? <primitive key={i} object={m} /> : null))}
    </group>
  );
}

function Trees() {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRefs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const byVariant = useMemo(() => [0, 1, 2].map((v) => trees.filter((t) => t.variant === v)), []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const color = new THREE.Color();
    const trunk = trunkRef.current!;
    trees.forEach((t, i) => {
      pos.set(t.x, 1.1 * t.scale, t.z);
      scl.set(t.scale, t.scale, t.scale);
      m.compose(pos, q, scl);
      trunk.setMatrixAt(i, m);
    });
    trunk.instanceMatrix.needsUpdate = true;
    byVariant.forEach((list, v) => {
      const mesh = canopyRefs[v].current!;
      list.forEach((t, i) => {
        const hgt = v === 0 ? 4.4 : v === 1 ? 3.6 : 4.0;
        pos.set(t.x, hgt * t.scale, t.z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t.x * 13.1 + t.z * 7.7) % 6.28);
        scl.set(t.scale, t.scale, t.scale);
        m.compose(pos, q, scl);
        mesh.setMatrixAt(i, m);
        const g = 0.35 + ((t.x * 3.7 + t.z * 1.3) % 1 + 1) % 1 * 0.25;
        color.setRGB(0.12 + g * 0.3, g, 0.1 + g * 0.15);
        mesh.setColorAt(i, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.28, 2.4, 7]} />
        <meshStandardMaterial color="#5a3f28" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={canopyRefs[0]} args={[undefined, undefined, byVariant[0].length]} castShadow receiveShadow>
        <coneGeometry args={[2.1, 5.2, 8]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={canopyRefs[1]} args={[undefined, undefined, byVariant[1].length]} castShadow receiveShadow>
        <icosahedronGeometry args={[2.4, 1]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={canopyRefs[2]} args={[undefined, undefined, byVariant[2].length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[2.2, 0]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}

function Lamps() {
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    lamps.forEach((l, i) => {
      q.setFromAxisAngle(up, l.rot);
      pos.set(l.x, 3.5, l.z);
      m.compose(pos, q, one);
      poleRef.current!.setMatrixAt(i, m);
      // head offset towards the road (local -z after rotation)
      const off = new THREE.Vector3(0, 6.8, 1.6).applyQuaternion(q);
      pos.set(l.x + off.x, off.y, l.z + off.z);
      m.compose(pos, q, one);
      headRef.current!.setMatrixAt(i, m);
    });
    poleRef.current!.instanceMatrix.needsUpdate = true;
    headRef.current!.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <group>
      <instancedMesh ref={poleRef} args={[undefined, undefined, lamps.length]} castShadow>
        <cylinderGeometry args={[0.09, 0.14, 7, 6]} />
        <meshStandardMaterial color="#4a4f55" roughness={0.6} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, lamps.length]}>
        <boxGeometry args={[0.5, 0.2, 3.2]} />
        <meshStandardMaterial color="#5a6066" emissive="#fff2c0" emissiveIntensity={0.25} roughness={0.5} metalness={0.4} />
      </instancedMesh>
    </group>
  );
}

function Cones() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const q2 = useMemo(() => new THREE.Quaternion(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const off = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const mesh = ref.current!;
    const base = baseRef.current!;
    for (let i = 0; i < cones.length; i++) {
      const c = cones[i];
      // tilt around a horizontal axis perpendicular to tiltDir
      axis.set(Math.cos(c.tiltDir), 0, -Math.sin(c.tiltDir));
      q.setFromAxisAngle(axis, c.tilt);
      q2.setFromAxisAngle(up, c.yaw);
      q.multiply(q2);
      const lift = Math.sin(c.tilt) * 0.35;
      const cy = 0.36 - Math.sin(c.tilt) * 0.34 + lift * 0.4;
      pos.set(c.x, cy, c.z);
      m.compose(pos, q, one);
      mesh.setMatrixAt(i, m);
      // base at bottom of cone (offset along local -y)
      off.set(0, -0.33, 0).applyQuaternion(q);
      pos.set(c.x + off.x, cy + off.y, c.z + off.z);
      m.compose(pos, q, one);
      base.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    base.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, cones.length]} castShadow>
        <coneGeometry args={[0.22, 0.72, 10]} />
        <meshStandardMaterial color="#ff6a1a" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={baseRef} args={[undefined, undefined, cones.length]}>
        <boxGeometry args={[0.5, 0.05, 0.5]} />
        <meshStandardMaterial color="#222" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

function Mountains() {
  const items = useMemo(() => {
    const arr: { x: number; z: number; h: number; r: number; c: string }[] = [];
    for (let i = 0; i < 46; i++) {
      const ang = (i / 46) * Math.PI * 2 + Math.sin(i * 3.1) * 0.05;
      const dist = 1700 + Math.sin(i * 1.7) * 220;
      const h = 220 + Math.abs(Math.sin(i * 2.3)) * 320;
      arr.push({
        x: Math.cos(ang) * dist,
        z: Math.sin(ang) * dist,
        h,
        r: 260 + Math.abs(Math.cos(i * 1.3)) * 260,
        c: i % 2 ? '#6d7f93' : '#5d6e82',
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {items.map((m, i) => (
        <mesh key={i} position={[m.x, m.h / 2 - 10, m.z]}>
          <coneGeometry args={[m.r, m.h, 7]} />
          <meshStandardMaterial color={m.c} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Barriers() {
  // guard rails around the skid pad
  const [cx, cz] = LOT_CENTER;
  return (
    <group>
      {[-1, 1].map((d) => (
        <mesh key={'b' + d} position={[cx, 0.5, cz + d * (LOT_HALF_Z + 1)]} castShadow receiveShadow>
          <boxGeometry args={[LOT_HALF_X * 2, 1, 0.4]} />
          <meshStandardMaterial color="#cfd3d8" roughness={0.4} metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export default function World() {
  return (
    <group>
      <Ground />
      <Roads />
      <Blocks />
      <Buildings />
      <Trees />
      <Lamps />
      <Cones />
      <Barriers />
      <Mountains />
    </group>
  );
}
