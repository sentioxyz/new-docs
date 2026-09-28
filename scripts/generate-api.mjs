import fs from 'node:fs';
import path from 'node:path';
import { createOpenAPI } from 'fumadocs-openapi/server';
import { generateFiles } from 'fumadocs-openapi';

// Everything under content/docs/api is generated (and gitignored) except the spec, the
// hand-maintained api-access pages and each tag folder's intro page (<tag>/index.mdx, served at
// /reference/<tag>); wipe the rest so pages for removed operations don't linger
const apiDir = './content/docs/api';
const KEEP = new Set(['openapi.json', 'api-access']);
for (const entry of fs.readdirSync(apiDir)) {
  if (KEEP.has(entry)) continue;
  const p = path.join(apiDir, entry);
  if (!fs.statSync(p).isDirectory()) {
    fs.rmSync(p);
    continue;
  }
  for (const f of fs.readdirSync(p)) {
    if (f !== 'index.mdx') fs.rmSync(path.join(p, f), { recursive: true, force: true });
  }
  if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
}

const openapi = createOpenAPI({ input: ['./content/docs/api/openapi.json'] });

// File name = the page's ReadMe slug (/reference/<slug>, see lib/source.ts). Operations added
// after the ReadMe migration fall back to the lowercased operationId, as ReadMe did.
const { operations: readmeSlugs } = JSON.parse(
  fs.readFileSync('./scripts/reference-slugs.json', 'utf8')
);

const spec = JSON.parse(fs.readFileSync(path.join(apiDir, 'openapi.json'), 'utf8'));
// The v2 price endpoints carry no tag
const tagOf = (p, method) =>
  spec.paths[p][method].tags?.[0] ?? (p.startsWith('/api/v2/prices') ? 'Price' : 'General');
// Folder name = ReadMe's tag slug (/reference/<tag>)
const tagSlug = (tag) => tag.toLowerCase().replace(/\s+/g, '-');

await generateFiles({
  input: openapi,
  output: './content/docs/api',
  per: 'operation',
  // One folder per OpenAPI tag, as ReadMe grouped them: "Debug and Simulation" -> debug-and-simulation
  groupBy: (entry) => tagSlug(tagOf(entry.item.path, entry.item.method)),
  // Every operation in the spec has an operationId
  name(output) {
    const { path, method } = output.item;
    const id = this.document.paths[path][method].operationId;
    return readmeSlugs[id] ?? id.toLowerCase();
  },
  meta: true,
});

console.log('Generated API pages');
