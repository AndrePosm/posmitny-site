import { buildSkin, type Pt } from './skin/process';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MAX_EDGE = 2560;
const DETECT_EDGE = 720;
const MAX_CACHE = 4;

export type SkinPhase = 'idle' | 'ready' | 'empty';

type Entry = {
  phase: 'ready' | 'empty';
  w: number;
  h: number;
  src: Uint8ClampedArray | null;
  mask: Uint8Array | null;
  delta: Int16Array | null;
  canvas: HTMLCanvasElement | null;
  baked: number;
};

type WorkerReply = { id: number; mask?: Uint8Array; delta?: Int16Array; error?: string };

type Landmarker = {
  detect: (image: HTMLCanvasElement) => { faceLandmarks: { x: number; y: number }[][] };
  close?: () => void;
};

let landmarkerPromise: Promise<Landmarker> | null = null;
let forceCpu = false;
let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const waiters = new Map<number, { resolve: (value: { mask: Uint8Array; delta: Int16Array }) => void; reject: (error: Error) => void }>();
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();
const epoch = new Map<string, number>();
const recent: string[] = [];

export function peekSkin(src: string): SkinPhase {
  return cache.get(src)?.phase ?? 'idle';
}

export function releaseSkin(src: string) {
  epoch.set(src, (epoch.get(src) ?? 0) + 1);
  cache.delete(src);
  const index = recent.indexOf(src);
  if (index >= 0) recent.splice(index, 1);
}

export function blendedCanvas(src: string, amount: number): HTMLCanvasElement | null {
  const entry = cache.get(src);
  if (!entry || entry.phase !== 'ready' || !entry.src || !entry.mask || !entry.delta) return null;
  const amt = clamp(Math.round(amount), 0, 100);
  if (amt <= 0) return null;
  if (entry.canvas && entry.baked === amt) return entry.canvas;
  const { w, h } = entry;
  if (!entry.canvas) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    entry.canvas = canvas;
  }
  const ctx = entry.canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const base = entry.src;
  const mask = entry.mask;
  const delta = entry.delta;
  const gain = amt / 100;
  const count = w * h;
  for (let p = 0, o = 0, d = 0; p < count; p++, o += 4, d += 3) {
    const m = (mask[p] / 255) * gain;
    data[o] = clamp8(base[o] + delta[d] * m);
    data[o + 1] = clamp8(base[o + 1] + delta[d + 1] * m);
    data[o + 2] = clamp8(base[o + 2] + delta[d + 2] * m);
    data[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  entry.baked = amt;
  return entry.canvas;
}

/** Detect once, blur off the main thread, and keep the mask for later slider moves. */
export function prepareSkin(src: string, image: CanvasImageSource): Promise<Entry> {
  const hit = cache.get(src);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(src);
  if (pending) return pending;
  const token = epoch.get(src) ?? 0;
  const job = run(src, image, token).finally(() => {
    if (inflight.get(src) === job) inflight.delete(src);
  });
  inflight.set(src, job);
  return job;
}

async function run(src: string, image: CanvasImageSource, token: number): Promise<Entry> {
  const size = fitted(sourceSize(image), MAX_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, size.w, size.h);

  const faces = await detectFaces(image);
  if ((epoch.get(src) ?? 0) !== token) return emptyEntry(size.w, size.h);
  if (!faces.length) {
    const entry = emptyEntry(size.w, size.h);
    remember(src, entry);
    return entry;
  }

  const pixels = ctx.getImageData(0, 0, size.w, size.h).data;
  const base = new Uint8ClampedArray(pixels);
  let built: { mask: Uint8Array; delta: Int16Array };
  try {
    built = await smoothOffThread(new Uint8ClampedArray(pixels), size.w, size.h, faces);
  } catch {
    built = buildSkin(pixels, size.w, size.h, faces);
  }
  if ((epoch.get(src) ?? 0) !== token) return emptyEntry(size.w, size.h);
  const entry: Entry = {
    phase: built.mask.some((v) => v > 8) ? 'ready' : 'empty',
    w: size.w,
    h: size.h,
    src: base,
    mask: built.mask,
    delta: built.delta,
    canvas: null,
    baked: -1,
  };
  remember(src, entry);
  return entry;
}

function emptyEntry(w: number, h: number): Entry {
  return { phase: 'empty', w, h, src: null, mask: null, delta: null, canvas: null, baked: -1 };
}

function remember(src: string, entry: Entry) {
  cache.set(src, entry);
  const index = recent.indexOf(src);
  if (index >= 0) recent.splice(index, 1);
  recent.push(src);
  while (recent.length > MAX_CACHE) {
    const oldest = recent.shift();
    if (oldest && oldest !== src) cache.delete(oldest);
  }
}

async function detectFaces(image: CanvasImageSource): Promise<Pt[][]> {
  const marker = await getLandmarker();
  const size = fitted(sourceSize(image), DETECT_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no context');
  ctx.drawImage(image, 0, 0, size.w, size.h);
  let result: { faceLandmarks: { x: number; y: number }[][] };
  try {
    result = quiet(() => marker.detect(canvas));
  } catch (error) {
    if (forceCpu) throw error;
    forceCpu = true;
    landmarkerPromise = null;
    try { marker.close?.(); } catch { /* already closed */ }
    const cpu = await getLandmarker();
    result = quiet(() => cpu.detect(canvas));
  }
  return result.faceLandmarks
    .filter((face) => face.length >= 300)
    .map((face) => face.map((pt) => ({ x: pt.x, y: pt.y })));
}

function getLandmarker(): Promise<Landmarker> {
  if (!landmarkerPromise) landmarkerPromise = createLandmarker(forceCpu ? 'CPU' : 'GPU');
  return landmarkerPromise;
}

async function createLandmarker(delegate: 'GPU' | 'CPU'): Promise<Landmarker> {
  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
  const options = {
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: 'IMAGE' as const,
    numFaces: 8,
    outputFaceBlendshapes: false,
  };
  try {
    return await quietAsync(() => vision.FaceLandmarker.createFromOptions(fileset, options));
  } catch (error) {
    if (delegate === 'CPU') throw error;
    forceCpu = true;
    return quietAsync(() => vision.FaceLandmarker.createFromOptions(fileset, {
      ...options,
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
    }));
  }
}

/** MediaPipe writes status lines through console.error. They are not failures. */
function hush(): () => void {
  const prev = {
    error: console.error,
    warn: console.warn,
    log: console.log,
    info: console.info,
  };
  const noop = () => {};
  console.error = noop;
  console.warn = noop;
  console.log = noop;
  console.info = noop;
  return () => {
    console.error = prev.error;
    console.warn = prev.warn;
    console.log = prev.log;
    console.info = prev.info;
  };
}

function quiet<T>(fn: () => T): T {
  const restore = hush();
  try {
    return fn();
  } finally {
    restore();
  }
}

async function quietAsync<T>(fn: () => Promise<T>): Promise<T> {
  const restore = hush();
  try {
    return await fn();
  } finally {
    restore();
  }
}

function smoothOffThread(pixels: Uint8ClampedArray, w: number, h: number, faces: Pt[][]): Promise<{ mask: Uint8Array; delta: Int16Array }> {
  const thread = getWorker();
  if (!thread) return Promise.resolve(buildSkin(pixels, w, h, faces));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    waiters.set(id, { resolve, reject });
    try {
      thread.postMessage({ id, pixels, w, h, faces }, [pixels.buffer]);
    } catch (error) {
      waiters.delete(id);
      workerBroken = true;
      resolve(buildSkin(pixels, w, h, faces));
    }
  });
}

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./skin.worker.ts', import.meta.url));
  } catch {
    workerBroken = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    const pending = waiters.get(event.data.id);
    if (!pending) return;
    waiters.delete(event.data.id);
    if (event.data.mask && event.data.delta) pending.resolve({ mask: event.data.mask, delta: event.data.delta });
    else pending.reject(new Error(event.data.error || 'skin failed'));
  };
  worker.onerror = () => {
    workerBroken = true;
    worker?.terminate();
    worker = null;
    for (const pending of waiters.values()) pending.reject(new Error('worker'));
    waiters.clear();
  };
  return worker;
}

function sourceSize(image: CanvasImageSource): { w: number; h: number } {
  if (image instanceof HTMLImageElement) return { w: image.naturalWidth, h: image.naturalHeight };
  if (typeof HTMLVideoElement !== 'undefined' && image instanceof HTMLVideoElement) return { w: image.videoWidth, h: image.videoHeight };
  if ('width' in image && 'height' in image) return { w: Number(image.width), h: Number(image.height) };
  return { w: 1, h: 1 };
}

function fitted(size: { w: number; h: number }, edge: number): { w: number; h: number } {
  const long = Math.max(1, size.w, size.h);
  const scale = Math.min(1, edge / long);
  return { w: Math.max(1, Math.round(size.w * scale)), h: Math.max(1, Math.round(size.h * scale)) };
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function clamp8(n: number): number {
  if (n <= 0) return 0;
  if (n >= 255) return 255;
  return Math.round(n);
}
