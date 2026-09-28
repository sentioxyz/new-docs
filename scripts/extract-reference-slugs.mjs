/**
 * Builds scripts/reference-slugs.json from the old ReadMe docs repo, so API pages keep their
 * ReadMe URLs (/reference/<slug>). ReadMe slugs are not derivable from the spec: most are the
 * lowercased operationId plus a "-1" suffix, some have none.
 *   operations: operationId -> slug     (reference/Sentio API/<tag>/<slug>.md, api.operationId)
 *   tags:       tag -> slug of its first operation still in the spec (/reference/<tag> redirects there)
 *
 * Usage: node scripts/extract-reference-slugs.mjs [source-dir]   (same source as migrate.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || '/tmp/docs-v210';
const API_SRC = path.join(SRC, 'reference/Sentio API');
const OUT = path.join(process.cwd(), 'scripts/reference-slugs.json');

const order = (dir) =>
  fs
    .readFileSync(path.join(dir, '_order.yaml'), 'utf8')
    .split('\n')
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);

const spec = JSON.parse(fs.readFileSync('content/docs/api/openapi.json', 'utf8'));
const specIds = new Set(
  Object.values(spec.paths).flatMap((ops) => Object.values(ops).map((op) => op?.operationId))
);

const operations = {};
const tags = {};
for (const tag of order(API_SRC)) {
  const dir = path.join(API_SRC, tag);
  for (const slug of order(dir)) {
    const file = path.join(dir, `${slug}.md`);
    if (!fs.existsSync(file)) continue;
    const id = fs.readFileSync(file, 'utf8').match(/^\s*operationId:\s*(\S+)/m)?.[1];
    if (!id) continue;
    operations[id] = slug;
    if (specIds.has(id)) tags[tag] ??= slug;
  }
}

fs.writeFileSync(OUT, JSON.stringify({ operations, tags }, null, 2) + '\n');
console.log(`Reference slugs: ${Object.keys(operations).length} operations, ${Object.keys(tags).length} tags`);
