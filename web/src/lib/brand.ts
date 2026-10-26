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
/**
 * The brand mark box shared by the public header and the console top bar.
 *
 * Both surfaces must render the logo at the same size; keeping the class in one
 * place stops the two from drifting apart again (the console had shrunk to
 * `size-5` while the public header stayed at `size-7`).
 */
export const BRAND_LOGO_BOX_CLASS =
  'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg'

/*
 * Localized brand name for the public site.
 *
 * In Chinese the logo reads the localized brand only ("优特智能" / "優特智能"),
 * dropping the "Uter.ai" prefix. Every other language keeps the short
 * "Uter.ai" mark (English, Japanese, Russian, French, Vietnamese, …).
 */
export function localizedBrandName(locale?: string): string {
  const lang = (locale ?? '').toLowerCase()
  if (lang.startsWith('zh')) {
    return lang.includes('tw') || lang.includes('hant')
      ? '優特智能'
      : '优特智能'
  }
  return 'Uter.ai'
}
