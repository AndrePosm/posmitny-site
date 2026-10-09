// Time-of-day modes. One source of truth for the canvas scene and the site's colour tokens.

export type ModeKey = 'dawn' | 'noon' | 'golden' | 'storm' | 'night';

export type Mode = {
  label: string;
  dark: boolean;
  // scene
  skyTop: string;
  skyBot: string;
  glow: string;
  sun: string;
  sunX: number;
  sunY: number;
  sunR: number;
  rayAlpha: number;
  rays: [string, string, string, string, string];
  volcBack: string;
  volcFront: string;
  oceanTop: string;
  oceanBot: string;
  lines: [string, string, string];
  rock: string;
  stars: number;
  clouds: number;
  // site tokens
  accent: string;
  pink: string;
  tintA: string;
  tintB: string;
  foot: string;
  sunCore: string;
  sunEdge: string;
};

export const MODES: Record<ModeKey, Mode> = {
  dawn: { label: 'Dawn', dark: false, skyTop: '#7A6AB6', skyBot: '#FFD0AE', glow: '#FFE3C2', sun: '#FFE7B6', sunX: 0.3, sunY: 0.74, sunR: 34, rayAlpha: 0.85, rays: ['#FFB38A', '#F79AA8', '#D2AEEA', '#FFD27D', '#F6A07B'], volcBack: '#9A84A6', volcFront: '#5E4B5C', oceanTop: '#B9C5E6', oceanBot: '#6F88BE', lines: ['#FFFFFF', '#E8D6F0', '#FFD6C2'], rock: '#3E3140', stars: 0, clouds: 0, accent: '#6A55B5', pink: '#C9506A', tintA: '#ECE7F7', tintB: '#FDE6DC', foot: '#EEE9F7', sunCore: '#FFF1D6', sunEdge: '#FFB38A' },
  noon: { label: 'Midday', dark: false, skyTop: '#1C5FC2', skyBot: '#9AD2F4', glow: '#FFFFFF', sun: '#FFF7DA', sunX: 0.44, sunY: 0.2, sunR: 38, rayAlpha: 0.9, rays: ['#FFD54A', '#FFE680', '#FFB547', '#FFF3B0', '#FF9F43'], volcBack: '#C98A55', volcFront: '#9A5634', oceanTop: '#3FC1C9', oceanBot: '#0B7894', lines: ['#E9FFFD', '#9BE7E6', '#FFFFFF'], rock: '#5E3020', stars: 0, clouds: 0, accent: '#1C5FC2', pink: '#BE4E27', tintA: '#E2EEFB', tintB: '#FBE7DA', foot: '#E1F3F6', sunCore: '#FFFBEA', sunEdge: '#FFD54A' },
  golden: { label: 'Golden hour', dark: false, skyTop: '#C9497A', skyBot: '#FFB45E', glow: '#FFD9A0', sun: '#FFE3A6', sunX: 0.86, sunY: 0.8, sunR: 42, rayAlpha: 0.9, rays: ['#FFD166', '#FF9F5A', '#FF6B8B', '#FFC2A0', '#FFE8B0'], volcBack: '#A3473A', volcFront: '#5A2722', oceanTop: '#8A5A9E', oceanBot: '#2C3A72', lines: ['#FFC08A', '#FF8FA3', '#FFE1B0'], rock: '#331716', stars: 0, clouds: 0, accent: '#B03A64', pink: '#C85F22', tintA: '#F8E3EA', tintB: '#FDE8D4', foot: '#FBEADF', sunCore: '#FFF0C8', sunEdge: '#FF9F5A' },
  storm: { label: 'Storm', dark: false, skyTop: '#2B3540', skyBot: '#8C9DA6', glow: '#C9D6DC', sun: '#E2EAED', sunX: 0.62, sunY: 0.26, sunR: 30, rayAlpha: 0.5, rays: ['#B5C7CF', '#DCE7EA', '#8EA5B0', '#F1F7F8', '#A3B8C1'], volcBack: '#4A4644', volcFront: '#2A2625', oceanTop: '#5E8288', oceanBot: '#25404A', lines: ['#C9DDE0', '#8FB3B8', '#FFFFFF'], rock: '#191615', stars: 0, clouds: 1, accent: '#2C6370', pink: '#8C5444', tintA: '#E3EBED', tintB: '#ECE4E0', foot: '#E3EAEC', sunCore: '#F2F6F7', sunEdge: '#A3B8C1' },
  night: { label: 'Night', dark: true, skyTop: '#060A20', skyBot: '#27316E', glow: '#3A4690', sun: '#F3F0E4', sunX: 0.24, sunY: 0.28, sunR: 26, rayAlpha: 0.42, rays: ['#C9D2FF', '#9AA8F0', '#E9ECFF', '#7F8BD6', '#B7C0FF'], volcBack: '#1C1F3C', volcFront: '#0E0F22', oceanTop: '#1B2457', oceanBot: '#090D2A', lines: ['#5866B8', '#8D9AE8', '#C9D2FF'], rock: '#07081A', stars: 1, clouds: 0, accent: '#AAB4FF', pink: '#FF9C7A', tintA: '#1D2347', tintB: '#3A2330', foot: '#141936', sunCore: '#F7F4EA', sunEdge: '#7F8BD6' },
};

export const MODE_ORDER: ModeKey[] = ['dawn', 'noon', 'golden', 'storm', 'night'];

export function isModeKey(v: unknown): v is ModeKey {
  return typeof v === 'string' && v in MODES;
}

/** CSS rules that recolour the site per mode. Rendered once in <head>. */
export function modeCss(): string {
  return MODE_ORDER.map((k) => {
    const m = MODES[k];
    return `html[data-mode="${k}"]{--accent:${m.accent};--pink:${m.pink};--tint-a:${m.tintA};--tint-b:${m.tintB};--foot:${m.foot};--sun-core:${m.sunCore};--sun-edge:${m.sunEdge};--sky:${m.skyBot}}`;
  }).join('\n');
}

/**
 * Runs before paint so the first frame already has the right colours.
 * Mode = manual choice from this session, otherwise the visitor's clock.
 */
export const MODE_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,m=null;try{m=sessionStorage.getItem('pz-mode')}catch(e){}
var ok={dawn:1,noon:1,golden:1,storm:1,night:1};
if(!ok[m]){var h=new Date().getHours();m=h>=5&&h<9?'dawn':h>=9&&h<17?'noon':h>=17&&h<21?'golden':'night'}
d.setAttribute('data-mode',m);d.setAttribute('data-theme',m==='night'?'dark':'light')}catch(e){}})();`;

export function clockMode(): ModeKey {
  const h = new Date().getHours();
  if (h >= 5 && h < 9) return 'dawn';
  if (h >= 9 && h < 17) return 'noon';
  if (h >= 17 && h < 21) return 'golden';
  return 'night';
}
