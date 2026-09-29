import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { SentioHomeLink } from '@/components/sentio-home-link';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // Links to the website home (mobile header; global.css hides the sidebar copy)
      title: SentioHomeLink,
    },
    /*
     * Enabled for the mobile drawer. Desktop uses the top nav, and the copy
     * fumadocs renders in the desktop sidebar is hidden by global.css.
     */
    themeSwitch: { enabled: true },
    // No links / githubUrl on purpose: external links live in the top nav
  };
}
