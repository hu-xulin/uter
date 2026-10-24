import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from 'fumadocs-ui/layouts/docs/page';
import { SearchTrigger } from 'fumadocs-ui/layouts/shared/slots/search-trigger';
import type { Node as PageTreeNode, Root as PageTreeRoot, Folder as PageTreeFolder } from 'fumadocs-core/page-tree';
import type { TOCItemType } from 'fumadocs-core/toc';

import { DocsEmbedBridge } from '@/lib/docs-embed-bridge';
import { DocsBreadcrumb } from '@/lib/docs-breadcrumb';
import { DocsPageFooter } from '@/lib/docs-page-footer';
import { DocsHeader } from '@/lib/docs-header';
import { DocsSidebarHeader } from '@/lib/docs-sidebar-header';
import { DocsSidebarFolder, DocsSidebarItem, type SectionedItem } from '@/lib/docs-sidebar-tree';
import { EmptySidebarSearchSlot } from '@/lib/docs-search';
import type { DocsLocale } from '@/lib/i18n';
import { sidebarEntries, type SidebarEntry, type SidebarNode } from '@/lib/nav';

/**
 * Build a Fumadocs page tree from the sidebar entries.
 *
 * Entries with children become `folder` nodes. Each carries an `index`
 * item pointing at the page it fronts, which is what makes Fumadocs
 * render the folder label as a link *plus* a chevron trigger: clicking
 * the label opens the page, clicking the chevron (or the label — see
 * `SidebarFolderLink`) expands the second level.
 *
 * Fumadocs' page tree has no notion of "an entry whose children are
 * anchors inside the same page"; anchors are expressed as ordinary
 * `url`s with a fragment, which the tree renders and links like any
 * other page. Judging whether such an entry is current needs the
 * fragment, which the router's pathname does not carry — see
 * `DocsSidebarItem` / `DocsSidebarFolder` in `docs-sidebar-tree`.
 */
/**
 * Build a single page-tree node, recursing into folders.
 *
 * A `SidebarNode` with children becomes a folder whose `index` is the
 * node's own `url` — that is what lets Fumadocs draw the folder label as
 * a link *plus* a chevron trigger (see `DocsSidebarFolder`). A leaf node
 * becomes a page. The recursion is what lets the API reference reach
 * three levels (API 参考 → 音频 → 原生 Gemini 格式); the folder renderer
 * keeps every ancestor open while a descendant is current.
 */
function buildNode(node: SidebarNode, sectionRoot: string): PageTreeNode {
  if (!node.children || node.children.length === 0) {
    return {
      type: 'page',
      name: node.title,
      url: node.url,
      anchors: node.anchors,
    } as SectionedItem;
  }
  return {
    type: 'folder',
    name: node.title,
    /*
     * An organisational folder with `noIndex` has no page of its own, so
     * its label is a disclosure trigger only — clicking it expands the
     * children rather than navigating. The two API top categories
     * (AI 模型接口 / 管理接口) use this; the custom folder renderer in
     * `docs-sidebar-tree` keeps them open whenever a descendant is current.
     */
    ...(node.noIndex
      ? {}
      : { index: { type: 'page', name: node.title, url: node.url } }),
    collapsible: true,
    defaultOpen: node.defaultOpen ?? false,
    /*
     * `sectionRoot` is the URL of the top-level outline section this
     * folder belongs to. The sidebar renderer reads it to expand *every*
     * folder in the active section — so clicking a section reveals all of
     * its subdirectories, not only the path to the current page.
     */
    sectionRoot,
    children: node.children.map((child) => buildNode(child, sectionRoot)),
  } as PageTreeFolder & { sectionRoot?: string };
}

function buildPageTree(entries: SidebarEntry[]): PageTreeRoot {
  return {
    name: 'root',
    type: 'root',
    children: entries.map((entry) => buildNode(entry, entry.url)),
  };
}

/**
 * Shared page shell — wraps every page under `/docs/<lang>/` and the
 * About page in the Fumadocs DocsLayout + DocsPage, so all of them
 * share one sidebar, top nav, search, table of contents and language
 * switch.
 *
 * The sidebar is built from `entries`; leaving it unset uses the docs
 * navigation (`nav.ts`). The About page is the only other caller and
 * passes its own outline, which is why this is a prop rather than a
 * hard-wired call.
 *
 * The top navigation bar (`DocsHeader`) is rendered **outside** the
 * `DocsLayout` rather than via its `slots.header` prop. Fumadocs'
 * docs layout sets `--fd-header-height: 0px` on desktop and its
 * default header is `md:hidden`, so a slot-based header would be
 * invisible on desktop. Placing it above the layout and giving the
 * layout `pt-0` ensures the nav is always visible.
 *
 * `DocsHeader` is `fixed` so it can shrink into a floating capsule as
 * the page scrolls (matching the SPA's `PublicHeader`); the spacer
 * below it keeps the docs content clear of the nav.
 *
 * When the site is framed by the SPA's `/docs` or `/about` route the
 * same shell is reused as-is: the host already draws an identical top
 * bar, so both the header and its spacer are hidden by
 * `html[data-docs-embed]` in `global.css`, and `DocsEmbedBridge` syncs
 * theme and page location with the host.
 */
export function DocsShell({
  locale,
  title,
  description,
  toc,
  entries,
  children,
}: {
  locale: DocsLocale;
  title: string;
  description?: string;
  /**
   * Right-hand table of contents. Every page builds this with
   * `planHeadings()`, which is also what assigns the anchor ids its
   * headings render — see `docs-toc.ts` for why the two must come from
   * one call.
   */
  toc: TOCItemType[];
  /** Sidebar navigation. Defaults to the docs outline. */
  entries?: SidebarEntry[];
  children: ReactNode;
}) {
  const sidebar = entries ?? sidebarEntries(locale, `/docs/${locale}`);
  const tree = buildPageTree(sidebar);

  /*
   * The right-hand TOC keeps Fumadocs' `clerk` connecting tree line and
   * active highlight, but carries NO numeric numbering. The numbers used
   * to come from a `_step` we assigned to every h2-and-above item here;
   * that has been removed by product decision. Fumadocs' clerk TOC gates
   * the filled-circle-with-number branch on `_step !== undefined`, so
   * leaving it unset drops the numbers (and their circles) while the tree
   * line and the active track — both independent of `_step` — keep
   * rendering exactly as before.
   */
  return (
    <div className='flex min-h-screen flex-col'>
      {/*
        Keeps the framed view in step with the SPA host (theme, current
        page) and renders nothing. No-op when the site is viewed
        standalone.
      */}
      <DocsEmbedBridge />
      <DocsHeader locale={locale} />
      {/*
        The header is `fixed` (that's what lets it morph into a floating
        capsule on scroll), so it no longer occupies flow space. Reserve
        its unscrolled height — `h-16` in `DocsHeader` — so page content
        starts below the nav instead of underneath it.

        Inside the SPA's `/docs` frame the header is hidden by
        `html[data-docs-embed]` in `global.css`, so the spacer carries
        the same marker and drops out with it.
      */}
      <div className='h-16 shrink-0' data-docs-embed-hide aria-hidden='true' />
      <div className='flex-1'>
        <DocsLayout
          tree={tree}
          nav={{ transparentMode: 'none' }}
          /*
           * The sidebar's own collapse trigger is dropped: `navTitle`
           * renders the search box and the collapse control as one row
           * (see `DocsSidebarHeader`), so Fumadocs' icon-only trigger
           * would be a second, stray control on that row. Collapsing
           * still works — the floating pill Fumadocs shows while the
           * sidebar is collapsed carries the matching expand trigger.
           */
          sidebar={{
            collapsible: false,
            /*
             * The two node renderers are replaced so an entry can be
             * recognised by its anchor: fumadocs' default compares URLs
             * against the pathname alone, which makes every anchor in
             * the user guide indistinguishable from the group's own
             * label. See `docs-sidebar-tree`.
             */
            components: { Folder: DocsSidebarFolder, Item: DocsSidebarItem },
          }}
          /*
           * Fumadocs' built-in theme switch is removed from the sidebar
           * footer: it duplicates the one in `DocsHeader`, and inside the
           * SPA's `/docs` frame it would be a third one, since the host
           * header carries its own.
           */
          themeSwitch={{ enabled: false }}
          /*
           * `navTitle` is Fumadocs' slot for the sidebar's leading
           * element. It is also the brand slot of the mobile top bar, so
           * our replacement checks the active layout mode and only draws
           * itself in the desktop sidebar.
           *
           * The full-width search row is emptied because the search box
           * now lives in that header row; the compact icon trigger is
           * kept as Fumadocs ships it, since it is the only search
           * affordance in the mobile top bar.
           */
          slots={{
            navTitle: DocsSidebarHeader,
            searchTrigger: { sm: SearchTrigger, full: EmptySidebarSearchSlot },
          }}
          /*
           * Drop Fumadocs' built-in sidebar language switch. It
           * duplicates the one in `DocsHeader`, and inside the SPA's
           * `/docs` frame it would be a second, independent locale
           * control — changing it there switches the docs language
           * without touching the host's UI language, leaving the SPA
           * header and the framed content disagreeing. `DocsHeader`
           * carries the single switch for both desktop and mobile.
           */
          i18n={false}
        >
          <DocsPage
            toc={toc}
            full
            /*
             * The built-in breadcrumb/footer slots are off: Fumadocs'
             * breadcrumb matches the current URL strictly against
             * trailing-slashed tree URLs and silently renders `null` on
             * every page, and its footer expects `items` that only its
             * source loader computes. The Clerk-style equivalents
             * (breadcrumb chain above the title, prev/next cards under
             * the body) are rendered as children below — they live in
             * the same container, and plain-data props keep them
             * serializable across the server/client boundary.
             */
            footer={{
              enabled: false,
            }}
            breadcrumb={{
              enabled: false,
            }}
            tableOfContent={{
              /*
               * A page without headings of its own — the profile's
               * landing page is a card grid under its `h1` — would
               * otherwise show an empty 「目录」 column. Driven by the
               * TOC itself so a page never has to say it twice.
               */
              enabled: toc.length > 0,
              /*
               * Clerk-style TOC: entries hang off a connecting line that
               * follows the active item — the same "On this page"
               * treatment as the docs this visual language is borrowed
               * from. Deliberately unnumbered: `_step` is left unset (see
               * above), so the circle/number branch does not render and
               * only the tree line remains.
               */
              style: 'clerk',
            }}
          >
            <DocsBreadcrumb entries={sidebar} locale={locale} />
            <DocsTitle>{title}</DocsTitle>
            {description ? <DocsDescription>{description}</DocsDescription> : null}
            <DocsBody>{children}</DocsBody>
            <DocsPageFooter entries={sidebar} locale={locale} />
          </DocsPage>
        </DocsLayout>
      </div>
    </div>
  );
}
