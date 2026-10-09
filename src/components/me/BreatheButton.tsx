'use client';

import { useSite } from '../SiteProvider';

export function BreatheButton() {
  const { music, toggleMusic } = useSite();
  return (
    <button type="button" className="bwm" onClick={toggleMusic} aria-pressed={music}>
      <span className="pd" aria-hidden>
        {music ? (
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1h2v8H2zM6 1h2v8H6z" fill="currentColor" /></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>
        )}
      </span>
      <span>{music ? 'Pause “Sunrise”' : 'Breathe with me · play “Sunrise”'}</span>
    </button>
  );
}
