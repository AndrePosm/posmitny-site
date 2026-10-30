export type Crop = { x: number; y: number; w: number; h: number };

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
