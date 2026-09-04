import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { sim } from '../sim/store';
import CameraRig from './CameraRig';
import { SkidMarks, Smoke } from './Effects';
import Vehicle from './Vehicle';
import World from './World';

const SUN_DIR = new THREE.Vector3(0.45, 0.55, -0.3).normalize();

function Lighting() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const { scene } = useThree();
  useEffect(() => {
    scene.add(target);
    if (lightRef.current) lightRef.current.target = target;
    return () => {
      scene.remove(target);
    };
  }, [scene, target]);
  useFrame(() => {
    const l = lightRef.current;
    if (!l) return;
    const s = sim.state;
    const ax = s.x + sim.worldVx * 0.6;
    const az = s.z + sim.worldVz * 0.6;
    l.position.set(ax + SUN_DIR.x * 160, SUN_DIR.y * 160, az + SUN_DIR.z * 160);
    target.position.set(ax, 0, az);
    target.updateMatrixWorld();
  });
  return (
    <>
      <directionalLight
        ref={lightRef}
        castShadow
        intensity={3.2}
        color="#fff1dc"
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-near={20}
        shadow-camera-far={400}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />
      <hemisphereLight args={['#bcd4ff', '#5b6a45', 0.55]} />
      <ambientLight intensity={0.12} />
    </>
  );
}

function SkyDome() {
  const sky = useMemo(() => {
    const s = new Sky();
    // sphere instead of box so it always fits inside the far plane, and follow the camera
    s.geometry.dispose();
    (s as unknown as THREE.Mesh).geometry = new THREE.SphereGeometry(1, 48, 24);
    s.scale.setScalar(3800);
    s.frustumCulled = false;
    const u = s.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.85;
    u.sunPosition.value.copy(SUN_DIR);
    return s;
  }, []);
  useFrame(({ camera }) => {
    sky.position.copy(camera.position);
  });
  return <primitive object={sky} />;
}

function EnvironmentMap() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#3f78c8');
    g.addColorStop(0.45, '#a9c7ee');
    g.addColorStop(0.5, '#e6ded0');
    g.addColorStop(0.55, '#7a8b6a');
    g.addColorStop(1, '#3f4a38');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
    envScene.add(dome);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(20, 18, 14) }));
    sun.position.copy(SUN_DIR).multiplyScalar(40);
    envScene.add(sun);
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.4, 2.8), side: THREE.DoubleSide }));
    fill.position.set(0, 30, 0);
    fill.rotation.x = Math.PI / 2;
    envScene.add(fill);
    const rt = pmrem.fromScene(envScene, 0.04);
    scene.environment = rt.texture;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      rt.dispose();
      tex.dispose();
    };
  }, [gl, scene]);
  return null;
}

export default function Scene({ carId }: { carId: string }) {
  const { scene, gl } = useThree();
  void carId;
  useEffect(() => {
    scene.fog = new THREE.FogExp2('#c9d6e4', 0.00075);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [scene, gl]);

  return (
    <>
      <SkyDome />
      <EnvironmentMap />
      <Lighting />
      <World />
      <SkidMarks />
      <Smoke />
      <Vehicle key={sim.spec.id} spec={sim.spec} />
      <CameraRig />
    </>
  );
}
