import type { Metadata } from 'next';
import Link from 'next/link';
import { Reveal } from '@/components/Reveal';
import { HUB, TOPICS } from '@/content/fun';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Fun',
  description: 'A place to play: a photo darkroom for the Fuerteventura pictures is open, and games are on the way.',
  path: '/fun',
});

export default function FunPage() {
  return (
    <main aria-labelledby="fun-title">
      <div className="wrap fun-hub">
        <div className="fun-intro">
          <p className="eyebrow">{HUB.eyebrow}</p>
          <h1 id="fun-title" className="h1">{HUB.title}</h1>
          <p className="lead measure">{HUB.lead}</p>
        </div>
        <Reveal className="fun-topics">
          {TOPICS.map((topic) => {
            const media = (
              <span className={topic.image ? 'topic-media' : 'topic-media topic-media-empty'} aria-hidden>
                {topic.image ? <img src={topic.image.src} alt="" width={topic.image.w} height={topic.image.h} /> : <span className="topic-mark">{topic.mark}</span>}
              </span>
            );
            const copy = (
              <>
                {media}
                <p className={topic.status === 'live' ? 'topic-status live' : 'topic-status'}>{topic.label}</p>
                <h2 id={`topic-${topic.id}`} className="topic-title">{topic.title}</h2>
                <p id={`topic-${topic.id}-body`} className="muted">{topic.body}</p>
                {topic.status === 'live' ? (
                  <span className="topic-cta">{topic.cta} <span className="arr" aria-hidden>→</span></span>
                ) : null}
              </>
            );
            if (topic.status === 'live') {
              return (
                <Link key={topic.id} href={topic.href} className="card topic rise" aria-labelledby={`topic-${topic.id}`} aria-describedby={`topic-${topic.id}-body`}>
                  {copy}
                </Link>
              );
            }
            return (
              <article key={topic.id} className="card topic topic-soon rise" aria-labelledby={`topic-${topic.id}`} aria-describedby={`topic-${topic.id}-body`}>
                {copy}
              </article>
            );
          })}
        </Reveal>
      </div>
    </main>
  );
}
