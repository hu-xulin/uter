'use client';

/*
 * Page-tree overrides for the docs sidebar.
 *
 * Fumadocs marks the current entry by comparing its `url` with the
 * router's pathname (`isActive` in `fumadocs-ui/utils/urls`), and a
 * pathname carries no fragment. The user guide's second level is a list
 * of anchors *inside* one page, so every one of those links resolves to
 * the same pathname as the group's own label: under the default
 * renderer no section can ever light up, and the label keeps the
 * highlight no matter which section is open.
 *
 * `sidebar.components` is the supported place to change that verdict.
 * The cost is that the slot hands over *unstyled* primitives
 * (`fumadocs-ui/components/sidebar/base`), so the row geometry the docs
 * layout normally applies has to be restated here — see `ITEM_CLASS`
 * and `itemIndent`.
 */

import type { Folder as PageTreeFolder, Item as PageTreeItem } from 'fumadocs-core/page-tree';
import { usePathname } from 'fumadocs-core/framework';
import {
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
  useFolderDepth,
} from 'fumadocs-ui/components/sidebar/base';
import { useSyncExternalStore, type FC, type ReactNode } from 'react';

/* ── Current location ───────────────────────────────────────────────── */

/** Custom event announced after a programmatic history update. */
const LOCATION_CHANGE = 'urouters:docs:location';

let historyPatched = false;

/**
 * Make programmatic history updates observable.
 *
 * `hashchange` and `popstate` are fired for user-agent navigations only;
 * `history.pushState` — which is what the router uses for an in-page
 * anchor jump — rewrites the address bar silently. Measured: clicking a
 * section link leaves both events unfired. Wrapping the two methods is
 * the only way to hear about it, and the wrapper is installed on the
 * first subscription so pages without a sidebar never pay for it.
 */
function patchHistory(): void {
  if (historyPatched) return;
  historyPatched = true;

  const { pushState, replaceState } = history;
  history.pushState = (...args: Parameters<History['pushState']>) => {
    pushState.apply(history, args);
    window.dispatchEvent(new Event(LOCATION_CHANGE));
  };
  history.replaceState = (...args: Parameters<History['replaceState']>) => {
    replaceState.apply(history, args);
    window.dispatchEvent(new Event(LOCATION_CHANGE));
  };
}

function subscribeToLocation(onChange: () => void): () => void {
  patchHistory();
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  window.addEventListener(LOCATION_CHANGE, onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(LOCATION_CHANGE, onChange);
  };
}

function readHash(): string {
  return window.location.hash;
}

/**
 * Fragment of the current URL.
 *
 * The server render has no fragment, so the server snapshot is `''` and
 * the first client render matches it; React then re-reads the client
 * snapshot and applies the real one, which is what makes a deep link
 * into a section land already highlighted.
 */
function useLocationHash(): string {
  return useSyncExternalStore(subscribeToLocation, readHash, () => '');
}

/* ── Which entry is current ─────────────────────────────────────────── */

/**
 * Page-tree item carrying the extra anchors that also select it.
 *
 * A group's children are sections of one page, and a heading nested
 * under a section is still part of it — the right-hand TOC links to
 * those too. `PageTree.Item` has no field for them, so the tree carries
 * them as an extra property: `buildPageTree` writes it, `anchorsOf`
 * reads it, and naming the shape here keeps the addition explicit
 * rather than accidental.
 */
export type SectionedItem = PageTreeItem & { anchors?: string[] };

/** Anchors attached to an entry, if any. */
function anchorsOf(item: PageTreeItem): string[] {
  return (item as SectionedItem).anchors ?? [];
}

/** Page URL split into the part the router sees and its `#anchor`. */
function splitFragment(url: string): { path: string; fragment: string } {
  const at = url.indexOf('#');
  return at === -1
    ? { path: url, fragment: '' }
    : { path: url.slice(0, at), fragment: url.slice(at) };
}

/** Trailing slashes are insignificant when comparing two docs URLs. */
function withoutTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Fragments in one canonical form.
 *
 * The address bar percent-encodes everything outside the ASCII set
 * (`#%E5%AE%9A%E4%BB%B7…`) while the page tree carries the literal text
 * the headings are labelled with, so the two sides only line up once
 * both are decoded. Malformed escapes are compared as-is rather than
 * thrown over — a URL typed by hand must not break the sidebar.
 */
function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/**
 * Whether `url` points at the location the reader is at.
 *
 * An entry that stands for a section of its page has to match the
 * fragment — its own, or one of the nested headings in `anchors`. An
 * entry without any fragment is the page itself and stays current
 * whatever anchor the reader has scrolled to, which is what keeps a
 * whole-page entry lit while the TOC is being used.
 */
function isCurrent(
  url: string,
  pathname: string,
  hash: string,
  anchors: string[] = []
): boolean {
  const target = splitFragment(url);
  if (withoutTrailingSlash(target.path) !== withoutTrailingSlash(pathname)) {
    return false;
  }
  if (target.fragment === '' && anchors.length === 0) return true;

  const at = decodeFragment(hash);
  return [target.fragment, ...anchors].some(
    (fragment) => fragment !== '' && decodeFragment(fragment) === at
  );
}

/**
 * The child of `folder` whose section is the current location, if any.
 *
 * The group's children are sections of the page its label opens, so
 * "where am I" is a section rather than a page. Deciding it once, here,
 * keeps the label and the section from both claiming the highlight.
 */
function currentSection(
  folder: PageTreeFolder,
  pathname: string,
  hash: string
): SectionedItem | undefined {
  if (hash === '') return undefined;
  return folder.children.find(
    (child): child is SectionedItem =>
      child.type === 'page' && isCurrent(child.url, pathname, hash, anchorsOf(child))
  );
}

/**
 * Whether any *descendant* of `folder` is the page currently open.
 *
 * `currentSection` only looks at the folder's own (direct) children, which
 * is what decides whether the folder's label should read as the current
 * page. But a folder must also stay *open* whenever one of its
 * grandchildren is current — otherwise navigating into a third-level page
 * collapses the second-level folder above it, hiding the very row the
 * reader chose. This walks the whole subtree, so a folder opens on arrival
 * at any depth below it, not just for a direct child.
 */
function folderContainsCurrent(
  folder: PageTreeFolder,
  pathname: string,
  hash: string
): boolean {
  for (const child of folder.children) {
    if (child.type === 'page') {
      if (isCurrent(child.url, pathname, hash, anchorsOf(child as SectionedItem))) return true;
    } else if (child.type === 'folder') {
      if (folderContainsCurrent(child, pathname, hash)) return true;
    }
  }
  return false;
}

/* ── Row geometry ───────────────────────────────────────────────────── */

/**
 * The classes the docs layout puts on its own entries, restated.
 *
 * Hover and the brand accent are ours (`global.css` overrides them), so
 * only the geometry and the active state are repeated. Keep in step with
 * `fumadocs-ui/layouts/docs/slots/sidebar` on upgrade.
 */
const ITEM_CLASS =
  'relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground ' +
  'wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0 ' +
  "data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary";

/** Extra marker the layout draws beside a nested active entry. */
const NESTED_ACTIVE_CLASS =
  "data-[active=true]:before:content-[''] data-[active=true]:before:bg-fd-primary " +
  'data-[active=true]:before:absolute data-[active=true]:before:w-px ' +
  'data-[active=true]:before:inset-y-2.5 data-[active=true]:before:inset-s-2.5';

/** Inline start padding for an entry at `depth`, in the layout's scale. */
function itemIndent(depth: number): string {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

/* ── Renderers ──────────────────────────────────────────────────────── */

export const DocsSidebarItem: FC<{ item: PageTreeItem }> = ({ item }) => {
  const pathname = usePathname();
  const hash = useLocationHash();
  const depth = useFolderDepth();

  return (
    <SidebarItem
      href={item.url}
      external={item.external}
      icon={item.icon}
      active={isCurrent(item.url, pathname, hash, anchorsOf(item))}
      className={depth >= 1 ? `${ITEM_CLASS} ${NESTED_ACTIVE_CLASS}` : ITEM_CLASS}
      style={{ paddingInlineStart: itemIndent(depth) }}
    >
      {item.name}
    </SidebarItem>
  );
};

export const DocsSidebarFolder: FC<{ item: PageTreeFolder; children: ReactNode }> = ({
  item,
  children,
}) => {
  const pathname = usePathname();
  const hash = useLocationHash();
  const depth = useFolderDepth();

  const section = currentSection(item, pathname, hash);
  const onOwnPage = item.index ? isCurrent(item.index.url, pathname, hash) : false;

  return (
    <SidebarFolder
      collapsible={item.collapsible}
      /*
       * `active` is deliberately not passed: its only effect is to force
       * `defaultOpen`, and a label that happens to be the current page
       * must not unfold the group on arrival — the sidebar opens sections
       * on request. Landing *inside* a section is a different matter, so
       * that case opens the disclosure to show the reader where they are.
       */
      defaultOpen={(item.defaultOpen ?? false) || folderContainsCurrent(item, pathname, hash)}
    >
      {item.index ? (
        <SidebarFolderLink
          href={item.index.url}
          external={item.index.external}
          active={section === undefined && onOwnPage}
          className={`${ITEM_CLASS} w-full`}
          style={{ paddingInlineStart: itemIndent(depth) }}
        >
          {item.icon}
          {item.name}
        </SidebarFolderLink>
      ) : (
        <SidebarFolderTrigger
          className={`${ITEM_CLASS} w-full`}
          style={{ paddingInlineStart: itemIndent(depth) }}
        >
          {item.icon}
          {item.name}
        </SidebarFolderTrigger>
      )}
      <SidebarFolderContent>{children}</SidebarFolderContent>
    </SidebarFolder>
  );
};
