import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';
import { basePath, SENTIO_TABS, SITE_DESCRIPTION } from '@/lib/shared';
import { SentioNav } from '@/components/sentio-nav';
import { SentioSidebarGroup } from '@/components/sentio-sidebar-group';
import { SentioThemeSwitch } from '@/components/sentio-theme-switch';
import { AISearch, AISearchPanel, AISearchTrigger } from '@/components/ai/search';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { MessageCircleIcon } from 'lucide-react';
import './global.css';

const haffer = localFont({
  variable: '--font-haffer',
  display: 'swap',
  src: [
    { path: '../public/fonts/Haffer-Thin.woff2', weight: '100', style: 'normal' },
    { path: '../public/fonts/Haffer-Light.woff2', weight: '300', style: 'normal' },
    { path: '../public/fonts/Haffer-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/Haffer-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/Haffer-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../public/fonts/Haffer-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../public/fonts/Haffer-Heavy.woff2', weight: '800', style: 'normal' },
    { path: '../public/fonts/Haffer-Black.woff2', weight: '900', style: 'normal' },
  ],
});

const robotoMono = localFont({
  variable: '--font-roboto-mono',
  display: 'swap',
  weight: '100 700',
  src: '../public/fonts/RobotoMono-latin.woff2',
});

export const metadata: Metadata = {
  // Website origin, set per environment at build time (see .github/workflows/deploy.yml)
  metadataBase: new URL(
    `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.sentio.xyz'}${basePath}/`,
  ),
  title: {
    default: 'Sentio Docs',
    template: '%s | Sentio Docs',
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: `${basePath}/brand/favicon.ico`,
  },
};

export const viewport: Viewport = {
  // Follows the system preference; next-themes overrides color-scheme inline
  // when the user picks a theme manually
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#11071F' },
  ],
  colorScheme: 'light dark',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${haffer.variable} ${robotoMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider
          /*
           * light / dark / system. next-themes resolves `system` and toggles
           * `.dark` on <html> via a blocking script, so there is no flash.
           * Colors live in global.css under `html:root` and `html.dark`.
           */
          theme={{
            defaultTheme: 'system',
            enableSystem: true,
          }}
          // The search dialog fetches its API directly, so it needs basePath
          search={{ enabled: true, options: { api: `${basePath}/api/search` } }}
        >
          <SentioNav tabs={[...SENTIO_TABS]} />
          {/* Docs are served from the basePath root, so DocsLayout lives in the root layout */}
          <DocsLayout
            tree={source.getPageTree()}
            {...baseOptions()}
            // SentioNav renders the tabs; `top` mode keeps a tab dropdown out of the sidebar
            tabMode="top"
            // Folders have no route of their own; render them as static group titles
            sidebar={{ components: { Folder: SentioSidebarGroup } }}
            /*
             * Used by the mobile drawer. fumadocs also renders it in the desktop
             * sidebar, where global.css hides it (desktop uses the top nav).
             */
            slots={{ themeSwitch: SentioThemeSwitch }}
          >
            {/* Ask AI: answers come from an AgentConnect agent via /api/chat (lib/ask-ai.ts) */}
            <AISearch>
              <AISearchPanel />
              <AISearchTrigger
                position="float"
                className={cn(
                  buttonVariants({
                    variant: 'secondary',
                    className: 'text-fd-muted-foreground rounded-2xl',
                  }),
                )}
              >
                <MessageCircleIcon className="size-4.5" />
                Ask AI
              </AISearchTrigger>
            </AISearch>
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
