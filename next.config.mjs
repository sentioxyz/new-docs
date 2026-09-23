import { createMDX } from 'fumadocs-mdx/next';

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
  async redirects() {
    return [
      // Tab roots open their first page (keep in sync with SENTIO_TABS in lib/shared.ts)
      { source: '/', destination: '/guides/introduction/readme', permanent: false },
      { source: '/guides', destination: '/guides/introduction/readme', permanent: false },
      // Old ReadMe URLs (/docs/*, /reference/*) are redirected in proxy.ts
    ];
  },
};

export default withMDX(config);
