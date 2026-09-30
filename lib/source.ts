import { llms, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { openapiPlugin, createOpenAPI } from 'fumadocs-openapi/server';
import { basePath, docsContentRoute, docsImageRoute, docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { remarkBasePath } from './remark-base-path';

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    // Keeps the default fumadocs preset (a collection-level mdxOptions would replace it)
    mdxOptions: applyMdxPreset({ remarkPlugins: (v) => [...v, remarkBasePath] }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

/**
 * content/docs root folder (sidebar tab) -> first URL segment under basePath. Guides sit at
 * the root, so a guide slug must not be `reference`, `connect` or `changelog`.
 */
const TAB_ROUTES: Record<string, string> = {
  guides: '',
  api: 'reference',
  connect: 'connect',
  changelog: 'changelog',
};

/**
 * Keep the ReadMe slugs: pages are flat under their tab (/<slug>, /reference/<slug>,
 * /changelog/<slug>, all under basePath) while the folders only shape the sidebar. A slug is
 * the file name, or the folder name for a folder's index.mdx / overview.mdx; a tab's
 * index.mdx is the tab root.
 */
function readmeSlugs(file: { path: string }): string[] | undefined {
  const segs = file.path.replace(/\.mdx?$/, '').split('/');
  const tab = TAB_ROUTES[segs[0]];
  if (tab === undefined) return;
  const prefix = tab ? [tab] : [];
  const name = segs[segs.length - 1];
  if (name !== 'index' && name !== 'overview') return [...prefix, name];
  return segs.length === 2 ? prefix : [...prefix, segs[segs.length - 2]];
}

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  slugs: readmeSlugs,
  plugins: [lucideIconsPlugin(), openapiPlugin()],
});

/**
 * llms.txt output is read outside the app, so root-relative links (`](/x)`) need basePath,
 * which Next.js only adds to links it renders itself.
 */
function withBasePath(markdown: string) {
  return markdown.replace(/\]\(\/(?!\/)/g, `](${basePath}/`);
}

const llmsText = llms(source, {
  renderPage: async (page) =>
    withBasePath(`# ${page.data.title} (${basePath}${page.url})

${await page.data.getText('processed')}`),
});

export const docsLlms = {
  ...llmsText,
  index: async () => withBasePath(await llmsText.index()),
};

export const openapi = createOpenAPI({
  input: ['./content/docs/api/openapi.json'],
});
