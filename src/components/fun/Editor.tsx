'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ADJUSTMENTS, LOOKS, NEUTRAL_GRADE, matchLook, type Grade } from '@/content/fun';
import { aspectRatio, blankCrop, clampAngle, cropFractions, fitRatio, formatAngle, type CropAspectId, type PhotoCrop } from './crop';
import { exportJpeg } from './exportClient';
import { MAX_FILE, MAX_ROLL, isImage, loadImage, saveBlob, slug, stem } from './files';
import { matchToReference } from './match';
import { paintCropped, previewPixels, type Frame } from './paint';
import { blendedCanvas, peekSkin, prepareSkin, releaseSkin } from './skin';
import { EXPORTS, exportById, type ExportId } from './presets';
import { zipStore } from './zip';
import { GradeSlider } from './editor/Slider';
import {
  COLOUR_KEYS,
  DEFAULT_OPEN,
  EFFECT_KEYS,
  LIGHT_KEYS,
  OPEN_KEY,
  blankPhoto,
  clamp01,
  gradeDirty,
  readOpen,
  sameGrade,
  type PhotoState,
  type SecId,
} from './editor/model';
import { CropBox } from './editor/CropBox';
import { thumbKey, useLookThumbs } from './editor/useThumbs';

/** One sample so a shared link does not open André’s whole roll. */
const EXAMPLE_ID = 's:example';
const EXAMPLE = {
  src: '/img/me-volcano.webp',
  alt: 'A volcanic ridge glowing orange in evening light',
  w: 1024,
  h: 768,
};

const SPEC = Object.fromEntries(ADJUSTMENTS.map((item) => [item.key, item])) as Record<keyof Grade, (typeof ADJUSTMENTS)[number]>;
const SKIN_SPEC = {
  key: 'skin',
  label: 'Skin',
  min: 0,
  max: 100,
  hint: (value: number) => (value === 0 ? 'Off' : value < 34 ? 'Light' : value < 67 ? 'Soft' : 'Smooth'),
};
const TABS: SecId[] = ['looks', 'light', 'colour', 'effects', 'export'];
const TAB_LABEL: Record<SecId, string> = {
  looks: 'Looks',
  light: 'Light',
  colour: 'Colour',
  retouch: 'Retouch',
  effects: 'Effects',
  export: 'Export',
};

const SHORTCUTS: [string, string][] = [
  ['E', 'Export'],
  ['C', 'Crop'],
  ['R', 'Reset'],
  ['B', 'Black and white'],
  ['←  →', 'Previous or next photo'],
  ['\\', 'Before / after'],
  ['⌘/Ctrl C', 'Copy the style'],
  ['⌘/Ctrl V', 'Paste the style'],
  ['?', 'This cheat sheet'],
  ['Double-click', 'Reset a slider'],
  ['Shift + arrows', 'Nudge a slider by 10'],
];

let uploadSeq = 0;

function initialPhotos(): Record<string, PhotoState> {
  return { [EXAMPLE_ID]: blankPhoto() };
}

function isExample(id: string): boolean {
  return id === EXAMPLE_ID;
}

type Toast = { text: string; tone: 'ok' | 'err' };
type SkinNote = 'off' | 'loading' | 'ready' | 'empty' | 'error';
type MenuKind = 'sync' | 'export';
type Shot = { img: HTMLImageElement; src: string };

function IconRotate({ dir }: { dir: 'left' | 'right' }) {
  const left = dir === 'left';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {left ? <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> : <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />}
      {left ? <path d="M3 3v5h5" /> : <path d="M21 3v5h-5" />}
    </svg>
  );
}

function IconFlip() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v16" />
      <path d="M7 8 4 12l3 4M17 8l3 4-3 4" />
    </svg>
  );
}

function Section({
  id,
  title,
  shown,
  modified,
  status,
  onToggle,
  onReset,
  children,
}: {
  id: SecId;
  title: string;
  shown: boolean;
  modified?: boolean;
  status?: string;
  onToggle: () => void;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <section className={shown ? `dk-sec is-sheet` : 'dk-sec is-shut'} data-sec={id}>
      <div className="dk-h">
        <button type="button" className="dk-h-btn" aria-expanded={shown} onClick={onToggle}>
          {title}
          <svg className={shown ? 'dk-chev on' : 'dk-chev'} width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M4 2.2 7.6 6 4 9.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="dk-h-side">
          {modified ? <i className="dk-dot" title="Changed" /> : null}
          {status ? <span>{status}</span> : null}
          {onReset ? (
            <button type="button" className="dk-reset" aria-label={`Reset ${title}`} onClick={onReset}>↺</button>
          ) : null}
        </span>
      </div>
      <div className="dk-sec-body">
        <div className="dk-sec-in">{children}</div>
      </div>
    </section>
  );
}

/** Full-screen darkroom. Grades stay in the browser. */
export function Editor() {
  const [photos, setPhotos] = useState<Record<string, PhotoState>>(initialPhotos);
  const [uploads, setUploads] = useState<{ id: string; url: string; name: string }[]>([]);
  const [exampleOn, setExampleOn] = useState(true);
  const [cropMode, setCropMode] = useState(false);
  const [draft, setDraft] = useState<PhotoCrop>(blankCrop);
  const [activeId, setActiveId] = useState(EXAMPLE_ID);
  const [selection, setSelection] = useState<string[]>([EXAMPLE_ID]);
  const [bw, setBw] = useState(false);
  const [split, setSplit] = useState(false);
  const [splitX, setSplitX] = useState(0.5);
  const [comparing, setComparing] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState<'fit' | '100'>('fit');
  const [view, setView] = useState({ x: 0, y: 0 });
  const [presetId, setPresetId] = useState<ExportId>('full');
  const [pan, setPan] = useState({ x: 0.5, y: 0.5 });
  const [open, setOpen] = useState(DEFAULT_OPEN);
  const [storeReady, setStoreReady] = useState(false);
  const [sheet, setSheet] = useState<SecId | null>(null);
  const [skinNote, setSkinNote] = useState<SkinNote>('off');
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState<MenuKind | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 8 });
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState<'' | 'matching' | 'export'>('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [refOver, setRefOver] = useState(false);
  const [refGrade, setRefGrade] = useState<Grade | null>(null);
  const [matchName, setMatchName] = useState('');
  const [frameShot, setFrameShot] = useState<Shot | null>(null);
  const [mounted, setMounted] = useState(false);

  const photosRef = useRef(photos);
  const selectionRef = useRef(selection);
  const activeRef = useRef(activeId);
  const uploadsRef = useRef(uploads);
  const exampleRef = useRef(exampleOn);
  const cropModeRef = useRef(false);
  const draftRef = useRef(draft);
  const bwRef = useRef(bw);
  const splitRef = useRef(split);
  const splitXRef = useRef(splitX);
  const comparingRef = useRef(comparing);
  const zoomRef = useRef(zoom);
  const viewRef = useRef(view);
  const panRef = useRef(pan);
  const presetRef = useRef(presetId);
  const orderRef = useRef<string[]>([]);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const srcRef = useRef('');
  const fitRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shotRef = useRef<HTMLDivElement>(null);
  const filmRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLCanvasElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const helpCloseRef = useRef<HTMLButtonElement>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const rollInput = useRef<HTMLInputElement>(null);
  const anchor = useRef(activeId);
  const clip = useRef<Grade | null>(null);
  const raf = useRef(0);
  const aliveRef = useRef(true);
  const saving = useRef(false);
  const matching = useRef(false);
  const dragDepth = useRef(0);
  const toastTimer = useRef(0);
  const holdTimer = useRef(0);
  const hold = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const gesture = useRef<'none' | 'hold' | 'pan'>('none');
  const cropDrag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  activeRef.current = activeId;
  selectionRef.current = selection;
  uploadsRef.current = uploads;
  exampleRef.current = exampleOn;
  cropModeRef.current = cropMode;
  draftRef.current = draft;
  bwRef.current = bw;
  splitRef.current = split;
  splitXRef.current = splitX;
  comparingRef.current = comparing;
  zoomRef.current = zoom;
  viewRef.current = view;
  panRef.current = pan;
  presetRef.current = presetId;

  const orderedIds = (exampleOn ? [EXAMPLE_ID] : []).concat(uploads.map((item) => `u:${item.id}`));
  orderRef.current = orderedIds;
  const activePhoto = photos[activeId] ?? blankPhoto();
  const grade = activePhoto.grade;
  const frame: Frame = { rotation: activePhoto.rotation, flip: activePhoto.flip };
  const preset = exportById(presetId);
  const lookId = matchLook(grade);
  const refActive = !!refGrade && sameGrade(grade, refGrade) && lookId === 'custom';
  const lookMeta = LOOKS.find((look) => look.id === lookId);
  const lookStatus = lookId !== 'custom' ? (lookMeta?.label ?? 'Original') : refActive ? 'Ref' : 'Tweaked';
  const synced = orderedIds.filter((id) => photos[id] && sameGrade(photos[id].grade, grade)).length;
  const exportIds = selection.length ? orderedIds.filter((id) => selection.includes(id)) : (activeId ? [activeId] : []);
  const locked = busy !== '';
  const activeUpload = uploads.find((item) => `u:${item.id}` === activeId);
  const showingExample = exampleOn && activeId === EXAMPLE_ID;
  const activeSrc = showingExample ? EXAMPLE.src : (activeUpload?.url ?? '');
  srcRef.current = activeSrc;
  const activeName = showingExample ? 'Example' : (activeUpload?.name ?? (orderedIds.length ? 'Photo' : 'Add photos'));
  const activeAlt = showingExample ? EXAMPLE.alt : 'Your photo';
  const aspect = showingExample ? { w: EXAMPLE.w, h: EXAMPLE.h } : { w: 4, h: 3 };

  const thumbs = useLookThumbs(frameShot?.img ?? null, frameShot?.src ?? '', frame, bw, refGrade, activePhoto.crop ?? blankCrop());

  const paint = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const box = fitRef.current;
    const photo = photosRef.current[activeRef.current];
    if (!img?.naturalWidth || !canvas || !box || !photo) return;
    const rect = box.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rotation = photo.rotation;
    const swapped = ((rotation % 360) + 360) % 360 % 180 !== 0;
    const ow = swapped ? img.naturalHeight : img.naturalWidth;
    const oh = swapped ? img.naturalWidth : img.naturalHeight;
    const editing = cropModeRef.current;
    const live = editing ? draftRef.current : (photo.crop ?? blankCrop());
    const view = editing ? { ...live, x: 0, y: 0, w: 1, h: 1 } : live;
    const srcW = Math.max(1, ow * view.w);
    const srcH = Math.max(1, oh * view.h);
    let size: { w: number; h: number; cssW: number; cssH: number };
    if (!editing && zoomRef.current === '100') {
      const scale = Math.min(1, 4096 / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));
      size = { w, h, cssW: w / dpr, cssH: h / dpr };
    } else {
      size = previewPixels(srcW, srcH, 0, rect.width, rect.height, dpr);
    }
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    canvas.style.width = `${size.cssW}px`;
    canvas.style.height = `${size.cssH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const viewFrame = { rotation, flip: photo.flip };
    const mono = bwRef.current;
    const showOriginal = comparingRef.current;
    const graded = showOriginal || photo.skin <= 0 ? img : (blendedCanvas(srcRef.current, photo.skin) ?? img);
    const draw = (target: CanvasRenderingContext2D, nextGrade: Grade, black: boolean, source: CanvasImageSource) => {
      paintCropped(target, source, size.w, size.h, nextGrade, viewFrame, view, black);
    };
    if (showOriginal || !splitRef.current || editing) {
      draw(ctx, showOriginal ? NEUTRAL_GRADE : photo.grade, mono, showOriginal ? img : graded);
      return;
    }
    if (!beforeRef.current) beforeRef.current = document.createElement('canvas');
    const before = beforeRef.current;
    if (before.width !== size.w || before.height !== size.h) {
      before.width = size.w;
      before.height = size.h;
    }
    const bctx = before.getContext('2d');
    if (!bctx) return;
    draw(bctx, NEUTRAL_GRADE, mono, img);
    draw(ctx, photo.grade, mono, graded);
    const cut = Math.round(size.w * splitXRef.current);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cut, size.h);
    ctx.clip();
    ctx.drawImage(before, 0, 0);
    ctx.restore();
  }, []);

  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      if (!aliveRef.current) return;
      setPhotos(photosRef.current);
      paint();
    });
  }, [paint]);

  function patch(update: (cur: Record<string, PhotoState>) => Record<string, PhotoState>) {
    const next = update(photosRef.current);
    if (next === photosRef.current) return;
    photosRef.current = next;
    schedule();
  }

  function targetIds(): string[] {
    const sel = selectionRef.current;
    const id = activeRef.current;
    if (sel.includes(id) && sel.length) return sel;
    return [id];
  }

  function setKey(key: keyof Grade, value: number) {
    const ids = targetIds();
    patch((cur) => {
      let changed = false;
      const next = { ...cur };
      for (const id of ids) {
        const photo = next[id];
        if (!photo || photo.grade[key] === value) continue;
        changed = true;
        next[id] = { ...photo, grade: { ...photo.grade, [key]: value } };
      }
      return changed ? next : cur;
    });
  }

  function applyGrade(nextGrade: Grade) {
    const ids = targetIds();
    patch((cur) => {
      const next = { ...cur };
      for (const id of ids) {
        if (!next[id]) continue;
        next[id] = { ...next[id], grade: { ...nextGrade } };
      }
      return next;
    });
  }

  function setSkin(value: number) {
    const nextValue = Math.max(0, Math.min(100, Math.round(value)));
    const ids = targetIds();
    patch((cur) => {
      let changed = false;
      const next = { ...cur };
      for (const id of ids) {
        const photo = next[id];
        if (!photo || photo.skin === nextValue) continue;
        changed = true;
        next[id] = { ...photo, skin: nextValue };
      }
      return changed ? next : cur;
    });
  }

  function resetKeys(keys: readonly (keyof Grade)[]) {
    const ids = targetIds();
    patch((cur) => {
      const next = { ...cur };
      for (const id of ids) {
        const photo = next[id];
        if (!photo) continue;
        const nextGrade = { ...photo.grade };
        for (const key of keys) nextGrade[key] = NEUTRAL_GRADE[key];
        next[id] = { ...photo, grade: nextGrade };
      }
      return next;
    });
  }

  function resetAll() {
    const ids = targetIds();
    patch((cur) => {
      const next = { ...cur };
      for (const id of ids) {
        if (!next[id]) continue;
        next[id] = { ...next[id], grade: { ...NEUTRAL_GRADE }, rotation: 0, flip: false, skin: 0, crop: blankCrop() };
      }
      return next;
    });
    bwRef.current = false;
    setBw(false);
    splitRef.current = false;
    setSplit(false);
    comparingRef.current = false;
    setComparing(false);
    setPan({ x: 0.5, y: 0.5 });
    zoomRef.current = 'fit';
    setZoom('fit');
    setView({ x: 0, y: 0 });
    if (cropModeRef.current) {
      cropModeRef.current = false;
      setCropMode(false);
      const cleared = blankCrop();
      draftRef.current = cleared;
      setDraft(cleared);
    }
  }

  function updateDraft(next: PhotoCrop) {
    draftRef.current = next;
    setDraft(next);
    schedule();
  }

  function enterCrop() {
    const photo = photosRef.current[activeRef.current];
    if (!photo || !imgRef.current) return;
    const next = { ...(photo.crop ?? blankCrop()) };
    draftRef.current = next;
    setDraft(next);
    cropModeRef.current = true;
    setCropMode(true);
    splitRef.current = false;
    setSplit(false);
    zoomRef.current = 'fit';
    setZoom('fit');
    setView({ x: 0, y: 0 });
    schedule();
  }

  function commitCrop() {
    if (!cropModeRef.current) return;
    const id = activeRef.current;
    const next = { ...draftRef.current };
    cropModeRef.current = false;
    setCropMode(false);
    if (id) {
      patch((cur) => {
        const photo = cur[id];
        if (!photo) return cur;
        return { ...cur, [id]: { ...photo, crop: next } };
      });
    } else schedule();
  }

  function cancelCrop() {
    if (!cropModeRef.current) return;
    cropModeRef.current = false;
    setCropMode(false);
    schedule();
  }

  function resetCropDraft() {
    updateDraft(blankCrop());
  }

  function toggleCrop() {
    if (cropModeRef.current) commitCrop();
    else enterCrop();
  }

  function rotate(delta: number) {
    const id = activeRef.current;
    patch((cur) => {
      const photo = cur[id];
      if (!photo) return cur;
      return { ...cur, [id]: { ...photo, rotation: (photo.rotation + delta + 360) % 360 } };
    });
    setView({ x: 0, y: 0 });
  }

  function toggleFlip() {
    const id = activeRef.current;
    patch((cur) => {
      const photo = cur[id];
      if (!photo) return cur;
      return { ...cur, [id]: { ...photo, flip: !photo.flip } };
    });
  }

  function toggleBw() {
    const next = !bwRef.current;
    bwRef.current = next;
    setBw(next);
    schedule();
  }

  function toggleSplit() {
    const next = !splitRef.current;
    splitRef.current = next;
    setSplit(next);
    schedule();
  }

  function setZoomMode(next: 'fit' | '100') {
    zoomRef.current = next;
    setZoom(next);
    setView({ x: 0, y: 0 });
    schedule();
  }

  function flash(text: string, tone: Toast['tone'] = 'ok') {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), tone === 'err' ? 4200 : 2400);
  }

  function copyStyle() {
    const photo = photosRef.current[activeRef.current];
    if (!photo) return;
    clip.current = { ...photo.grade };
    flash('Style copied');
  }

  function pasteStyle() {
    if (!clip.current) return;
    applyGrade(clip.current);
    flash('Style pasted');
  }

  function step(dir: number) {
    if (cropModeRef.current) commitCrop();
    const ids = orderRef.current;
    if (!ids.length) return;
    const index = ids.indexOf(activeRef.current);
    setActiveId(ids[(index + dir + ids.length) % ids.length]);
  }

  function srcOf(id: string): string | undefined {
    if (isExample(id)) return exampleRef.current ? EXAMPLE.src : undefined;
    return uploadsRef.current.find((item) => `u:${item.id}` === id)?.url;
  }

  function baseOf(id: string): string {
    if (isExample(id)) return 'example';
    const item = uploadsRef.current.find((entry) => `u:${entry.id}` === id);
    return slug(item?.name ?? 'photo');
  }

  function hideExample() {
    if (!exampleRef.current) return;
    exampleRef.current = false;
    setExampleOn(false);
  }

  function dismissExample() {
    hideExample();
    setSelection((prev) => prev.filter((id) => !isExample(id)));
    if (activeRef.current === EXAMPLE_ID) {
      const first = uploadsRef.current[0];
      setActiveId(first ? `u:${first.id}` : '');
    }
  }

  async function runExport(ids: string[], asBw: boolean) {
    if (saving.current || !ids.length || !aliveRef.current) return;
    saving.current = true;
    setBusy('export');
    setMenu(null);
    setProgress({ done: 0, total: ids.length });
    const presetNow = exportById(presetRef.current);
    const panNow = panRef.current;
    try {
      const stored: { name: string; blob: Blob; data?: Uint8Array }[] = [];
      const used = new Set<string>();
      for (let i = 0; i < ids.length; i += 1) {
        if (!aliveRef.current) return;
        const id = ids[i];
        const photo = photosRef.current[id];
        const src = srcOf(id);
        if (!photo || !src) continue;
        setProgress({ done: i, total: ids.length });
        const img = await loadImage(src);
        let source: CanvasImageSource = img;
        if (photo.skin > 0) {
          try {
            await prepareSkin(src, img);
            source = blendedCanvas(src, photo.skin) ?? img;
          } catch {
            source = img;
          }
        }
        const blob = await exportJpeg(
          source,
          img.naturalWidth,
          img.naturalHeight,
          photo.grade,
          { rotation: photo.rotation, flip: photo.flip },
          asBw,
          presetNow,
          photo.crop ?? blankCrop(),
          panNow.x,
          panNow.y,
        );
        const lookSlug = matchLook(photo.grade) === 'custom' ? 'tweaked' : matchLook(photo.grade);
        const parts = [baseOf(id), lookSlug];
        if (asBw) parts.push('bw');
        if (presetNow.suffix) parts.push(presetNow.suffix);
        let stemName = parts.join('-');
        if (ids.length > 1) {
          if (used.has(stemName)) stemName = `${stemName}-${i + 1}`;
          used.add(stemName);
          const data = new Uint8Array(await blob.arrayBuffer());
          stored.push({ name: `${String(stored.length + 1).padStart(2, '0')}-${stemName}.jpg`, blob, data });
        } else {
          stored.push({ name: `posmitny-${stemName}.jpg`, blob });
        }
        if (aliveRef.current) setProgress({ done: i + 1, total: ids.length });
      }
      if (!stored.length) throw new Error('empty');
      if (stored.length === 1 && ids.length === 1) saveBlob(stored[0].blob, stored[0].name);
      else {
        const zipped = zipStore(stored.map((file) => ({ name: file.name, data: file.data ?? new Uint8Array() })));
        const copy = new Uint8Array(zipped.byteLength);
        copy.set(zipped);
        const lookSlug = matchLook(photosRef.current[activeRef.current]?.grade ?? NEUTRAL_GRADE);
        const slugLook = lookSlug === 'custom' ? 'tweaked' : lookSlug;
        const label = ids.every((id) => id.startsWith('u:')) ? 'roll' : 'island';
        const extra = presetNow.suffix ? `-${presetNow.suffix}` : '';
        const bwExtra = asBw ? '-bw' : '';
        saveBlob(new Blob([copy], { type: 'application/zip' }), `posmitny-${label}-${slugLook}${bwExtra}${extra}.zip`);
      }
      if (aliveRef.current) flash(`Exported ${stored.length} ✓`);
    } catch {
      if (aliveRef.current) flash(ids.length > 1 ? 'Couldn’t save the roll. Try again.' : 'Couldn’t save that one. Try again.', 'err');
    } finally {
      saving.current = false;
      if (aliveRef.current) {
        setBusy('');
        setProgress(null);
      }
    }
  }

  function syncSelected() {
    const ids = selectionRef.current;
    const photo = photosRef.current[activeRef.current];
    if (!ids.length || !photo) return;
    const nextGrade = { ...photo.grade };
    patch((cur) => {
      const next = { ...cur };
      for (const id of ids) {
        if (!next[id]) continue;
        next[id] = { ...next[id], grade: { ...nextGrade } };
      }
      return next;
    });
  }

  function onThumb(id: string, event: MouseEvent) {
    if (cropModeRef.current && id !== activeRef.current) commitCrop();
    const ids = orderRef.current;
    if (event.shiftKey) {
      const from = Math.max(0, ids.indexOf(anchor.current));
      const to = Math.max(0, ids.indexOf(id));
      const [lo, hi] = from < to ? [from, to] : [to, from];
      const range = ids.slice(lo, hi + 1);
      setSelection((prev) => Array.from(new Set([...prev, ...range])));
    } else if (event.metaKey || event.ctrlKey) {
      setSelection((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    }
    anchor.current = id;
    setActiveId(id);
  }

  function toggleSelected(id: string) {
    setSelection((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    anchor.current = id;
  }

  function takeFiles(list?: FileList | File[]) {
    if (!list || list.length === 0) return;
    const images = Array.from(list).filter(isImage);
    if (!images.length) {
      flash('That file isn’t a photo. Try a JPEG or PNG.', 'err');
      return;
    }
    if (images.some((file) => file.size > MAX_FILE)) {
      flash('That photo is too heavy. Try one under 25 MB.', 'err');
      return;
    }
    const room = MAX_ROLL - uploadsRef.current.length;
    if (room <= 0) {
      flash(`The roll holds ${MAX_ROLL} photos.`, 'err');
      return;
    }
    const accepted = images.slice(0, room);
    if (accepted.length < images.length) flash(`The roll holds ${MAX_ROLL} photos.`, 'err');
    const added = accepted.map((file) => {
      uploadSeq += 1;
      return { id: `u${uploadSeq}`, url: URL.createObjectURL(file), name: stem(file.name) };
    });
    const firstUpload = uploadsRef.current.length === 0;
    patch((cur) => {
      const next = { ...cur };
      for (const item of added) next[`u:${item.id}`] = blankPhoto();
      return next;
    });
    setUploads((prev) => [...prev, ...added]);
    const ids = added.map((item) => `u:${item.id}`);
    setActiveId(ids[0]);
    setSelection((prev) => (firstUpload ? ids : Array.from(new Set([...prev.filter((id) => !isExample(id)), ...ids]))));
    anchor.current = ids[0];
    hideExample();
  }

  function removeUpload(id: string) {
    const pid = `u:${id}`;
    const remaining = uploadsRef.current.filter((entry) => entry.id !== id);
    setUploads((prev) => {
      const item = prev.find((entry) => entry.id === id);
      if (item) {
        releaseSkin(item.url);
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((entry) => entry.id !== id);
    });
    patch((cur) => {
      if (!cur[pid]) return cur;
      const next = { ...cur };
      delete next[pid];
      return next;
    });
    setSelection((prev) => {
      const next = prev.filter((entry) => entry !== pid);
      if (remaining.length) return next;
      return exampleRef.current ? [EXAMPLE_ID] : [];
    });
    if (activeRef.current === pid) {
      if (remaining.length) setActiveId(`u:${remaining[0].id}`);
      else setActiveId(exampleRef.current ? EXAMPLE_ID : '');
    }
  }

  async function onReference(file: File | undefined) {
    if (!file || busy || matching.current || saving.current) return;
    if (!isImage(file)) {
      flash('That file isn’t a photo. Try a JPEG or PNG.', 'err');
      return;
    }
    const img = imgRef.current;
    if (!img?.naturalWidth) return;
    const url = URL.createObjectURL(file);
    matching.current = true;
    setBusy('matching');
    await new Promise((resolve) => window.setTimeout(resolve, 30));
    try {
      const ref = await loadImage(url);
      const current = photosRef.current[activeRef.current]?.grade ?? NEUTRAL_GRADE;
      const next = matchToReference(img, img.naturalWidth, img.naturalHeight, ref, ref.naturalWidth, ref.naturalHeight, current);
      setRefGrade({ ...next });
      setMatchName(stem(file.name));
      applyGrade(next);
    } catch {
      flash('Couldn’t read that reference.', 'err');
    } finally {
      URL.revokeObjectURL(url);
      matching.current = false;
      if (aliveRef.current) setBusy('');
    }
  }

  function choosePreset(id: ExportId) {
    setPresetId(id);
    setPan({ x: 0.5, y: 0.5 });
  }

  function toggleSection(id: SecId) {
    if (mobile && sheet === id) {
      setSheet(null);
      return;
    }
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openMenu(kind: MenuKind, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    setMenu((current) => (current === kind ? null : kind));
  }

  function moveSplit(clientX: number) {
    const shot = shotRef.current;
    if (!shot) return;
    const rect = shot.getBoundingClientRect();
    const next = clamp01((clientX - rect.left) / Math.max(1, rect.width));
    splitXRef.current = next;
    setSplitX(next);
    schedule();
  }

  const natural = imgRef.current;
  const orientedW = natural && frame.rotation % 180 !== 0 ? natural.naturalHeight : (natural?.naturalWidth ?? 1);
  const orientedH = natural && frame.rotation % 180 !== 0 ? natural.naturalWidth : (natural?.naturalHeight ?? 1);
  const liveCrop = cropMode ? draft : (activePhoto.crop ?? blankCrop());
  const framedW = orientedW * (cropMode ? 1 : liveCrop.w);
  const framedH = orientedH * (cropMode ? 1 : liveCrop.h);
  const presetWindow = !cropMode && preset.aspect != null && ready
    ? cropFractions(framedW, framedH, preset.aspect, pan.x, pan.y)
    : null;
  const cropRatio = aspectRatio(draft.aspect, orientedW, orientedH);
  const stageLabel = comparing
    ? `${activeAlt}. Original, without the grade.${bw ? ' Black and white.' : ''}`
    : `${activeAlt}. ${lookStatus}.${bw ? ' Black and white.' : ''}`;
  const exportLabel = progress ? `Exporting ${progress.done}/${progress.total}` : `Export ${exportIds.length}`;
  const fill = progress && progress.total ? progress.done / progress.total : 0;

  const api = useRef({
    exportSel: () => {},
    reset: () => {},
    toggleBw: () => {},
    toggleSplit: () => {},
    step: (_dir: number) => {},
    copy: () => {},
    paste: () => {},
    help: () => {},
    escape: () => {},
    toggleCrop: () => {},
    commitCrop: () => {},
    cancelCrop: () => {},
    resetCrop: () => {},
    helpOpen: false,
    menuOpen: false,
    cropOpen: false,
  });
  api.current = {
    exportSel: () => { void runExport(exportIds, false); },
    reset: resetAll,
    toggleBw,
    toggleSplit,
    step,
    copy: copyStyle,
    paste: pasteStyle,
    help: () => setHelp((value) => !value),
    escape: () => {
      if (help) setHelp(false);
      else if (cropMode) cancelCrop();
      else if (menu) setMenu(null);
      else if (sheet) setSheet(null);
    },
    toggleCrop,
    commitCrop,
    cancelCrop,
    resetCrop: resetCropDraft,
    helpOpen: help,
    menuOpen: menu !== null,
    cropOpen: cropMode,
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const straight = !!target?.closest('.dk-straight');
      if (target?.closest('input, textarea, [contenteditable="true"]') && !straight) return;
      if (!straight && target?.closest('[role="slider"], .dk-crop, .dk-user-crop, .dk-cropbox, .dk-split')) {
        if (event.key !== 'Escape' && event.key !== '?' && !(event.key === '/' && event.shiftKey)) return;
      }
      const ui = api.current;
      if (event.key === 'Escape') {
        ui.escape();
        return;
      }
      if (ui.helpOpen || ui.menuOpen) {
        if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
          event.preventDefault();
          ui.help();
        }
        return;
      }
      if (event.repeat && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === 'c') {
        if (window.getSelection()?.toString()) return;
        event.preventDefault();
        ui.copy();
        return;
      }
      if (meta && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        ui.paste();
        return;
      }
      if (meta || event.altKey) return;
      if (ui.cropOpen) {
        if (event.key === 'Enter' || event.key === 'c' || event.key === 'C') {
          event.preventDefault();
          ui.commitCrop();
        } else if (event.key === 'r' || event.key === 'R') {
          event.preventDefault();
          ui.resetCrop();
        }
        return;
      }
      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault();
        ui.exportSel();
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        ui.reset();
      } else if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        ui.toggleCrop();
      } else if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        ui.toggleBw();
      } else if (event.key === '\\') {
        event.preventDefault();
        ui.toggleSplit();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        ui.step(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        ui.step(1);
      } else if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        ui.help();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    setMounted(true);
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      aliveRef.current = false;
      root.style.overflow = prev;
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(holdTimer.current);
    };
  }, []);

  useEffect(() => {
    const box = fitRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => schedule());
    ro.observe(box);
    schedule();
    return () => ro.disconnect();
  }, [schedule]);

  useEffect(() => {
    if (!activeSrc) {
      imgRef.current = null;
      setFrameShot(null);
      setReady(false);
      return;
    }
    let cancel = false;
    setReady(false);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (cancel) return;
      imgRef.current = img;
      setFrameShot({ img, src: activeSrc });
      setReady(true);
      paint();
    };
    img.onerror = () => {
      if (cancel) return;
      flash(activeId.startsWith('u:') ? 'This browser couldn’t read that file. Try a JPEG or PNG.' : 'That photo didn’t load.', 'err');
    };
    img.src = activeSrc;
    return () => { cancel = true; };
    // flash is recreated each render; the load only depends on the source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSrc, paint]);

  useEffect(() => {
    setView({ x: 0, y: 0 });
  }, [activeId]);

  const skinOn = activePhoto.skin > 0;
  useEffect(() => {
    if (!skinOn || !frameShot || frameShot.src !== activeSrc) {
      setSkinNote('off');
      return;
    }
    let cancel = false;
    const known = peekSkin(activeSrc);
    setSkinNote(known === 'ready' ? 'ready' : known === 'empty' ? 'empty' : 'loading');
    prepareSkin(activeSrc, frameShot.img).then((entry) => {
      if (cancel) return;
      setSkinNote(entry.phase === 'empty' ? 'empty' : 'ready');
      schedule();
    }).catch(() => {
      if (!cancel) setSkinNote('error');
    });
    return () => { cancel = true; };
  }, [skinOn, activeSrc, frameShot, schedule]);

  useEffect(() => {
    const scroller = filmRef.current;
    const el = scroller?.querySelector<HTMLElement>('[data-active="true"]');
    if (!scroller || !el) return;
    const er = el.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    if (er.left < sr.left) scroller.scrollLeft -= sr.left - er.left + 8;
    else if (er.right > sr.right) scroller.scrollLeft += er.right - sr.right + 8;
  }, [activeId, uploads.length, exampleOn]);

  useEffect(() => () => {
    for (const item of uploadsRef.current) URL.revokeObjectURL(item.url);
  }, []);

  useEffect(() => {
    setOpen(readOpen());
    setStoreReady(true);
  }, []);

  useEffect(() => {
    if (!storeReady) return;
    localStorage.setItem(OPEN_KEY, JSON.stringify(open));
  }, [open, storeReady]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (event: globalThis.PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-menu-root]')) return;
      setMenu(null);
    };
    window.addEventListener('pointerdown', close, { passive: true });
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  useEffect(() => {
    if (help) helpCloseRef.current?.focus();
  }, [help]);

  function onCropDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!preset.aspect) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDrag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }

  function onCropMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = cropDrag.current;
    const canvas = canvasRef.current;
    if (!start || !canvas || preset.aspect == null) return;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const windowBox = cropFractions(cssW, cssH, preset.aspect, 0.5, 0.5);
    const slackX = cssW * (1 - windowBox.w / 100);
    const slackY = cssH * (1 - windowBox.h / 100);
    setPan({
      x: slackX > 1 ? clamp01(start.panX + (event.clientX - start.x) / slackX) : 0.5,
      y: slackY > 1 ? clamp01(start.panY + (event.clientY - start.y) / slackY) : 0.5,
    });
  }

  function onStageDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (cropModeRef.current) return;
    if (target.closest('.dk-crop, .dk-cropbox, .dk-cropbar, .dk-split, .dk-float, button, a, input, label')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    hold.current = { x: event.clientX, y: event.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
    gesture.current = 'none';
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      if (!hold.current || gesture.current === 'pan') return;
      gesture.current = 'hold';
      comparingRef.current = true;
      setComparing(true);
      schedule();
    }, 280);
  }

  function onStageMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = hold.current;
    if (!start) return;
    const dist = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (gesture.current === 'none' && dist > 8) {
      window.clearTimeout(holdTimer.current);
      if (zoomRef.current === '100') gesture.current = 'pan';
    }
    if (gesture.current === 'pan') {
      setView({ x: start.vx + (event.clientX - start.x), y: start.vy + (event.clientY - start.y) });
    }
  }

  function endHold() {
    window.clearTimeout(holdTimer.current);
    hold.current = null;
    if (gesture.current === 'hold') {
      comparingRef.current = false;
      setComparing(false);
      schedule();
    }
    gesture.current = 'none';
  }

  function lookSrc(id: string, sample: Grade): string {
    if (!frameShot) return '';
    return thumbs[thumbKey(frameShot.src, id, frame, bw, sample, activePhoto.crop ?? blankCrop())] ?? '';
  }

  const dirty: Record<SecId, boolean> = {
    looks: lookId !== 'original',
    light: gradeDirty(grade, LIGHT_KEYS),
    colour: gradeDirty(grade, COLOUR_KEYS),
    retouch: activePhoto.skin > 0,
    effects: gradeDirty(grade, EFFECT_KEYS) || (mobile && activePhoto.skin > 0),
    export: presetId !== 'full' || pan.x !== 0.5 || pan.y !== 0.5,
  };

  function shown(id: SecId): boolean {
    if (mobile && id === 'retouch') return false;
    if (mobile && sheet === id) return true;
    if (mobile) return false;
    return open[id];
  }

  const skinHint = skinNote === 'loading'
    ? 'Loading the skin model…'
    : skinNote === 'empty'
      ? 'No face detected'
      : skinNote === 'error'
        ? 'The skin model didn’t load.'
        : '';

  function skinFields() {
    return (
      <div data-skin={skinNote}>
        <GradeSlider spec={SKIN_SPEC} value={activePhoto.skin} neutral={0} onChange={setSkin} />
        {skinHint ? <p className="dk-hint" role="status">{skinHint}</p> : null}
      </div>
    );
  }

  return (
    <div className="dk">
      <header className="dk-bar">
        <div className="dk-bar-scroll">
          <h1 className="dk-brand"><Link href="/fun">Darkroom</Link></h1>
          <div className="dk-seg" role="group" aria-label="Colour or black and white">
            <button type="button" aria-pressed={!bw} onClick={() => { if (bw) toggleBw(); }}>Colour</button>
            <button type="button" aria-pressed={bw} aria-keyshortcuts="B" onClick={() => { if (!bw) toggleBw(); }}>B&amp;W</button>
          </div>
          <button type="button" className="dk-ghost" aria-pressed={split} aria-keyshortcuts="\\" aria-label="Before / after" onClick={toggleSplit}>
            <span className="dk-wide">Before / after</span>
            <span className="dk-narrow" aria-hidden>⇄</span>
          </button>
          <span className="dk-sp" />
          <p className="dk-lock" title="Photos are graded on this device">
            <span aria-hidden>🔒</span>
            <span className="dk-lock-text">Nothing is uploaded</span>
          </p>
          <button type="button" className="dk-icon" aria-label="Shortcuts" aria-keyshortcuts="?" onClick={() => setHelp(true)}>?</button>
          <button
            type="button"
            className="dk-ghost dk-match"
            disabled={locked}
            onClick={() => refInput.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); setRefOver(true); }}
            onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
            onDragLeave={() => setRefOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setRefOver(false);
              void onReference(event.dataTransfer.files?.[0]);
            }}
          >
            <span className="dk-wide">{busy === 'matching' ? 'Matching…' : 'Match reference'}</span>
            <span className="dk-narrow" aria-hidden>Ref</span>
          </button>
          <div className="dk-splitbtn" data-menu-root>
            <button type="button" className="dk-ghost dk-main" disabled={locked || selection.length === 0} onClick={syncSelected}>
              <span className="dk-wide">Sync to {selection.length}</span>
              <span className="dk-narrow">Sync {selection.length}</span>
            </button>
            <button type="button" className="dk-ghost dk-more" aria-label="Sync options" aria-expanded={menu === 'sync'} disabled={locked} onClick={(event) => openMenu('sync', event.currentTarget.parentElement ?? event.currentTarget)}>▾</button>
          </div>
        </div>
        <div className={`dk-splitbtn dk-go${progress ? ' is-busy' : ''}`} data-menu-root>
          <button type="button" className="dk-pri dk-main" aria-keyshortcuts="E" disabled={!ready || locked} onClick={() => { void runExport(exportIds, false); }}>
            <span className="dk-go-fill" style={{ transform: `scaleX(${fill})` }} />
            <span className="dk-go-label">{exportLabel}</span>
          </button>
          <button type="button" className="dk-pri dk-more" aria-label="Export presets" aria-expanded={menu === 'export'} disabled={locked} onClick={(event) => openMenu('export', event.currentTarget.parentElement ?? event.currentTarget)}>▾</button>
        </div>
      </header>

      <div
        className={`dk-stage${drag ? ' over' : ''}${cropMode ? ' is-crop' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setDrag(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={() => {
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDrag(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDrag(false);
          takeFiles(event.dataTransfer.files);
        }}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className={zoom === '100' ? 'dk-fit is-100' : 'dk-fit'} ref={fitRef}>
          <div
            className="dk-shot"
            ref={shotRef}
            style={zoom === '100' ? { transform: `translate(${view.x}px, ${view.y}px)` } : undefined}
          >
            <canvas ref={canvasRef} role="img" aria-label={stageLabel} style={{ visibility: ready ? 'visible' : 'hidden' }} />
            {showingExample && !cropMode ? <span className="dk-example">Example</span> : null}
            {cropMode ? (
              <CropBox
                rect={draft}
                frameW={orientedW}
                frameH={orientedH}
                ratio={cropRatio}
                onChange={(rect) => updateDraft({ ...draftRef.current, ...rect })}
              />
            ) : null}
            {presetWindow ? (
              <div
                className="dk-crop"
                role="application"
                tabIndex={0}
                aria-label="Crop frame. Drag to move it, or use the arrow keys."
                style={{ left: `${presetWindow.x}%`, top: `${presetWindow.y}%`, width: `${presetWindow.w}%`, height: `${presetWindow.h}%` }}
                onPointerDown={onCropDown}
                onPointerMove={onCropMove}
                onPointerUp={() => { cropDrag.current = null; }}
                onPointerCancel={() => { cropDrag.current = null; }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPan({ x: 0.5, y: 0.5 });
                }}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 0.08 : 0.03;
                  if (event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); setPan((prev) => ({ ...prev, x: clamp01(prev.x - step) })); }
                  else if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); setPan((prev) => ({ ...prev, x: clamp01(prev.x + step) })); }
                  else if (event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); setPan((prev) => ({ ...prev, y: clamp01(prev.y - step) })); }
                  else if (event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); setPan((prev) => ({ ...prev, y: clamp01(prev.y + step) })); }
                }}
              />
            ) : null}
            {split ? (
              <div
                className="dk-split"
                role="slider"
                tabIndex={0}
                aria-label="Before and after split"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(splitX * 100)}
                style={{ left: `${splitX * 100}%` }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  moveSplit(event.clientX);
                }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  moveSplit(event.clientX);
                }}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 0.1 : 0.02;
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    event.stopPropagation();
                    const value = clamp01(splitXRef.current + (event.key === 'ArrowLeft' ? -step : step));
                    splitXRef.current = value;
                    setSplitX(value);
                    schedule();
                  }
                }}
              />
            ) : null}
          </div>
        </div>
        {activeSrc && !ready ? <div className="dk-skel" style={{ aspectRatio: `${aspect.w} / ${aspect.h}` }} /> : null}
        {!orderedIds.length ? (
          <button type="button" className="dk-empty" onClick={() => rollInput.current?.click()}>
            <strong>+ Add photos</strong>
            <span>or drop them here</span>
          </button>
        ) : null}
        {drag ? <div className="dk-drop">Drop the photos</div> : null}
        {cropMode ? (
          <div className="dk-cropbar">
            <div className="dk-aspects" role="group" aria-label="Crop aspect">
              {(['free', 'original', '1:1', '4:5', '9:16', '16:9', '3:2'] as CropAspectId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={draft.aspect === id}
                  onClick={() => {
                    const ratio = aspectRatio(id, orientedW, orientedH);
                    const cur = draftRef.current;
                    const rect = ratio == null
                      ? { x: cur.x, y: cur.y, w: cur.w, h: cur.h }
                      : fitRatio(ratio, orientedW, orientedH, cur.x + cur.w / 2, cur.y + cur.h / 2);
                    updateDraft({ ...cur, ...rect, aspect: id });
                  }}
                >
                  {id === 'free' ? 'Free' : id === 'original' ? 'Original' : id}
                </button>
              ))}
            </div>
            <label className="dk-straight">
              <span>Straighten</span>
              <input
                type="range"
                min={-45}
                max={45}
                step={0.1}
                value={draft.angle}
                aria-label="Straighten"
                aria-valuetext={formatAngle(draft.angle)}
                onChange={(event) => updateDraft({ ...draftRef.current, angle: clampAngle(Number(event.target.value)) })}
                onDoubleClick={() => updateDraft({ ...draftRef.current, angle: 0 })}
                onKeyDown={(event) => {
                  const jump = event.shiftKey ? 1 : 0.1;
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    event.stopPropagation();
                    const dir = event.key === 'ArrowLeft' ? -1 : 1;
                    updateDraft({ ...draftRef.current, angle: clampAngle(draftRef.current.angle + dir * jump) });
                  }
                }}
              />
              <button type="button" className="dk-straight-val" onDoubleClick={() => updateDraft({ ...draftRef.current, angle: 0 })} aria-label="Reset straighten">
                {formatAngle(draft.angle)}
              </button>
            </label>
            <div className="dk-crop-actions">
              <button type="button" className="dk-ghost" onClick={cancelCrop}>Cancel</button>
              <button type="button" className="dk-ghost" onClick={resetCropDraft}>Reset</button>
              <button type="button" className="dk-pri" onClick={commitCrop}>Done</button>
            </div>
          </div>
        ) : (
          <div className="dk-float" role="toolbar" aria-label="Frame">
            <button type="button" aria-label="Rotate left" onClick={() => rotate(-90)}><IconRotate dir="left" /></button>
            <button type="button" aria-label="Rotate right" onClick={() => rotate(90)}><IconRotate dir="right" /></button>
            <button type="button" aria-label="Flip horizontally" aria-pressed={frame.flip} onClick={toggleFlip}><IconFlip /></button>
            <button type="button" aria-pressed={cropMode} aria-keyshortcuts="C" disabled={!ready} onClick={toggleCrop}>Crop</button>
            <button type="button" aria-pressed={zoom === 'fit'} onClick={() => setZoomMode('fit')}>Fit</button>
            <button type="button" aria-pressed={zoom === '100'} onClick={() => setZoomMode('100')}>100%</button>
          </div>
        )}
      </div>

      <aside className={sheet ? 'dk-panel on' : 'dk-panel'} aria-label="Grade" aria-busy={busy === 'matching'}>
        <Section
          id="looks"
          title="Looks"
          shown={shown('looks')}
          modified={dirty.looks}
          status={lookStatus}
          onToggle={() => toggleSection('looks')}
          onReset={() => applyGrade(NEUTRAL_GRADE)}
        >
          <div className="dk-looks">
            {LOOKS.map((look) => {
              const url = lookSrc(look.id, look.grade);
              const on = lookId === look.id;
              return (
                <button key={look.id} type="button" className={url ? 'dk-look' : 'dk-look is-empty'} aria-pressed={on} onClick={() => applyGrade(look.grade)}>
                  {url ? <img src={url} alt="" draggable={false} /> : null}
                  <span>{look.short}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={`dk-look${refGrade && !lookSrc('ref', refGrade) ? ' is-empty' : ''}${refOver ? ' over' : ''}`}
              aria-pressed={refActive}
              title={matchName ? `Matched to ${matchName}` : 'Match a reference photo'}
              onClick={() => { if (refGrade) applyGrade(refGrade); else refInput.current?.click(); }}
              onDragEnter={(event) => { event.preventDefault(); event.stopPropagation(); setRefOver(true); }}
              onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); }}
              onDragLeave={() => setRefOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setRefOver(false);
                void onReference(event.dataTransfer.files?.[0]);
              }}
            >
              {refGrade && lookSrc('ref', refGrade) ? <img src={lookSrc('ref', refGrade)} alt="" draggable={false} /> : null}
              <span>+ Ref</span>
            </button>
          </div>
          {matchName ? <p className="dk-hint">Matched to {matchName}. The sliders still move.</p> : null}
        </Section>

        <Section id="light" title="Light" shown={shown('light')} modified={dirty.light} onToggle={() => toggleSection('light')} onReset={() => resetKeys(LIGHT_KEYS)}>
          {LIGHT_KEYS.map((key) => (
            <GradeSlider key={key} spec={SPEC[key]} value={grade[key]} onChange={(value) => setKey(key, value)} />
          ))}
        </Section>
        <Section id="colour" title="Colour" shown={shown('colour')} modified={dirty.colour} onToggle={() => toggleSection('colour')} onReset={() => resetKeys(COLOUR_KEYS)}>
          {COLOUR_KEYS.map((key) => (
            <GradeSlider key={key} spec={SPEC[key]} value={grade[key]} onChange={(value) => setKey(key, value)} />
          ))}
        </Section>
        <Section id="retouch" title="Retouch" shown={shown('retouch')} modified={dirty.retouch} onToggle={() => toggleSection('retouch')} onReset={() => setSkin(0)}>
          {skinFields()}
        </Section>
        <Section id="effects" title="Effects" shown={shown('effects')} modified={dirty.effects} onToggle={() => toggleSection('effects')} onReset={() => { resetKeys(EFFECT_KEYS); if (mobile) setSkin(0); }}>
          {mobile ? skinFields() : null}
          {EFFECT_KEYS.map((key) => (
            <GradeSlider key={key} spec={SPEC[key]} value={grade[key]} onChange={(value) => setKey(key, value)} />
          ))}
        </Section>
        <Section
          id="export"
          title="Export preset"
          shown={shown('export')}
          modified={dirty.export}
          onToggle={() => toggleSection('export')}
          onReset={() => choosePreset('full')}
        >
          <div className="dk-seg dk-seg-wrap" role="group" aria-label="Export preset">
            {EXPORTS.map((item) => (
              <button key={item.id} type="button" aria-pressed={presetId === item.id} onClick={() => choosePreset(item.id)}>{item.label}</button>
            ))}
          </div>
          <p className="dk-hint">{preset.hint}</p>
        </Section>
      </aside>

      <footer className="dk-film">
        <p className="dk-count">{orderedIds.length === 0 ? 'No photos' : orderedIds.length === 1 ? '1 photo' : `${orderedIds.length} photos`} · {synced} synced</p>
        <div
          className="dk-film-row"
          ref={filmRef}
          role="group"
          aria-label="Photos"
          onWheel={(event) => {
            if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY;
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(event) => {
            event.preventDefault();
            takeFiles(event.dataTransfer.files);
          }}
        >
          {orderedIds.map((id) => {
            const upload = uploads.find((item) => `u:${item.id}` === id);
            const sample = isExample(id);
            const src = sample ? EXAMPLE.src : upload?.url;
            const name = sample ? 'Example' : (upload?.name ?? 'Photo');
            const current = id === activeId;
            const selected = selection.includes(id);
            if (!src) return null;
            return (
              <div key={id} className={`dk-cell${selected ? ' on' : ''}${current ? ' now' : ''}`} data-active={current ? 'true' : undefined}>
                <button type="button" className="dk-thumb" aria-current={current ? 'true' : undefined} aria-label={name} onClick={(event) => onThumb(id, event)}>
                  <img src={src} alt="" width={sample ? EXAMPLE.w : undefined} height={sample ? EXAMPLE.h : undefined} draggable={false} />
                </button>
                {sample ? <span className="dk-ex">Example</span> : null}
                <button type="button" className="dk-tick" aria-pressed={selected} aria-label={`Select ${name}`} onClick={() => toggleSelected(id)}><i /></button>
                {sample ? (
                  <button type="button" className="dk-x" aria-label="Remove example" onClick={dismissExample}>×</button>
                ) : null}
                {upload ? (
                  <button type="button" className="dk-x" aria-label={`Remove ${name}`} onClick={() => removeUpload(upload.id)}>×</button>
                ) : null}
              </div>
            );
          })}
          <label className="dk-add">
            <input
              ref={rollInput}
              className="dk-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              aria-label="Add photos"
              onChange={(event) => {
                takeFiles(event.target.files ?? undefined);
                event.target.value = '';
              }}
            />
            <span>+ Add photos</span>
          </label>
        </div>
      </footer>

      <div className="dk-tabs" role="tablist" aria-label="Adjustments">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sheet === id}
            className={sheet === id ? 'on' : undefined}
            onClick={() => setSheet((current) => (current === id ? null : id))}
          >
            {TAB_LABEL[id]}
            {dirty[id] ? <i className="dk-dot" /> : null}
          </button>
        ))}
      </div>

      {mobile && sheet ? <button type="button" className="dk-scrim" aria-label="Close panel" onClick={() => setSheet(null)} /> : null}
      <p className="dk-sr" aria-live="polite">{activeName}{bw ? ', black and white' : ''}</p>
      <input
        ref={refInput}
        className="dk-file"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        aria-label="Reference photo"
        onChange={(event) => {
          void onReference(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {toast ? (
        <div className={toast.tone === 'err' ? 'dk-toast err' : 'dk-toast'} role={toast.tone === 'err' ? 'alert' : 'status'}>{toast.text}</div>
      ) : null}

      {mounted && menu ? createPortal(
        <div className="dk-menu" role="menu" tabIndex={-1} ref={menuRef} data-menu-root style={{ top: menuPos.top, right: menuPos.right }}>
          {menu === 'export' ? (
            <>
              {EXPORTS.map((item) => (
                <button key={item.id} type="button" role="menuitemradio" aria-checked={presetId === item.id} onClick={() => { choosePreset(item.id); setMenu(null); }}>{item.label}</button>
              ))}
              <hr />
              <button type="button" role="menuitem" onClick={() => { setMenu(null); void runExport([activeId], false); }}>This photo</button>
              <button type="button" role="menuitem" onClick={() => { setMenu(null); void runExport([activeId], true); }}>Save as B&amp;W</button>
              {exportIds.length > 1 ? (
                <button type="button" role="menuitem" onClick={() => { setMenu(null); void runExport(exportIds, true); }}>Selected as B&amp;W</button>
              ) : null}
            </>
          ) : (
            <>
              <button type="button" role="menuitem" disabled={selection.length === 0} onClick={() => { syncSelected(); setMenu(null); }}>Sync grade to {selection.length}</button>
              <button type="button" role="menuitem" onClick={() => { setSelection(orderedIds.slice()); setMenu(null); }}>Select all</button>
              <button type="button" role="menuitem" onClick={() => { setSelection([]); setMenu(null); }}>Select none</button>
            </>
          )}
        </div>,
        document.body,
      ) : null}

      {mounted && help ? createPortal(
        <div
          className="dk-help"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setHelp(false); }}
        >
          <div
            className="dk-help-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dk-help-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setHelp(false);
                return;
              }
              if (event.key !== 'Tab') return;
              const items = event.currentTarget.querySelectorAll<HTMLElement>('button, a');
              if (!items.length) return;
              const first = items[0];
              const last = items[items.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <div className="dk-help-h">
              <h2 id="dk-help-title">Shortcuts</h2>
              <button ref={helpCloseRef} type="button" className="dk-icon" aria-label="Close shortcuts" onClick={() => setHelp(false)}>×</button>
            </div>
            <div className="dk-keys">
              {SHORTCUTS.map(([key, label]) => (
                <div key={key}>
                  <kbd>{key}</kbd>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <p className="dk-hint">Press and hold the photo to see it without the grade. Nothing leaves this device.</p>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
