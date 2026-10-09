import type { Metadata, Viewport } from 'next';
import '@fontsource/dm-serif-display/400.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import './globals.css';
import { SiteProvider } from '@/components/SiteProvider';
import { MODE_BOOT_SCRIPT, modeCss } from '@/lib/modes';

export const metadata: Metadata = {
  metadataBase: new URL('https://posmitny.com'),
  title: { default: 'André Posmitny · Product builder', template: '%s · André Posmitny' },
  description: 'André Posmitny is a product builder and founder. He takes products from a rough idea to something that works and people actually use. Building Vanclaro Agents and Brizzy.',
  openGraph: { type: 'website', siteName: 'André Posmitny', locale: 'en', url: '/' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="noon" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MODE_BOOT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: modeCss() }} />
      </head>
      <body>
        <SiteProvider>{children}</SiteProvider>
      </body>
    </html>
  );
}
