'use client';

/*
 * The sidebar's header row.
 *
 * Fumadocs' `navTitle` slot is the sidebar's leading element *and* the
 * brand slot of the mobile top bar (`#nd-subnav`), so this component
 * replaces both uses and has to tell them apart: it draws the
 * search + collapse row in the desktop sidebar and nothing in the
 * compact bar, whose own icon triggers already cover both jobs.
 */

import { SidebarIcon } from 'lucide-react';
import { useSidebar } from 'fumadocs-ui/components/sidebar/base';

import { DOCS_SIDEBAR_COPY } from '@/lib/docs-copy';
import { useDocsLocale } from '@/lib/docs-locale';
import { SidebarSearchButton } from '@/lib/docs-search';

/**
 * Search box plus sidebar collapse control, on one row.
 *
 * The two are split 3:1 by flex (`flex-[3]` in `SidebarSearchButton`,
 * `flex-[1]` here) rather than by percentages, so the collapse control
 * keeps its full click target at every panel width while the search box
 * absorbs the remainder down to the `min-w-0` floor.
 */
export function DocsSidebarHeader() {
  const { mode, collapsed, setCollapsed } = useSidebar();
  const copy = DOCS_SIDEBAR_COPY[useDocsLocale()];

  /*
   * Below `md` the layout switches to its drawer mode: the sidebar is an
   * overlay and the top bar leading this slot is a compact row. A
   * full-width search box would take the bar over, and the bar already
   * carries the icon search trigger and the sidebar trigger.
   */
  if (mode !== 'full') return null;

  return (
    <div className='flex w-full items-center gap-2'>
      <SidebarSearchButton />
      <button
        type='button'
        aria-label={collapsed ? copy.expand : copy.collapse}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((prev) => !prev)}
        className='inline-flex h-9 min-w-0 flex-[1] items-center justify-center rounded-lg border bg-fd-secondary/50 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground'
      >
        <SidebarIcon className='size-4.5 shrink-0' />
      </button>
    </div>
  );
}
