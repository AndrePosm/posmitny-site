import type { Metadata } from 'next';
import Link from 'next/link';
import './fun.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Editor } from '@/components/fun/Editor';
import { FUN } from '@/content/fun';

export const metadata: Metadata = {
  title: 'Fun',
  description: 'A small darkroom. Change the light on the Fuerteventura photos, or on one of your own, in the browser.',
};

export default function FunPage() {
  return (
    <div className="fun-page">
      <Header />
      <main aria-labelledby="fun-title">
        <div className="wrap">
          <div className="fun-intro">
            <p className="eyebrow">{FUN.eyebrow}</p>
            <h1 id="fun-title" className="h1">{FUN.title}</h1>
            <p className="lead measure">{FUN.lead}</p>
            <p className="mono muted fun-cross">The same day as on <Link className="ul" href="/me">Me</Link>, dawn to dusk.</p>
          </div>
          <Editor />
        </div>
      </main>
      <Footer />
    </div>
  );
}
