export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/** DOM canvas on the page. OffscreenCanvas in the export worker, where `document` is missing. */
export function makeCanvas(width: number, height: number): AnyCanvas {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof document === 'undefined') {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('no canvas');
    return new OffscreenCanvas(w, h);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function ctx2d(canvas: AnyCanvas): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no context');
  return ctx as CanvasRenderingContext2D;
}
