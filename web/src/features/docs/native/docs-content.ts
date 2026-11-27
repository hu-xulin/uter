/*
Copyright (C) 2023-2026 Uter.ai

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@uter.ai
*/
import apiNavEn from '@/docs-content/api/en/_nav.json'
import apiNavFr from '@/docs-content/api/fr/_nav.json'
// ── Data ───────────────────────────────────────────────────────────────
//
// The outline is **data**, not code — exactly as in `docs-web/content/
// nav.json`, which this module imports directly. The generated sections
// (`api` / `apps`) read their page lists from the `_nav.json` files the
// upstream sync scripts write, copied next to the (not yet migrated)
// Markdown so the sidebar can name pages before their bodies arrive.
import apiNavJa from '@/docs-content/api/ja/_nav.json'
import apiNavRu from '@/docs-content/api/ru/_nav.json'
import apiNavVi from '@/docs-content/api/vi/_nav.json'
import apiNavZhTw from '@/docs-content/api/zh-TW/_nav.json'
import apiNavZh from '@/docs-content/api/zh/_nav.json'
import appsNavEn from '@/docs-content/apps/en/_nav.json'
import appsNavFr from '@/docs-content/apps/fr/_nav.json'
import appsNavJa from '@/docs-content/apps/ja/_nav.json'
import appsNavRu from '@/docs-content/apps/ru/_nav.json'
import appsNavVi from '@/docs-content/apps/vi/_nav.json'
import appsNavZhTw from '@/docs-content/apps/zh-TW/_nav.json'
import appsNavZh from '@/docs-content/apps/zh/_nav.json'
import navManifestJson from '@/docs-content/nav.json'
import type { DocsLocaleCode } from '@/lib/docs-link'

import {
  userGuideChapterSlugs,
  USER_GUIDE_PATH,
  userGuideChapterTitle,
} from './user-guide-identity'

/** A string that has to exist in every locale the site ships. */
type Localized = Partial<Record<DocsLocaleCode, string>>

/** One page of a multi-page group under a `navigation` category. */
type ManifestPage = { id: string; label: Localized }

/** A group whose members are pages of their own. */
type ManifestGroup = { id: string; label: Localized; pages: ManifestPage[] }

/** A category shelf of the API reference. */
type ManifestCategory = {
  id: string
  label: Localized
  open?: boolean
  groups?: ManifestGroup[]
}

type ChildrenSource =
  | { source: 'chapters' }
  | {
      source: 'navigation'
      navigation: 'api' | 'apps'
      skip?: string[]
      shortenAt?: string
      categories?: ManifestCategory[]
      hidden?: string[]
    }

type ManifestSection = {
  id: string
  path: string
  label: Localized
  summary?: Localized
  noIndex?: boolean
  children?: ChildrenSource
}

const MANIFEST = navManifestJson as unknown as { sections: ManifestSection[] }

/** One entry of a generated section's `_nav.json`. */
type SectionNavItem = {
  id: string
  title: string
  description?: string
  category?: string
}

const SECTION_NAV: Record<
  'api' | 'apps',
  Partial<Record<DocsLocaleCode, SectionNavItem[]>>
> = {
  api: {
    zh: apiNavZh as unknown as SectionNavItem[],
    'zh-TW': apiNavZhTw as unknown as SectionNavItem[],
    en: apiNavEn as unknown as SectionNavItem[],
    fr: apiNavFr as unknown as SectionNavItem[],
    ja: apiNavJa as unknown as SectionNavItem[],
    ru: apiNavRu as unknown as SectionNavItem[],
    vi: apiNavVi as unknown as SectionNavItem[],
  },
  apps: {
    zh: appsNavZh as unknown as SectionNavItem[],
    'zh-TW': appsNavZhTw as unknown as SectionNavItem[],
    en: appsNavEn as unknown as SectionNavItem[],
    fr: appsNavFr as unknown as SectionNavItem[],
    ja: appsNavJa as unknown as SectionNavItem[],
    ru: appsNavRu as unknown as SectionNavItem[],
    vi: appsNavVi as unknown as SectionNavItem[],
  },
}

// ── Sidebar tree ───────────────────────────────────────────────────────

/**
 * One node of the native docs sidebar tree — the same shape
 * `docs-web/src/lib/nav.ts` hands to its `DocsShell`, so the rendering
 * conventions (folder disclosure, "keep ancestors of the current page
 * open") port over unchanged.
 */
export type SidebarNode = {
  title: string
  /** Full host URL, e.g. `/docs/zh/api/…`. */
  url: string
  children?: SidebarNode[]
  defaultOpen?: boolean
  noIndex?: boolean
  /**
   * A folder with no landing MDX of its own (the Images group). Its header
   * is a pure disclosure control — clicking expands/collapses the children
   * instead of navigating, and the header never takes the selected state.
   */
  toggleOnly?: boolean
}

/** A label in one locale, falling back through the supported pair. */
function text(label: Localized, locale: DocsLocaleCode, what: string): string {
  const value = label?.[locale]
  if (value) return value
  // New locales are authored in `zh`/`en` only for now; fall back through
  // the supported pair instead of rendering a blank sidebar row.
  if (locale === 'zh-TW' && label.zh) return label.zh
  if (label.en) return label.en
  if (label.zh) return label.zh
  throw new Error(`docs nav: missing label for ${what} (no fallback)`)
}

/** `shortenAt` — the part of a label ahead of the separator. */
function shorten(title: string, separator: string): string {
  const at = title.indexOf(separator)
  return at === -1 ? title : title.slice(0, at)
}

/** The user guide's chapters, from the identity table above. */
function chapterChildren(locale: DocsLocaleCode): SidebarNode[] {
  return userGuideChapterSlugs(locale).map((slug) => ({
    title: userGuideChapterTitle(locale, slug) ?? slug,
    url: `/docs/${locale}/${USER_GUIDE_PATH}/${slug}`,
  }))
}

/**
 * The API reference: protocol groups (audio, chat, …) and flat endpoint
 * pages from `_nav.json`, drawn directly under the API reference section.
 *
 * `nav.json` still groups those protocols under an "AI Model APIs" shelf;
 * that intermediate level is intentionally flattened here — the reader
 * sees "音频 / 聊天 / …" one click below "API 参考", and each group still
 * expands to its OpenAI/Gemini variants. Ordering comes from `_nav.json`,
 * the same source the sidebar and the landing-page cards use.
 */
function apiChildren(
  locale: DocsLocaleCode,
  apiRoot: string,
  source: Extract<ChildrenSource, { source: 'navigation' }>
): SidebarNode[] {
  const nav = SECTION_NAV.api[locale] ?? []
  const hidden = new Set(source.hidden ?? [])
  const groupIds = new Set(
    (source.categories ?? []).flatMap((c) => (c.groups ?? []).map((g) => g.id))
  )
  const pageIds = new Set(
    (source.categories ?? []).flatMap((c) =>
      (c.groups ?? []).flatMap((g) => g.pages.map((p) => p.id))
    )
  )

  // Position of an id in `_nav.json`; ids it does not list sort last.
  const orderOf = (id: string): number => {
    const at = nav.findIndex((item) => item.id === id)
    return at < 0 ? Number.MAX_SAFE_INTEGER : at
  }

  const entries: { id: string; pos: number; node: SidebarNode }[] = []

  for (const category of source.categories ?? []) {
    for (const group of category.groups ?? []) {
      const positions = [
        orderOf(group.id),
        ...group.pages.map((page) => orderOf(page.id)),
      ]
      // Groups with no landing MDX (Images) get a toggle-only header: it
      // expands/collapses in place rather than navigating to a broken page
      // or double-selecting the first child. Ordering still keys off the
      // group id, so keep the canonical URL as the identity.
      const toggleOnly = GROUP_WITHOUT_PAGE[group.id] !== undefined
      entries.push({
        id: group.id,
        pos: Math.min(...positions),
        node: {
          title: text(group.label, locale, group.id),
          url: `${apiRoot}/${group.id}`,
          ...(toggleOnly ? { toggleOnly: true } : {}),
          noIndex: true,
          defaultOpen: false,
          children: group.pages.map((page) => ({
            title: text(page.label, locale, page.id),
            url: `${apiRoot}/${page.id}`,
          })),
        },
      })
    }
  }

  for (const item of nav) {
    if (item.id === 'index') continue
    if (hidden.has(item.id)) continue
    if (groupIds.has(item.id)) continue // declared above, as a group
    if (pageIds.has(item.id)) continue // a member of one of those groups
    entries.push({
      id: item.id,
      pos: orderOf(item.id),
      node: { title: item.title, url: `${apiRoot}/${item.id}` },
    })
  }

  // Top-level API rows follow the same ordering as the API landing cards:
  // ascending Chinese title length (2 characters before 3), source order
  // for ties. Group children keep their own `_nav.json` order.
  entries.sort(
    (a, b) => compareApiTitleLength(a.id, b.id) || a.pos - b.pos
  )
  return entries.map((entry) => entry.node)
}

/** A generated section (`_nav.json`), used flat by the AI-app catalog. */
function navigationChildren(
  locale: DocsLocaleCode,
  root: string,
  source: Extract<ChildrenSource, { source: 'navigation' }>
): SidebarNode[] {
  const skip = new Set(source.skip ?? [])
  const items = (SECTION_NAV[source.navigation][locale] ?? []).filter(
    (item) => !skip.has(item.id)
  )
  // AI-app rows are alphabetical by English short title, matching the app
  // landing cards; API rows are ordered by apiChildren() instead.
  if (source.navigation === 'apps') {
    items.sort((a, b) => appSortKey(a.id).localeCompare(appSortKey(b.id), 'en'))
  }
  return items.map((item) => ({
    title: source.shortenAt ? shorten(item.title, source.shortenAt) : item.title,
    url: `${root}/${item.id}`,
  }))
}

function childrenOf(
  locale: DocsLocaleCode,
  prefix: string,
  section: ManifestSection
): SidebarNode[] | undefined {
  const source = section.children
  if (!source) return undefined
  const root = `${prefix}/${section.path}`
  switch (source.source) {
    case 'chapters':
      return chapterChildren(locale)
    case 'navigation':
      return source.navigation === 'api'
        ? apiChildren(locale, root, source)
        : navigationChildren(locale, root, source)
  }
}

/**
 * Sidebar entries for one locale, in outline order. `prefix` is the
 * locale root (`/docs/<locale>`).
 */
export function sidebarEntries(locale: DocsLocaleCode): SidebarNode[] {
  const prefix = `/docs/${locale}`
  return MANIFEST.sections.map((section) => {
    const children = childrenOf(locale, prefix, section)
    return {
      title: text(section.label, locale, section.id),
      url: `${prefix}/${section.path}`,
      ...(section.noIndex ? { noIndex: true } : {}),
      ...(children ? { defaultOpen: false, children } : {}),
    }
  })
}

// ── Host path ↔ native document mapping ────────────────────────────────

/**
 * The doc sets that can render natively once their Markdown is migrated
 * into `web/src/docs-content/`. `features` maps one page per locale with
 * a fixed slug; every other set mirrors its `content/` directory layout.
 */
export type DocsSet = 'features' | 'user-guide' | 'api' | 'apps' | 'legal'

/** A native-renderable document, resolved from a host page path. */
export type NativeDocRef = { set: DocsSet; slug: string }

/** Fixed page path of the features page (the docs landing). */
export const FEATURES_PAGE_PATH =
  'guide/wiki/basic-concepts/features-introduction'

/** Fixed page path of the model-testing section (a peer of the guide). */
export const MODEL_TESTING_PAGE_PATH = 'guide/wiki/model-testing'

/** The user guide's path under a locale root. */
export const NATIVE_USER_GUIDE_PATH = USER_GUIDE_PATH

/** Host paths of the two catalog sections (peers of the guide). */
export const API_PATH = 'api'
export const APPS_PATH = 'apps'

/**
 * One card of an API/AI-app catalog landing page. `id` is locale-neutral and
 * is the last path segment of the card's target URL; `title`/`description`
 * are the reader's language. `description` doubles as the card's one-line
 * teaser, so no separate fetch of the search index is needed.
 */
export type CatalogCard = {
  /** Locale-neutral slug used as the card's link target. */
  id: string
  title: string
  /** The card's own short teaser (variant list or one-liner). */
  description: string
  /**
   * Extra sentence drawn from the child document this card covers. Joined
   * with `description` and clipped to two lines, so a short one-liner never
   * leaves a half-empty line in the card grid.
   */
  supplement?: string
}

/**
 * API cards whose own teaser is only a variant list or a few words. Each
 * supplement summarises the child document behind the card, filling the
 * second line. `zh`/`en` are authored; `text()` falls back for the rest,
 * matching the rest of the nav data.
 */
const API_CARD_SUPPLEMENTS: Record<string, Localized> = {
  'ai-model-audio': {
    zh: '覆盖语音合成、转写与翻译，兼容 OpenAI 与 Gemini 两套格式。',
    en: 'Speech synthesis, transcription and translation through OpenAI- and Gemini-compatible endpoints.',
  },
  'ai-model-chat': {
    zh: '兼容 Claude Messages 与 Gemini 格式的对话请求，支持流式输出。',
    en: 'Chat requests in Claude Messages and Gemini formats, with streaming responses.',
  },
  'ai-model-responses': {
    zh: '创建、查询与流式读取服务端响应，兼容 Codex 等响应端点客户端。',
    en: 'Create, retrieve and stream server-side responses for Codex-style clients.',
  },
  'ai-model-search-tools': {
    zh: '提供联网搜索与网页抓取工具，按请求计费并按渠道能力转发。',
    en: 'Web search and page-fetch tools, billed per request and routed by channel capability.',
  },
  'ai-model-completions': {
    zh: '根据给定提示生成文本补全，使用 OpenAI 兼容的请求结构。',
    en: 'Generate text completions from a prompt with the OpenAI-compatible schema.',
  },
  'ai-model-embeddings': {
    zh: '把文本转换为向量，兼容 OpenAI 与 Gemini 两套嵌入格式。',
    en: 'Turn text into vectors through OpenAI- and Gemini-compatible embedding formats.',
  },
  'ai-model-images-openai': {
    zh: '图像生成与编辑，支持文生图、图生图及多模型尺寸与质量参数。',
    en: 'Image generation and editing with text-to-image, image-to-image and per-model options.',
  },
  'ai-model-models-list': {
    zh: '查询当前令牌可用的模型列表，返回格式随请求头自动切换。',
    en: 'List the models available to the current token; the response format follows request headers.',
  },
  'ai-model-moderations': {
    zh: '检查文本内容是否违反使用政策，返回 OpenAI 兼容的审核结果。',
    en: 'Check whether text violates the usage policy and return OpenAI-compatible moderation results.',
  },
  'ai-model-realtime': {
    zh: '通过 WebSocket 建立实时语音对话连接，支持浏览器子协议鉴权。',
    en: 'Open a WebSocket connection for real-time speech, with browser subprotocol authentication.',
  },
  'ai-model-rerank': {
    zh: '根据查询与文档的相关性对候选文档重新排序，返回相关度分数。',
    en: 'Re-rank candidate documents against a query and return relevance scores.',
  },
  'ai-model-videos': {
    zh: '异步视频生成，提供通用任务与 OpenAI 视频两种入口及多供应商格式。',
    en: 'Asynchronous video generation via generic tasks or OpenAI video endpoints across providers.',
  },
  'ai-model-tasks': {
    zh: '与供应商无关的异步任务接口，统一任务 ID 与状态查询入口。',
    en: 'Provider-agnostic async task API with shared task IDs and status polling.',
  },
  'ai-model-billing': {
    zh: '查询当前凭据的剩余额度与本期用量，兼容新旧两套端点前缀。',
    en: 'Inspect remaining quota and current-period usage through legacy and new endpoint prefixes.',
  },
}

/**
 * API groups that have no page of their own in `docs-content` — only their
 * child pages exist. Their catalog card links to the first child instead of
 * a page that does not resolve (which would bounce back to the landing).
 */
const GROUP_WITHOUT_PAGE: Record<string, string> = {
  'ai-model-images': 'ai-model-images-openai',
}

/**
 * API endpoints that have no group landing page of their own. They sit at
 * the same outline level as the protocol groups, so the catalog shows them
 * as cards too — with a title/teaser pair instead of a child-variant list.
 */
const STANDALONE_API_CARDS: Record<
  string,
  { title: Localized; description: Localized }
> = {
  'ai-model-responses': {
    title: {
      zh: '响应接口',
      'zh-TW': '響應介面',
      en: 'Responses API',
      fr: 'API Responses',
      ru: 'Responses API',
      ja: 'Responses API',
      vi: 'Responses API',
    },
    description: {
      zh: '多轮对话、工具调用与推理的服务端响应接口',
      'zh-TW': '多輪對話、工具呼叫與推理的服務端響應介面',
      en: 'Server-side responses for multi-turn chat, tools and reasoning',
      fr: 'Réponses côté serveur pour dialogue multi-tours, outils et raisonnement',
      ru: 'Серверные ответы для многоэтапного диалога, инструментов и рассуждения',
      ja: 'マルチターン対話・ツール・推論のためのサーバー側レスポンス',
      vi: 'Phản hồi phía máy chủ cho hội thoại nhiều lượt, công cụ và suy luận',
    },
  },
  'ai-model-search-tools': {
    title: {
      zh: '搜索与工具',
      'zh-TW': '搜尋與工具',
      en: 'Search & Tools',
      fr: 'Recherche et outils',
      ru: 'Поиск и инструменты',
      ja: '検索とツール',
      vi: 'Tìm kiếm và công cụ',
    },
    description: {
      zh: '联网搜索与网页抓取的转发端点',
      'zh-TW': '連網搜尋與網頁擷取的轉送端點',
      en: 'Web search and fetch forwarding endpoints',
      fr: 'Points de terminaison de recherche et récupération Web',
      ru: 'Эндпоинты веб-поиска и получения страниц',
      ja: 'Web 検索・ページ取得の転送エンドポイント',
      vi: 'Điểm cuối chuyển tiếp tìm kiếm và lấy nội dung web',
    },
  },
  'ai-model-tasks': {
    title: {
      zh: '通用任务',
      'zh-TW': '通用任務',
      en: 'Generic Tasks',
      fr: 'Tâches génériques',
      ru: 'Универсальные задачи',
      ja: '汎用タスク',
      vi: 'Tác vụ chung',
    },
    description: {
      zh: '与供应商无关的异步任务接口',
      'zh-TW': '與供應商無關的非同步任務介面',
      en: 'Provider-agnostic async task endpoints',
      fr: 'Points de terminaison de tâches asynchrones indépendants du fournisseur',
      ru: 'Независимые от провайдера асинхронные задачи',
      ja: 'プロバイダー非依存の非同期タスク',
      vi: 'Điểm cuối tác vụ bất đồng độc lập nhà cung cấp',
    },
  },
  'ai-model-billing': {
    title: {
      zh: '计费',
      'zh-TW': '計費',
      en: 'Billing',
      fr: 'Facturation',
      ru: 'Тарификация',
      ja: '課金',
      vi: 'Tính phí',
    },
    description: {
      zh: '查询剩余额度与本期用量',
      'zh-TW': '查詢剩餘額度與本期用量',
      en: 'Query remaining quota and current usage',
      fr: "Interroger le quota restant et l'utilisation en cours",
      ru: 'Запрос остатка квоты и текущего использования',
      ja: '残りクォータと今期の使用量を照会',
      vi: 'Truy vấn hạn mức còn lại và mức sử dụng hiện tại',
    },
  },
  'ai-model-moderations': {
    title: {
      zh: '审查',
      'zh-TW': '審查',
      en: 'Moderations',
      fr: 'Modération',
      ru: 'Модерация',
      ja: 'モデレーション',
      vi: 'Kiểm duyệt',
    },
    description: {
      zh: '原生OpenAI格式',
      'zh-TW': '原生OpenAI格式',
      en: 'Native OpenAI Format',
      fr: 'Format OpenAI natif',
      ru: 'Нативный формат OpenAI',
      ja: 'ネイティブ OpenAI 形式',
      vi: 'Định dạng Native OpenAI',
    },
  },
  'ai-model-realtime': {
    title: {
      zh: '实时语音',
      'zh-TW': '即時語音',
      en: 'Realtime',
      fr: 'Temps réel',
      ru: 'Реальное время',
      ja: 'リアルタイム',
      vi: 'Thời gian thực',
    },
    description: {
      zh: '原生OpenAI格式',
      'zh-TW': '原生OpenAI格式',
      en: 'Native OpenAI Format',
      fr: 'Format OpenAI natif',
      ru: 'Нативный формат OpenAI',
      ja: 'ネイティブ OpenAI 形式',
      vi: 'Định dạng Native OpenAI',
    },
  },
  'ai-model-rerank': {
    title: {
      zh: '重排序',
      'zh-TW': '重新排序',
      en: 'Rerank',
      fr: 'Re-classement',
      ru: 'Переранжирование',
      ja: '再ランキング',
      vi: 'Xếp hạng lại',
    },
    description: {
      zh: '文档重排序',
      'zh-TW': '文件重新排序',
      en: 'Document Reranking',
      fr: 'Re-classement de documents',
      ru: 'Переранжирование документов',
      ja: 'ドキュメント再ランキング',
      vi: 'Tái xếp hạng tài liệu',
    },
  },
}

/** `_nav.json` app titles carry a marketing subtitle after a dash. */
const APP_TITLE_SEPARATOR = /\s+[-—–]\s+/

function shortAppTitle(title: string): string {
  return title.split(APP_TITLE_SEPARATOR)[0] || title
}

/** Protocol groups of the API section, shared by the sidebar and the cards. */
function apiManifestGroups(): ManifestGroup[] {
  const source = MANIFEST.sections.find((s) => s.id === 'api')?.children
  return source?.source === 'navigation'
    ? (source.categories ?? []).flatMap((category) => category.groups ?? [])
    : []
}

/**
 * Chinese card title of an API card, used as the shared sort key. Chinese is
 * the source language for the "2 characters before 3" ordering, so every UI
 * locale ends up with the same, stable order.
 */
function apiTitleZh(id: string): string {
  // A group without its own landing page links to its first child (e.g.
  // images → ai-model-images-openai). Order it by the group's short title,
  // as the sidebar does, not by the child's "图像 · 原生OpenAI格式" label.
  const groupId =
    Object.keys(GROUP_WITHOUT_PAGE).find(
      (key) => GROUP_WITHOUT_PAGE[key] === id
    ) ?? id
  const group = apiManifestGroups().find((item) => item.id === groupId)
  if (group) return text(group.label, 'zh', group.id)
  const standalone = STANDALONE_API_CARDS[id]
  if (standalone) return text(standalone.title, 'zh', id)
  const nav = SECTION_NAV.api.zh ?? []
  return nav.find((item) => item.id === id)?.title ?? id
}

function titleUnits(title: string): number {
  return [...title].filter((char) => char.trim() !== '').length
}

/**
 * API cards/rows: ascending Chinese title length (2-character titles first),
 * preserving source order for ties.
 */
function compareApiTitleLength(a: string, b: string): number {
  return titleUnits(apiTitleZh(a)) - titleUnits(apiTitleZh(b))
}

/**
 * AI-app cards/rows: alphabetical by the English short title (the marketing
 * subtitle after the dash is excluded), so all UI locales share one order.
 */
function appSortKey(id: string): string {
  const nav = SECTION_NAV.apps.en ?? []
  const title = nav.find((item) => item.id === id)?.title ?? id
  return shortAppTitle(title).toLocaleLowerCase('en')
}

/**
 * Cards for a catalog section's synthesised index page.
 *
 * The API card set is the protocol-level groups (audio, chat, …) — one
 * level only, never the OpenAI/Gemini variants beneath them — because the
 * group is the unit a reader chooses from. Titles come from `nav.json`'s
 * group labels: unlike `_nav.json`, those are correct in every locale.
 * An API group's one-liner is the list of variants it contains — e.g. the
 * audio card reads "原生OpenAI格式、原生Gemini格式" — taken from the child
 * page labels in `nav.json`, so it is always localized and always in sync
 * with the subtree the reader will find after clicking the card.
 *
 * Standalone endpoints without a group landing page (moderations, realtime,
 * rerank) are promoted to the same card level, with an explicit localized
 * one-liner. Card order follows `_nav.json`, matching the sidebar.
 *
 * The AI-app set is flat, so its cards are the `_nav.json` entries, whose
 * own `description` is already the one-line teaser. Their marketing subtitle
 * after a dash is dropped from the title so the card reads "AionUi" rather
 * than "AionUi - Free Open-Source Desktop Office Agent".
 */
export function catalogCards(
  locale: DocsLocaleCode,
  section: 'api' | 'apps'
): CatalogCard[] {
  if (section === 'api') {
    const groups = apiManifestGroups()
    const groupCards = groups.map((group) => {
      const linkId = GROUP_WITHOUT_PAGE[group.id] ?? group.id
      const variants = (group.pages ?? []).map((page) =>
        text(page.label, locale, page.id)
      )
      const supplement = API_CARD_SUPPLEMENTS[group.id]
      return {
        id: linkId,
        title: text(group.label, locale, group.id),
        description: variants.join(locale === 'en' ? ', ' : '、'),
        supplement: supplement ? text(supplement, locale, group.id) : '',
      }
    })
    const nav = SECTION_NAV.api[locale] ?? []
    const standaloneCards = nav
      .filter((item) => STANDALONE_API_CARDS[item.id])
      .map((item) => {
        const card = STANDALONE_API_CARDS[item.id]
        const supplement = API_CARD_SUPPLEMENTS[item.id]
        return {
          id: item.id,
          title: text(card.title, locale, item.id),
          description: text(card.description, locale, item.id),
          supplement: supplement ? text(supplement, locale, item.id) : '',
        }
      })
    // Same order as the sidebar: ascending Chinese title length, source
    // order for ties. A group takes its first real page's nav position.
    const orderOf = (id: string): number => {
      const at = nav.findIndex((item) => item.id === id)
      return at < 0 ? Number.MAX_SAFE_INTEGER : at
    }
    return [...groupCards, ...standaloneCards].sort(
      (a, b) => compareApiTitleLength(a.id, b.id) || orderOf(a.id) - orderOf(b.id)
    )
  }
  return (SECTION_NAV.apps[locale] ?? [])
    .filter((item) => item.id !== 'index')
    .map((item) => ({
      id: item.id,
      title: shortAppTitle(item.title),
      description: item.description ?? '',
    }))
    .sort((a, b) => appSortKey(a.id).localeCompare(appSortKey(b.id), 'en'))
}

/** A catalog section's own title and blurb, in the reader's language. */
export function catalogIdentity(
  locale: DocsLocaleCode,
  section: 'api' | 'apps'
): { title: string; description: string } {
  const entry = MANIFEST.sections.find((s) => s.id === section)
  if (!entry) throw new Error(`docs nav: missing section ${section}`)
  return {
    title: text(entry.label, locale, section),
    description: entry.summary ? text(entry.summary, locale, section) : '',
  }
}

/**
 * Map a host page path (the part after `/docs/<locale>/`) to the doc it
 * names, or `null` when the path belongs to no set.
 */
export function docRefForPagePath(pagePath: string): NativeDocRef | null {
  const path = pagePath.replace(/\/+$/, '')
  if (path === FEATURES_PAGE_PATH) {
    return { set: 'features', slug: 'features-introduction' }
  }
  // 模型测试 is a top-level outline section (a peer of the guide) but
  // its body is the guide set's `model-testing.mdx`.
  if (path === MODEL_TESTING_PAGE_PATH) {
    return { set: 'user-guide', slug: 'model-testing' }
  }
  if (path === USER_GUIDE_PATH) return { set: 'user-guide', slug: 'index' }
  if (path.startsWith(`${USER_GUIDE_PATH}/`)) {
    return { set: 'user-guide', slug: path.slice(USER_GUIDE_PATH.length + 1) }
  }
  // The API reference and the AI-app catalog are shelves with an index
  // page of their own. `sidebarEntries()` links the section label straight
  // at the *bare* section URL (`/docs/<locale>/api`), so both spellings
  // have to resolve; without the two arms below `docRefForPagePath()`
  // returns null and `DocsRoute` bounces the reader back to the landing.
  if (path === 'api') return { set: 'api', slug: 'index' }
  if (path === 'apps') return { set: 'apps', slug: 'index' }
  if (path.startsWith('api/')) return { set: 'api', slug: path.slice(4) }
  if (path.startsWith('apps/')) return { set: 'apps', slug: path.slice(5) }
  if (path.startsWith('legal/')) return { set: 'legal', slug: path.slice(6) }
  return null
}

/**
 * Module path of a doc inside `web/src/docs-content/`, relative to the
 * content root. The features set authors one file per locale named for
 * the locale itself; every other set follows `<set>/<locale>/<slug>`.
 */
export function docsModulePath(
  ref: NativeDocRef,
  locale: DocsLocaleCode
): string {
  if (ref.set === 'features') return `features/${locale}.mdx`
  return `${ref.set}/${locale}/${ref.slug}.mdx`
}
