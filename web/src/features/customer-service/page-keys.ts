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
 * 智能客服入口的页面分组。
 *
 * 这里刻意做成**纯函数模块**（不含 React/JSX）：路由 → 页面键的映射规则是本功能
 * 最容易悄悄失配的部分（新增页面、改路由结构都会让它漂移），抽出后可直接被单测
 * 钉住，而不必渲染整个挂件。
 *
 * 页面键必须与后端 common/env.go 的 CustomerServicePageKeys 逐字一致。
 */
export type CustomerServicePageKey =
  | 'home'
  | 'dashboard'
  | 'pricing'
  | 'rankings'
  | 'docs'
  | 'about'

// 登录后的控制台一级路径。TanStack Router 的 _authenticated 路由组不进 URL，
// 需按 web/src/routes/_authenticated 下的一级目录枚举。
//
// ⚠️ 该清单必须与该目录**保持一致**：漏一个会让页面被误判为「未命中」，于是运营
// 明明开了「管理」开关却看不到入口。新增控制台一级页面时必须同步补上，
// TestDashboardRootsCoverEveryAuthenticatedRoute 会守住这条。
export const DASHBOARD_ROOTS = [
  '/dashboard',
  '/models',
  '/channels',
  '/keys',
  '/usage-logs',
  '/organization',
  '/subscriptions',
  '/playground',
  '/chat',
  '/chat2link',
  '/security',
  '/profile',
  '/wallet',
  '/users',
  '/redemption-codes',
  '/system-info',
  '/system-settings',
  '/task-plugins',
] as const

/**
 * 把当前路由路径映射为智能客服的页面分组键；不属于任何分组时返回 null
 * （调用方据此隐藏入口）。
 *
 * 两条关键规则：
 *  1. `/` **精确匹配**才算首页。它同时是所有路径的祖先，若用前缀匹配，
 *     任何页面都会被算成首页、等于页面开关失效。
 *  2. 其余路径按**带段边界**的前缀匹配：`/pricing` 不应命中 `/pricing-foo`。
 */
export function pageKeyForPath(
  pathname: string
): CustomerServicePageKey | null {
  const path = (pathname || '').toLowerCase()
  if (path === '/' || path === '') return 'home'

  const hits = (prefix: string) =>
    path === prefix || path.startsWith(`${prefix}/`)

  if (hits('/pricing')) return 'pricing'
  if (hits('/rankings')) return 'rankings'
  if (hits('/docs')) return 'docs'
  if (hits('/about')) return 'about'

  for (const root of DASHBOARD_ROOTS) {
    if (hits(root)) return 'dashboard'
  }

  return null
}

/**
 * 当前页面是否应显示智能客服入口。
 *
 * - `pages === null`：后端未下发页面级字段（未升级），沿用旧行为「全部显示」；
 * - `pages` 为空数组：运营把所有页面都关了，任何页面都不显示；
 * - 否则要求 `pathname` 能映射出页面键，且该键在白名单内。
 */
export function shouldShowCustomerService(
  pathname: string,
  pages: CustomerServicePageKey[] | null
): boolean {
  if (pages === null) return true
  const current = pageKeyForPath(pathname)
  return current !== null && pages.includes(current)
}
