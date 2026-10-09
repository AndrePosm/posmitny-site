'use client';

import { useRef, useState } from 'react';

type Pv = 'van' | 'brz' | null;

/** "Hi, I'm André" with a floating preview when you hover the project names. */
export function Intro() {
  const box = useRef<HTMLElement>(null);
  const pvEl = useRef<HTMLDivElement>(null);
  const [pv, setPv] = useState<Pv>(null);

  const move = (e: React.MouseEvent) => {
    const r = box.current?.getBoundingClientRect();
    const el = pvEl.current;
    if (!r || !el) return;
    const cw = el.offsetWidth || 320;
    let x = e.clientX - r.left + 22;
    const y = e.clientY - r.top + 26;
    if (x + cw > r.width - 8) x = e.clientX - r.left - cw - 22;
    el.style.left = Math.max(8, x) + 'px';
    el.style.top = y + 'px';
  };
  const open = (k: Pv) => (e: React.MouseEvent) => {
    move(e);
    setPv(k);
  };
  const hv = (k: Pv) => ({ onMouseEnter: open(k), onMouseMove: move, onMouseLeave: () => setPv(null) });

  return (
    <section ref={box} aria-labelledby="intro-title" className="wrap intro">
      <div className="stack gap-20" style={{ maxWidth: 560 }}>
        <p className="eyebrow">Hello there</p>
        <h1 id="intro-title" className="h1">Hi, I’m André.</h1>
        <p className="lead">
          I’m a <strong>product builder and founder</strong> with a frontend background who went all in on AI. I take products{' '}
          <strong>from a rough idea to something that works and people actually use</strong>: design, code, integrations and launch.
        </p>
        <p className="lead">
          Right now I’m building{' '}
          <a className="hv" href="#vanclaro" {...hv('van')}>Vanclaro Agents</a> and{' '}
          <a className="hv" href="#brizzy" {...hv('brz')}>Brizzy</a>.
        </p>
      </div>
      <div style={{ minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <div className="portrait">
          <div className="portrait-bg" />
          <img src="/img/andre-desert.webp" width={640} height={800} alt="Black and white selfie of André in a volcanic landscape on Fuerteventura" />
        </div>
      </div>
      <div ref={pvEl} className={pv ? 'pv on' : 'pv'} aria-hidden>
        {pv === 'van' && (
          <div style={{ width: 340, borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
            <img src="/img/vanclaro-hero.webp" alt="" style={{ width: '100%', aspectRatio: '1260 / 831', objectFit: 'cover', objectPosition: 'top center' }} />
          </div>
        )}
        {pv === 'brz' && (
          <div style={{ width: 170, borderRadius: 26, padding: 6, background: '#0E1016', boxShadow: '0 24px 60px rgba(0,0,0,.35)' }}>
            <img src="/img/brizzy-app.webp" alt="" style={{ width: '100%', aspectRatio: '720 / 1390', objectFit: 'cover', borderRadius: 20 }} />
          </div>
        )}
      </div>
    </section>
  );
}
