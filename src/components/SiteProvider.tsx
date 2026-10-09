'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { MODES, clockMode, isModeKey, type ModeKey } from '@/lib/modes';
import { installConsoleEgg } from '@/lib/consoleEgg';

type SiteState = {
  mode: ModeKey;
  setMode: (m: ModeKey | null) => void; // null = follow the visitor's clock
  isNight: boolean;
  toggleNight: () => void;
  music: boolean;
  toggleMusic: () => void;
};

const SiteContext = createContext<SiteState | null>(null);

export function useSite(): SiteState {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside <SiteProvider>');
  return ctx;
}

const STORE_KEY = 'pz-mode';

function readBootMode(): ModeKey {
  if (typeof document !== 'undefined') {
    const m = document.documentElement.getAttribute('data-mode');
    if (isModeKey(m)) return m;
  }
  return 'noon';
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  // Server render uses 'noon'; the boot script already painted the real mode, and we sync on mount.
  const [mode, setModeState] = useState<ModeKey>('noon');
  const lastDay = useRef<ModeKey>('noon');
  const [music, setMusic] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const fadeId = useRef(0);

  useEffect(() => {
    const m = readBootMode();
    setModeState(m);
    if (m !== 'night') lastDay.current = m;
  }, []);

  const apply = useCallback((m: ModeKey) => {
    const d = document.documentElement;
    d.setAttribute('data-mode', m);
    d.setAttribute('data-theme', MODES[m].dark ? 'dark' : 'light');
    if (m !== 'night') lastDay.current = m;
    setModeState(m);
  }, []);

  const setMode = useCallback(
    (m: ModeKey | null) => {
      try {
        if (m) sessionStorage.setItem(STORE_KEY, m);
        else sessionStorage.removeItem(STORE_KEY);
      } catch {}
      apply(m ?? clockMode());
    },
    [apply],
  );

  const toggleNight = useCallback(() => {
    setMode(mode === 'night' ? lastDay.current || 'noon' : 'night');
  }, [mode, setMode]);

  const fadeTo = useCallback((target: number, ms: number, done?: () => void) => {
    const a = audio.current;
    if (!a) return;
    const from = a.volume;
    const t0 = performance.now();
    const id = ++fadeId.current;
    const tick = () => {
      if (id !== fadeId.current) return;
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k < 1) requestAnimationFrame(tick);
      else done?.();
    };
    requestAnimationFrame(tick);
  }, []);

  const musicRef = useRef(music);
  musicRef.current = music;

  const toggleMusic = useCallback(() => {
    if (!audio.current) {
      audio.current = new Audio('/audio/sunrise.mp3');
      audio.current.loop = true;
      audio.current.preload = 'auto';
    }
    const a = audio.current;
    if (!musicRef.current) {
      a.volume = 0;
      a.play()
        .then(() => {
          setMusic(true);
          fadeTo(0.6, 2500);
        })
        .catch(() => setMusic(false));
    } else {
      setMusic(false);
      fadeTo(0, 1500, () => a.pause());
    }
  }, [fadeTo]);

  // Console easter egg: sun("golden"), music(), hire()
  const api = useRef({ setMode, toggleMusic, music: () => musicRef.current });
  api.current = { setMode, toggleMusic, music: () => musicRef.current };
  useEffect(() => installConsoleEgg(api), []);

  const value = useMemo(
    () => ({ mode, setMode, isNight: mode === 'night', toggleNight, music, toggleMusic }),
    [mode, setMode, toggleNight, music, toggleMusic],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}
