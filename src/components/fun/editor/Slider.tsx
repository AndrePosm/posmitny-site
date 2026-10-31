'use client';

import { useEffect, useRef, useState } from 'react';
import { NEUTRAL_GRADE, type Grade } from '@/content/fun';
import { formatGradeValue, parseGradeValue } from './format';

type Spec = {
  key: string;
  label: string;
  min: number;
  max: number;
  hint: (value: number) => string;
};

function isGradeKey(key: string): key is keyof Grade {
  return Object.prototype.hasOwnProperty.call(NEUTRAL_GRADE, key);
}

function clamp(spec: Spec, value: number): number {
  return Math.max(spec.min, Math.min(spec.max, value));
}

function parsePlain(text: string, min: number, max: number): number | null {
  const cleaned = text.trim().replace(/−/g, '-').replace(/\s/g, '');
  if (!cleaned || cleaned === '+' || cleaned === '-') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** One grade row: label, bipolar track, editable number. Double-click or double-tap resets it. */
export function GradeSlider({ spec, value, onChange, neutral }: { spec: Spec; value: number; onChange: (value: number) => void; neutral?: number }) {
  const hitRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const moved = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [dragging, setDragging] = useState(false);

  valueRef.current = value;
  const fallback = neutral ?? (isGradeKey(spec.key) ? NEUTRAL_GRADE[spec.key] : 0);
  const span = spec.max - spec.min || 1;
  const pct = (value - spec.min) / span;
  const mid = spec.min < 0 ? (0 - spec.min) / span : 0;
  const fillLeft = (spec.min < 0 ? Math.min(pct, mid) : 0) * 100;
  const fillWidth = (spec.min < 0 ? Math.abs(pct - mid) : pct) * 100;
  const warm = spec.key === 'warmth';
  const shown = isGradeKey(spec.key) ? formatGradeValue(spec.key, value, spec.min) : (value === 0 ? '0' : String(value));

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function reset() {
    valueRef.current = fallback;
    onChange(fallback);
  }

  function fromClient(clientX: number) {
    const el = hitRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
    const next = clamp(spec, Math.round(spec.min + t * span));
    valueRef.current = next;
    onChange(next);
  }

  function nudge(delta: number) {
    const next = clamp(spec, valueRef.current + delta);
    valueRef.current = next;
    onChange(next);
  }

  function commitDraft() {
    const parsed = isGradeKey(spec.key)
      ? parseGradeValue(spec.key, draft, spec.min, spec.max)
      : parsePlain(draft, spec.min, spec.max);
    if (parsed !== null) {
      valueRef.current = parsed;
      onChange(parsed);
    }
    setEditing(false);
  }

  return (
    <div
      className="dk-sl"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.dk-val, .dk-numinput')) return;
        e.preventDefault();
        reset();
      }}
    >
      <span className="dk-sl-name" id={`dk-l-${spec.key}`}>{spec.label}</span>
      <div
        ref={hitRef}
        className={dragging ? 'dk-sl-hit dragging' : 'dk-sl-hit'}
        role="slider"
        tabIndex={0}
        aria-labelledby={`dk-l-${spec.key}`}
        aria-valuemin={spec.min}
        aria-valuemax={spec.max}
        aria-valuenow={value}
        aria-valuetext={spec.hint(value)}
        title="Double-click or double-tap to reset. Arrows change by 1, Shift by 10."
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          moved.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          fromClient(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          if (Math.hypot(e.movementX, e.movementY) > 0) moved.current = true;
          fromClient(e.clientX);
        }}
        onPointerUp={(e) => {
          setDragging(false);
          if (e.pointerType === 'mouse') return;
          if (moved.current) {
            lastTap.current = null;
            return;
          }
          const now = performance.now();
          const prev = lastTap.current;
          if (prev && now - prev.t < 350 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 32) {
            lastTap.current = null;
            reset();
            return;
          }
          lastTap.current = { t: now, x: e.clientX, y: e.clientY };
        }}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            nudge(-step);
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            nudge(step);
          } else if (e.key === 'Home') {
            e.preventDefault();
            e.stopPropagation();
            valueRef.current = spec.min;
            onChange(spec.min);
          } else if (e.key === 'End') {
            e.preventDefault();
            e.stopPropagation();
            valueRef.current = spec.max;
            onChange(spec.max);
          }
        }}
      >
        <div className={warm ? 'dk-tr is-warm' : 'dk-tr'}>
          {!warm && fillWidth > 0.15 ? <i className="dk-fill" style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }} /> : null}
          <b className="dk-knob" style={{ left: `${pct * 100}%` }} />
        </div>
      </div>
      {editing ? (
        <input
          ref={inputRef}
          className="dk-numinput"
          inputMode="decimal"
          aria-label={`Type ${spec.label}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="dk-val"
          aria-label={`Edit ${spec.label}, ${shown}`}
          onClick={() => {
            const raw = spec.key === 'exposure' ? (value / 100).toFixed(2) : String(Math.round(value));
            setDraft(raw);
            setEditing(true);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {shown}
        </button>
      )}
    </div>
  );
}

export type { Grade };
