import type { Metadata } from 'next';
import './me.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Reveal } from '@/components/Reveal';
import { Instagram } from '@/components/Icons';
import { DayGallery } from '@/components/me/DayGallery';
import { BreatheButton } from '@/components/me/BreatheButton';
import { LINKS } from '@/content/site';

export const metadata: Metadata = {
  title: 'Me',
  description: 'Follow the sun. Photography, breathwork and a day on Fuerteventura, André Posmitny’s place of power.',
};

export default function MePage() {
  return (
    <div className="me-page">
      {/* Cover */}
      <section className="hero" aria-labelledby="me-title">
        <img className="hero-img" src="/img/me-cofete.webp" width={1024} height={768} alt="Cofete beach and its mountains seen from above, Fuerteventura" />
        <Header overlay />
        <div className="wrap hero-in">
          <div className="stack gap-20" style={{ minWidth: 0 }}>
            <p className="eyebrow up" style={{ color: '#FFD3A8' }}>me</p>
            <h1 id="me-title" className="up" style={{ animationDelay: '.15s' }}>
              Follow
              <br />
              the <em>sun.</em>
            </h1>
            <p className="up hero-text" style={{ animationDelay: '.35s' }}>
              Fuerteventura is my place of power. For fifteen years I’ve gone back whenever I can, for the light, the ocean and a quieter head.
            </p>
            <a href={LINKS.instagram} className="ig up" style={{ animationDelay: '.5s' }}>
              <Instagram size={22} />
              <span>@andrefollowthesun</span>
            </a>
          </div>
          <div className="up hero-meta" style={{ animationDelay: '.7s' }}>
            <span className="meta">cofete · fuerteventura</span>
            <span className="meta cue">one day, dawn to night <i /></span>
          </div>
        </div>
      </section>

      <main>
        {/* What keeps me going */}
        <section aria-labelledby="love-title" style={{ background: 'var(--c-base)' }}>
          <Reveal className="wrap stack gap-20 love-wrap">
            <p id="love-title" className="eyebrow rise">what keeps me going</p>
            <p className="love rise">
              Chasing <em>light</em> with a camera, <em>breathwork</em> for more than fifteen years, <em>pull-ups</em> wherever I am, <em>surfing</em> when the swell is right <span className="soft">and, honestly,</span> <em>mowing the lawn</em> <span className="soft">at our summer house in Dalarna.</span>
            </p>
          </Reveal>
        </section>

        {/* Through my lens */}
        <section aria-labelledby="lens-title" style={{ background: 'var(--c-base)' }}>
          <Reveal className="wrap lens">
            <figure className="lens-ph from-l">
              <img src="/img/me-camera.webp" width={768} height={1024} alt="André photographing a sea of clouds from the edge of a cliff" loading="lazy" />
              <figcaption>above the clouds</figcaption>
            </figure>
            <div className="stack gap-20 rise">
              <p className="eyebrow">photography</p>
              <h2 id="lens-title" className="lens-h">Through my lens.</h2>
              <p className="lead measure">Photography and cameras have been part of my life since childhood. Lately the way I see keeps getting deeper and clearer: shapes, forms and the feeling of light that I didn’t notice before.</p>
              <p className="lead measure">No rush, just enjoying a journey that has always run through my life.</p>
              <p className="ital" style={{ fontSize: 'clamp(26px, 2.6vw, 36px)', lineHeight: 1.2 }}>The play of light.</p>
              <p className="mono muted" style={{ fontSize: 13, marginTop: 6 }}>↓ one day on the island, in the order the light comes</p>
            </div>
          </Reveal>
        </section>

        <DayGallery />

        {/* Night: inner work */}
        <section className="night" aria-labelledby="inner-title">
          <div className="stars" aria-hidden />
          <Reveal className="night-in" threshold={0.25}>
            <p className="tod ln1"><span className="tod-dot" /><span>night</span><span className="muted">inner work</span></p>
            <div className="ln1" style={{ width: '100%' }}>
              <div className="breath">
                <div className="glow" aria-hidden />
                <div className="ring" aria-hidden />
                <img src="/img/me-meditate-sq.webp" width={700} height={700} alt="André meditating cross-legged on the grass under a palm tree, the ocean behind him" loading="lazy" />
              </div>
              <div className="bcue" aria-hidden><span className="bi">breathe in</span><span className="bo">breathe out</span></div>
            </div>
            <h2 id="inner-title" className="ln2 inner-h">Looking inward.</h2>
            <p className="ln3 lead">A big part of my life happens away from the screen: meditation, reflection and slowly getting to know myself and how I see life.</p>
            <p className="ln4 lead">It started with breathwork more than fifteen years ago and grew into a daily practice of slowing down, noticing and asking better questions.</p>
            <p className="ln5 ital" style={{ marginTop: 8, fontSize: 'clamp(26px, 2.6vw, 34px)', lineHeight: 1.3 }}>Quiet mind, clear decisions.</p>
            <div className="ln5" style={{ marginTop: 18 }}><BreatheButton /></div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
