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

import { RequestPluginRecordsSection } from '../dialogs/details-dialog'

test('summarizes each request plugin run without leaking values', () => {
  render(
    <RequestPluginRecordsSection
      records={[
        {
          plugin: 'pii',
          name: { en: 'PII Guard' },
          stage: 'ingress',
          changes: [
            { op: 'replace', path: '/messages/0/content' },
            { op: 'remove', path: '/metadata/email' },
          ],
          findings: [{ category: 'email', count: 2 }],
        },
        {
          plugin: 'policy',
          stage: 'request',
          rejected: { code: 'policy.blocked' },
          unchecked: true,
        },
      ]}
    />
  )

  expect(screen.getByText('Request plugins')).toBeVisible()
  expect(screen.getByText('PII Guard')).toBeVisible()
  expect(screen.getByText(/2 changes/)).toBeVisible()
  expect(screen.getByText(/2 findings/)).toBeVisible()
  expect(screen.getByText(/Rejected: policy\.blocked/)).toBeVisible()
  expect(screen.getByText(/Not checked/)).toBeVisible()
  expect(screen.queryByText(/metadata\/email/)).not.toBeInTheDocument()
})