import { aboutSectionUrl, getAboutContent } from '@/lib/content/about';
import { loadMarkdownPage, loadSectionNav } from '@/lib/content/markdown-page';
import {
  USER_GUIDE_CHAPTER_SLUGS,
  USER_GUIDE_PATH,
  userGuideChapterTitle,
  userGuideChapterUrl,
} from '@/lib/content/user-guide';
import type { DocsLocale } from '@/lib/i18n';

/**
 * Sidebar navigation for the docs site.
 *
 * Slugs are locale-neutral — only the labels change between locales — so
 * the URL of a page is identical in `zh` and `en`, which is what lets the
 * SPA's language switch keep you on the same page (see
 * `docs-viewer.tsx` in `web/`).
 *
 * The outline covers what a reader needs to *use* the platform: features,
 * the user guide, the API reference, the AI-app catalog and the legal
 * documents. The basic-concepts section now carries only the features
 * introduction; the former project-introduction and technical-architecture
 * pages have been removed from the site entirely.
 */
export const SLUGS = {
  features: 'guide/wiki/basic-concepts/features-introduction',
  guide: USER_GUIDE_PATH,
  api: 'api',
  apps: 'apps',
  legal: 'legal',
} as const;

export const LABELS: Record<
  DocsLocale,
  {
    features: string;
    guide: string;
    api: string;
    apps: string;
    userAgreement: string;
    privacyPolicy: string;
  }
> = {
  zh: {
    features: '特性说明',
    guide: '用户指南',
    api: 'API 参考',
    apps: 'AI 应用',
    userAgreement: '用户协议',
    privacyPolicy: '隐私政策',
  },
  en: {
    features: 'Features',
    guide: 'User Guide',
    api: 'API Reference',
    apps: 'AI Apps',
    userAgreement: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
  },
};

/**
 * One node of the sidebar tree.
 *
 * A node carrying `children` renders as a collapsible folder whose own
 * `url` is the folder's index page (clicking the label opens it, the
 * chevron expands the children). A node without `children` renders as a
 * leaf page. The type is recursive, so folders may nest arbitrarily
 * deep — the API reference nests its groups under two category folders
 * (AI 模型接口 / 管理接口), with audio as a further sub-folder — and the
 * custom folder renderer in `docs-sidebar-tree` keeps every ancestor open
 * while a descendant is the current page.
 */
export type SidebarNode = {
  title: string;
  url: string;
  /**
   * Headings nested inside the page this node opens. A link to one of
   * them still means "reading this node", so they travel with it and the
   * sidebar counts them as the same location. Only meaningful on leaves.
   */
  anchors?: string[];
  /** Present on folder nodes. */
  children?: SidebarNode[];
  /**
   * Show the children on arrival instead of waiting for a click.
   */
  defaultOpen?: boolean;
  /**
   * Folder without its own page: the label is a disclosure trigger only
   * (no link). Used for the two API top categories (AI 模型接口 /
   * 管理接口), which are organisational shelves with no dedicated page.
   */
  noIndex?: boolean;
};

export type SidebarEntry = SidebarNode;
export type SidebarSection = SidebarNode;

/**
 * Sidebar entries for the About pages (`/about/<lang>/…`).
 *
 * One entry per chapter, all at the same level, each opening a page of
 * its own — the profile is a set of short pages rather than one long
 * scroll, so a chapter is a destination and not an anchor inside another
 * page. There is deliberately no entry for the profile's own landing
 * page: the panel lists the chapters, and `DocsHeader`'s 「关于」 link is
 * how the landing page is reached.
 *
 * The sidebar therefore carries no folders, which is also what keeps the
 * docs sidebar's anchor-matching machinery (`docs-sidebar-tree`) out of
 * the picture here: every entry names a distinct pathname.
 */
export function aboutSidebarEntries(locale: DocsLocale): SidebarEntry[] {
  return getAboutContent(locale).sections.map((section, index) => ({
    title: section.heading,
    url: aboutSectionUrl(locale, index),
  }));
}

/**
 * Sidebar entries for one locale. `prefix` is the locale root
 * (`/docs/<locale>`).
 *
 * The user guide is the only entry with a second level. Its chapters are
 * pages of their own (`/docs/<lang>/guide/wiki/user-guide/<slug>/`)
 * rather than anchors inside one long page, so each child names a real
 * pathname — which is also why the group opens on arrival: now that the
 * second level leads somewhere, hiding it would hide the only route into
 * nine of the site's pages.
 *
 * Labels come from `user-guide.ts` and not from the chapters' Markdown,
 * so a chapter that has not been converted yet still has a name in the
 * sidebar, in both locales.
 */
/**
 * API 参考的目录层级（与上游 https://docs.newapi.pro/zh/docs/api 对齐）。
 *
 * 上游把 API 参考拆成两大分类：`ai-model`（AI 模型接口）与 `management`
 * （管理接口）。本站沿用「一组一页」的内容模型，侧栏再套两层：
 *
 *   API 参考
 *     ├─ AI 模型接口（ai-model）
 *     │   ├─ 音频（Audio）   → 原生 OpenAI 格式 / 原生 Gemini 格式（独立页面）
 *     │   ├─ 聊天（Chat）    → 原生 OpenAI 格式 / 原生 Gemini 格式
 *     │   ├─ 图像（Images）  → …
 *     │   ├─ 视频（Videos）  → …
 *     │   └─ 补全 / 嵌入 / 模型（Models） …（整组一页）
 *     └─ 管理接口（management）
 *         └─ 渠道管理 / 令牌管理 … → 每组 h2 端点作为页内锚点条目
 *
 * 多格式组（音频 / 聊天 / 图像 / 视频）上游本就是一组多端点，这里收成
 * 「格式页」文件夹（对应「API 参考 → 音频 → 原生 Gemini 格式」）；其余 AI
 * 模型组整组一页；管理接口各组把页内 h2 端点抽成锚点条目（对应「API 参考 →
 * 管理接口 → 渠道管理 → 批量删除渠道」），点击跳到该组页对应小节。锚点 id
 * 取自 `loadMarkdownPage` 的 headings，与页面渲染出的 id 完全一致。
 */

const CATEGORY_TITLE: Record<'ai-model' | 'management', { zh: string; en: string }> = {
  'ai-model': { zh: 'AI 模型接口', en: 'AI Model APIs' },
  management: { zh: '管理接口', en: 'Management APIs' },
};

/** 多格式组：根（总览页，可为空）+ 格式页子项。 */
const FORMAT_FOLDERS: Record<string, { index: string | null; children: string[] }> = {
  'ai-model-audio': { index: 'ai-model-audio', children: ['ai-model-audio-openai', 'ai-model-audio-gemini'] },
  'ai-model-chat': { index: 'ai-model-chat', children: ['ai-model-chat-openai', 'ai-model-chat-gemini'] },
  'ai-model-images': { index: null, children: ['ai-model-images-openai', 'ai-model-images-gemini', 'ai-model-images-qwen'] },
  'ai-model-videos': { index: 'ai-model-videos', children: ['ai-model-videos-jimeng', 'ai-model-videos-kling', 'ai-model-videos-sora'] },
  /*
   * 补全 / 嵌入 / 列出模型：上游把同一操作的多个协议变体放在同一个目录里，
   * 同步脚本已按协议拆成格式页（见 sync-upstream-docs.py 的 FORMAT_SPLIT），
   * 因此这三组与音频等一样渲染为可展开文件夹。
   */
  'ai-model-completions': { index: 'ai-model-completions', children: ['ai-model-completions-openai'] },
  'ai-model-embeddings': {
    index: 'ai-model-embeddings',
    children: ['ai-model-embeddings-openai', 'ai-model-embeddings-gemini'],
  },
  'ai-model-models-list': {
    index: 'ai-model-models-list',
    children: ['ai-model-models-list-openai', 'ai-model-models-list-gemini'],
  },
};

const FORMAT_FOLDER_TITLE: Record<string, { zh: string; en: string }> = {
  'ai-model-audio': { zh: '音频（Audio）', en: 'Audio' },
  'ai-model-chat': { zh: '聊天（Chat）', en: 'Chat' },
  'ai-model-images': { zh: '图像（Images）', en: 'Images' },
  'ai-model-videos': { zh: '视频（Videos）', en: 'Videos' },
  'ai-model-completions': { zh: '补全（Completions）', en: 'Completions' },
  'ai-model-embeddings': { zh: '嵌入（Embeddings）', en: 'Embeddings' },
  // 上游目录是 models/list（meta 标题「列出模型」），侧栏按组显示为「模型（Models）」。
  'ai-model-models-list': { zh: '模型（Models）', en: 'Models' },
};

const FORMAT_PAGE_TITLE: Record<string, { zh: string; en: string }> = {
  'ai-model-audio-openai': { zh: '原生OpenAI格式', en: 'OpenAI Format' },
  'ai-model-audio-gemini': { zh: '原生Gemini格式', en: 'Native Gemini Format' },
  'ai-model-chat-openai': { zh: '原生OpenAI格式', en: 'OpenAI Format' },
  'ai-model-chat-gemini': { zh: '原生Gemini格式', en: 'Native Gemini Format' },
  'ai-model-images-openai': { zh: '原生OpenAI格式', en: 'OpenAI Format' },
  'ai-model-images-gemini': { zh: '原生Gemini格式', en: 'Native Gemini Format' },
  'ai-model-images-qwen': { zh: '通义千问OpenAI格式', en: 'Qwen OpenAI Format' },
  'ai-model-videos-jimeng': { zh: '即梦格式', en: 'Jimeng Format' },
  'ai-model-videos-kling': { zh: '可灵格式', en: 'Kling Format' },
  'ai-model-videos-sora': { zh: 'Sora格式', en: 'Sora Format' },
  'ai-model-completions-openai': { zh: '原生OpenAI格式', en: 'OpenAI Format' },
  'ai-model-embeddings-openai': { zh: '原生OpenAI格式', en: 'OpenAI Format' },
  'ai-model-embeddings-gemini': { zh: '原生Gemini格式', en: 'Native Gemini Format' },
  'ai-model-models-list-openai': { zh: '原生OpenAI格式', en: 'OpenAI Format' },
  'ai-model-models-list-gemini': { zh: '原生Gemini格式', en: 'Native Gemini Format' },
};

function formatFolderNode(locale: DocsLocale, prefix: string, root: string): SidebarNode {
  const def = FORMAT_FOLDERS[root];
  return {
    title: FORMAT_FOLDER_TITLE[root][locale],
    url: def.index ? `${prefix}/${SLUGS.api}/${def.index}` : `${prefix}/${SLUGS.api}/${root}`,
    /*
     * `noIndex`: the format folder is an organisational shelf (音频 /
     * 聊天 / 图像 / 视频), not a page of its own. Its label is a
     * disclosure trigger so clicking it — or its chevron — expands the
     * format sub-pages, instead of navigating to an overview and
     * collapsing again.
     */
    noIndex: true,
    defaultOpen: false,
    children: def.children.map((cid) => ({
      title: FORMAT_PAGE_TITLE[cid][locale],
      url: `${prefix}/${SLUGS.api}/${cid}`,
      anchors: [],
    })),
  };
}

/**
 * 本地 API 侧栏与上游 docs.newapi.pro/zh/docs/api 一一对应：两级
 * （AI 模型接口 / 管理接口）。条目与顺序直接取自同步生成的 `_nav.json`
 * （即上游的目录结构），不再硬编码顺序 —— 上游新增或调整分组时侧栏
 * 自动对齐，不会被遗漏。
 *
 * - 多格式组保留为可展开文件夹（点击标题或箭头展开子级菜单），子项为各
 *   厂商格式页。上游用子目录拆分的（音频 / 聊天 / 图像 / 视频）与上游用
 *   单目录多文件、由同步脚本拆分的（补全 / 嵌入 / 模型）走同一条路径。
 * - 其余组与上游一致为扁平叶子：端点作为页内 TOC 锚点，不单独进侧栏。
 * - 本地曾多出的三项（微调 / 鉴权体系说明 / 使用兑换码）上游侧栏无对应，
 *   移出侧栏；内容文件仍保留在仓库（搜索 / 直链可访问）。
 * - 文件（Files）是上游的未实现桩页，同步脚本已整体跳过（SKIP_GROUPS），
 *   侧栏与内容均不再出现。
 */
function apiSidebarChildren(locale: DocsLocale, prefix: string): SidebarNode[] {
  const apiRoot = `${prefix}/${SLUGS.api}`;
  const nav = loadSectionNav('api', locale);

  // 上游侧栏无对应条目的本地项，移出侧栏。
  const EXTRA_IDS = new Set([
    'ai-model-unimplemented-fine-tuning', // 微调（Fine-tuning）
    'management-auth', // 鉴权体系说明（Auth）
    'management-default', // 使用兑换码（与 management-redemption 重复）
  ]);
  const FORMAT_BASE = new Set(Object.keys(FORMAT_FOLDERS));
  const FORMAT_CHILDREN = new Set(Object.values(FORMAT_FOLDERS).flatMap((d) => d.children));

  // 以 _nav.json（上游目录结构）中的出现顺序作为排序依据，保证与上游一致。
  const orderOf = (id: string): number => {
    const i = nav.findIndex((n) => n.id === id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const formatPos = (root: string): number => {
    const kids = FORMAT_FOLDERS[root].children.map(orderOf);
    const minKid = kids.length ? Math.min(...kids) : Number.MAX_SAFE_INTEGER;
    return Math.min(orderOf(root), minKid);
  };

  type Entry = { pos: number; node: SidebarNode; category: 'ai-model' | 'management' };
  const entries: Entry[] = [];

  // 多格式组：始终作为可展开文件夹（其子项不再作为独立叶子出现）。
  for (const root of FORMAT_BASE) {
    entries.push({
      pos: formatPos(root),
      node: formatFolderNode(locale, prefix, root),
      category: 'ai-model',
    });
  }

  // 其余分组：直接来自 _nav.json（上游结构），扁平叶子。
  for (const item of nav) {
    if (EXTRA_IDS.has(item.id)) continue;
    if (FORMAT_BASE.has(item.id)) continue; // 基键已作为文件夹处理
    if (FORMAT_CHILDREN.has(item.id)) continue; // 格式页子项已并入文件夹
    const category: 'ai-model' | 'management' =
      item.category === 'management' ? 'management' : 'ai-model';
    entries.push({
      pos: orderOf(item.id),
      node: { title: item.title, url: `${apiRoot}/${item.id}`, anchors: [] },
      category,
    });
  }

  const aiModel = entries
    .filter((e) => e.category === 'ai-model')
    .sort((a, b) => a.pos - b.pos)
    .map((e) => e.node);
  const management = entries
    .filter((e) => e.category === 'management')
    .sort((a, b) => a.pos - b.pos)
    .map((e) => e.node);

  return [
    {
      title: CATEGORY_TITLE['ai-model'][locale],
      url: apiRoot,
      noIndex: true,
      defaultOpen: true,
      children: aiModel,
    },
    {
      title: CATEGORY_TITLE.management[locale],
      url: apiRoot,
      noIndex: true,
      defaultOpen: false,
      children: management,
    },
  ];
}

/**
 * Sidebar label for one AI-app entry.
 *
 * The catalog names every app "<app> — <what it is>" — `AionUi - 免费开源
 * 的桌面办公Agent` — which reads well on the apps index card grid but
 * overruns a sidebar column: each row wrapped onto a second line and the
 * column stopped scanning as a list of names. Only the part ahead of the
 * separator is shown here.
 *
 * Deliberately scoped to the sidebar: the second half is what tells a
 * reader what the app *does*, which is what earns its place on the page
 * itself. Cutting it everywhere would leave each page titled with a name
 * that means nothing out of context.
 */
function appsSidebarTitle(title: string): string {
  const separator = title.indexOf(' - ');
  return separator === -1 ? title : title.slice(0, separator);
}

export function sidebarEntries(locale: DocsLocale, prefix: string): SidebarEntry[] {
  const labels = LABELS[locale];
  const guideUrl = `${prefix}/${SLUGS.guide}`;

  return [
    { title: labels.features, url: `${prefix}/${SLUGS.features}` },
    {
      title: labels.guide,
      url: guideUrl,
      /*
       * Collapsed by default: the row only expands when the user clicks
       * the chevron, or when the current page is a guide chapter
       * (folderContainsCurrent opens ancestors automatically).
       */
      defaultOpen: false,
      children: USER_GUIDE_CHAPTER_SLUGS.map((slug) => ({
        title: userGuideChapterTitle(locale, slug) ?? slug,
        url: userGuideChapterUrl(locale, slug),
        /*
         * A chapter is addressed by its path, not by a fragment of
         * another page, so there are no nested anchors to fold in.
         */
        anchors: [],
      })),
    },
    {
      title: labels.api,
      url: `${prefix}/${SLUGS.api}`,
      /*
       * `noIndex` makes the label a disclosure trigger only (no link):
       * clicking the title *or* the chevron expands the two category
       * shelves underneath, instead of navigating to the API index and
       * collapsing again. This matches the behaviour the user expects
       * from the User Guide row.
       */
      noIndex: true,
      defaultOpen: false,
      children: apiSidebarChildren(locale, prefix),
    },
    {
      title: labels.apps,
      url: `${prefix}/${SLUGS.apps}`,
      defaultOpen: false,
      children: loadSectionNav('apps', locale)
        .filter((item) => item.id !== 'index')
        .map((item) => ({
          title: appsSidebarTitle(item.title),
          url: `${prefix}/${SLUGS.apps}/${item.id}`,
          anchors: [],
        })),
    },
    {
      title: labels.userAgreement,
      url: `${prefix}/${SLUGS.legal}/user-agreement`,
    },
    { title: labels.privacyPolicy, url: `${prefix}/${SLUGS.legal}/privacy-policy` },
  ];
}
