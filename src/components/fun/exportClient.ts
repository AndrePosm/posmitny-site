import type { Grade } from '@/content/fun';
import type { Frame } from './paint';
import type { ExportPreset } from './presets';
import { renderJpeg } from './render';

type Job = {
  id: number;
  bitmap: ImageBitmap;
  srcW: number;
  srcH: number;
  grade: Grade;
  frame: Frame;
  bw: boolean;
  preset: ExportPreset;
  panX: number;
  panY: number;
};

type Reply = { id: number; blob?: Blob; error?: string };

let worker: Worker | null = null;
let failed = false;
let seq = 0;
const waiters = new Map<number, { resolve: (blob: Blob) => void; reject: (error: Error) => void }>();

function workerAvailable(): boolean {
  return !failed
    && typeof Worker !== 'undefined'
    && typeof OffscreenCanvas !== 'undefined'
    && typeof createImageBitmap === 'function';
}

function getWorker(): Worker | null {
  if (!workerAvailable()) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./export.worker.ts', import.meta.url));
  } catch {
    failed = true;
    return null;
  }
  worker.onmessage = (event: MessageEvent<Reply>) => {
    const pending = waiters.get(event.data.id);
    if (!pending) return;
    waiters.delete(event.data.id);
    if (event.data.blob) pending.resolve(event.data.blob);
    else pending.reject(new Error(event.data.error || 'export failed'));
  };
  worker.onerror = () => {
    failed = true;
    worker?.terminate();
    worker = null;
    for (const pending of waiters.values()) pending.reject(new Error('worker'));
    waiters.clear();
  };
  return worker;
}

function disable(thread: Worker | null) {
  failed = true;
  try { thread?.terminate(); } catch { /* already gone */ }
  if (worker === thread) worker = null;
}

/**
 * Encode one JPEG. Prefers a worker with OffscreenCanvas so the UI stays live,
 * and paints on the main thread when that path is missing or fails.
 */
export async function exportJpeg(
  img: CanvasImageSource,
  srcW: number,
  srcH: number,
  grade: Grade,
  frame: Frame,
  bw: boolean,
  preset: ExportPreset,
  panX: number,
  panY: number,
): Promise<Blob> {
  const onPage = () => renderJpeg(img, srcW, srcH, grade, frame, bw, preset, panX, panY);
  const thread = getWorker();
  if (!thread) return onPage();

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(img as ImageBitmapSource);
  } catch {
    return onPage();
  }

  const id = ++seq;
  try {
    return await new Promise<Blob>((resolve, reject) => {
      waiters.set(id, { resolve, reject });
      const message: Job = { id, bitmap, srcW, srcH, grade, frame, bw, preset, panX, panY };
      thread.postMessage(message, [bitmap]);
    });
  } catch {
    disable(thread);
    return onPage();
  }
}
