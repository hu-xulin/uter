import type { DocsLocale } from '../i18n';

/**
 * Content for the About page (`/about/<lang>/`).
 *
 * Transcribed from the company profile deck (「项目介绍」) — the Chinese
 * and English halves of that document are two independent write-ups of
 * the same nine chapters, not translations of each other, so both are
 * carried verbatim rather than derived.
 *
 * Shape mirrors the document's own outline, and every heading in the
 * document gets exactly one entry here:
 *
 *   - `sections`    — the nine numbered chapters (`01 — …` … `09 — …`),
 *                     rendered as `h2` and listed in the sidebar and TOC.
 *   - `subSections` — the headings nested inside a chapter, rendered as
 *                     `h3` and listed one level deeper in both.
 *
 * Two headings do not survive as headings, both because they name a
 * single value rather than open a topic:
 *
 *   - the founder's line (`胡旭林｜创始人兼首席执行官`) becomes
 *     `profile`, drawn as a name/role block under 「创始人」;
 *   - the contact addresses (`bd@…`) become `email`, drawn as the
 *     chapter's only link.
 *
 * The partner chapters also carry an instruction to the designer in the
 * source document (asking for a logo wall). That is a production note,
 * not page copy, and is deliberately not reproduced.
 *
 * ---------------------------------------------------------------------------
 * Shared, locale-neutral pieces
 * ---------------------------------------------------------------------------
 *
 * The nine chapters' prose is *not* here: it lives in
 * `./about-content/<locale>.ts`, one module per language, so a translator
 * editing (say) the French copy cannot collide with one editing Russian.
 * This file holds only what is identical in every language -- the shapes
 * the prose is written in, the chapter order, the URL helper, and the
 * partner wall, whose brand names differ per locale by design.
 */

export type AboutEntry = {
  label: string;
  value: string;
};

export type AboutSubSection = {
  heading: string;
  paragraphs?: string[];
  /** Rows of `label` + description, e.g. the partner categories. */
  entries?: AboutEntry[];
  /** The one address this heading introduces, rendered as a `mailto:` link. */
  email?: string;
  /**
   * Name, role and optional portrait, drawn as a profile block rather
   * than a heading. `avatar` is a root-relative URL: the portrait is a
   * file under `public/`, not an imported asset.
   */
  profile?: { name: string; role: string; avatar?: string };
};

/**
 * A model brand in the partner wall.
 *
 * `name` and `company` are per-locale because a brand does not read the
 * same way in both languages: the Chinese page says 「通义千问」 where the
 * English one says `Qwen`, and the company behind it is 「阿里巴巴」 or
 * `Alibaba`. The `id` is locale-neutral, and `group` splits the wall into
 * the two rows the chapter talks about.
 */
export type AboutPartner = {
  id: string;
  group: 'global' | 'china';
  name: Record<DocsLocale, string>;
  company: Record<DocsLocale, string>;
};

export type AboutSection = {
  heading: string;
  subSections?: AboutSubSection[];
  /** Lines that close the chapter, drawn after its sub-sections. */
  closing?: string[];
  /**
   * Brands drawn as a wall at the foot of the chapter, under their
   * origin heading. Only 「我们的合作伙伴」 carries one.
   */
  partnerWall?: AboutPartner[];
};

export type AboutContent = {
  title: string;
  description: string;
  sections: AboutSection[];
};

/**
 * URL segment per chapter, in document order. Locale-neutral, so
 * `/about/zh/our-team/` and `/about/en/our-team/` are the same page in
 * two languages — which is what lets the language switch and the search
 * index address a chapter without knowing which locale is live.
 *
 * Positional rather than a field on each chapter: both locales carry the
 * same nine chapters in the same order, and repeating the slug eighteen
 * times would let the two lists drift apart. `getAboutSection()` is the
 * only reader, and it bounds-checks.
 */
export const ABOUT_SECTION_SLUGS = [
  'who-we-are',
  'what-we-do',
  'our-team',
  'our-mission',
  'our-values',
  'our-story',
  'our-partners',
  'join-us',
  'contact-us',
] as const;

export type AboutSectionSlug = (typeof ABOUT_SECTION_SLUGS)[number];

/** Where a chapter lives. Trailing slash matches the export's canonical form. */

export function aboutSectionUrl(locale: DocsLocale, index: number): string {
  return `/about/${locale}/${ABOUT_SECTION_SLUGS[index]}/`;
}

/**
 * The model brands shown at the foot of 「我们的合作伙伴」.
 *
 * Grouped the way the chapter's own prose groups them — the models the
 * platform connects from outside China, then the ones from inside it.
 * Every entry has to correspond to an upstream the gateway really
 * serves (see `relay/channel/`), so the wall stays a description of the
 * product rather than a wish list.
 *
 * `id` is also the mark's filename in `public/img/partners/`. Marks come
 * from the MIT-licensed `@lobehub/icons-static-svg` set; they are
 * monochrome on purpose, so a single file serves both themes.
 *
 * Exported because each `about-content/<locale>.ts` attaches the same
 * wall to its 「我们的合作伙伴」 chapter — the brands are already per-locale
 * inside, so the wall itself is shared rather than copied seven times.
 */
export const PARTNER_WALL: AboutPartner[] = [
  {
    id: 'openai',
    group: 'global',
    name: { zh: 'GPT', 'zh-TW': 'GPT', en: 'GPT', fr: 'GPT', ja: 'GPT', ru: 'GPT', vi: 'GPT' },
    company: { zh: 'OpenAI', 'zh-TW': 'OpenAI', en: 'OpenAI', fr: 'OpenAI', ja: 'OpenAI', ru: 'OpenAI', vi: 'OpenAI' },
  },
  {
    id: 'anthropic',
    group: 'global',
    name: { zh: 'Claude', 'zh-TW': 'Claude', en: 'Claude', fr: 'Claude', ja: 'Claude', ru: 'Claude', vi: 'Claude' },
    company: { zh: 'Anthropic', 'zh-TW': 'Anthropic', en: 'Anthropic', fr: 'Anthropic', ja: 'Anthropic', ru: 'Anthropic', vi: 'Anthropic' },
  },
  {
    id: 'google',
    group: 'global',
    name: { zh: 'Gemini', 'zh-TW': 'Gemini', en: 'Gemini', fr: 'Gemini', ja: 'Gemini', ru: 'Gemini', vi: 'Gemini' },
    company: { zh: 'Google', 'zh-TW': 'Google', en: 'Google', fr: 'Google', ja: 'Google', ru: 'Google', vi: 'Google' },
  },
  {
    id: 'xai',
    group: 'global',
    name: { zh: 'Grok', 'zh-TW': 'Grok', en: 'Grok', fr: 'Grok', ja: 'Grok', ru: 'Grok', vi: 'Grok' },
    company: { zh: 'xAI', 'zh-TW': 'xAI', en: 'xAI', fr: 'xAI', ja: 'xAI', ru: 'xAI', vi: 'xAI' },
  },
  {
    id: 'mistral',
    group: 'global',
    name: { zh: 'Mistral', 'zh-TW': 'Mistral', en: 'Mistral', fr: 'Mistral', ja: 'Mistral', ru: 'Mistral', vi: 'Mistral' },
    company: { zh: 'Mistral AI', 'zh-TW': 'Mistral AI', en: 'Mistral AI', fr: 'Mistral AI', ja: 'Mistral AI', ru: 'Mistral AI', vi: 'Mistral AI' },
  },
  {
    id: 'cohere',
    group: 'global',
    name: { zh: 'Command', 'zh-TW': 'Command', en: 'Command', fr: 'Command', ja: 'Command', ru: 'Command', vi: 'Command' },
    company: { zh: 'Cohere', 'zh-TW': 'Cohere', en: 'Cohere', fr: 'Cohere', ja: 'Cohere', ru: 'Cohere', vi: 'Cohere' },
  },
  {
    id: 'deepseek',
    group: 'china',
    name: { zh: 'DeepSeek', 'zh-TW': 'DeepSeek', en: 'DeepSeek', fr: 'DeepSeek', ja: 'DeepSeek', ru: 'DeepSeek', vi: 'DeepSeek' },
    company: { zh: '深度求索', 'zh-TW': '深度求索', en: 'DeepSeek', fr: 'DeepSeek', ja: 'DeepSeek', ru: 'DeepSeek', vi: 'DeepSeek' },
  },
  {
    id: 'qwen',
    group: 'china',
    name: { zh: '通义千问', 'zh-TW': '通義千問', en: 'Qwen', fr: 'Qwen', ja: 'Qwen', ru: 'Qwen', vi: 'Qwen' },
    company: { zh: '阿里巴巴', 'zh-TW': '阿里巴巴', en: 'Alibaba', fr: 'Alibaba', ja: 'Alibaba', ru: 'Alibaba', vi: 'Alibaba' },
  },
  {
    id: 'hunyuan',
    group: 'china',
    name: { zh: '混元', 'zh-TW': '混元', en: 'Hunyuan', fr: 'Hunyuan', ja: 'Hunyuan', ru: 'Hunyuan', vi: 'Hunyuan' },
    company: { zh: '腾讯', 'zh-TW': '騰訊', en: 'Tencent', fr: 'Tencent', ja: 'Tencent', ru: 'Tencent', vi: 'Tencent' },
  },
  {
    id: 'doubao',
    group: 'china',
    name: { zh: '豆包', 'zh-TW': '豆包', en: 'Doubao', fr: 'Doubao', ja: 'Doubao', ru: 'Doubao', vi: 'Doubao' },
    company: { zh: '字节跳动', 'zh-TW': '字節跳動', en: 'ByteDance', fr: 'ByteDance', ja: 'ByteDance', ru: 'ByteDance', vi: 'ByteDance' },
  },
  {
    id: 'glm',
    group: 'china',
    name: { zh: '智谱 GLM', 'zh-TW': '智譜 GLM', en: 'Zhipu GLM', fr: 'Zhipu GLM', ja: 'Zhipu GLM', ru: 'Zhipu GLM', vi: 'Zhipu GLM' },
    company: { zh: '智谱 AI', 'zh-TW': '智譜 AI', en: 'Zhipu AI', fr: 'Zhipu AI', ja: 'Zhipu AI', ru: 'Zhipu AI', vi: 'Zhipu AI' },
  },
  {
    id: 'kimi',
    group: 'china',
    name: { zh: 'Kimi', 'zh-TW': 'Kimi', en: 'Kimi', fr: 'Kimi', ja: 'Kimi', ru: 'Kimi', vi: 'Kimi' },
    company: { zh: '月之暗面', 'zh-TW': '月之暗面', en: 'Moonshot AI', fr: 'Moonshot AI', ja: 'Moonshot AI', ru: 'Moonshot AI', vi: 'Moonshot AI' },
  },
];

/** Row labels the wall is drawn under, matching the chapter's own wording. */

export const PARTNER_GROUP_LABELS: Record<
  AboutPartner['group'],
  Record<DocsLocale, string>
> = {
  global: {
    zh: '国外大模型',
    'zh-TW': '國外大模型',
    en: 'Global models',
    fr: 'Modèles mondiaux',
    ja: 'グローバルモデル',
    ru: 'Мировые модели',
    vi: 'Mô hình toàn cầu',
  },
  china: {
    zh: '国内大模型',
    'zh-TW': '國內大模型',
    en: 'Models from China',
    fr: 'Modèles chinois',
    ja: '中国のモデル',
    ru: 'Китайские модели',
    vi: 'Mô hình Trung Quốc',
  },
};

/**
 * The founder's portrait, served from `public/about-assets/`.
 *
 * Root-relative and outside `/about/`, so the URL cannot be confused with
 * the SPA's own `/about` route when the page is framed.
 */

export const FOUNDER_AVATAR = '/about-assets/founder.jpg';

