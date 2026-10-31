import type { Grade } from '@/content/fun';
import { renderJpeg } from './render';
import type { PhotoCrop } from './crop';
import type { Frame } from './paint';
import type { ExportPreset } from './presets';

type Job = {
  id: number;
  bitmap: ImageBitmap;
  srcW: number;
  srcH: number;
  grade: Grade;
  frame: Frame;
  bw: boolean;
  preset: ExportPreset;
  crop: PhotoCrop;
  panX: number;
  panY: number;
};

type Scope = {
  onmessage: ((event: MessageEvent<Job>) => void) | null;
  postMessage: (data: unknown) => void;
};

const scope = globalThis as unknown as Scope;

scope.onmessage = async (event) => {
  const job = event.data;
  try {
    const blob = await renderJpeg(
      job.bitmap,
      job.srcW,
      job.srcH,
      job.grade,
      job.frame,
      job.bw,
      job.preset,
      job.crop,
      job.panX,
      job.panY,
    );
    job.bitmap.close();
    scope.postMessage({ id: job.id, blob });
  } catch (error) {
    try { job.bitmap.close(); } catch { /* already detached */ }
    scope.postMessage({ id: job.id, error: error instanceof Error ? error.message : 'export failed' });
  }
};
