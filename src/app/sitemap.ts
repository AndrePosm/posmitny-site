import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/content/site';

const ROUTES = ['/', '/me', '/fun', '/fun/photo-editor'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: SITE_URL + (path === '/' ? '' : path),
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
