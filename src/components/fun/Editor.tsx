'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ADJUSTMENTS, LOOKS, NEUTRAL_GRADE, matchLook, type Grade } from '@/content/fun';
import { PHOTOS, PHOTO_ORDER, type PhotoKey } from '@/content/me';
import { cropFractions } from './crop';
import { matchToReference } from './match';
import { paintGrade, previewPixels, type Frame } from './paint';
import { EXPORTS, exportById, type ExportId } from './presets';
import { renderJpeg } from './render';
import { zipStore } from './zip';

const START: PhotoKey = 'volcano';
const MAX_FILE = 25 * 1024 * 1024;
const MAX_ROLL = 12;

type Source = { kind: 'site'; key: PhotoKey } | { kind: 'upload'; id: string };
type Upload = { id: string; url: string; name: string };
type Adjustment = (typeof ADJUSTMENTS)[number];

let uploadSeq = 0;

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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function stem(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'Your photo';
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load'));
    img.src = src;
  });
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

/** Grade a frame from the island, or a roll of your own. Everything stays in the browser. */
export function Editor() {
  const [source, setSource] = useState<Source>({ kind: 'site', key: START });
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [grade, setGrade] = useState<Grade>(NEUTRAL_GRADE);
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState(false);
  const [bw, setBw] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [ready, setReady] = useState(false);
  const [drag, setDrag] = useState(false);
  const [refOver, setRefOver] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [presetId, setPresetId] = useState<ExportId>('full');
  const [pan, setPan] = useState({ x: 0.5, y: 0.5 });
  const [matchName, setMatchName] = useState('');
  const [busy, setBusy] = useState<'' | 'matching' | 'saving'>('');
  const [progress, setProgress] = useState('');

  const fitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const uploadsRef = useRef<Upload[]>([]);
  const dragDepth = useRef(0);
  const saving = useRef(false);
  const matching = useRef(false);
  const paintRef = useRef<() => void>(() => {});
  const cropDrag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const frame: Frame = { rotation, flip };
  const look = matchLook(grade);
  const upload = source.kind === 'upload' ? uploads.find((item) => item.id === source.id) : undefined;
  const caption = source.kind === 'site' ? PHOTOS[source.key].cap : (upload?.name ?? 'Your photo');
  const alt = source.kind === 'site' ? PHOTOS[source.key].alt : 'Your photo';
  const lookLabel = LOOKS.find((l) => l.id === look)?.label ?? 'Tweaked';
  const picture = bw ? ' Black and white.' : '';
  const preset = exportById(presetId);
  const activeSrc = source.kind === 'site' ? PHOTOS[source.key].src : upload?.url;
  const rollCount = uploads.length > 0 ? uploads.length : PHOTO_ORDER.length;

  const natural = imgRef.current;
  const orientedW = natural && rotation % 180 !== 0 ? natural.naturalHeight : (natural?.naturalWidth ?? 1);
  const orientedH = natural && rotation % 180 !== 0 ? natural.naturalWidth : (natural?.naturalHeight ?? 1);
  const crop = preset.aspect != null && ready ? cropFractions(orientedW, orientedH, preset.aspect, pan.x, pan.y) : null;

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
    if (!activeSrc) return;
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
    img.src = activeSrc;
    return () => {
      cancelled = true;
    };
  }, [activeSrc, source.kind]);

  useEffect(() => {
    const scroller = filmRef.current;
    const el = scroller?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!scroller || !el) return;
    const er = el.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    if (er.left < sr.left) scroller.scrollLeft -= sr.left - er.left + 8;
    else if (er.right > sr.right) scroller.scrollLeft += er.right - sr.right + 8;
  }, [source, uploads]);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => () => {
    for (const item of uploadsRef.current) URL.revokeObjectURL(item.url);
  }, []);

  function chooseSite(key: PhotoKey) {
    setSource({ kind: 'site', key });
    setRotation(0);
    setFlip(false);
    setError('');
  }

  function takeFiles(list: FileList | File[] | undefined) {
    if (!list || list.length === 0) return;
    const images = Array.from(list).filter(isImage);
    if (!images.length) {
      setError('That file isn’t a photo. Try a JPEG or PNG.');
      return;
    }
    if (images.some((file) => file.size > MAX_FILE)) {
      setError('That photo is too heavy. Try one under 25 MB.');
      return;
    }
    const room = MAX_ROLL - uploads.length;
    if (room <= 0) {
      setError(`The roll holds ${MAX_ROLL} photos.`);
      return;
    }
    const accepted = images.slice(0, room);
    setError(accepted.length < images.length ? `The roll holds ${MAX_ROLL} photos.` : '');
    const added = accepted.map((file) => {
      uploadSeq += 1;
      return { id: `u${uploadSeq}`, url: URL.createObjectURL(file), name: stem(file.name) };
    });
    setUploads((prev) => [...prev, ...added]);
    setSource({ kind: 'upload', id: added[0].id });
    setRotation(0);
    setFlip(false);
  }

  function removeUpload(id: string) {
    setUploads((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((entry) => entry.id !== id);
    });
    if (source.kind === 'upload' && source.id === id) {
      setSource({ kind: 'site', key: START });
      setRotation(0);
      setFlip(false);
    }
  }

  function applyLook(id: string) {
    const next = LOOKS.find((l) => l.id === id);
    if (!next) return;
    setGrade(next.grade);
    setMatchName('');
  }

  const setPart = useCallback((key: keyof Grade, value: number) => {
    setGrade((prev) => ({ ...prev, [key]: value }));
  }, []);

  function reset() {
    setGrade(NEUTRAL_GRADE);
    setRotation(0);
    setFlip(false);
    setBw(false);
    setPan({ x: 0.5, y: 0.5 });
    setMatchName('');
  }

  function choosePreset(id: ExportId) {
    setPresetId(id);
    setPan({ x: 0.5, y: 0.5 });
  }

  async function onReference(file: File | undefined) {
    if (!file || busy || matching.current || saving.current) return;
    if (!isImage(file)) {
      setError('That file isn’t a photo. Try a JPEG or PNG.');
      return;
    }
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    const url = URL.createObjectURL(file);
    matching.current = true;
    setBusy('matching');
    setError('');
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    try {
      const ref = await loadImage(url);
      const next = matchToReference(img, img.naturalWidth, img.naturalHeight, ref, ref.naturalWidth, ref.naturalHeight, grade);
      setGrade(next);
      setMatchName(stem(file.name));
    } catch {
      setError('Couldn’t read that reference.');
    } finally {
      URL.revokeObjectURL(url);
      matching.current = false;
      setBusy('');
    }
  }

  async function download(asBw: boolean) {
    const img = imgRef.current;
    if (!img?.naturalWidth || saving.current) return;
    saving.current = true;
    setBusy('saving');
    setProgress('');
    try {
      const blob = await renderJpeg(img, img.naturalWidth, img.naturalHeight, grade, frame, asBw, preset, pan.x, pan.y);
      const base = source.kind === 'site' ? source.key : slug(upload?.name ?? 'photo');
      const lookSlug = look === 'custom' ? 'tweaked' : look;
      const parts = [`posmitny-${base}-${lookSlug}`];
      if (asBw) parts.push('bw');
      if (preset.suffix) parts.push(preset.suffix);
      saveBlob(blob, `${parts.join('-')}.jpg`);
    } catch {
      setError('Couldn’t save that one. Try again.');
    } finally {
      saving.current = false;
      setBusy('');
    }
  }

  async function downloadAll() {
    if (saving.current) return;
    const items = uploads.length > 0
      ? uploads.map((item) => ({
          name: slug(item.name),
          src: item.url,
          frame: source.kind === 'upload' && source.id === item.id ? frame : { rotation: 0, flip: false },
          panX: pan.x,
          panY: pan.y,
        }))
      : PHOTO_ORDER.map((key) => ({
          name: key,
          src: PHOTOS[key].src,
          frame: source.kind === 'site' && source.key === key ? frame : { rotation: 0, flip: false },
          panX: pan.x,
          panY: pan.y,
        }));
    saving.current = true;
    setBusy('saving');
    setError('');
    try {
      const lookSlug = look === 'custom' ? 'tweaked' : look;
      const files: { name: string; data: Uint8Array }[] = [];
      const used = new Set<string>();
      for (let i = 0; i < items.length; i++) {
        setProgress(`Saving ${i + 1} of ${items.length}`);
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const img = await loadImage(items[i].src);
        const blob = await renderJpeg(img, img.naturalWidth, img.naturalHeight, grade, items[i].frame, false, preset, items[i].panX, items[i].panY);
        let name = items[i].name;
        if (used.has(name)) name = `${name}-${i + 1}`;
        used.add(name);
        const suffix = [lookSlug, preset.suffix].filter(Boolean).join('-');
        files.push({
          name: `${String(i + 1).padStart(2, '0')}-${name}-${suffix}.jpg`,
          data: new Uint8Array(await blob.arrayBuffer()),
        });
      }
      const zipped = zipStore(files);
      const copy = new Uint8Array(zipped.byteLength);
      copy.set(zipped);
      const label = uploads.length > 0 ? 'roll' : 'island';
      const extra = preset.suffix ? `-${preset.suffix}` : '';
      saveBlob(new Blob([copy], { type: 'application/zip' }), `posmitny-${label}-${lookSlug}${extra}.zip`);
    } catch {
      setError('Couldn’t save the roll. Try again.');
    } finally {
      saving.current = false;
      setBusy('');
      setProgress('');
    }
  }

  function holdStart(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setComparing(true);
  }

  function onCropDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!preset.aspect) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    cropDrag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }

  function onCropMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = cropDrag.current;
    const canvas = canvasRef.current;
    if (!start || !canvas || preset.aspect == null) return;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const window = cropFractions(cssW, cssH, preset.aspect, 0.5, 0.5);
    const slackX = cssW * (1 - window.w / 100);
    const slackY = cssH * (1 - window.h / 100);
    setPan({
      x: slackX > 1 ? clamp01(start.panX + (e.clientX - start.x) / slackX) : 0.5,
      y: slackY > 1 ? clamp01(start.panY + (e.clientY - start.y) / slackY) : 0.5,
    });
  }

  function onCropKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.08 : 0.03;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPan((prev) => ({ ...prev, x: clamp01(prev.x - step) }));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPan((prev) => ({ ...prev, x: clamp01(prev.x + step) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPan((prev) => ({ ...prev, y: clamp01(prev.y - step) }));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPan((prev) => ({ ...prev, y: clamp01(prev.y + step) }));
    }
  }

  const stageLabel = comparing
    ? `${alt}. Original, without the grade.${picture}`
    : `${alt}. ${lookLabel}.${picture}`;
  const locked = busy !== '';

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
        {uploads.map((item) => {
          const on = source.kind === 'upload' && source.id === item.id;
          return (
            <div key={item.id} className="ed-roll">
              <button type="button" className={on ? 'ed-thumb on' : 'ed-thumb'} aria-pressed={on} onClick={() => { setSource({ kind: 'upload', id: item.id }); setRotation(0); setFlip(false); }}>
                <span className="ed-pic"><img src={item.url} alt="" draggable={false} /></span>
                <span className="ed-name">{item.name}</span>
              </button>
              <button type="button" className="ed-x" aria-label={`Remove ${item.name}`} onClick={() => removeUpload(item.id)}>×</button>
            </div>
          );
        })}
        <label className="ed-add">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            aria-label={uploads.length ? 'Add photos' : 'Add your photos'}
            onChange={(e) => {
              takeFiles(e.target.files ?? undefined);
              e.target.value = '';
            }}
          />
          <span className="ed-add-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
            {uploads.length ? 'Add' : 'Your photos'}
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
              takeFiles(e.dataTransfer.files);
            }}
          >
            <div className="ed-fit" ref={fitRef}>
              <div className="ed-shot">
                <canvas ref={canvasRef} role="img" aria-label={stageLabel} style={{ visibility: ready ? 'visible' : 'hidden' }} />
                {crop ? (
                  <div
                    className="ed-crop"
                    role="application"
                    tabIndex={0}
                    aria-label="Crop frame. Drag to move it, or use the arrow keys."
                    style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.w}%`, height: `${crop.h}%` }}
                    onPointerDown={onCropDown}
                    onPointerMove={onCropMove}
                    onPointerUp={() => { cropDrag.current = null; }}
                    onPointerCancel={() => { cropDrag.current = null; }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      setPan({ x: 0.5, y: 0.5 });
                    }}
                    onKeyDown={onCropKey}
                  />
                ) : null}
              </div>
            </div>
            {!ready ? <p className="ed-loading">Loading the frame.</p> : null}
            {drag ? <div className="ed-drop">Drop the photos</div> : null}
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

        <aside className="card ed-panel" aria-label="Grade" aria-busy={locked}>
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

          <div className="stack" style={{ gap: 8 }}>
            <span className="ed-label">
              <span id="ed-ref-label">Reference</span>
              <span className="muted">{busy === 'matching' ? 'Matching' : 'Optional'}</span>
            </span>
            <label
              className={refOver ? 'ed-ref over' : 'ed-ref'}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setRefOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDragLeave={() => setRefOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setRefOver(false);
                onReference(e.dataTransfer.files?.[0]);
              }}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                aria-labelledby="ed-ref-label"
                disabled={locked}
                onChange={(e) => {
                  onReference(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {busy === 'matching' ? 'Matching the light…' : 'Match a photo'}
            </label>
            <p className="ed-note" aria-live="polite">
              {matchName ? `Matched to ${matchName}. The sliders still move.` : 'Drop a photo here to borrow its light.'}
            </p>
          </div>

          <div className="ed-sliders">
            {ADJUSTMENTS.map((a) => (
              <GradeSlider key={a.key} spec={a} value={grade[a.key]} onChange={(value) => setPart(a.key, value)} />
            ))}
          </div>
          <p className="ed-note">Double-click or double-tap a slider to reset it.</p>

          <div className="stack" style={{ gap: 8 }}>
            <span className="ed-label">
              <span id="ed-size-label">Export</span>
              <span className="muted">{preset.label}</span>
            </span>
            <div className="chips" role="group" aria-labelledby="ed-size-label">
              {EXPORTS.map((item) => (
                <button key={item.id} type="button" className={presetId === item.id ? 'chip on' : 'chip'} aria-pressed={presetId === item.id} onClick={() => choosePreset(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <p className="ed-note">{preset.hint}</p>
          </div>

          <div className="ed-actions">
            <button type="button" className="btn" onClick={() => download(false)} disabled={!ready || locked}>Download</button>
            <button type="button" className="ed-ghost" onClick={() => download(true)} disabled={!ready || locked}>Save as B&amp;W</button>
            <button type="button" className="ed-ghost" onClick={downloadAll} disabled={!ready || locked}>
              {progress || `Save all · ${rollCount}`}
            </button>
            <button
              type="button"
              className="ed-ghost"
              aria-pressed={comparing}
              disabled={locked}
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
            <span className="muted">
              {uploads.length > 0 ? 'Your photos, this grade, in colour.' : 'The island frames, this grade, in colour.'}
              {' '}Made here. Nothing is uploaded.
            </span>
            <button type="button" className="ul link-btn" onClick={reset}>Reset</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
