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
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import {
  ABOUT_SECTION_SLUGS,
  type AboutSectionSlug,
} from '@/features/about/about-shared'
import { AboutSectionViewer } from '@/features/about'

/**
 * One chapter of the company profile at `/about/<slug>`.
 *
 * The framed export used `/about/<lang>/<slug>/`; the SPA keeps a single
 * locale-free slug and switches language through the UI locale, the same
 * way every other public page does. An unknown slug goes back to the
 * index instead of rendering a blank article.
 */
export const Route = createFileRoute('/_public/about/$section')({
  component: AboutSectionRoute,
})

function AboutSectionRoute() {
  const { section } = Route.useParams()
  const navigate = useNavigate()
  const valid = ABOUT_SECTION_SLUGS.includes(section as AboutSectionSlug)

  useEffect(() => {
    if (valid) return
    navigate({ to: '/about', replace: true })
  }, [valid, navigate])

  if (!valid) return null
  return <AboutSectionViewer section={section} />
}
