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
import { Codex, DeepSeek } from '@lobehub/icons'

/**
 * 「支持的客户端」三个入口：产品名、官方站点、品牌图标。
 *
 * WorkBuddy AI 在 LobeHub 图标库里没有，所以直接用它官网当作 favicon 的那张
 * `logo.svg`（青绿圆角方块 + 白色折角），从 `public/` 静态提供，保证与官方
 * 视觉一致；另外两个用 LobeHub 的彩色产品标。图标纯装饰，语义由旁边的文字
 * 承担，因此 `alt` 为空。
 *
 * 三个地址都是官方站点（不是 GitHub 仓库、不是 .cn 域名）。这份列表是首页
 * 胶囊和回归用例的唯一来源，改地址只改这里。
 */
export const SUPPORTED_APPS = [
  {
    name: 'WorkBuddy AI',
    href: 'https://www.workbuddy.ai/',
    icon: <img src='/workbuddy-logo.svg' alt='' className='size-6 shrink-0' />,
  },
  {
    name: 'DeepSeek Harness',
    href: 'https://www.deepseek.com/harness/',
    icon: <DeepSeek.Color size={24} className='shrink-0' />,
  },
  {
    name: 'Codex',
    href: 'https://chatgpt.com/codex/',
    icon: <Codex.Color size={24} className='shrink-0' />,
  },
] as const
