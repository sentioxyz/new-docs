import { basePath } from '@/lib/base-path.mjs';

/**
 * Brand wordmark. A plain <img>, so its src needs basePath.
 *
 * The official logo only works on dark backgrounds (white wordmark).
 * public/brand/sentio-logo-light.png is a derived light-theme version.
 *
 * CSS toggles the two by `html.dark` (see `.sentio-logo--*` in global.css).
 * `<picture media="(prefers-color-scheme)">` won't do, because the theme can be
 * chosen manually and differ from the system preference.
 */
export function SentioLogo({ className }: { className?: string }) {
  const cls = className ? `sentio-logo ${className}` : 'sentio-logo';

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${basePath}/brand/sentio-logo.png`}
        alt="Sentio"
        width={133}
        height={36}
        className={`${cls} sentio-logo--dark`}
      />
      {/* Duplicate of the logo above; hidden from screen readers */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${basePath}/brand/sentio-logo-light.png`}
        alt=""
        aria-hidden="true"
        width={133}
        height={36}
        className={`${cls} sentio-logo--light`}
      />
    </>
  );
}
