import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import { baseOptions } from '@/lib/layout.shared';
import { SENTIO_TABS } from '@/lib/shared';
import { SentioNav } from '@/components/sentio-nav';
import { SentioSidebarGroup } from '@/components/sentio-sidebar-group';
import { SentioThemeSwitch } from '@/components/sentio-theme-switch';
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://docs.sentio.xyz',
  ),
  title: {
    default: 'Sentio Docs',
    template: '%s | Sentio Docs',
  },
  description:
    'Developer-First, AI-Powered Modular Web3 Data Infrastructure. Documentation for the Sentio decentralized data and compute network.',
  icons: {
    icon: '/brand/favicon.ico',
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
          search={{ enabled: true }}
        >
          <SentioNav tabs={[...SENTIO_TABS]} />
          {/* Docs are served from the site root, so DocsLayout lives in the root layout */}
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
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}
