'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Reveal } from '../Reveal';
import { CHAPTERS, PHOTOS, PHOTO_ORDER, type PhotoKey } from '@/content/me';

/** One day on the island, dawn to dusk. Each chapter tints the page; any photo opens full screen. */
export function DayGallery() {
  const [open, setOpen] = useState<number>(-1);
  const lastFocus = useRef<HTMLElement | null>(null);

  const show = (key: PhotoKey) => () => {
    lastFocus.current = document.activeElement as HTMLElement;
    setOpen(PHOTO_ORDER.indexOf(key));
  };
  const close = useCallback(() => {
    setOpen(-1);
    lastFocus.current?.focus();
  }, []);

  let prev = 'base';
  return (
    <>
      {CHAPTERS.map((ch) => {
        const from = prev;
        prev = ch.id;
        return (
          <section key={ch.id} className="day" aria-label={ch.label} style={{ background: `linear-gradient(180deg, var(--c-${from}) 0, var(--c-${ch.id}) clamp(160px, 18vw, 280px), var(--c-${ch.id}) 100%)` }}>
            <Reveal className="wrap day-in" threshold={0.12}>
              <p className="tod">
                <span className="tod-dot" />
                <span>{ch.label}</span>
                <span className="muted">{ch.time}</span>
              </p>
              <div className="grid12 stg u">
                {ch.shots.map((s) => {
                  const ph = PHOTOS[s.key];
                  return (
                    <button key={s.key} type="button" className={`shot ${s.col}${s.offset ? ' off-' + s.offset : ''}`} onClick={show(s.key)} aria-label={`Open photo: ${ph.cap}`}>
                      <span className="frame" style={{ aspectRatio: `${ph.w} / ${ph.h}` }}>
                        <img src={ph.src} width={ph.w} height={ph.h} alt={ph.alt} loading="lazy" />
                      </span>
                      <span className="cap">{ph.cap}</span>
                    </button>
                  );
                })}
                {ch.note && <p className={`note ${ch.note.col}`}>{ch.note.text}</p>}
              </div>
            </Reveal>
          </section>
        );
      })}
      {open >= 0 && <Lightbox index={open} onIndex={setOpen} onClose={close} />}
    </>
  );
}

function Lightbox({ index, onIndex, onClose }: { index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const n = PHOTO_ORDER.length;
  const ph = PHOTOS[PHOTO_ORDER[index]];
  const step = useCallback((d: number) => onIndex((index + d + n) % n), [index, n, onIndex]);

  useEffect(() => {
    ref.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      ref={ref}
      className="lb"
      role="dialog"
      aria-modal="true"
      aria-label={ph.cap}
      tabIndex={-1}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        else if (e.key === 'ArrowRight') step(1);
        else if (e.key === 'ArrowLeft') step(-1);
      }}
    >
      <button type="button" className="lbb lbx" onClick={onClose} aria-label="Close photo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <img key={ph.src} src={ph.src} alt={ph.alt} width={ph.w} height={ph.h} />
      <div className="lb-bar">
        <button type="button" className="lbb" onClick={() => step(-1)} aria-label="Previous photo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <span>{String(index + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}</span>
        <span style={{ color: '#ECEEF8' }}>{ph.cap}</span>
        <button type="button" className="lbb" onClick={() => step(1)} aria-label="Next photo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}
