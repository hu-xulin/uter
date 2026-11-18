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

/** Chapters are identical across locales; each locale ships every slug. */
export function userGuideChapterSlugs(
  _locale: DocsLocaleCode
): readonly string[] {
  return USER_GUIDE_CHAPTER_SLUGS
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
    '遊樂場',
    '概覽',
    '資料看板',
    'API 金鑰',
    '使用日誌',
    '審計日誌',
    '任務日誌',
    '錢包',
    '個人資料',
    '安全與存取',
    '定價',
    '排行',
  ],
  en: [
    'Login',
    'Playground',
    'Overview',
    'Dashboard',
    'API Keys',
    'Usage Logs',
    'Audit Logs',
    'Task Logs',
    'Wallet',
    'Profile',
    'Security & Access',
    'Pricing',
    'Leaderboard',
  ],
  fr: [
    'Connexion',
    'Aire de jeux',
    'Vue d’ensemble',
    'Tableau de bord',
    'Clés API',
    'Journaux d’utilisation',
    'Journaux d’audit',
    'Journaux de tâches',
    'Portefeuille',
    'Profil',
    'Sécurité et accès',
    'Tarification',
    'Classement',
  ],
  ja: [
    'ログイン',
    'プレイグラウンド',
    '概要',
    'ダッシュボード',
    'API キー',
    '利用履歴',
    '監査ログ',
    'タスク履歴',
    'ウォレット',
    'プロフィール',
    'セキュリティとアクセス',
    '価格設定',
    'ランキング',
  ],
  ru: [
    'Вход',
    'Песочница',
    'Обзор',
    'Панель',
    'Ключи API',
    'Журнал использования',
    'Журнал аудита',
    'Журнал задач',
    'Кошелек',
    'Профиль',
    'Безопасность и доступ',
    'Ценообразование',
    'Рейтинг',
  ],
  vi: [
    'Đăng nhập',
    'Sân chơi',
    'Tổng quan',
    'Bảng điều khiển',
    'Khóa API',
    'Nhật ký sử dụng',
    'Nhật ký kiểm toán',
    'Nhật ký tác vụ',
    'Ví',
    'Hồ sơ',
    'Bảo mật và truy cập',
    'Giá cả',
    'Bảng xếp hạng',
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
