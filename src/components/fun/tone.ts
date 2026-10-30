// Colour and tone stats for style matching. Lab is D65, and the luminance
// histogram is what the highlight and shadow fit actually looks at.

import type { Grade } from '@/content/fun';

export type ToneStats = {
  /** L, a, b means. L is 0–100. */
  mean: [number, number, number];
  std: [number, number, number];
  /** 32 bins of L, summing to 1. */
  hist: Float64Array;
  /** Luminance percentiles, 0–100, taken from the histogram. */
  p02: number;
  p10: number;
  p90: number;
};

const BINS = 32;

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function labOf(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / 0.95047);
  const fy = f(Y);
  const fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function percentile(hist: Float64Array, p: number): number {
  let acc = 0;
  for (let i = 0; i < hist.length; i++) {
    acc += hist[i];
    if (acc >= p) return ((i + 0.5) / hist.length) * 100;
  }
  return 100;
}

/** Per-channel Lab mean and spread, plus a luminance histogram. Skips clear pixels. */
export function toneStats(data: Uint8ClampedArray): ToneStats {
  const hist = new Float64Array(BINS);
  let n = 0;
  let mL = 0;
  let ma = 0;
  let mb = 0;
  let sL = 0;
  let sa = 0;
  let sb = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue;
    const [L, a, b] = labOf(data[i], data[i + 1], data[i + 2]);
    n += 1;
    const dL = L - mL;
    mL += dL / n;
    sL += dL * (L - mL);
    const da = a - ma;
    ma += da / n;
    sa += da * (a - ma);
    const db = b - mb;
    mb += db / n;
    sb += db * (b - mb);
    const bin = Math.max(0, Math.min(BINS - 1, Math.floor((L / 100) * BINS)));
    hist[bin] += 1;
  }

  if (n === 0) {
    return { mean: [0, 0, 0], std: [0, 0, 0], hist, p02: 0, p10: 0, p90: 0 };
  }

  for (let i = 0; i < BINS; i++) hist[i] /= n;
  return {
    mean: [mL, ma, mb],
    std: [Math.sqrt(sL / n), Math.sqrt(sa / n), Math.sqrt(sb / n)],
    hist,
    p02: percentile(hist, 0.02),
    p10: percentile(hist, 0.1),
    p90: percentile(hist, 0.9),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * A first guess from Lab means, spread, and the luminance histogram.
 * The canvas search afterwards moves the real sliders, so this only has to
 * start near the right light. Grain and vignette stay as they were.
 */
export function gradeFromStats(source: ToneStats, reference: ToneStats, keep: Grade): Grade {
  const dL = reference.mean[0] - source.mean[0];
  const stdRatio = source.std[0] > 1 ? reference.std[0] / source.std[0] : 1;
  const chroma = (s: ToneStats) => Math.hypot(s.mean[1], s.mean[2]);
  const satRatio = chroma(reference) / Math.max(0.5, chroma(source));
  const dB = reference.mean[2] - source.mean[2];
  const dA = reference.mean[1] - source.mean[1];
  const highlightGap = reference.p90 - reference.mean[0] - (source.p90 - source.mean[0]);
  const shadowGap = reference.p10 - reference.mean[0] - (source.p10 - source.mean[0]);
  const fadeLift = reference.p02 - source.p02;

  // Fade is a lifted black in a picture that still has a range. A flat
  // field has a high black point only because it has no shadows.
  const range = reference.p90 - reference.p02;
  const faded = fadeLift > 6 && range > 30 && reference.std[0] > 12 && chroma(reference) < 22;
  const fade = faded ? Math.round(clamp((fadeLift / 36) * 100, 0, 55)) : 0;

  return {
    ...keep,
    exposure: Math.round(clamp((dL / 48) * 100, -80, 80)),
    contrast: Math.round(clamp((stdRatio - 1) * 64, -75, 75)),
    highlights: Math.round(clamp((highlightGap / 30) * 100, -75, 75)),
    shadows: Math.round(clamp((shadowGap / 24) * 100, -75, 75)),
    // The warmth slider only swings the hue a little, so a big Lab gap
    // still lands on a strong but photographic value.
    warmth: Math.round(clamp(dB * 2.1 + dA * 0.35, -75, 75)),
    // If the hue itself is far away, more saturation only shouts the
    // colour the sliders cannot actually reach.
    saturation: Math.round(clamp((satRatio - 1) * 60, -75, Math.hypot(dA, dB) > 18 ? 12 : 75)),
    fade,
  };
}

/** Lower is closer. Histogram distance keeps the shape, not only the average. */
export function toneDistance(a: ToneStats, b: ToneStats): number {
  const mean =
    ((a.mean[0] - b.mean[0]) ** 2) / 80 +
    ((a.mean[1] - b.mean[1]) ** 2) / 60 +
    ((a.mean[2] - b.mean[2]) ** 2) / 60;
  const spread =
    ((a.std[0] - b.std[0]) ** 2) / 30 +
    ((a.std[1] - b.std[1]) ** 2) / 40 +
    ((a.std[2] - b.std[2]) ** 2) / 40;
  let hist = 0;
  for (let i = 0; i < a.hist.length; i++) hist += Math.abs(a.hist[i] - b.hist[i]);
  return mean + spread + hist * 0.5;
}
