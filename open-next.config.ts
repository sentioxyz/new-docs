import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

// Every page is prerendered at build time with no revalidation, so the cache is
// served read-only from Workers static assets (no R2/KV needed).
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  /*
   * Off because of basePath: the interceptor misses the per-segment prefetch data and answers
   * `Next-Router-Segment-Prefetch` requests with the full page RSC, which sends the client
   * router into an endless prefetch loop. Next.js serves the same cache entries itself.
   */
  enableCacheInterception: false,
});
