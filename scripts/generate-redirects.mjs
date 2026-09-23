/**
 * Builds lib/legacy-redirects.json, which maps the old ReadMe URLs to the new pages:
 *   /docs/<slug>      -> /guides/... or /ai/...   (slug = file name; a folder's overview.mdx uses the folder name)
 *   /reference/<slug> -> /api/<group>/<page>      (slug = lowercased operationId, optionally with a "-1" suffix)
 * proxy.ts looks paths up in this table. Run after migrate.mjs and generate-api*.mjs.
 *
 * Usage: node scripts/generate-redirects.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DOCS = path.join(process.cwd(), 'content/docs');
const OUT = path.join(process.cwd(), 'lib/legacy-redirects.json');

/** Old ReadMe slugs (already dead there) that are still linked from content -> current slug */
const DOCS_ALIASES = {
  'supported-networks': 'supported-network',
  'hosted-subgraph': 'hosted-subgraphs',
  'todo-endpoint': 'endpoint',
  'entity-store-in-processors': 'entities',
};

/** ReadMe tag pages that have no single operation; point them at a group's first endpoint */
const REFERENCE_TAGS = {
  ai: 'ai',
  data: 'analytics',
  web: 'dashboards',
  'debug-and-simulation': 'solidity',
};

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

const urlOf = (file) => '/' + path.relative(DOCS, file).replace(/\.mdx$/, '').split(path.sep).join('/');

const docs = {};
for (const tab of ['guides', 'ai']) {
  for (const file of walk(path.join(DOCS, tab))) {
    if (!file.endsWith('.mdx') || path.basename(file) === 'index.mdx') continue;
    let slug = path.basename(file, '.mdx');
    if (slug === 'overview') slug = path.basename(path.dirname(file));
    if (docs[slug]) throw new Error(`Duplicate slug "${slug}": ${docs[slug]} and ${urlOf(file)}`);
    docs[slug] = urlOf(file);
  }
}

for (const [alias, slug] of Object.entries(DOCS_ALIASES)) docs[alias] = docs[slug];

const reference = {};
const apiDir = path.join(DOCS, 'api');
const spec = JSON.parse(fs.readFileSync(path.join(apiDir, 'openapi.json'), 'utf8'));
const kebab = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
const pageByName = new Map(
  walk(apiDir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => [path.basename(f, '.mdx'), urlOf(f)])
);
for (const ops of Object.values(spec.paths)) {
  for (const op of Object.values(ops)) {
    if (!op?.operationId) continue;
    const url = pageByName.get(kebab(op.operationId));
    if (url) reference[op.operationId.toLowerCase()] = url;
  }
}
for (const [tag, group] of Object.entries(REFERENCE_TAGS)) {
  const first = JSON.parse(fs.readFileSync(path.join(apiDir, group, 'meta.json'), 'utf8')).pages[0];
  reference[tag] = `/api/${group}/${first}`;
}

fs.writeFileSync(OUT, JSON.stringify({ docs, reference }, null, 2) + '\n');
console.log(
  `Legacy redirects: ${Object.keys(docs).length} /docs + ${Object.keys(reference).length} /reference`
);
