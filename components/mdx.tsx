import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';
import { OpenAPIPage } from './openapi-page';
import { Embed } from './embed';

const DefaultImage = defaultMdxComponents.img;

/**
 * GIFs bypass next/image optimization: the Cloudflare Images binding keeps only the first
 * frame, so animated GIFs render static in production (Next's local optimizer passes them through).
 */
function MdxImage(props: ComponentProps<typeof DefaultImage>) {
  const src = props.src as unknown;
  const url = typeof src === 'string' ? src : (src as { src?: string } | undefined)?.src;
  // `unoptimized` is a next/image prop the default img forwards; ImgHTMLAttributes doesn't declare it.
  const extra = url?.toLowerCase().endsWith('.gif') ? { unoptimized: true } : {};
  return <DefaultImage {...props} {...extra} />;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    img: MdxImage,
    OpenAPIPage,
    Embed,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
