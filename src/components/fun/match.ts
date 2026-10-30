import { NEUTRAL_GRADE, type Grade } from '@/content/fun';
import { paintGrade } from './paint';
import { gradeFromStats, toneDistance, toneStats, type ToneStats } from './tone';

const TONE_KEYS = ['exposure', 'contrast', 'highlights', 'shadows', 'warmth', 'saturation', 'fade'] as const;

function sampleSize(w: number, h: number, max = 96): { w: number; h: number } {
  const scale = max / Math.max(w, h, 1);
  return {
    w: Math.max(1, Math.round(w * Math.min(1, scale))),
    h: Math.max(1, Math.round(h * Math.min(1, scale))),
  };
}

function readStats(canvas: HTMLCanvasElement): ToneStats {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return toneStats(new Uint8ClampedArray());
  return toneStats(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
}

function paintStats(img: CanvasImageSource, w: number, h: number, grade: Grade): ToneStats {
  const size = sampleSize(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return toneStats(new Uint8ClampedArray());
  // Grain and vignette are texture, not the light we are matching.
  paintGrade(ctx, img, size.w, size.h, { ...grade, grain: 0, vignette: 0 }, { rotation: 0, flip: false }, false);
  return readStats(canvas);
}

function referenceStats(img: CanvasImageSource, w: number, h: number): ToneStats {
  const size = sampleSize(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return toneStats(new Uint8ClampedArray());
  ctx.drawImage(img, 0, 0, size.w, size.h);
  return readStats(canvas);
}

function fitCost(grade: Grade, guess: Grade, stats: ToneStats, target: ToneStats): number {
  let pull = 0;
  for (const key of TONE_KEYS) pull += ((grade[key] - guess[key]) / 100) ** 2;
  // Stay near the stat guess. Wandering to the ends of the sliders
  // posterises, and the sliders are there for the rest of the way.
  return toneDistance(stats, target) + pull * 0.45;
}

/**
 * Set the tone sliders so the photo’s Lab stats and luminance histogram
 * sit near the reference. Grain and vignette are left as they were.
 */
export function matchToReference(source: CanvasImageSource, srcW: number, srcH: number, reference: CanvasImageSource, refW: number, refH: number, keep: Grade): Grade {
  const target = referenceStats(reference, refW, refH);
  const plain = paintStats(source, srcW, srcH, NEUTRAL_GRADE);
  const guess: Grade = { ...gradeFromStats(plain, target, keep), grain: keep.grain, vignette: keep.vignette };
  let best = guess;
  let bestCost = fitCost(best, guess, paintStats(source, srcW, srcH, best), target);

  for (const step of [8, 4]) {
    for (const key of TONE_KEYS) {
      const min = key === 'fade' ? 0 : -100;
      const origin = best[key];
      let local = best;
      let localCost = bestCost;
      for (const delta of [-step, step]) {
        const value = Math.round(Math.max(min, Math.min(100, origin + delta)));
        // The stat guess is the strong end. The paint pass may only ease it
        // off when the real filters overshoot.
        if (Math.abs(value) > Math.abs(guess[key]) || Math.abs(value - guess[key]) > 20) continue;
        const next: Grade = { ...best, [key]: value };
        const cost = fitCost(next, guess, paintStats(source, srcW, srcH, next), target);
        if (cost + 0.004 < localCost) {
          local = next;
          localCost = cost;
        }
      }
      best = local;
      bestCost = localCost;
    }
  }

  return best;
}
