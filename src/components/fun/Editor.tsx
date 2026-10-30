'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ADJUSTMENTS, LOOKS, NEUTRAL_GRADE, matchLook, type Grade } from '@/content/fun';
import { PHOTOS, PHOTO_ORDER, type PhotoKey } from '@/content/me';
import { exportSize, paintGrade, previewPixels, type Frame } from './paint';

const START: PhotoKey = 'volcano';
const MAX_FILE = 25 * 1024 * 1024;

type Source = { kind: 'site'; key: PhotoKey } | { kind: 'upload' };
type Upload = { url: string; name: string };
type Adjustment = (typeof ADJUSTMENTS)[number];

function shortName(cap: string): string {
  const i = cap.indexOf('·');
  return (i === -1 ? cap : cap.slice(0, i)).trim();
}

function isImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'photo';
}

/** One grade slider. A double-click or a double-tap puts it back to its default. */
function GradeSlider({ spec, value, onChange }: { spec: Adjustment; value: number; onChange: (value: number) => void }) {
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const ignore = useRef(false);
  const fallback = NEUTRAL_GRADE[spec.key];

  function resetToDefault() {
    ignore.current = true;
    onChange(fallback);
    requestAnimationFrame(() => {
      onChange(fallback);
      requestAnimationFrame(() => {
        ignore.current = false;
      });
    });
  }

  return (
    <div
      className="ed-slider"
      onDoubleClick={(e) => {
        e.preventDefault();
        resetToDefault();
      }}
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if (e.pointerType === 'mouse') return;
        const start = down.current;
        down.current = null;
        if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) {
          lastTap.current = null;
          return;
        }
        const now = performance.now();
        const prev = lastTap.current;
        if (prev && now - prev.t < 350 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 32) {
          lastTap.current = null;
          resetToDefault();
          return;
        }
        lastTap.current = { t: now, x: e.clientX, y: e.clientY };
      }}
    >
      <label htmlFor={`ed-${spec.key}`}>
        <span>{spec.label}</span>
        <span>{spec.hint(value)}</span>
      </label>
      <input
        id={`ed-${spec.key}`}
        className="range"
        type="range"
        min={spec.min}
        max={spec.max}
        step={1}
        value={value}
        aria-valuetext={spec.hint(value)}
        title="Double-click or double-tap to reset"
        onChange={(e) => {
          if (ignore.current) {
            e.currentTarget.value = String(fallback);
            return;
          }
          onChange(Number(e.target.value));
        }}
      />
    </div>
  );
}

/** Grade a frame from the island, or one of your own. Everything stays in the browser. */
export function Editor() {
  const [source, setSource] = useState<Source>({ kind: 'site', key: START });
  const [upload, setUpload] = useState<Upload | null>(null);
  const [grade, setGrade] = useState<Grade>(NEUTRAL_GRADE);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);
  const [bw, setBw] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [ready, setReady] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const fitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const uploadUrl = useRef<string | null>(null);
  const dragDepth = useRef(0);
  const saving = useRef(false);
  const paintRef = useRef<() => void>(() => {});

  const frame: Frame = { rotation, flip };
  const look = matchLook(grade);
  const caption = source.kind === 'site' ? PHOTOS[source.key].cap : (upload?.name ?? 'Your photo');
  const alt = source.kind === 'site' ? PHOTOS[source.key].alt : 'Your photo';
  const lookLabel = LOOKS.find((l) => l.id === look)?.label ?? 'Tweaked';
  const picture = bw ? ' Black and white.' : '';

  const paint = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const box = fitRef.current;
    if (!img?.naturalWidth || !canvas || !box) return;
    const rect = box.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = previewPixels(img.naturalWidth, img.naturalHeight, rotation, rect.width, rect.height, dpr);
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    canvas.style.width = `${size.cssW}px`;
    canvas.style.height = `${size.cssH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Black and white is a view, so compare stays in it and the grade itself is unchanged.
    paintGrade(ctx, img, size.w, size.h, comparing ? NEUTRAL_GRADE : grade, { rotation, flip }, bw);
  }, [grade, rotation, flip, comparing, bw]);

  useEffect(() => {
    paintRef.current = paint;
  }, [paint]);

  useEffect(() => {
    paint();
  }, [paint, tick]);

  useEffect(() => {
    const box = fitRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => paintRef.current());
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const src = source.kind === 'site' ? PHOTOS[source.key].src : upload?.url;
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setReady(true);
      setError('');
      setTick((n) => n + 1);
    };
    img.onerror = () => {
      if (cancelled) return;
      setError(source.kind === 'upload' ? 'This browser couldn’t read that file. Try a JPEG or PNG.' : 'That photo didn’t load.');
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [source, upload]);

  useEffect(() => {
    const scroller = filmRef.current;
    const el = scroller?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!scroller || !el) return;
    const er = el.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    if (er.left < sr.left) scroller.scrollLeft -= sr.left - er.left + 8;
    else if (er.right > sr.right) scroller.scrollLeft += er.right - sr.right + 8;
  }, [source, upload]);

  useEffect(() => () => {
    if (uploadUrl.current) URL.revokeObjectURL(uploadUrl.current);
  }, []);

  function chooseSite(key: PhotoKey) {
    setSource({ kind: 'site', key });
    setRotation(0);
    setFlip(false);
    setError('');
  }

  function takeFile(file: File | undefined) {
    if (!file) return;
    if (!isImage(file)) {
      setError('That file isn’t a photo. Try a JPEG or PNG.');
      return;
    }
    if (file.size > MAX_FILE) {
      setError('That photo is too heavy. Try one under 25 MB.');
      return;
    }
    if (uploadUrl.current) URL.revokeObjectURL(uploadUrl.current);
    const url = URL.createObjectURL(file);
    uploadUrl.current = url;
    const name = file.name.replace(/\.[^.]+$/, '') || 'Your photo';
    setUpload({ url, name });
    setSource({ kind: 'upload' });
    setRotation(0);
    setFlip(false);
    setError('');
  }

  function applyLook(id: string) {
    const next = LOOKS.find((l) => l.id === id);
    if (!next) return;
    setGrade(next.grade);
  }

  const setPart = useCallback((key: keyof Grade, value: number) => {
    setGrade((prev) => ({ ...prev, [key]: value }));
  }, []);

  function reset() {
    setGrade(NEUTRAL_GRADE);
    setRotation(0);
    setFlip(false);
    setBw(false);
  }

  async function download(asBw: boolean) {
    const img = imgRef.current;
    const canvas = document.createElement('canvas');
    if (!img?.naturalWidth || saving.current) return;
    saving.current = true;
    try {
      const size = exportSize(img.naturalWidth, img.naturalHeight, rotation);
      canvas.width = size.w;
      canvas.height = size.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no context');
      paintGrade(ctx, img, size.w, size.h, grade, frame, asBw);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('no blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = source.kind === 'site' ? source.key : slug(upload?.name ?? 'photo');
      const lookSlug = look === 'custom' ? 'tweaked' : look;
      a.href = url;
      a.download = `posmitny-${base}-${lookSlug}${asBw ? '-bw' : ''}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Couldn’t save that one. Try again.');
    } finally {
      saving.current = false;
    }
  }

  function holdStart(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setComparing(true);
  }

  const stageLabel = comparing
    ? `${alt}. Original, without the grade.${picture}`
    : `${alt}. ${lookLabel}.${picture}`;

  return (
    <div className="fun-body">
      <div className="ed-film" ref={filmRef} role="group" aria-label="Choose a photo">
        {PHOTO_ORDER.map((key) => {
          const ph = PHOTOS[key];
          const on = source.kind === 'site' && source.key === key;
          return (
            <button key={key} type="button" className={on ? 'ed-thumb on' : 'ed-thumb'} aria-pressed={on} onClick={() => chooseSite(key)}>
              <span className="ed-pic"><img src={ph.src} alt="" width={ph.w} height={ph.h} draggable={false} /></span>
              <span className="ed-name">{shortName(ph.cap)}</span>
            </button>
          );
        })}
        {upload && (
          <button type="button" className={source.kind === 'upload' ? 'ed-thumb on' : 'ed-thumb'} aria-pressed={source.kind === 'upload'} onClick={() => { setSource({ kind: 'upload' }); setRotation(0); setFlip(false); }}>
            <span className="ed-pic"><img src={upload.url} alt="" draggable={false} /></span>
            <span className="ed-name">{upload.name}</span>
          </button>
        )}
        <label className="ed-add">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            aria-label={upload ? 'Replace your photo' : 'Upload your photo'}
            onChange={(e) => {
              takeFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <span className="ed-add-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
            {upload ? 'Replace' : 'Your photo'}
          </span>
        </label>
      </div>
      {error ? <p className="ed-error" role="alert">{error}</p> : null}

      <div className="ed-grid">
        <div className="ed-stage-wrap">
          <div
            className={drag ? 'ed-stage over' : 'ed-stage'}
            onDragEnter={(e) => {
              e.preventDefault();
              dragDepth.current += 1;
              setDrag(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDragLeave={() => {
              dragDepth.current -= 1;
              if (dragDepth.current <= 0) {
                dragDepth.current = 0;
                setDrag(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              dragDepth.current = 0;
              setDrag(false);
              takeFile(e.dataTransfer.files?.[0]);
            }}
          >
            <div className="ed-fit" ref={fitRef}>
              <canvas ref={canvasRef} role="img" aria-label={stageLabel} style={{ visibility: ready ? 'visible' : 'hidden' }} />
            </div>
            {!ready ? <p className="ed-loading">Loading the frame.</p> : null}
            {drag ? <div className="ed-drop">Drop the photo</div> : null}
            <div className="ed-frame">
              <button type="button" aria-label="Rotate left" onClick={() => setRotation((r) => (r + 270) % 360)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
              </button>
              <button type="button" aria-label="Rotate right" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
              </button>
              <button type="button" aria-label="Flip horizontally" aria-pressed={flip} onClick={() => setFlip((f) => !f)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v16" /><path d="M7 8L4 12l3 4M17 8l3 4-3 4" /></svg>
              </button>
            </div>
          </div>
          <p className="ed-cap">{comparing ? `${caption} · original` : caption}{bw ? ' · black and white' : ''}</p>
        </div>

        <aside className="card ed-panel" aria-label="Grade">
          <div className="stack" style={{ gap: 6 }}>
            <p className="eyebrow">grade</p>
            <h2 className="ed-kicker">Change the light.</h2>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <span className="ed-label">
              <span id="ed-view-label">View</span>
              <span className="muted">{bw ? 'Black and white' : 'Colour'}</span>
            </span>
            <div className="chips" role="group" aria-labelledby="ed-view-label">
              <button type="button" className={bw ? 'chip' : 'chip on'} aria-pressed={!bw} onClick={() => setBw(false)}>Colour</button>
              <button type="button" className={bw ? 'chip on' : 'chip'} aria-pressed={bw} onClick={() => setBw(true)}>B&amp;W</button>
            </div>
            <p id="ed-bw-note" className="ed-note">A view for the tones. Download keeps the colour.</p>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <span className="ed-label">
              <span>Looks</span>
              {look === 'custom' ? <span className="muted">Tweaked</span> : null}
            </span>
            <div className="chips">
              {LOOKS.map((l) => (
                <button key={l.id} type="button" className={look === l.id ? 'chip on' : 'chip'} aria-pressed={look === l.id} onClick={() => applyLook(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ed-sliders">
            {ADJUSTMENTS.map((a) => (
              <GradeSlider key={a.key} spec={a} value={grade[a.key]} onChange={(value) => setPart(a.key, value)} />
            ))}
          </div>
          <p className="ed-note">Double-click or double-tap a slider to reset it.</p>

          <div className="ed-actions">
            <button type="button" className="btn" onClick={() => download(false)} disabled={!ready}>Download</button>
            <button type="button" className="ed-ghost" onClick={() => download(true)} disabled={!ready}>Save as B&amp;W</button>
            <button
              type="button"
              className="ed-ghost"
              aria-pressed={comparing}
              onPointerDown={holdStart}
              onPointerUp={() => setComparing(false)}
              onPointerCancel={() => setComparing(false)}
              onBlur={() => setComparing(false)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setComparing(true);
                }
              }}
              onKeyUp={(e) => {
                if (e.key === ' ' || e.key === 'Enter') setComparing(false);
              }}
            >
              Hold to compare
            </button>
          </div>
          <div className="ed-foot">
            <span className="muted">A JPEG, made here. Nothing is uploaded.</span>
            <button type="button" className="ul link-btn" onClick={reset}>Reset</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
