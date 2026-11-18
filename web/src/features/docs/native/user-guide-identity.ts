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
import type { DocsLocaleCode } from '@/lib/docs-link'

/**
 * The user guide's identity for the native docs sidebar — a client-side
 * port of `docs-web/src/lib/content/user-guide.ts`'s chapter table.
 *
 * A chapter's *body* comes from `docs-content/user-guide/<locale>/<slug>.mdx`
 * (once migrated), but its *name* has to exist for all seven languages
 * whether or not that file is migrated yet — otherwise the native sidebar
 * loses a chapter in exactly the languages still being filled in.
 *
 * Keyed by {@link USER_GUIDE_CHAPTER_SLUGS} in the same order, so the
 * labels cannot drift out of alignment with the chapter list.
 */

/** Where the guide's pages live under a locale root. */
export const USER_GUIDE_PATH = 'guide/wiki/user-guide'

/**
 * The guide's chapters, in sidebar order. Slugs are locale-neutral, like
 * the rest of the site: one URL serves `zh` and `en`, which is what lets
 * a UI-language switch keep the reader on the same chapter.
 */
export const USER_GUIDE_CHAPTER_SLUGS = [
  'auth',
  'dashboard',
  'profile-and-security',
  'api-keys',
  'api-and-playground',
  'app-integration',
  'logs-and-tasks',
  'wallet-and-subscription',
  'pricing-and-ranking',
] as const

/** Chinese guide chapters, in the product navigation order. */
export const USER_GUIDE_CHAPTER_SLUGS_ZH = [
  'auth',
  'playground',
  'overview',
  'dashboard',
  'api-keys',
  'usage-logs',
  'audit-logs',
  'task-logs',
  'wallet',
  'profile',
  'security',
  'pricing',
  'ranking',
] as const

export function userGuideChapterSlugs(
  locale: DocsLocaleCode
): readonly string[] {
  return locale === 'zh' ? USER_GUIDE_CHAPTER_SLUGS_ZH : USER_GUIDE_CHAPTER_SLUGS
}

const CHAPTER_LABELS: Record<DocsLocaleCode, string[]> = {
  zh: [
    '登录',
    '游乐场',
    '概览',
    '数据看板',
    'API 密钥',
    '使用日志',
    '审计日志',
    '任务日志',
    '钱包',
    '个人资料',
    '安全与访问',
    '定价',
    '排行',
  ],
  'zh-TW': [
    '登入',
    '概覽與資料儀表板',
    '個人資料與安全性',
    'API 金鑰',
    '遊樂場',
    '聊天應用整合',
    '日誌與任務',
    '錢包',
    '定價與排行',
  ],
  en: [
    'Login',
    'Overview & Dashboard',
    'Profile & Security',
    'API Keys',
    'Playground',
    'App Integration',
    'Logs & Tasks',
    'Wallet',
    'Model Hub & Leaderboard',
  ],
  fr: [
    'Connexion',
    'Vue d’ensemble et tableau de bord',
    'Profil et sécurité',
    'Clés API',
    'Bac à sable',
    'Intégration d’applications',
    'Journaux et tâches',
    'Portefeuille',
    'Hub de modèles et classement',
  ],
  ja: [
    'ログイン',
    '概要とダッシュボード',
    'プロフィールとセキュリティ',
    'API キー',
    'プレイグラウンド',
    'アプリ連携',
    'ログとタスク',
    'ウォレット',
    'モデルハブとランキング',
  ],
  ru: [
    'Вход',
    'Обзор и панель',
    'Профиль и безопасность',
    'API-ключи',
    'Песочница',
    'Интеграция приложений',
    'Журналы и задачи',
    'Кошелёк',
    'Каталог моделей и рейтинг',
  ],
  vi: [
    'Đăng nhập',
    'Tổng quan và bảng điều khiển',
    'Hồ sơ và bảo mật',
    'Khóa API',
    'Khu thử nghiệm',
    'Tích hợp ứng dụng',
    'Nhật ký và tác vụ',
    'Ví',
    'Trung tâm mô hình và bảng xếp hạng',
  ],
}

/** Position of a slug in the guide, or `-1`. */
export function userGuideChapterIndex(
  slug: string,
  locale: DocsLocaleCode = 'zh'
): number {
  return userGuideChapterSlugs(locale).indexOf(slug)
}

/**
 * A chapter's label in the reader's language, so a language with a
 * translated label but no migrated Markdown file yet still shows a real
 * name instead of a raw slug.
 */
export function userGuideChapterTitle(
  locale: DocsLocaleCode,
  slug: string
): string | undefined {
  const index = userGuideChapterIndex(slug, locale)
  if (index === -1) return undefined
  return CHAPTER_LABELS[locale][index]
}
