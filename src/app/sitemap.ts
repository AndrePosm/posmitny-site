import type { MetadataRoute } from 'next';

const BASE = 'https://posmitny.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/me', '/fun'].map((path) => ({ url: BASE + (path === '/' ? '' : path), changeFrequency: 'monthly', priority: path === '/' ? 1 : 0.7 }));
}
