'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useSite } from './SiteProvider';
import { Calendar, Instagram, LinkedIn, Moon, SoundOff, SoundOn, Sun } from './Icons';
import { FOOTER, LINKS, NAV } from '@/content/site';
import { Head } from './AndreHead';

/** Wave, a surfer who peeks out every few seconds, and the same links on every page. */
export function Footer() {
  const path = usePathname();
  const { music, toggleMusic, isNight, toggleNight } = useSite();
  const [peek, setPeek] = useState(false);
  const hover = useRef(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const loop = setInterval(() => {
      if (hover.current) return;
      setPeek(true);
      clearTimeout(t.current);
      t.current = setTimeout(() => !hover.current && setPeek(false), 4000);
    }, 11000);
    return () => {
      clearInterval(loop);
      clearTimeout(t.current);
    };
  }, []);

  const onEnter = () => {
    hover.current = true;
    clearTimeout(t.current);
    setPeek(true);
  };
  const onLeave = () => {
    hover.current = false;
    clearTimeout(t.current);
    t.current = setTimeout(() => setPeek(false), 3000);
  };

  return (
    <footer className="foot" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="foot-sky" aria-hidden>
        <div className="foot-sun" />
        <div className="peek-box">
          <Surfer up={peek} />
        </div>
        <svg className="peek-wave" viewBox="0 0 320 100" preserveAspectRatio="none">
          <path className="fill-t" d="M0 100 C60 100 80 46 160 40 C240 46 260 100 320 100 Z" />
        </svg>
        <svg className="foot-wave" viewBox="0 0 1440 150" preserveAspectRatio="none">
          <path className="fill-t" d="M0 96 C80 70 150 66 220 84 C260 94 280 112 320 110 C370 106 380 74 440 70 C520 64 560 96 640 98 C720 100 760 66 840 64 C920 62 960 92 1040 96 C1110 99 1150 76 1220 72 C1300 68 1380 88 1440 84 L1440 150 L0 150 Z" />
        </svg>
      </div>

      <div className="fbody">
        <div className="fcol fbrand">
          <span className="wordmark big">andre<span className="dim">.</span>posmitny</span>
          <span className="ital" style={{ fontSize: 21, color: 'var(--ink)' }}>{FOOTER.tagline}</span>
          <span style={{ maxWidth: '24em' }}>{FOOTER.blurb}</span>
        </div>
        <nav className="fcol" aria-label="Footer pages">
          <p className="fh">Pages</p>
          {NAV.map((n) => {
            const cur = n.href === '/' ? path === '/' : path?.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={cur ? 'fl cur' : 'fl'} aria-current={cur ? 'page' : undefined}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="fcol">
          <p className="fh">Projects</p>
          <a className="fl" href={LINKS.vanclaro}>Vanclaro Agents</a>
          <a className="fl" href={LINKS.brizzy}>Brizzy</a>
        </div>
        <div className="fcol">
          <p className="fh">Say hi</p>
          <a className="fl" href={LINKS.cal}>Book a call</a>
          <span className="mono" style={{ fontSize: 13.5, userSelect: 'all', overflowWrap: 'anywhere' }}>{LINKS.email}</span>
        </div>
      </div>

      <div className="fbot">
        <span className="fbot-l">
          <span>{FOOTER.copyright}</span>
          <span>
            Music: “Sunrise” by{' '}
            <a className="fl" href={LINKS.boosin} style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Boosin
            </a>
          </span>
        </span>
        <div className="ficons">
          <button type="button" className="fi" onClick={toggleMusic} aria-pressed={music} aria-label={music ? 'Turn the music off' : 'Play calm music: Sunrise by Boosin'} title="Music: “Sunrise” by Boosin">
            {music ? <SoundOn size={20} /> : <SoundOff size={20} />}
          </button>
          <a className="fi" href={LINKS.linkedin} aria-label="LinkedIn" title="LinkedIn"><LinkedIn /></a>
          <a className="fi" href={LINKS.instagram} aria-label="Instagram @andrefollowthesun" title="Instagram"><Instagram /></a>
          <a className="fi" href={LINKS.cal} aria-label="Book a call" title="Book a call"><Calendar /></a>
          <button type="button" className="fi" onClick={toggleNight} aria-label={isNight ? 'Switch to daytime' : 'Switch to night'} title="Theme">
            {isNight ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
    </footer>
  );
}

function Surfer({ up }: { up: boolean }) {
  return (
    <svg className={up ? 'peek up' : 'peek'} viewBox="100 0 180 152" width="166" height="140">
      <path d="M224 156 C208 96 214 40 242 4 C270 40 276 96 260 156 Z" style={{ fill: '#FFFFFF', stroke: 'rgba(0,0,0,.14)', strokeWidth: 1.5 }} />
      <path className="fill-t" d="M242 10 L242 156" style={{ fill: 'none', stroke: 'var(--accent)', strokeWidth: 3.5 }} />
      <path className="fill-t" d="M226 120 C236 116 248 116 258 120" style={{ fill: 'none', stroke: 'var(--pink)', strokeWidth: 3 }} />
      <Head />
    </svg>
  );
}
