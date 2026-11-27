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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SOURCE = join(
  process.cwd(),
  'src/features/upstream-monitor/components/billing-probe-settings-card.tsx'
)

describe('billing probe settings card', () => {
  const source = readFileSync(SOURCE, 'utf8')

  it('mirrors the server switch value and lets the user turn it off', () => {
    expect(source).toContain(
      'const effectiveEnabled = pendingEnabled ?? serverEnabled'
    )
    expect(source).toContain('checked={effectiveEnabled}')
    expect(source).toContain(
      'onCheckedChange={(checked) => setPendingEnabled(checked)}'
    )
    expect(source).not.toContain('useEffect')
  })

  it('only submits credentials and option values that actually changed', () => {
    expect(source).toContain("if (token.trim() !== '')")
    expect(source).toContain(
      'if (pendingEnabled !== null && pendingEnabled !== serverEnabled)'
    )
  })
})
