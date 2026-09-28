import fs from 'node:fs';
import path from 'node:path';
import { createOpenAPI } from 'fumadocs-openapi/server';
import { generateFiles } from 'fumadocs-openapi';

// Everything under content/docs/api is generated (and gitignored) except the spec and the
// hand-written api-access pages; wipe the rest so pages for removed operations don't linger
const apiDir = './content/docs/api';
const KEEP = new Set(['openapi.json', 'api-access']);
for (const entry of fs.readdirSync(apiDir)) {
  if (!KEEP.has(entry)) fs.rmSync(path.join(apiDir, entry), { recursive: true, force: true });
}

const openapi = createOpenAPI({ input: ['./content/docs/api/openapi.json'] });

// QuerySQLExecutionDetail -> query-sql-execution-detail, GetPriceV2 -> get-price-v2
const kebab = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

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
  // File name (and URL slug) from the kebab-cased operationId; every operation in the spec has one
  name(output) {
    const { path, method } = output.item;
    return kebab(this.document.paths[path][method].operationId);
  },
  meta: true,
});

console.log('Generated API pages');
