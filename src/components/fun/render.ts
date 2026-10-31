import type { Grade } from '@/content/fun';
import { ctx2d, makeCanvas, type AnyCanvas } from './canvas';
import { cropRect } from './crop';
import { stripJpegMetadata } from './jpeg';
import { exportSize, paintGrade, type Frame } from './paint';
import type { ExportPreset } from './presets';

const JPEG_QUALITY = 0.9;

/** Step the scale down by half, then the last jump. Large jumps go soft. */
function drawScaled(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): AnyCanvas {
  let current = source;
  let x = sx;
  let y = sy;
  let w = sw;
  let h = sh;
  while (w * 0.5 >= dw && h * 0.5 >= dh) {
    const nw = Math.max(dw, Math.round(w * 0.5));
    const nh = Math.max(dh, Math.round(h * 0.5));
    const step = makeCanvas(nw, nh);
    const stepCtx = ctx2d(step);
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(current, x, y, w, h, 0, 0, nw, nh);
    current = step;
    x = 0;
    y = 0;
    w = nw;
    h = nh;
  }
  const out = makeCanvas(dw, dh);
  const outCtx = ctx2d(out);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(current, x, y, w, h, 0, 0, dw, dh);
  return out;
}

/** A light unsharp mask. Only worth it after a real downscale. */
function sharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 0.18) {
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const d = src.data;
  const o = out.data;
  const stride = w * 4;
  o.set(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * stride + x * 4;
      for (let c = 0; c < 3; c++) {
        const v = d[i + c];
        const n = d[i - stride + c] + d[i + stride + c] + d[i - 4 + c] + d[i + 4 + c];
        const s = v * (1 + 4 * amount) - amount * n;
        o[i + c] = s < 0 ? 0 : s > 255 ? 255 : s;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

async function encodeJpeg(raw: Blob): Promise<Blob> {
  const stripped = stripJpegMetadata(new Uint8Array(await raw.arrayBuffer()));
  const copy = new Uint8Array(stripped.byteLength);
  copy.set(stripped);
  return new Blob([copy], { type: 'image/jpeg' });
}

function jpegBlob(canvas: AnyCanvas): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY }).then(encodeJpeg);
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob((blob) => {
      if (!blob) reject(new Error('no blob'));
      else resolve(encodeJpeg(blob));
    }, 'image/jpeg', JPEG_QUALITY);
  });
}

/**
 * Grade, crop to the preset, resize, sharpen lightly, and encode an sRGB JPEG.
 * The file is painted from scratch, so the original EXIF and GPS are gone.
 */
export async function renderJpeg(
  img: CanvasImageSource,
  srcW: number,
  srcH: number,
  grade: Grade,
  frame: Frame,
  bw: boolean,
  preset: ExportPreset,
  panX: number,
  panY: number,
): Promise<Blob> {
  const painted = exportSize(srcW, srcH, frame.rotation, 2560);
  const base = makeCanvas(painted.w, painted.h);
  paintGrade(ctx2d(base), img, painted.w, painted.h, grade, frame, bw);

  const aspect = preset.aspect;
  const targetW = preset.width;
  const targetH = preset.height;
  let out: AnyCanvas = base;
  let scaled = false;

  if (aspect != null && targetW != null && targetH != null) {
    const crop = cropRect(painted.w, painted.h, aspect, panX, panY);
    const scale = Math.min(targetW / crop.w, targetH / crop.h);
    out = drawScaled(base, crop.x, crop.y, crop.w, crop.h, targetW, targetH);
    scaled = scale < 0.98;
  } else if (Math.max(painted.w, painted.h) > preset.longEdge + 1) {
    const fit = exportSize(painted.w, painted.h, 0, preset.longEdge);
    out = drawScaled(base, 0, 0, painted.w, painted.h, fit.w, fit.h);
    scaled = true;
  } else if (Math.max(srcW, srcH) > Math.max(painted.w, painted.h) + 1) {
    scaled = true;
  }

  if (scaled) {
    const ctx = out.getContext('2d') as CanvasRenderingContext2D | null;
    if (ctx) sharpen(ctx, out.width, out.height);
  }

  return jpegBlob(out);
}
