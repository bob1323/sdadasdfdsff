// Deterministic world layout shared by physics and rendering.

export const BLOCK = 100; // road pitch
export const ROAD_W = 14;
export const CITY_N = 6; // blocks per side
export const CITY_HALF = (CITY_N * BLOCK) / 2; // 300 -> roads at -300..300
export const SIDEWALK = 4;
export const RING_R = 400; // perimeter highway centreline
export const RING_W = 22;
export const WORLD_LIMIT = 980;

export type Surface = 'asphalt' | 'concrete' | 'grass';
export type BlockType = 'buildings' | 'park' | 'lot' | 'plaza';

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export interface Building extends AABB {
  color: string;
  style: number; // window texture variant
  roofColor: string;
}

export interface Tree {
  x: number;
  z: number;
  scale: number;
  variant: number;
}

export interface Cone {
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  tilt: number; // 0 upright, ~1.5 lying down
  tiltDir: number;
  hit: boolean;
}

export interface Lamp {
  x: number;
  z: number;
  rot: number;
}

// --- seeded random -------------------------------------------------------
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(1337);

// --- block types ---------------------------------------------------------
export const blockTypes: BlockType[][] = [];
for (let i = 0; i < CITY_N; i++) {
  blockTypes.push([]);
  for (let j = 0; j < CITY_N; j++) blockTypes[i].push('buildings');
}
// A big open skid‑pad: two adjacent blocks merged
blockTypes[2][2] = 'lot';
blockTypes[3][2] = 'lot';
blockTypes[1][4] = 'park';
blockTypes[4][1] = 'park';
blockTypes[0][5] = 'park';
blockTypes[5][4] = 'plaza';
blockTypes[4][4] = 'park';

export function blockCenter(i: number, j: number): [number, number] {
  return [-CITY_HALF + BLOCK / 2 + i * BLOCK, -CITY_HALF + BLOCK / 2 + j * BLOCK];
}
export const INNER_HALF = BLOCK / 2 - ROAD_W / 2; // 43
export const BUILD_HALF = INNER_HALF - SIDEWALK; // 39

// --- buildings -----------------------------------------------------------
const PALETTE = [
  '#b9b3a6',
  '#8f959c',
  '#6f7d8c',
  '#d9c9b0',
  '#a8846b',
  '#5c6670',
  '#c7cdd3',
  '#9c7a5c',
  '#3f4a58',
  '#e0d8c8',
  '#7a8fa6',
  '#b5654a',
];

export const buildings: Building[] = [];
export const trees: Tree[] = [];
export const lamps: Lamp[] = [];
export const cones: Cone[] = [];

for (let i = 0; i < CITY_N; i++) {
  for (let j = 0; j < CITY_N; j++) {
    const type = blockTypes[i][j];
    const [cx, cz] = blockCenter(i, j);
    if (type === 'buildings') {
      const n = rand() < 0.35 ? 2 : 3;
      const cell = (BUILD_HALF * 2) / n;
      const centrality = 1 - Math.hypot(cx, cz) / (CITY_HALF * 1.4);
      for (let u = 0; u < n; u++) {
        for (let v = 0; v < n; v++) {
          if (rand() < 0.12) {
            // small pocket park with trees
            const px = cx - BUILD_HALF + cell * (u + 0.5);
            const pz = cz - BUILD_HALF + cell * (v + 0.5);
            for (let k = 0; k < 4; k++) {
              trees.push({
                x: px + (rand() - 0.5) * cell * 0.7,
                z: pz + (rand() - 0.5) * cell * 0.7,
                scale: 0.8 + rand() * 0.6,
                variant: Math.floor(rand() * 3),
              });
            }
            continue;
          }
          const pad = 2 + rand() * 4;
          const w = cell - pad * 2 - rand() * 4;
          const d = cell - pad * 2 - rand() * 4;
          const bx = cx - BUILD_HALF + cell * (u + 0.5) + (rand() - 0.5) * 3;
          const bz = cz - BUILD_HALF + cell * (v + 0.5) + (rand() - 0.5) * 3;
          const h = 7 + rand() * rand() * 42 * (0.5 + centrality) + (rand() < 0.08 ? 40 : 0);
          buildings.push({
            minX: bx - w / 2,
            maxX: bx + w / 2,
            minZ: bz - d / 2,
            maxZ: bz + d / 2,
            height: Math.round(h / 3.2) * 3.2 + 0.6,
            color: PALETTE[Math.floor(rand() * PALETTE.length)],
            style: Math.floor(rand() * 3),
            roofColor: rand() < 0.5 ? '#5a5f66' : '#7a7568',
          });
        }
      }
    } else if (type === 'park') {
      for (let k = 0; k < 28; k++) {
        trees.push({
          x: cx + (rand() - 0.5) * BUILD_HALF * 1.9,
          z: cz + (rand() - 0.5) * BUILD_HALF * 1.9,
          scale: 0.9 + rand() * 0.8,
          variant: Math.floor(rand() * 3),
        });
      }
    } else if (type === 'plaza') {
      // a fountain in the middle as a round-ish obstacle
      buildings.push({
        minX: cx - 5,
        maxX: cx + 5,
        minZ: cz - 5,
        maxZ: cz + 5,
        height: 1.2,
        color: '#8d99a6',
        style: 3,
        roofColor: '#4d7fa8',
      });
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        trees.push({
          x: cx + Math.cos(ang) * 30,
          z: cz + Math.sin(ang) * 30,
          scale: 1.1,
          variant: 1,
        });
      }
    }
  }
}

// Street lamps along every city road, alternating sides
for (let k = 0; k <= CITY_N; k++) {
  const line = -CITY_HALF + k * BLOCK;
  for (let s = -CITY_HALF + 25; s < CITY_HALF; s += 50) {
    const side = ((s / 50) | 0) % 2 === 0 ? 1 : -1;
    lamps.push({ x: s, z: line + side * (ROAD_W / 2 + 0.8), rot: side > 0 ? Math.PI : 0 });
    lamps.push({ x: line + side * (ROAD_W / 2 + 0.8), z: s, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
  }
}

// Remove lamps that would stand inside the merged skid-pad lot (blocks (2,2)+(3,2))
for (let i = lamps.length - 1; i >= 0; i--) {
  const l = lamps[i];
  if (Math.abs(l.x) < BLOCK - ROAD_W / 2 + 2 && Math.abs(l.z + 50) < INNER_HALF + 2) lamps.splice(i, 1);
}

// Cones on the skid pad: a slalom line and a drift circle
const [lotCx, lotCz] = (() => {
  const [ax, az] = blockCenter(2, 2);
  const [bx] = blockCenter(3, 2);
  return [(ax + bx) / 2, az];
})();
export const LOT_CENTER: [number, number] = [lotCx, lotCz];
export const LOT_HALF_X = BLOCK - ROAD_W / 2; // 93 (two blocks)
export const LOT_HALF_Z = INNER_HALF; // 43

for (let k = 0; k < 9; k++) {
  cones.push({ x: lotCx - 60 + k * 15, z: lotCz + 28, vx: 0, vz: 0, yaw: 0, tilt: 0, tiltDir: 0, hit: false });
}
for (let k = 0; k < 16; k++) {
  const ang = (k / 16) * Math.PI * 2;
  cones.push({
    x: lotCx - 30 + Math.cos(ang) * 22,
    z: lotCz - 8 + Math.sin(ang) * 22,
    vx: 0,
    vz: 0,
    yaw: 0,
    tilt: 0,
    tiltDir: 0,
    hit: false,
  });
}
for (let k = 0; k < 6; k++) {
  cones.push({ x: lotCx + 45 + (k % 2) * 4, z: lotCz - 30 + Math.floor(k / 2) * 12, vx: 0, vz: 0, yaw: 0, tilt: 0, tiltDir: 0, hit: false });
}
export const DRIFT_CIRCLE: [number, number, number] = [lotCx - 30, lotCz - 8, 22];

// Countryside trees outside the ring road
for (let k = 0; k < 700; k++) {
  const ang = rand() * Math.PI * 2;
  const r = RING_R + 30 + rand() * rand() * 520;
  const x = Math.cos(ang) * r * (0.9 + rand() * 0.3);
  const z = Math.sin(ang) * r * (0.9 + rand() * 0.3);
  if (Math.max(Math.abs(x), Math.abs(z)) < RING_R + 18) continue;
  trees.push({ x, z, scale: 1 + rand() * 1.4, variant: Math.floor(rand() * 3) });
}

// --- collision set -------------------------------------------------------
export const colliders: AABB[] = [
  ...buildings,
  // skid pad guard rails
  { minX: lotCx - LOT_HALF_X, maxX: lotCx + LOT_HALF_X, minZ: lotCz + LOT_HALF_Z + 0.8, maxZ: lotCz + LOT_HALF_Z + 1.2, height: 1 },
  { minX: lotCx - LOT_HALF_X, maxX: lotCx + LOT_HALF_X, minZ: lotCz - LOT_HALF_Z - 1.2, maxZ: lotCz - LOT_HALF_Z - 0.8, height: 1 },
  // world boundary walls
  { minX: -WORLD_LIMIT - 10, maxX: -WORLD_LIMIT, minZ: -WORLD_LIMIT - 10, maxZ: WORLD_LIMIT + 10, height: 3 },
  { minX: WORLD_LIMIT, maxX: WORLD_LIMIT + 10, minZ: -WORLD_LIMIT - 10, maxZ: WORLD_LIMIT + 10, height: 3 },
  { minX: -WORLD_LIMIT - 10, maxX: WORLD_LIMIT + 10, minZ: -WORLD_LIMIT - 10, maxZ: -WORLD_LIMIT, height: 3 },
  { minX: -WORLD_LIMIT - 10, maxX: WORLD_LIMIT + 10, minZ: WORLD_LIMIT, maxZ: WORLD_LIMIT + 10, height: 3 },
];
// trees as small colliders (only city ones – countryside are decorative)
for (const t of trees) {
  if (Math.max(Math.abs(t.x), Math.abs(t.z)) < CITY_HALF) {
    colliders.push({ minX: t.x - 0.35, maxX: t.x + 0.35, minZ: t.z - 0.35, maxZ: t.z + 0.35, height: 3 });
  }
}
// lamp posts
for (const l of lamps) {
  colliders.push({ minX: l.x - 0.2, maxX: l.x + 0.2, minZ: l.z - 0.2, maxZ: l.z + 0.2, height: 6 });
}

// Spatial hash for colliders
const CELL = 50;
const grid = new Map<string, AABB[]>();
function key(cx: number, cz: number) {
  return cx + ':' + cz;
}
for (const c of colliders) {
  const x0 = Math.floor(c.minX / CELL);
  const x1 = Math.floor(c.maxX / CELL);
  const z0 = Math.floor(c.minZ / CELL);
  const z1 = Math.floor(c.maxZ / CELL);
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const k = key(x, z);
      let arr = grid.get(k);
      if (!arr) {
        arr = [];
        grid.set(k, arr);
      }
      arr.push(c);
    }
  }
}
export function nearbyColliders(x: number, z: number, out: AABB[]): AABB[] {
  out.length = 0;
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const arr = grid.get(key(cx + i, cz + j));
      if (arr) for (const c of arr) out.push(c);
    }
  }
  return out;
}

// --- surface query -------------------------------------------------------
function nearRoadLine(v: number): boolean {
  const m = ((((v + CITY_HALF) % BLOCK) + BLOCK) % BLOCK);
  return m < ROAD_W / 2 || m > BLOCK - ROAD_W / 2;
}

export function surfaceAt(x: number, z: number): Surface {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const cityEdge = CITY_HALF + ROAD_W / 2;
  if (ax <= cityEdge && az <= cityEdge) {
    if (nearRoadLine(x) || nearRoadLine(z)) return 'asphalt';
    const i = Math.floor((x + CITY_HALF) / BLOCK);
    const j = Math.floor((z + CITY_HALF) / BLOCK);
    const t = blockTypes[Math.min(CITY_N - 1, Math.max(0, i))][Math.min(CITY_N - 1, Math.max(0, j))];
    const [cx, cz] = blockCenter(i, j);
    const inside = Math.abs(x - cx) < BUILD_HALF && Math.abs(z - cz) < BUILD_HALF;
    if (t === 'lot') return 'asphalt';
    if (t === 'plaza') return 'concrete';
    if (t === 'park') return inside ? 'grass' : 'concrete';
    return inside ? 'grass' : 'concrete';
  }
  // ring road
  const ringHalf = RING_W / 2;
  const onRing =
    (Math.abs(ax - RING_R) < ringHalf && az < RING_R + ringHalf) ||
    (Math.abs(az - RING_R) < ringHalf && ax < RING_R + ringHalf);
  if (onRing) return 'asphalt';
  // connector roads from city to ring (extensions of the axis roads)
  if ((Math.abs(x) < ROAD_W / 2 || Math.abs(z) < ROAD_W / 2) && ax < RING_R && az < RING_R) return 'asphalt';
  return 'grass';
}

/** Find a sensible respawn pose on the nearest road, keeping heading roughly the same. */
export function nearestRoadPose(x: number, z: number, yaw: number): { x: number; z: number; yaw: number } {
  const snapLine = (v: number) => Math.round((v + CITY_HALF) / BLOCK) * BLOCK - CITY_HALF;
  const inCity = Math.abs(x) < CITY_HALF + ROAD_W && Math.abs(z) < CITY_HALF + ROAD_W;
  if (inCity) {
    const lx = snapLine(x);
    const lz = snapLine(z);
    const dx = Math.abs(x - lx);
    const dz = Math.abs(z - lz);
    if (dx <= dz) {
      // road runs along z at x = lx
      const dir = Math.cos(yaw) >= 0 ? 0 : Math.PI;
      return { x: lx + (dir === 0 ? -3.5 : 3.5), z, yaw: dir };
    }
    const dir = Math.sin(yaw) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    return { x, z: lz + (dir > 0 ? 3.5 : -3.5), yaw: dir };
  }
  // ring road: snap to nearest ring edge
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax > az) {
    const sx = Math.sign(x) * RING_R;
    const dir = Math.cos(yaw) >= 0 ? 0 : Math.PI;
    return { x: sx + (dir === 0 ? -5 : 5), z: Math.max(-RING_R, Math.min(RING_R, z)), yaw: dir };
  }
  const sz = Math.sign(z) * RING_R;
  const dir = Math.sin(yaw) >= 0 ? Math.PI / 2 : -Math.PI / 2;
  return { x: Math.max(-RING_R, Math.min(RING_R, x)), z: sz + (dir > 0 ? 5 : -5), yaw: dir };
}

export function resetCones() {
  // restore original positions from a snapshot
  for (let i = 0; i < cones.length; i++) {
    const c = cones[i];
    const o = coneOrigins[i];
    c.x = o[0];
    c.z = o[1];
    c.vx = 0;
    c.vz = 0;
    c.yaw = 0;
    c.tilt = 0;
    c.tiltDir = 0;
    c.hit = false;
  }
}
const coneOrigins: [number, number][] = cones.map((c) => [c.x, c.z]);
