import type { Metadata } from 'next';
import { Editor } from '@/components/fun/Editor';
import { pageMeta } from '@/lib/seo';
import '@/styles/fun.css';

export const metadata: Metadata = pageMeta({
  title: 'Photo editor',
  description: 'A browser darkroom for the Fuerteventura photos, or a roll of your own. Match a reference, crop for a platform, and download JPEGs. Nothing is uploaded.',
  path: '/fun/photo-editor',
});

export default function PhotoEditorPage() {
  return (
    <main>
      <Editor />
    </main>
  );
}
