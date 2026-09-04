export type Drivetrain = 'RWD' | 'FWD' | 'AWD';

export interface CarSpec {
  id: string;
  name: string;
  desc: string;
  color: string;
  mass: number; // kg
  a: number; // CG to front axle (m)
  b: number; // CG to rear axle (m)
  cgHeight: number; // m
  track: number; // m
  wheelRadius: number; // m
  cdA: number; // drag coefficient * frontal area
  clA: number; // downforce coefficient * area (positive = downforce)
  rollingCoef: number;
  maxSteer: number; // rad
  torqueCurve: [number, number][]; // [rpm, Nm]
  idleRpm: number;
  redline: number;
  engineInertia: number; // kg m^2
  engineBrake: number; // Nm at redline
  gears: number[];
  finalDrive: number;
  reverseRatio: number;
  drivetrain: Drivetrain;
  awdFrontSplit: number; // fraction of torque to front for AWD
  muFront: number;
  muRear: number;
  brakeForce: number; // N total
  brakeBias: number; // fraction front
  grassGrip: number; // multiplier on grass
  cylinders: number;
  bodyLength: number;
  bodyWidth: number;
  power: string;
}

export const CARS: CarSpec[] = [
  {
    id: 'gt',
    name: 'Vanta GT',
    desc: 'RWD sports coupé · 3.0 L twin‑turbo I6',
    power: '420 hp · 560 Nm · 1550 kg',
    color: '#c8102e',
    mass: 1550,
    a: 1.25,
    b: 1.45,
    cgHeight: 0.48,
    track: 1.6,
    wheelRadius: 0.34,
    cdA: 0.68,
    clA: 0.35,
    rollingCoef: 0.013,
    maxSteer: 0.62,
    torqueCurve: [
      [800, 220],
      [1500, 340],
      [2200, 480],
      [3000, 555],
      [4000, 560],
      [5000, 555],
      [6000, 510],
      [6800, 440],
      [7400, 360],
    ],
    idleRpm: 850,
    redline: 7200,
    engineInertia: 0.22,
    engineBrake: 70,
    gears: [3.6, 2.19, 1.51, 1.17, 0.95, 0.79],
    finalDrive: 3.55,
    reverseRatio: 3.4,
    drivetrain: 'RWD',
    awdFrontSplit: 0,
    muFront: 1.08,
    muRear: 1.08,
    brakeForce: 24000,
    brakeBias: 0.64,
    grassGrip: 0.55,
    cylinders: 6,
    bodyLength: 4.5,
    bodyWidth: 1.86,
  },
  {
    id: 'muscle',
    name: 'Brawler 6.2',
    desc: 'RWD muscle car · 6.2 L V8',
    power: '480 hp · 690 Nm · 1820 kg',
    color: '#1f2a44',
    mass: 1820,
    a: 1.42,
    b: 1.38,
    cgHeight: 0.52,
    track: 1.62,
    wheelRadius: 0.35,
    cdA: 0.82,
    clA: 0.05,
    rollingCoef: 0.014,
    maxSteer: 0.6,
    torqueCurve: [
      [800, 380],
      [1500, 500],
      [2500, 600],
      [3500, 660],
      [4500, 690],
      [5200, 670],
      [5800, 620],
      [6400, 540],
      [6800, 460],
    ],
    idleRpm: 750,
    redline: 6500,
    engineInertia: 0.3,
    engineBrake: 90,
    gears: [2.66, 1.78, 1.3, 1.0, 0.8, 0.63],
    finalDrive: 3.73,
    reverseRatio: 2.9,
    drivetrain: 'RWD',
    awdFrontSplit: 0,
    muFront: 0.98,
    muRear: 0.98,
    brakeForce: 24000,
    brakeBias: 0.66,
    grassGrip: 0.55,
    cylinders: 8,
    bodyLength: 4.8,
    bodyWidth: 1.92,
  },
  {
    id: 'hatch',
    name: 'Kompakt RS',
    desc: 'FWD hot hatch · 2.0 L turbo I4',
    power: '260 hp · 370 Nm · 1340 kg',
    color: '#f2c200',
    mass: 1340,
    a: 1.05,
    b: 1.55,
    cgHeight: 0.5,
    track: 1.55,
    wheelRadius: 0.32,
    cdA: 0.7,
    clA: 0.0,
    rollingCoef: 0.013,
    maxSteer: 0.66,
    torqueCurve: [
      [800, 140],
      [1500, 260],
      [2200, 360],
      [3000, 370],
      [4200, 370],
      [5200, 350],
      [6000, 310],
      [6600, 260],
      [7000, 210],
    ],
    idleRpm: 800,
    redline: 6800,
    engineInertia: 0.18,
    engineBrake: 55,
    gears: [3.77, 2.09, 1.32, 0.98, 0.76, 0.62],
    finalDrive: 4.1,
    reverseRatio: 3.6,
    drivetrain: 'FWD',
    awdFrontSplit: 1,
    muFront: 1.0,
    muRear: 1.02,
    brakeForce: 19000,
    brakeBias: 0.68,
    grassGrip: 0.55,
    cylinders: 4,
    bodyLength: 4.25,
    bodyWidth: 1.8,
  },
  {
    id: 'rally',
    name: 'Terra AWD',
    desc: 'AWD rally sedan · 2.0 L turbo flat‑4',
    power: '310 hp · 430 Nm · 1480 kg',
    color: '#1e6fd9',
    mass: 1480,
    a: 1.2,
    b: 1.42,
    cgHeight: 0.5,
    track: 1.58,
    wheelRadius: 0.33,
    cdA: 0.74,
    clA: 0.2,
    rollingCoef: 0.014,
    maxSteer: 0.66,
    torqueCurve: [
      [800, 160],
      [1800, 300],
      [2800, 420],
      [3500, 432],
      [4500, 430],
      [5500, 400],
      [6300, 350],
      [7000, 280],
    ],
    idleRpm: 900,
    redline: 7000,
    engineInertia: 0.2,
    engineBrake: 60,
    gears: [3.4, 2.1, 1.5, 1.15, 0.92, 0.75],
    finalDrive: 4.0,
    reverseRatio: 3.5,
    drivetrain: 'AWD',
    awdFrontSplit: 0.42,
    muFront: 1.02,
    muRear: 1.02,
    brakeForce: 21000,
    brakeBias: 0.62,
    grassGrip: 0.72,
    cylinders: 4,
    bodyLength: 4.6,
    bodyWidth: 1.8,
  },
];

export function engineTorque(spec: CarSpec, rpm: number): number {
  const c = spec.torqueCurve;
  if (rpm <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (rpm <= c[i][0]) {
      const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]);
      return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t;
    }
  }
  return c[c.length - 1][1];
}
