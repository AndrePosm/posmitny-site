// Copy and photos for the Me page (English).

export type Photo = { src: string; alt: string; cap: string; w: number; h: number };

const p = (name: string, w: number, h: number, alt: string, cap: string): Photo => ({ src: `/img/me-${name}.webp`, w, h, alt, cap });

export const PHOTOS = {
  pinkmtn: p('pinkmtn', 1086, 724, 'Pink clouds drifting over brown volcanic mountains', 'pink hour · the mountains wake up'),
  lobos: p('lobos', 768, 1024, 'Isla de Lobos across a wavy blue sea', 'isla de lobos'),
  road: p('road', 768, 1024, 'A straight empty road leading to a red volcano', 'the road · towards the volcano'),
  dunes: p('dunes', 1086, 724, 'White dunes and black lava rocks under a heavy stormy sky', 'storm light · the dunes'),
  aloe: p('aloe', 1086, 724, 'Rows of flowering aloe vera in front of dark mountains', 'aloe fields'),
  volcano: p('volcano', 1024, 768, 'A volcanic ridge glowing orange in evening light', 'volcano light · golden hour'),
  sunset: p('sunset', 900, 1600, 'The sun setting into the Atlantic behind a dark cliff', 'last light · the atlantic'),
  pinksky: p('pinksky', 1024, 768, 'Streaks of pink and orange clouds at dusk', 'after sunset'),
} as const;

export type PhotoKey = keyof typeof PHOTOS;

/** Order the lightbox walks through: the day from dawn to dusk. */
export const PHOTO_ORDER: PhotoKey[] = ['pinkmtn', 'lobos', 'road', 'dunes', 'aloe', 'volcano', 'sunset', 'pinksky'];

export type Shot = { key: PhotoKey; col: string; offset?: 'down' | 'up' };
export type Chapter = { id: string; label: string; time: string; shots: Shot[]; note?: { text: string; col: string } };

export const CHAPTERS: Chapter[] = [
  {
    id: 'dawn', label: 'dawn', time: 'first light',
    shots: [{ key: 'pinkmtn', col: 'c-1-10' }],
    note: { text: 'The softest light of the day, and nobody on the road yet.', col: 'c-10-13' },
  },
  {
    id: 'midday', label: 'midday', time: 'sun overhead',
    shots: [{ key: 'lobos', col: 'c-2-7' }, { key: 'road', col: 'c-8-13', offset: 'down' }],
  },
  {
    id: 'storm', label: 'storm light', time: 'wind picks up',
    shots: [{ key: 'dunes', col: 'c-1-8' }, { key: 'aloe', col: 'c-8-13', offset: 'down' }],
  },
  {
    id: 'golden', label: 'golden hour', time: 'the light turns warm',
    shots: [{ key: 'volcano', col: 'c-1-9', offset: 'down' }, { key: 'sunset', col: 'c-9-13' }],
  },
  {
    id: 'dusk', label: 'dusk', time: 'after sunset',
    shots: [{ key: 'pinksky', col: 'c-3-13' }],
    note: { text: 'Some evenings the sky is the whole show.', col: 'c-1-3' },
  },
];
