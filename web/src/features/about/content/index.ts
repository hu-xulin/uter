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

import type { AboutContent } from '../about-shared'
import { EN_CONTENT } from './en'
import { FR_CONTENT } from './fr'
import { JA_CONTENT } from './ja'
import { RU_CONTENT } from './ru'
import { VI_CONTENT } from './vi'
import { ZH_CONTENT } from './zh'
import { ZH_TW_CONTENT } from './zh-TW'

/**
 * The company profile, in the reader's language — a direct port of the
 * `docs-web` `content/about.ts` lookup. Every supported locale has its
 * own module here, so a missing language is a type error rather than a
 * page of English.
 */
export const ABOUT_CONTENT_BY_LOCALE: Record<DocsLocaleCode, AboutContent> = {
  zh: ZH_CONTENT,
  'zh-TW': ZH_TW_CONTENT,
  en: EN_CONTENT,
  fr: FR_CONTENT,
  ja: JA_CONTENT,
  ru: RU_CONTENT,
  vi: VI_CONTENT,
}
