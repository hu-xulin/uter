#!/usr/bin/env node
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
 * 生成 UTER 设计规范的可视化核查页。
 *
 * 产物：`web/docs/design-system/showcase.html`（自包含单文件，双击即可打开）
 *
 * 为什么用 Tailwind 编译而不是手写 HTML：
 *   核查页必须展示的是**生产环境的真实值**。手写 `<span style="font-size:30px">`
 *   会在 Token 改动后立刻过期，变成一份骗人的规范。这里直接用项目自己的
 *   Tailwind v4 编译 `src/styles/index.css` 的同一批 Token 源码，
 *   因此核查页与线上表现**逐像素一致**，且随 Token 改动自动更新。
 *
 * 用法：
 *   node scripts/generate-design-showcase.mjs
 *   node scripts/generate-design-showcase.mjs --out ../docs/design-system/showcase.html
 */

import { compile } from 'tailwindcss'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(WEB_ROOT, '..')

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const OUT_PATH =
  outIdx >= 0 && args[outIdx + 1]
    ? path.resolve(WEB_ROOT, args[outIdx + 1])
    : path.join(WEB_ROOT, 'docs/design-system/showcase.html')

/* ── 1. 编译真实 Token ───────────────────────────────────────────── */

const ENTRY = [
  "@import 'tailwindcss';",
  "@import './src/styles/theme.css';",
  "@import './src/styles/theme-presets.css';",
  "@import './src/design-system/tokens/index.css';",
  "@import './src/design-system/foundations/index.css';",
].join('\n')

async function compileTokens(candidates) {
  const compiler = await compile(ENTRY, {
    base: WEB_ROOT,
    loadStylesheet: async (id, basedir) => {
      let p = path.resolve(basedir, id)
      if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        const alt = path.resolve(WEB_ROOT, 'node_modules', id, 'index.css')
        if (fs.existsSync(alt)) p = alt
      }
      return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') }
    },
  })
  return compiler.build(candidates)
}

/** 从编译产物里读一个 CSS 变量的原始值（用于表格里显示「实际值」）。 */
function readVar(css, name) {
  const i = css.indexOf(name + ':')
  if (i < 0) return null
  const end = css.indexOf(';', i)
  return css.slice(i + name.length + 1, end).trim().replaceAll(/\s+/g, ' ')
}

/** rem → px（根字号 16px）。 */
function toPx(value) {
  if (!value) return null
  const m = value.match(/^(-?[\d.]+)rem$/)
  if (m) return Math.round(parseFloat(m[1]) * 16 * 100) / 100
  const p = value.match(/^(-?[\d.]+)px$/)
  if (p) return parseFloat(p[1])
  return null
}

/* ── 2. 候选类清单 ───────────────────────────────────────────────── */

/** 所有会出现在核查页里的 Tailwind 工具类。 */
const CANDIDATES = [
  // 字号
  'text-4xl', 'text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs',
  'text-long', 'text-mono', 'text-mono-code', 'text-mono-title', 'text-group', 'text-dense',
  // 字重
  'font-normal', 'font-medium', 'font-semibold', 'font-bold',
  // 文字色
  'text-foreground', 'text-fg-secondary', 'text-fg-tertiary', 'text-fg-disabled',
  'text-fg-inverse', 'text-fg-link', 'text-fg-placeholder',
  'text-muted-foreground', 'text-primary', 'text-destructive', 'text-success', 'text-warning', 'text-info',
  'text-primary-foreground', 'text-destructive-foreground', 'text-secondary-foreground',
  // 首屏演示（term-*）：效果的锚点，取值≡上游 new-api 的渲染值
  'text-term-command', 'text-term-flag', 'text-term-property', 'text-term-string', 'text-term-number',
  'text-term-dim-1', 'text-term-dim-2', 'text-term-dim-3', 'text-term-dim-4',
  'text-term-accent-emerald', 'text-term-accent-amber', 'text-term-accent-blue', 'text-term-accent-violet',
  'border-term-accent-emerald-line', 'border-term-accent-amber-line', 'border-term-accent-blue-line', 'border-term-accent-violet-line',
  'bg-term-accent-emerald-soft', 'bg-term-accent-amber-soft', 'bg-term-accent-blue-soft', 'bg-term-accent-violet-soft',
  'bg-term-online', 'bg-term-dot', 'ds-text-gradient-brand',
  // 背景装饰层（ds-decor-*）：颜色在 --ds-decor-*，形状在此三个 utility
  'ds-decor-mesh-hero', 'ds-decor-mesh-cta', 'ds-decor-grid',
  'text-sidebar-active-foreground', 'text-sidebar-foreground',
  'text-syntax-keyword', 'text-syntax-string', 'text-syntax-number', 'text-syntax-function', 'text-syntax-property',
  // 背景
  'bg-background', 'bg-card', 'bg-popover', 'bg-muted', 'bg-accent', 'bg-secondary',
  'bg-primary', 'bg-primary-strong', 'bg-primary-subtle', 'bg-primary-hover', 'bg-primary-active',
  'bg-destructive', 'bg-destructive-subtle', 'bg-success', 'bg-success-soft', 'bg-warning', 'bg-warning-soft',
  'bg-info', 'bg-info-soft', 'bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5',
  'bg-sidebar', 'bg-sidebar-accent', 'bg-tertiary-foreground',
  // 描边
  'border', 'border-border', 'border-input', 'border-primary', 'border-primary-border', 'border-destructive',
  // 圆角
  'rounded-xs', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full',
  // 尺寸
  'h-9', 'h-10', 'h-12', 'h-8', 'h-7', 'h-11', 'size-6', 'size-8', 'size-12', 'size-4', 'size-4.5', 'size-3', 'size-3.5',
  'h-(--ds-button-height-md)', 'h-(--ds-button-height-sm)', 'h-(--ds-button-height-lg)',
  'h-(--ds-control-height-md)', 'h-(--ds-control-height-sm)',
  'w-(--ds-control-height-md)', 'h-(--ds-chip-height)',
  'min-h-6', 'min-h-8', 'min-h-11', 'min-h-14',
  'px-3', 'py-2', 'px-4', 'p-4', 'gap-2', 'gap-3', 'gap-4', 'gap-1', 'gap-1.5', 'gap-6', 'gap-8',
  'mt-4', 'mb-2', 'px-2', 'py-1', 'p-2', 'p-3', 'px-6', 'px-8',
  // 阴影
  'shadow-(--ds-elevation-none)', 'shadow-(--ds-elevation-popover)', 'shadow-(--ds-elevation-overlay)',
  'shadow-(--ds-elevation-raised)', 'shadow-(--ds-elevation-marketing)', 'shadow-(--ds-glow-online)',
  // 布局
  'flex', 'items-center', 'justify-center', 'justify-between', 'inline-flex', 'grid', 'block',
  'relative', 'absolute', 'overflow-hidden', 'w-full', 'max-w-md', 'max-w-lg', 'max-w-xl',
  'truncate', 'whitespace-nowrap', 'tabular-nums', 'italic', 'underline', 'uppercase',
  'font-mono', 'font-sans', 'antialiased', 'leading-none',
  // 动效
  'ds-motion-fast', 'ds-motion-base', 'ds-motion-slow', 'ds-motion-marketing-fast', 'ds-motion-marketing',
  'ds-motion-data', 'transition-colors', 'transition-transform', 'animate-spin',
  // 深色变体
  'dark:bg-card', 'dark:text-fg-secondary', 'dark:border-border', 'dark:bg-muted',
  // 焦点
  'focus-visible:ring-1', 'ring-ring', 'outline-none',
]

const css = await compileTokens(CANDIDATES)

/* ── 3. 数据定义：与规范文档一一对应 ────────────────────────────── */

const TYPOGRAPHY = [
  { token: 'display', cls: 'text-4xl', w: 'font-semibold', px: 36, lh: 44, weight: 600, use: '页面主视觉（营销页 hero）', comp: 'Heading variant="display"' },
  { token: 'h1', cls: 'text-3xl', w: 'font-semibold', px: 28, lh: 36, weight: 600, use: '页面标题（每页一个）', comp: 'Heading variant="page-title"' },
  { token: 'h2', cls: 'text-2xl', w: 'font-semibold', px: 22, lh: 30, weight: 600, use: '区块标题（页面内 2–5 个）', comp: 'Heading variant="section-title"' },
  { token: 'h3', cls: 'text-lg', w: 'font-semibold', px: 18, lh: 26, weight: 600, use: '卡片标题、弹窗标题', comp: 'Heading variant="card-title"' },
  { token: 'group-title', cls: 'text-group font-semibold', w: '', px: 15, lh: 22, weight: 600, use: '卡片内分组标题', comp: 'Heading variant="group-title"' },
  { token: 'body', cls: 'text-sm', w: '', px: 14, lh: 22, weight: 400, use: '正文（全站基准）', comp: 'Text variant="body"' },
  { token: 'body-long', cls: 'text-long', w: '', px: 16, lh: 26, weight: 400, use: '长文本：文章/协议/对话气泡', comp: 'Text variant="body-long"' },
  { token: 'body-sm', cls: 'text-sm', w: '', px: 14, lh: 22, weight: 400, use: '紧凑辅助正文、表格单元格', comp: 'Text variant="body-sm"' },
  { token: 'body-medium', cls: 'text-sm font-medium', w: '', px: 14, lh: 22, weight: 500, use: '强调正文、导航项', comp: 'Text variant="body-medium"' },
  { token: 'small', cls: 'text-xs', w: '', px: 12, lh: 18, weight: 400, use: '辅助信息、时间', comp: 'Text variant="caption"' },
  { token: 'caption', cls: 'text-xs', w: '', px: 12, lh: 18, weight: 400, use: '说明、占位符、徽标', comp: 'Text variant="caption"' },
  { token: 'dense', cls: 'text-dense', w: '', px: 13, lh: 20, weight: 400, use: '密集数据（表格/二级导航/分页）', comp: 'Text variant="dense"' },
  { token: 'mono', cls: 'text-mono', w: '', px: 13, lh: 20, weight: 400, use: '正文里的等宽文本（模型 ID/密钥/金额）', comp: 'Text variant="code"' },
]

const MONO = [
  { token: 'mono', cls: 'text-mono', px: 13, lh: 20, use: '正文里的等宽文本' },
  { token: 'mono-code', cls: 'text-mono-code', px: 13, lh: 20, use: '固定高度的等宽代码容器（首页代码卡片、编辑器视口）' },
  { token: 'mono-title', cls: 'text-mono-title', px: 16, lh: 22, use: '等宽字形的卡片标题（定价卡片模型名）' },
]

const TEXT_COLORS = [
  { token: '--fg-primary', cls: 'text-foreground', use: '页面标题、正文、主要数据、输入值', light: '#0F172A', dark: '#F8FAFC' },
  { token: '--fg-secondary', cls: 'text-fg-secondary', use: '描述、辅助说明、次级信息', light: '#334155', dark: '#CBD5E1' },
  { token: '--fg-tertiary', cls: 'text-fg-tertiary', use: '时间戳、元信息、次要标签', light: '#64748B', dark: '#94A3B8' },
  { token: '--fg-disabled', cls: 'text-fg-disabled', use: '禁用按钮、禁用字段', light: '#94A3B8', dark: '#64748B' },
  { token: '--fg-inverse', cls: 'text-fg-inverse', use: '深色表面或品牌实心背景', light: '#FFFFFF', dark: '#0F172A' },
  { token: '--fg-link', cls: 'text-fg-link', use: '文本链接、可导航文字', light: '#5B5EE6', dark: '#A1A3F7' },
  { token: '--fg-placeholder', cls: 'text-fg-placeholder', use: '输入框 placeholder', light: '#64748B', dark: '#94A3B8' },
]

const SURFACE_COLORS = [
  { token: '--background', cls: 'bg-background', use: '页面底色', light: '#FFFFFF', dark: '#020617' },
  { token: '--card', cls: 'bg-card', use: '卡片表面', light: '#FFFFFF', dark: '深色表面' },
  { token: '--popover', cls: 'bg-popover', use: '浮层表面（弹窗/下拉）', light: '#FFFFFF', dark: '深色表面' },
  { token: '--muted', cls: 'bg-muted', use: '次级表面', light: '#F1F5F9', dark: '#1E293B' },
  { token: '--accent', cls: 'bg-accent', use: '强调表面', light: '#F1F5F9', dark: '深色表面' },
  { token: '--secondary', cls: 'bg-secondary', use: '次级按钮底', light: '#F1F5F9', dark: '深色表面' },
  { token: '--border', cls: 'border-border', use: '默认描边', light: '#E2E8F0', dark: '#334155' },
  { token: '--input', cls: 'border-input', use: '输入控件描边', light: '#D1D5E5', dark: '#45465F' },
]

const BRAND_COLORS = [
  { token: '--primary', cls: 'bg-primary', use: '品牌主色：链接、选中态、图标强调', light: '#5B5EE6', dark: '#8B8DF5' },
  { token: '--primary-strong', cls: 'bg-primary-strong', use: '实心控件底（主按钮），配白字', light: '#5B5EE6', dark: '#8B8DF5' },
  { token: '--hover-primary', cls: 'bg-primary-hover', use: '主按钮悬停（同色相加深）', light: '#494CC7', dark: '#A1A3F7' },
  { token: '--primary-active', cls: 'bg-primary-active', use: '主按钮按下（与悬停可区分）', light: '#3F42B0', dark: '#B7B8FA' },
  { token: '--primary-subtle', cls: 'bg-primary-subtle', use: '浅底：选中行、轻强调背景', light: '#F0F0FF', dark: '#25264A' },
  { token: '--primary-border', cls: 'border-primary-border', use: '品牌描边：选中控件边框', light: '#C7C8FF', dark: '#5558DC' },
  { token: '--sidebar-active-foreground', cls: 'text-sidebar-active-foreground', use: '导航选中态专用前景色（4.93:1）', light: '#5558D8', dark: '#8B8DF5' },
]

const STATUS_COLORS = [
  { token: '--destructive', cls: 'bg-destructive', fg: 'text-destructive-foreground', use: '危险 / 失败 / 删除', light: '#DC2626', dark: '#7F1D1D' },
  { token: '--success', cls: 'bg-success', fg: 'text-success-foreground', use: '成功 / 已启用', light: '#16A34A', dark: '#16A34A' },
  { token: '--warning', cls: 'bg-warning', fg: 'text-warning-foreground', use: '警告 / 需注意', light: 'oklch(0.681 0.162 75.834)', dark: '深色档' },
  { token: '--info', cls: 'bg-info', fg: 'text-info-foreground', use: '信息提示', light: 'oklch(0.588 0.158 241.966)', dark: '深色档' },
  { token: '--success-soft', cls: 'bg-success-soft', fg: 'text-success-soft-foreground', use: '成功浅底 + 深字徽标', light: 'oklch(0.979 0.021 166)', dark: '深色档' },
  { token: '--destructive-soft', cls: 'bg-destructive-soft', fg: 'text-destructive-soft-foreground', use: '危险浅底 + 深字徽标', light: 'oklch(0.971 0.013 17)', dark: '深色档' },
  { token: '--warning-soft', cls: 'bg-warning-soft', fg: 'text-warning-soft-foreground', use: '警告浅底 + 深字徽标', light: 'oklch(0.985 0.02 80)', dark: '深色档' },
  { token: '--info-soft', cls: 'bg-info-soft', fg: 'text-info-soft-foreground', use: '信息浅底 + 深字徽标', light: 'oklch(0.97 0.019 235)', dark: '深色档' },
]

const CHART_COLORS = [
  { token: '--chart-1', cls: 'bg-chart-1', use: '分类色 1（仅用于区分彼此，无成败含义）' },
  { token: '--chart-2', cls: 'bg-chart-2', use: '分类色 2' },
  { token: '--chart-3', cls: 'bg-chart-3', use: '分类色 3' },
  { token: '--chart-4', cls: 'bg-chart-4', use: '分类色 4' },
  { token: '--chart-5', cls: 'bg-chart-5', use: '分类色 5' },
]

const TERM_SYNTAX = [
  { token: '--term-command', cls: 'text-term-command', use: 'shell 命令名（curl）· AA 补偿 emerald-700 / 上游原值 emerald-400' },
  { token: '--term-flag', cls: 'text-term-flag', use: '命令行开关 -X / -H / -d · 上游 blue-600 / blue-400' },
  { token: '--term-property', cls: 'text-term-property', use: 'JSON 键名、Header 名 · 上游 sky-700 / sky-300' },
  { token: '--term-string', cls: 'text-term-string', use: '字符串字面量 · 上游 amber-700 / amber-300' },
  { token: '--term-number', cls: 'text-term-number', use: '数字、token 计数 · 上游 violet-600 / violet-300' },
]

const TERM_DIM = [
  { token: '--term-dim-1', cls: 'text-term-dim-1', use: '端点行、Tab 悬停 · 原 text-foreground/75' },
  { token: '--term-dim-2', cls: 'text-term-dim-2', use: '标点、续行符 · 原 text-foreground/55' },
  { token: '--term-dim-3', cls: 'text-term-dim-3', use: '未选中 Tab、卡尾指标 · 原 text-foreground/40，AA 补偿提亮至 55%' },
  { token: '--term-dim-4', cls: 'text-term-dim-4', use: 'Request / Response 分组标签 · 原 text-foreground/30，AA 补偿提亮至 55%' },
]

const TERM_ACCENTS = [
  { tone: 'emerald', text: 'text-term-accent-emerald', line: 'border-term-accent-emerald-line', soft: 'bg-term-accent-emerald-soft', method: 'POST' },
  { tone: 'amber', text: 'text-term-accent-amber', line: 'border-term-accent-amber-line', soft: 'bg-term-accent-amber-soft', method: 'POST' },
  { tone: 'blue', text: 'text-term-accent-blue', line: 'border-term-accent-blue-line', soft: 'bg-term-accent-blue-soft', method: 'GET' },
  { tone: 'violet', text: 'text-term-accent-violet', line: 'border-term-accent-violet-line', soft: 'bg-term-accent-violet-soft', method: 'GET' },
]

const SYNTAX_COLORS = [
  { token: '--syntax-keyword', cls: 'text-syntax-keyword', use: '关键字（const / import）' },
  { token: '--syntax-string', cls: 'text-syntax-string', use: '字符串字面量' },
  { token: '--syntax-number', cls: 'text-syntax-number', use: '数字 / 布尔' },
  { token: '--syntax-function', cls: 'text-syntax-function', use: '函数名、命令' },
  { token: '--syntax-property', cls: 'text-syntax-property', use: '属性名、flag' },
]

const RADII = [
  { token: '--radius-xs', cls: 'rounded-xs', px: 4, use: '极小徽标、内嵌标记' },
  { token: '--radius-sm', cls: 'rounded-sm', px: 6, use: '关闭按钮、密集控件点击区' },
  { token: '--radius-md', cls: 'rounded-md', px: 8, use: '按钮、输入框、标签页触发器（默认）' },
  { token: '--radius-lg', cls: 'rounded-lg', px: 10, use: '卡片、弹窗、标签页容器、图标按钮' },
  { token: '--radius-xl', cls: 'rounded-xl', px: 12, use: '强调容器、大圆角方形头像' },
  { token: '--radius-2xl', cls: 'rounded-2xl', px: 16, use: '展示型卡片' },
  { token: '--radius-full', cls: 'rounded-full', px: 9999, use: '胶囊徽标、圆形头像、开关轨道' },
]

const ELEVATIONS = [
  { token: '--ds-elevation-none', cls: 'shadow-(--ds-elevation-none)', use: '静止的页面内元素（默认）' },
  { token: '--ds-elevation-popover', cls: 'shadow-(--ds-elevation-popover)', use: '下拉面板、气泡、悬浮提示' },
  { token: '--ds-elevation-overlay', cls: 'shadow-(--ds-elevation-overlay)', use: '弹窗、抽屉、浮层' },
  { token: '--ds-elevation-raised', cls: 'shadow-(--ds-elevation-raised)', use: '拖拽中的元素（瞬时离开文档流）' },
  { token: '--ds-elevation-marketing', cls: 'shadow-(--ds-elevation-marketing)', use: '营销展示卡片（脱离页面平面）' },
  { token: '--ds-glow-online', cls: 'shadow-(--ds-glow-online)', use: '在线状态点（状态语义，不是层级）' },
]

const MOTIONS = [
  { token: '--ds-motion-fast', cls: 'ds-motion-fast', ms: 100, use: '交互反馈：颜色、描边、透明度的状态变化' },
  { token: '--ds-motion-base', cls: 'ds-motion-base', ms: 200, use: '展开收起、宽度位移这类形变' },
  { token: '--ds-motion-slow', cls: 'ds-motion-slow', ms: 350, use: '浮层视口 / 背板级整块位移' },
  { token: '--ds-motion-marketing-fast', cls: 'ds-motion-marketing-fast', ms: 300, use: '营销面的悬停、下划线生长' },
  { token: '--ds-motion-marketing-base', cls: 'ds-motion-marketing', ms: 500, use: '营销面的容器级展开、全屏菜单' },
  { token: '--ds-motion-enter', cls: '(keyframes)', ms: 600, use: '首屏元素的观看节奏' },
  { token: '--ds-motion-loop-shimmer', cls: '(keyframes)', ms: 1800, use: '骨架屏微光循环' },
  { token: '--ds-motion-loop-pulse', cls: '(keyframes)', ms: 1500, use: '脉冲循环' },
  { token: '--ds-motion-loop-caret', cls: '(keyframes)', ms: 1000, use: '光标闪烁' },
  { token: '--ds-motion-loop-spin', cls: '(keyframes)', ms: 800, use: '旋转加载' },
  { token: '--ds-motion-data-fast', cls: '(keyframes)', ms: 250, use: '数据值快速过渡' },
  { token: '--ds-motion-data', cls: 'ds-motion-data', ms: 500, use: '数据值过渡' },
]

const BUTTON_SIZES = [
  { size: 'default', h: 36, r: 8, use: '常规操作（默认）' },
  { size: 'sm', h: 32, r: 8, use: '表格行内、密集工具栏' },
  { size: 'lg', h: 40, r: 8, use: '页面级主操作' },
  { size: 'icon', h: 36, r: 10, use: '图标按钮（默认）' },
  { size: 'icon-sm', h: 32, r: 10, use: '工具栏图标按钮' },
  { size: 'icon-xs', h: 24, r: 10, use: '极紧凑位（= 触控下限，不得再小）' },
  { size: 'icon-lg', h: 40, r: 10, use: '强调型图标按钮' },
  { size: 'inline', h: 20, r: 0, use: '链接式文字按钮（嵌在文字流里）' },
  { size: 'wrap', h: 32, r: 8, use: '标签会折行的按钮' },
]

const CONTROL_SIZES = [
  { name: 'Input md', h: 40, cls: 'h-(--ds-control-height-md)', use: '表单控件默认高度' },
  { name: 'Input sm', h: 36, cls: 'h-(--ds-control-height-sm)', use: '紧凑表单控件' },
  { name: 'Table 行', h: 48, cls: 'h-12', use: '表格行高' },
  { name: 'Table 表头', h: 40, cls: 'h-10', use: '表格表头高' },
  { name: '内联胶囊', h: 21, cls: 'h-(--ds-chip-height)', use: '值胶囊 / +N more（不随密度变化）' },
]

const SPACING = [
  { cls: 'gap-1', px: 4, use: '图标与文字（紧凑）' },
  { cls: 'gap-1.5', px: 6, use: '图标与文字（默认）' },
  { cls: 'gap-2', px: 8, use: '控件之间、表单标签与控件' },
  { cls: 'gap-4', px: 16, use: '卡片内元素、卡片之间' },
  { cls: 'gap-6', px: 24, use: '区块之间' },
  { cls: 'gap-8', px: 32, use: '区块之间（大）' },
  { cls: 'px-6', px: 24, use: '页面左右留白' },
  { cls: 'px-8', px: 32, use: '页面左右留白（宽屏）' },
]

const DENSITY = [
  { token: '--ds-table-row-padding-y', def: 12, sm: 8, xl: 14 },
  { token: '--ds-table-cell-padding-x', def: 12, sm: 8, xl: 14 },
  { token: '--ds-control-height-md', def: 40, sm: 36, xl: 44 },
  { token: '--ds-control-height-sm', def: 36, sm: 32, xl: 40 },
  { token: '--ds-button-height-md', def: 36, sm: 32, xl: 40 },
  { token: '--ds-button-height-sm', def: 32, sm: 28, xl: 36 },
  { token: '--ds-button-height-lg', def: 40, sm: 36, xl: 44 },
  { token: '--ds-nav-height-md', def: 32, sm: 28, xl: 36 },
  { token: '--ds-nav-height-sm', def: 28, sm: 24, xl: 32 },
  { token: '--ds-nav-height-lg', def: 48, sm: 40, xl: 52 },
  { token: '--ds-form-field-gap', def: 8, sm: 6, xl: 10 },
  { token: '--ds-card-padding', def: 24, sm: 16, xl: 28 },
  { token: '--ds-page-gutter', def: 24, sm: 16, xl: 32 },
]

const ICON_SIZES = [
  { px: 16, cls: 'size-4', use: '紧凑型辅助图标（仅密集信息）' },
  { px: 18, cls: 'size-4.5', use: '默认档：按钮内 / 工具栏 / 侧边栏 / 主导航 / Tabs / 提示状态' },
  { px: 24, cls: 'size-6', use: '强调型功能入口' },
  { px: 32, cls: 'size-8', use: '空状态' },
  { px: 48, cls: 'size-12', use: '整页级空状态' },
]

/* ── 4. 渲染辅助 ────────────────────────────────────────────────── */

const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const buttonStyle = (b) => {
  if (b.size === 'icon') {
    return `width:${b.h}px;height:${b.h}px;border-radius:${b.r}px;padding:0`
  }
  if (b.size === 'inline') {
    return `height:auto;padding:0;border-radius:0;background:transparent;color:var(--primary);text-decoration:underline`
  }
  return `height:${b.h}px;border-radius:${b.r}px`
}

const buttonLabel = (b) => {
  if (b.size === 'icon') {
    return '⚙'
  }
  if (b.size === 'inline') {
    return '查看详情'
  }
  return '按钮'
}

const SAMPLE_ZH = '优特智能大模型服务平台'
const SAMPLE_EN = 'Uter.ai'

/**
 * 一个「色卡」：左色块 + 右元信息。
 *
 * 四种呈现方式，因为它们在页面上的真实形态不同：
 *   fg    —— 文字色：在白底上渲染一段真实文字（空色块看不出任何东西）
 *   fgInv —— 反色文字：必须放在**深色底**上才看得见，否则是白字白底
 *   bg    —— 表面色：整块填充
 *   edge  —— 描边色：填充 + 2px 边框（描边档本来就只是一个轮廓）
 *
 * kind 不传时按类名自动判断：text-fg-inverse → fgInv，text-* → fg，
 * border-* → edge，其余 → bg。
 */
function swatch(c, { kind } = {}) {
  if (!kind) {
    if (c.cls.startsWith('text-')) {
      kind = c.cls.includes('inverse') ? 'fgInv' : 'fg'
    } else if (c.cls.startsWith('border-')) {
      kind = 'edge'
    } else {
      kind = 'bg'
    }
  }
  const val = c.light || ''
  let chip
  if (kind === 'fg') {
    chip = `<div class="swatch-chip swatch-fg ${c.cls}">优特 Ag</div>`
  } else if (kind === 'fgInv') {
    chip = `<div class="swatch-chip swatch-fg swatch-fg-inv ${c.cls}">优特 Ag</div>`
  } else if (kind === 'edge') {
    chip = `<div class="swatch-chip swatch-edge ${c.cls}"></div>`
  } else {
    chip = `<div class="swatch-chip ${c.cls}"></div>`
  }
  return `
    <div class="swatch">
      ${chip}
      <div class="swatch-meta">
        <code class="swatch-token">${esc(c.token)}</code>
        <code class="swatch-cls">${esc(c.cls)}</code>
        <div class="swatch-use">${esc(c.use)}</div>
        <div class="swatch-vals">
          <span><em>浅色</em> ${esc(val || '—')}</span>
          ${c.dark ? `<span><em>深色</em> ${esc(c.dark)}</span>` : ''}
        </div>
      </div>
    </div>`
}

/** 一个「字号示范」：左侧渲染样本，右侧元信息。 */
function typeRow(t) {
  return `
    <div class="type-row">
      <div class="type-sample ${t.cls} ${t.w || ''}">${esc(SAMPLE_ZH)}</div>
      <div class="type-meta">
        <div class="type-token">${esc(t.token)}</div>
        <div class="type-nums">
          <span class="num">${t.px}px</span>
          <span class="num">/${t.lh}px</span>
          <span class="num">w${t.weight}</span>
        </div>
        <code class="type-cls">${esc(t.cls)}</code>
        <div class="type-use">${esc(t.use)}</div>
        <div class="type-comp">${esc(t.comp || '')}</div>
      </div>
    </div>`
}

/* ── 5. 组装 HTML ───────────────────────────────────────────────── */

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UTER 设计规范 · 可视化核查页</title>
<style>
${css}

/* ── 核查页自身样式（与被核查的 Token 完全隔离） ── */
:root {
  --ui-fg: #0f172a;
  --ui-bg: #ffffff;
  --ui-muted: #f1f5f9;
  --ui-border: #e2e8f0;
  --ui-sub: #64748b;
}
html.dark {
  --ui-fg: #f8fafc;
  --ui-bg: #020617;
  --ui-muted: #1e293b;
  --ui-border: #334155;
  --ui-sub: #94a3b8;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ui-bg);
  color: var(--ui-fg);
  font-family: var(--font-ui, Inter, system-ui, sans-serif);
  font-size: 14px;
  line-height: 1.6;
}
.wrap { max-width: 1180px; margin: 0 auto; padding: 32px 24px 120px; }

header.page-head {
  border-bottom: 1px solid var(--ui-border);
  padding-bottom: 20px; margin-bottom: 32px;
}
header.page-head h1 { font-size: 26px; font-weight: 700; margin: 0 0 8px; }
header.page-head p { margin: 0; color: var(--ui-sub); font-size: 13px; max-width: 760px; }
header.page-head code { font-size: 12px; }

.toolbar {
  position: sticky; top: 0; z-index: 50;
  display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  background: var(--ui-bg); border-bottom: 1px solid var(--ui-border);
  padding: 12px 24px; margin: 0 0 28px;
}
.toolbar .spacer { flex: 1; }
.tbtn {
  font: inherit; font-size: 13px; cursor: pointer;
  border: 1px solid var(--ui-border); background: var(--ui-bg); color: var(--ui-fg);
  border-radius: 8px; padding: 6px 12px;
}
.tbtn:hover { background: var(--ui-muted); }
.tbtn[aria-pressed="true"] { background: var(--primary); color: #fff; border-color: var(--primary); }

nav.toc {
  border: 1px solid var(--ui-border); border-radius: 12px;
  padding: 16px 20px; margin-bottom: 32px; background: color-mix(in oklch, var(--ui-bg) 94%, var(--ui-muted));
}
nav.toc h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--ui-sub); margin: 0 0 10px; font-weight: 600; }
nav.toc ol { margin: 0; padding-left: 20px; columns: 3; column-gap: 24px; font-size: 13px; }
nav.toc li { margin: 3px 0; break-inside: avoid; }
nav.toc a { color: var(--ui-fg); text-decoration: none; }
nav.toc a:hover { color: var(--primary); text-decoration: underline; }

section { margin-bottom: 44px; scroll-margin-top: 70px; }
section > h2 {
  font-size: 20px; font-weight: 700; margin: 0 0 6px;
  padding-bottom: 8px; border-bottom: 2px solid var(--ui-border);
}
section > h2 .n { color: var(--primary); margin-right: 8px; }
section > .lead { color: var(--ui-sub); font-size: 13px; margin: 0 0 18px; }

.card {
  border: 1px solid var(--ui-border); border-radius: 12px;
  padding: 20px; background: var(--ui-bg); margin-bottom: 16px;
}
.card > h3 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
.card > .hint { font-size: 12px; color: var(--ui-sub); margin: 0 0 16px; }

/* 表格 */
table.t { width: 100%; border-collapse: collapse; font-size: 13px; }
table.t th, table.t td { border: 1px solid var(--ui-border); padding: 7px 10px; text-align: left; vertical-align: middle; }
table.t th { background: var(--ui-muted); font-weight: 600; font-size: 12px; white-space: nowrap; }
table.t td code { font-size: 11.5px; }
table.t tr:hover td { background: color-mix(in oklch, var(--ui-bg) 96%, var(--ui-muted)); }
.ok { color: #16a34a; font-weight: 600; }
.bad { color: #dc2626; font-weight: 600; }

/* 字号示范 */
.type-row {
  display: grid; grid-template-columns: 1fr 260px; gap: 16px;
  padding: 14px 0; border-bottom: 1px dashed var(--ui-border);
  align-items: center;
}
.type-row:last-child { border-bottom: 0; }
.type-sample {
  background: var(--ui-muted); border: 1px solid var(--ui-border); border-radius: 8px;
  padding: 10px 14px; color: var(--foreground); overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis;
}
.type-meta { font-size: 12px; }
.type-token { font-weight: 700; font-size: 13px; font-family: var(--font-mono); }
.type-nums { display: flex; gap: 6px; margin: 4px 0; }
.num { background: var(--ui-muted); border: 1px solid var(--ui-border); border-radius: 5px; padding: 1px 6px; font-size: 11px; font-variant-numeric: tabular-nums; }
.type-cls, .swatch-cls { display: inline-block; font-family: var(--font-mono); font-size: 11px; color: var(--primary); }
.type-use { color: var(--ui-sub); margin-top: 3px; }
.type-comp { color: var(--ui-sub); font-size: 11px; font-family: var(--font-mono); margin-top: 2px; }

/* 色卡 */
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 12px; }
.swatch { display: grid; grid-template-columns: 56px 1fr; gap: 12px; align-items: start; border: 1px solid var(--ui-border); border-radius: 10px; padding: 10px; }
.swatch-chip { height: 56px; border-radius: 8px; border: 1px solid var(--ui-border); }
/* 文字色档：在色块里渲染真实文字，否则空色块看不出任何东西 */
.swatch-fg { display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; background: var(--ui-bg); }
/* 反色文字档：必须放在深色底上，否则白字白底看不见 */
.swatch-fg-inv { background: var(--foreground); }
/* 描边档：填充 + 2px 实边。描边色本身很浅（#E2E8F0），所以块内先铺一层
   深一点的底纹，否则 2px 边框在白底上几乎看不见，等于没示范。 */
.swatch-edge {
  background:
    repeating-linear-gradient(45deg, var(--ui-muted), var(--ui-muted) 5px, transparent 5px, transparent 10px);
  border-width: 2px;
  border-style: solid;
}
.swatch-token { font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; }
.swatch-cls { margin-left: 6px; }
.swatch-use { color: var(--ui-sub); font-size: 12px; margin-top: 3px; }
.swatch-vals { display: flex; gap: 12px; font-size: 11px; color: var(--ui-sub); margin-top: 3px; font-family: var(--font-mono); }
.swatch-vals em { font-style: normal; opacity: .7; }

/* 组件示范 */
.demo-grid { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
.demo-box { border: 1px dashed var(--ui-border); border-radius: 10px; padding: 14px; min-width: 160px; }
.demo-box > .cap { font-size: 11px; color: var(--ui-sub); margin-top: 10px; font-family: var(--font-mono); }

/* 按钮 */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  font-size: 14px; font-weight: 500; line-height: 20px;
  padding: 0 12px; border-radius: 8px; border: 1px solid transparent;
  cursor: pointer; white-space: nowrap; font-family: inherit;
}
.btn-primary { background: var(--primary-strong); color: var(--primary-foreground); }
.btn-primary:hover { background: var(--hover-primary); }
.btn-secondary { background: var(--secondary); color: var(--secondary-foreground); border-color: var(--border); }
.btn-outline { background: transparent; color: var(--foreground); border-color: var(--border); }
.btn-destructive { background: var(--destructive); color: var(--destructive-foreground); }
.btn-link { background: transparent; color: var(--primary); text-decoration: underline; text-underline-offset: 4px; }
.btn-ghost { background: transparent; color: var(--foreground); }
.btn:disabled { opacity: .5; cursor: not-allowed; }

/* 徽标 */
.badge {
  display: inline-flex; align-items: center; border-radius: 9999px;
  padding: 0 8px; height: 24px; font-size: 12px; line-height: 16px; font-weight: 400;
  border: 1px solid transparent; white-space: nowrap;
}
.badge-outline { border-color: var(--border); color: var(--foreground); }
.badge-secondary { background: var(--secondary); color: var(--secondary-foreground); }
.badge-success { background: var(--success-soft); color: var(--success-soft-foreground); }
.badge-destructive { background: var(--destructive-soft); color: var(--destructive-soft-foreground); }
.badge-warning { background: var(--warning-soft); color: var(--warning-soft-foreground); }
.badge-info { background: var(--info-soft); color: var(--info-soft-foreground); }

/* 表单 */
.inp {
  display: flex; align-items: center; gap: 8px; width: 100%;
  border: 1px solid var(--input); border-radius: 8px; padding: 0 12px;
  background: var(--background); color: var(--foreground); font-size: 14px; line-height: 20px;
  font-family: inherit;
}
.inp::placeholder { color: var(--fg-placeholder); }
.inp:focus-visible { outline: 1px solid var(--ring); outline-offset: 0; }
.field { display: flex; flex-direction: column; gap: 8px; }
.field label { font-size: 14px; font-weight: 500; color: var(--foreground); }
.field .desc { font-size: 14px; color: var(--fg-secondary); }
.field .err { font-size: 14px; color: var(--destructive); display: flex; align-items: center; gap: 4px; }

/* 卡片 */
.dscard {
  background: var(--card); color: var(--card-foreground);
  border: 1px solid var(--border); border-radius: 10px; padding: 24px;
}
.dscard h4 { font-size: 18px; font-weight: 600; line-height: 28px; margin: 0 0 8px; }
.dscard p { font-size: 14px; line-height: 20px; color: var(--fg-secondary); margin: 0; }
.dscard .sum { font-size: 14px; color: var(--muted-foreground); }

/* 表格 */
.ds-table { width: 100%; border-collapse: collapse; }
.ds-table th {
  height: 40px; padding: 8px 12px; text-align: left; font-size: 14px; font-weight: 500;
  color: var(--foreground); background: var(--table-header, color-mix(in oklch, var(--foreground) 1.5%, var(--background)));
  border-bottom: 1px solid var(--border);
}
.ds-table td { height: 48px; padding: 8px 12px; font-size: 14px; border-bottom: 1px solid var(--border); color: var(--foreground); }

/* 侧栏选中态 */
.side-item {
  display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px;
  border-radius: 8px; font-size: 14px; font-weight: 500; color: var(--sidebar-foreground);
}
.side-item.active { background: var(--primary-subtle); color: var(--sidebar-active-foreground); }
.side-item.active svg { color: var(--sidebar-active-foreground); }

/* 图标 */
.ico { display: inline-flex; align-items: center; justify-content: center; }
.ico svg { stroke: currentColor; }

/* 焦点环演示 */
.focus-demo { outline: 1px solid var(--ring); outline-offset: 0; border-radius: 8px; }

/* 投影 */
.elev-demo { width: 140px; height: 70px; border-radius: 10px; background: var(--card); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; }

/* 动效 */
.anim-box { width: 40px; height: 40px; border-radius: 8px; background: var(--primary); }
.pulse { animation: ds-pulse 1s ease-in-out infinite; }
@keyframes ds-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(.6); opacity: .5; } }

.ruler { height: 14px; background: var(--primary); border-radius: 3px; }
.hit { height: 40px; background: repeating-linear-gradient(45deg, var(--primary-subtle), var(--primary-subtle) 6px, transparent 6px, transparent 12px); border: 1px dashed var(--primary-border); border-radius: 6px; }

.footer-note { margin-top: 60px; padding-top: 20px; border-top: 1px solid var(--ui-border); font-size: 12px; color: var(--ui-sub); }
</style>
</head>
<body>

<div class="toolbar">
  <button class="tbtn" id="toggle-dark" aria-pressed="false">🌙 深色模式</button>
  <button class="tbtn" id="toggle-scale-sm" aria-pressed="false">密度 sm</button>
  <button class="tbtn" id="toggle-scale-xl" aria-pressed="false">密度 xl</button>
  <span class="spacer"></span>
  <span style="font-size:12px;color:var(--ui-sub)">核查页由 <code>node scripts/generate-design-showcase.mjs</code> 从真实 Token 编译生成</span>
</div>

<div class="wrap">

<header class="page-head">
  <h1>UTER 设计规范 · 可视化核查页</h1>
  <p>本页所有色值、字号、尺寸均<strong>直接来自项目真实 Token 源码</strong>（<code>src/styles/theme.css</code> + <code>src/design-system/tokens/*</code>），由 Tailwind v4 编译产出，与线上表现一致。逐项核查后如有异议，改 Token 源码并重新生成本页。</p>
</header>

<nav class="toc">
  <h2>目录</h2>
  <ol>
    <li><a href="#type">1. 字号十档</a></li>
    <li><a href="#mono">2. mono 三档</a></li>
    <li><a href="#level">3. 页面层级四层</a></li>
    <li><a href="#fg">4. 文字色七档</a></li>
    <li><a href="#surface">5. 表面与描边</a></li>
    <li><a href="#brand">6. 品牌色阶</a></li>
    <li><a href="#status">7. 状态色</a></li>
    <li><a href="#chart">8. 图表分类色</a></li>
    <li><a href="#syntax">9. 语法高亮色</a></li>
    <li><a href="#term">10. 首屏演示 Token（term-*）</a></li>
    <li><a href="#radius">11. 圆角七档</a></li>
    <li><a href="#space">12. 间距</a></li>
    <li><a href="#density">13. 密度 Token</a></li>
    <li><a href="#elevation">14. 投影六档</a></li>
    <li><a href="#motion">15. 动效</a></li>
    <li><a href="#btn">16. Button 九档</a></li>
    <li><a href="#control">17. 控件尺寸</a></li>
    <li><a href="#icon">18. 图标五档</a></li>
    <li><a href="#comp">19. 组件示范</a></li>
    <li><a href="#nav">20. 导航选中态</a></li>
    <li><a href="#focus">21. 焦点环与触控目标</a></li>
  </ol>
</nav>

<section id="type">
  <h2><span class="n">1</span>字号十档</h2>
  <p class="lead">正文基准 14px。行高是字号自带的属性，不允许再写 <code>leading-*</code>。</p>
  <div class="card">
    ${TYPOGRAPHY.map(typeRow).join('\n')}
  </div>
</section>

<section id="mono">
  <h2><span class="n">2</span>mono 三档</h2>
  <p class="lead">等宽专用派生档，不占十档位置。正文里的等宽文本一律 14px。</p>
  <div class="card">
    ${MONO.map(typeRow).join('\n')}
  </div>
</section>

<section id="level">
  <h2><span class="n">3</span>页面层级四层</h2>
  <p class="lead">一个后台页面只有四层可见标题，缺一层或跳一层都会「看起来哪里不对」。</p>
  <div class="card">
    <div style="border:1px solid var(--ui-border); border-radius:10px; padding:20px; display:flex; flex-direction:column; gap:14px;">
      <div>
        <div class="text-3xl font-semibold" style="color:var(--foreground)">页面标题 28/600</div>
        <div style="font-size:12px;color:var(--ui-sub);font-family:var(--font-mono)">L1 · page-title · Heading variant="page-title"</div>
      </div>
      <div>
        <div class="text-2xl font-semibold" style="color:var(--foreground)">区块标题 22/600</div>
        <div style="font-size:12px;color:var(--ui-sub);font-family:var(--font-mono)">L2 · section-title · Heading variant="section-title"</div>
      </div>
      <div>
        <div class="text-lg font-semibold" style="color:var(--foreground)">卡片标题 18/600</div>
        <div style="font-size:12px;color:var(--ui-sub);font-family:var(--font-mono)">L3 · card-title · Heading variant="card-title"</div>
      </div>
      <div>
        <div class="text-group font-semibold" style="color:var(--foreground)">卡片内分组标题 15/600</div>
        <div style="font-size:12px;color:var(--ui-sub);font-family:var(--font-mono)">L4 · group-title · Heading variant="group-title"</div>
      </div>
      <div>
        <div class="text-sm" style="color:var(--foreground)">正文 14/400 —— 一眼扫过去就能懂，不需要逐字读</div>
        <div style="font-size:12px;color:var(--ui-sub);font-family:var(--font-mono)">body · Text variant="body"</div>
      </div>
      <div>
        <div class="text-long" style="color:var(--foreground)">长文本 16/26 —— 需要连续阅读多段的内容，会出现 3 行以上的段落</div>
        <div style="font-size:12px;color:var(--ui-sub);font-family:var(--font-mono)">body-long · Text variant="body-long"</div>
      </div>
    </div>
  </div>
</section>

<section id="fg">
  <h2><span class="n">4</span>文字色七档</h2>
  <p class="lead">用 <code>--fg-*</code> 前缀。<strong>不能叫 <code>--text-*</code></strong> —— Tailwind v4 把 <code>--text-*</code> 保留给字号命名空间。</p>
  <div class="card">
    <div class="swatches">
      ${TEXT_COLORS.map(c => swatch(c, { kind: 'fg' })).join('\n')}
    </div>
  </div>
</section>

<section id="surface">
  <h2><span class="n">5</span>表面与描边</h2>
  <p class="lead">层级靠「1px 描边 + 表面色差」表达，不靠投影。</p>
  <div class="card">
    <div class="swatches">
      ${SURFACE_COLORS.map(c => swatch(c)).join('\n')}
    </div>
  </div>
</section>

<section id="brand">
  <h2><span class="n">6</span>品牌色阶</h2>
  <p class="lead"><code>--primary</code> 是唯一入口，其余五档由它派生。组件里出现品牌色字面值 = 改品牌色不生效。</p>
  <div class="card">
    <div class="swatches">
      ${BRAND_COLORS.map(c => swatch(c, { kind: c.cls.startsWith('text-') ? 'fg' : 'bg' })).join('\n')}
    </div>
  </div>
</section>

<section id="status">
  <h2><span class="n">7</span>状态色</h2>
  <p class="lead">浅底深字的语义徽标用 <code>{status}-soft</code> + <code>{status}-soft-foreground</code>，不要用 <code>bg-*/10</code> 透明度凑。</p>
  <div class="card">
    <div class="swatches">
      ${STATUS_COLORS.map(c => swatch(c)).join('\n')}
    </div>
  </div>
</section>

<section id="chart">
  <h2><span class="n">8</span>图表分类色</h2>
  <p class="lead"><code>chart-N</code> 是分类色，<strong>不是状态色</strong>，不得用来表达成功/失败。</p>
  <div class="card">
    <div class="swatches">
      ${CHART_COLORS.map(c => swatch(c)).join('\n')}
    </div>
  </div>
</section>

<section id="syntax">
  <h2><span class="n">9</span>语法高亮色</h2>
  <p class="lead">按语言语法着色，与界面状态语义无关。</p>
  <div class="card">
    <div style="font-family:var(--font-mono); font-size:13px; line-height:26px; background:var(--ui-muted); border:1px solid var(--ui-border); border-radius:8px; padding:14px 18px;">
      <div><span class="text-syntax-keyword">const</span> <span class="text-syntax-function">fetch</span>(<span class="text-syntax-string">'https://api.uter.ai/v1/chat'</span>, {</div>
      <div>&nbsp;&nbsp;model: <span class="text-syntax-string">'claude-opus-5'</span>,</div>
      <div>&nbsp;&nbsp;max_tokens: <span class="text-syntax-number">4096</span>,</div>
      <div>&nbsp;&nbsp;stream: <span class="text-syntax-property">true</span></div>
      <div>})</div>
    </div>
    <div class="swatches" style="margin-top:16px">
      ${SYNTAX_COLORS.map(c => swatch(c, { kind: 'fg' })).join('\n')}
    </div>
  </div>
</section>

<section id="term">
  <h2><span class="n">10</span>首屏演示 Token（term-*）</h2>
  <p class="lead">这一组只对「渲染效果」负责：取值锚定上游 new-api，效果到位就该写 Token，不需要登记例外（规范 §11.5）。</p>

  <div class="card">
    <h3>代码卡实况（逐 Token 渲染，与线上同一批值）</h3>
    <p class="hint">这张卡里的每个颜色都来自 <code>--term-*</code>，没有一个调色板类名；下方再逐个拆开核查</p>
    <div style="background:var(--card); border:1px solid var(--ui-border); border-radius:12px; overflow:hidden">
      <div style="display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--ui-border); padding:6px 12px">
        ${TERM_ACCENTS.map((a, i) => `
        <span class="${i === 0 ? a.text : 'text-term-dim-3'} ${i === 0 ? a.line : 'border-transparent'}" style="border-bottom-width:2px; padding:6px 8px; font-size:14px; font-weight:500">${a.tone}</span>`).join('')}
        <span style="margin-left:auto; display:flex; align-items:center; gap:6px">
          <span class="bg-term-online shadow-(--ds-glow-online)" style="width:6px;height:6px;border-radius:9999px;display:inline-block"></span>
          <span class="text-term-dim-3" style="font-family:var(--font-mono);font-size:13px;text-transform:uppercase">200 ok</span>
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--ui-border); padding:10px 18px">
        <span class="${TERM_ACCENTS[0].soft} ${TERM_ACCENTS[0].text}" style="border-radius:6px; padding:2px 6px; font-family:var(--font-mono); font-size:13px; font-weight:600">POST</span>
        <code class="text-term-dim-1" style="font-family:var(--font-mono); font-size:13px">/v1/chat/completions</code>
      </div>
      <div style="padding:14px 18px; font-family:var(--font-mono); font-size:13px; line-height:22px">
        <div><span class="text-term-command" style="font-weight:500">curl</span> <span class="text-term-flag">-X</span> <span class="text-term-flag">POST</span> <span class="text-term-string">"/v1/chat/completions"</span> <span class="text-term-dim-2">\</span></div>
        <div>&nbsp;&nbsp;<span class="text-term-flag">-H</span> <span class="text-term-string">"Authorization: Bearer sk-••••"</span> <span class="text-term-dim-2">\</span></div>
        <div>&nbsp;&nbsp;<span class="text-term-flag">-d</span> <span class="text-term-string">'{'</span></div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="text-term-property">"model"</span><span class="text-term-dim-2">:</span> <span class="text-term-string">"gpt-5"</span><span class="text-term-dim-2">,</span></div>
        <div>&nbsp;&nbsp;&nbsp;&nbsp;<span class="text-term-property">"max_tokens"</span><span class="text-term-dim-2">:</span> <span class="text-term-number">4096</span></div>
        <div>&nbsp;&nbsp;<span class="text-term-string">}'</span></div>
      </div>
      <div style="border-top:1px solid var(--ui-border); padding:12px 18px; display:flex; align-items:center; justify-content:space-between; background:var(--ui-muted)">
        <span class="text-term-dim-3" style="display:flex; align-items:center; gap:10px; font-size:12px">
          <span style="font-family:var(--font-mono)">142</span> ms
          <span class="bg-term-dot" style="width:4px;height:4px;border-radius:9999px"></span>
          <span style="font-family:var(--font-mono)">27</span> tokens
        </span>
        <span class="text-term-dim-4" style="font-family:var(--font-mono); font-size:13px; text-transform:uppercase">stream · sse</span>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>语法角色 · 五档</h3>
    <p class="hint">通用代码查看走 <code>syntax-*</code>，这两套不许互相引用，也不许合并</p>
    <div class="swatches">
      ${TERM_SYNTAX.map(c => swatch(c, { kind: 'fg' })).join('\n')}
    </div>
  </div>

  <div class="card">
    <h3>弱层级四档 · 替代 <code>text-foreground/NN</code></h3>
    <p class="hint">渲染结果与原先的不透明度等价，但「实色」可测对比度、不随底层表面漂移</p>
    <div class="swatches">
      ${TERM_DIM.map(c => swatch(c, { kind: 'fg' })).join('\n')}
    </div>
  </div>

  <div class="card">
    <h3>分类强调色 · 四组</h3>
    <p class="hint">文字 / 激活描边 / 方法徽标底，三者同 tone；描边取饱和档，深色两档同值</p>
    <div class="demo-grid">
      ${TERM_ACCENTS.map(a => `
        <div class="demo-box">
          <span class="${a.soft} ${a.text}" style="display:inline-block; border-radius:6px; padding:3px 8px; font-family:var(--font-mono); font-size:13px; font-weight:600">${a.method}</span>
          <div class="${a.line}" style="border-bottom-width:2px; width:56px; margin-top:10px"></div>
          <div class="cap">${a.tone}<br><span style="color:var(--ui-sub)">text / line / soft</span></div>
        </div>`).join('')}
    </div>
  </div>

  <div class="card">
    <h3>状态点与品牌渐变</h3>
    <p class="hint">在线点与辉光走 Token，不写裸 <code>rgba()</code>；渐变只经由 <code>ds-text-gradient-brand</code></p>
    <div class="demo-grid" style="align-items:center">
      <div class="demo-box">
        <span class="bg-term-online shadow-(--ds-glow-online)" style="width:10px;height:10px;border-radius:9999px;display:inline-block"></span>
        <span class="bg-term-dot" style="width:10px;height:10px;border-radius:9999px;display:inline-block;margin-left:10px"></span>
        <div class="cap">bg-term-online · bg-term-dot</div>
      </div>
      <div class="demo-box">
        <span class="ds-text-gradient-brand" style="font-size:24px; font-weight:600">直达全球大模型</span>
        <div class="cap">ds-text-gradient-brand<br><span style="color:var(--ui-sub)">24px 大文本，阈值 3:1</span></div>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>背景装饰层（ds-decor-*）</h3>
    <p class="hint">hero / CTA 背后的光晕、网格与遮罩：颜色在 <code>--ds-decor-glow-*</code>、透明度在 <code>--ds-decor-mesh-opacity-*</code>（深色各压低一档），形状收在 <code>foundations/decoration.css</code></p>
    <div class="demo-grid">
      <div class="demo-box" style="grid-column: span 2">
        <div class="ds-decor-mesh-hero" style="position:relative; width:100%; height:96px; border-radius:8px; border:1px solid var(--ui-border)"></div>
        <div class="cap">ds-decor-mesh-hero<br><span style="color:var(--ui-sub)">hero 三团光晕（蓝 / 青 / 紫）+ 整层透明度</span></div>
      </div>
      <div class="demo-box">
        <div class="ds-decor-mesh-cta" style="position:relative; width:100%; height:96px; border-radius:8px; border:1px solid var(--ui-border)"></div>
        <div class="cap">ds-decor-mesh-cta<br><span style="color:var(--ui-sub)">CTA 两团弱化光晕</span></div>
      </div>
    </div>
    <div class="demo-grid" style="margin-top:12px">
      <div class="demo-box" style="grid-column: span 3">
        <div class="ds-decor-grid" style="position:relative; width:100%; height:96px; border-radius:8px; border:1px solid var(--ui-border)"></div>
        <div class="cap">ds-decor-grid<br><span style="color:var(--ui-sub)">1px 网格线（--border）+ 4rem 方格 + 椭圆渐隐遮罩，透明度 0.08</span></div>
      </div>
    </div>
    <p class="hint" style="margin-top:8px">组件里禁止内联 <code>radial-gradient(...oklch...)</code> 与散装透明度（<code>opacity-25 dark:opacity-[0.12]</code>）—— 深浅两档的取舍必须留在 Token 里</p>
  </div>
</section>

<section id="radius">
  <h2><span class="n">11</span>圆角七档</h2>
  <p class="lead">基准 <code>--radius</code> = 8px，其余按比例推导。禁止 <code>rounded-[7px]</code> 之类任意值。</p>
  <div class="card">
    <div class="demo-grid">
      ${RADII.map(r => `
        <div class="demo-box">
          <div class="${r.cls}" style="width:80px;height:56px;background:var(--primary-subtle);border:2px solid var(--primary)"></div>
          <div class="cap">${r.token} · ${r.px}px<br><span style="color:var(--ui-sub)">${esc(r.use)}</span></div>
        </div>`).join('')}
    </div>
  </div>
</section>

<section id="space">
  <h2><span class="n">12</span>间距</h2>
  <p class="lead">间距阶梯就是 Tailwind 的 4px 单位，不另建 <code>--spacing-*</code>。</p>
  <div class="card">
    <table class="t">
      <thead><tr><th>类名</th><th>实际值</th><th>场景</th><th>可视化</th></tr></thead>
      <tbody>
        ${SPACING.map(s => `
          <tr>
            <td><code>${s.cls}</code></td>
            <td><strong>${s.px}px</strong></td>
            <td>${esc(s.use)}</td>
            <td><div class="ruler" style="width:${s.px * 2}px"></div></td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
</section>

<section id="density">
  <h2><span class="n">13</span>密度 Token</h2>
  <p class="lead">密度只改留白与控件高度，<strong>不改字号</strong>。用顶部按钮切换 sm / xl 观察。</p>
  <div class="card">
    <table class="t">
      <thead><tr><th>Token</th><th>默认</th><th>sm</th><th>xl</th></tr></thead>
      <tbody>
        ${DENSITY.map(d => `
          <tr>
            <td><code>${d.token}</code></td>
            <td>${d.def}px</td><td>${d.sm}px</td><td>${d.xl}px</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
</section>

<section id="elevation">
  <h2><span class="n">14</span>投影六档</h2>
  <p class="lead">四档投影 + 一档状态辉光。除这六档之外一律不投影。</p>
  <div class="card">
    <div class="demo-grid">
      ${ELEVATIONS.map(e => `
        <div class="demo-box">
          <div class="elev-demo ${e.cls}">${e.token.includes('glow') ? '●' : '面'}</div>
          <div class="cap">${e.token}<br><span style="color:var(--ui-sub)">${esc(e.use)}</span></div>
        </div>`).join('')}
    </div>
  </div>
</section>

<section id="motion">
  <h2><span class="n">15</span>动效</h2>
  <p class="lead">时长按「这段动效在表达什么」分组。裸 <code>transition-*</code> = 交互反馈最快一档（100ms）。</p>
  <div class="card">
    <table class="t">
      <thead><tr><th>Token</th><th>时长</th><th>用途</th><th>工具类</th></tr></thead>
      <tbody>
        ${MOTIONS.map(m => `
          <tr>
            <td><code>${m.token}</code></td>
            <td><strong>${m.ms}ms</strong></td>
            <td>${esc(m.use)}</td>
            <td><code>${esc(m.cls)}</code></td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
</section>

<section id="btn">
  <h2><span class="n">16</span>Button 九档</h2>
  <p class="lead">高度只来自 <code>size</code> 档，不要在调用点写 <code>h-N</code>。</p>
  <div class="card">
    <div class="demo-grid">
      ${BUTTON_SIZES.map(b => `
        <div class="demo-box">
          <div class="btn btn-primary ${b.size === 'icon' ? 'p-0' : ''}" style="${buttonStyle(
            b,
          )}">${buttonLabel(b)}</div>
          <div class="cap">${b.size} · ${b.h}px · r-${b.r}<br><span style="color:var(--ui-sub)">${esc(b.use)}</span></div>
        </div>`).join('')}
    </div>
    <h3 style="margin-top:20px">变体</h3>
    <p class="hint">同一档尺寸下的五种视觉身份</p>
    <div class="demo-grid">
      <div class="demo-box"><div class="btn btn-primary h-9">主要操作</div><div class="cap">primary</div></div>
      <div class="demo-box"><div class="btn btn-secondary h-9">次要操作</div><div class="cap">secondary</div></div>
      <div class="demo-box"><div class="btn btn-outline h-9">描边操作</div><div class="cap">outline</div></div>
      <div class="demo-box"><div class="btn btn-destructive h-9">删除账户</div><div class="cap">destructive</div></div>
      <div class="demo-box"><div class="btn btn-ghost h-9">幽灵操作</div><div class="cap">ghost</div></div>
      <div class="demo-box"><div class="btn btn-link h-9">文字链接</div><div class="cap">link</div></div>
      <div class="demo-box"><div class="btn btn-primary h-9" disabled>禁用状态</div><div class="cap">disabled</div></div>
    </div>
  </div>
</section>

<section id="control">
  <h2><span class="n">17</span>控件尺寸</h2>
  <p class="lead">高度全部由 Token 驱动，密度切换时自动跟随。</p>
  <div class="card">
    <table class="t">
      <thead><tr><th>元素</th><th>高度</th><th>Token</th><th>用途</th><th>可视化</th></tr></thead>
      <tbody>
        ${CONTROL_SIZES.map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.h}px</td>
            <td><code>${c.cls}</code></td>
            <td>${esc(c.use)}</td>
            <td><div style="height:${c.h}px;width:80px;background:var(--primary-subtle);border:1px solid var(--primary-border);border-radius:6px"></div></td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
</section>

<section id="icon">
  <h2><span class="n">18</span>图标五档</h2>
  <p class="lead">统一 Lucide，描边统一 2px，尺寸只能落在 16 / 18 / 24 / 32 / 48。</p>
  <div class="card">
    <div class="demo-grid">
      ${ICON_SIZES.map(i => `
        <div class="demo-box" style="text-align:center">
          <div class="ico ${i.cls}" style="color:var(--foreground)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>
          </div>
          <div class="cap">${i.px}px · ${i.cls}<br><span style="color:var(--ui-sub)">${esc(i.use)}</span></div>
        </div>`).join('')}
    </div>
  </div>
</section>

<section id="comp">
  <h2><span class="n">19</span>组件示范</h2>
  <p class="lead">按规范 §15「组件排版对应表」逐个核查</p>

  <div class="card">
    <h3>Button / Badge</h3>
    <p class="hint">Button 14/500 label 档 · Badge 12/400 caption 档 · StatusBadge 14/400 body-sm 档</p>
    <div class="demo-grid" style="align-items:center">
      <span class="badge badge-outline">徽标 caption 12/16</span>
      <span class="badge badge-secondary">分类标签</span>
      <span class="badge badge-success">已启用</span>
      <span class="badge badge-destructive">已禁用</span>
      <span class="badge badge-warning">需注意</span>
      <span class="badge badge-info">提示</span>
      <span class="badge badge-secondary" style="height:20px;font-size:14px">状态徽标 14/20</span>
    </div>
  </div>

  <div class="card">
    <h3>Input / Textarea / FormField</h3>
    <p class="hint">输入文字全平台 14px（body-sm），<strong>不设 H5 16px 例外</strong></p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px">
      <div class="field">
        <label>正常输入框</label>
        <div class="inp" style="height:40px">claude-opus-5</div>
        <span class="desc">说明文字 14/400 body-sm</span>
      </div>
      <div class="field">
        <label>占位符态</label>
        <div class="inp" style="height:40px"><span style="color:var(--fg-placeholder)">sk-ut-••••••••••••</span></div>
        <span class="desc">placeholder = fg-placeholder</span>
      </div>
      <div class="field">
        <label>错误态</label>
        <div class="inp" style="height:40px;border-color:var(--destructive)">invalid</div>
        <span class="err">✕ 密钥格式不正确</span>
      </div>
      <div class="field">
        <label>禁用态</label>
        <div class="inp" style="height:40px;opacity:.5;background:var(--input)">disabled</div>
        <span class="desc">禁用态 = fg-disabled</span>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>Card</h3>
    <p class="hint">标题 18/600 h3 · 描述 14/400 body-sm · 汇总值恒 14px</p>
    <div class="dscard">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px">
        <h4>配额分布</h4>
        <span class="sum">总计：$0.03</span>
      </div>
      <p>本月各模型的 Token 消耗与费用占比，用于核对账单口径。</p>
    </div>
  </div>

  <div class="card">
    <h3>Dialog</h3>
    <p class="hint">标题 18/600 h3 · 描述 14/400 body-sm · 圆角 r-lg 10px</p>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;box-shadow:var(--ds-elevation-overlay);max-width:420px;padding:20px">
      <h4 style="font-size:18px;font-weight:600;line-height:28px;margin:0 0 8px">删除账户</h4>
      <p style="font-size:14px;line-height:20px;color:var(--fg-secondary);margin:0 0 16px">此操作将永久删除你的账户与全部数据，无法撤销。</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary h-9">取消</button>
        <button class="btn btn-destructive h-9">确认删除</button>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>Table</h3>
    <p class="hint">行高 48px · 单元格 px-3 py-2 · 表头高 40px</p>
    <table class="ds-table">
      <thead><tr><th>模型</th><th>供应商</th><th>价格（$/1M）</th></tr></thead>
      <tbody>
        <tr><td style="font-family:var(--font-mono)">claude-opus-5</td><td>Anthropic</td><td style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">$15.00</td></tr>
        <tr><td style="font-family:var(--font-mono)">gpt-5</td><td>OpenAI</td><td style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">$7.50</td></tr>
        <tr><td style="font-family:var(--font-mono)">gemini-3-pro</td><td>Google</td><td style="font-family:var(--font-mono);font-variant-numeric:tabular-nums">$12.00</td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h3>Toast / Alert</h3>
    <p class="hint">标题 14/500 label · 描述 14/400 body-sm · Alert 内边距 p-4 图标间距 12px</p>
    <div style="display:flex;flex-direction:column;gap:12px;max-width:420px">
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;display:flex;gap:12px;align-items:flex-start">
        <span style="color:var(--success);font-size:18px;line-height:28px">✓</span>
        <div><div style="font-size:14px;font-weight:500;line-height:20px">保存成功</div><div style="font-size:14px;line-height:20px;color:var(--fg-secondary)">新的密钥已生效，旧密钥仍然可用。</div></div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;display:flex;gap:12px;align-items:flex-start">
        <span style="color:var(--destructive);font-size:18px;line-height:28px">✕</span>
        <div><div style="font-size:14px;font-weight:500;line-height:20px">余额不足</div><div style="font-size:14px;line-height:20px;color:var(--fg-secondary)">当前余额 $0.12，已自动暂停低优先级渠道。</div></div>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>Empty 状态</h3>
    <p class="hint">标题 18/600 · 说明 14/400 · 图标 32px（整页级 48px）</p>
    <div style="display:flex;gap:16px;align-items:flex-start">
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px;border:1px dashed var(--ui-border);border-radius:10px;width:220px">
        <div class="ico size-8" style="color:var(--muted-foreground)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7h18M3 12h18M3 17h10"/></svg></div>
        <div style="font-size:18px;font-weight:600;line-height:28px">暂无日志</div>
        <div style="font-size:14px;line-height:20px;color:var(--fg-secondary);text-align:center">发起一次 API 调用后，记录会显示在这里。</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px;border:1px dashed var(--ui-border);border-radius:10px;width:220px">
        <div class="ico size-12" style="color:var(--muted-foreground)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 7h18M3 12h18M3 17h10"/></svg></div>
        <div style="font-size:18px;font-weight:600;line-height:28px">整页级空状态</div>
        <div style="font-size:14px;line-height:20px;color:var(--fg-secondary);text-align:center">图标 48px（size-12）</div>
      </div>
    </div>
  </div>
</section>

<section id="nav">
  <h2><span class="n">20</span>导航选中态</h2>
  <p class="lead">底色 <code>bg-primary-subtle</code> + 文字 <code>text-sidebar-active-foreground</code>（4.93:1）。不用 <code>text-primary</code>（仅 4.44:1，不达 AA）。</p>
  <div class="card">
    <div style="display:flex;gap:24px">
      <div style="width:220px;background:var(--sidebar);border:1px solid var(--sidebar-border);border-radius:10px;padding:8px">
        <div class="side-item">
          <span class="ico size-4.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></span>
          仪表盘
        </div>
        <div class="side-item active">
          <span class="ico size-4.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg></span>
          模型广场
        </div>
        <div class="side-item">
          <span class="ico size-4.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg></span>
          调用日志
        </div>
      </div>
      <div style="flex:1;min-width:240px">
        <h3>对比度实测</h3>
        <table class="t">
          <thead><tr><th>组合</th><th>前景</th><th>底色</th><th>对比度</th><th>判定</th></tr></thead>
          <tbody>
            <tr><td>导航选中态（专用 Token）</td><td><code>#5558D8</code></td><td><code>#F0F0FF</code></td><td><strong>4.93:1</strong></td><td><span class="ok">✅ AA</span></td></tr>
            <tr><td>误用 <code>text-primary</code></td><td><code>#5B5EE6</code></td><td><code>#F0F0FF</code></td><td><strong>4.44:1</strong></td><td><span class="bad">❌ 差 0.06</span></td></tr>
            <tr><td>品牌主色配白字</td><td><code>#FFFFFF</code></td><td><code>#5B5EE6</code></td><td><strong>4.7:1</strong></td><td><span class="ok">✅ AA</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>

<section id="focus">
  <h2><span class="n">21</span>焦点环与触控目标</h2>
  <p class="lead">全站只有一种焦点指示器：1px 环，贴着边框外沿（outline-offset: 0）。触控目标 ≥ 24×24。</p>
  <div class="card">
    <div style="display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap">
      <div>
        <h3>焦点环 1px</h3>
        <div class="btn btn-primary h-9 focus-demo">键盘聚焦时</div>
        <p class="hint" style="margin-top:8px">原生元素走 <code>outline</code>，组件走 <code>ring-1</code>，两者几何一致。</p>
      </div>
      <div>
        <h3>触控目标 24×24</h3>
        <div style="display:flex;gap:16px;align-items:center">
          <button class="ds-touch-target flex size-4 items-center justify-center" style="border:1px solid var(--border);border-radius:4px;background:var(--background)">✕</button>
          <button class="flex size-6 items-center justify-center" style="border:1px solid var(--border);border-radius:4px;background:var(--background)">✕</button>
        </div>
        <p class="hint" style="margin-top:8px">左：视觉 16px + <code>.ds-touch-target</code> 命中区 24px；右：视觉 24px。</p>
      </div>
    </div>
  </div>
</section>

<div class="footer-note">
  <p><strong>核查方法：</strong>逐项对照上表与 <code>web/docs/design-system/design-system.md</code>。发现问题先改 Token 源码（<code>src/styles/theme.css</code> 或 <code>src/design-system/tokens/*</code>），再运行 <code>node scripts/generate-design-showcase.mjs</code> 重新生成本页，然后跑 <code>node scripts/check-design-tokens.mjs --strict</code> 与 <code>bunx vitest run src/design-system/__tests__</code>。</p>
</div>

</div>

<script>
  const root = document.documentElement
  document.getElementById('toggle-dark').addEventListener('click', (e) => {
    const on = root.classList.toggle('dark')
    e.currentTarget.setAttribute('aria-pressed', String(on))
    e.currentTarget.textContent = on ? '☀️ 浅色模式' : '🌙 深色模式'
  })
  const setScale = (v, btn) => {
    if (v) root.setAttribute('data-theme-scale', v)
    else root.removeAttribute('data-theme-scale')
    document.querySelectorAll('#toggle-scale-sm, #toggle-scale-xl').forEach(b => b.setAttribute('aria-pressed', 'false'))
    if (btn) btn.setAttribute('aria-pressed', 'true')
  }
  document.getElementById('toggle-scale-sm').addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') === 'true'
    setScale(on ? null : 'sm', on ? null : e.currentTarget)
  })
  document.getElementById('toggle-scale-xl').addEventListener('click', (e) => {
    const on = e.currentTarget.getAttribute('aria-pressed') === 'true'
    setScale(on ? null : 'xl', on ? null : e.currentTarget)
  })
</script>
</body>
</html>
`

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, html, 'utf8')

console.log(`✅ 核查页已生成：${path.relative(REPO_ROOT, OUT_PATH)}`)
console.log(`   大小：${(html.length / 1024).toFixed(1)} KB`)
console.log(`   编译 Token：${CANDIDATES.length} 个候选类，产物 ${(css.length / 1024).toFixed(1)} KB`)
