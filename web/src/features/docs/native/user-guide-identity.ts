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

const CHAPTER_LABELS: Record<DocsLocaleCode, string[]> = {
  zh: [
    '注册与登录',
    '概览与数据看板',
    '个人资料与安全',
    'API 密钥',
    '使用 API 与游乐场',
    '聊天应用集成',
    '日志与异步任务',
    '钱包与订阅',
    '定价和排行',
  ],
  'zh-TW': [
    '註冊與登入',
    '概覽與資料儀表板',
    '個人資料與安全性',
    'API 金鑰',
    '使用 API 與遊樂場',
    '聊天應用整合',
    '日誌與非同步任務',
    '錢包與訂閱',
    '定價與排行',
  ],
  en: [
    'Registration & Login',
    'Overview & Dashboard',
    'Profile & Security',
    'API Keys',
    'Using the API & Playground',
    'App Integration',
    'Logs & Async Tasks',
    'Wallet & Subscription',
    'Model Hub & Leaderboard',
  ],
  fr: [
    'Inscription et connexion',
    'Vue d’ensemble et tableau de bord',
    'Profil et sécurité',
    'Clés API',
    'Utiliser l’API et le bac à sable',
    'Intégration d’applications',
    'Journaux et tâches asynchrones',
    'Portefeuille et abonnement',
    'Hub de modèles et classement',
  ],
  ja: [
    '登録とログイン',
    '概要とダッシュボード',
    'プロフィールとセキュリティ',
    'API キー',
    'API とプレイグラウンド',
    'アプリ連携',
    'ログと非同期タスク',
    'ウォレットとサブスクリプション',
    'モデルハブとランキング',
  ],
  ru: [
    'Регистрация и вход',
    'Обзор и панель',
    'Профиль и безопасность',
    'API-ключи',
    'Работа с API и песочницей',
    'Интеграция приложений',
    'Журналы и асинхронные задачи',
    'Кошелёк и подписка',
    'Каталог моделей и рейтинг',
  ],
  vi: [
    'Đăng ký và đăng nhập',
    'Tổng quan và bảng điều khiển',
    'Hồ sơ và bảo mật',
    'Khóa API',
    'Sử dụng API và khu thử nghiệm',
    'Tích hợp ứng dụng',
    'Nhật ký và tác vụ bất đồng bộ',
    'Ví và gói đăng ký',
    'Trung tâm mô hình và bảng xếp hạng',
  ],
}

/** Position of a slug in the guide, or `-1`. */
export function userGuideChapterIndex(slug: string): number {
  return (USER_GUIDE_CHAPTER_SLUGS as readonly string[]).indexOf(slug)
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
  const index = userGuideChapterIndex(slug)
  if (index === -1) return undefined
  return CHAPTER_LABELS[locale][index]
}
