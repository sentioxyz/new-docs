import { NextRequest, NextResponse } from 'next/server';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { docsContentRoute } from '@/lib/shared';

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

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
