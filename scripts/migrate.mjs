/**
 * Migrates the ReadMe.io docs repo content to Fumadocs.
 *
 * Usage: node scripts/migrate.mjs [source-dir]
 * source-dir defaults to /tmp/docs-v210 (a git worktree of the docs repo at v2.1.0)
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || '/tmp/docs-v210';
const OUT = process.cwd();
const DOCS_OUT = path.join(OUT, 'content/docs');
const ASSETS_OUT = path.join(OUT, 'public/assets');

/* ---------- Helpers ---------- */

const slug = (name) =>
  path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[()[\]{}]/g, '')
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^-+|-+$/g, '');

function uniqueName(name, taken) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let n = name;
  let i = 2;
  while (taken.has(n.toLowerCase())) {
    n = `${base}-${i}${ext}`;
    i++;
  }
  taken.add(n.toLowerCase());
  return n;
}

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

/** Parse ReadMe frontmatter */
function parseFM(text) {
  if (!text.startsWith('---')) return { title: '', description: '', hidden: false, body: text };
  const end = text.indexOf('\n---', 3);
  const fm = end > 0 ? text.slice(4, end) : '';
  const body = end > 0 ? text.slice(end + 4) : text;
  const get = (re) => {
    const m = fm.match(re);
    return m ? m[1].trim() : '';
  };
  const clean = (s) => s.replace(/^['"]|['"]$/g, '').trim();

  const title = clean(get(/^title:\s*(.+)$/m));

  let excerpt = get(/^excerpt:\s*(.+)$/m);
  if (!excerpt || /^[>|]-?$/.test(excerpt)) {
    const m = fm.match(/^excerpt:\s*[>|]-?\s*\n((?:\s+.+\n?)+)/m);
    excerpt = m ? m[1].split('\n').map((s) => s.trim()).join(' ') : '';
  }

  // description priority: excerpt > description > metadata.description.
  // description may be a YAML block scalar (`>-`); read the indented lines that
  // follow, or the page shows a literal ">-".
  const rawDesc = get(/^description:\s*(.+)$/m);
  let description = clean(excerpt);
  if (!description && rawDesc) {
    if (/^[>|]-?$/.test(rawDesc)) {
      const m = fm.match(/^description:\s*[>|]-?\s*\n((?:[ \t]+.*\n?)+)/m);
      description = m ? m[1].split('\n').map((s) => s.trim()).join(' ') : '';
    } else {
      description = clean(rawDesc);
    }
  }
  if (!description) description = clean(get(/^\s+description:\s*(.+)$/m));

  return { title, description, hidden: /^hidden:\s*true/m.test(fm), body };
}

/* ---------- 1. Collect image references ---------- */

const mdFiles = [
  ...walk(path.join(SRC, 'docs')),
  ...walk(path.join(SRC, 'changelogs')),
  ...walk(path.join(SRC, 'reference/ReadMeConfig')),
].filter((f) => f.endsWith('.md'));

const ghRefs = new Set(); // githubusercontent asset file names
const cdnRefs = new Set(); // full files.readme.io URLs

const collect = (u) => {
  if (!u) return;
  if (u.includes('media.githubusercontent.com') && u.includes('/assets/')) {
    const n = decodeURIComponent(u.split('/assets/')[1]);
    if (n) ghRefs.add(n);
  } else if (u.includes('files.readme.io')) {
    cdnRefs.add(u);
  }
};

for (const f of mdFiles) {
  const t = fs.readFileSync(f, 'utf8');
  // ReadMe <Image src="..." /> and HTML <img src="...">
  // captions may contain `>` (e.g. "Edit Channel > Integrations"), so don't stop at [^>]
  for (const m of t.matchAll(/<Image([\s\S]*?)\/>/g)) collect((m[1].match(/src="([^"]+)"/) || [])[1]);
  for (const m of t.matchAll(/<img([\s\S]*?)\/?>/gi)) collect((m[1].match(/src="([^"]+)"/) || [])[1]);
  // Markdown images; match balanced parens so URLs like image (1).png aren't cut short
  for (const m of t.matchAll(
    /!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^()\s]*(?:\([^)]*\)[^()\s]*)*)\)/g
  ))
    collect(m[2]);
}
console.log(`Image references: ${ghRefs.size} local / ${cdnRefs.size} ReadMe CDN`);

/* ---------- 2. Copy local assets ---------- */

fs.mkdirSync(ASSETS_OUT, { recursive: true });
const assetMap = new Map(); // original lowercase file name -> new file name
const taken = new Set();

const srcAssets = path.join(SRC, 'assets');
if (fs.existsSync(srcAssets)) {
  for (const f of fs.readdirSync(srcAssets)) {
    const sp = path.join(srcAssets, f);
    if (!fs.statSync(sp).isFile()) continue;
    const nn = uniqueName(slug(f) + path.extname(f).toLowerCase(), taken);
    fs.copyFileSync(sp, path.join(ASSETS_OUT, nn));
    assetMap.set(f.toLowerCase(), nn);
    assetMap.set(decodeURIComponent(f).toLowerCase(), nn);
  }
}
console.log(`Copied ${assetMap.size / 2} local assets`);

/* ---------- 3. Download ReadMe CDN assets ---------- */

const cdnMap = new Map();
let cdnFail = 0;
let cdnReused = 0;

// File names depend only on the URL, so assign them up front. Existing files are
// reused and only missing ones are downloaded, so reruns work offline and a flaky
// network doesn't revert references to external URLs.
const cdnPlan = [...cdnRefs].map((url) => {
  const raw = decodeURIComponent(url.split('/').pop().split('?')[0]);
  return { url, name: uniqueName(slug(raw) + path.extname(raw).toLowerCase(), taken) };
});

for (const { url, name } of cdnPlan) {
  const dest = path.join(ASSETS_OUT, name);
  if (fs.existsSync(dest)) {
    cdnMap.set(url, name);
    cdnReused++;
    continue;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      cdnMap.set(url, name);
      break;
    } catch (e) {
      if (attempt === 3) {
        cdnFail++;
        console.warn(`  ! CDN download failed, keeping external URL: ${url.slice(0, 70)}… (${e.message})`);
      } else {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
  }
}
console.log(
  `CDN assets: ${cdnReused} reused, ${cdnMap.size - cdnReused} downloaded` +
    `${cdnFail ? `, ${cdnFail} failed` : ''}`
);

/* ---------- 4. Rewrite references ---------- */

/**
 * ReadMe <Image width="30%"> / width="600px" -> <img> with that width (markdown images
 * can't carry one). Returns null when there is no explicit width.
 */
const imageWithWidth = (src, alt, width) =>
  width && width !== 'auto'
    ? `<img src="${src}" alt=${JSON.stringify(alt)} className="rounded-lg" style={{ width: '${width}' }} />`
    : null;

function mapUrl(u) {
  // Sources contain escaped parens like image%20\(4\).png; strip backslashes before lookup
  const norm = (s) => decodeURIComponent(s).replace(/\\/g, '').toLowerCase();
  if (u.includes('media.githubusercontent.com') && u.includes('/assets/')) {
    const hit = assetMap.get(norm(u.split('/assets/')[1]));
    return hit ? `/assets/${hit}` : null;
  }
  if (u.includes('files.readme.io')) return cdnMap.get(u) ? `/assets/${cdnMap.get(u)}` : null;
  return null;
}

function rewrite(body) {
  let t = body;

  // Encode bare spaces in image URLs (e.g. image (3) (1).png), which break markdown parsing
  t = t.replace(
    /(https?:\/\/(?:media\.githubusercontent\.com|files\.readme\.io)\/[^\n]*?\.(?:png|gif|jpe?g|svg|webp|pdf))/gi,
    (m) => m.replace(/ /g, '%20')
  );

  // html <img src="..." alt="..." />
  t = t.replace(/<img([\s\S]*?)\/?>/gi, (m, attrs) => {
    const src = (attrs.match(/src="([^"]+)"/) || [])[1] || '';
    const alt = (attrs.match(/alt="([^"]*)"/) || [])[1] || '';
    const n = mapUrl(src);
    return n ? `![${alt}](${n})` : m;
  });

  // ReadMe <Image src="..." caption="..." />
  // captions may contain `>` (e.g. "Edit Channel > Integrations"), so don't stop at [^>]
  t = t.replace(/<Image([\s\S]*?)\/>/g, (m, attrs) => {
    const src = (m.match(/src="([^"]+)"/) || [])[1] || '';
    const caption = (m.match(/caption="([^"]*)"/) || [])[1] || '';
    const width = ((m.match(/width="([^"]*)"/) || [])[1] || '').trim();
    const n = mapUrl(src);
    if (!n) return m;
    return imageWithWidth(n, caption, width) ?? `![${caption}](${n})`;
  });
  // Unwrap ReadMe <Table align={[...]}>; the content is already a plain HTML table
  t = t.replace(/<Table[^>]*>/g, '').replace(/<\/Table>/g, '');

  // ReadMe <Anchor> -> markdown link (resolved to a real path in step 9)
  t = t.replace(/<Anchor([^>]*)>([\s\S]*?)<\/Anchor>/g, (m, attrs, children) => {
    const href = (attrs.match(/href="([^"]+)"/) || [])[1] || '';
    const label = (attrs.match(/label="([^"]*)"/) || [])[1] || '';
    const text = children.trim() || label || href;
    return href ? `[${text}](doc:${href})` : text;
  });
  t = t.replace(/<Anchor([^>]*?)\/>/g, (m, attrs) => {
    const href = (attrs.match(/href="([^"]+)"/) || [])[1] || '';
    const label = (attrs.match(/label="([^"]*)"/) || [])[1] || '';
    return href ? `[${label || href}](doc:${href})` : label;
  });

  // ReadMe <Embed> (YouTube etc.) -> components/embed.tsx, keeping only url
  t = t.replace(/<Embed([^>]*?)\/>/g, (m, attrs) => {
    const url = (attrs.match(/url="([^"]+)"/) || [])[1] || '';
    return url ? `<Embed url="${url}" />` : '';
  });

  // Markdown images (URLs may contain balanced parens)
  t = t.replace(
    /!\[([^\]]*)\]\(((?:https?:\/\/|\/)[^()\s]*(?:\([^)]*\)[^()\s]*)*)\)/g,
    (m, alt, url) => {
      const n = mapUrl(url.trim());
      return n ? `![${alt}](${n})` : m;
    }
  );

  // Lowercase code fence languages; Shiki doesn't recognize e.g. `Text`
  t = t.replace(/^```([A-Za-z0-9_+-]+)/gm, (m, lang) => '```' + lang.toLowerCase());

  // Escape bare `<` in prose (e.g. "operator (>, >=, <, <=)"), which MDX parses as JSX,
  // but leave code blocks and inline code untouched
  t = t
    .split('```')
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part
            .split('`')
            .map((p, j) => (j % 2 === 1 ? p : p.replace(/<(?![a-zA-Z/!])/g, '&lt;')))
            .join('`')
    )
    .join('```');

  return t;
}

/* ---------- 5. Migrate docs ---------- */

/**
 * Folder landing pages (see components/sentio-sidebar-group.tsx):
 *   - top-level groups render as static titles with no route of their own, so a
 *     source index.md becomes overview.mdx, the first item in the group;
 *   - nested groups are collapsible links, so index.md becomes the folder's own
 *     index.mdx, titled like the folder;
 *   - an index.md with only headings/images is dropped (no empty pages).
 */

/** Title overrides: path relative to content/docs -> sidebar title */
const TITLE_OVERRIDES = {
  'guides/use-data': 'Use Data',
  'guides/admin/concepts/chain-concepts': 'Chain Concepts',
  'guides/admin/concepts/chain-concepts/solana-deprecated': 'Solana (Deprecated)',
};

/** Whether any prose remains after removing headings, images, HTML and link lists */
function hasRealText(body) {
  return body
    .replace(/^#+ .*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*[-*]\s+\[.*$/gm, '')
    .trim().length > 0;
}

function migrateDir(srcDir, outDir, skip = new Set()) {
  fs.mkdirSync(outDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  const hidden = new Set();
  const skipSlugs = new Set([...skip].map((s) => slug(s)));
  const relOut = path.relative(DOCS_OUT, outDir);
  // The Guides tab root page is generated in step 8; don't overwrite them with index.md
  const isTabRoot = relOut === 'guides';
  // tab/group/subgroup and deeper
  const isNested = relOut.split(path.sep).length >= 3;

  // Title: the source index.md title, else the directory name
  let folderTitle = path.basename(srcDir);
  const ownIndex = path.join(srcDir, 'index.md');
  if (fs.existsSync(ownIndex)) {
    const t = (parseFM(fs.readFileSync(ownIndex, 'utf8')).title || '').trim();
    if (t) folderTitle = t;
  }
  folderTitle = TITLE_OVERRIDES[relOut] || folderTitle;

  for (const e of entries) {
    if (skip.has(e.name)) continue;
    const sp = path.join(srcDir, e.name);
    if (e.isDirectory()) {
      migrateDir(sp, path.join(outDir, slug(e.name)));
      continue;
    }
    if (!e.name.endsWith('.md')) continue;

    const raw = fs.readFileSync(sp, 'utf8');
    const { title, description, hidden: isHidden, body } = parseFM(raw);
    const base = slug(e.name);
    const isDirIndex = base === 'index';
    if (isDirIndex && (isTabRoot || !hasRealText(body))) continue;

    const outName = !isDirIndex ? `${base}.mdx` : isNested ? 'index.mdx' : 'overview.mdx';
    const pageTitle = !isDirIndex ? title || base : isNested ? folderTitle : 'Overview';
    const fm = [`title: ${JSON.stringify(pageTitle)}`];
    if (description) fm.push(`description: ${JSON.stringify(description)}`);
    fs.writeFileSync(
      path.join(outDir, outName),
      `---\n${fm.join('\n')}\n---\n${rewrite(body)}`
    );
    if (isHidden) hidden.add(base);
  }

  // _order.yaml -> meta.json
  // Write meta even without _order.yaml so sidebar order is deterministic
  const orderFile = path.join(srcDir, '_order.yaml');
  const childNames = () => {
    const dirs = [];
    const files = [];
    for (const e of entries) {
      if (skip.has(e.name) || hidden.has(slug(e.name))) continue;
      // index.md already became index.mdx / overview.mdx
      if (slug(e.name) === 'index') continue;
      if (e.isDirectory()) dirs.push(slug(e.name));
      else if (e.name.endsWith('.md')) files.push(slug(e.name));
    }
    return [...dirs.sort(), ...files.sort()];
  };

  let pages;
  if (fs.existsSync(orderFile)) {
    pages = fs
      .readFileSync(orderFile, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) => slug(l.slice(2).trim()))
      .filter((n) => !hidden.has(n) && !skipSlugs.has(n));
    for (const n of childNames()) if (!pages.includes(n)) pages.push(n);
  } else {
    pages = childNames();
  }
  if (fs.existsSync(path.join(outDir, 'overview.mdx'))) {
    pages = ['overview', ...pages.filter((p) => p !== 'overview')];
  }

  fs.writeFileSync(
    path.join(outDir, 'meta.json'),
    JSON.stringify({ title: folderTitle, pages }, null, 2) + '\n'
  );
}

/* ---------- 5b. Split content into tabs ---------- */

// Three tabs (Fumadocs root folders):
//   api       → API Reference
//   guides    → Guides (including the AI group)
//   changelog → Changelog
const guidesOut = path.join(DOCS_OUT, 'guides');

migrateDir(path.join(SRC, 'docs'), guidesOut);

/**
 * Flatten redundant same-name nesting such as Integrations/Integrations, which
 * would show up as "Integrations > Integrations" in the sidebar. Merges meta.json too.
 */
function collapseRedundantNesting(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const child = path.join(dir, e.name);
    collapseRedundantNesting(child);

    const inner = path.join(child, e.name);
    if (!fs.existsSync(inner) || !fs.statSync(inner).isDirectory()) continue;
    const outer = fs.readdirSync(child);
    if (outer.length !== 1 || outer[0] !== e.name) continue; // only when the sole child is a same-name directory

    const innerMeta = JSON.parse(fs.readFileSync(path.join(inner, 'meta.json'), 'utf8'));
    for (const f of fs.readdirSync(inner)) {
      if (f === 'meta.json') continue;
      fs.renameSync(path.join(inner, f), path.join(child, f));
    }
    fs.rmSync(inner, { recursive: true, force: true });
    fs.writeFileSync(
      path.join(child, 'meta.json'),
      JSON.stringify({ title: innerMeta.title || path.basename(child), pages: innerMeta.pages }, null, 2) + '\n'
    );
  }
}

collapseRedundantNesting(guidesOut);

console.log(`Migrated docs: guides ${walk(guidesOut).filter((f) => f.endsWith('.mdx')).length}`);

/* ---------- 6. changelog ---------- */

const changelogOut = path.join(DOCS_OUT, 'changelog');
fs.mkdirSync(changelogOut, { recursive: true });
const changelogPages = [];
for (const f of walk(path.join(SRC, 'changelogs')).filter((f) => f.endsWith('.md'))) {
  const { title, description, body } = parseFM(fs.readFileSync(f, 'utf8'));
  const n = slug(f);
  const fm = [`title: ${JSON.stringify(title || n)}`];
  if (description) fm.push(`description: ${JSON.stringify(description)}`);
  fs.writeFileSync(path.join(changelogOut, n + '.mdx'), `---\n${fm.join('\n')}\n---\n${rewrite(body)}`);
  changelogPages.push(n);
}
fs.writeFileSync(
  path.join(changelogOut, 'meta.json'),
  JSON.stringify(
    { title: 'Changelog', root: true, pagesIndex: 'index', pages: changelogPages },
    null,
    2
  ) + '\n'
);

/* ---------- 7. ReadMeConfig (API access) ---------- */

// ReadMe's reference/ReadMeConfig pages are empty placeholders whose content ReadMe renders
// itself (api_config: getting-started / authentication / my-requests), so they are not migrated.
// content/docs/api/api-access is maintained by hand instead.

/* ---------- 8. Tab meta.json and index pages ---------- */

const titleOfFile = (file) => {
  const m = fs.readFileSync(file, 'utf8').match(/^title:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : path.basename(file, '.mdx');
};

const TAB_INTRO = {
  guides: 'The complete Sentio documentation: collecting on-chain data, then processing, consuming, and visualizing it.',
  changelog: 'Release notes and breaking changes.',
};

/**
 * First navigable page in a group (relative to the tab root), used for links on
 * the tab index page, since groups have no route of their own.
 */
function firstLeaf(dir) {
  if (fs.existsSync(path.join(dir, 'overview.mdx'))) return 'overview';
  const metaPath = path.join(dir, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  for (const p of meta.pages || []) {
    const child = path.join(dir, p);
    if (fs.existsSync(child) && fs.statSync(child).isDirectory()) {
      if (fs.existsSync(path.join(child, 'index.mdx'))) return p;
      const got = firstLeaf(child);
      if (got) return `${p}/${got}`;
    } else if (fs.existsSync(path.join(dir, `${p}.mdx`))) {
      return p;
    }
  }
  const first = fs
    .readdirSync(dir)
    .find((f) => f.endsWith('.mdx') && f !== 'index.mdx');
  return first ? first.replace(/\.mdx$/, '') : null;
}

/**
 * Only tab roots (/<tab>) get an index page; nested groups have no route,
 * so directories other than relRoot are skipped.
 */
function writeDirIndex(dir, relRoot) {
  if (dir !== relRoot) return;

  const rel = path.relative(DOCS_OUT, dir).replace(/\\/g, '/');
  const metaPath = path.join(dir, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};

  const items = (meta.pages || [])
    .map((p) => {
      const child = path.join(dir, p);
      const href = (leaf) => `/${[rel, p, leaf].filter(Boolean).join('/')}`;
      if (fs.existsSync(child) && fs.statSync(child).isDirectory()) {
        const sub = JSON.parse(fs.readFileSync(path.join(child, 'meta.json'), 'utf8'));
        const leaf = firstLeaf(child);
        return leaf ? `- [${sub.title || p}](${href(leaf)})` : null;
      }
      const file = path.join(dir, `${p}.mdx`);
      return fs.existsSync(file) ? `- [${titleOfFile(file)}](${href()})` : null;
    })
    .filter(Boolean)
    .join('\n');

  const intro = TAB_INTRO[rel];
  fs.writeFileSync(
    path.join(dir, 'index.mdx'),
    `---\ntitle: ${JSON.stringify(meta.title || path.basename(dir))}\n` +
      (meta.description ? `description: ${JSON.stringify(meta.description)}\n` : '') +
      `---\n\n${intro ? `${intro}\n\n` : ''}${items}\n`
  );
}

// Guides: root folder, pages from the source _order.yaml
const guidesOrder = fs
  .readFileSync(path.join(SRC, 'docs/_order.yaml'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('- '))
  .map((l) => slug(l.slice(2).trim()));

const guidesMeta = JSON.parse(fs.readFileSync(path.join(guidesOut, 'meta.json'), 'utf8'));
fs.writeFileSync(
  path.join(guidesOut, 'meta.json'),
  JSON.stringify(
    {
      title: 'Guides',
      description: 'Guides from first steps to advanced usage',
      root: true,
      pagesIndex: 'index',
      pages: guidesOrder.filter((n) => guidesMeta.pages.includes(n)),
    },
    null,
    2
  ) + '\n'
);

// Index pages for guides / changelog (api's comes from generate-api-index.mjs)
for (const tab of ['guides', 'changelog']) {
  writeDirIndex(path.join(DOCS_OUT, tab), path.join(DOCS_OUT, tab));
}
console.log('Generated tab index pages');

// Root meta.json: tab order
fs.writeFileSync(
  path.join(DOCS_OUT, 'meta.json'),
  JSON.stringify({ pages: ['api', 'guides', 'changelog'] }, null, 2) + '\n'
);

/* ---------- 9. ReadMe doc:slug links -> local paths ---------- */

const slugToPath = new Map();
const addSlug = (k, v) => {
  if (k && !slugToPath.has(k)) slugToPath.set(k, v);
};
// doc: links only point at hand-written docs. Generated api/ pages are excluded,
// otherwise API groups would shadow same-name slugs (e.g. "metrics").
const API_SEG = `${path.sep}api${path.sep}`;
for (const f of walk(DOCS_OUT).filter(
  (f) => f.endsWith('.mdx') && !f.includes(API_SEG)
)) {
  const rel = path.relative(DOCS_OUT, f).replace(/\\/g, '/').replace(/\.mdx$/, '');
  const segs = rel.split('/');
  const base = segs.pop();
  // An index page's URL is the directory itself, not .../index
  const url = `/${base === 'index' ? segs.join('/') : rel}`;
  const key = base === 'index' ? segs[segs.length - 1] : base;
  if (!key) continue;
  addSlug(key, url);
  // ReadMe slugs often differ from file names in singular/plural
  addSlug(key.replace(/s$/, ''), url);
  addSlug(`${key}s`, url);
}

let linkFixed = 0;
let linkMissed = 0;
const missed = new Set();
for (const f of walk(DOCS_OUT).filter((f) => f.endsWith('.mdx'))) {
  const t = fs.readFileSync(f, 'utf8');
  if (!t.includes('](doc:')) continue;
  let out = t.replace(/\]\(doc:([^)]+)\)/g, (m, target) => {
    const [slug, hash] = target.split('#');
    const p = slugToPath.get(slug);
    if (!p) {
      linkMissed++;
      missed.add(slug);
      return m;
    }
    linkFixed++;
    return `](${p}${hash ? `#${hash}` : ''})`;
  });
  // Degrade unresolved doc: links to plain text, or rendering fails on missing pages
  out = out.replace(/\[([^\]]*)\]\(doc:[^)]*\)/g, '$1');
  fs.writeFileSync(f, out);
}
console.log(
  `doc: links converted: ${linkFixed}${linkMissed ? `, ${linkMissed} unresolved (${[...missed].join(', ')})` : ''}`
);

console.log('Tabs: api (API Reference) / guides (Guides) / changelog (Changelog)');
console.log('Migration complete');
