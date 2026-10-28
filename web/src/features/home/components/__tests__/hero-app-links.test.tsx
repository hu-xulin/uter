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
import { render } from '@testing-library/react'
import { expect, it } from 'vitest'

import { SUPPORTED_APPS } from '../supported-apps'

// The three pills under "Supported Applications" send readers to the products
// themselves, so the destinations are official product sites — not the GitHub
// repositories and not the older `.cn` domain that used to be listed here.
it('points every supported-app pill at its official product site', () => {
  expect(SUPPORTED_APPS.map((app) => [app.name, app.href])).toEqual([
    ['WorkBuddy AI', 'https://www.workbuddy.ai/'],
    ['DeepSeek Harness', 'https://www.deepseek.com/harness/'],
    ['Codex', 'https://chatgpt.com/codex/'],
  ])
})

// WorkBuddy AI has no LobeHub icon, and the hand-drawn placeholder that used to
// stand in for it was not the product's mark. The pill now renders the official
// logo shipped from `public/`, which is the same artwork the product's own site
// uses as its favicon.
it('renders the official WorkBuddy AI logo instead of a placeholder', () => {
  const [workbuddy] = SUPPORTED_APPS

  const { container } = render(workbuddy.icon)
  const logo = container.querySelector('img')

  expect(logo).not.toBeNull()
  expect(logo?.getAttribute('src')).toBe('/workbuddy-logo.svg')
  // Decorative: the pill's text carries the product name.
  expect(logo?.getAttribute('alt')).toBe('')
})
