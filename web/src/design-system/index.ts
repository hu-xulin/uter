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
 * UTER Design System —— 唯一入口。
 *
 * ## 分层
 *
 * ```
 * tokens/       设计值（CSS 变量）：字号、间距、颜色、圆角、阴影
 * foundations/  全局基础样式：排版工具类、无障碍、动效
 * components/   语义组件：Text / Heading
 * patterns/     交互模式：PageHeader
 * ```
 *
 * ## 与 `components/ui/` 的边界（重要）
 *
 * 文档要求「选择一个作为正式实现位置，另一个仅在迁移期间兼容」。
 * 本项目的决定：
 *
 * - **`components/ui/` 是组件的正式实现位置。** Button / Input /
 *   Badge / Dialog / Table / Select 等一律留在原处，不搬迁 ——
 *   它们已被 1000+ 处引用，搬迁只会制造无收益的 diff。
 * - **`design-system/` 只放 `ui/` 里没有的东西**：Token、全局基础
 *   样式、以及 `Text` / `Heading` 这类「排版语义」组件。
 * - 两者共用同一套 Token。`ui/` 组件里的字号/字重/行高必须引用
 *   `--ds-*` 或标准 `text-*` 阶梯，不得硬编码。
 *
 * 任何"在 design-system 里再实现一遍 Button"的尝试都是被禁止的。
 */

export * from './components'
export * from './patterns'
