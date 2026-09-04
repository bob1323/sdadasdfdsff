import { CarSpec, engineTorque } from './cars';
import { AABB, Cone, cones, nearbyColliders, Surface, surfaceAt } from './world';

export type AxleMode = 'grip' | 'spin' | 'locked';

export interface ControlInput {
  steer: number; // -1..1 (positive = left)
  forward: number; // 0..1 (W / up)
  back: number; // 0..1 (S / down)
  handbrake: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
}

export interface VehicleState {
  x: number;
  z: number;
  yaw: number;
  vx: number; // forward (m/s)
  vy: number; // lateral, positive left (m/s)
  r: number; // yaw rate (rad/s), positive = CCW / left
  ax: number; // filtered long. accel (m/s^2)
  ay: number; // filtered lat. accel
  steer: number;
  throttle: number;
  brake: number;
  handbrake: boolean;
  gear: number; // -1 R, 0 N, 1..n
  rpm: number;
  clutch: number;
  shiftTimer: number;
  shiftCooldown: number;
  frontMode: AxleMode;
  rearMode: AxleMode;
  omegaF: number;
  omegaR: number;
  slipF: number; // slip angle (rad)
  slipR: number;
  skidF: number; // 0..1 effect intensity
  skidR: number;
  wheelAngleF: number;
  wheelAngleR: number;
  speed: number;
  surface: Surface;
  tc: boolean;
  abs: boolean;
  auto: boolean;
  collision: number; // impulse magnitude this frame (for fx)
  collisionTimer: number;
  odometer: number;
  FzF: number;
  FzR: number;
  time: number;
  topSpeed: number;
  driftScore: number;
  driftAngle: number;
  stopTimer: number;
}

export function createVehicleState(x = 0, z = 0, yaw = 0): VehicleState {
  return {
    x,
    z,
    yaw,
    vx: 0,
    vy: 0,
    r: 0,
    ax: 0,
    ay: 0,
    steer: 0,
    throttle: 0,
    brake: 0,
    handbrake: false,
    gear: 1,
    rpm: 900,
    clutch: 1,
    shiftTimer: 0,
    shiftCooldown: 0,
    frontMode: 'grip',
    rearMode: 'grip',
    omegaF: 0,
    omegaR: 0,
    slipF: 0,
    slipR: 0,
    skidF: 0,
    skidR: 0,
    wheelAngleF: 0,
    wheelAngleR: 0,
    speed: 0,
    surface: 'asphalt',
    tc: true,
    abs: true,
    auto: true,
    collision: 0,
    collisionTimer: 0,
    odometer: 0,
    FzF: 0,
    FzR: 0,
    time: 0,
    topSpeed: 0,
    driftScore: 0,
    driftAngle: 0,
    stopTimer: 0,
  };
}

const G = 9.81;
const RHO = 1.225;
const PAC_B = 9.5;
const PAC_C = 1.35;
const WHEEL_INERTIA = 1.4; // per wheel kg m^2

function approach(cur: number, target: number, maxDelta: number) {
  if (cur < target) return Math.min(target, cur + maxDelta);
  return Math.max(target, cur - maxDelta);
}
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

interface AxleResult {
  fx: number; // body-frame
  fy: number;
  mode: AxleMode;
  omega: number;
  slipAngle: number;
  skid: number;
  holding: boolean;
}
const axleOut: AxleResult = { fx: 0, fy: 0, mode: 'grip', omega: 0, slipAngle: 0, skid: 0, holding: false };

function axleForces(
  Fz: number,
  mu: number,
  delta: number,
  vx: number,
  vlat: number,
  Fdrive: number,
  Fbrake: number,
  mode: AxleMode,
  omega: number,
  forceLock: boolean,
  abs: boolean,
  tc: boolean,
  Ieff: number,
  wheelR: number,
  dt: number,
  massShare: number,
): AxleResult {
  const cd = Math.cos(delta);
  const sd = Math.sin(delta);
  // velocity in wheel frame
  const vLong = vx * cd + vlat * sd;
  const vLatW = -vx * sd + vlat * cd;
  const Fmax = Math.max(1, mu * Fz);
  const muK = 0.78;

  const alpha = Math.atan2(vLatW, Math.max(Math.abs(vLong), 0.6));
  const FyDemand = -Fmax * Math.sin(PAC_C * Math.atan(PAC_B * alpha));
  const latUse = Math.min(1, (FyDemand / Fmax) * (FyDemand / Fmax));
  const FxAvail = Fmax * Math.sqrt(Math.max(0.03, 1 - latUse));

  let fxW = 0;
  let fyW = 0;
  let skid = 0;
  let holding = false;
  const slow = Math.abs(vLong) < 0.15;

  // --- mode transitions
  if (forceLock && !slow) mode = 'locked';
  else if (mode === 'locked') {
    if (!forceLock && (Fbrake < 0.85 * Fmax || slow)) mode = 'grip';
  } else if (mode === 'spin') {
    if (Math.abs(omega * wheelR - vLong) < 0.6 && Math.abs(Fdrive) < 0.95 * FxAvail) mode = 'grip';
    if (Math.abs(Fdrive) < 1) mode = 'grip';
  } else {
    if (!abs && Fbrake > FxAvail && !slow) mode = 'locked';
    else if (!tc && Math.abs(Fdrive) > FxAvail) {
      mode = 'spin';
      omega = vLong / wheelR + Math.sign(Fdrive) * 3;
    }
  }

  if (mode === 'grip') {
    let brake = Fbrake;
    if (abs) brake = Math.min(brake, 0.96 * FxAvail);
    let drive = Fdrive;
    if (tc) drive = clamp(drive, -0.93 * FxAvail, 0.93 * FxAvail);
    let fxDem: number;
    if (slow && brake > 0) {
      // static holding: brake force can only cancel motion
      holding = true;
      fxDem = clamp(drive, -Fmax, Fmax);
      const need = (-vLong * massShare) / dt;
      fxDem = Math.abs(fxDem) > brake ? fxDem : clamp(need, -brake, brake);
    } else {
      fxDem = drive - Math.sign(vLong) * brake;
    }
    fxW = clamp(fxDem, -Fmax, Fmax);
    const FyMax = Math.sqrt(Math.max(0, Fmax * Fmax - fxW * fxW));
    fyW = clamp(FyDemand, -FyMax, FyMax);
    // impulse limiter at low speed (prevents jitter): cannot reverse lateral velocity within one step
    const fyLim = (Math.abs(vLatW) * massShare) / dt;
    fyW = clamp(fyW, -fyLim, fyLim);
    omega = vLong / wheelR;
    const sat = Math.abs(fyW) / Math.max(1, FyMax);
    skid = sat > 0.92 && Math.abs(vLong) > 4 ? clamp((Math.abs(alpha) - 0.09) * 5, 0, 1) : 0;
  } else if (mode === 'locked') {
    const sx = -vLong;
    const sy = -vLatW;
    const mag = Math.hypot(sx, sy);
    const f = (muK * Fmax) / (mag + 0.25);
    fxW = sx * f;
    fyW = sy * f;
    omega = 0;
    skid = clamp(mag / 3, 0, 1);
  } else {
    // spinning: friction force opposes slip velocity, wheel has its own dynamics
    const slipLong = omega * wheelR - vLong;
    const sy = -vLatW;
    const mag = Math.hypot(slipLong, sy);
    const f = (muK * Fmax) / (mag + 0.35);
    fxW = slipLong * f;
    fyW = sy * f;
    const brakeT = -Math.sign(omega) * Fbrake * wheelR;
    omega += ((Fdrive * wheelR - fxW * wheelR + brakeT) / Ieff) * dt;
    skid = clamp(Math.abs(slipLong) / 4, 0.4, 1);
  }

  axleOut.fx = fxW * cd - fyW * sd;
  axleOut.fy = fxW * sd + fyW * cd;
  axleOut.mode = mode;
  axleOut.omega = omega;
  axleOut.slipAngle = alpha;
  axleOut.skid = skid;
  axleOut.holding = holding;
  return axleOut;
}

const nearby: AABB[] = [];
const corners: [number, number][] = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
];

export function stepVehicle(s: VehicleState, spec: CarSpec, input: ControlInput, dt: number) {
  const m = spec.mass;
  const a = spec.a;
  const b = spec.b;
  const L = a + b;
  const h = spec.cgHeight;
  const Iz = 1.05 * m * a * b;
  const wr = spec.wheelRadius;
  s.time += dt;

  // ---------------- inputs ----------------
  const speed = Math.hypot(s.vx, s.vy);
  const steerLimit = spec.maxSteer / (1 + Math.abs(s.vx) / 14);
  const steerTarget = input.steer * steerLimit;
  const centering = Math.abs(steerTarget) < Math.abs(s.steer) || Math.sign(steerTarget) !== Math.sign(s.steer);
  const steerRate = spec.maxSteer * (centering ? 6 : 3.2) * (1 / (1 + Math.abs(s.vx) / 60));
  s.steer = approach(s.steer, steerTarget, steerRate * dt);

  // gear direction handling
  let throttleIn: number;
  let brakeIn: number;
  if (s.gear === -1) {
    throttleIn = input.back;
    brakeIn = input.forward;
  } else {
    throttleIn = input.forward;
    brakeIn = input.back;
  }
  if (Math.abs(s.vx) < 0.4) {
    s.stopTimer += dt;
    if (s.gear !== -1 && input.back > 0 && input.forward === 0 && s.stopTimer > 0.12) {
      s.gear = -1;
      throttleIn = input.back;
      brakeIn = 0;
    } else if (s.gear === -1 && input.forward > 0 && input.back === 0 && s.stopTimer > 0.12) {
      s.gear = 1;
      throttleIn = input.forward;
      brakeIn = 0;
    }
  } else s.stopTimer = 0;

  s.throttle = approach(s.throttle, throttleIn, dt * (throttleIn > s.throttle ? 5 : 9));
  s.brake = approach(s.brake, brakeIn, dt * 8);
  s.handbrake = input.handbrake;

  // manual shifting
  if (!s.auto && s.shiftTimer <= 0) {
    if (input.shiftUp && s.gear < spec.gears.length) {
      s.gear = s.gear + 1;
      s.shiftTimer = 0.22;
    } else if (input.shiftDown && s.gear > -1) {
      s.gear = s.gear - 1;
      s.shiftTimer = 0.22;
    }
  }

  // ---------------- surface & loads ----------------
  s.surface = surfaceAt(s.x, s.z);
  const surfMu = s.surface === 'asphalt' ? 1 : s.surface === 'concrete' ? 0.95 : spec.grassGrip;
  const rollC = spec.rollingCoef * (s.surface === 'grass' ? 4.5 : 1);
  const q = 0.5 * RHO * speed * speed;
  const down = q * spec.clA;
  let FzF = (m * G * b) / L - (m * s.ax * h) / L + down * 0.4;
  let FzR = (m * G * a) / L + (m * s.ax * h) / L + down * 0.6;
  FzF = Math.max(0.15 * m * G, FzF);
  FzR = Math.max(0.15 * m * G, FzR);
  s.FzF = FzF;
  s.FzR = FzR;

  // ---------------- engine & drivetrain ----------------
  const inGear = s.gear !== 0;
  let ratio = 0;
  if (s.gear > 0) ratio = spec.gears[s.gear - 1] * spec.finalDrive;
  else if (s.gear < 0) ratio = -spec.reverseRatio * spec.finalDrive;

  if (s.shiftTimer > 0) {
    s.shiftTimer -= dt;
    s.clutch = 0;
  } else s.clutch = inGear ? 1 : 0;
  if (s.shiftCooldown > 0) s.shiftCooldown -= dt;

  const drivenOmega =
    spec.drivetrain === 'FWD' ? s.omegaF : spec.drivetrain === 'RWD' ? s.omegaR : Math.max(s.omegaF, s.omegaR);
  const roadRpm = ((drivenOmega * ratio) / (2 * Math.PI)) * 60;

  let Te: number;
  const limiter = s.rpm > spec.redline;
  const throttleEff = limiter ? 0 : s.throttle;
  Te = engineTorque(spec, s.rpm) * throttleEff - spec.engineBrake * (s.rpm / spec.redline) * (1 - throttleEff);
  // idle governor: hold idle in neutral, no net torque (no creep) when in gear at idle
  if (s.rpm < spec.idleRpm + 30 && throttleEff < 0.05) Te = s.clutch > 0 && inGear ? 0 : Te + 40;

  // rpm determination
  const spinning =
    (spec.drivetrain !== 'FWD' && s.rearMode === 'spin') || (spec.drivetrain !== 'RWD' && s.frontMode === 'spin');
  const launchRpm = spec.idleRpm + s.throttle * 1600;
  if (s.clutch > 0 && inGear) {
    if (spinning) {
      s.rpm = Math.max(spec.idleRpm, roadRpm);
    } else if (roadRpm < launchRpm) {
      // clutch slipping (launch)
      s.rpm = approach(s.rpm, launchRpm, 9000 * dt);
    } else {
      s.rpm = roadRpm;
    }
  } else {
    // free revving (neutral or shifting)
    const target = inGear ? Math.max(spec.idleRpm, roadRpm) : 0;
    if (inGear && s.shiftTimer > 0) s.rpm = approach(s.rpm, target, 14000 * dt);
    else s.rpm += ((Te / spec.engineInertia) * 60) / (2 * Math.PI) * dt;
    s.rpm = clamp(s.rpm, spec.idleRpm * 0.8, spec.redline + 300);
  }
  s.rpm = clamp(s.rpm, 0, spec.redline + 400);

  // drive force requested at wheels
  const clutchTorque = s.clutch > 0 && inGear ? Te : 0;
  const FdriveTotal = (clutchTorque * ratio * 0.92) / wr;
  let FdriveF = 0;
  let FdriveR = 0;
  if (spec.drivetrain === 'FWD') FdriveF = FdriveTotal;
  else if (spec.drivetrain === 'RWD') FdriveR = FdriveTotal;
  else {
    FdriveF = FdriveTotal * spec.awdFrontSplit;
    FdriveR = FdriveTotal * (1 - spec.awdFrontSplit);
  }

  // automatic gearbox
  if (s.auto && s.gear > 0 && s.shiftTimer <= 0 && s.shiftCooldown <= 0 && !spinning) {
    const span = spec.redline - spec.idleRpm;
    const upRpm = spec.idleRpm + span * (0.42 + 0.55 * s.throttle);
    const downRpm = spec.idleRpm + span * (0.16 + 0.22 * s.throttle);
    if (s.rpm > upRpm && s.gear < spec.gears.length && s.vx > 2) {
      s.gear++;
      s.shiftTimer = 0.25;
      s.shiftCooldown = 0.9;
    } else if (s.rpm < downRpm && s.gear > 1) {
      const lowerRatio = spec.gears[s.gear - 2] * spec.finalDrive;
      const predicted = ((s.vx / wr) * lowerRatio * 60) / (2 * Math.PI);
      if (predicted < spec.redline * 0.9) {
        s.gear--;
        s.shiftTimer = 0.2;
        s.shiftCooldown = 0.7;
      }
    }
  }

  // brakes
  const brakeTotal = s.brake * spec.brakeForce;
  const FbrakeF = brakeTotal * spec.brakeBias;
  let FbrakeR = brakeTotal * (1 - spec.brakeBias);
  if (s.handbrake) FbrakeR = Math.max(FbrakeR, spec.brakeForce * 0.5);

  // ---------------- tire forces ----------------
  const IeffF = 2 * WHEEL_INERTIA + (spec.drivetrain !== 'RWD' ? spec.engineInertia * ratio * ratio * 0.5 : 0);
  const IeffR = 2 * WHEEL_INERTIA + (spec.drivetrain !== 'FWD' ? spec.engineInertia * ratio * ratio * 0.5 : 0);

  const f = axleForces(
    FzF,
    spec.muFront * surfMu,
    s.steer,
    s.vx,
    s.vy + a * s.r,
    FdriveF,
    FbrakeF,
    s.frontMode,
    s.omegaF,
    false,
    s.abs,
    s.tc,
    IeffF,
    wr,
    dt,
    m * 0.5,
  );
  const FfX = f.fx;
  const FfY = f.fy;
  s.frontMode = f.mode;
  s.omegaF = f.omega;
  s.slipF = f.slipAngle;
  s.skidF = f.skid;
  const holdF = f.holding;

  const rr = axleForces(
    FzR,
    spec.muRear * surfMu,
    0,
    s.vx,
    s.vy - b * s.r,
    FdriveR,
    FbrakeR,
    s.rearMode,
    s.omegaR,
    s.handbrake,
    s.abs && !s.handbrake,
    s.tc,
    IeffR,
    wr,
    dt,
    m * 0.5,
  );
  const FrX = rr.fx;
  const FrY = rr.fy;
  s.rearMode = rr.mode;
  s.omegaR = rr.omega;
  s.slipR = rr.slipAngle;
  s.skidR = rr.skid;
  const holdR = rr.holding;

  // ---------------- resistances ----------------
  const dragX = 0.5 * RHO * spec.cdA * speed * s.vx;
  const dragY = 0.5 * RHO * spec.cdA * speed * s.vy * 1.6;
  const rolling = rollC * m * G * (s.vx / (Math.abs(s.vx) + 0.3));

  const Fx = FfX + FrX - dragX - rolling;
  const Fy = FfY + FrY - dragY;
  const Mz = a * FfY - b * FrY - s.r * 250;

  const axNow = Fx / m;
  const ayNow = Fy / m;

  // ---------------- integrate ----------------
  s.vx += (axNow + s.vy * s.r) * dt;
  s.vy += (ayNow - s.vx * s.r) * dt;
  s.r += (Mz / Iz) * dt;

  // stationary handling
  if ((holdF || holdR || s.handbrake) && Math.abs(s.vx) < 0.15 && Math.abs(FdriveTotal) < 50) {
    s.vx = 0;
    s.vy *= 0.5;
    s.r *= 0.5;
  }
  if (speed < 0.05 && s.throttle < 0.02) {
    s.vx = 0;
    s.vy = 0;
    s.r = 0;
  }

  const filt = 1 - Math.exp(-dt * 12);
  s.ax += (axNow - s.ax) * filt;
  s.ay += (ayNow - s.ay) * filt;

  const sinY = Math.sin(s.yaw);
  const cosY = Math.cos(s.yaw);
  const wvx = sinY * s.vx + cosY * s.vy;
  const wvz = cosY * s.vx - sinY * s.vy;
  s.x += wvx * dt;
  s.z += wvz * dt;
  s.yaw += s.r * dt;
  if (s.yaw > Math.PI) s.yaw -= Math.PI * 2;
  if (s.yaw < -Math.PI) s.yaw += Math.PI * 2;

  s.speed = Math.hypot(s.vx, s.vy);
  s.odometer += s.speed * dt;
  if (s.speed > s.topSpeed) s.topSpeed = s.speed;
  s.wheelAngleF += s.omegaF * dt;
  s.wheelAngleR += s.omegaR * dt;

  // drift scoring
  s.driftAngle = s.speed > 3 ? Math.atan2(s.vy, Math.abs(s.vx)) : 0;
  const da = Math.abs(s.driftAngle);
  if (da > 0.18 && s.speed > 6 && da < 1.4) s.driftScore += s.speed * da * dt * 8;

  // ---------------- collisions ----------------
  s.collision = 0;
  collide(s, spec);
  collideCones(s, spec, dt);
  if (s.collisionTimer > 0) s.collisionTimer -= dt;
}

function collide(s: VehicleState, spec: CarSpec) {
  const hl = spec.bodyLength / 2;
  const hw = spec.bodyWidth / 2;
  const sinY = Math.sin(s.yaw);
  const cosY = Math.cos(s.yaw);
  // forward = (sinY, cosY), left = (cosY, -sinY)
  const cs: [number, number][] = [
    [hl, hw],
    [hl, -hw],
    [-hl, hw],
    [-hl, -hw],
  ];
  for (let i = 0; i < 4; i++) {
    corners[i][0] = s.x + sinY * cs[i][0] + cosY * cs[i][1];
    corners[i][1] = s.z + cosY * cs[i][0] - sinY * cs[i][1];
  }
  nearbyColliders(s.x, s.z, nearby);
  const m = spec.mass;
  const Iz = 1.05 * m * spec.a * spec.b;
  for (const box of nearby) {
    const bw = box.maxX - box.minX;
    const bd = box.maxZ - box.minZ;
    if (bw < 2 && bd < 2) {
      // small post-like collider: treat as a circle against the car's box
      const cx = (box.minX + box.maxX) / 2;
      const cz = (box.minZ + box.maxZ) / 2;
      const rad = Math.max(bw, bd) / 2;
      const dx = cx - s.x;
      const dz = cz - s.z;
      if (dx * dx + dz * dz > (hl + rad + 0.5) * (hl + rad + 0.5)) continue;
      const lx = dx * sinY + dz * cosY; // forward
      const ly = dx * cosY - dz * sinY; // left
      const ox = hl + rad - Math.abs(lx);
      const oy = hw + rad - Math.abs(ly);
      if (ox <= 0 || oy <= 0) continue;
      let nx: number;
      let nz: number;
      let pen: number;
      if (ox < oy) {
        // push along forward axis, away from the post
        const sgn = lx > 0 ? -1 : 1;
        nx = sinY * sgn;
        nz = cosY * sgn;
        pen = ox;
      } else {
        const sgn = ly > 0 ? -1 : 1;
        nx = cosY * sgn;
        nz = -sinY * sgn;
        pen = oy;
      }
      s.x += nx * pen;
      s.z += nz * pen;
      applyImpulse(s, m, Iz, cx, cz, nx, nz, sinY, cosY, 0.2);
      continue;
    }
    for (let i = 0; i < 4; i++) {
      const px = corners[i][0];
      const pz = corners[i][1];
      if (px > box.minX && px < box.maxX && pz > box.minZ && pz < box.maxZ) {
        // minimum penetration axis
        const dxl = px - box.minX;
        const dxr = box.maxX - px;
        const dzl = pz - box.minZ;
        const dzr = box.maxZ - pz;
        let nx = 0;
        let nz = 0;
        let pen = dxl;
        nx = -1;
        if (dxr < pen) {
          pen = dxr;
          nx = 1;
          nz = 0;
        }
        if (dzl < pen) {
          pen = dzl;
          nx = 0;
          nz = -1;
        }
        if (dzr < pen) {
          pen = dzr;
          nx = 0;
          nz = 1;
        }
        // push out
        s.x += nx * pen;
        s.z += nz * pen;
        corners.forEach((c) => {
          c[0] += nx * pen;
          c[1] += nz * pen;
        });
        applyImpulse(s, m, Iz, px, pz, nx, nz, sinY, cosY, 0.25);
      }
    }
  }
}

/** Rigid-body collision impulse at world contact point (px,pz) with outward normal (nx,nz). */
function applyImpulse(
  s: VehicleState,
  m: number,
  Iz: number,
  px: number,
  pz: number,
  nx: number,
  nz: number,
  sinY: number,
  cosY: number,
  e: number,
) {
  const rx = px - s.x;
  const rz = pz - s.z;
  const wvx = sinY * s.vx + cosY * s.vy;
  const wvz = cosY * s.vx - sinY * s.vy;
  // point velocity = v + omega x r, omega about +y: (r*rz, -r*rx)
  const pvx = wvx + s.r * rz;
  const pvz = wvz - s.r * rx;
  const vn = pvx * nx + pvz * nz;
  if (vn >= 0) return;
  const rn = rx * nz - rz * nx;
  const j = (-(1 + e) * vn) / (1 / m + (rn * rn) / Iz);
  const nwvx = wvx + (j * nx) / m;
  const nwvz = wvz + (j * nz) / m;
  // (rel x J)_y = rz*Jx - rx*Jz = -j*rn
  s.r -= (rn * j) / Iz;
  s.vx = sinY * nwvx + cosY * nwvz;
  s.vy = cosY * nwvx - sinY * nwvz;
  // scrub friction along the surface
  s.vx *= 0.94;
  s.vy *= 0.94;
  s.r *= 0.7;
  s.collision = Math.max(s.collision, j / m);
  s.collisionTimer = 0.3;
}

function collideCones(s: VehicleState, spec: CarSpec, dt: number) {
  const hl = spec.bodyLength / 2;
  const hw = spec.bodyWidth / 2;
  const sinY = Math.sin(s.yaw);
  const cosY = Math.cos(s.yaw);
  for (const c of cones) {
    // integrate flying cones
    if (c.hit) {
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      const damp = Math.exp(-dt * 2.2);
      c.vx *= damp;
      c.vz *= damp;
      c.tilt = Math.min(1.45, c.tilt + dt * 4);
      c.yaw += dt * Math.hypot(c.vx, c.vz) * 0.5;
      if (Math.hypot(c.vx, c.vz) < 0.05) {
        c.vx = 0;
        c.vz = 0;
      }
    }
    const dx = c.x - s.x;
    const dz = c.z - s.z;
    if (dx * dx + dz * dz > 16) continue;
    // to body frame
    const lx = dx * sinY + dz * cosY; // forward
    const ly = dx * cosY - dz * sinY; // left
    const rad = 0.3;
    if (Math.abs(lx) < hl + rad && Math.abs(ly) < hw + rad) {
      const wvx = sinY * s.vx + cosY * s.vy;
      const wvz = cosY * s.vx - sinY * s.vy;
      const sp = Math.hypot(wvx, wvz);
      if (sp > 0.3 || !c.hit) {
        c.hit = true;
        const pushX = ly > 0 ? cosY : -cosY;
        const pushZ = ly > 0 ? -sinY : sinY;
        c.vx = wvx * 0.9 + pushX * 2.5 + (Math.random() - 0.5);
        c.vz = wvz * 0.9 + pushZ * 2.5 + (Math.random() - 0.5);
        c.tiltDir = Math.atan2(c.vx, c.vz);
        // move cone out of the car
        const ex = hw + rad + 0.05;
        const newLy = ly > 0 ? ex : -ex;
        c.x = s.x + sinY * lx + cosY * newLy;
        c.z = s.z + cosY * lx - sinY * newLy;
        s.vx *= 0.995;
        Cone_bumpSignal = Math.max(Cone_bumpSignal, sp);
      }
    }
  }
}
export let Cone_bumpSignal = 0;
export function consumeConeBump() {
  const v = Cone_bumpSignal;
  Cone_bumpSignal = 0;
  return v;
}

export function resetVehicle(s: VehicleState, x: number, z: number, yaw: number) {
  const keepTc = s.tc;
  const keepAbs = s.abs;
  const keepAuto = s.auto;
  const fresh = createVehicleState(x, z, yaw);
  Object.assign(s, fresh, {
    tc: keepTc,
    abs: keepAbs,
    auto: keepAuto,
    odometer: s.odometer,
    topSpeed: s.topSpeed,
    driftScore: s.driftScore,
  });
}

// utility for camera / audio
export function worldVelocity(s: VehicleState): [number, number] {
  const sinY = Math.sin(s.yaw);
  const cosY = Math.cos(s.yaw);
  return [sinY * s.vx + cosY * s.vy, cosY * s.vx - sinY * s.vy];
}

export type { Cone };
