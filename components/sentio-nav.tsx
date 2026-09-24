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
import { SentioLogo } from '@/components/sentio-logo';
import { SentioThemeSwitch } from '@/components/sentio-theme-switch';

export interface SentioTab {
  title: string;
  url: string;
}

const TAB_ICONS: Record<string, ReactNode> = {
  api: <Code2 className="size-4" />,
  guides: <BookOpen className="size-4" />,
  changelog: <History className="size-4" />,
};

function isExternal(url: string) {
  return /^\w+:/.test(url) || url.startsWith('//');
}

function segmentOf(url: string) {
  // Docs are served from the site root, so the tab is the first path segment
  return url.split('/').filter(Boolean)[0] ?? '';
}

export function SentioNav({ tabs }: { tabs: SentioTab[] }) {
  const pathname = usePathname();
  const current = segmentOf(pathname);

  return (
    <header className="sentio-nav hidden md:flex">
      <Link href="/guides" aria-label="Sentio" className="shrink-0 pe-2 ps-1">
        <SentioLogo />
      </Link>

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
          const seg = segmentOf(tab.url);
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
