import '@fontsource/dm-serif-display/400.css';
import '@fontsource/instrument-serif/400-italic.css';

/** Site chrome fonts. The darkroom route stays outside this group so it does not load them. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
