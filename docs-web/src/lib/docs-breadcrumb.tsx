'use client';

import Link from 'fumadocs-core/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import type { DocsLocale } from '@/lib/i18n';
import type { SidebarEntry } from '@/lib/nav';

/**
 * Clerk-style breadcrumb above the page title: the chain of outline
 * folders leading to the current page, the last item rendered as the
 * current location rather than a link.
 *
 * Built on our own outline (`SidebarEntry[]`) instead of Fumadocs'
 * built-in `Breadcrumb` slot because that one resolves the current page
 * with `searchPath(tree.children, pathname)` — a strict URL match against
 * tree URLs that all carry a trailing slash, while `usePathname()` drops
 * it. The match fails on every page and the breadcrumb silently renders
 * `null` (verified against the exported HTML before this component
 * existed). Our matching is trailing-slash and fragment insensitive, the
 * same rule the custom sidebar items use.
 *
 * Rendered through `DocsPage`'s `slots.breadcrumb`; hidden when the
 * current page is a top-level entry (a single-item breadcrumb carries no
 * information), which covers the About section pages too.
 */

function normalizeUrl(url: string): string {
  const bare = url.split('#')[0].replace(/\/+$/, '');
  try {
    return decodeURIComponent(bare) || '/';
  } catch {
    return bare || '/';
  }
}

/** Walk the outline and return the folder chain ending at the current page. */
function findChain(
  entries: SidebarEntry[],
  url: string
): SidebarEntry[] | null {
  for (const entry of entries) {
    if (normalizeUrl(entry.url) === url) return [entry];
    if (entry.children) {
      const sub = findChain(entry.children, url);
      if (sub) return [entry, ...sub];
    }
  }
  return null;
}

const LABELS: Partial<Record<DocsLocale, string>> = {
  zh: '面包屑',
  'zh-TW': '麵包屑',
  en: 'Breadcrumb',
};

export function DocsBreadcrumb({
  entries,
  locale,
}: {
  entries: SidebarEntry[];
  locale: DocsLocale;
}) {
  const pathname = usePathname();
  const chain = pathname ? findChain(entries, normalizeUrl(pathname)) : null;

  if (!chain || chain.length < 2) return null;

  return (
    <nav
      aria-label={LABELS[locale] ?? LABELS.en}
      className='text-fd-muted-foreground mb-3 flex items-center gap-1.5 text-[13px]'
    >
      {chain.map((item, index) => {
        const isCurrent = index === chain.length - 1;
        return (
          <span key={item.url} className='flex min-w-0 items-center gap-1.5'>
            {index > 0 && (
              <ChevronRight className='size-3.5 shrink-0 opacity-60' />
            )}
            {isCurrent ? (
              <span className='text-fd-primary truncate font-medium'>
                {item.title}
              </span>
            ) : (
              <Link
                href={item.url}
                className='truncate transition-opacity hover:opacity-80'
              >
                {item.title}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
