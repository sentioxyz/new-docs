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
node scripts/migrate.mjs [source-dir]    # guides + ai tabs from the ReadMe docs repo
node scripts/generate-api.mjs            # API pages from content/docs/api/openapi.json
node scripts/generate-api-index.mjs      # API group titles + overview page
node scripts/generate-redirects.mjs      # lib/legacy-redirects.json (/docs/*, /reference/* -> new pages)
node scripts/migrate-changelog.mjs       # changelog posts from docs.sentio.xyz
```

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
