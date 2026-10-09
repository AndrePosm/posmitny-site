import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = { title: 'Fun' };

export default function Page() {
  return (
    <>
      <Header />
      <main className="wrap soon">
        <p className="eyebrow">fun</p>
        <h1 className="h1">Being rebuilt.</h1>
        <p className="lead measure">This page is moving from the design canvas into code. Meanwhile, see what I’m <Link className="ul" href="/">building now</Link>.</p>
      </main>
      <Footer />
    </>
  );
}
