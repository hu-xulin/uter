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
import { expect, it } from 'vitest'

import { DOCS_IFRAME_SANDBOX } from '../docs-viewer'

/**
 * 文档站 iframe 的 sandbox 守卫测试。
 *
 * 缺陷背景：文档站（Next.js 静态导出）被装进 SPA 的 iframe 里展示，iframe
 * 当时的 sandbox 只有 `allow-scripts allow-same-origin`。文档站头部却有指向
 * **顶层**的链接 ——「登录」指向 SPA 的 `/sign-in`，logo 指向 `/`
 * （见 docs-web/src/lib/docs-header.tsx）。
 *
 * sandbox 缺 `allow-top-navigation-by-user-activation` 时，iframe 内的顶层
 * 导航会被浏览器**静默拦截**：点了「登录」，页面纹丝不动，没有报错、没有
 * console 输出 —— 用户观感就是「点登录就崩」。
 *
 * 该失败模式是纯静默的，因此除了这条断言没有别的东西能挡住它被移除。
 */
it('文档站 iframe 必须允许用户激活触发的顶层导航', () => {
  expect(DOCS_IFRAME_SANDBOX).toContain(
    'allow-top-navigation-by-user-activation'
  )
})

it('文档站 iframe 仍保留脚本与同源（embed bridge 依赖）', () => {
  // 这两项是主题/路由 postMessage 桥的前提，移除会让文档站的消息全部被拒。
  expect(DOCS_IFRAME_SANDBOX).toContain('allow-scripts')
  expect(DOCS_IFRAME_SANDBOX).toContain('allow-same-origin')
})

it('文档站 iframe 不放开无条件的顶层导航', () => {
  // allow-top-navigation（不带 -by-user-activation）允许 iframe 随时把顶层
  // 窗口导航到任意地址 —— 那是脚本驱动跳转，不需要用户点击。只允许
  // 「用户激活触发的」这一种。
  const tokens = DOCS_IFRAME_SANDBOX.split(/\s+/).filter(Boolean)
  expect(tokens).not.toContain('allow-top-navigation')
})
