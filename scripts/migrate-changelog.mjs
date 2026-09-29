/**
 * Migrates the ReadMe changelog posts into content/docs/changelog.
 * ReadMe serves each post's markdown at /changelog/<slug>.md; images are downloaded to
 * public/assets/changelog and absolute links to old ReadMe pages become site-relative
 * (pages keep their ReadMe URLs, see lib/source.ts).
 *
 * ReadMe has no real publish dates (every post has the same import timestamp), so the
 * order in meta.json is the order below, newest first.
 *
 * Usage: node scripts/migrate-changelog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://docs.sentio.xyz';
const POSTS = [
  'sentio-sdk-40-released',
  'sentio-sdk-30-released',
  '2024-feature-roundup',
  'sdk-v2396-cli-v2187',
];
/** Posts that only exist here, and where they go in the list (after the given slug) */
const LOCAL_POSTS = { '2025-11-timeseries-refactor': 'sentio-sdk-40-released' };

const OUT = path.join(process.cwd(), 'content/docs/changelog');
const ASSETS = path.join(process.cwd(), 'public/assets/changelog');

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function downloadImage(url) {
  const file = url.split('/').pop().split('?')[0];
  // ReadMe names files <64-char hash>-<name>.<ext>; a hash prefix keeps names short and stable
  const name = file.replace(/^([0-9a-f]{16})[0-9a-f]*-/, '$1-');
  const dest = path.join(ASSETS, name);
  if (!fs.existsSync(dest)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  }
  return `/assets/changelog/${name}`;
}

/** Old ReadMe URL -> new site path; ReadMe anchors look like `#/section` */
function rewriteUrl(url) {
  const m = url.match(/^https:\/\/docs\.sentio\.xyz(\/[^#\s]*)?(?:#\/?(.*))?$/);
  if (!m) return url;
  const [, p = '/', frag] = m;
  const hash = frag ? `#${frag}` : '';
  let to = null;
  let d;
  // Guides moved to the basePath root: /docs/<slug> -> /<slug>
  if ((d = p.match(/^\/docs\/([^/]+)$/))) to = `/${d[1]}`;
  else if (/^\/reference\/[^/]+$/.test(p)) to = p;
  else if ((d = p.match(/^\/(?:update\/)?changelog\/([^/]+)$/))) to = `/changelog/${d[1]}`;
  if (!to) {
    console.warn(`  ! unresolved link, kept as is: ${url}`);
    return url;
  }
  return to + hash;
}

async function convert(md) {
  // ReadMe prepends an llms.txt hint before the post
  let t = md.replace(/^Fetch the complete documentation index[^\n]*\n+/, '');
  const title = (t.match(/^# (.+)$/m) || [])[1]?.trim();
  if (!title) throw new Error('post has no H1 title');
  t = t.replace(/^# .+\n+/m, '');

  // <Image src="..." /> -> markdown image (local copy)
  const images = [...t.matchAll(/<Image\b[^>]*?\bsrc="([^"]+)"[^>]*?\/>/g)];
  for (const [tag, src] of images) {
    const alt = (tag.match(/\balt="([^"]*)"/) || [])[1] ?? '';
    t = t.replace(tag, `![${alt}](${await downloadImage(src)})`);
  }

  // <Anchor href="...">text</Anchor> -> markdown link
  t = t.replace(/<Anchor\b[^>]*?\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/Anchor>/g, '[$2]($1)');

  // Rewrite links to old ReadMe pages
  t = t.replace(/\]\((https:\/\/docs\.sentio\.xyz[^)\s]*)\)/g, (_, url) => `](${rewriteUrl(url)})`);

  return { title, body: t.trim() + '\n' };
}

fs.mkdirSync(ASSETS, { recursive: true });

for (const slug of POSTS) {
  const { title, body } = await convert(await fetchText(`${SITE}/changelog/${slug}.md`));
  fs.writeFileSync(path.join(OUT, `${slug}.mdx`), `---\ntitle: ${JSON.stringify(title)}\n---\n\n${body}`);
  console.log(`Migrated ${slug}: ${title}`);
}

const pages = [...POSTS];
for (const [slug, after] of Object.entries(LOCAL_POSTS)) pages.splice(pages.indexOf(after) + 1, 0, slug);

const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8'));
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ ...meta, pages }, null, 2) + '\n');

const titleOf = (slug) =>
  JSON.parse(fs.readFileSync(path.join(OUT, `${slug}.mdx`), 'utf8').match(/^title: (.+)$/m)[1]);
fs.writeFileSync(
  path.join(OUT, 'index.mdx'),
  `---\ntitle: "Changelog"\n---\nRelease notes and breaking changes.\n\n${pages
    .map((s) => `- [${titleOf(s)}](/changelog/${s})`)
    .join('\n')}\n`
);
console.log(`Changelog: ${pages.length} posts`);
