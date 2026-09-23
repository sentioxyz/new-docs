/**
 * Video embed for MDX: `<Embed url="https://www.youtube.com/watch?v=..." />`.
 * Supports YouTube, Vimeo and Loom URLs; anything else renders as a plain link.
 */
export function Embed({ url, title = 'Video' }: { url: string; title?: string }) {
  const src = toEmbedSrc(url);

  if (!src) {
    return (
      <p>
        <a href={url} target="_blank" rel="noreferrer">
          {title}
        </a>
      </p>
    );
  }

  return (
    <div className="not-prose my-6 aspect-video overflow-hidden rounded-xl border border-border bg-muted">
      <iframe
        src={src}
        title={title}
        className="size-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

function toEmbedSrc(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      u.searchParams.get('v') ??
      (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : undefined);
    return id ? youtube(id, u) : null;
  }
  if (host === 'youtu.be') return parts[0] ? youtube(parts[0], u) : null;
  if (host === 'vimeo.com' && /^\d+$/.test(parts[0] ?? '')) {
    return `https://player.vimeo.com/video/${parts[0]}`;
  }
  if (host === 'player.vimeo.com') return url;
  if (host === 'loom.com' && (parts[0] === 'share' || parts[0] === 'embed') && parts[1]) {
    return `https://www.loom.com/embed/${parts[1]}`;
  }
  return null;
}

function youtube(id: string, u: URL) {
  // Keep the start offset (`t=90` / `t=1m30s` / `start=90`)
  const t = u.searchParams.get('start') ?? u.searchParams.get('t');
  const start = t ? toSeconds(t) : 0;
  return `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`;
}

function toSeconds(t: string) {
  if (/^\d+$/.test(t)) return Number(t);
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
}
