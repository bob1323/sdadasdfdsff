import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function noiseFill(ctx: CanvasRenderingContext2D, w: number, h: number, base: [number, number, number], amp: number, count: number) {
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < count; i++) {
    const v = (Math.random() - 0.5) * amp;
    ctx.fillStyle = `rgba(${base[0] + v | 0},${base[1] + v | 0},${base[2] + v | 0},0.6)`;
    const s = 1 + Math.random() * 2;
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

function tex(c: HTMLCanvasElement, repeatX = 1, repeatY = 1, aniso = 8) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = aniso;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let cache: Record<string, THREE.Texture> = {};

export function getTexture(name: string): THREE.Texture {
  if (cache[name]) return cache[name];
  let t: THREE.Texture;
  switch (name) {
    case 'asphalt': {
      const c = canvas(256, 256);
      const ctx = c.getContext('2d')!;
      noiseFill(ctx, 256, 256, [58, 58, 62], 40, 9000);
      t = tex(c);
      break;
    }
    case 'roadZ':
    case 'roadX': {
      // one road-width tile (14 m) by 14 m of length; lines run along +v
      const c = canvas(512, 512);
      const ctx = c.getContext('2d')!;
      noiseFill(ctx, 512, 512, [56, 57, 60], 36, 20000);
      const scale = 512 / 14;
      // edge lines
      ctx.fillStyle = '#e8e6df';
      ctx.fillRect(0.5 * scale - 3, 0, 6, 512);
      ctx.fillRect(13.5 * scale - 3, 0, 6, 512);
      // centre double yellow
      ctx.fillStyle = '#e0b62a';
      ctx.fillRect(7 * scale - 8, 0, 5, 512);
      ctx.fillRect(7 * scale + 3, 0, 5, 512);
      // dashed lane separators (3 m dash, 4 m gap -> 2 dashes in 14 m)
      ctx.fillStyle = '#e8e6df';
      for (const x of [3.75, 10.25]) {
        for (let y = 0; y < 14; y += 7) {
          ctx.fillRect(x * scale - 3, y * scale, 6, 3 * scale);
        }
      }
      if (name === 'roadX') {
        const c2 = canvas(512, 512);
        const ctx2 = c2.getContext('2d')!;
        ctx2.translate(256, 256);
        ctx2.rotate(Math.PI / 2);
        ctx2.drawImage(c, -256, -256);
        t = tex(c2);
      } else t = tex(c);
      break;
    }
    case 'intersection': {
      const c = canvas(512, 512);
      const ctx = c.getContext('2d')!;
      noiseFill(ctx, 512, 512, [56, 57, 60], 36, 20000);
      const scale = 512 / 14;
      ctx.fillStyle = '#e8e6df';
      // zebra crossings on four sides
      const stripes = 9;
      for (let i = 0; i < stripes; i++) {
        const p = 1.2 * scale + i * (11.6 / stripes) * scale;
        const sw = (11.6 / stripes) * scale * 0.55;
        ctx.fillRect(p, 0.4 * scale, sw, 2.2 * scale);
        ctx.fillRect(p, 512 - 2.6 * scale, sw, 2.2 * scale);
        ctx.fillRect(0.4 * scale, p, 2.2 * scale, sw);
        ctx.fillRect(512 - 2.6 * scale, p, 2.2 * scale, sw);
      }
      t = tex(c);
      break;
    }
    case 'highway': {
      // 22 m wide, 4 lanes
      const c = canvas(512, 512);
      const ctx = c.getContext('2d')!;
      noiseFill(ctx, 512, 512, [62, 62, 66], 34, 20000);
      const scale = 512 / 22;
      ctx.fillStyle = '#e8e6df';
      ctx.fillRect(0.6 * scale - 3, 0, 6, 512);
      ctx.fillRect(21.4 * scale - 3, 0, 6, 512);
      ctx.fillStyle = '#e0b62a';
      ctx.fillRect(11 * scale - 8, 0, 5, 512);
      ctx.fillRect(11 * scale + 3, 0, 5, 512);
      ctx.fillStyle = '#e8e6df';
      for (const x of [5.8, 16.2]) {
        for (let y = 0; y < 22; y += 11) ctx.fillRect(x * scale - 3, y * scale, 6, 4 * scale);
      }
      t = tex(c);
      break;
    }
    case 'grass': {
      const c = canvas(256, 256);
      const ctx = c.getContext('2d')!;
      noiseFill(ctx, 256, 256, [78, 112, 52], 46, 14000);
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${90 + Math.random() * 50 | 0},${30 + Math.random() * 30 | 0},0.5)`;
        ctx.beginPath();
        ctx.ellipse(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 10, 2 + Math.random() * 5, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      t = tex(c);
      break;
    }
    case 'concrete': {
      const c = canvas(256, 256);
      const ctx = c.getContext('2d')!;
      noiseFill(ctx, 256, 256, [168, 165, 158], 26, 8000);
      ctx.strokeStyle = 'rgba(90,88,84,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 254, 254);
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 256);
      ctx.moveTo(0, 128);
      ctx.lineTo(256, 128);
      ctx.stroke();
      t = tex(c);
      break;
    }
    case 'lot': {
      const c = canvas(512, 512);
      const ctx = c.getContext('2d')!;
      noiseFill(ctx, 512, 512, [70, 70, 74], 40, 20000);
      ctx.strokeStyle = 'rgba(230,228,220,0.5)';
      ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 128 + 64, 0);
        ctx.lineTo(i * 128 + 64, 120);
        ctx.moveTo(i * 128 + 64, 392);
        ctx.lineTo(i * 128 + 64, 512);
        ctx.stroke();
      }
      t = tex(c);
      break;
    }
    case 'windows0':
    case 'windows1':
    case 'windows2': {
      const v = Number(name.slice(-1));
      const c = canvas(256, 256);
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = v === 0 ? '#d8d4cb' : v === 1 ? '#8a939b' : '#6d7784';
      ctx.fillRect(0, 0, 256, 256);
      // 4 windows across, 4 floors down in one tile (tile = 8 m x 12.8 m)
      const cols = v === 2 ? 2 : 4;
      const rows = 4;
      const cw = 256 / cols;
      const rh = 256 / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const lit = Math.random() < 0.15;
          const shade = 40 + Math.random() * 50;
          ctx.fillStyle = lit
            ? `rgb(${210 + Math.random() * 30 | 0},${190 + Math.random() * 30 | 0},${120 | 0})`
            : `rgb(${shade * 0.7 | 0},${shade * 0.85 | 0},${shade | 0})`;
          const pad = v === 2 ? 4 : 8;
          ctx.fillRect(i * cw + pad, j * rh + pad, cw - pad * 2, rh - pad * 2 - (v === 0 ? 6 : 0));
          // highlight
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(i * cw + pad, j * rh + pad, (cw - pad * 2) * 0.5, rh - pad * 2);
        }
      }
      t = tex(c, 1, 1, 4);
      break;
    }
    case 'circle': {
      const c = canvas(512, 512);
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 512, 512);
      ctx.strokeStyle = 'rgba(235,235,230,0.85)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(256, 256, 240, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([20, 18]);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(256, 256, 150, 0, Math.PI * 2);
      ctx.stroke();
      const tt = new THREE.CanvasTexture(c);
      tt.colorSpace = THREE.SRGBColorSpace;
      t = tt;
      break;
    }
    case 'smoke': {
      const c = canvas(64, 64);
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const tt = new THREE.CanvasTexture(c);
      t = tt;
      break;
    }
    default: {
      const c = canvas(4, 4);
      t = tex(c);
    }
  }
  cache[name] = t;
  return t;
}

export function clearTextureCache() {
  cache = {};
}
