'use client';

import { useEffect, useRef, useState } from 'react';
import { LOOKS, type Grade } from '@/content/fun';
import { fitSize, paintGrade, type Frame } from '../paint';

export function thumbKey(src: string, id: string, frame: Frame, bw: boolean, grade: Grade): string {
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
  ].join('|');
}

function renderThumb(img: HTMLImageElement, grade: Grade, frame: Frame, bw: boolean): string {
  const max = 64 * Math.min(2, window.devicePixelRatio || 1);
  const size = fitSize(img.naturalWidth, img.naturalHeight, frame.rotation, max, max);
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  paintGrade(ctx, img, size.w, size.h, grade, frame, bw);
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
      const key = thumbKey(src, job.id, frame, bw, job.grade);
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
        const url = renderThumb(img, job.grade, frame, bw);
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
  }, [img, src, frame.rotation, frame.flip, bw, refGrade]);

  return map;
}
