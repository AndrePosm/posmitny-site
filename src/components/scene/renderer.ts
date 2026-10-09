import { MODES, type ModeKey } from '@/lib/modes';

export type SceneSettings = { swell: number; wind: number; rays: number };

type RGB = [number, number, number];
type Palette = {
  skyTop: RGB; skyBot: RGB; glow: RGB; sun: RGB;
  volcBack: RGB; volcFront: RGB; oceanTop: RGB; oceanBot: RGB; rock: RGB;
  rays: RGB[]; lines: RGB[];
  sunX: number; sunY: number; sunR: number; rayAlpha: number; stars: number; clouds: number;
};

const COLOR_KEYS = ['skyTop', 'skyBot', 'glow', 'sun', 'volcBack', 'volcFront', 'oceanTop', 'oceanBot', 'rock'] as const;
const NUM_KEYS = ['sunX', 'sunY', 'sunR', 'rayAlpha', 'stars', 'clouds'] as const;

const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb = (c: RGB, a?: number) =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : Math.max(0, Math.min(1, a)).toFixed(3)})`;

function paletteOf(key: ModeKey): Palette {
  const m = MODES[key];
  return {
    skyTop: hex(m.skyTop), skyBot: hex(m.skyBot), glow: hex(m.glow), sun: hex(m.sun),
    volcBack: hex(m.volcBack), volcFront: hex(m.volcFront), oceanTop: hex(m.oceanTop), oceanBot: hex(m.oceanBot), rock: hex(m.rock),
    rays: m.rays.map(hex), lines: m.lines.map(hex),
    sunX: m.sunX, sunY: m.sunY, sunR: m.sunR, rayAlpha: m.rayAlpha, stars: m.stars, clouds: m.clouds,
  };
}

type Opts = {
  canvas: HTMLCanvasElement;
  scene: HTMLElement;
  avatar: () => HTMLElement | null;
  get: () => { mode: ModeKey; settings: SceneSettings };
};

export function createSceneRenderer({ canvas, scene, avatar, get }: Opts) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { redraw: () => {}, destroy: () => {} };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 };
  let w = 0, h = 0;
  let t0 = reduced ? -1e6 : performance.now();
  let flash = 0, nextBolt = performance.now() + 3000;
  let bolt: [number, number][] | null = null;
  let cur: Palette | null = null;
  let raf = 0;

  const stars = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random() * 0.92, r: Math.random() * 1.3 + 0.3, s: Math.random() * 2 + 0.5, p: Math.random() * 6.28 }));
  const clouds = Array.from({ length: 7 }, () => ({ x: Math.random(), y: 0.08 + Math.random() * 0.35, rw: 0.18 + Math.random() * 0.22, rh: 0.05 + Math.random() * 0.05, v: 0.00004 + Math.random() * 0.00006 }));

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, r.width);
    h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const step = (k: number) => {
    const tg = paletteOf(get().mode);
    if (!cur) { cur = structuredClone(tg); return; }
    const c = cur;
    const lerp = (a: RGB, b: RGB) => { for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * k; };
    COLOR_KEYS.forEach((n) => lerp(c[n], tg[n]));
    c.rays.forEach((a, i) => lerp(a, tg.rays[i]));
    c.lines.forEach((a, i) => lerp(a, tg.lines[i]));
    NUM_KEYS.forEach((n) => { c[n] += (tg[n] - c[n]) * k; });
  };

  const avatarBox = () => {
    const el = avatar();
    if (el) {
      const a = el.getBoundingClientRect(), c = canvas.getBoundingClientRect();
      return { x: a.left - c.left + a.width / 2, bottom: a.bottom - c.top, size: a.width };
    }
    return { x: w * 0.71, bottom: h * 0.82, size: 280 };
  };

  const draw = (t: number) => {
    if (!w) return;
    const { mode, settings: s } = get();
    const m = mouse;
    step(reduced ? 1 : 0.045);
    const C = cur!;
    if (!reduced) { m.x += (m.tx - m.x) * 0.12; m.y += (m.ty - m.y) * 0.12; m.s += (m.ts - m.s) * 0.07; }
    const sy = reduced ? 0 : Math.max(0, Math.min(900, -scene.getBoundingClientRect().top));
    const narrow = w < 860;
    const H = h * (narrow ? 0.7 : 0.66);
    const intro = Math.min(1, (t - t0) / 1800);
    const ease = 1 - Math.pow(1 - intro, 3);
    const wind = s.wind / 100, swell = s.swell / 100;
    const tt = reduced ? 0 : t;

    // sky
    let g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(C.skyTop)); g.addColorStop(1, rgb(C.skyBot));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, H + 2);

    const sx = C.sunX * w;
    const sY = C.sunY * H + sy * 0.35 + (1 - ease) * 60;
    const sR = C.sunR * (narrow ? 0.8 : 1);

    const rg = ctx.createRadialGradient(sx, H, 0, sx, H, w * 0.65);
    rg.addColorStop(0, rgb(C.glow, 0.55)); rg.addColorStop(1, rgb(C.glow, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, H + 2);

    if (C.stars > 0.02) {
      for (const st of stars) {
        const a = C.stars * (0.35 + 0.65 * Math.abs(Math.sin(tt * 0.001 * st.s + st.p)));
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(st.x * w, st.y * H, st.r, 0, 6.2832); ctx.fill();
      }
    }

    // rays + sun
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, H); ctx.clip();
    const nR = Math.round(24 + s.rays * 0.4);
    const baseLen = Math.min(w, h) * (narrow ? 0.55 : 0.5);
    const phi = Math.atan2(m.y - sY, m.x - sx);
    const start = sR * 1.7, stepD = narrow ? 16 : 20, dash = narrow ? 7 : 9;
    ctx.lineCap = 'round'; ctx.lineWidth = narrow ? 3 : 4;
    for (let r = 0; r < nR; r++) {
      const th = (r / nR) * Math.PI * 2 + wind * 0.08 * Math.sin(tt * 0.0011 + r * 1.3);
      let reach = 1;
      if (m.s > 0.01) { const c = Math.cos(th - phi); if (c > 0) reach += 0.95 * m.s * Math.pow(c, 6); }
      const len = baseLen * (0.55 + 0.45 * (((r * 7) % 5) / 4)) * reach * ease;
      const col = C.rays[r % 5];
      const ct = Math.cos(th), sn = Math.sin(th);
      const dl = dash * (1 + (reach - 1) * 0.8);
      for (let d = start; d < start + len; d += stepD) {
        const f = (d - start) / Math.max(1, len);
        const a = C.rayAlpha * (1 - f) * (0.55 + 0.45 * Math.min(1.6, reach));
        const x = sx + ct * d, y = sY + sn * d;
        ctx.strokeStyle = rgb(col, a);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ct * dl, y + sn * dl); ctx.stroke();
      }
    }
    const sg = ctx.createRadialGradient(sx, sY, 0, sx, sY, sR * 4.2);
    sg.addColorStop(0, rgb(C.sun, 0.75)); sg.addColorStop(1, rgb(C.sun, 0));
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sY, sR * 4.2, 0, 6.2832); ctx.fill();
    ctx.fillStyle = rgb(C.sun); ctx.beginPath(); ctx.arc(sx, sY, sR, 0, 6.2832); ctx.fill();
    if (C.stars > 0.3) {
      ctx.fillStyle = rgb(C.skyBot, 0.22 * C.stars);
      ctx.beginPath(); ctx.arc(sx - sR * 0.3, sY - sR * 0.2, sR * 0.22, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + sR * 0.35, sY + sR * 0.3, sR * 0.15, 0, 6.2832); ctx.fill();
    }
    ctx.restore();

    // storm clouds + lightning
    if (C.clouds > 0.02) {
      for (const cl of clouds) {
        if (!reduced) { cl.x += cl.v * (1 + wind * 4); if (cl.x - cl.rw > 1.1) cl.x = -cl.rw; }
        ctx.fillStyle = `rgba(38,46,56,${(0.55 * C.clouds).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(cl.x * w, cl.y * H, cl.rw * w, cl.rh * H, 0, 0, 6.2832); ctx.fill();
      }
      if (!reduced && mode === 'storm' && t > nextBolt) {
        flash = 1;
        const bx = w * (0.15 + Math.random() * 0.7);
        const pts: [number, number][] = [[bx, H * 0.12]];
        let y = H * 0.12, x = bx;
        while (y < H * 0.78) { y += 18 + Math.random() * 26; x += (Math.random() - 0.5) * 42; pts.push([x, y]); }
        bolt = pts; nextBolt = t + 4200 + Math.random() * 5200;
      }
    }

    // volcanoes
    const vh = H * (narrow ? 0.24 : 0.3);
    const vy = sy * 0.18;
    const vp = [[0, 0.1], [0.07, 0.34], [0.13, 0.26], [0.21, 0.62], [0.28, 0.48], [0.36, 0.9], [0.43, 0.82], [0.5, 0.4], [0.57, 0.52], [0.64, 0.22], [0.72, 0.44], [0.8, 0.3], [0.88, 0.7], [0.95, 0.46], [1, 0.2]];
    ctx.fillStyle = rgb(C.volcBack);
    ctx.beginPath(); ctx.moveTo(0, H + 4 + vy);
    let px = 0, py = H - vp[0][1] * vh + vy;
    ctx.lineTo(px, py);
    for (let i = 1; i < vp.length; i++) {
      const nx = vp[i][0] * w, ny = H - vp[i][1] * vh + vy;
      ctx.quadraticCurveTo(px, py, (px + nx) / 2, (py + ny) / 2);
      px = nx; py = ny;
    }
    ctx.lineTo(w, py); ctx.lineTo(w, H + 4 + vy); ctx.closePath(); ctx.fill();
    const hz = ctx.createLinearGradient(0, H - vh * 0.6, 0, H);
    hz.addColorStop(0, rgb(C.glow, 0)); hz.addColorStop(1, rgb(C.glow, 0.32));
    ctx.fillStyle = hz; ctx.fillRect(0, H - vh * 0.6, w, vh * 0.6 + 2);

    // ocean
    const og = ctx.createLinearGradient(0, H, 0, h);
    og.addColorStop(0, rgb(C.oceanTop)); og.addColorStop(1, rgb(C.oceanBot));
    ctx.fillStyle = og; ctx.fillRect(0, H, w, h - H);

    if (sY < H + sR) {
      for (let y = H + 3; y < h; y += 7) {
        const f = (y - H) / (h - H);
        const span = 10 + f * w * 0.12;
        for (let k = 0; k < 3; k++) {
          const n = Math.sin(tt * 0.002 + y * 13.1 + k * 7.3);
          const x = sx + n * span;
          const a = 0.6 * (1 - f) * C.rayAlpha * (0.5 + 0.5 * Math.sin(tt * 0.003 + y + k));
          ctx.strokeStyle = rgb(C.sun, a); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x - 6 - f * 14, y); ctx.lineTo(x + 6 + f * 14, y); ctx.stroke();
        }
      }
    }

    // swell lines (half speed)
    const nL = narrow ? 11 : 15;
    const overOcean = m.s > 0.01 && m.y > H - 20;
    for (let i = 0; i < nL; i++) {
      const p = i / (nL - 1);
      const y0 = H + 6 + (h - H - 6) * Math.pow(p, 1.5);
      const amp = (1.2 + p * 9) * (0.25 + swell * 1.5);
      const k = 0.011 / (0.45 + p);
      const sp = 0.00055 * (1 + p);
      ctx.strokeStyle = rgb(C.lines[i % 3], 0.22 + p * 0.45);
      ctx.lineWidth = 1 + p * 1.8;
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 10) {
        let y = y0 + amp * Math.sin(x * k + tt * sp + i * 1.7) + wind * 2.2 * Math.sin(x * 0.07 + tt * 0.0045 + i);
        if (overOcean) {
          const dx = x - m.x, dy = (y0 - m.y) * 2.2, d = Math.hypot(dx, dy);
          if (d < 260) y -= 16 * m.s * Math.exp(-(d * d) / (2 * 95 * 95)) * Math.cos(d * 0.055 - tt * 0.003);
        }
        if (x === -10) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // rock desk under the character
    const A = avatarBox();
    const top = A.bottom - A.size * 0.018, z = A.size;
    ctx.fillStyle = rgb(C.rock);
    ctx.beginPath();
    ctx.moveTo(A.x - z * 1.15, h + 2);
    ctx.bezierCurveTo(A.x - z * 1.0, top + z * 0.2, A.x - z * 0.82, top, A.x - z * 0.6, top);
    ctx.lineTo(A.x + z * 0.62, top - z * 0.01);
    ctx.bezierCurveTo(A.x + z * 0.85, top, A.x + z * 1.05, top + z * 0.24, A.x + z * 1.3, h + 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgb(C.volcBack, 0.5); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(A.x - z * 0.82, top + 2); ctx.lineTo(A.x + z * 0.62, top + 1); ctx.stroke();

    if (flash > 0.01) {
      ctx.fillStyle = `rgba(235,242,255,${(0.38 * flash).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
      if (bolt) {
        ctx.strokeStyle = `rgba(255,255,255,${flash.toFixed(3)})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); bolt.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1]))); ctx.stroke();
      }
      flash *= 0.88;
    }
  };

  // pause the loop while the scene is off screen
  let visible = true;
  const frame = (t: number) => {
    if (visible) draw(t);
    raf = requestAnimationFrame(frame);
  };

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; mouse.ts = 1;
    if (mouse.s < 0.02) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    if (reduced) { mouse.x = mouse.tx; mouse.y = mouse.ty; mouse.s = 1; draw(performance.now()); }
  };
  const onLeave = () => { mouse.ts = 0; if (reduced) { mouse.s = 0; draw(performance.now()); } };

  resize();
  const ro = new ResizeObserver(() => { resize(); if (reduced) draw(performance.now()); });
  ro.observe(canvas);
  const io = new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; });
  io.observe(scene);
  scene.addEventListener('pointermove', onMove);
  scene.addEventListener('pointerleave', onLeave);
  if (reduced) draw(performance.now());
  else raf = requestAnimationFrame(frame);
  if (!reduced) t0 = performance.now();

  return {
    redraw: () => { if (reduced) draw(performance.now()); },
    destroy: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      scene.removeEventListener('pointermove', onMove);
      scene.removeEventListener('pointerleave', onLeave);
    },
  };
}
