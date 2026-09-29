import type { Root } from 'mdast';
import { basePath } from './base-path.mjs';

interface JsxNode {
  type: string;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: JsxNode[];
}

/**
 * Next.js prefixes basePath onto markdown images (remark-image imports them) and links, but
 * not onto raw `<img src="/assets/...">` written as JSX in MDX. Prefix those here.
 */
export function remarkBasePath() {
  return (tree: Root) => {
    const visit = (node: JsxNode) => {
      if (
        (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
        node.name === 'img'
      ) {
        for (const attr of node.attributes ?? []) {
          if (
            attr.type === 'mdxJsxAttribute' &&
            attr.name === 'src' &&
            typeof attr.value === 'string' &&
            attr.value.startsWith('/') &&
            !attr.value.startsWith('//')
          ) {
            attr.value = basePath + attr.value;
          }
        }
      }
      node.children?.forEach(visit);
    };
    visit(tree as unknown as JsxNode);
  };
}
