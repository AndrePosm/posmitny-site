'use client';

import { useEffect, useRef, useState } from 'react';
import { useSite } from '../SiteProvider';
import { Header } from '../Header';
import { Close, Gear } from '../Icons';
import { Character } from './Character';
import { createSceneRenderer, type SceneSettings } from './renderer';
import { MODES, MODE_ORDER } from '@/lib/modes';

const DEFAULTS: SceneSettings = { swell: 45, wind: 30, rays: 50 };

/**
 * The Fuerteventura scene at the top of Work: canvas sky, sun rays that follow the cursor,
 * volcanoes, ocean swell, and André working on a rock. Colours follow the time-of-day mode.
 */
export function Scene() {
  const { mode, setMode } = useSite();
  const [settings, setSettings] = useState<SceneSettings>(DEFAULTS);
  const [panel, setPanel] = useState(false);

  const sceneRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const live = useRef({ mode, settings });
  live.current = { mode, settings };
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;
    const r = createSceneRenderer({ canvas, scene, avatar: () => avatarRef.current, get: () => live.current });
    redraw.current = r.redraw;
    return r.destroy;
  }, []);

  // Reduced motion draws only on change
  useEffect(() => redraw.current(), [mode, settings]);

  const sw = settings.swell;
  const wi = settings.wind;

  return (
    <section ref={sceneRef} className="scene" aria-label="André Posmitny, follow the sun" style={{ background: MODES[mode].skyBot }}>
      <canvas ref={canvasRef} aria-hidden className="scene-canvas" />
      <Header overlay />

      <div className="avatar-pos">
        <div ref={avatarRef} className="pop">
          <Character />
        </div>
        <button type="button" className="tune" onClick={() => setPanel((p) => !p)} aria-label="Change the conditions" aria-expanded={panel}>
          <Gear />
        </button>
      </div>

      <p className="scene-label">// {MODES[mode].label.toLowerCase()}</p>

      <svg aria-hidden viewBox="0 0 1440 120" preserveAspectRatio="none" className="scene-edge">
        <path d="M0 70 C90 46 170 44 250 62 C330 80 400 50 480 46 C580 42 640 72 740 70 C840 68 900 40 1000 42 C1100 44 1150 70 1250 66 C1340 62 1400 50 1440 52 L1440 120 L0 120 Z" style={{ fill: 'var(--page)', opacity: 0.45 }} />
        <path d="M0 90 C120 64 230 66 330 84 C430 102 520 74 620 72 C730 70 800 96 910 94 C1020 92 1080 70 1190 72 C1300 74 1370 92 1440 86 L1440 120 L0 120 Z" style={{ fill: 'var(--page)' }} />
      </svg>

      {panel && (
        <div role="dialog" aria-label="Conditions" className="cond">
          <div className="cond-head">
            <span className="stack">
              <span style={{ fontFamily: 'var(--serif)', fontSize: 23, lineHeight: 1.1 }}>Conditions</span>
              <span className="muted" style={{ fontSize: 14 }}>Any hour you like</span>
            </span>
            <button type="button" className="cond-x" onClick={() => setPanel(false)} aria-label="Close conditions">
              <Close />
            </button>
          </div>
          <div className="stack gap-12" style={{ gap: 8 }}>
            <span style={{ fontWeight: 600 }}>Time of day</span>
            <div className="chips">
              {MODE_ORDER.map((k) => (
                <button key={k} type="button" className={k === mode ? 'chip on' : 'chip'} aria-pressed={k === mode} onClick={() => setMode(k)}>
                  {MODES[k].label}
                </button>
              ))}
            </div>
          </div>
          <Range id="cond-swell" label="Swell" hint={sw < 25 ? 'Flat' : sw < 55 ? 'Waist high' : sw < 80 ? 'Overhead' : 'Big day'} value={sw} onChange={(v) => setSettings((s) => ({ ...s, swell: v }))} />
          <Range id="cond-wind" label="Wind" hint={wi < 20 ? 'Glassy' : wi < 50 ? 'Light breeze' : wi < 80 ? 'Trade winds' : 'Howling'} value={wi} onChange={(v) => setSettings((s) => ({ ...s, wind: v }))} />
          <Range id="cond-rays" label="Sun rays" hint={String(Math.round(24 + settings.rays * 0.4))} value={settings.rays} onChange={(v) => setSettings((s) => ({ ...s, rays: v }))} />
          <div className="cond-foot">
            <span className="muted" style={{ fontSize: 14 }}>Move your cursor. The sun follows you.</span>
            <button
              type="button"
              className="ul link-btn"
              onClick={() => {
                setSettings(DEFAULTS);
                setMode(null);
              }}
            >
              Match my clock
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Range({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="stack" style={{ gap: 4 }}>
      <label htmlFor={id} style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span className="muted" style={{ fontWeight: 500 }}>{hint}</span>
      </label>
      <input id={id} className="range" type="range" min={0} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
