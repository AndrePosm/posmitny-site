import type { Grade } from '@/content/fun';

export type Frame = { rotation: number; flip: boolean };

const MAX_EXPORT = 2560;

let grainCanvas: HTMLCanvasElement | null = null;
let scratch: HTMLCanvasElement | null = null;

function grainTile(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (grainCanvas) return grainCanvas;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const ctx = c.getContext('2d');
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

function scratchCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  return scratch;
}

function turnsOf(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
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

export function exportSize(srcW: number, srcH: number, rotation: number) {
  const swapped = turnsOf(rotation) % 180 !== 0;
  const ow = swapped ? srcH : srcW;
  const oh = swapped ? srcW : srcH;
  const scale = Math.min(1, MAX_EXPORT / Math.max(ow, oh));
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
 */
export function paintGrade(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number, grade: Grade, frame: Frame): void {
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
    const pattern = tile && ctx.createPattern(tile, 'repeat');
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
