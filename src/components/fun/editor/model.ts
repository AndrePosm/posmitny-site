import { NEUTRAL_GRADE, type Grade } from '@/content/fun';
import { blankCrop, type PhotoCrop } from '../crop';

export type { PhotoCrop };

export type PhotoState = { grade: Grade; rotation: number; flip: boolean; skin: number; crop: PhotoCrop };

export type SecId = 'looks' | 'light' | 'colour' | 'retouch' | 'effects' | 'export';

export const LIGHT_KEYS = ['exposure', 'contrast', 'highlights', 'shadows'] as const;
export const COLOUR_KEYS = ['warmth', 'saturation'] as const;
export const EFFECT_KEYS = ['fade', 'grain', 'vignette'] as const;

export const DEFAULT_OPEN: Record<SecId, boolean> = {
  looks: true,
  light: true,
  colour: true,
  retouch: true,
  effects: false,
  export: true,
};

export const OPEN_KEY = 'darkroom-sections';

export function blankPhoto(): PhotoState {
  return { grade: { ...NEUTRAL_GRADE }, rotation: 0, flip: false, skin: 0, crop: blankCrop() };
}

export function sameGrade(a: Grade, b: Grade): boolean {
  return (
    a.exposure === b.exposure
    && a.contrast === b.contrast
    && a.highlights === b.highlights
    && a.shadows === b.shadows
    && a.warmth === b.warmth
    && a.saturation === b.saturation
    && a.fade === b.fade
    && a.grain === b.grain
    && a.vignette === b.vignette
  );
}

export function gradeDirty(grade: Grade, keys: readonly (keyof Grade)[]): boolean {
  return keys.some((key) => grade[key] !== NEUTRAL_GRADE[key]);
}

export function readOpen(): Record<SecId, boolean> {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    if (!raw) return DEFAULT_OPEN;
    const parsed = JSON.parse(raw) as Partial<Record<SecId, boolean>>;
    const next = { ...DEFAULT_OPEN };
    (Object.keys(DEFAULT_OPEN) as SecId[]).forEach((key) => {
      if (typeof parsed[key] === 'boolean') next[key] = parsed[key];
    });
    return next;
  } catch {
    return DEFAULT_OPEN;
  }
}

export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
