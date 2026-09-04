import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useState } from 'react';
import HUD from './components/HUD';
import { PauseMenu, StartMenu } from './components/Menus';
import Scene from './components/Scene';
import { carAudio } from './sim/audio';
import { installInput, onAction } from './sim/input';
import { createVehicleState, resetVehicle } from './sim/physics';
import { CAMERA_MODES, selectCar, sim, SPAWN } from './sim/store';
import { nearestRoadPose, resetCones } from './sim/world';

export default function App() {
  const [carId, setCarId] = useState(sim.spec.id);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [, bump] = useState(0);
  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  useEffect(() => {
    installInput();
  }, []);

  const start = useCallback(() => {
    carAudio.start();
    carAudio.resume();
    sim.running = true;
    sim.paused = false;
    Object.assign(sim.state, createVehicleState(SPAWN.x, SPAWN.z, SPAWN.yaw));
    resetCones();
    setRunning(true);
    setPaused(false);
  }, []);

  useEffect(() => {
    return onAction((a) => {
      switch (a) {
        case 'camera': {
          const i = CAMERA_MODES.indexOf(sim.camera);
          sim.camera = CAMERA_MODES[(i + 1) % CAMERA_MODES.length];
          break;
        }
        case 'reset': {
          if (!sim.running) break;
          const s = sim.state;
          const p = nearestRoadPose(s.x, s.z, s.yaw);
          resetVehicle(s, p.x, p.z, p.yaw);
          break;
        }
        case 'tc':
          sim.state.tc = !sim.state.tc;
          break;
        case 'abs':
          sim.state.abs = !sim.state.abs;
          break;
        case 'auto':
          sim.state.auto = !sim.state.auto;
          if (sim.state.gear === 0) sim.state.gear = 1;
          break;
        case 'help':
          setShowHelp((v) => !v);
          break;
        case 'mute':
          sim.muted = !sim.muted;
          carAudio.setMuted(sim.muted);
          break;
        case 'lights':
          sim.headlights = !sim.headlights;
          break;
        case 'cones':
          resetCones();
          break;
        case 'pause':
          if (!sim.running) break;
          sim.paused = !sim.paused;
          setPaused(sim.paused);
          break;
      }
      bump((v) => v + 1);
    });
  }, []);

  const onSelect = (id: string) => {
    selectCar(id);
    setCarId(id);
  };

  return (
    <div className="fixed inset-0 bg-[#0b0f16] overflow-hidden font-sans">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 60, near: 0.3, far: 5000, position: [0, 3, -340] }}
        onPointerDown={() => carAudio.resume()}
      >
        <Suspense fallback={null}>
          <Scene carId={carId} />
        </Suspense>
      </Canvas>

      {running && <HUD showHelp={showHelp} isTouch={isTouch} />}

      {!running && <StartMenu selected={carId} onSelect={onSelect} onStart={start} />}
      {running && paused && (
        <PauseMenu
          onResume={() => {
            sim.paused = false;
            setPaused(false);
          }}
          onGarage={() => {
            sim.running = false;
            sim.paused = false;
            setRunning(false);
            setPaused(false);
          }}
        />
      )}
    </div>
  );
}
