'use client';

import type { ReactNode } from 'react';
import type * as PageTree from 'fumadocs-core/page-tree';
import { usePathname } from 'next/navigation';
import { useTreePath } from 'fumadocs-ui/contexts/tree';
import {
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  useFolderDepth,
} from 'fumadocs-ui/components/sidebar/base';

/** Mirrors fumadocs' getItemOffset(depth) so titles align with sibling items. */
function indentOf(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

/**
 * Sidebar folder renderer.
 *
 * - Top-level folders (e.g. "Introduction") render as static, always-expanded
 *   group titles, unless meta.json sets `collapsible` (the API Reference tags). collapsible={false} makes fumadocs render the title as a
 *   <div> instead of a <button>/<a>. A folder with an index page (e.g. the API
 *   Reference "Data" tag) gets a title that links to it instead.
 * - Nested and collapsible folders (e.g. "Sentio Network") start closed,
 *   unless the current page is inside them or meta.json sets `defaultOpen`.
 */
export function SentioSidebarGroup({
  item,
  children,
}: {
  item: PageTree.Folder;
  children: ReactNode;
}) {
  // useFolderDepth() returns the parent depth, which is the title's indent level
  const depth = useFolderDepth();
  const path = useTreePath();
  const pathname = usePathname();

  if (depth === 0 && !item.collapsible) {
    const titleStyle = { paddingInlineStart: indentOf(depth) };
    return (
      <SidebarFolder collapsible={false} className="sentio-sidebar-group">
        {item.index ? (
          <SidebarFolderLink
            href={item.index.url}
            active={item.index.url === pathname}
            external={item.index.external}
            className="sentio-sidebar-group-title"
            style={titleStyle}
          >
            {item.name}
          </SidebarFolderLink>
        ) : (
          <SidebarFolderTrigger className="sentio-sidebar-group-title" style={titleStyle}>
            {item.name}
          </SidebarFolderTrigger>
        )}
        <SidebarFolderContent className="sentio-sidebar-group-items">
          {children}
        </SidebarFolderContent>
      </SidebarFolder>
    );
  }

  const style = { paddingInlineStart: indentOf(depth) };

  return (
    <SidebarFolder
      active={path.includes(item)}
      defaultOpen={item.defaultOpen ?? false}
    >
      {item.index ? (
        <SidebarFolderLink
          href={item.index.url}
          active={item.index.url === pathname}
          external={item.index.external}
          className="sentio-sidebar-folder"
          style={style}
        >
          {item.icon}
          {item.name}
        </SidebarFolderLink>
      ) : (
        <SidebarFolderTrigger className="sentio-sidebar-folder" style={style}>
          {item.icon}
          {item.name}
        </SidebarFolderTrigger>
      )}
      <SidebarFolderContent className="sentio-sidebar-group-items">
        {children}
      </SidebarFolderContent>
    </SidebarFolder>
  );
}

