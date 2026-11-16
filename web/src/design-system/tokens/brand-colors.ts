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
 * 品牌标识色 · 图表系列色运行时解析（唯一来源）
 *
 * 规范里所有颜色都必须走语义 Token（`--ds-color-*` / `chart-*` / `*-soft`），
 * 因为它们要跟着深浅模式一起变。但有两类颜色**本质上不能语义化**：
 *
 *   1. 第三方品牌标识色 —— 支付宝的蓝、微信支付的绿、OpenAI 的青绿。
 *      这些是别人的商标配色，改成 `--primary` 就等于改人家的 logo，
 *      在任何主题下都必须保持原样。
 *   2. 未知厂商兜底序列 —— 历史遗留的静态序列，仅用于排行榜里没有官方
 *      品牌色的厂商，迁移状态见 UDS-8.0.0-MIGRATION-REPORT。
 *
 * 多系列分类色已由 UDS 8.0.0 的 `--ds8-color-chart-1..12` 语义层承担
 * （12 色，正常视觉 + 三类色觉缺陷模拟下任意两色 CIEDE2000 >= 10）。
 * VChart 画在 <canvas> 上读不到 CSS 变量，所以由本文件的
 * `resolveUds6ChartPalette()` 在**调用时**解析；生成的 TS 镜像只做
 * SSR / 单测兜底，不是第二套色值定义。
 *
 * 第三方品牌色集中声明在本文件，组件一律从这里 import，
 * 不得在业务代码里散写 hex。`scripts/check-design-tokens.mjs` 的 T8 规则
 * 把本文件识别为唯一所有者，其他文件出现裸 hex 即违规。
 *
 * 新增品牌色时：只加确实有官方视觉规范的那个品牌，并注明取值来源。
 */

import {
  UDS8_CHART_PALETTE_DARK,
  UDS8_CHART_PALETTE_LIGHT,
} from './generated/uds8-chart-palette'

// ---------------------------------------------------------------------------
// 第三方品牌标识色
// ---------------------------------------------------------------------------

/**
 * 模型厂商（model author）品牌色。
 *
 * 用于排行榜市场份额饼图与图例圆点 —— 同一个厂商在图表、图例、标签里
 * 必须始终同色，所以按厂商名做稳定映射，不随排序变化。
 *
 * `Others` 是聚合桶，取中性灰而不是某个厂商色，避免暗示归属。
 */
export const VENDOR_BRAND_COLORS: Record<string, string> = {
  OpenAI: '#10a37f',
  Anthropic: '#d97757',
  Google: '#4285f4',
  DeepSeek: '#7c5cff',
  Alibaba: '#ff9900',
  xAI: '#1f2937',
  Meta: '#1877f2',
  Moonshot: '#ec4899',
  Zhipu: '#06b6d4',
  Mistral: '#ff7000',
  ByteDance: '#3b82f6',
  Tencent: '#22c55e',
  MiniMax: '#a855f7',
  Cohere: '#fb923c',
  Baidu: '#ef4444',
  Others: '#94a3b8',
}

/**
 * 支付渠道品牌色。
 *
 * 仅用于 react-icons 的品牌图标着色 —— 支付宝是蓝的、微信支付是绿的，
 * 图标本身已经是品牌形状，颜色必须与之一致，否则用户认不出来。
 *
 * key 与 `PAYMENT_TYPES` 的取值一一对应（见 `features/wallet/constants.ts`）。
 */
export const PAYMENT_BRAND_COLORS: Record<string, string> = {
  alipay: '#1677FF',
  wxpay: '#07C160',
  alipay_web: '#1677FF',
  wechat_web: '#07C160',
  stripe: '#635BFF',
  creem: '#6366F1',
  waffo: '#2563EB',
  waffo_pancake: '#F97316',
}

/**
 * 第三方登录（OAuth）渠道品牌色。
 *
 * 用途：登录 / 注册页的「继续使用 X」按钮 **hover 时的底色**。
 * 按钮默认是描边态（图标与文字跟随正文色），悬停时换成渠道自己的品牌色、
 * 图标与文字转白 —— 这样一排并列的渠道按钮能立刻被认出是「哪一家的登录」，
 * 而不是一排看起来一模一样的灰框。
 *
 * key 与 `oauth-providers.tsx` 里 `providerButtons[].key` 的取值一一对应。
 * 取值均为各渠道官方品牌规范里的主色，不是从截图里吸的。
 */
export const OAUTH_BRAND_COLORS: Record<string, string> = {
  // 微信绿（与 PAYMENT_BRAND_COLORS.wxpay 同源：同一个品牌不能两个绿）
  wechat: '#07C160',
  // GitHub Primer 的深色底（官方 logo 的 #181717 在深色模式下与页面底几乎同色，
  // 故按钮底取 Primer 的 canvas-inverse，白字对比度 14:1 以上）
  github: '#24292F',
  // Discord Blurple
  discord: '#5865F2',
  // Telegram 官方品牌蓝
  telegram: '#229ED9',
  // LinuxDO：取自其标志里的深色主体 #1d1d1f（黄 #feb005 作底会让白字只有 1.6:1）
  linuxdo: '#1d1d1f',
}

// ---------------------------------------------------------------------------
// UDS 8.0.0 图表系列色（12 色，调用时解析）
// ---------------------------------------------------------------------------

/**
 * 解析当前主题下的 12 个图表系列色。
 *
 * 必须在**调用时**读 CSS 变量，不能在模块顶层算好常量：模块求值时机
 * 早于样式表注入，且主题切换后色值要跟着变（同 chartLegendItemStyle 的
 * 约定）。探针挂在 <body> 下，让 html.dark 与 body[data-ds-theme] 两种
 * 主题标记都能生效；7.0 系列色是实色 HEX，无需 canvas 归一化。
 *
 * SSR / 单测 / bridge 未加载时回退到生成的 TS 镜像（按 html 上的主题
 * 标记选 Light / Dark），保证 canvas 永远有真实颜色可画。
 */
export function resolveUds6ChartPalette(): string[] {
  const fallback =
    typeof document !== 'undefined' &&
    (document.documentElement.classList.contains('dark') ||
      document.documentElement.getAttribute('data-ds-theme') === 'dark')
      ? UDS8_CHART_PALETTE_DARK
      : UDS8_CHART_PALETTE_LIGHT

  if (typeof document === 'undefined') return [...fallback]

  const probe = document.createElement('div')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const colors = Array.from({ length: 12 }, (_, i) =>
    style.getPropertyValue(`--ds8-color-chart-${i + 1}`).trim()
  )
  probe.remove()

  return colors.every((c) => c.length > 0) ? colors : [...fallback]
}

/**
 * 未知厂商的兜底色序列（历史静态序列，尚未迁移到 7.0 图表色）。
 *
 * 取值刻意与 VENDOR_BRAND_COLORS 的厂商色保持低重复度，这样
 * 「有品牌色的厂商」和「未知厂商」在同一张饼图里不会撞色。
 * 迁移状态登记在 UDS-8.0.0-MIGRATION-REPORT（B3 批次）。
 */
export const VENDOR_FALLBACK_PALETTE = [
  '#0ea5e9',
  '#22c55e',
  '#a855f7',
  '#f97316',
  '#14b8a6',
  '#eab308',
  '#ec4899',
  '#84cc16',
  '#6366f1',
  '#10b981',
  '#f43f5e',
  '#0891b2',
  '#94a3b8',
] as const

/**
 * 「其他」聚合桶的兜底色，用于仪表盘模型趋势图里模型数超过配色槽位的情况。
 * 与 `VENDOR_BRAND_COLORS.Others` 同一色相，但更饱和 —— 它是数据里的
 * 一个真实序列，需要在堆叠柱里被看见。
 */
export const CHART_OTHER_SERIES_COLOR = '#FF8A00'

/**
 * 图表兜底序列色：调用方没有传分类调色板时用它画第一条序列。
 * 品牌蓝的深一档，保证在白底和深底上都够醒目。
 */
export const CHART_FALLBACK_SERIES_COLOR = '#1664FF'

// ---------------------------------------------------------------------------
// 无主题态兜底色
// ---------------------------------------------------------------------------

/**
 * canvas 图表在**主题尚未解析**时用的兜底色。
 *
 * 正常路径下颜色都来自 `useThemeColors` 解析的 Token；但 SSR、首帧、
 * 单测这些场景拿不到 CSS 变量，而 canvas 必须有一个真实颜色字符串才能画。
 * 这两个值是中性的（slate-600 / slate-900 加透明度），在白底和深底上
 * 都还能读，且只在兜底路径出现 —— 一旦主题解析完成就立即被覆盖。
 *
 * 不要把这两个常量当默认值到处用，它们不是设计系统的一部分。
 */
export const CHART_NO_THEME_TEXT_COLOR = '#475569'
export const CHART_NO_THEME_STROKE_COLOR = 'rgba(15, 23, 42, 0.7)'
