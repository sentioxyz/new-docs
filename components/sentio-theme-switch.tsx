'use client';

import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof ThemeSwitch>;

/**
 * light / dark / system theme switch.
 *
 * The fumadocs default only offers light / dark, but the site defaults to
 * `system`, which could never be selected again once switched away.
 *
 * Shared by the desktop top nav (sentio-nav.tsx) and the mobile drawer
 * (DocsLayout `slots.themeSwitch`).
 */
export function SentioThemeSwitch(props: Props) {
  return <ThemeSwitch mode="light-dark-system" {...props} />;
}
