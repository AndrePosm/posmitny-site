import { ctx2d, makeCanvas } from '../canvas';
import {
  FACE_OVAL,
  LEFT_BROW,
  LEFT_EYE,
  LEFT_IRIS,
  LIPS,
  NOSTRIL,
  RIGHT_BROW,
  RIGHT_EYE,
  RIGHT_IRIS,
} from './contours';

export type Pt = { x: number; y: number };

const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

/**
 * Frequency separation inside a feathered skin mask.
 * `delta` is largeBlur − smallBlur, with strong edges held back, so
 * `src + delta` keeps pores and smooths tone.
 */
export function buildSkin(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  faces: Pt[][],
): { mask: Uint8Array; delta: Int16Array } {
  const count = w * h;
  const mask = rasterMask(faces, w, h);
  const delta = new Int16Array(count * 3);
  if (!mask.some((v) => v > 8)) return { mask, delta };

  const widths = faces.map((face) => faceWidth(face, w)).filter((v) => v > 8);
  const faceW = median(widths.length ? widths : [Math.min(w, h) * 0.4]);
  // Small radius holds pores. Large radius evens tone and blotches across the cheek.
  const rSmall = clamp(Math.round(faceW * 0.008), 1, 5);
  const rLarge = clamp(Math.round(faceW * 0.11), rSmall + 6, 72);

  const r = new Float32Array(count);
  const g = new Float32Array(count);
  const b = new Float32Array(count);
  for (let p = 0, o = 0; p < count; p++, o += 4) {
    r[p] = pixels[o];
    g[p] = pixels[o + 1];
    b[p] = pixels[o + 2];
  }
  const smallR = gaussian(r, w, h, rSmall);
  const smallG = gaussian(g, w, h, rSmall);
  const smallB = gaussian(b, w, h, rSmall);
  const largeR = gaussian(r, w, h, rLarge);
  const largeG = gaussian(g, w, h, rLarge);
  const largeB = gaussian(b, w, h, rLarge);

  for (let p = 0, d = 0; p < count; p++, d += 3) {
    const er = Math.abs(r[p] - smallR[p]);
    const eg = Math.abs(g[p] - smallG[p]);
    const eb = Math.abs(b[p] - smallB[p]);
    const edge = LUMA_R * er + LUMA_G * eg + LUMA_B * eb;
    // Pores stay in src − smallBlur. This gate only holds back hard edges
    // (lashes, hair, glasses) that leaked into the mask. Soft blotches still even out.
    const keep = edge <= 72 ? 1 : Math.max(0, 1 - (edge - 72) / 56);
    delta[d] = i16((largeR[p] - smallR[p]) * keep);
    delta[d + 1] = i16((largeG[p] - smallG[p]) * keep);
    delta[d + 2] = i16((largeB[p] - smallB[p]) * keep);
  }
  return { mask, delta };
}

function rasterMask(faces: Pt[][], w: number, h: number): Uint8Array {
  const faceCanvas = makeCanvas(w, h);
  const featCanvas = makeCanvas(w, h);
  const faceCtx = ctx2d(faceCanvas);
  const featCtx = ctx2d(featCanvas);
  faceCtx.clearRect(0, 0, w, h);
  featCtx.clearRect(0, 0, w, h);
  featCtx.fillStyle = '#fff';
  featCtx.strokeStyle = '#fff';
  featCtx.lineCap = 'round';
  featCtx.lineJoin = 'round';
  let any = false;
  for (const face of faces) {
    if (face.length < 300) continue;
    const oval = insetHairline(loop(face, FACE_OVAL), face[1] ?? face[4]);
    if (oval.length < 8) continue;
    any = true;
    const fw = faceWidth(face, w);
    faceCtx.fillStyle = '#fff';
    fillLoop(faceCtx, oval, w, h, 0.98);
    fillLoop(featCtx, loop(face, LEFT_EYE), w, h, 1.62);
    fillLoop(featCtx, loop(face, RIGHT_EYE), w, h, 1.62);
    const lips = loop(face, LIPS);
    fillLoop(featCtx, lips, w, h, 1.08);
    strokeLoop(featCtx, lips, w, h, Math.max(5, fw * 0.085));
    fillLoop(featCtx, loop(face, LEFT_IRIS), w, h, 1.7);
    fillLoop(featCtx, loop(face, RIGHT_IRIS), w, h, 1.7);
    const brow = Math.max(3, fw * 0.085);
    for (const chain of LEFT_BROW) strokeChain(featCtx, face, chain, w, h, brow);
    for (const chain of RIGHT_BROW) strokeChain(featCtx, face, chain, w, h, brow);
    punchNostrils(featCtx, face, w, h);
  }
  const out = new Uint8Array(w * h);
  if (!any) return out;
  const faceAlpha = faceCtx.getImageData(0, 0, w, h).data;
  const featAlpha = featCtx.getImageData(0, 0, w, h).data;
  const faceRaw = new Uint8Array(out.length);
  const featRaw = new Uint8Array(out.length);
  for (let p = 0; p < out.length; p++) {
    faceRaw[p] = faceAlpha[p * 4 + 3];
    featRaw[p] = featAlpha[p * 4 + 3];
  }
  const fw = median(faces.map((face) => faceWidth(face, w)).filter((v) => v > 8));
  const feather = clamp(Math.round((fw || Math.min(w, h) * 0.3) * 0.035), 3, 28);
  const faceSoft = blurMask(faceRaw, w, h, feather);
  const featSoft = blurMask(featRaw, w, h, clamp(Math.round(feather * 0.18), 1, 3));
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.round(faceSoft[i] * (255 - featSoft[i]) / 255);
  }
  return out;
}

/** Pull the forehead edge down a little so bangs fall outside the mask. Cheeks stay put. */
function insetHairline(pts: Pt[], nose: Pt | undefined): Pt[] {
  if (!nose || pts.length < 3) return pts;
  let minY = 1;
  let maxY = 0;
  for (const p of pts) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const span = maxY - minY || 1;
  return pts.map((p) => {
    const t = (p.y - minY) / span;
    if (t > 0.26) return p;
    const pull = ((0.26 - t) / 0.26) * 0.16;
    return { x: p.x + (nose.x - p.x) * pull, y: p.y + (nose.y - p.y) * pull };
  });
}

function punchNostrils(ctx: CanvasRenderingContext2D, face: Pt[], w: number, h: number) {
  const a = face[NOSTRIL[0]];
  const b = face[NOSTRIL[1]];
  if (!a || !b) return;
  const dist = Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
  const radius = Math.max(3, dist * 0.38);
  ctx.beginPath();
  ctx.arc(a.x * w, a.y * h, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(b.x * w, b.y * h, radius, 0, Math.PI * 2);
  ctx.fill();
}

function loop(face: Pt[], indices: readonly number[]): Pt[] {
  const pts: Pt[] = [];
  for (const index of indices) {
    const pt = face[index];
    if (pt) pts.push(pt);
  }
  return pts;
}

function fillLoop(ctx: CanvasRenderingContext2D, pts: Pt[], w: number, h: number, scale: number) {
  if (pts.length < 3) return;
  const grown = scale === 1 ? pts : grow(pts, scale);
  ctx.beginPath();
  ctx.moveTo(grown[0].x * w, grown[0].y * h);
  for (let i = 1; i < grown.length; i++) ctx.lineTo(grown[i].x * w, grown[i].y * h);
  ctx.closePath();
  ctx.fill();
}

function strokeLoop(ctx: CanvasRenderingContext2D, pts: Pt[], w: number, h: number, width: number) {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.lineWidth = width;
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
  ctx.closePath();
  ctx.stroke();
}

function strokeChain(ctx: CanvasRenderingContext2D, face: Pt[], indices: readonly number[], w: number, h: number, width: number) {
  const pts = loop(face, indices);
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.lineWidth = width;
  ctx.moveTo(pts[0].x * w, pts[0].y * h);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
  ctx.stroke();
}

function grow(pts: Pt[], scale: number): Pt[] {
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.map((p) => ({ x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale }));
}

function faceWidth(face: Pt[], w: number): number {
  let minX = 1;
  let maxX = 0;
  for (const index of FACE_OVAL) {
    const pt = face[index];
    if (!pt) continue;
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
  }
  return Math.max(0, (maxX - minX) * w);
}

function blurMask(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const src = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) src[i] = mask[i];
  const blurred = gaussian(src, w, h, radius);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) {
    const v = Math.round(blurred[i]);
    out[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  return out;
}

/** Three box passes, a cheap stand-in for a gaussian. */
function gaussian(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = clamp(Math.round(radius), 0, Math.floor(Math.min(w, h) / 3));
  if (r < 1) {
    const copy = new Float32Array(src.length);
    copy.set(src);
    return copy;
  }
  const bufA = new Float32Array(src.length);
  const bufB = new Float32Array(src.length);
  let cur = src;
  for (let pass = 0; pass < 3; pass++) {
    boxH(cur, bufA, w, h, r);
    boxV(bufA, bufB, w, h, r);
    cur = bufB;
  }
  return cur;
}

function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, radius: number) {
  const win = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src[row + clamp(k, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      dst[row + x] = sum / win;
      sum += src[row + clamp(x + radius + 1, 0, w - 1)] - src[row + clamp(x - radius, 0, w - 1)];
    }
  }
}

function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, radius: number) {
  const win = radius * 2 + 1;
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src[clamp(k, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / win;
      sum += src[clamp(y + radius + 1, 0, h - 1) * w + x] - src[clamp(y - radius, 0, h - 1) * w + x];
    }
  }
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function i16(n: number): number {
  const r = Math.round(n);
  if (r < -32768) return -32768;
  if (r > 32767) return 32767;
  return r;
}
