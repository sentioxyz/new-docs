'use client';

import Link from 'fumadocs-core/link';
import { usePathname } from 'next/navigation';
import {
  ArrowUpRight,
  BookOpen,
  Code2,
  History,
  Package,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { SentioHomeLink } from '@/components/sentio-home-link';
import { SentioThemeSwitch } from '@/components/sentio-theme-switch';

export interface SentioTab {
  title: string;
  url: string;
  /** First URL segment of the tab's pages; '' for Guides, which sits at the root */
  segment?: string;
}

const TAB_ICONS: Record<string, ReactNode> = {
  reference: <Code2 className="size-4" />,
  '': <BookOpen className="size-4" />,
  changelog: <History className="size-4" />,
};

function isExternal(url: string) {
  return /^\w+:/.test(url) || url.startsWith('//');
}

export function SentioNav({ tabs }: { tabs: SentioTab[] }) {
  // Without basePath; a page belongs to the tab named by its first segment, else to Guides
  const pathname = usePathname();
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  const current = tabs.some((tab) => tab.segment && tab.segment === first) ? first : '';

  return (
    <header className="sentio-nav hidden md:flex">
      <SentioHomeLink className="shrink-0 pe-2 ps-1" />

      <nav className="sentio-nav-tabs ms-2">
        {tabs.map((tab) => {
          if (isExternal(tab.url)) {
            // fumadocs Link opens absolute URLs in a new tab
            return (
              <Link key={tab.url} href={tab.url} className="sentio-nav-tab">
                <Package className="size-4" />
                {tab.title}
                <ArrowUpRight className="size-3.5 opacity-60" />
              </Link>
            );
          }
          const seg = tab.segment ?? '';
          const active = seg === current;
          return (
            <Link
              key={tab.url}
              href={tab.url}
              data-active={active}
              className="sentio-nav-tab"
            >
              {TAB_ICONS[seg]}
              {tab.title}
            </Link>
          );
        })}
      </nav>

      <div className="ms-auto flex items-center gap-3">
        <SentioThemeSwitch className="sentio-theme-switch" />
        <a
          href="https://app.sentio.xyz/"
          className="sentio-btn sentio-btn-primary"
          target="_blank"
          rel="noreferrer"
        >
          Launch App
          <ArrowUpRight className="size-4" />
        </a>
      </div>
    </header>
  );
}
