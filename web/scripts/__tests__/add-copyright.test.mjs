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
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const scriptPath = fileURLToPath(
  new URL('../add-copyright.mjs', import.meta.url)
)
const canonicalHeader = `/*
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
`

let root

function runCheck(source) {
  root = mkdtempSync(join(tmpdir(), 'uter-copyright-check-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  mkdirSync(join(root, 'scripts'), { recursive: true })
  writeFileSync(join(root, 'src', 'fixture.ts'), source)
  return spawnSync(process.execPath, [scriptPath, '--check'], {
    cwd: root,
    encoding: 'utf8',
  })
}

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = undefined
})

describe('copyright header check', () => {
  it('accepts the canonical Uter header without requesting an update', () => {
    const result = runCheck(`${canonicalHeader}export const fixture = true\\n`)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('checked 1')
  })

  it('fails closed when a source file has no project header', () => {
    const result = runCheck('export const fixture = true\\n')

    expect(result.status).toBe(1)
  })
})
