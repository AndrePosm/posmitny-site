'use client';

import { useEffect, useRef, useState } from 'react';
import { LOOKS, type Grade } from '@/content/fun';
import { blankCrop, type PhotoCrop } from '../crop';
import { fitSize, paintCropped, type Frame } from '../paint';

export function thumbKey(src: string, id: string, frame: Frame, bw: boolean, grade: Grade, crop: PhotoCrop): string {
  return [
    src,
    id,
    frame.rotation,
    frame.flip ? 1 : 0,
    bw ? 1 : 0,
    grade.exposure,
    grade.contrast,
    grade.highlights,
    grade.shadows,
    grade.warmth,
    grade.saturation,
    grade.fade,
    grade.grain,
    grade.vignette,
    crop.x.toFixed(4),
    crop.y.toFixed(4),
    crop.w.toFixed(4),
    crop.h.toFixed(4),
    crop.angle.toFixed(1),
  ].join('|');
}

function renderThumb(img: HTMLImageElement, grade: Grade, frame: Frame, crop: PhotoCrop, bw: boolean): string {
  const max = 64 * Math.min(2, window.devicePixelRatio || 1);
  const swapped = ((frame.rotation % 360) + 360) % 360 % 180 !== 0;
  const ow = swapped ? img.naturalHeight : img.naturalWidth;
  const oh = swapped ? img.naturalWidth : img.naturalHeight;
  const cw = Math.max(1, ow * Math.max(0.02, crop.w));
  const ch = Math.max(1, oh * Math.max(0.02, crop.h));
  const size = fitSize(cw, ch, 0, max, max);
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  paintCropped(ctx, img, size.w, size.h, grade, frame, crop, bw);
  try {
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return '';
  }
}

/** Small look previews of the open photo, painted one at a time while the browser is idle. */
export function useLookThumbs(
  img: HTMLImageElement | null,
  src: string,
  frame: Frame,
  bw: boolean,
  refGrade: Grade | null,
  crop: PhotoCrop = blankCrop(),
): Record<string, string> {
  const cache = useRef(new Map<string, string>());
  const [map, setMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!img?.naturalWidth || !src) return;
    let cancel = false;
    const jobs: { id: string; grade: Grade }[] = LOOKS.map((look) => ({ id: look.id, grade: look.grade }));
    if (refGrade) jobs.push({ id: 'ref', grade: refGrade });

    const known: Record<string, string> = {};
    const pending: { id: string; grade: Grade; key: string }[] = [];
    for (const job of jobs) {
      const key = thumbKey(src, job.id, frame, bw, job.grade, crop);
      const hit = cache.current.get(key);
      if (hit) known[key] = hit;
      else pending.push({ ...job, key });
    }
    if (Object.keys(known).length) setMap((prev) => ({ ...prev, ...known }));

    let index = 0;
    const step = (deadline?: IdleDeadline) => {
      if (cancel) return;
      const started = performance.now();
      const batch: Record<string, string> = {};
      while (index < pending.length && performance.now() - started < 12 && (!deadline || deadline.timeRemaining() > 5)) {
        const job = pending[index];
        index += 1;
        const url = renderThumb(img, job.grade, frame, crop, bw);
        if (!url) continue;
        cache.current.set(job.key, url);
        batch[job.key] = url;
      }
      if (Object.keys(batch).length && !cancel) setMap((prev) => ({ ...prev, ...batch }));
      if (cancel || index >= pending.length) return;
      const ric = window.requestIdleCallback;
      if (ric) ric((next) => step(next), { timeout: 240 });
      else window.setTimeout(() => step(), 32);
    };

    if (pending.length) {
      const ric = window.requestIdleCallback;
      if (ric) ric((deadline) => step(deadline), { timeout: 240 });
      else window.setTimeout(() => step(), 32);
    }
    return () => {
      cancel = true;
    };
  }, [img, src, frame.rotation, frame.flip, bw, refGrade, crop]);

  return map;
}
