import { buildSkin, type Pt } from './skin/process';

type InMsg = {
  id: number;
  pixels: Uint8ClampedArray;
  w: number;
  h: number;
  faces: Pt[][];
};

type Scope = {
  onmessage: ((event: MessageEvent<InMsg>) => void) | null;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};

const scope = globalThis as unknown as Scope;

scope.onmessage = (event) => {
  const msg = event.data;
  try {
    const { mask, delta } = buildSkin(msg.pixels, msg.w, msg.h, msg.faces);
    scope.postMessage({ id: msg.id, mask, delta }, [mask.buffer, delta.buffer]);
  } catch (error) {
    scope.postMessage({ id: msg.id, error: error instanceof Error ? error.message : 'skin failed' });
  }
};
