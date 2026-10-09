import { Footer } from '@/components/Footer';
import { Reveal } from '@/components/Reveal';
import { Scene } from '@/components/scene/Scene';
import { Intro } from '@/components/work/Intro';
import { BELIEFS, CHANGELOG, STACK } from '@/content/work';
import { LINKS } from '@/content/site';

export default function WorkPage() {
  return (
    <>
      <Scene />
      <main>
        <Intro />

        {/* How I build */}
        <Reveal as="section" aria-labelledby="how-title" className="wrap split pt-section">
          <div className="ray" aria-hidden />
          <div className="rise stack gap-16">
            <p className="eyebrow">How I build</p>
            <h2 id="how-title" className="h2">AI isn’t the future anymore. It’s already here.</h2>
            <p className="muted measure">It arrived faster than I expected and pulled me in from every side. Speed, practice, results and unconventional solutions: that’s what I’ve always enjoyed, and now I get to do it every day.</p>
          </div>
          <div className="stg" style={{ minWidth: 0 }}>
            {BELIEFS.map((b) => (
              <div key={b.title} className="belief">
                <b>{b.title}</b>
                <span className="muted">{b.body}</span>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="band">
          {/* Changelog */}
          <Reveal as="section" aria-labelledby="log-title" className="wrap split pt-section">
            <div className="rise stack gap-16" style={{ order: 2 }}>
              <p className="eyebrow">Personal changelog</p>
              <h2 id="log-title" className="h2">From Pascal to AI agents.</h2>
              <p className="muted measure">The short version of how I got here. Each step taught me something I still use.</p>
            </div>
            <ol className="stg l" style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 0, order: 1 }}>
              {CHANGELOG.map((c) => (
                <li key={c.v} className="cl">
                  <span className="cl-v">{c.v}</span>
                  <span>
                    <b>{c.title}</b> <span className="muted">{c.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>

          {/* Stack */}
          <Reveal as="section" aria-labelledby="stack-title" className="wrap split pt-section" style={{ alignItems: 'center' }}>
            <div className="rise stack gap-16">
              <p className="eyebrow">Stack</p>
              <h2 id="stack-title" className="h2">The tools behind Vanclaro and Brizzy.</h2>
              <p className="muted measure">From the interface to payments and ads. I run the digital marketing myself too: campaigns, A/B tests and the numbers behind them.</p>
            </div>
            <div className="code from-r" role="group" aria-label="My tech stack">
              <div className="code-bar">
                <span className="dot r" /><span className="dot y" /><span className="dot g" />
                <span className="file">stack.ts</span>
              </div>
              <div className="code-body stg">
                <span className="ln"><span className="k">export const</span> stack = {'{'}</span>
                {STACK.map((row) => (
                  <span key={row.key} className="ln">
                    {'  '}{(row.key + ':').padEnd(10, ' ')}[
                    {row.items.map((it, i) => (
                      <span key={it}>
                        <span className="st">&quot;{it}&quot;</span>
                        {i < row.items.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                    ],{row.note && <span className="cm"> // {row.note}</span>}
                  </span>
                ))}
                <span className="ln">{'};'}</span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Projects */}
        <section id="work" aria-labelledby="work-title" className="pt-section">
          <div className="wrap split" style={{ gap: '16px 96px', alignItems: 'end' }}>
            <div className="stack gap-12">
              <p className="eyebrow">Selected projects</p>
              <h2 id="work-title" className="h2-sm">What I’m building now.</h2>
            </div>
            <p className="muted measure" style={{ justifySelf: 'end' }}>Hands-on at every stage, from the first idea through design, code, payments and marketing.</p>
          </div>

          <Reveal id="vanclaro" className="project" style={{ paddingBlock: 'clamp(64px, 8vw, 120px)' }}>
            <div className="wrap project-grid">
              <div className="rise stack gap-14 project-copy">
                <p className="kicker" style={{ color: 'var(--accent)' }}>For businesses</p>
                <h3 className="h-project">Vanclaro Agents</h3>
                <p className="muted">Conversational AI agents for your website that don’t just talk, they act. They connect to your CRM and databases, book and follow up, and the same agent can work on the phone and in any chat channel too.</p>
                <ul className="arrows">
                  <li>Talks to website visitors by voice and chat</li>
                  <li>Connects to your CRM and databases to take real actions</li>
                  <li>Works across channels: website, phone and messaging</li>
                </ul>
                <p className="muted small">Co-founded with my brother Vasyl.</p>
                <a className="ul" href={LINKS.vanclaro} style={{ alignSelf: 'flex-start', fontWeight: 500, marginTop: 6 }}>Visit vanclaro.com</a>
              </div>
              <figure className="flow from-r" style={{ margin: 0, minWidth: 0 }}>
                <div className="blob" style={{ background: 'var(--tint-a)', borderRadius: '58% 42% 52% 48% / 46% 56% 44% 54%', padding: '9% 7%' }}>
                  <div className="browser">
                    <div className="browser-bar">
                      <span className="dot r" /><span className="dot y" /><span className="dot g" />
                      <span className="url">vanclaro.com</span>
                    </div>
                    <img src="/img/vanclaro-hero.webp" width={1260} height={831} alt="Vanclaro website: “Never miss a call again.” An AI reception that answers, asks the right questions and sends a ready job brief" style={{ width: '100%', height: 'auto', objectFit: 'cover', objectPosition: 'top center' }} />
                  </div>
                </div>
              </figure>
            </div>
          </Reveal>

          <Reveal id="brizzy" className="project" style={{ paddingBlock: 'clamp(48px, 7vw, 110px)' }}>
            <div className="wrap project-grid">
              <div className="from-l" style={{ minWidth: 0 }}>
                <div className="blob" style={{ background: 'var(--tint-b)', borderRadius: '44% 56% 48% 52% / 56% 44% 58% 42%', padding: '5%' }}>
                  <div className="phone">
                    <img src="/img/brizzy-app.webp" width={720} height={1390} alt="Brizzy app: a starry moon landscape, a glass bubble to start breathing and a meditating panda" />
                  </div>
                </div>
              </div>
              <div className="rise stack gap-14 project-copy">
                <p className="kicker" style={{ color: 'var(--pink)' }}>For people</p>
                <h3 className="h-project">Brizzy</h3>
                <p className="muted">An evidence-oriented breathwork app, built as a PWA. Guided patterns for sleep, energy and stress, a calm panda companion and streaks that keep the habit going. Shaped by more than fifteen years of my own practice.</p>
                <p className="muted small">Co-founded with my brother Vasyl.</p>
                <a className="ul" href={LINKS.brizzy} style={{ alignSelf: 'flex-start', fontWeight: 500, marginTop: 6 }}>Visit brizzy.app</a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Book a call */}
        <Reveal as="section" id="contact" aria-labelledby="contact-title" className="wrap split" style={{ paddingTop: 'clamp(110px, 12vw, 180px)', gap: '48px 96px', alignItems: 'center' }}>
          <div className="ray" aria-hidden />
          <div className="rise stack gap-18">
            <p className="eyebrow">Book a call</p>
            <h2 id="contact-title" style={{ fontSize: 'clamp(44px, 5.6vw, 80px)', lineHeight: 1 }}>Let’s talk.</h2>
            <p className="muted" style={{ maxWidth: '28em' }}>Open to partnerships, startup teams and product roles. Pick a time for a short intro call, or just write to me.</p>
            <p className="mono" style={{ marginTop: 6, fontSize: 'clamp(17px, 1.6vw, 21px)', overflowWrap: 'anywhere' }}>
              <a href={`mailto:${LINKS.email}`} style={{ textDecoration: 'none' }}>{LINKS.email}</a>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 30px', fontWeight: 500 }}>
              <a className="ul" href={LINKS.linkedin}>LinkedIn</a>
            </div>
          </div>
          <div className="card from-r stack gap-20">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img src="/img/andre-desert.webp" alt="" width={48} height={48} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
              <div className="stack">
                <span style={{ fontWeight: 600 }}>Intro call with André</span>
                <span className="mono muted" style={{ fontSize: 13 }}>15 min · video call</span>
              </div>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <span className="muted" style={{ fontSize: 14 }}>Pick any free slot, shown in your time zone</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} aria-hidden>
                {['09:30', '10:00', '13:30', '15:00', '16:30'].map((t) => (
                  <span key={t} className={t === '10:00' ? 'slot on' : 'slot'}>{t}</span>
                ))}
              </div>
            </div>
            <a className="btn" href={LINKS.cal}>Book a call <span className="arr" aria-hidden>→</span></a>
          </div>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
