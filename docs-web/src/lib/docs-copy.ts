import type { DocsLocale } from './i18n';

/**
 * Chinese copy for the Fumadocs UI chrome.
 *
 * Fumadocs ships English defaults and reads overrides from the
 * `@fuma-translate/react` context. The lookup key is the English source
 * string with its note chain appended in parentheses —
 * `text` + `(hookNote)` + `(callNote)` — so `useTranslations({ note:
 * 'table of contents' })` followed by `t('On this page')` looks up
 * `'On this page(table of contents)'`. Keys must match that format
 * exactly; a typo silently falls back to English rather than failing.
 *
 * Only the strings this site actually renders are listed. The search
 * dialog is not among them because `DocsSearchDialog` owns its own copy
 * (it is rendered by `SearchProvider` in the root layout, above the
 * per-locale translation provider, and so cannot read this map anyway).
 */
export const DOCS_CHROME: Record<DocsLocale, Record<string, string>> = {
  zh: {
    // Right-hand TOC (`layouts/docs/page/slots/toc` + `components/toc/default`).
    'On this page(table of contents)': '目录',
    'No Headings(table of contents)': '暂无目录',

    // Sidebar collapse trigger and the mobile drawer trigger
    // (`components/sidebar/base`).
    'Collapse Sidebar(sidebar)(aria-label)': '收起侧边栏',
    'Open Sidebar(sidebar)(aria-label)': '展开侧边栏',
    'Close Sidebar(sidebar)(aria-label)': '关闭侧边栏',

    // Search triggers (`layouts/shared/slots/search-trigger`). Only the
    // compact icon trigger is still Fumadocs' — the full-width one is
    // replaced by `SidebarSearchButton`, which owns its copy in
    // `DOCS_SEARCH_COPY` below.
    'Open Search(search trigger)(aria-label)': '搜索文档',
  },
  // English is Fumadocs' built-in default; no overrides needed.
  en: {},
};

/**
 * Copy for the site's own search UI — the sidebar trigger and the dialog
 * `DocsSearchDialog` renders. Kept separate from `DOCS_CHROME` because
 * both are our components rather than Fumadocs overrides.
 */
export const DOCS_SEARCH_COPY: Record<
  DocsLocale,
  { trigger: string; placeholder: string; empty: string; close: string }
> = {
  zh: {
    trigger: '搜索文档',
    placeholder: '搜索文档…',
    empty: '没有找到匹配的内容',
    close: 'ESC',
  },
  en: {
    trigger: 'Search docs',
    placeholder: 'Search docs…',
    empty: 'No results found',
    close: 'ESC',
  },
};

/**
 * Accessible names for the sidebar's collapse control. Only the label is
 * needed here — the button is icon-only, since the panel it toggles is
 * obvious from position and the icon alone carries the meaning.
 */
export const DOCS_SIDEBAR_COPY: Record<
  DocsLocale,
  { collapse: string; expand: string }
> = {
  zh: { collapse: '收起侧边栏', expand: '展开侧边栏' },
  en: { collapse: 'Collapse sidebar', expand: 'Expand sidebar' },
};
