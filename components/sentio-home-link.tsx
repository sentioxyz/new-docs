'use client';

import type { ComponentProps } from 'react';
import { SentioLogo } from '@/components/sentio-logo';
import { websiteHomeUrl } from '@/lib/shared';

/**
 * The logo links back to the website home. A plain <a>, not next/link: the home page is
 * outside basePath (another app on this domain), so it needs a full page load without the
 * `/docs` prefix. Also used as the fumadocs `nav.title`, which passes its anchor props here.
 */
export function SentioHomeLink({ href: _href, children: _children, ...props }: ComponentProps<'a'>) {
  return (
    <a {...props} href={websiteHomeUrl} aria-label="Sentio">
      <SentioLogo />
    </a>
  );
}
