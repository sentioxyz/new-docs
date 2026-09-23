import { openapi, source } from '@/lib/source';
import { OpenAPIPage } from '@/components/openapi-page';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getPageImageUrl, getPageMarkdownUrl } from '@/lib/shared';

export default async function Page(props: PageProps<'/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  const preloaded = (page.data as { _openapi?: unknown })._openapi
    ? await openapi.preloadOpenAPIPage(page)
    : undefined;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <header className="flex flex-col gap-3 border-b pb-6">
        {/* Page actions sit to the right of the title and wrap below it on narrow screens */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <DocsTitle className="min-w-0">{page.data.title}</DocsTitle>
          <div className="flex shrink-0 flex-row items-center gap-2">
            <MarkdownCopyButton markdownUrl={markdownUrl} />
            <ViewOptionsPopover />
          </div>
        </div>
        <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      </header>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
            ...(preloaded
              ? {
                  OpenAPIPage: (p: Record<string, unknown>) => {
                    const merged = {
                      ...p,
                      ...preloaded,
                    } as Parameters<typeof OpenAPIPage>[0];
                    return <OpenAPIPage {...merged} />;
                  },
                }
              : {}),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImageUrl(page).url,
    },
  };
}
