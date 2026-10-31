import type { Grade } from '@/content/fun';
import { makeCanvas, type AnyCanvas } from './canvas';
import { coverScale, type PhotoCrop } from './crop';

export type Frame = { rotation: number; flip: boolean };

const MAX_EXPORT = 2560;
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;
/** How far a tone mask reaches. Higher keeps the slider out of the midtones. */
const MASK_POWER = 2.2;
const SHADOW_LIFT = 0.42;
const SHADOW_CRUSH = 0.95;
const HIGHLIGHT_BOOST = 0.75;
const HIGHLIGHT_PULL = 0.22;

let grainCanvas: AnyCanvas | null = null;
let scratch: AnyCanvas | null = null;
let framed: AnyCanvas | null = null;

function grainTile(): AnyCanvas | null {
  if (grainCanvas) return grainCanvas;
  let c: AnyCanvas;
  try {
    c = makeCanvas(160, 160);
  } catch {
    return null;
  }
  const ctx = c.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) return null;
  const data = ctx.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 96 + Math.random() * 64;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  grainCanvas = c;
  return c;
}

function framedCanvas(w: number, h: number): AnyCanvas | null {
  try {
    if (!framed || framed.width !== w || framed.height !== h) framed = makeCanvas(w, h);
  } catch {
    return null;
  }
  return framed;
}

function scratchCanvas(w: number, h: number): AnyCanvas | null {
  try {
    if (!scratch || scratch.width !== w || scratch.height !== h) scratch = makeCanvas(w, h);
  } catch {
    return null;
  }
  return scratch;
}

function turnsOf(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}

function clamp8(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : Math.round(n);
}

/**
 * Scale for each 8-bit luminance. Index 0 is an absolute level (0..1) used
 * when the pixel is black; every other index is target / luminance.
 */
export function toneLut(highlights: number, shadows: number): Float32Array {
  const lut = new Float32Array(256);
  const s = shadows / 100;
  const h = highlights / 100;
  const sAmt = s > 0 ? SHADOW_LIFT : SHADOW_CRUSH;
  const hAmt = h > 0 ? HIGHLIGHT_BOOST : HIGHLIGHT_PULL;
  for (let i = 0; i < 256; i++) {
    const L = i / 255;
    let target = L;
    if (s !== 0) {
      const mask = (1 - L) ** MASK_POWER;
      target += s * mask * (s > 0 ? 1 - L : L) * sAmt;
    }
    if (h !== 0) {
      const mask = L ** MASK_POWER;
      target += h * mask * (h > 0 ? 1 - L : L) * hAmt;
    }
    if (target < 0) target = 0;
    else if (target > 1) target = 1;
    lut[i] = i === 0 ? target : target / L;
  }
  return lut;
}

/** Open or crush shadows, and brighten or recover highlights, without shifting hue. */
export function applyHighlightsShadows(data: Uint8ClampedArray, highlights: number, shadows: number): void {
  if (highlights === 0 && shadows === 0) return;
  const lut = toneLut(highlights, shadows);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const y = Math.round(LUMA_R * r + LUMA_G * g + LUMA_B * b);
    if (y <= 0) {
      const v = Math.round(lut[0] * 255);
      data[i] = data[i + 1] = data[i + 2] = v;
    } else {
      const scale = lut[Math.min(255, y)];
      data[i] = clamp8(r * scale);
      data[i + 1] = clamp8(g * scale);
      data[i + 2] = clamp8(b * scale);
    }
  }
}

/** Bitmap size that fits `src` inside a box, swapping sides when the frame is turned. */
export function fitSize(srcW: number, srcH: number, rotation: number, maxW: number, maxH: number): { w: number; h: number } {
  const swapped = turnsOf(rotation) % 180 !== 0;
  const ow = swapped ? srcH : srcW;
  const oh = swapped ? srcW : srcH;
  const scale = Math.min(maxW / ow, maxH / oh);
  return { w: Math.max(1, Math.round(ow * scale)), h: Math.max(1, Math.round(oh * scale)) };
}

export function previewPixels(srcW: number, srcH: number, rotation: number, boxW: number, boxH: number, dpr: number) {
  const css = fitSize(srcW, srcH, rotation, boxW, boxH);
  return { cssW: css.w, cssH: css.h, w: Math.max(1, Math.round(css.w * dpr)), h: Math.max(1, Math.round(css.h * dpr)) };
}

export function exportSize(srcW: number, srcH: number, rotation: number, maxEdge = MAX_EXPORT) {
  const swapped = turnsOf(rotation) % 180 !== 0;
  const ow = swapped ? srcH : srcW;
  const oh = swapped ? srcW : srcH;
  const scale = Math.min(1, maxEdge / Math.max(ow, oh));
  return { w: Math.max(1, Math.round(ow * scale)), h: Math.max(1, Math.round(oh * scale)) };
}

function filterFor(grade: Grade): string {
  const brightness = (1 + grade.exposure / 125).toFixed(3);
  const contrast = Math.max(0, 1 + grade.contrast / 100).toFixed(3);
  const saturate = Math.max(0, 1 + grade.saturation / 100).toFixed(3);
  let extra = '';
  if (grade.warmth > 0) {
    const t = grade.warmth / 100;
    extra = ` sepia(${(t * 0.62).toFixed(3)}) hue-rotate(${(-10 * t).toFixed(2)}deg)`;
  } else if (grade.warmth < 0) {
    const t = Math.abs(grade.warmth) / 100;
    extra = ` hue-rotate(${(28 * t).toFixed(2)}deg) saturate(${Math.max(0, 1 - t * 0.25).toFixed(3)})`;
  }
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})${extra}`;
}

/**
 * Paint a graded photo into `ctx`'s canvas. Colour is applied on a straight scratch
 * canvas first, then rotated, so the filter doesn't fight the transform.
 * `bw` is a view (or an export choice). It does not change the grade.
 */
export function paintGrade(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  w: number,
  h: number,
  grade: Grade,
  frame: Frame,
  bw = false,
): void {
  const turns = turnsOf(frame.rotation);
  const swapped = turns % 180 !== 0;
  const lw = swapped ? h : w;
  const lh = swapped ? w : h;
  const layer = scratchCanvas(lw, lh);
  const sctx = layer?.getContext('2d');
  if (!layer || !sctx) return;

  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalAlpha = 1;
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, lw, lh);
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.filter = filterFor(grade);
  sctx.drawImage(img, 0, 0, lw, lh);
  sctx.filter = 'none';

  if (grade.highlights !== 0 || grade.shadows !== 0) {
    const pixels = sctx.getImageData(0, 0, lw, lh);
    applyHighlightsShadows(pixels.data, grade.highlights, grade.shadows);
    sctx.putImageData(pixels, 0, 0);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.translate(w / 2, h / 2);
  // Flip in screen space (after rotation) so the control always mirrors left to right.
  if (frame.flip) ctx.scale(-1, 1);
  ctx.rotate((turns * Math.PI) / 180);
  if (bw) ctx.filter = 'grayscale(1)';
  ctx.drawImage(layer, -lw / 2, -lh / 2);
  ctx.restore();

  if (grade.fade > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = Math.min(0.42, grade.fade / 260);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (grade.vignette > 0) {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.82, grade.vignette / 112).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  if (grade.grain > 0) {
    const tile = grainTile();
    const pattern = tile && ctx.createPattern(tile as CanvasImageSource, 'repeat');
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = Math.min(0.55, grade.grain / 150);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }
}

export function isFullCrop(crop: PhotoCrop): boolean {
  return Math.abs(crop.angle) < 0.05
    && crop.x <= 0.0001
    && crop.y <= 0.0001
    && crop.w >= 0.9999
    && crop.h >= 0.9999;
}

/**
 * Paint the graded frame, rotate it by the straighten angle, zoom until the
 * frame stays covered, then copy the crop window into `ctx`.
 */
export function paintCropped(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  outW: number,
  outH: number,
  grade: Grade,
  frame: Frame,
  crop: PhotoCrop,
  bw = false,
): void {
  if (isFullCrop(crop)) {
    paintGrade(ctx, img, outW, outH, grade, frame, bw);
    return;
  }
  const span = Math.max(0.02, Math.min(1, crop.w));
  const rise = Math.max(0.02, Math.min(1, crop.h));
  let fullW = Math.max(1, Math.round(outW / span));
  let fullH = Math.max(1, Math.round(outH / rise));
  const cap = 4096;
  const limit = Math.min(1, cap / Math.max(fullW, fullH));
  fullW = Math.max(1, Math.round(fullW * limit));
  fullH = Math.max(1, Math.round(fullH * limit));
  const buf = framedCanvas(fullW, fullH);
  const bctx = buf?.getContext('2d') as CanvasRenderingContext2D | null;
  if (!buf || !bctx) {
    paintGrade(ctx, img, outW, outH, grade, frame, bw);
    return;
  }
  paintGrade(bctx, img, fullW, fullH, grade, frame, bw);

  const zoom = coverScale(crop.angle, fullW, fullH);
  const rad = (crop.angle * Math.PI) / 180;
  const cropX = Math.min(1, Math.max(0, crop.x)) * fullW;
  const cropY = Math.min(1, Math.max(0, crop.y)) * fullH;
  const cropW = Math.max(1, span * fullW);
  const cropH = Math.max(1, rise * fullH);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.clearRect(0, 0, outW, outH);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, outW, outH);
  ctx.clip();
  ctx.translate(outW / 2, outH / 2);
  ctx.scale(outW / cropW, outH / cropH);
  ctx.translate(fullW / 2 - (cropX + cropW / 2), fullH / 2 - (cropY + cropH / 2));
  ctx.rotate(rad);
  ctx.scale(zoom, zoom);
  ctx.drawImage(buf, -fullW / 2, -fullH / 2, fullW, fullH);
  ctx.restore();
}
