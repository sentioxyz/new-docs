import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Sentio';

/**
 * Next.js prefixes links, redirects and assets with basePath; use it only for URLs it does
 * not (fetch calls, raw `<img>` in MDX, links in llms.txt).
 */
export { basePath } from './base-path.mjs';

/** Website home, on the same domain but outside basePath (see components/sentio-home-link.tsx) */
export const websiteHomeUrl = '/';

/** Empty because docs are served from the basePath root (`/<slug>`, `/reference/...`). */
export const docsRoute = '';
export const docsImageRoute = '/og';
export const docsContentRoute = '/llms.mdx';

/**
 * Top nav tabs; each maps to a `root: true` folder under content/docs.
 * `segment` is the tab's first URL segment ('' for Guides, which sits at the root).
 * Guides links straight to its first page (see also the redirects in next.config.mjs).
 * Absolute URLs are external tabs and open in a new tab.
 */
export const SENTIO_TABS = [
  { title: 'Guides', url: '/readme', segment: '' },
  { title: 'API Reference', url: '/reference', segment: 'reference' },
  { title: 'Changelog', url: '/changelog', segment: 'changelog' },
  { title: 'SDK Reference', url: 'https://sdk.sentio.xyz/' },
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
