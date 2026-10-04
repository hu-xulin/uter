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
  'zh-TW': {
    'On this page(table of contents)': '目錄',
    'No Headings(table of contents)': '暫無目錄',
    'Collapse Sidebar(sidebar)(aria-label)': '收起側邊欄',
    'Open Sidebar(sidebar)(aria-label)': '展開側邊欄',
    'Close Sidebar(sidebar)(aria-label)': '關閉側邊欄',
    'Open Search(search trigger)(aria-label)': '搜尋文件',
  },
  // English is Fumadocs' built-in default; no overrides needed.
  en: {},
  fr: {
    'On this page(table of contents)': 'Sur cette page',
    'No Headings(table of contents)': 'Aucun titre',
    'Collapse Sidebar(sidebar)(aria-label)': 'Réduire la barre latérale',
    'Open Sidebar(sidebar)(aria-label)': 'Ouvrir la barre latérale',
    'Close Sidebar(sidebar)(aria-label)': 'Fermer la barre latérale',
    'Open Search(search trigger)(aria-label)': 'Rechercher dans la documentation',
  },
  ja: {
    'On this page(table of contents)': 'このページの内容',
    'No Headings(table of contents)': '見出しなし',
    'Collapse Sidebar(sidebar)(aria-label)': 'サイドバーを折りたたむ',
    'Open Sidebar(sidebar)(aria-label)': 'サイドバーを開く',
    'Close Sidebar(sidebar)(aria-label)': 'サイドバーを閉じる',
    'Open Search(search trigger)(aria-label)': 'ドキュメントを検索',
  },
  ru: {
    'On this page(table of contents)': 'На этой странице',
    'No Headings(table of contents)': 'Нет заголовков',
    'Collapse Sidebar(sidebar)(aria-label)': 'Свернуть боковую панель',
    'Open Sidebar(sidebar)(aria-label)': 'Открыть боковую панель',
    'Close Sidebar(sidebar)(aria-label)': 'Закрыть боковую панель',
    'Open Search(search trigger)(aria-label)': 'Искать в документации',
  },
  vi: {
    'On this page(table of contents)': 'Trên trang này',
    'No Headings(table of contents)': 'Không có tiêu đề',
    'Collapse Sidebar(sidebar)(aria-label)': 'Thu gọn thanh bên',
    'Open Sidebar(sidebar)(aria-label)': 'Mở thanh bên',
    'Close Sidebar(sidebar)(aria-label)': 'Đóng thanh bên',
    'Open Search(search trigger)(aria-label)': 'Tìm kiếm tài liệu',
  },
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
  'zh-TW': {
    trigger: '搜尋文件',
    placeholder: '搜尋文件…',
    empty: '沒有找到符合的內容',
    close: 'ESC',
  },
  en: {
    trigger: 'Search docs',
    placeholder: 'Search docs…',
    empty: 'No results found',
    close: 'ESC',
  },
  fr: {
    trigger: 'Rechercher',
    placeholder: 'Rechercher…',
    empty: 'Aucun résultat',
    close: 'ÉCHAP',
  },
  ja: {
    trigger: '検索',
    placeholder: '検索…',
    empty: '結果が見つかりません',
    close: 'ESC',
  },
  ru: {
    trigger: 'Поиск',
    placeholder: 'Поиск…',
    empty: 'Ничего не найдено',
    close: 'ESC',
  },
  vi: {
    trigger: 'Tìm kiếm',
    placeholder: 'Tìm kiếm…',
    empty: 'Không tìm thấy kết quả',
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
  'zh-TW': { collapse: '收起側邊欄', expand: '展開側邊欄' },
  en: { collapse: 'Collapse sidebar', expand: 'Expand sidebar' },
  fr: { collapse: 'Réduire la barre latérale', expand: 'Développer la barre latérale' },
  ja: { collapse: 'サイドバーを折りたたむ', expand: 'サイドバーを展開' },
  ru: { collapse: 'Свернуть боковую панель', expand: 'Развернуть боковую панель' },
  vi: { collapse: 'Thu gọn thanh bên', expand: 'Mở rộng thanh bên' },
};
