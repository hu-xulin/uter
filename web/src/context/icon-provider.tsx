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
import { LucideProvider } from 'lucide-react'

/**
 * 图标基线（规范 §2.2，2026-10-28 13:24 版）。
 *
 * 规范这一版把默认档从 20px 收到 **18px**，并把**侧边栏也提到 18px**，
 * 两处与本仓库实现直接相关：
 *
 * 1. **描边统一 2**。表里每一行都写 `Stroke Width 2px`，三个
 *    `--icon-stroke-width*` Token 也全是 `2px`。标题句里「标准描边默认 2px、
 *    重要操作 2px」与表一致 —— 取值没变，仍是 2。
 *    （历史上这个值被改过三次：1px 视觉线宽 → 1.5 → 2.25 → 2。）
 * 2. **18px 是默认档**：按钮内前置后置 18 / 工具栏与卡片操作 18 / 侧边栏 18 /
 *    主导航与 Tabs 18 / 提示与状态 18；紧凑型辅助 16；
 *    强调型功能入口 24 / 空状态 32 / 整页级空状态 48。
 *
 * 标题句这一版是「默认 18px 图标配 24px 点击区域；紧凑场景可使用 16px
 * 图标，导航和主要操作优先使用 18px 图标」，与表一致。所以这里下发 18：
 * 没有显式写尺寸的图标，绝大多数是按钮、工具栏与导航里的主要操作图标。
 * （尺寸也被改过三次：20 → 16 → 20 → 18，改前先 `stat` 规范文件 mtime。）
 *
 * 这条规范由三处共同保证：
 *
 * 1. **库**：只允许 `lucide-react`（守卫 `spec-guards.test.ts` 的
 *    `icon library` 用例）。
 * 2. **尺寸与线宽**：本组件通过 Lucide 的 context 全局下发 `size=18` 与
 *    `strokeWidth=2`。`strokeWidth` 的单位是 Lucide 的 24 单位画框，渲染 18px
 *    时画框缩放 18/24，所以 `2 × 18 / 24 = 1.5px` 视觉线宽 —— 规范给的就是
 *    这个画框值，不反推视觉 px。调用点显式写的 `size` / `strokeWidth` prop
 *    优先级更高，不会被吞掉（守卫要求显式值也只能是 2）。
 * 3. **颜色**：不传 `color`，保留 Lucide 的 `stroke="currentColor"`，
 *    于是图标自动跟随父级文字色。
 *
 * 尺寸兜底还有一层 CSS（`design-system/foundations/icons.css` 的
 * `svg.lucide`），负责既没有 `size` prop、也没有 `size-*` class 的图标；
 * 两层取值同源（都是 `--ds-icon-size`），不会互相打架。
 *
 * 各档取值全部来自 Token（`tokens/primitives.css` 的 `--primitive-icon-*`），
 * 这里只是把默认档交给 Lucide context。**不要**在这里写死其他数字，也不要把
 * 线宽挪进 CSS —— CSS 声明会盖掉调用点的显式 `strokeWidth`。
 */
const ICON_SIZE = 18
/**
 * 标准描边（画框单位）：2。
 * 规范 §2.2 的描边三档（sm / 默认 / emphasis）取值相同，所以这里只需一个常量；
 * 保留三档 Token 是为了让「紧凑 / 默认 / 强调」的语义落点稳定，将来若再分档
 * 只改 Token，不动组件。
 */
const ICON_STROKE_WIDTH = 2

export function IconProvider({ children }: { children: React.ReactNode }) {
  return (
    <LucideProvider size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH}>
      {children}
    </LucideProvider>
  )
}
