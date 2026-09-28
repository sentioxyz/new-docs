/**
 * Final step for the API Reference tab; must run last.
 * 1. Give each endpoint group a readable meta.json title
 * 2. Write the final content/docs/api/meta.json (root folder → top tab)
 * 3. Write the API overview page, linking each group to its first endpoint
 *
 * Groups render as static sidebar titles, so no <group>/index.mdx is generated
 * (it would turn /api/<group> into a clickable intermediate route).
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
const titleOf = (file) => {
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, 'utf8').match(/^title:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
};

/** Display titles for endpoint groups (OpenAPI tags are lowercase slugs) */
const GROUP_TITLES = {
  'api-access': 'API Access',
  ai: 'AI',
  alerts: 'Alerts',
  analytics: 'Analytics',
  dashboards: 'Dashboards',
  eventlogs: 'Event Logs',
  insights: 'Insights',
  metrics: 'Metrics',
  move: 'Move',
  prices: 'Prices',
  processors: 'Processors',
  projects: 'Projects',
  solidity: 'Solidity',
  sql: 'SQL',
  users: 'Users',
};

// Endpoint groups from generate-api.mjs; api-access may already be listed
const groups = readMeta(apiDir).pages.filter(
  (g) => g !== 'api-access' && fs.existsSync(path.join(apiDir, g, 'meta.json'))
);

/* ---------- Group meta.json titles ---------- */

for (const g of [...groups, 'api-access']) {
  const gdir = path.join(apiDir, g);
  if (!fs.existsSync(gdir)) continue;
  const meta = readMeta(gdir);
  const title = GROUP_TITLES[g] || meta.title || g;
  if (meta.title !== title) writeMeta(gdir, { ...meta, title });
}

/* ---------- api/meta.json ---------- */

writeMeta(apiDir, {
  title: 'API Reference',
  description: 'Complete reference for the Sentio REST API',
  root: true,
  // Root folders get no index node by default; without it the sidebar misbehaves on the tab root
  pagesIndex: 'index',
  pages: ['api-access', ...groups],
});

/* ---------- API overview page ---------- */

/** First endpoint page in a group, used as its overview link */
const firstEndpoint = (g) => {
  const gdir = path.join(apiDir, g);
  const page = (readMeta(gdir).pages || []).find((p) =>
    fs.existsSync(path.join(gdir, `${p}.mdx`))
  );
  return page ? `/api/${g}/${page}` : null;
};

const overview = [
  `- [API Access](${firstEndpoint('api-access')})`,
  ...groups.map((g) => `- [${GROUP_TITLES[g] || g}](${firstEndpoint(g)})`),
]
  .filter((l) => !l.includes('(null)'))
  .join('\n');

fs.writeFileSync(
  path.join(apiDir, 'index.mdx'),
  `---\ntitle: "API Reference"\ndescription: "Complete reference for the Sentio REST API"\n---\n\nBase URL: \`https://api.sentio.xyz\`\n\nEvery request needs an API key in the \`api-key\` header, see [Authentication](/api/api-access/authentication).\n\n${overview}\n`
);

console.log(`Generated API index: 1 overview + ${groups.length + 1} endpoint groups`);
