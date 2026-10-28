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
import { describe, expect, it } from 'vitest'

import { formatUserId, parseUserId } from '../format'

/**
 * 对外用户编号的唯一契约。
 *
 * 2026-10-28 起前缀从 `uter` 改为 `U`（`uter100000003` → `U100000003`），
 * 数字部分（偏移 1e8）不变。这条规则同时被后端 `controller/audit.go` 的
 * `formatUserDisplayId` 使用 —— 两端必须一致，否则同一个人会在用户列表、
 * 审计日志、计费历史里显示成两个 ID。
 */
describe('formatUserId', () => {
  it('prefixes the offset id with U', () => {
    expect(formatUserId(3)).toBe('U100000003')
    expect(formatUserId(1)).toBe('U100000001')
    expect(formatUserId(42)).toBe('U100000042')
  })

  it('never emits the retired uter prefix', () => {
    expect(formatUserId(7)).not.toContain('uter')
  })

  it('returns non-positive ids unchanged', () => {
    expect(formatUserId(0)).toBe('0')
    expect(formatUserId(-1)).toBe('-1')
  })
})

describe('parseUserId', () => {
  it('round-trips the current display form', () => {
    expect(parseUserId(formatUserId(3))).toBe(3)
  })

  it('accepts the retired uter prefix so old pasted ids still resolve', () => {
    expect(parseUserId('uter100000042')).toBe(42)
    expect(parseUserId('UTER100000042')).toBe(42)
  })

  it('accepts lower-case u and surrounding spaces', () => {
    expect(parseUserId('  u100000042  ')).toBe(42)
  })

  it('accepts bare numeric ids', () => {
    expect(parseUserId('42')).toBe(42)
    expect(parseUserId(42)).toBe(42)
  })

  it('rejects empty and unparseable input', () => {
    expect(parseUserId('')).toBe(0)
    expect(parseUserId('abc')).toBe(0)
  })
})
