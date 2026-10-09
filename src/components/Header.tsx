'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSite } from './SiteProvider';
import { Moon, SoundOff, SoundOn, Sun } from './Icons';
import { NAV } from '@/content/site';

/** Same header on every page. `overlay` = white text on top of a picture or the scene. */
export function Header({ overlay = false }: { overlay?: boolean }) {
  const path = usePathname();
  const { music, toggleMusic, isNight, toggleNight } = useSite();

  return (
    <header className={overlay ? 'site-head overlay' : 'site-head'}>
      <div className="wrap site-head-in">
        <Link href="/" className="wordmark" aria-label="André Posmitny, home">
          andre<span className="dim">.</span>posmitny
        </Link>
        <nav aria-label="Main" className="site-nav">
          {NAV.map((n) => {
            const cur = n.href === '/' ? path === '/' : path?.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={cur ? 'navlink cur' : 'navlink'} aria-current={cur ? 'page' : undefined}>
                {n.label}
              </Link>
            );
          })}
          <button
            type="button"
            className="icon-btn"
            onClick={toggleMusic}
            aria-pressed={music}
            aria-label={music ? 'Turn the music off' : 'Play calm music: Sunrise by Boosin'}
            title="Music: “Sunrise” by Boosin"
          >
            {music ? <SoundOn /> : <SoundOff />}
          </button>
          <button type="button" className="icon-btn" onClick={toggleNight} aria-label={isNight ? 'Switch to daytime' : 'Switch to night'}>
            {isNight ? <Sun /> : <Moon />}
          </button>
        </nav>
      </div>
    </header>
  );
}
