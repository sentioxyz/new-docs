import { NextRequest, NextResponse } from 'next/server';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { docsContentRoute } from '@/lib/shared';
import legacy from '@/lib/legacy-redirects.json';

/**
 * Docs are served from the site root, so the pattern must start with `{/*path}`.
 * `/{/*path}` would make path-to-regexp treat the leading slash as a literal and
 * only match `/`, silently breaking content negotiation for every page.
 */
const { rewrite: rewriteDocs } = rewritePath(
  '{/*path}',
  `${docsContentRoute}{/*path}/content.md`,
);
const { rewrite: rewriteSuffix } = rewritePath(
  '{/*path}.md',
  `${docsContentRoute}{/*path}/content.md`,
);

/**
 * Non-doc routes that share the root namespace and must skip content
 * negotiation; otherwise `/llms.txt` gets rewritten to
 * `/llms.mdx/llms.txt/content.md` and `/og/**` image requests break.
 */
const NON_DOC_PREFIXES = ['/_next', '/og', '/llms', '/brand', '/fonts'];
const NON_DOC_EXACT = ['/', '/api/search'];

function isNonDocPath(pathname: string) {
  return (
    NON_DOC_EXACT.includes(pathname) ||
    NON_DOC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/**
 * Old ReadMe URLs (/docs/<slug>, /reference/<slug>) -> new pages, using the table
 * built by scripts/generate-redirects.mjs. ReadMe slugs may contain spaces
 * ("development and testing") and API slugs may carry a "-1" suffix.
 */
function legacyTarget(pathname: string): string | null {
  const m = pathname.match(/^\/(docs|reference)(?:\/(.*?))?\/?$/);
  if (!m) return null;
  const rest = decodeURIComponent(m[2] ?? '');

  if (m[1] === 'docs') {
    if (!rest) return '/guides/introduction/readme';
    const key = rest.toLowerCase().replace(/\s+/g, '-');
    // Unknown slugs fall back to the new path under the site root (/docs/guides/x -> /guides/x)
    return (legacy.docs as Record<string, string>)[key] ?? `/${rest}`;
  }

  if (!rest) return '/api';
  const key = rest.toLowerCase().replace(/-1$/, '');
  return (legacy.reference as Record<string, string>)[key] ?? '/api';
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const target = legacyTarget(pathname);
  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url, 301);
  }

  if (isNonDocPath(pathname)) return NextResponse.next();

  const result = rewriteSuffix(pathname);
  if (result) {
    return NextResponse.rewrite(new URL(result, request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    const result = rewriteDocs(pathname);

    if (result) {
      return NextResponse.rewrite(new URL(result, request.nextUrl), {
        // this URL has two representations, selected by `Accept`
        headers: { Vary: 'Accept' },
      });
    }
  }

  return NextResponse.next();
}
