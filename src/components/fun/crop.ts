export type Crop = { x: number; y: number; w: number; h: number };

export type CropAspectId = 'free' | 'original' | '1:1' | '4:5' | '9:16' | '16:9' | '3:2';

export type PhotoCrop = {
  /** Window inside the oriented frame, after the straighten cover-zoom. Fractions 0–1. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, −45…+45. */
  angle: number;
  aspect: CropAspectId;
};

export type CropHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export const CROP_ASPECTS: { id: CropAspectId; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'original', label: 'Original', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '3:2', label: '3:2', ratio: 3 / 2 },
];

const MIN_FRAC = 0.08;

export function blankCrop(): PhotoCrop {
  return { x: 0, y: 0, w: 1, h: 1, angle: 0, aspect: 'free' };
}

export function clampAngle(value: number): number {
  const stepped = Math.round(value * 10) / 10;
  if (stepped < -45) return -45;
  if (stepped > 45) return 45;
  return stepped === 0 ? 0 : stepped;
}

export function formatAngle(value: number): string {
  const v = clampAngle(value);
  if (v === 0) return '0°';
  return `${Number.isInteger(v) ? String(v) : v.toFixed(1)}°`;
}

/**
 * Scale that keeps a W×H frame covered after a rotation, so the corners stay filled.
 * s = max(|cos| + |sin|·H/W, |cos| + |sin|·W/H).
 */
export function coverScale(angleDeg: number, w: number, h: number): number {
  const t = (Math.abs(angleDeg) * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  const ww = Math.max(1, w);
  const hh = Math.max(1, h);
  return Math.max(c + s * (hh / ww), c + s * (ww / hh));
}

/** Pixel width/height for a preset. Null means the box stays free. */
export function aspectRatio(id: CropAspectId, frameW: number, frameH: number): number | null {
  if (id === 'free') return null;
  if (id === 'original') return Math.max(1, frameW) / Math.max(1, frameH);
  return CROP_ASPECTS.find((item) => item.id === id)?.ratio ?? null;
}

function place(x: number, y: number, w: number, h: number, fw: number, fh: number): Crop {
  let pw = Math.max(1, w);
  let ph = Math.max(1, h);
  if (pw > fw) pw = fw;
  if (ph > fh) ph = fh;
  let px = x;
  let py = y;
  if (px < 0) px = 0;
  if (py < 0) py = 0;
  if (px + pw > fw) px = fw - pw;
  if (py + ph > fh) py = fh - ph;
  return {
    x: px / fw,
    y: py / fh,
    w: pw / fw,
    h: ph / fh,
  };
}

/** Largest window of `ratio` (pixel width/height) that stays inside the frame, biased toward a centre. */
export function fitRatio(ratio: number, frameW: number, frameH: number, cx = 0.5, cy = 0.5): Crop {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const safe = ratio > 0 ? ratio : fw / fh;
  let pw: number;
  let ph: number;
  if (fw / fh > safe) {
    ph = fh;
    pw = ph * safe;
  } else {
    pw = fw;
    ph = pw / safe;
  }
  return place(cx * fw - pw / 2, cy * fh - ph / 2, pw, ph, fw, fh);
}

export function moveRect(start: Crop, dx: number, dy: number): Crop {
  const w = Math.min(1, Math.max(MIN_FRAC, start.w));
  const h = Math.min(1, Math.max(MIN_FRAC, start.h));
  let x = start.x + dx;
  let y = start.y + dy;
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > 1) x = 1 - w;
  if (y + h > 1) y = 1 - h;
  return { x, y, w, h };
}

/**
 * Drag a corner or edge. `px`/`py` are the pointer inside the frame, as fractions.
 * `ratio` locks pixel width/height.
 */
export function resizeRect(
  start: Crop,
  handle: CropHandle,
  px: number,
  py: number,
  ratio: number | null,
  frameW: number,
  frameH: number,
): Crop {
  if (handle === 'move') return start;
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const minW = fw * MIN_FRAC;
  const minH = fh * MIN_FRAC;
  const left0 = start.x * fw;
  const top0 = start.y * fh;
  const right0 = left0 + start.w * fw;
  const bottom0 = top0 + start.h * fh;
  const has = (side: string) => handle.includes(side);

  if (ratio == null) {
    let left = left0;
    let top = top0;
    let right = right0;
    let bottom = bottom0;
    if (has('w')) left = px * fw;
    if (has('e')) right = px * fw;
    if (has('n')) top = py * fh;
    if (has('s')) bottom = py * fh;
    if (left > right) [left, right] = [right, left];
    if (top > bottom) [top, bottom] = [bottom, top];
    if (right - left < minW) {
      if (has('w') && !has('e')) left = right - minW;
      else right = left + minW;
    }
    if (bottom - top < minH) {
      if (has('n') && !has('s')) top = bottom - minH;
      else bottom = top + minH;
    }
    return place(left, top, right - left, bottom - top, fw, fh);
  }

  if (handle === 'e' || handle === 'w') {
    const anchor = handle === 'e' ? left0 : right0;
    let w = Math.max(minW, Math.abs(px * fw - anchor));
    let h = w / ratio;
    if (h > fh) {
      h = fh;
      w = h * ratio;
    }
    if (h < minH) {
      h = minH;
      w = Math.min(fw, h * ratio);
    }
    const midY = (top0 + bottom0) / 2;
    const x0 = handle === 'e' ? anchor : anchor - w;
    return place(x0, midY - h / 2, w, h, fw, fh);
  }

  if (handle === 'n' || handle === 's') {
    const anchor = handle === 's' ? top0 : bottom0;
    let h = Math.max(minH, Math.abs(py * fh - anchor));
    let w = h * ratio;
    if (w > fw) {
      w = fw;
      h = w / ratio;
    }
    if (w < minW) {
      w = minW;
      h = Math.min(fh, w / ratio);
    }
    const midX = (left0 + right0) / 2;
    const y0 = handle === 's' ? anchor : anchor - h;
    return place(midX - w / 2, y0, w, h, fw, fh);
  }

  const anchorX = has('w') ? right0 : left0;
  const anchorY = has('n') ? bottom0 : top0;
  let w = Math.max(1, Math.abs(px * fw - anchorX));
  let h = Math.max(1, Math.abs(py * fh - anchorY));
  if (w / h > ratio) h = w / ratio;
  else w = h * ratio;
  if (w < minW) {
    w = minW;
    h = w / ratio;
  }
  if (h < minH) {
    h = minH;
    w = h * ratio;
  }
  if (w > fw) {
    w = fw;
    h = w / ratio;
  }
  if (h > fh) {
    h = fh;
    w = h * ratio;
  }
  const x0 = has('w') ? anchorX - w : anchorX;
  const y0 = has('n') ? anchorY - h : anchorY;
  return place(x0, y0, w, h, fw, fh);
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * The largest window of `aspect` (width / height) inside the frame.
 * Pan is 0–1 along the leftover slack, so 0.5 sits in the centre.
 */
export function cropRect(imgW: number, imgH: number, aspect: number, panX: number, panY: number): Crop {
  const safeW = Math.max(1, imgW);
  const safeH = Math.max(1, imgH);
  const target = aspect > 0 ? aspect : safeW / safeH;
  let w: number;
  let h: number;
  if (safeW / safeH > target) {
    h = safeH;
    w = safeH * target;
  } else {
    w = safeW;
    h = safeW / target;
  }
  const x = (safeW - w) * clamp01(panX);
  const y = (safeH - h) * clamp01(panY);
  return { x, y, w, h };
}

/** Same window as percentages of the frame, for the on-screen crop. */
export function cropFractions(imgW: number, imgH: number, aspect: number, panX: number, panY: number): Crop {
  const rect = cropRect(imgW, imgH, aspect, panX, panY);
  return {
    x: (rect.x / Math.max(1, imgW)) * 100,
    y: (rect.y / Math.max(1, imgH)) * 100,
    w: (rect.w / Math.max(1, imgW)) * 100,
    h: (rect.h / Math.max(1, imgH)) * 100,
  };
}
