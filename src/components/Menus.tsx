import { CARS } from '../sim/cars';

export function StartMenu({ selected, onSelect, onStart }: { selected: string; onSelect: (id: string) => void; onStart: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/60 via-black/40 to-black/70 text-white">
      <div className="w-[min(92vw,880px)] rounded-2xl border border-white/10 bg-[#0b0f16]/85 backdrop-blur-xl p-6 md:p-8 shadow-2xl">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] tracking-[0.4em] text-cyan-300/80">DRIVING SIMULATOR</div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mt-1">
              APEX <span className="text-cyan-300">DRIVE</span>
            </h1>
            <p className="text-sm text-white/60 mt-1 max-w-xl">
              Physically based vehicle model: engine torque curves, gearbox, tyre slip with a friction circle, dynamic weight transfer, wheelspin,
              brake lock‑up, aerodynamic drag and downforce. Explore the city, the skid pad and the perimeter highway.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CARS.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`text-left rounded-xl border p-3 transition-all ${
                selected === c.id ? 'border-cyan-300 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.4)]' : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border border-white/30" style={{ background: c.color }} />
                <span className="font-bold">{c.name}</span>
              </div>
              <div className="text-[11px] text-white/60 mt-1">{c.desc}</div>
              <div className="text-[11px] text-white/80 mt-1 font-mono">{c.power}</div>
              <div className="text-[10px] text-white/45 mt-1">
                {c.drivetrain} · {c.gears.length}‑spd · redline {c.redline} rpm
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-white/60 leading-6 grid grid-cols-2 gap-x-6">
            <span>
              <b className="font-mono text-white/90">W A S D</b> drive
            </span>
            <span>
              <b className="font-mono text-white/90">Space</b> handbrake
            </span>
            <span>
              <b className="font-mono text-white/90">C</b> camera
            </span>
            <span>
              <b className="font-mono text-white/90">T / B / M</b> TC · ABS · gearbox
            </span>
            <span>
              <b className="font-mono text-white/90">R</b> reset
            </span>
            <span>
              <b className="font-mono text-white/90">H</b> all controls
            </span>
          </div>
          <button
            onClick={onStart}
            className="px-8 py-3 rounded-xl bg-cyan-300 text-black font-black tracking-wider hover:bg-cyan-200 active:scale-95 transition"
          >
            START ENGINE
          </button>
        </div>
      </div>
    </div>
  );
}

export function PauseMenu({ onResume, onGarage }: { onResume: () => void; onGarage: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
      <div className="rounded-2xl border border-white/10 bg-[#0b0f16]/85 backdrop-blur-xl p-8 text-center shadow-2xl">
        <div className="text-[11px] tracking-[0.4em] text-white/50">PAUSED</div>
        <div className="mt-4 flex gap-3 justify-center">
          <button onClick={onResume} className="px-6 py-2.5 rounded-lg bg-cyan-300 text-black font-bold hover:bg-cyan-200">
            Resume
          </button>
          <button onClick={onGarage} className="px-6 py-2.5 rounded-lg bg-white/10 border border-white/15 font-bold hover:bg-white/20">
            Garage
          </button>
        </div>
        <div className="mt-3 text-xs text-white/50">Esc or P to resume</div>
      </div>
    </div>
  );
}
