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
 * 图表排版常量 —— canvas 绘制的字号唯一来源。
 *
 * 为什么需要这个文件：VChart 把文字画在 `<canvas>` 上，`fontSize` 必须是
 * **数字**，没法写 `text-xs` 这类工具类，也没法直接读 CSS 变量。于是各图表
 * 文件里散落着 `fontSize: 12` / `fontSize: 11` 这样的裸数字 —— 11px 甚至
 * 低于字号阶梯的下限（caption 12px），却没有任何地方会报错。
 *
 * 规范第八节要求「改一处 Token，全站跟着变」。canvas 拿不到 CSS，就把阶梯
 * 值在 TS 侧**镜像**一份：所有图表都从这里取值，字号调整只改这一个文件。
 * `scripts/check-design-tokens.mjs` 的 T4 规则因此可以继续拦截裸数字，
 * 只对引用本文件的写法放行。
 *
 * ⚠️ 这里只允许出现阶梯内的档位（12 / 14 / 16 / 18 / 24 / 30 / 36）。
 * 需要新档位时先改 `design-system/tokens/typography.css`，再同步到这里。
 */

/** caption 档 12px —— 图表轴标签、图例、数据标签的标准字号。 */
export const CHART_FONT_SIZE = 12

/**
 * 图表内联数值标签（柱顶数值、节点文字）用的字号。
 *
 * 历史上这里是 11px，比 caption 还小一档，在 2x 屏上已经糊成一团。
 * 规范阶梯最小就是 12px，且图表标签属于「必须能读」的信息，不是装饰，
 * 因此统一回到 caption 档。
 */
export const CHART_LABEL_FONT_SIZE = CHART_FONT_SIZE

/** 图表轴标题/单位这类比轴标签再弱一级的文字，仍走 caption 档。 */
export const CHART_AXIS_TITLE_FONT_SIZE = CHART_FONT_SIZE
