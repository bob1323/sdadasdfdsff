import { useEffect, useRef, useState } from 'react';
import { touch } from '../sim/input';
import { CAMERA_MODES, sim } from '../sim/store';
import { BLOCK, CITY_HALF, CITY_N, RING_R } from '../sim/world';

interface Snapshot {
  kmh: number;
  rpm: number;
  gear: number;
  tc: boolean;
  abs: boolean;
  auto: boolean;
  surface: string;
  camera: string;
  drift: number;
  driftAngle: number;
  handbrake: boolean;
  rearMode: string;
  frontMode: string;
  shifting: boolean;
  headlights: boolean;
  muted: boolean;
  top: number;
  odo: number;
  ax: number;
  ay: number;
  x: number;
  z: number;
  yaw: number;
}

function snapshot(): Snapshot {
  const s = sim.state;
  return {
    kmh: Math.abs(s.vx) * 3.6,
    rpm: s.rpm,
    gear: s.gear,
    tc: s.tc,
    abs: s.abs,
    auto: s.auto,
    surface: s.surface,
    camera: sim.camera,
    drift: s.driftScore,
    driftAngle: s.driftAngle,
    handbrake: s.handbrake,
    rearMode: s.rearMode,
    frontMode: s.frontMode,
    shifting: s.shiftTimer > 0,
    headlights: sim.headlights,
    muted: sim.muted,
    top: s.topSpeed * 3.6,
    odo: s.odometer / 1000,
    ax: s.ax,
    ay: s.ay,
    x: s.x,
    z: s.z,
    yaw: s.yaw,
  };
}

function Tacho({ rpm, redline, kmh, gear, shifting }: { rpm: number; redline: number; kmh: number; gear: number; shifting: boolean }) {
  const max = Math.ceil((redline + 800) / 1000) * 1000;
  const start = -125;
  const sweep = 250;
  const frac = Math.min(1, rpm / max);
  const angle = start + frac * sweep;
  const redFrac = redline / max;
  const R = 92;
  const cx = 110;
  const cy = 110;
  const polar = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (from: number, to: number, r: number) => {
    const [x1, y1] = polar(from, r);
    const [x2, y2] = polar(to, r);
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };
  const ticks = [];
  for (let i = 0; i <= max / 1000; i++) {
    const a = start + (i / (max / 1000)) * sweep;
    const [x1, y1] = polar(a, R - 2);
    const [x2, y2] = polar(a, R - 12);
    const [tx, ty] = polar(a, R - 26);
    const red = i * 1000 >= redline;
    ticks.push(
      <g key={i}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={red ? '#ff3b3b' : '#e6ebf2'} strokeWidth={2.5} />
        <text x={tx} y={ty + 4} fill={red ? '#ff3b3b' : '#c8d0da'} fontSize={11} textAnchor="middle" fontFamily="ui-monospace, monospace">
          {i}
        </text>
      </g>,
    );
  }
  const [nx, ny] = polar(angle, R - 6);
  const [bx, by] = polar(angle + 180, 14);
  const gearLabel = gear === -1 ? 'R' : gear === 0 ? 'N' : String(gear);
  return (
    <svg width={220} height={220} viewBox="0 0 220 220" className="drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
      <circle cx={cx} cy={cy} r={104} fill="rgba(10,12,18,0.72)" stroke="rgba(255,255,255,0.08)" />
      <path d={arc(start, start + sweep, R)} stroke="rgba(255,255,255,0.15)" strokeWidth={6} fill="none" />
      <path d={arc(start, start + frac * sweep, R)} stroke={frac > redFrac ? '#ff3b3b' : '#4fd1ff'} strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d={arc(start + redFrac * sweep, start + sweep, R)} stroke="rgba(255,59,59,0.55)" strokeWidth={6} fill="none" />
      {ticks}
      <line x1={bx} y1={by} x2={nx} y2={ny} stroke="#ff5a3c" strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="#e6ebf2" />
      <text x={cx} y={cy + 46} fill="#ffffff" fontSize={40} fontWeight={700} textAnchor="middle" fontFamily="ui-monospace, monospace">
        {Math.round(kmh)}
      </text>
      <text x={cx} y={cy + 62} fill="#9aa6b5" fontSize={11} textAnchor="middle" letterSpacing={2}>
        KM/H
      </text>
      <rect x={cx - 18} y={cy + 72} width={36} height={30} rx={6} fill={shifting ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'} stroke="rgba(255,255,255,0.2)" />
      <text x={cx} y={cy + 94} fill={gear === -1 ? '#ffb347' : '#ffffff'} fontSize={22} fontWeight={700} textAnchor="middle" fontFamily="ui-monospace, monospace">
        {gearLabel}
      </text>
      <text x={cx} y={cy - 30} fill="#9aa6b5" fontSize={10} textAnchor="middle" letterSpacing={2}>
        RPM x1000
      </text>
    </svg>
  );
}

function MiniMap({ x, z, yaw }: { x: number; z: number; yaw: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const S = 170;
    const scale = S / 1000; // 1000 m across
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(10,12,18,0.72)';
    ctx.beginPath();
    ctx.roundRect(0, 0, S, S, 12);
    ctx.fill();
    ctx.save();
    ctx.translate(S / 2, S / 2);
    // roads
    ctx.strokeStyle = 'rgba(200,210,225,0.55)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k <= CITY_N; k++) {
      const v = (-CITY_HALF + k * BLOCK) * scale;
      const e = CITY_HALF * scale;
      ctx.beginPath();
      ctx.moveTo(v, -e);
      ctx.lineTo(v, e);
      ctx.moveTo(-e, v);
      ctx.lineTo(e, v);
      ctx.stroke();
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,214,120,0.7)';
    const r = RING_R * scale;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    // skid pad
    ctx.fillStyle = 'rgba(120,200,255,0.25)';
    ctx.fillRect(-93 * scale, -93 * scale, 186 * scale, 86 * scale);
    // top-down view: world +z is up on the map, world +x is left (right-handed, viewed from above)
    ctx.translate(-x * scale, -z * scale);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [x, z, yaw]);
  return <canvas ref={ref} width={170} height={170} className="rounded-xl" />;
}

function Pill({ on, label, dim }: { on: boolean; label: string; dim?: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider border ${
        on ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40' : dim ? 'bg-white/5 text-white/35 border-white/10' : 'bg-red-500/15 text-red-300 border-red-400/30'
      }`}
    >
      {label}
    </span>
  );
}

export default function HUD({ showHelp, isTouch }: { showHelp: boolean; isTouch: boolean }) {
  const [snap, setSnap] = useState<Snapshot>(snapshot);
  useEffect(() => {
    const id = setInterval(() => setSnap(snapshot()), 50);
    return () => clearInterval(id);
  }, []);
  const spec = sim.spec;
  const driftDeg = Math.abs((snap.driftAngle * 180) / Math.PI);
  const drifting = driftDeg > 10 && snap.kmh > 20;

  const bind = (k: keyof typeof touch) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      touch[k] = true;
    },
    onPointerUp: () => {
      touch[k] = false;
    },
    onPointerCancel: () => {
      touch[k] = false;
    },
    onPointerLeave: () => {
      touch[k] = false;
    },
  });

  return (
    <div className="pointer-events-none absolute inset-0 select-none text-white">
      {/* top-left: car & assists */}
      <div className="absolute left-4 top-4 flex flex-col gap-2">
        <div className="rounded-xl bg-black/55 backdrop-blur px-4 py-3 border border-white/10">
          <div className="text-[11px] tracking-[0.25em] text-white/50">VEHICLE</div>
          <div className="text-lg font-bold leading-tight">{spec.name}</div>
          <div className="text-xs text-white/60">{spec.desc}</div>
          <div className="mt-2 flex gap-1.5 flex-wrap">
            <Pill on={snap.tc} label="TC" />
            <Pill on={snap.abs} label="ABS" />
            <Pill on={snap.auto} label={snap.auto ? 'AUTO' : 'MANUAL'} dim />
            <Pill on={snap.headlights} label="LIGHTS" dim />
          </div>
          <div className="mt-2 flex gap-3 text-[11px] text-white/60">
            <span>
              CAM <b className="text-white/90 uppercase">{snap.camera}</b>
            </span>
            <span>
              SURFACE <b className={`uppercase ${snap.surface === 'grass' ? 'text-lime-300' : 'text-white/90'}`}>{snap.surface}</b>
            </span>
          </div>
        </div>
        {(snap.rearMode !== 'grip' || snap.frontMode !== 'grip' || snap.handbrake) && (
          <div className="flex gap-1.5">
            {snap.handbrake && <span className="px-2 py-0.5 rounded bg-amber-400/25 text-amber-200 text-[11px] font-bold border border-amber-300/40">HANDBRAKE</span>}
            {snap.rearMode === 'spin' && <span className="px-2 py-0.5 rounded bg-orange-500/25 text-orange-200 text-[11px] font-bold border border-orange-300/40">WHEELSPIN</span>}
            {(snap.rearMode === 'locked' || snap.frontMode === 'locked') && !snap.handbrake && (
              <span className="px-2 py-0.5 rounded bg-red-500/25 text-red-200 text-[11px] font-bold border border-red-300/40">LOCKUP</span>
            )}
          </div>
        )}
      </div>

      {/* top-right: help */}
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        {showHelp ? (
          <div className="rounded-xl bg-black/55 backdrop-blur px-4 py-3 border border-white/10 text-xs leading-6 text-white/80 w-64">
            <div className="text-[11px] tracking-[0.25em] text-white/50 mb-1">CONTROLS · H to hide</div>
            <Row k="W / ↑" v="Throttle" />
            <Row k="S / ↓" v="Brake · Reverse" />
            <Row k="A D / ← →" v="Steer" />
            <Row k="Space" v="Handbrake" />
            <Row k="Q / E" v="Shift down / up (manual)" />
            <Row k="M" v="Auto / Manual gearbox" />
            <Row k="T · B" v="Traction control · ABS" />
            <Row k="C" v="Camera" />
            <Row k="L" v="Headlights" />
            <Row k="R" v="Reset car" />
            <Row k="K" v="Reset cones" />
            <Row k="N" v="Mute" />
            <Row k="Esc / P" v="Pause" />
          </div>
        ) : (
          <div className="rounded-lg bg-black/45 px-3 py-1.5 text-[11px] text-white/60 border border-white/10">H · controls</div>
        )}
      </div>

      {/* bottom-left: minimap & stats */}
      <div className="absolute left-4 bottom-4 flex items-end gap-3">
        <MiniMap x={snap.x} z={snap.z} yaw={snap.yaw} />
        <div className="rounded-xl bg-black/55 backdrop-blur px-3 py-2 border border-white/10 text-[11px] text-white/70 leading-5">
          <div>
            TOP <b className="text-white">{snap.top.toFixed(0)}</b> km/h
          </div>
          <div>
            ODO <b className="text-white">{snap.odo.toFixed(2)}</b> km
          </div>
          <div>
            G <b className="text-white">{(Math.hypot(snap.ax, snap.ay) / 9.81).toFixed(2)}</b>
          </div>
          <div className="mt-1 h-16 w-16 relative rounded-full border border-white/15 bg-white/5">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
            <div
              className="absolute w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]"
              style={{
                left: `calc(50% + ${Math.max(-28, Math.min(28, (-snap.ay / 9.81) * 26))}px - 5px)`,
                top: `calc(50% + ${Math.max(-28, Math.min(28, (-snap.ax / 9.81) * 26))}px - 5px)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* bottom-right: tacho */}
      <div className="absolute right-3 bottom-3">
        <Tacho rpm={snap.rpm} redline={spec.redline} kmh={snap.kmh} gear={snap.gear} shifting={snap.shifting} />
      </div>

      {/* drift indicator */}
      <div
        className={`absolute left-1/2 top-16 -translate-x-1/2 transition-opacity duration-300 ${drifting ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="rounded-xl bg-black/55 backdrop-blur px-5 py-2 border border-orange-300/30 text-center">
          <div className="text-[11px] tracking-[0.3em] text-orange-200">DRIFT {driftDeg.toFixed(0)}°</div>
          <div className="text-2xl font-black text-orange-300 tabular-nums">{Math.round(snap.drift).toLocaleString()}</div>
        </div>
      </div>
      {!drifting && snap.drift > 0 && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 text-[11px] text-white/50 tracking-wider">
          DRIFT SCORE <b className="text-white/80">{Math.round(snap.drift).toLocaleString()}</b>
        </div>
      )}

      {snap.muted && <div className="absolute right-4 bottom-60 text-[11px] text-white/50">🔇 muted</div>}

      {/* touch controls */}
      {isTouch && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex justify-between px-4 pb-6">
          <div className="flex gap-3">
            <button {...bind('left')} className="w-20 h-20 rounded-full bg-white/15 border border-white/30 text-2xl active:bg-white/35 touch-none">
              ◀
            </button>
            <button {...bind('right')} className="w-20 h-20 rounded-full bg-white/15 border border-white/30 text-2xl active:bg-white/35 touch-none">
              ▶
            </button>
          </div>
          <div className="flex gap-3 items-end">
            <button {...bind('handbrake')} className="w-16 h-16 rounded-full bg-amber-400/20 border border-amber-300/40 text-xs font-bold active:bg-amber-400/40 touch-none">
              HB
            </button>
            <button {...bind('brake')} className="w-20 h-20 rounded-full bg-red-500/20 border border-red-400/40 text-xs font-bold active:bg-red-500/40 touch-none">
              BRAKE
            </button>
            <button {...bind('gas')} className="w-24 h-24 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-xs font-bold active:bg-emerald-400/40 touch-none">
              GAS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="font-mono text-white/95">{k}</span>
      <span className="text-white/60">{v}</span>
    </div>
  );
}

export { CAMERA_MODES };
