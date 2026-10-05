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
import { useTranslation } from 'react-i18next'

import { DocsExportFrame } from '@/components/docs-export-frame'
import { aboutPathFor, resolveDocsLocaleCode } from '@/lib/docs-link'

/**
 * In-app About page for `/about`.
 *
 * The About content is the company profile (`项目介绍`), authored in
 * `docs-web` and exported statically next to the docs site. It is
 * rendered the same way the docs are: the SPA shell stays, and the
 * export is framed underneath it, so the page keeps the app's own
 * navigation and reads as one more page of the app rather than a
 * separate site.
 *
 * One page per locale, so switching the UI language re-points the
 * frame at the same document in the other language.
 */
export function AboutViewer() {
  const { t, i18n } = useTranslation()
  const frameSrc = aboutPathFor(resolveDocsLocaleCode(i18n.language))

  return <DocsExportFrame src={frameSrc} title={t('About')} />
}
