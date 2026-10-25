'use client';

import Link from 'fumadocs-core/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import type { DocsLocale } from '@/lib/i18n';
import type { SidebarEntry, SidebarNode } from '@/lib/nav';

/**
 * Clerk-style prev/next page footer: two cards under the article body
 * linking to the adjacent pages of the outline.
 *
 * The neighbours are computed from our own outline (`SidebarEntry[]`)
 * rather than the page tree so the ordering, the anchor entries (which
 * point back into a page already listed) and the no-page folders are
 * filtered with the same rules the sidebar uses. Pages rendered through
 * `DocsPage`'s `slots.footer`; renders nothing when the current page is
 * not an outline entry (the landing pages).
 */

function normalizeUrl(url: string): string {
  const bare = url.split('#')[0].replace(/\/+$/, '');
  try {
    return decodeURIComponent(bare) || '/';
  } catch {
    return bare || '/';
  }
}

/**
 * Flatten the outline to the reading order: every node with a real page
 * (folders with their own index, plain leaves). Anchor children
 * (`#fragment`) and no-page folders are skipped — reading an anchor
 * means reading its parent page.
 */
function flattenPages(entries: SidebarNode[]): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  for (const entry of entries) {
    if (entry.url.includes('#')) continue;
    if (!entry.noIndex) out.push({ title: entry.title, url: entry.url });
    if (entry.children) out.push(...flattenPages(entry.children));
  }
  return out;
}

const LABELS: Partial<Record<DocsLocale, { previous: string; next: string }>> = {
  zh: { previous: '上一篇', next: '下一篇' },
  'zh-TW': { previous: '上一篇', next: '下一篇' },
  en: { previous: 'Previous', next: 'Next' },
};

export function DocsPageFooter({
  entries,
  locale,
}: {
  entries: SidebarEntry[];
  locale: DocsLocale;
}) {
  const pathname = usePathname();
  if (!pathname) return null;

  const pages = flattenPages(entries);
  const index = pages.findIndex(
    (page) => normalizeUrl(page.url) === normalizeUrl(pathname)
  );
  if (index === -1) return null;

  const previous = index > 0 ? pages[index - 1] : undefined;
  const next = index < pages.length - 1 ? pages[index + 1] : undefined;
  if (!previous && !next) return null;

  return (
    <div className='mt-16 grid gap-3 border-t border-fd-border pt-6 sm:grid-cols-2'>
      {previous ? (
        <Link
          href={previous.url}
          className='group hover:bg-fd-accent flex flex-col gap-1 rounded-2xl border border-fd-border p-4 transition-colors'
        >
          <span className='text-fd-muted-foreground flex items-center gap-1.5 text-sm'>
            <ArrowLeft className='size-3.5 transition-transform group-hover:-translate-x-0.5' />
            {LABELS[locale]?.previous ?? LABELS.en!.previous}
          </span>
          <span className='text-fd-foreground truncate text-sm font-medium'>
            {previous.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.url}
          className='group hover:bg-fd-accent flex flex-col items-end gap-1 rounded-2xl border border-fd-border p-4 text-right transition-colors'
        >
          <span className='text-fd-muted-foreground flex items-center gap-1.5 text-sm'>
            {LABELS[locale]?.next ?? LABELS.en!.next}
            <ArrowRight className='size-3.5 transition-transform group-hover:translate-x-0.5' />
          </span>
          <span className='text-fd-foreground truncate text-sm font-medium'>
            {next.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
