import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CarSpec } from '../sim/cars';
import { readInput } from '../sim/input';
import { stepVehicle, worldVelocity } from '../sim/physics';
import { sim } from '../sim/store';
import { carAudio } from '../sim/audio';
import { consumeConeBump } from '../sim/physics';

const FIXED_DT = 1 / 240;

function bodyShape(L: number) {
  const s = L / 4.5;
  const h = L / 2;
  const pts: [number, number][] = [
    [h, 0.3],
    [h, 0.58],
    [h - 0.12 * s, 0.7],
    [0.75 * s, 0.88],
    [-1.35 * s, 0.93],
    [-h + 0.1 * s, 0.9],
    [-h, 0.62],
    [-h, 0.3],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  return shape;
}
function glassShape(L: number) {
  const s = L / 4.5;
  const pts: [number, number][] = [
    [0.82 * s, 0.86],
    [0.32 * s, 1.3],
    [-0.85 * s, 1.34],
    [-1.4 * s, 1.1],
    [-1.42 * s, 0.86],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  return shape;
}

function Wheel({ radius, side }: { radius: number; side: number }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[radius, radius, 0.27, 28]} />
        <meshStandardMaterial color="#141414" roughness={0.9} />
      </mesh>
      <mesh position={[side * 0.005, 0, 0]}>
        <cylinderGeometry args={[radius * 0.63, radius * 0.63, 0.28, 18]} />
        <meshStandardMaterial color="#2a2c30" roughness={0.5} metalness={0.6} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} rotation={[0, (i / 5) * Math.PI * 2, 0]} position={[side * 0.02, 0, 0]}>
          <boxGeometry args={[0.03, radius * 1.1, 0.08]} />
          <meshStandardMaterial color="#c9ccd1" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
      <mesh position={[side * 0.03, 0, 0]}>
        <cylinderGeometry args={[radius * 0.18, radius * 0.18, 0.3, 12]} />
        <meshStandardMaterial color="#d8dbe0" roughness={0.25} metalness={0.9} />
      </mesh>
      {/* brake disc + caliper */}
      <mesh position={[-side * 0.06, 0, 0]}>
        <cylinderGeometry args={[radius * 0.58, radius * 0.58, 0.02, 24]} />
        <meshStandardMaterial color="#777" roughness={0.4} metalness={0.9} />
      </mesh>
      <mesh position={[-side * 0.07, radius * 0.35, 0.08]}>
        <boxGeometry args={[0.05, 0.2, 0.12]} />
        <meshStandardMaterial color="#c8102e" roughness={0.5} />
      </mesh>
    </group>
  );
}

export interface VehicleHandles {
  group: THREE.Group;
}

export default function Vehicle({ spec }: { spec: CarSpec }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const flSteer = useRef<THREE.Group>(null);
  const frSteer = useRef<THREE.Group>(null);
  const flSpin = useRef<THREE.Group>(null);
  const frSpin = useRef<THREE.Group>(null);
  const rlSpin = useRef<THREE.Group>(null);
  const rrSpin = useRef<THREE.Group>(null);
  const tailMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5a0a0a', emissive: '#ff2a1a', emissiveIntensity: 0.35, roughness: 0.3 }),
    [],
  );
  const reverseMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#e8e8e8', emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.3 }),
    [],
  );
  const headLightMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#dfe8ff', emissive: '#e8f0ff', emissiveIntensity: 0.6, roughness: 0.2 }),
    [],
  );
  const wheelRef = useRef<THREE.Group>(null);
  const spotL = useRef<THREE.SpotLight>(null);
  const spotR = useRef<THREE.SpotLight>(null);
  const targetL = useMemo(() => new THREE.Object3D(), []);
  const targetR = useMemo(() => new THREE.Object3D(), []);
  const accumulator = useRef(0);
  const audioClock = useRef(0);

  const L = spec.bodyLength;
  const W = spec.bodyWidth;
  const r = spec.wheelRadius;
  const zOff = (spec.a - spec.b) / 2; // body centre relative to CG
  const bodyGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(bodyShape(L), {
      depth: W - 0.12,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 3,
    });
    g.rotateY(-Math.PI / 2);
    g.translate((W - 0.12) / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  }, [L, W]);
  const glassGeo = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(glassShape(L), {
      depth: W - 0.34,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    g.rotateY(-Math.PI / 2);
    g.translate((W - 0.34) / 2, 0, 0);
    return g;
  }, [L, W]);

  useEffect(() => {
    if (spotL.current) spotL.current.target = targetL;
    if (spotR.current) spotR.current.target = targetR;
  }, [targetL, targetR]);

  useFrame((_, dt) => {
    const s = sim.state;
    const g = groupRef.current;
    if (!g) return;
    const clamped = Math.min(dt, 0.05);
    if (sim.running && !sim.paused) {
      accumulator.current += clamped;
      const input = readInput();
      let steps = 0;
      while (accumulator.current >= FIXED_DT && steps < 20) {
        stepVehicle(s, sim.spec, input, FIXED_DT);
        accumulator.current -= FIXED_DT;
        steps++;
      }
      const bump = consumeConeBump();
      if (bump > 0) carAudio.coneHit(bump);
    }
    const [wvx, wvz] = worldVelocity(s);
    sim.worldVx = wvx;
    sim.worldVz = wvz;

    // audio
    audioClock.current += clamped;
    if (audioClock.current > 1 / 60) {
      carAudio.update(s, sim.spec, audioClock.current, !sim.running || sim.paused);
      audioClock.current = 0;
    }

    // --- visuals
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.yaw;
    const body = bodyRef.current!;
    const roll = THREE.MathUtils.clamp(s.ay * 0.011, -0.09, 0.09);
    const pitch = THREE.MathUtils.clamp(-s.ax * 0.007, -0.06, 0.06);
    body.rotation.z += (roll - body.rotation.z) * Math.min(1, dt * 10);
    body.rotation.x += (pitch - body.rotation.x) * Math.min(1, dt * 10);
    const bumpy = s.surface === 'grass' && s.speed > 2 ? Math.sin(s.time * 37) * 0.012 + Math.sin(s.time * 53) * 0.008 : 0;
    body.position.y = bumpy;

    // wheels
    flSteer.current!.rotation.y = s.steer;
    frSteer.current!.rotation.y = s.steer;
    const fa = s.wheelAngleF;
    const ra = s.wheelAngleR;
    flSpin.current!.rotation.x = fa;
    frSpin.current!.rotation.x = fa;
    rlSpin.current!.rotation.x = ra;
    rrSpin.current!.rotation.x = ra;

    // lights
    const braking = s.brake > 0.05 || s.handbrake;
    tailMat.emissiveIntensity = braking ? 4 : sim.headlights ? 1.2 : 0.35;
    reverseMat.emissiveIntensity = s.gear === -1 ? 3 : 0;
    headLightMat.emissiveIntensity = sim.headlights ? 5 : 0.6;
    if (spotL.current && spotR.current) {
      spotL.current.intensity = sim.headlights ? 500 : 0;
      spotR.current.intensity = sim.headlights ? 500 : 0;
    }
    if (wheelRef.current) wheelRef.current.rotation.z = -s.steer * 14;
  }, -10);

  const track = spec.track;
  const paint = spec.color;

  return (
    <group ref={groupRef}>
      <group ref={bodyRef} position={[0, 0, 0]}>
        <group position={[0, 0, zOff]}>
          {/* main body */}
          <mesh geometry={bodyGeo} castShadow receiveShadow>
            <meshPhysicalMaterial color={paint} metalness={0.6} roughness={0.28} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={1.2} />
          </mesh>
          {/* greenhouse */}
          <mesh geometry={glassGeo} castShadow>
            <meshPhysicalMaterial color="#0e1a26" metalness={0.9} roughness={0.05} transparent opacity={0.72} envMapIntensity={1.5} side={THREE.FrontSide} />
          </mesh>
          {/* roof */}
          <mesh position={[0, 1.335, -0.27 * (L / 4.5)]} castShadow>
            <boxGeometry args={[W - 0.42, 0.05, 1.05 * (L / 4.5)]} />
            <meshPhysicalMaterial color={paint} metalness={0.6} roughness={0.28} clearcoat={1} clearcoatRoughness={0.08} />
          </mesh>
          {/* pillars */}
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh position={[sd * (W / 2 - 0.2), 1.08, 0.58 * (L / 4.5)]} rotation={[0.85, 0, 0]}>
                <boxGeometry args={[0.07, 0.62, 0.07]} />
                <meshStandardMaterial color="#111" roughness={0.6} />
              </mesh>
              <mesh position={[sd * (W / 2 - 0.2), 1.0, -1.35 * (L / 4.5)]} rotation={[-0.75, 0, 0]}>
                <boxGeometry args={[0.09, 0.56, 0.09]} />
                <meshStandardMaterial color="#111" roughness={0.6} />
              </mesh>
              {/* mirrors */}
              <mesh position={[sd * (W / 2 + 0.1), 0.98, 0.75 * (L / 4.5)]} castShadow>
                <boxGeometry args={[0.22, 0.1, 0.14]} />
                <meshPhysicalMaterial color={paint} metalness={0.6} roughness={0.28} clearcoat={1} />
              </mesh>
              {/* door handle + line */}
              <mesh position={[sd * (W / 2 - 0.04), 0.78, -0.25 * (L / 4.5)]}>
                <boxGeometry args={[0.02, 0.03, 0.18]} />
                <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
              </mesh>
            </group>
          ))}
          {/* front grille & bumper */}
          <mesh position={[0, 0.5, L / 2 + 0.005]}>
            <boxGeometry args={[W * 0.55, 0.22, 0.03]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.34, L / 2 - 0.15]}>
            <boxGeometry args={[W - 0.3, 0.1, 0.4]} />
            <meshStandardMaterial color="#141414" roughness={0.8} />
          </mesh>
          {/* headlights */}
          {[-1, 1].map((sd) => (
            <group key={'h' + sd}>
              <mesh position={[sd * (W / 2 - 0.36), 0.66, L / 2 + 0.005]} material={headLightMat}>
                <boxGeometry args={[0.46, 0.13, 0.04]} />
              </mesh>
              <spotLight
                ref={sd === -1 ? spotL : spotR}
                position={[sd * (W / 2 - 0.36), 0.7, L / 2]}
                angle={0.55}
                penumbra={0.5}
                distance={90}
                intensity={0}
                color="#fff4d6"
                decay={1.5}
              />
              <primitive object={sd === -1 ? targetL : targetR} position={[sd * 1.2, -0.5, L / 2 + 30]} />
            </group>
          ))}
          {/* tail lights */}
          {[-1, 1].map((sd) => (
            <mesh key={'t' + sd} position={[sd * (W / 2 - 0.38), 0.74, -L / 2 - 0.005]} material={tailMat}>
              <boxGeometry args={[0.52, 0.12, 0.04]} />
            </mesh>
          ))}
          <mesh position={[0, 0.62, -L / 2 - 0.005]} material={reverseMat}>
            <boxGeometry args={[0.24, 0.08, 0.04]} />
          </mesh>
          {/* rear diffuser + exhausts */}
          <mesh position={[0, 0.34, -L / 2 + 0.1]}>
            <boxGeometry args={[W - 0.3, 0.1, 0.3]} />
            <meshStandardMaterial color="#141414" roughness={0.8} />
          </mesh>
          {[-1, 1].map((sd) => (
            <mesh key={'e' + sd} position={[sd * 0.45, 0.32, -L / 2 - 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.16, 12]} />
              <meshStandardMaterial color="#9ea3aa" metalness={0.9} roughness={0.3} />
            </mesh>
          ))}
          {spec.id === 'gt' || spec.id === 'rally' ? (
            <mesh position={[0, 1.02, -L / 2 + 0.18]} castShadow>
              <boxGeometry args={[W - 0.5, 0.04, 0.3]} />
              <meshPhysicalMaterial color={paint} metalness={0.6} roughness={0.28} clearcoat={1} />
            </mesh>
          ) : null}
          {/* interior */}
          <group>
            <mesh position={[0, 0.92, 0.55 * (L / 4.5)]}>
              <boxGeometry args={[W - 0.5, 0.18, 0.5]} />
              <meshStandardMaterial color="#1b1d21" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.7, -0.1]}>
              <boxGeometry args={[W - 0.5, 0.3, 1.6]} />
              <meshStandardMaterial color="#202226" roughness={0.9} />
            </mesh>
            {[-1, 1].map((sd) => (
              <group key={'s' + sd} position={[sd * 0.38, 0.85, -0.05]}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.5, 0.12, 0.5]} />
                  <meshStandardMaterial color="#2a2d33" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.3, -0.25]} rotation={[-0.2, 0, 0]}>
                  <boxGeometry args={[0.5, 0.6, 0.1]} />
                  <meshStandardMaterial color="#2a2d33" roughness={0.9} />
                </mesh>
              </group>
            ))}
            <group ref={wheelRef} position={[0.38, 1.02, 0.42 * (L / 4.5)]} rotation={[0.4, 0, 0]}>
              <mesh>
                <torusGeometry args={[0.17, 0.02, 10, 32]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
              </mesh>
              <mesh>
                <boxGeometry args={[0.32, 0.03, 0.02]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
      {/* wheels (not affected by body roll) */}
      <group ref={flSteer} position={[track / 2, r, spec.a]}>
        <group ref={flSpin}>
          <Wheel radius={r} side={1} />
        </group>
      </group>
      <group ref={frSteer} position={[-track / 2, r, spec.a]}>
        <group ref={frSpin}>
          <Wheel radius={r} side={-1} />
        </group>
      </group>
      <group position={[track / 2, r, -spec.b]}>
        <group ref={rlSpin}>
          <Wheel radius={r} side={1} />
        </group>
      </group>
      <group position={[-track / 2, r, -spec.b]}>
        <group ref={rrSpin}>
          <Wheel radius={r} side={-1} />
        </group>
      </group>
    </group>
  );
}
