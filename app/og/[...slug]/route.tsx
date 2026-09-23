import { source } from '@/lib/source';
import { notFound } from 'next/navigation';
import { generateOGImage } from 'fumadocs-ui/og';
import { appName, getPageImageUrl } from '@/lib/shared';

export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/og/[...slug]'>) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return generateOGImage({
    title: page.data.title,
    description: page.data.description,
    site: appName,
    // Sentio brand colors
    primaryColor: 'rgba(17,99,240,0.6)',
    primaryTextColor: 'rgb(54,247,247)',
  });
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
