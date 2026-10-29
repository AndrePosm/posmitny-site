// Copy and looks for the Fun page darkroom (English).

export type Grade = {
  exposure: number;
  contrast: number;
  warmth: number;
  saturation: number;
  fade: number;
  grain: number;
  vignette: number;
};

export const NEUTRAL_GRADE: Grade = {
  exposure: 0,
  contrast: 0,
  warmth: 0,
  saturation: 0,
  fade: 0,
  grain: 0,
  vignette: 0,
};

const grade = (partial: Partial<Grade>): Grade => ({ ...NEUTRAL_GRADE, ...partial });

export const FUN = {
  eyebrow: 'fun',
  title: 'Play with the light.',
  lead: 'A small darkroom for the photos from Fuerteventura. Change the light, or drop in a photo of your own. It stays on this device.',
} as const;

export const LOOKS: { id: string; label: string; grade: Grade }[] = [
  { id: 'original', label: 'Original', grade: NEUTRAL_GRADE },
  { id: 'dawn', label: 'Dawn', grade: grade({ exposure: 10, contrast: -12, warmth: 28, saturation: -6, fade: 22, grain: 8, vignette: 14 }) },
  { id: 'midday', label: 'Midday', grade: grade({ exposure: 6, contrast: 16, warmth: -6, saturation: 18, vignette: 8 }) },
  { id: 'golden', label: 'Golden hour', grade: grade({ exposure: 8, contrast: 8, warmth: 62, saturation: 10, fade: 8, grain: 12, vignette: 32 }) },
  { id: 'storm', label: 'Storm', grade: grade({ exposure: -8, contrast: 28, warmth: -18, saturation: -48, fade: 6, grain: 16, vignette: 36 }) },
  { id: 'night', label: 'Night', grade: grade({ exposure: -28, contrast: 18, warmth: -10, saturation: -22, grain: 24, vignette: 62 }) },
  { id: 'film', label: 'Faded film', grade: grade({ exposure: 12, contrast: -18, warmth: 16, saturation: -28, fade: 48, grain: 32, vignette: 20 }) },
];

export function matchLook(value: Grade): string {
  for (const look of LOOKS) {
    const g = look.grade;
    if (
      g.exposure === value.exposure &&
      g.contrast === value.contrast &&
      g.warmth === value.warmth &&
      g.saturation === value.saturation &&
      g.fade === value.fade &&
      g.grain === value.grain &&
      g.vignette === value.vignette
    ) return look.id;
  }
  return 'custom';
}

function steps(v: number, bands: [number, string][], fallback: string): string {
  for (const [max, label] of bands) if (v <= max) return label;
  return fallback;
}

/** Bipolar sliders read “as shot” only at zero, so a look never claims it hasn’t changed the frame. */
function signed(v: number, low: string, lower: string, mid: string, higher: string, high: string): string {
  if (v === 0) return mid;
  if (v <= -55) return low;
  if (v < 0) return lower;
  if (v >= 55) return high;
  return higher;
}

export const ADJUSTMENTS: { key: keyof Grade; label: string; min: number; max: number; hint: (v: number) => string }[] = [
  { key: 'exposure', label: 'Exposure', min: -100, max: 100, hint: (v) => signed(v, 'Dark', 'A bit dark', 'As shot', 'A bit bright', 'Bright') },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, hint: (v) => signed(v, 'Flat', 'Soft', 'As shot', 'Punchy', 'Hard') },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100, hint: (v) => signed(v, 'Cold', 'Cool', 'Neutral', 'Warm', 'Golden') },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, hint: (v) => signed(v, 'Grey', 'Muted', 'As shot', 'Rich', 'Vivid') },
  { key: 'fade', label: 'Fade', min: 0, max: 100, hint: (v) => steps(v, [[0, 'None'], [18, 'A lift'], [45, 'Faded']], 'Washed') },
  { key: 'grain', label: 'Grain', min: 0, max: 100, hint: (v) => steps(v, [[0, 'Clean'], [18, 'Fine'], [45, 'Visible']], 'Heavy') },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100, hint: (v) => steps(v, [[0, 'None'], [18, 'Soft'], [50, 'Dark corners']], 'Heavy') },
];
