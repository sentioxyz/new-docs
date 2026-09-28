import fs from 'node:fs';
import { createMDX } from 'fumadocs-mdx/next';
import { basePath } from './lib/base-path.mjs';

const referenceSlugs = JSON.parse(fs.readFileSync('./scripts/reference-slugs.json', 'utf8'));
// ReadMe API tag pages that had content are the tag folders' intro pages (content/docs/api/<tag>/index.mdx)
const hasIntro = (tag) => fs.existsSync(`./content/docs/api/${tag}/index.mdx`);

/*
 * fumadocs-mdx compiles macro configs into temporary <outDir>/macro/<hash>.mjs
 * files and removes them right after import. On sandboxed filesystems that
 * unlink fails with EPERM; FUMADOCS_OUT_DIR moves them out of the project.
 */
const withMDX = createMDX({
  outDir: process.env.FUMADOCS_OUT_DIR || '.source',
});

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Mounted at www.sentio.xyz/docs (see lib/base-path.mjs)
  basePath,
  serverExternalPackages: ['shiki', '@shikijs/core'],
  /*
   * Turbopack's persistent build cache fails with EPERM on atomic rename in
   * sandboxed filesystems. Disabling it only slows the build down.
   */
  ...(process.env.NEXT_DISABLE_TURBO_CACHE === '1'
    ? { experimental: { turbopackFileSystemCacheForBuild: false } }
    : {}),
  // Allows a clean build when the previous output can't be removed
  distDir: process.env.NEXT_DIST_DIR || '.next',
  /*
   * Sources and destinations are relative to basePath. Guides pages sit at the root
   * (/docs/<slug> on the website); these cover the ReadMe URLs that are not pages here.
   */
  async redirects() {
    return [
      // Tab root opens its first page (keep in sync with SENTIO_TABS in lib/shared.ts)
      { source: '/', destination: '/readme', permanent: false },
      // Guides lived under /docs/<slug> on docs.sentio.xyz; tolerate the doubled prefix
      { source: '/docs', destination: '/readme', permanent: true },
      { source: '/docs/:slug*', destination: '/:slug*', permanent: true },
      // ReadMe folder pages that were empty, and a folder slug ReadMe kept with spaces
      { source: '/concepts', destination: '/abi', permanent: true },
      { source: '/solana-deprecated', destination: '/decode-solana-instructions', permanent: true },
      { source: '/visualizations', destination: '/dashboard', permanent: true },
      {
        source: '/:slug(Development%20and%20Testing|development%20and%20testing)',
        destination: '/development-and-testing',
        permanent: true,
      },
      // Empty ReadMe API tag pages (/reference/alerts, ...) -> their first endpoint
      ...Object.entries(referenceSlugs.tags)
        .filter(([tag]) => !hasIntro(tag))
        .map(([tag, slug]) => ({
          source: `/reference/${tag}`,
          destination: `/reference/${slug}`,
          permanent: false,
        })),
    ];
  },
};

export default withMDX(config);
