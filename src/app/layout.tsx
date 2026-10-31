import type { Metadata, Viewport } from 'next';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SiteProvider } from '@/components/SiteProvider';
import { HOME, SITE_URL } from '@/content/site';
import { MODE_BOOT_SCRIPT, modeCss } from '@/lib/modes';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: HOME.title, template: '%s · André Posmitny' },
  description: HOME.description,
  openGraph: { type: 'website', siteName: 'André Posmitny', locale: 'en', url: '/' },
  twitter: { card: 'summary_large_image' },
};

/** Visit any page with ?notrack=1 once on a device to exclude it from analytics (?notrack=0 undoes it). */
const NOTRACK_SCRIPT = `try{var m=location.search.match(/[?&]notrack=([01])/);if(m){if(m[1]==='1')localStorage.setItem('va-disable','true');else localStorage.removeItem('va-disable')}}catch(e){}`;

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="noon" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NOTRACK_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: MODE_BOOT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: modeCss() }} />
      </head>
      <body>
        <SiteProvider>{children}</SiteProvider>
        <Analytics />
      </body>
    </html>
  );
}
