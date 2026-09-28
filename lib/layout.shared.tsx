import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { SentioLogo } from '@/components/sentio-logo';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <SentioLogo />,
      // The first Guides page (`/` would redirect there); global.css hides this link in the sidebar
      url: '/readme',
    },
    /*
     * Enabled for the mobile drawer. Desktop uses the top nav, and the copy
     * fumadocs renders in the desktop sidebar is hidden by global.css.
     */
    themeSwitch: { enabled: true },
    // No links / githubUrl on purpose: external links live in the top nav
  };
}
