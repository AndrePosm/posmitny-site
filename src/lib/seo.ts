import type { Metadata } from 'next';

type PageMeta = {
  title: string;
  description: string;
  path: string;
  /** The home title already includes the name, so the layout template must not run. */
  absoluteTitle?: boolean;
};

const NAME = 'André Posmitny';

/** Shared share-images. Nested routes replace Open Graph wholesale, so name them here. */
const OG_IMAGE = { url: '/opengraph-image.jpg', width: 1200, height: 630, type: 'image/jpeg' };
const TW_IMAGE = { url: '/twitter-image.jpg', width: 1200, height: 630, type: 'image/jpeg' };

/**
 * Document title, description, canonical and Open Graph for one route.
 * Open Graph titles are absolute: the layout template applies to the
 * document title only, not to `openGraph.title`.
 */
export function pageMeta({ title, description, path, absoluteTitle = false }: PageMeta): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${NAME}`;
  const heading = { absolute: fullTitle };
  return {
    title: absoluteTitle ? heading : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: NAME,
      locale: 'en',
      title: heading,
      description,
      url: path,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: heading,
      description,
      images: [TW_IMAGE],
    },
  };
}
