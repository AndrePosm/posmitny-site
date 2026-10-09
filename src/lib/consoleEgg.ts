import type { RefObject } from 'react';
import { MODES, type ModeKey } from './modes';

type EggApi = {
  setMode: (m: ModeKey | null) => void;
  toggleMusic: () => void;
  music: () => boolean;
};

declare global {
  interface Window {
    __andreEgg?: boolean;
    sun?: (m?: string) => string;
    music?: () => string;
    hire?: () => string;
  }
}

const ALIAS: Record<string, ModeKey> = {
  midday: 'noon', noon: 'noon', day: 'noon',
  dawn: 'dawn', sunrise: 'dawn',
  golden: 'golden', sunset: 'golden',
  storm: 'storm', night: 'night',
};

export const CAL_URL = 'https://cal.com/andre-posmitny/15min';

export function installConsoleEgg(api: RefObject<EggApi>) {
  if (typeof window === 'undefined' || window.__andreEgg) return;
  window.__andreEgg = true;

  const sunArt = [
    '          \\    |    /',
    "        '.  .-\"\"\"-.  .'",
    '     ---   (       )   ---',
    "        .'  `-...-'  '.",
    '          /    |    \\',
  ].join('\n');
  const mono = 'font-family: ui-monospace, Menlo, Consolas, monospace;';
  try {
    console.log('%c' + sunArt, mono + 'color:#FF9F5A; font-size:13px; line-height:1.3');
    console.log('%cHey, fellow developer.', mono + 'font-size:15px; font-weight:bold; color:#FFD27A');
    console.log(
      "%cYou opened the console, so you're my kind of people.\nBuilt with a canvas sun, a lot of Claude Code and a little Cursor.",
      mono + 'color:#A2A8C6; line-height:1.6',
    );
    console.log(
      '%cTry:\n  sun("golden")   change the time of day  (dawn, midday, golden, storm, night)\n  music()         play "Sunrise" by Boosin\n  hire()          book a call with me',
      mono + 'color:#7FD4C6; line-height:1.7',
    );
  } catch {}

  window.sun = (m?: string) => {
    const k = ALIAS[String(m || '').toLowerCase()];
    if (!k) return 'Try: sun("dawn"), sun("midday"), sun("golden"), sun("storm") or sun("night")';
    api.current?.setMode(k);
    return 'The sky over Fuerteventura is now: ' + MODES[k].label.toLowerCase() + '.';
  };
  window.music = () => {
    const wasOn = api.current?.music();
    api.current?.toggleMusic();
    return wasOn ? 'Fading out. See you soon.' : 'Playing "Sunrise" by Boosin. Turn your sound on.';
  };
  window.hire = () => {
    let w: Window | null = null;
    try {
      w = window.open(CAL_URL, '_blank', 'noopener');
    } catch {}
    return w ? 'Opening my calendar. Talk soon!' : 'Book a call here: ' + CAL_URL;
  };
}
