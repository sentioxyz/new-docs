import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Sentio';

/** Empty because docs are served from the site root (`/guides/...`). */
export const docsRoute = '';
export const docsImageRoute = '/og';
export const docsContentRoute = '/llms.mdx';

/**
 * Top nav tabs; each maps to a `root: true` folder under content/docs.
 * Guides links straight to its first page (see also the redirects in next.config.mjs).
 */
export const SENTIO_TABS = [
  { title: 'Guides', url: '/guides/introduction/readme' },
  { title: 'API Reference', url: '/api' },
  { title: 'Changelog', url: '/changelog' },
] as const;

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];

  return { segments, url: getContentUrl(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
