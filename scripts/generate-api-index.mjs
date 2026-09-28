/**
 * Final step for the API Reference tab; must run last.
 * 1. Title each tag folder with its OpenAPI tag name
 * 2. Write the final content/docs/api/meta.json (root folder → top tab), tags in ReadMe's order
 * 3. Write the API overview page, linking each tag to its intro page or first endpoint
 *
 * Tag folders are collapsible, like nested Guides folders.
 * A tag folder with a hand-maintained index.mdx opens it at /reference/<tag>.
 *
 * Usage: node scripts/generate-api-index.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const apiDir = path.join(process.cwd(), 'content/docs/api');
const readMeta = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const writeMeta = (dir, meta) =>
  fs.writeFileSync(
    path.join(dir, 'meta.json'),
    JSON.stringify(meta, null, 2) + '\n'
  );

// Tag slug (folder name, see generate-api.mjs) -> OpenAPI tag name
const spec = JSON.parse(fs.readFileSync(path.join(apiDir, 'openapi.json'), 'utf8'));
const TAG_TITLES = { price: 'Price', general: 'General' };
for (const item of Object.values(spec.paths))
  for (const op of Object.values(item))
    for (const tag of op.tags ?? []) TAG_TITLES[tag.toLowerCase().replace(/\s+/g, '-')] = tag;

// ReadMe's tag order (its _order.yaml, as extracted to reference-slugs.json); new tags go last
const { tags: readmeTags } = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'scripts/reference-slugs.json'), 'utf8')
);
const rank = (g) => {
  const i = Object.keys(readmeTags).indexOf(g);
  return i === -1 ? Infinity : i;
};

// Tag folders from generate-api.mjs; api-access (Authentication) is listed separately
const groups = readMeta(apiDir)
  .pages.filter((g) => !g.includes('api-access') && fs.existsSync(path.join(apiDir, g, 'meta.json')))
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
const hasIntro = (g) => fs.existsSync(path.join(apiDir, g, 'index.mdx'));

/* ---------- Tag folder meta.json titles ---------- */

for (const g of groups) {
  const gdir = path.join(apiDir, g);
  const meta = readMeta(gdir);
  const title = TAG_TITLES[g] || meta.title || g;
  // Tag folders collapse like nested Guides folders
  if (meta.title !== title || !meta.collapsible)
    writeMeta(gdir, { ...meta, title, collapsible: true });
}

/* ---------- api/meta.json ---------- */

writeMeta(apiDir, {
  title: 'API Reference',
  description: 'Complete reference for the Sentio REST API',
  root: true,
  // Root folders get no index node by default; without it the sidebar misbehaves on the tab root
  pagesIndex: 'index',
  // "...api-access" lists its pages (Authentication) at the top level, without a folder
  pages: ['...api-access', ...groups],
});

/* ---------- API overview page ---------- */

/** First endpoint page in a group, used as its overview link */
const firstEndpoint = (g) => {
  const gdir = path.join(apiDir, g);
  const page = (readMeta(gdir).pages || []).find((p) =>
    fs.existsSync(path.join(gdir, `${p}.mdx`))
  );
  // Pages are flat under /reference (see lib/source.ts)
  return page ? `/reference/${page}` : null;
};

const overview = [
  `- [Authentication](/reference/authentication)`,
  ...groups.map(
    (g) => `- [${TAG_TITLES[g] || g}](${hasIntro(g) ? `/reference/${g}` : firstEndpoint(g)})`
  ),
]
  .filter((l) => !l.includes('(null)'))
  .join('\n');

fs.writeFileSync(
  path.join(apiDir, 'index.mdx'),
  `---\ntitle: "API Reference"\ndescription: "Complete reference for the Sentio REST API"\n---\n\nBase URL: \`https://api.sentio.xyz\`\n\nEvery request needs an API key in the \`api-key\` header, see [Authentication](/reference/authentication).\n\n${overview}\n`
);

console.log(`Generated API index: 1 overview + ${groups.length + 1} tag folders`);
