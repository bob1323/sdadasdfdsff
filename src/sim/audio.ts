import { CarSpec } from './cars';
import { VehicleState } from './physics';

function makeNoise(ctx: AudioContext, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export class CarAudio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  engOsc: OscillatorNode[] = [];
  engGains: GainNode[] = [];
  engFilter!: BiquadFilterNode;
  engGain!: GainNode;
  exhaustGain!: GainNode;
  exhaustFilter!: BiquadFilterNode;
  squealGain!: GainNode;
  squealFilter!: BiquadFilterNode;
  windGain!: GainNode;
  windFilter!: BiquadFilterNode;
  noiseBuf!: AudioBuffer;
  started = false;
  muted = false;
  lastGear = 1;
  lastCollision = 0;

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ctx.destination);
    this.noiseBuf = makeNoise(ctx);

    // Engine: layered oscillators through a resonant lowpass
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 800;
    this.engFilter.Q.value = 1.2;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.master);

    const types: OscillatorType[] = ['sawtooth', 'square', 'sawtooth', 'triangle'];
    const gains = [0.5, 0.18, 0.25, 0.35];
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator();
      o.type = types[i];
      o.frequency.value = 60;
      const g = ctx.createGain();
      g.gain.value = gains[i];
      o.connect(g);
      g.connect(this.engFilter);
      o.start();
      this.engOsc.push(o);
      this.engGains.push(g);
    }

    // Exhaust rumble: noise through bandpass, amplitude-modulated later via gain
    const exhaustSrc = ctx.createBufferSource();
    exhaustSrc.buffer = this.noiseBuf;
    exhaustSrc.loop = true;
    this.exhaustFilter = ctx.createBiquadFilter();
    this.exhaustFilter.type = 'lowpass';
    this.exhaustFilter.frequency.value = 180;
    this.exhaustGain = ctx.createGain();
    this.exhaustGain.gain.value = 0;
    exhaustSrc.connect(this.exhaustFilter);
    this.exhaustFilter.connect(this.exhaustGain);
    this.exhaustGain.connect(this.master);
    exhaustSrc.start();

    // Tire squeal
    const sq = ctx.createBufferSource();
    sq.buffer = this.noiseBuf;
    sq.loop = true;
    this.squealFilter = ctx.createBiquadFilter();
    this.squealFilter.type = 'bandpass';
    this.squealFilter.frequency.value = 1100;
    this.squealFilter.Q.value = 9;
    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    sq.connect(this.squealFilter);
    this.squealFilter.connect(this.squealGain);
    this.squealGain.connect(this.master);
    sq.start();

    // Wind
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 400;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    wind.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx!.currentTime, 0.05);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  update(s: VehicleState, spec: CarSpec, dt: number, paused: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const tau = 0.03;
    if (paused) {
      this.engGain.gain.setTargetAtTime(0, t, 0.1);
      this.exhaustGain.gain.setTargetAtTime(0, t, 0.1);
      this.squealGain.gain.setTargetAtTime(0, t, 0.1);
      this.windGain.gain.setTargetAtTime(0, t, 0.1);
      return;
    }
    // engine fundamental = firing frequency
    const firing = (s.rpm / 60) * (spec.cylinders / 2);
    const f = Math.max(20, firing);
    this.engOsc[0].frequency.setTargetAtTime(f, t, tau);
    this.engOsc[1].frequency.setTargetAtTime(f * 0.5, t, tau);
    this.engOsc[2].frequency.setTargetAtTime(f * 1.5 + 1.3, t, tau);
    this.engOsc[3].frequency.setTargetAtTime(f * 2.0, t, tau);
    const load = s.throttle;
    const rpmN = s.rpm / spec.redline;
    this.engFilter.frequency.setTargetAtTime(350 + load * 1800 + rpmN * 1600, t, tau);
    const shifting = s.shiftTimer > 0;
    const vol = (0.08 + load * 0.2 + rpmN * 0.12) * (shifting ? 0.6 : 1);
    this.engGain.gain.setTargetAtTime(vol, t, tau);
    this.exhaustFilter.frequency.setTargetAtTime(120 + rpmN * 260, t, tau);
    this.exhaustGain.gain.setTargetAtTime(0.06 + load * 0.25 + (spec.cylinders >= 8 ? 0.1 : 0), t, tau);

    // squeal
    const skid = Math.max(s.skidF, s.skidR) * (s.surface === 'grass' ? 0.25 : 1);
    const sqVol = skid > 0.05 ? Math.min(0.5, skid * 0.55) * Math.min(1, s.speed / 8) : 0;
    this.squealGain.gain.setTargetAtTime(sqVol, t, 0.05);
    this.squealFilter.frequency.setTargetAtTime(900 + skid * 500 + Math.min(1, s.speed / 40) * 300, t, 0.05);

    // wind
    const sp = s.speed;
    this.windGain.gain.setTargetAtTime(Math.min(0.5, (sp / 60) * (sp / 60) * 0.7), t, 0.1);
    this.windFilter.frequency.setTargetAtTime(300 + sp * 20, t, 0.1);

    // impacts
    if (s.collision > 0.8 && this.lastCollision <= 0) {
      this.thump(Math.min(1, s.collision / 12));
      this.lastCollision = 0.25;
    }
    this.lastCollision -= dt;
  }

  thump(strength: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 250 + strength * 700;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4 + strength * 0.8, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 + strength * 0.3);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.7);
  }

  coneHit(strength: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = 180;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.15 + Math.min(0.3, strength * 0.02), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.12);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.15);
  }
}

export const carAudio = new CarAudio();
