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
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import type { SelectedPricingReadiness } from '../../lib/pricing-readiness'
import { PricingReadinessSummary } from '../pricing-readiness-summary'

const ready: SelectedPricingReadiness = {
  selected: 2,
  configured: 2,
  blocking: [],
  missing: [],
  pending: [],
}

const pending: SelectedPricingReadiness = {
  selected: 2,
  configured: 1,
  blocking: ['review-a (needs_review)'],
  missing: ['no-row (missing)'],
  pending: ['review-a (needs_review)', 'no-row (missing)'],
}

test('shows a readiness summary only when models are selected', () => {
  const { container } = render(
    <PricingReadinessSummary
      readiness={{ ...ready, selected: 0, configured: 0 }}
    />
  )
  expect(container).toBeEmptyDOMElement()
})

test('reports a billable-ready channel without blocking publish', () => {
  render(<PricingReadinessSummary readiness={ready} />)

  expect(screen.getByText('Billing readiness')).toBeTruthy()
  expect(screen.getByText(/billable sale price/)).toBeTruthy()
  expect(screen.queryByText('Publish blocked by pricing')).toBeNull()
})

test('lists blocking and missing models from the selected set', () => {
  render(<PricingReadinessSummary readiness={pending} />)

  expect(screen.getByText('Billing readiness')).toBeTruthy()
  expect(screen.getByText(/review-a \(needs_review\)/)).toBeTruthy()
  expect(screen.getByText(/no-row \(missing\)/)).toBeTruthy()
})

test('an inline pre-submit check makes the blocker explicit', () => {
  render(<PricingReadinessSummary readiness={pending} blocked />)

  expect(screen.getByText('Publish blocked by pricing')).toBeTruthy()
  expect(screen.getByText(/review-a \(needs_review\)/)).toBeTruthy()
})

test('a fixed price clears the stale blocker title', () => {
  render(<PricingReadinessSummary readiness={ready} blocked />)

  expect(screen.getByText('Billing readiness')).toBeTruthy()
  expect(screen.queryByText('Publish blocked by pricing')).toBeNull()
})
