/**
 * Where the site is mounted on the website domain (www.sentio.xyz/docs,
 * website-test.sentio.xyz/docs; see the Worker routes in wrangler.jsonc).
 * Used as the Next.js `basePath` and by the few URLs Next.js does not prefix itself.
 * Plain .mjs so next.config.mjs can import it.
 */
export const basePath = '/docs';
