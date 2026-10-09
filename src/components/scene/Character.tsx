import { Head } from '../AndreHead';

/** André at his rock desk: black tee, headphones, laptop, coffee. */
export function Character() {
  return (
    <svg
      viewBox="0 0 320 300"
      role="img"
      aria-label="André as an illustrated character: black cap, sunglasses, over-ear headphones, a beard and a black t-shirt, working on a laptop set on a volcanic rock, with a cup of coffee beside it"
      style={{ width: '100%', overflow: 'visible' }}
    >
      <path d="M97 212 C93 236 99 258 112 274" fill="none" stroke="#E9BD98" strokeWidth="15" strokeLinecap="round" />
      <path d="M223 212 C227 236 221 258 208 274" fill="none" stroke="#EFC6A3" strokeWidth="15" strokeLinecap="round" />
      <path d="M95 222 C96 232 99 240 104 248" fill="none" stroke="#3E5A6E" strokeWidth="3" strokeLinecap="round" opacity=".75" />
      <circle cx="98" cy="229" r="3" fill="none" stroke="#3E5A6E" strokeWidth="1.6" opacity=".75" />
      <path d="M86 216 L87 186 C90 168 116 155 146 150 L174 150 C204 155 230 168 233 186 L234 216 L214 216 L214 292 L106 292 L106 216 Z" style={{ fill: '#16181D', stroke: 'var(--rim)', strokeWidth: 1.5, strokeLinejoin: 'round' }} />
      <path d="M146 149 Q160 157 174 149" fill="none" stroke="#2C2F36" strokeWidth="3" strokeLinecap="round" />
      <rect x="180" y="168" width="10" height="10" rx="1.5" fill="#D8B27A" />
      <path d="M102 198 L218 198 L225 286 L95 286 Z" fill="#C9CFD8" stroke="rgba(0,0,0,.08)" strokeWidth="1" />
      <circle cx="160" cy="240" r="7" fill="#EEF1F5" />
      <path d="M84 286 L236 286 L240 295 L80 295 Z" fill="#AAB2BE" />
      <path d="M262 268 L287 268 L284 295 L265 295 Z" fill="#F4F1EA" stroke="rgba(0,0,0,.12)" strokeWidth="1" />
      <path d="M287 274 C297 274 297 287 285 287" fill="none" stroke="#F4F1EA" strokeWidth="3.5" />
      <path d="M270 260 C266 254 274 250 270 244 M280 260 C276 254 284 250 280 244" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2" strokeLinecap="round" />
      <Head />
    </svg>
  );
}
