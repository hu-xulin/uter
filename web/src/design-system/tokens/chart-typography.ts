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
 * 规范 §17.1 / §17.7 要求「改一处 Token，全站跟着变」。canvas 拿不到 CSS，就把阶梯
 * 值在 TS 侧**镜像**一份：所有图表都从这里取值，字号调整只改这一个文件。
 * `scripts/check-design-tokens.mjs` 的 T4 规则因此可以继续拦截裸数字，
 * 只对引用本文件的写法放行。
 *
 * ⚠️ 这里只允许出现阶梯内的档位（12 / 13 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48）。
 * 需要新档位时先改 `design-system/tokens/typography.css`，再同步到这里。
 */

/** body 档 14px —— 图表轴标签、图例、数据标签的标准字号。 */
export const CHART_FONT_SIZE = 14

/**
 * 图表文字演进：11px（低于全站下限，2x 屏糊成一团）→ 12px caption 档 →
 * 14px body 档。数据看板在 1600×900 全屏下，12px 图表标签与同页 14px 卡片
 * 标签并排时明显偏小、观感不一；图表标签属于「必须能读」的信息而非装饰，
 * 因此跟随正文基准到 14px，与卡片文字同档。修改前须跑
 * `src/design-system/__tests__/chart-typography.test.ts` 守卫。
 */
