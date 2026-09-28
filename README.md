# .

This is a Next.js application generated with
[Create Fumadocs](https://github.com/fuma-nama/fumadocs).

Run development server:

```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

Open http://localhost:3000 with your browser to see the result.

## Explore

In the project, you can see:

- `lib/source.ts`: Code for content source adapter, [`loader()`](https://fumadocs.dev/docs/headless/source-api) provides the interface to access your content.
- `lib/layout.shared.tsx`: Shared options for layouts, optional but preferred to keep.

| Route                  | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `app/[[...slug]]`      | Doc pages (`/<slug>`, `/reference/…`, `/changelog/…` under basePath). |
| `app/api/search`       | The Route Handler for search.                                     |
| `proxy.ts`             | Markdown content negotiation (`.md` suffix / `Accept`).           |

## URLs

The site is mounted under **`/docs` on the website domain** (Next.js `basePath`, set in
`lib/base-path.mjs`): `www.sentio.xyz/docs` in production, `website-test.sentio.xyz/docs` for
test. Worker routes on `/docs` (see `wrangler.jsonc`) take precedence over the website origin.
Paths below are relative to basePath; page slugs keep those of the old ReadMe site:

| Folder                  | URL                  | Slug                                                     |
| ----------------------- | -------------------- | -------------------------------------------------------- |
| `content/docs/guides`   | `/<slug>`            | file name (a folder's `index.mdx` takes the folder name) |
| `content/docs/api`      | `/reference/<slug>`  | ReadMe slug from `scripts/reference-slugs.json`          |
| `content/docs/changelog`| `/changelog/<slug>`  | file name                                                |

Guides sit at the root, so no guide may be named `reference` or `changelog`. Folders only
shape the sidebar; `readmeSlugs()` in `lib/source.ts` flattens them, so page file names must
be unique within a tab (the build fails on duplicates). The few ReadMe URLs that are not pages
here (empty folder pages, API tag pages, the old `/docs/<slug>` guide prefix) are redirects in
`next.config.mjs`. Link to pages by their URL without basePath, e.g. `[API Key](/api-key)`;
Next.js adds `/docs`. It does not for raw `<img src>` in MDX (`lib/remark-base-path.ts` handles
those), `fetch` calls or plain `<img>` in components: prefix `basePath` from `lib/shared.ts` there.

## Content pipeline

`content/docs` is generated from the old ReadMe docs, then edited by hand. To regenerate,
run the scripts in this order (each one depends on the output of the previous ones):

```bash
node scripts/migrate.mjs [source-dir]                  # guides tab from the ReadMe docs repo
node scripts/extract-reference-slugs.mjs [source-dir]  # scripts/reference-slugs.json (API page slugs)
npm run gen:api                                        # API pages from content/docs/api/openapi.json
node scripts/migrate-changelog.mjs                     # changelog posts from docs.sentio.xyz
```

The API Reference pages under `content/docs/api` are build output, not source: only
`openapi.json`, the hand-maintained `api-access/` pages and the tag intro pages
(`<tag>/index.mdx`, served at `/reference/<tag>`) are committed. Endpoints are grouped into one
folder per OpenAPI tag, as on ReadMe. `npm run gen:api`
(`generate-api.mjs` + `generate-api-index.mjs`) wipes and regenerates the rest, and runs
automatically before `dev`, `build` and `types:check`. To change an endpoint page, update
`openapi.json` (or the scripts), never the generated `.mdx`.

## Deploy

The site runs on Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare)
(see `wrangler.jsonc`), deployed by `.github/workflows/deploy.yml`, which needs the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets:

| Environment | Worker        | URL                               | Deployed on                         |
| ----------- | ------------- | --------------------------------- | ----------------------------------- |
| test        | `test-docs`   | `website-test.sentio.xyz/docs`    | every push to `main`                |
| production  | `sentio-docs` | `www.sentio.xyz/docs`             | manual run (`environment: production`) |

`NEXT_PUBLIC_SITE_URL` (the website origin, used for metadata and OG image URLs) is inlined at
build time, so each environment is built separately.

```bash
npm run preview            # build and serve locally in the Workers runtime (localhost:8787/docs)
npm run deploy             # build and deploy to test (needs `wrangler login` or CLOUDFLARE_API_TOKEN)
npm run deploy:production  # build and deploy to production
```

`npm run build:cf` copies `cloudflare/_headers` to the asset root after the OpenNext build
(under `public/` it would land in `assets/docs/` and be ignored).
OpenNext's cache interception is off (`open-next.config.ts`): under basePath it answers
segment prefetches with the full page payload, which loops the client router.

Workers static assets are limited to 25 MiB per file, so keep files in `public/` below that.

### Patched dependencies

`patches/` holds [patch-package](https://github.com/ds300/patch-package) patches, applied on
`npm install` / `npm ci` via `postinstall`:

- `fumadocs-openapi` (pinned to an exact version so the patch keeps applying): the API
  playground shows the endpoint path as one string, with `{params}` highlighted and a
  Copy URL button (server URL + path, with the path/query params filled in the form; unfilled
  path params stay `{placeholders}`, API keys are never included). When upgrading it, re-apply the change in `dist/ui/playground/client.js`
  and run `npx patch-package fumadocs-openapi`.
- `fumadocs-ui`: the page actions (Copy Markdown, Open in ChatGPT/Claude) read basePath from
  Vite's `import.meta.env.BASE_URL` only; the patch uses Next.js' `__NEXT_ROUTER_BASEPATH`, in
  `dist/layouts/shared/page-actions.js`. Re-apply with `npx patch-package fumadocs-ui`.

### Fumadocs MDX

Collections are defined with the [Macro API](https://fumadocs.dev/docs/mdx/macro) in `lib/source.ts`.

Read the [Introduction](https://fumadocs.dev/docs/mdx) for further details.

## Learn More

To learn more about Next.js and Fumadocs, take a look at the following
resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js
  features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Fumadocs](https://fumadocs.dev) - learn about Fumadocs
