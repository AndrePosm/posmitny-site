import type { Metadata } from 'next';
import Link from 'next/link';
import { Editor } from '@/components/fun/Editor';
import { FUN } from '@/content/fun';
import { pageMeta } from '@/lib/seo';

export const metadata: Metadata = pageMeta({
  title: 'Photo editor',
  description: 'A browser darkroom for the Fuerteventura photos, or a photo of your own. Grade the light and download a JPEG. Nothing is uploaded.',
  path: '/fun/photo-editor',
});

export default function PhotoEditorPage() {
  return (
    <main aria-labelledby="photo-title">
      <div className="wrap">
        <div className="fun-intro">
          <p className="eyebrow">{FUN.eyebrow}</p>
          <h1 id="photo-title" className="h1">{FUN.title}</h1>
          <p className="lead measure">{FUN.lead}</p>
          <p className="mono muted fun-cross">
            <Link className="ul" href="/fun">Fun</Link>
            {' · the same day as on '}
            <Link className="ul" href="/me">Me</Link>, dawn to dusk.
          </p>
        </div>
        <Editor />
      </div>
    </main>
  );
}
