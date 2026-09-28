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
| `app/[[...slug]]`      | Doc pages, served from the site root (`/guides`, `/api`, …).      |
| `app/api/search`       | The Route Handler for search.                                     |
| `proxy.ts`             | Markdown content negotiation and old ReadMe URL redirects.        |

## Content pipeline

`content/docs` is generated from the old ReadMe docs, then edited by hand. To regenerate,
run the scripts in this order (each one depends on the output of the previous ones):

```bash
node scripts/migrate.mjs [source-dir]    # guides tab from the ReadMe docs repo
npm run gen:api                          # API pages from content/docs/api/openapi.json
node scripts/generate-redirects.mjs      # lib/legacy-redirects.json (/docs/*, /reference/* -> new pages)
node scripts/migrate-changelog.mjs       # changelog posts from docs.sentio.xyz
```

The API Reference pages under `content/docs/api` are build output, not source: only
`openapi.json` and the hand-maintained `api-access/` pages are committed. `npm run gen:api`
(`generate-api.mjs` + `generate-api-index.mjs`) wipes and regenerates the rest, and runs
automatically before `dev`, `build` and `types:check`. To change an endpoint page, update
`openapi.json` (or the scripts), never the generated `.mdx`.

## Deploy

The site runs on Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare)
(Worker name `test-docs`, see `wrangler.jsonc`). Every push to `main` deploys through
`.github/workflows/deploy.yml`, which needs the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets.

```bash
npm run preview   # build and serve locally in the Workers runtime
npm run deploy    # build and deploy (needs `wrangler login` or CLOUDFLARE_API_TOKEN)
```

Workers static assets are limited to 25 MiB per file, so keep files in `public/` below that.

### Patched dependencies

`patches/` holds [patch-package](https://github.com/ds300/patch-package) patches, applied on
`npm install` / `npm ci` via `postinstall`:

- `fumadocs-openapi` (pinned to an exact version so the patch keeps applying): the API
  playground shows the endpoint path as one string, with `{params}` highlighted and a
  copy-path button. When upgrading it, re-apply the change in `dist/ui/playground/client.js`
  and run `npx patch-package fumadocs-openapi`.

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
