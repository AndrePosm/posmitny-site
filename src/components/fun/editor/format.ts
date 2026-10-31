import type { Grade } from '@/content/fun';

export function formatGradeValue(key: keyof Grade, value: number, min: number): string {
  if (key === 'exposure') {
    if (value === 0) return '0.00';
    const ev = value / 100;
    const sign = ev > 0 ? '+' : '−';
    return sign + Math.abs(ev).toFixed(2);
  }
  if (value === 0) return '0';
  if (value < 0) return `−${Math.abs(value)}`;
  if (min < 0) return `+${value}`;
  return String(value);
}

/** Exposure is typed in stops (−1.00…+1.00). A whole number past that range is the raw slider. */
export function parseGradeValue(key: keyof Grade, text: string, min: number, max: number): number | null {
  const cleaned = text.trim().replace(/−/g, '-').replace(/\s/g, '');
  if (!cleaned || cleaned === '+' || cleaned === '-') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  const raw = key === 'exposure'
    ? (Math.abs(n) <= 2 ? Math.round(n * 100) : Math.round(n))
    : Math.round(n);
  return Math.max(min, Math.min(max, raw));
}
