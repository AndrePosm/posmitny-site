'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { moveRect, resizeRect, type Crop, type CropHandle } from '../crop';

const HANDLES: CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type Drag = { handle: CropHandle; x: number; y: number; rect: Crop };

export function CropBox({
  rect,
  frameW,
  frameH,
  ratio,
  onChange,
}: {
  rect: Crop;
  frameW: number;
  frameH: number;
  ratio: number | null;
  onChange: (next: Crop) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  function point(event: ReactPointerEvent): { x: number; y: number } {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box || box.width < 1 || box.height < 1) return { x: 0, y: 0 };
    return {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
  }

  function onDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const at = point(event);
    const hit = (event.target as HTMLElement).closest<HTMLElement>('[data-h]');
    const inside = at.x >= rect.x && at.x <= rect.x + rect.w && at.y >= rect.y && at.y <= rect.y + rect.h;
    const handle = (hit?.dataset.h as CropHandle | undefined) ?? (inside ? 'move' : null);
    if (!handle) return;
    drag.current = { handle, x: at.x, y: at.y, rect: { ...rect } };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const at = point(event);
    if (start.handle === 'move') onChange(moveRect(start.rect, at.x - start.x, at.y - start.y));
    else onChange(resizeRect(start.rect, start.handle, at.x, at.y, ratio, frameW, frameH));
  }

  function onUp(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div
      ref={rootRef}
      className="dk-cropbox"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div
        className="dk-user-crop"
        role="application"
        aria-label="Crop"
        style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
      >
        <div className="dk-thirds" aria-hidden>
          <span /><span /><span /><span />
        </div>
        {HANDLES.map((handle) => (
          <i key={handle} data-h={handle} className={`dk-hnd dk-hnd-${handle}`} />
        ))}
      </div>
    </div>
  );
}
