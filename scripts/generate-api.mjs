import fs from 'node:fs';
import path from 'node:path';
import { createOpenAPI } from 'fumadocs-openapi/server';
import { generateFiles } from 'fumadocs-openapi';

// Everything under content/docs/api is generated (and gitignored) except the spec and the
// hand-maintained api-access pages; wipe the rest so pages for removed operations don't linger
const apiDir = './content/docs/api';
const KEEP = new Set(['openapi.json', 'api-access']);
for (const entry of fs.readdirSync(apiDir)) {
  if (!KEEP.has(entry)) fs.rmSync(path.join(apiDir, entry), { recursive: true, force: true });
}

const openapi = createOpenAPI({ input: ['./content/docs/api/openapi.json'] });

// File name = the page's ReadMe slug (/reference/<slug>, see lib/source.ts). Operations added
// after the ReadMe migration fall back to the lowercased operationId, as ReadMe did.
const { operations: readmeSlugs } = JSON.parse(
  fs.readFileSync('./scripts/reference-slugs.json', 'utf8')
);

await generateFiles({
  input: openapi,
  output: './content/docs/api',
  per: 'operation',
  groupBy: (entry) => {
    // /v1/ai/chat -> ai ; /api/v2/prices/assets -> prices
    const p = entry?.item?.path ?? '';
    const m = p.match(/^\/(?:v\d+\/)?(?:api\/v\d+\/)?([^/]+)/);
    return m ? m[1] : 'general';
  },
  // Every operation in the spec has an operationId
  name(output) {
    const { path, method } = output.item;
    const id = this.document.paths[path][method].operationId;
    return readmeSlugs[id] ?? id.toLowerCase();
  },
  meta: true,
});

console.log('Generated API pages');
