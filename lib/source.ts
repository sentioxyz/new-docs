import { llms, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { openapiPlugin, createOpenAPI } from 'fumadocs-openapi/server';
import { docsContentRoute, docsImageRoute, docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

/** content/docs root folder (sidebar tab) -> first URL segment, as on the old ReadMe site */
const TAB_ROUTES: Record<string, string> = {
  guides: 'docs',
  api: 'reference',
  changelog: 'changelog',
};

/**
 * Keep the ReadMe URLs: pages are flat under their tab (/docs/<slug>, /reference/<slug>,
 * /changelog/<slug>) while the folders only shape the sidebar. A slug is the file name, or
 * the folder name for a folder's index.mdx / overview.mdx; a tab's index.mdx is the tab root.
 */
function readmeSlugs(file: { path: string }): string[] | undefined {
  const segs = file.path.replace(/\.mdx?$/, '').split('/');
  const tab = TAB_ROUTES[segs[0]];
  if (!tab) return;
  const name = segs[segs.length - 1];
  if (name !== 'index' && name !== 'overview') return [tab, name];
  return segs.length === 2 ? [tab] : [tab, segs[segs.length - 2]];
}

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  slugs: readmeSlugs,
  plugins: [lucideIconsPlugin(), openapiPlugin()],
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});

export const openapi = createOpenAPI({
  input: ['./content/docs/api/openapi.json'],
});
