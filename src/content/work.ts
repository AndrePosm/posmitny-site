// Copy for the Work page (English). Keep wording here so Swedish and Spanish can be added later.

export const BELIEFS = [
  { title: 'Agents are my teammates.', body: 'They write, test and review code with me every day. Honestly, it’s hard to imagine going back to writing everything by hand.' },
  { title: 'Ship small, learn fast.', body: 'I’m a practitioner. A working version in real hands first, polish after.' },
  { title: 'Feel comes first.', body: 'How does it feel, and does it do the job? A calm, simple interface can hold more craft than you notice at first glance.' },
  { title: 'Hard things, simple words.', body: 'In products and in conversation, I love explaining complex things briefly and clearly.' },
  { title: 'Done means useful.', body: 'A product isn’t ready until someone pays for it or it brings real value.' },
] as const;

export const CHANGELOG = [
  { v: 'v0.1 · 90s', title: 'First code.', body: 'QBasic and Turbo Pascal, at school and at home on computers my parents built.' },
  { v: 'v0.2 · 2000s', title: 'Gamer who automated everything.', body: 'Configuring bots like L2Walker for Lineage 2 and building in-game tools.' },
  { v: 'v0.3', title: 'Simple websites.', body: 'Dreamweaver and WordPress, always wanting to get back to real frontend.' },
  { v: 'v1.0 · 2018', title: 'Back, seriously.', body: 'Computer science foundations, JavaScript, TypeScript, Angular, then React. Grew from junior to mid-level frontend developer at EPAM.' },
  { v: 'v2.0 · 2022', title: 'ChatGPT arrives.', body: 'From the very first models I saw that this changes everything, and went all in on building my own products.' },
  { v: 'v3.0 · now', title: 'AI-native builder.', body: 'Two years of daily work with Cursor and Claude Code, plus image, video, music and voice generation. I know which model to use for which job, and the speed keeps climbing every week.' },
] as const;

export const STACK: { key: string; items: string[]; note?: string }[] = [
  { key: 'frontend', items: ['React', 'Next.js', 'TypeScript', 'Angular'] },
  { key: 'ai', items: ['Claude Code', 'Cursor', 'AI agents'] },
  { key: 'models', items: ['Claude', 'GPT', 'Gemini', 'Grok'], note: 'per task' },
  { key: 'voice', items: ['ElevenLabs', 'Twilio'] },
  { key: 'media', items: ['image', 'video', 'music'], note: 'generation' },
  { key: 'backend', items: ['Supabase', 'Vercel', 'Stripe'] },
  { key: 'design', items: ['Figma', 'Midjourney', 'Canva'] },
  { key: 'growth', items: ['Meta Ads', 'Google Ads', 'A/B testing'] },
];
