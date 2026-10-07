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

import {
  DASHBOARD_ROOTS,
  pageKeyForPath,
  shouldShowCustomerService,
  type CustomerServicePageKey,
} from '../page-keys'

describe('pageKeyForPath', () => {
  it('maps the six configured page groups', () => {
    expect(pageKeyForPath('/')).toBe('home')
    expect(pageKeyForPath('/dashboard')).toBe('dashboard')
    expect(pageKeyForPath('/pricing')).toBe('pricing')
    expect(pageKeyForPath('/rankings')).toBe('rankings')
    expect(pageKeyForPath('/docs')).toBe('docs')
    expect(pageKeyForPath('/about')).toBe('about')
  })

  it('treats the home page as an exact match only', () => {
    // 这是最容易写错的一条：'/' 是所有路径的祖先，若用前缀匹配，
    // 任何页面都会被算成首页、页面开关等于失效。
    expect(pageKeyForPath('/pricing')).not.toBe('home')
    expect(pageKeyForPath('/docs/user-guide')).not.toBe('home')
    expect(pageKeyForPath('/anything-else')).not.toBe('home')
  })

  it('matches nested routes back to their group', () => {
    expect(pageKeyForPath('/docs/user-guide/zh/model-testing')).toBe('docs')
    expect(pageKeyForPath('/pricing/gpt-4')).toBe('pricing')
    expect(pageKeyForPath('/about/team')).toBe('about')
    expect(pageKeyForPath('/rankings/top')).toBe('rankings')
  })

  it('requires a segment boundary so lookalike paths do not match', () => {
    // '/pricing-foo' 与 '/about-me' 都不是定价页/关于页。
    expect(pageKeyForPath('/pricing-foo')).toBeNull()
    expect(pageKeyForPath('/about-me')).toBeNull()
    expect(pageKeyForPath('/ranking')).toBeNull()
    expect(pageKeyForPath('/docsearch')).toBeNull()
  })

  it('maps every control panel route to the dashboard group', () => {
    for (const root of DASHBOARD_ROOTS) {
      expect(pageKeyForPath(root)).toBe('dashboard')
      // 子路由同样归入控制台。
      expect(pageKeyForPath(`${root}/detail`)).toBe('dashboard')
    }
  })

  it('returns null for routes outside every configured group', () => {
    expect(pageKeyForPath('/sign-in')).toBeNull()
    expect(pageKeyForPath('/register')).toBeNull()
    expect(pageKeyForPath('/privacy-policy')).toBeNull()
    expect(pageKeyForPath('/user-agreement')).toBeNull()
  })

  it('is case insensitive and tolerates an empty path', () => {
    expect(pageKeyForPath('/Pricing')).toBe('pricing')
    expect(pageKeyForPath('')).toBe('home')
  })
})

describe('shouldShowCustomerService', () => {
  const all: CustomerServicePageKey[] = [
    'home',
    'dashboard',
    'pricing',
    'rankings',
    'docs',
    'about',
  ]

  it('shows the entry everywhere when the backend sends no page list', () => {
    // null = 后端未升级、字段缺失。必须沿用旧行为「全开」，
    // 否则升级后所有页面的入口会一起消失。
    expect(shouldShowCustomerService('/', null)).toBe(true)
    expect(shouldShowCustomerService('/pricing', null)).toBe(true)
    expect(shouldShowCustomerService('/sign-in', null)).toBe(true)
  })

  it('shows the entry only on the listed pages', () => {
    const pages: CustomerServicePageKey[] = ['home', 'docs']
    expect(shouldShowCustomerService('/', pages)).toBe(true)
    expect(shouldShowCustomerService('/docs/user-guide', pages)).toBe(true)
    expect(shouldShowCustomerService('/pricing', pages)).toBe(false)
    expect(shouldShowCustomerService('/dashboard', pages)).toBe(false)
  })

  it('hides the entry everywhere when the list is empty', () => {
    // 空数组 = 运营把所有页面都关了，与「字段缺失」是两种不同的语义。
    expect(shouldShowCustomerService('/', [])).toBe(false)
    expect(shouldShowCustomerService('/pricing', [])).toBe(false)
  })

  it('hides the entry on pages outside every group even when all are listed', () => {
    // 登录页等不属于任何分组：即便六项全开也不显示。
    expect(shouldShowCustomerService('/sign-in', all)).toBe(false)
    expect(shouldShowCustomerService('/', all)).toBe(true)
  })
})
