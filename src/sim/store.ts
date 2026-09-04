import { CARS, CarSpec } from './cars';
import { createVehicleState, VehicleState } from './physics';

export type CameraMode = 'chase' | 'far' | 'hood' | 'cockpit' | 'cinematic';
export const CAMERA_MODES: CameraMode[] = ['chase', 'far', 'hood', 'cockpit', 'cinematic'];

export interface SimStore {
  spec: CarSpec;
  state: VehicleState;
  camera: CameraMode;
  running: boolean;
  paused: boolean;
  headlights: boolean;
  muted: boolean;
  // for effects
  worldVx: number;
  worldVz: number;
}

// spawn on the x=0 avenue at the southern edge of the city, heading north (+z)
export const SPAWN = { x: -3.5, z: -330, yaw: 0 };

export const sim: SimStore = {
  spec: CARS[0],
  state: createVehicleState(SPAWN.x, SPAWN.z, SPAWN.yaw),
  camera: 'chase',
  running: false,
  paused: false,
  headlights: false,
  muted: false,
  worldVx: 0,
  worldVz: 0,
};

export function selectCar(id: string) {
  const spec = CARS.find((c) => c.id === id) ?? CARS[0];
  sim.spec = spec;
}
