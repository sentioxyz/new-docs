import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { SITE_DESCRIPTION, getPageImageUrl } from '@/lib/shared';
import { SENTIO_LOGO_DATA_URL } from '@/lib/og-logo';

export const revalidate = false;

/** Clamp to roughly four lines at 34px (fits SITE_DESCRIPTION); satori has no line-clamp */
function truncate(text: string, max = 200) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export async function GET(_req: Request, { params }: RouteContext<'/og/[...slug]'>) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const title = page.data.title;
  const longTitle = title.length > 40;
  // Same fallback as the page metadata, kept shorter under a two-line title
  const description = truncate(page.data.description ?? SITE_DESCRIPTION, longTitle ? 120 : 200);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '72px 80px',
          color: 'white',
          backgroundColor: '#11071f',
          backgroundImage:
            'radial-gradient(circle at 100% 0%, rgba(17,99,240,0.55) 0%, rgba(17,7,31,0) 55%), radial-gradient(circle at 0% 100%, rgba(138,56,245,0.35) 0%, rgba(17,7,31,0) 50%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SENTIO_LOGO_DATA_URL} width={177} height={48} alt="" />
          <div
            style={{
              display: 'flex',
              fontSize: '30px',
              fontWeight: 600,
              color: '#36f7f7',
              paddingLeft: '20px',
              borderLeft: '2px solid rgba(255,255,255,0.3)',
            }}
          >
            Docs
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
          <div
            style={{
              display: 'flex',
              fontSize: longTitle ? '60px' : '76px',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: '28px',
              fontSize: '34px',
              lineHeight: 1.4,
              color: 'rgba(240,240,250,0.75)',
            }}
          >
            {description}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: '56px',
            height: '8px',
            width: '160px',
            borderRadius: '4px',
            backgroundImage: 'linear-gradient(90deg, #1163f0, #36f7f7)',
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

export function generateStaticParams() {
  /*
   * next/og fetches its default font from the network while prerendering, which
   * fails the build in offline environments (CI, sandboxes). With
   * NEXT_SKIP_OG_PRERENDER=1 images are generated on first request instead.
   */
  if (process.env.NEXT_SKIP_OG_PRERENDER === '1') return [];

  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImageUrl(page).segments,
  }));
}
