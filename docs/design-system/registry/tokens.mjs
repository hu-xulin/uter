/*
 * Copyright (C) 2026 Uter.ai
 * SPDX-License-Identifier: UNLICENSED
 *
 * UTER DESIGN SYSTEM 8.0.0 — Token definition (唯一数值输入)
 *
 * 本文件只负责「定义」，产物 TOKEN-MANIFEST.json 才是被读取的唯一真源。
 * build.mjs 会先写出 manifest，再重新从磁盘读回，所有 CSS / TS / Showcase /
 * 规范文档 / 自动化检查都从该 JSON 派生。禁止任何产物另写一份数值。
 *
 * 全部数值为确定值；禁止 TBD / TODO / 待定 / 按需调整。
 */

import { runVerification, GRADIENT_INTERPOLATION, GRADIENT_SAMPLE_COUNT } from './contrast-engine.mjs'
import { VSCODE_SYNTAX } from './vscode-theme.mjs'
import { CONSUMERS } from './consumers.mjs'
import {
  EXTRA_COLOR_GROUPS, COMPONENT_SPECS, PRODUCT_CONTEXTS,
  COLOR_LAYERS, CHART_NON_COLOR_CHANNELS,
} from './color-architecture.mjs'

export const VERSION = '8.0.0'
/* 状态推进：2026-11-16 经用户授权正式升版 8.0.0 —— 运行时前缀 --ds7-* → --ds8-*、
 * colors.css 遗留冲突语义（CM-02~06）闭合、产物文件名与检查器全部换版。
 * 全量自动化门禁通过后为 ACCEPTANCE_READY。accepted 仍为 false，须用户最终验收。 */
export const STATUS = 'ACCEPTANCE_READY'

/* ── 字体栈：必须逐字保留 Uter 当前真实配置（theme.css:301-328） ─────────────── */

export const FONT_UI =
  "'Inter Variable', 'Inter', 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'Noto Sans SC Variable', 'Noto Sans SC', 'Noto Sans CJK SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'"
export const FONT_BODY = 'var(--ds-font-ui)'
export const FONT_MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace, 'Source Han Sans SC', 'Source Han Sans CN', '思源黑体', 'Noto Sans SC Variable', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif"

/* ── 颜色令牌定义表 ───────────────────────────────────────────────────────────
 * 每项：[短名, light, dark, 说明]；dark === null 表示主题无关（Light/Dark 同值）。
 * prefix 决定最终 token 名：--ds-color-<prefix>-<短名>
 * --------------------------------------------------------------------------- */

const COLOR_GROUPS = [
  {
    layer: 'primitive', prefix: 'brand', description: '品牌原色板（PART 03 初始基线，经对比度验证冻结）',
    items: [
      ['1', '#5B5EE6', '#8B8DF5', '品牌主色 / Dark 浅化档'],
      ['2', '#494CC7', '#A1A3F7', '品牌深一档 / Dark 浅化档'],
      ['3', '#3F42B0', '#B7B8FA', '品牌深二档 / Dark 浅化档'],
      ['solid', '#5B5EE6', null, '品牌实底（Light/Dark 同值，白字实测 5.01:1；Dark 不得使用浅化档做按钮底）'],
      ['solid-hover', '#494CC7', null, '品牌实底 Hover（白字 6.68:1）'],
      ['solid-active', '#3F42B0', null, '品牌实底 Active（白字 8.02:1）'],
    ],
  },
  {
    layer: 'primitive', prefix: 'neutral', description: '中性原色板 50–900（Primitive 不随主题变化，映射由 Semantic 层负责）',
    items: [
      ['50', '#F8FAFC', null, '最浅背景'], ['100', '#F1F5F9', null, '次级背景'],
      ['200', '#E2E8F0', null, '边框 / 分隔'], ['300', '#CBD5E1', null, '强边框'],
      ['400', '#94A3B8', null, '占位 / 禁用'], ['500', '#64748B', null, '次级文本'],
      ['600', '#475569', null, '操作符 / 标点'], ['700', '#334155', null, '深色表面'],
      ['800', '#1E293B', null, '更深表面'], ['900', '#0F172A', null, '最深文本'],
    ],
  },
  {
    layer: 'semantic', prefix: 'surface', description: 'Surface Colors —— 背景与表面（Light / Dark 完整映射）',
    items: [
      ['canvas', '#F8FAFC', '#0B1120', '页面画布'],
      ['base', '#FFFFFF', '#111827', '卡片 / 面板基础表面'],
      ['raised', '#FFFFFF', '#1B2436', '浮起表面（弹层 / 下拉）'],
      ['sunken', '#F1F5F9', '#080D18', '下沉表面（代码块 / 井）'],
      ['code', '#F6F8FA', '#0E1524', '代码编辑器背景（对比度实测基准）'],
      ['terminal', '#F1F5F9', '#0A101E', '终端预览背景（Light / Dark 独立，禁止共用纯黑）'],
      ['overlay', '#FFFFFF', '#1B2436', '浮层容器背景'],
      ['pure', '#FFFFFF', null, '纯白表面（二维码底 / 滑块手柄，深浅主题恒白）', '必须在深浅主题都保持纯白的表面', 'web/src/styles/theme.css'],
      ['scrim', '#000000', null, '模态遮罩（深浅主题恒黑，浓淡由透明度修饰表达）', '把下层内容压暗的遮罩层（CM-02 闭合：与 surface-overlay 浮层容器语义分离）', 'web/src/styles/theme.css'],
    ],
  },
  {
    layer: 'semantic', prefix: 'text', description: 'Text Colors —— 全部在 canvas / surface 两种背景上实测 ≥4.5:1',
    items: [
      ['primary', '#0F172A', '#F1F5F9', '主文本'],
      ['secondary', '#475569', '#CBD5E1', '次级文本（与 muted / tertiary 明确区分）'],
      ['tertiary', '#64748B', '#94A3B8', '辅助文本（独立 HEX，不再由 color-mix 派生）'],
      ['muted', '#5B6779', '#A1B0C3', '弱化文本（与 secondary / tertiary 明确区分）'],
      ['disabled', '#94A3B8', '#64748B', '禁用文本（WCAG 1.4.3 禁用控件例外，已登记）'],
      ['link', '#1D4ED8', '#93C5FD', '链接'],
      ['on-brand', '#FFFFFF', '#FFFFFF', '品牌实底按钮前景（实测 5.01:1）'],
      ['on-dark', '#F8FAFC', '#F8FAFC', '深色实底上的前景'],
      ['inverse', '#FFFFFF', '#0F172A', '反色文本'],
      ['on-emphasis', '#FFFFFF', null, '饱和填充（品牌 / 状态色块）上的文字，恒白', '替代散落的 text-white（C-03 禁止手写白字）', 'web/src/styles/theme.css'],
      ['danger', '#B91C1C', null, '危险文字（与 status-danger-solid 同源）', '语义化的危险前景色', 'web/src/design-system/foundations/typography.css'],
      ['success', '#15803D', '#6EE7B7', '成功文字（与 status-success 同源）', '语义化的成功前景色', 'web/src/design-system/foundations/typography.css'],
    ],
  },
  {
    layer: 'semantic', prefix: 'border', description: 'Border Colors —— 颜色（宽度由 --ds-border-width-* 控制）',
    items: [
      ['default', '#E2E8F0', '#263349', '默认边框'],
      ['strong', '#CBD5E1', '#3B4A63', '强边框'],
      ['focus', '#5B5EE6', '#8B8DF5', '聚焦边框 / 焦点环'],
      ['divider', '#E2E8F0', '#1F2A3D', '分隔线'],
      ['input', '#CBD5E1', '#3B4A63', '输入框边框'],
      ['card', '#E2E8F0', '#263349', '卡片边框'],
      ['table', '#E2E8F0', '#263349', '表格边框'],
      ['code', '#E2E8F0', '#263349', '代码块边框'],
      ['dialog', '#E2E8F0', '#3B4A63', '对话框边框'],
      ['danger', '#B91C1C', '#FCA5A5', '错误态边框'],
    ],
  },
  {
    layer: 'semantic', prefix: 'status', description: 'Status Colors —— 业务状态色（含 soft 底 / border / on 前景）',
    items: [
      ['success', '#15803D', '#6EE7B7', '成功'], ['success-soft', '#DCFCE7', '#064E3B', '成功浅底'],
      ['success-border', '#86EFAC', '#065F46', '成功边框'], ['success-on', '#052E16', '#ECFDF5', '成功底上前景'],
      ['warning', '#A54600', '#FCD34D', '警告'], ['warning-soft', '#FEF3C7', '#451A03', '警告浅底'],
      ['warning-border', '#FCD34D', '#78350F', '警告边框'], ['warning-on', '#451A03', '#FFFBEB', '警告底上前景'],
      ['danger', '#B91C1C', '#FCA5A5', '危险'], ['danger-solid', '#B91C1C', null, '危险实底（Light/Dark 同值，白字 ≥4.5:1）'], ['danger-soft', '#FEE2E2', '#450A0A', '危险浅底'],
      ['danger-border', '#FCA5A5', '#7F1D1D', '危险边框'], ['danger-on', '#450A0A', '#FEF2F2', '危险底上前景'],
      ['info', '#1D4ED8', '#93C5FD', '信息'], ['info-soft', '#DBEAFE', '#172554', '信息浅底'],
      ['info-border', '#93C5FD', '#1E40AF', '信息边框'], ['info-on', '#172554', '#EFF6FF', '信息底上前景'],
    ],
  },
  {
    layer: 'semantic', prefix: 'chart', description: 'Chart Colors 1–5（6–12 见 color-architecture.mjs）—— 12 色体系，任意两色在正常视觉 + 三类色觉缺陷模拟下 CIEDE2000 >= 10',
    items: [
      // 2026-11-15 色板搜索 v5 定稿（/tmp/uds8-palette-v5.json，seed 987654321）：
      // Light minAll 10.50 / minNormal 13.14 / canvas >= 3.2:1 / chroma >= 43；
      // Dark minAll 10.51 / minNormal 15.09 / canvas >= 3.68:1 / chroma >= 31。
      // 系列顺序按常用优先（蓝/紫/青/红/绿…），与产品色无同值碰撞（C-R08）。
      ['1', '#0088FF', '#11A0FF', '系列 1 蓝', '第 1 数据系列', 'web/src/design-system/tokens/brand-colors.ts'],
      ['2', '#7F13F8', '#7965E6', '系列 2 紫', '第 2 数据系列', 'web/src/design-system/tokens/brand-colors.ts'],
      ['3', '#009F80', '#00A37B', '系列 3 青', '第 3 数据系列', 'web/src/design-system/tokens/brand-colors.ts'],
      ['4', '#EA315B', '#FF4178', '系列 4 红', '第 4 数据系列', 'web/src/design-system/tokens/brand-colors.ts'],
      ['5', '#29844A', '#32D15C', '系列 5 绿', '第 5 数据系列', 'web/src/design-system/tokens/brand-colors.ts'],
    ],
  },
  {
    layer: 'semantic', prefix: 'gradient', description: 'Gradient Colors —— ' + GRADIENT_SAMPLE_COUNT + ' 点采样 × 7 背景实测，全区间 ≥4.5:1，插值空间 ' + GRADIENT_INTERPOLATION,
    items: [
      ['light-from', '#1D4ED8', null, 'Light 起点 0%'],
      ['light-via', '#6D28D9', null, 'Light 中点 50%'],
      ['light-to', '#7E22CE', null, 'Light 终点 100%'],
      ['dark-from', '#93C5FD', null, 'Dark 起点 0%'],
      ['dark-via', '#C4B5FD', null, 'Dark 中点 50%'],
      ['dark-to', '#D8B4FE', null, 'Dark 终点 100%'],
    ],
  },
  {
    layer: 'semantic', prefix: 'overlay', description: 'Overlay Colors —— 遮罩与浮层',
    items: [
      ['scrim', 'rgba(15, 23, 42, 0.50)', 'rgba(2, 6, 16, 0.72)', '模态遮罩'],
      ['dropdown', '#FFFFFF', '#1B2436', '下拉表面'],
      ['tooltip', '#0F172A', '#E2E8F0', 'Tooltip 表面'],
      ['tooltip-fg', '#F8FAFC', '#0F172A', 'Tooltip 前景'],
    ],
  },
  {
    layer: 'semantic', prefix: 'focus', description: 'Focus Colors —— 非文本对比度 ≥3:1',
    items: [
      ['ring', '#5B5EE6', '#8B8DF5', '焦点环颜色'],
      ['ring-offset', '#FFFFFF', '#0B1120', '焦点环偏移底色'],
    ],
  },
  {
    layer: 'semantic', prefix: 'selection', description: 'Selection Colors —— 文本选区',
    items: [
      ['background', '#C7D2FE', '#3730A3', '选区背景'],
      ['foreground', '#0F172A', '#F8FAFC', '选区前景'],
    ],
  },
  {
    layer: 'semantic', prefix: 'code', description: 'Code Editor Colors —— 与 Syntax / Chart 严格分离',
    items: [
      ['background', '#F6F8FA', '#0E1524', '编辑器背景'],
      ['foreground', '#0F172A', '#E2E8F0', '编辑器默认前景'],
      ['gutter', '#5B6779', '#94A3B8', '行号（真实代码背景实测 ≥4.5:1，axe color-contrast 通过）'],
      ['gutter-background', '#F1F5F9', '#0A101E', '行号槽背景'],
      ['current-line', '#EAF0FF', '#16203A', '当前行高亮'],
      ['selection', '#C7D2FE', '#33417A', '编辑器选区'],
      ['cursor', '#5B5EE6', '#A1A3F7', '光标'],
      ['fold', '#64748B', '#94A3B8', '折叠标记'],
      ['scrollbar', '#CBD5E1', '#3B4A63', '滚动条'],
      ['language-badge', '#E2E8F0', '#263349', '语言标签底'],
      ['line-added', '#DCFCE7', '#064E3B', '新增行底'],
      ['line-deleted', '#FEE2E2', '#450A0A', '删除行底'],
      ['line-error', '#FEE2E2', '#450A0A', '错误行底'],
    ],
  },
  {
    layer: 'semantic', prefix: 'terminal', description: 'Terminal Colors —— 终端预览专用，不与 Syntax 互引',
    items: [
      // consumer 登记真实引用链：theme.css 别名层 → 产品组件；Showcase 终端区
      // 按 pane 作用域注入 --ds8-color-terminal-* 并以 var() 真实消费全部 32 色。
      ['background', '#F1F5F9', '#0A101E', '终端背景（Light / Dark 独立）', '终端 / 任务产物预览背景', 'web/src/styles/theme.css; web/src/features/usage-logs/components/task-artifacts.tsx; docs/design-system/registry/showcase-extensions.mjs'],
      ['foreground', '#0F172A', '#E2E8F0', '终端前景', '终端正文文字', 'docs/design-system/registry/showcase-extensions.mjs'],
      ['prompt', '#047857', '#34D399', '提示符', 'shell 提示符', 'docs/design-system/registry/showcase-extensions.mjs'],
      ['command', '#0F766E', '#6EE7B7', '命令', '命令动词', 'web/src/styles/theme.css; web/src/features/home/components/hero-terminal-demo.tsx; docs/design-system/registry/showcase-extensions.mjs'],
      ['flag', '#1D4ED8', '#93C5FD', '参数', '命令开关 / 参数', 'web/src/styles/theme.css; web/src/features/home/components/hero-terminal-demo.tsx; docs/design-system/registry/showcase-extensions.mjs'],
      ['property', '#0369A1', '#7DD3FC', '属性', '键名 / 路径', 'web/src/styles/theme.css; web/src/features/home/components/hero-terminal-demo.tsx; docs/design-system/registry/showcase-extensions.mjs'],
      ['string', '#B45309', '#FCD34D', '字符串', '字符串字面量', 'web/src/styles/theme.css; web/src/features/home/components/hero-terminal-demo.tsx; docs/design-system/registry/showcase-extensions.mjs'],
      ['number', '#6D28D9', '#C4B5FD', '数字', '数字字面量', 'web/src/styles/theme.css; web/src/features/home/components/hero-terminal-demo.tsx; docs/design-system/registry/showcase-extensions.mjs'],
      // online / dot 的 theme.css 别名仍指向 3.0 遗留 --term-online / --term-dot
      // （COMPAT-MAP 待迁移），当前真实消费者只有 Showcase 终端区。
      ['online', '#047857', '#34D399', '在线指示', '在线状态点', 'docs/design-system/registry/showcase-extensions.mjs'],
      ['dot', 'rgba(15, 23, 42, 0.15)', 'rgba(226, 232, 240, 0.15)', '窗口点', '窗口控制点 / 分隔点', 'docs/design-system/registry/showcase-extensions.mjs'],
    ],
  },
]

/* ── 非颜色令牌 ───────────────────────────────────────────────────────────────
 * 每项：[token 名, 值, 单位, 说明]
 * --------------------------------------------------------------------------- */

const SCALAR_GROUPS = [
  {
    layer: 'primitive', category: 'font-family', type: 'font', unit: 'stack',
    description: 'Uter 当前字体体系，逐字保留；禁止替换为 Geist / Roboto / Arial-only',
    items: [
      ['--ds-font-ui', FONT_UI, 'stack', 'UI 字体栈（中英文 + Emoji 回退）'],
      ['--ds-font-body', FONT_BODY, 'stack', '正文字体 = UI 字体别名'],
      ['--ds-font-mono', FONT_MONO, 'stack', '等宽字体栈（CJK 回退置于 monospace 之后，保持拉丁等宽）'],
    ],
  },
  {
    layer: 'primitive', category: 'font-size', type: 'size', unit: 'px',
    description: '完整字号阶梯（PART 04 §4.2）',
    items: [
      ['--ds-text-2xs', 12, 'px', '最小可见文字（全站下限）'],
      ['--ds-text-xs', 13, 'px', '密集表格 / 代码 / 标签'],
      ['--ds-text-sm', 14, 'px', '正文默认'],
      ['--ds-text-base', 16, 'px', '长文本默认 / 指标数值 / H5 输入'],
      ['--ds-text-lg', 18, 'px', 'h3 / 卡片标题'],
      ['--ds-text-xl', 20, 'px', '次级标题'],
      ['--ds-text-2xl', 24, 'px', '区块标题'],
      ['--ds-text-3xl', 30, 'px', '分区标题'],
      ['--ds-text-4xl', 36, 'px', '页面主标题'],
      ['--ds-text-5xl', 48, 'px', 'Hero / 展示大标题'],
    ],
  },
  {
    layer: 'primitive', category: 'line-height', type: 'size', unit: 'px',
    description: '独立行高 Token，组件不得写死',
    items: [
      ['--ds-leading-caption', 18, 'px', '12px 文字'],
      ['--ds-leading-code', 20, 'px', '13px 代码 / 20px 控件'],
      ['--ds-leading-body', 22, 'px', '14px 正文'],
      ['--ds-leading-base', 24, 'px', '16px 长文本 / 控件'],
      ['--ds-leading-long', 26, 'px', '16–18px 长文本 / h3'],
      ['--ds-leading-h3', 26, 'px', '18px h3'],
      ['--ds-leading-h2', 38, 'px', '30px 分区标题'],
      ['--ds-leading-h1', 44, 'px', '36px 页面标题'],
      ['--ds-leading-display', 56, 'px', '48px 展示标题'],
      ['--ds-leading-table', 20, 'px', '表格单元格'],
      ['--ds-leading-button', 20, 'px', '按钮文字'],
    ],
  },
  {
    layer: 'primitive', category: 'font-weight', type: 'weight', unit: 'number',
    description: '字重四档',
    items: [
      ['--ds-weight-regular', 400, 'number', '正文'],
      ['--ds-weight-medium', 500, 'number', '标签 / 按钮'],
      ['--ds-weight-semibold', 600, 'number', '标题'],
      ['--ds-weight-bold', 700, 'number', '强强调'],
    ],
  },
  {
    layer: 'primitive', category: 'font-variant', type: 'keyword', unit: 'keyword',
    description: '数字呈现',
    items: [
      ['--ds-numeric-tabular', 'tabular-nums', 'keyword', '金额 / 余额 / Token 数 / 价格 / 用量 / 订单号 / 指标'],
    ],
  },
  {
    layer: 'primitive', category: 'spacing', type: 'size', unit: 'px',
    description: '4px 基础网格',
    items: [
      ['--ds-space-0', 0, 'px', '无间距'], ['--ds-space-1', 4, 'px', '4'],
      ['--ds-space-2', 8, 'px', '8'], ['--ds-space-3', 12, 'px', '12'],
      ['--ds-space-4', 16, 'px', '16'], ['--ds-space-5', 20, 'px', '20'],
      ['--ds-space-6', 24, 'px', '24'], ['--ds-space-8', 32, 'px', '32'],
      ['--ds-space-10', 40, 'px', '40'], ['--ds-space-12', 48, 'px', '48'],
      ['--ds-space-16', 64, 'px', '64'], ['--ds-space-20', 80, 'px', '80'],
      ['--ds-space-24', 96, 'px', '96'],
    ],
  },
  {
    layer: 'primitive', category: 'radius', type: 'size', unit: 'px',
    description: '圆角八档',
    items: [
      ['--ds-radius-none', 0, 'px', '无圆角'], ['--ds-radius-sm', 3, 'px', '小控件'],
      ['--ds-radius-md', 5, 'px', '默认'], ['--ds-radius-lg', 8, 'px', '卡片'],
      ['--ds-radius-xl', 12, 'px', '弹层'], ['--ds-radius-2xl', 16, 'px', '大卡片'],
      ['--ds-radius-3xl', 20, 'px', '大型容器'], ['--ds-radius-full', 9999, 'px', '圆形 / 胶囊'],
    ],
  },
  {
    layer: 'primitive', category: 'border-width', type: 'size', unit: 'px',
    description: '边框宽度',
    items: [
      ['--ds-border-width-default', 1, 'px', '默认边框'],
      ['--ds-border-width-strong', 1, 'px', '强边框（颜色更重）'],
      ['--ds-border-width-focus', 2, 'px', '聚焦边框 / 焦点环'],
      ['--ds-border-width-divider', 1, 'px', '分隔线'],
      ['--ds-border-width-input', 1, 'px', '输入框'],
      ['--ds-border-width-card', 1, 'px', '卡片'],
      ['--ds-border-width-table', 1, 'px', '表格'],
      ['--ds-border-width-code', 1, 'px', '代码块'],
      ['--ds-border-width-dialog', 1, 'px', '对话框'],
    ],
  },
  {
    layer: 'primitive', category: 'elevation', type: 'shadow', unit: 'css',
    description: '阴影九档（普通卡片优先用背景 + 边框，不依赖大量阴影）',
    items: [
      ['--ds-elevation-0', 'none', 'css', '无阴影'],
      ['--ds-elevation-1', '0 1px 2px rgba(15, 23, 42, 0.06)', 'css', '轻微抬升'],
      ['--ds-elevation-2', '0 2px 8px rgba(15, 23, 42, 0.10)', 'css', '卡片'],
      ['--ds-elevation-3', '0 8px 24px rgba(15, 23, 42, 0.12)', 'css', '下拉 / Popover'],
      ['--ds-elevation-4', '0 16px 48px rgba(15, 23, 42, 0.16)', 'css', '模态'],
      ['--ds-elevation-overlay', '0 12px 32px rgba(2, 6, 16, 0.28)', 'css', '通用浮层'],
      ['--ds-elevation-dropdown', '0 8px 24px rgba(15, 23, 42, 0.14)', 'css', '下拉菜单'],
      ['--ds-elevation-dialog', '0 24px 64px rgba(2, 6, 16, 0.32)', 'css', '对话框'],
      ['--ds-elevation-drawer', '-8px 0 32px rgba(2, 6, 16, 0.24)', 'css', '抽屉'],
    ],
  },
  {
    layer: 'primitive', category: 'motion-duration', type: 'time', unit: 'ms',
    description: '动效时间六档',
    items: [
      ['--ds-motion-instant', 0, 'ms', '立即'],
      ['--ds-motion-fast', 100, 'ms', 'Hover / Focus'],
      ['--ds-motion-normal', 150, 'ms', 'Active / 微交互'],
      ['--ds-motion-moderate', 200, 'ms', 'Dropdown / Tooltip'],
      ['--ds-motion-slow', 250, 'ms', 'Dialog / Drawer'],
      ['--ds-motion-slower', 300, 'ms', 'Page Transition'],
    ],
  },
  {
    layer: 'primitive', category: 'motion-easing', type: 'keyword', unit: 'css',
    description: '缓动函数',
    items: [
      ['--ds-easing-standard', 'cubic-bezier(0.2, 0, 0, 1)', 'css', '标准'],
      ['--ds-easing-enter', 'cubic-bezier(0, 0, 0.2, 1)', 'css', '进入'],
      ['--ds-easing-exit', 'cubic-bezier(0.4, 0, 1, 1)', 'css', '退出'],
      ['--ds-easing-linear', 'linear', 'css', '加载 / 进度'],
    ],
  },
  {
    layer: 'primitive', category: 'breakpoint', type: 'size', unit: 'px',
    description: '响应式断点七档',
    items: [
      ['--ds-bp-xs', 360, 'px', 'Compact Mobile'],
      ['--ds-bp-sm', 480, 'px', 'Mobile'],
      ['--ds-bp-md', 768, 'px', 'Tablet（8 列）'],
      ['--ds-bp-lg', 1024, 'px', 'Small Desktop（12 列）'],
      ['--ds-bp-xl', 1280, 'px', 'Desktop'],
      ['--ds-bp-2xl', 1440, 'px', '内容最大宽度 / Large Screen 起点'],
      ['--ds-bp-wide', 1920, 'px', 'Wide Screen'],
    ],
  },
  {
    layer: 'primitive', category: 'layout', type: 'size', unit: 'px',
    description: '布局与网格',
    items: [
      ['--ds-layout-max-width', 1440, 'px', '桌面内容最大宽度'],
      ['--ds-layout-columns-desktop', 12, 'count', '桌面 12 列'],
      ['--ds-layout-columns-tablet', 8, 'count', '平板 8 列'],
      ['--ds-layout-columns-mobile', 4, 'count', '移动 4 列'],
      ['--ds-layout-gutter-desktop', 24, 'px', '桌面栅格间距'],
      ['--ds-layout-gutter-tablet', 16, 'px', '平板栅格间距'],
      ['--ds-layout-gutter-mobile', 12, 'px', '移动栅格间距'],
      ['--ds-layout-header-height', 64, 'px', 'Header 高度'],
      ['--ds-layout-sidebar-width', 240, 'px', 'Sidebar 展开宽度'],
      ['--ds-layout-sidebar-collapsed', 64, 'px', 'Sidebar 收起宽度'],
      ['--ds-layout-modal-width', 560, 'px', 'Modal 默认宽度'],
      ['--ds-layout-drawer-width', 400, 'px', 'Drawer 默认宽度'],
    ],
  },
  {
    layer: 'component', category: 'control-size', type: 'size', unit: 'px',
    description: '控件尺寸（PART 18/19/20）',
    items: [
      ['--ds-control-sm', 32, 'px', 'Small 按钮 / 输入'],
      ['--ds-control-md', 36, 'px', 'Medium 按钮 / 输入'],
      ['--ds-control-lg', 40, 'px', 'Large 按钮 / 输入'],
      ['--ds-control-touch', 44, 'px', 'Touch 最小触控目标 / H5'],
      ['--ds-control-h5-input-font-size', 16, 'px', 'H5 输入字号（iOS 防自动放大）'],
      ['--ds-icon-2xs', 12, 'px', '图标 12'], ['--ds-icon-xs', 16, 'px', '图标 16（默认）'],
      ['--ds-icon-sm', 20, 'px', '图标 20'], ['--ds-icon-md', 24, 'px', '图标 24'],
      ['--ds-icon-lg', 32, 'px', '图标 32'],
      ['--ds-icon-stroke', 2, 'px', '默认 stroke-width'],
      ['--ds-icon-stroke-small', 1.75, 'px', '≤16px 图标 stroke-width'],
    ],
  },
  {
    layer: 'component', category: 'density', type: 'size', unit: 'px',
    description: '信息密度三档（密度调整不得破坏 12px 最小字号）',
    items: [
      ['--ds-density-compact-row', 36, 'px', 'Compact 表格行高'],
      ['--ds-density-default-row', 44, 'px', 'Default 表格行高'],
      ['--ds-density-comfortable-row', 52, 'px', 'Comfortable 表格行高'],
      ['--ds-density-compact-cell-y', 6, 'px', 'Compact 单元格纵向内边距'],
      ['--ds-density-default-cell-y', 10, 'px', 'Default 单元格纵向内边距'],
      ['--ds-density-comfortable-cell-y', 14, 'px', 'Comfortable 单元格纵向内边距'],
    ],
  },
  {
    layer: 'component', category: 'focus', type: 'size', unit: 'px',
    description: '焦点环',
    items: [
      ['--ds-focus-ring-width', 2, 'px', '焦点环宽度'],
      ['--ds-focus-ring-offset', 2, 'px', '焦点环偏移'],
    ],
  },
  {
    layer: 'component', category: 'z-index', type: 'number', unit: 'number',
    description: '浮层层级',
    items: [
      ['--ds-z-base', 0, 'number', '基础'], ['--ds-z-sticky', 1100, 'number', 'Sticky'],
      ['--ds-z-dropdown', 1200, 'number', 'Dropdown'], ['--ds-z-overlay', 1300, 'number', 'Overlay'],
      ['--ds-z-modal', 1400, 'number', 'Modal / Drawer'], ['--ds-z-popover', 1500, 'number', 'Popover'],
      ['--ds-z-toast', 1600, 'number', 'Toast'], ['--ds-z-tooltip', 1700, 'number', 'Tooltip'],
    ],
  },
  {
    layer: 'component', category: 'radius-application', type: 'keyword', unit: 'token-ref',
    description: '组件圆角绑定（每个组件明确使用哪个圆角档）',
    items: [
      ['--ds-radius-button', 'var(--ds-radius-md)', 'token-ref', 'Button = 5px'],
      ['--ds-radius-input', 'var(--ds-radius-md)', 'token-ref', 'Input = 5px'],
      ['--ds-radius-card', 'var(--ds-radius-lg)', 'token-ref', 'Card = 8px'],
      ['--ds-radius-dialog', 'var(--ds-radius-xl)', 'token-ref', 'Dialog = 12px'],
      ['--ds-radius-badge', 'var(--ds-radius-full)', 'token-ref', 'Badge = 9999px'],
      ['--ds-radius-code', 'var(--ds-radius-lg)', 'token-ref', 'Code Block = 8px'],
      ['--ds-radius-table', 'var(--ds-radius-lg)', 'token-ref', 'Table = 8px'],
    ],
  },
]

/* ── 语法 Token：取自对比度引擎的冻结结果，禁止另写色值 ────────────────────── */

export function buildManifest() {
  const v = runVerification()
  if (v.verdict !== 'PASS') throw new Error(`对比度引擎未通过，禁止冻结 7.0 数值: ${v.verdict}`)

  const tokens = {}
  const add = (name, layer, category, type, unit, light, dark, description, themeIndependent = false, meta = {}) => {
    if (tokens[name]) throw new Error(`Token 重复定义: ${name}`)
    tokens[name] = {
      layer, category, type, unit, light, dark, description, themeIndependent,
      // 运行时隔离名：3.0 已有同名 --ds-* 且取值冲突（见 LIGHT-DARK-CONSISTENCY-AUDIT）。
      // 所有真实组件只消费 --ds8-*，由 build.mjs 从本字段派生 bridge CSS。
      runtimeName: '--ds8-' + name.slice(5),
      semanticMeaning: meta.semanticMeaning ?? description,
      consumer: meta.consumer ?? null,
      consumerNote: meta.consumerNote ?? null,
      contrastRequirement: meta.contrastRequirement ?? null,
      deprecated: meta.deprecated ?? false,
      colorLayer: meta.colorLayer ?? null,
      runtimeBridge: meta.runtimeBridge ?? (type === 'color'),
      vscodeSource: meta.vscodeSource ?? null,
    }
  }

  const ALL_COLOR_GROUPS = [
    ...COLOR_GROUPS.map((g) => ({
      ...g,
      colorLayer: g.layer === 'primitive' ? 'primitive' : 'semantic',
      contrastRequirement: '>= 4.5:1 on canvas / surface / raised / sunken / overlay / code-bg',
    })),
    ...EXTRA_COLOR_GROUPS,
  ]

  for (const g of ALL_COLOR_GROUPS) {
    for (const item of g.items) {
      const [short, light, dark, description, semantic, consumer] = item
      add(`--ds-color-${g.prefix}-${short}`, g.layer, g.prefix, 'color', 'color', light, dark ?? light, description, dark === null, {
        semanticMeaning: semantic ?? description,
        consumer: consumer ?? null,
        consumerNote: g.consumerNote ?? null,
        contrastRequirement: g.contrastRequirement ?? null,
        colorLayer: g.colorLayer,
        runtimeBridge: true,
      })
    }
  }

  // 20 个 Syntax Token —— 唯一来源是 VS Code 官方 Light+ / Dark+ 主题源码，
  // 经有限 WCAG 调整后的 adopted 值；禁止另写一套色值。
  for (const r of VSCODE_SYNTAX.rows) {
    add(`--ds-syntax-${r.key}`, 'semantic', 'syntax', 'color', 'color', r.adopted.light, r.adopted.dark,
      `语法高亮 ${r.key}（官方 ${r.officialLight} / ${r.officialDark}）`, false, {
        semanticMeaning: 'VS Code TextMate scope: ' + r.scope,
        consumer: 'web/src/components/ai-elements/code-block.tsx; web/src/styles/index.css (yace); web/src/features/task-plugins/components/javascript-viewer.tsx',
        contrastRequirement: '>= 4.5:1 on code-bg Light / Dark',
        colorLayer: 'semantic',
        vscodeSource: {
          scope: r.scope, officialLight: r.officialLight, officialDark: r.officialDark,
          adoptedLight: r.adopted.light, adoptedDark: r.adopted.dark, adjustment: r.adjustment,
        },
      })
  }

  // 渐变方向 / 插值空间 / 单一出口
  add('--ds-gradient-direction', 'semantic', 'gradient', 'keyword', 'css', '90deg', '90deg', 'linear-gradient(90deg in srgb, from 0%, via 50%, to 100%)', true, { runtimeBridge: true, colorLayer: 'semantic' })
  add('--ds-gradient-interpolation', 'semantic', 'gradient', 'keyword', 'css', GRADIENT_INTERPOLATION, GRADIENT_INTERPOLATION, 'CSS 渐变插值颜色空间；必须与 contrast-engine.mjs 一致', true, { runtimeBridge: true, colorLayer: 'semantic' })
  add('--ds-gradient-utility', 'semantic', 'gradient', 'keyword', 'identifier', 'ds-text-gradient-brand', 'ds-text-gradient-brand', '全站唯一渐变出口', true, { runtimeBridge: false })

  // 标量 Token（字号 / 间距 / 圆角 / 动效等）不注入 web/src 运行时：
  // 现行 3.0 已有一套权威刻度，注入会形成第二套并改变页面字号。差异登记在 COMPAT-MAP。
  for (const g of SCALAR_GROUPS) {
    for (const [name, value, unit, description] of g.items) {
      add(name, g.layer, g.category, g.type, unit, value, value, description, true, { runtimeBridge: false, consumer: null })
    }
  }

  // 消费者权威登记（证据驱动，来源与规则见 consumers.mjs 头部）：覆盖组内
  // 联 consumer，由 registry/consumer-scan.mjs 做双向真实性断言。
  for (const [name, reg] of Object.entries(CONSUMERS)) {
    if (!tokens[name]) throw new Error(`consumers.mjs 登记了未知 Token: ${name}`)
    tokens[name].consumer = reg.consumer
    tokens[name].consumerNote = reg.note ?? tokens[name].consumerNote
  }

  return {
    schema_version: '1.0',
    manifest_id: 'UDS8-TOKEN-MANIFEST',
    design_system: 'UTER DESIGN SYSTEM 8.0.0',
    version: VERSION,
    status: STATUS,
    single_source_of_truth: 'docs/design-system/TOKEN-MANIFEST.json',
    authoritative_note:
      '本 JSON 是 CSS / TypeScript / Showcase / 规范文档 / 自动化检查的唯一数值来源；任何产物不得另写一份数值。',
    units: {
      font: 'px', lineHeight: 'px', spacing: 'px', radius: 'px', border: 'px',
      icon: 'px', control: 'px', breakpoint: 'px', motion: 'ms',
      shadow: 'px + rgba', color: 'HEX / OKLCH', baseSpacing: 4,
    },
    architecture: {
      layers: ['Primitive Tokens', 'Semantic Tokens', 'Component Tokens', 'Component Specifications', 'Page Templates'],
      flow: 'Primitive → Semantic → Component → UI Component → Product Page',
      rule: '业务页面不得直接引用未经登记的 Primitive 色值',
      // §4.1 五层颜色架构：每个颜色 Token 的 colorLayer 都可被检查器验证。
      colorLayers: COLOR_LAYERS,
      colorLayerFlow: 'L1 Primitive → L2 Semantic → L3 Component → L4 Interaction → L5 Product Context',
      componentSpecs: COMPONENT_SPECS,
      productContexts: PRODUCT_CONTEXTS,
      pageTemplates: ['Dashboard', 'Models', 'API Keys', 'Wallet / Recharge', 'Orders', 'Usage Logs', 'Settings', 'Docs', 'Auth', 'Pricing'],
    },
    naming: { prefix: '--ds-', rule: '语义 Token 必须可读、可追踪；同名 Token 只允许定义一次' },
    themes: {
      light: { selector: ':root, [data-ds-theme="light"]', background: '#F8FAFC' },
      dark: { selector: '[data-ds-theme="dark"]', background: '#0B1120' },
    },
    contrast: {
      thresholds: { normalText: 4.5, largeText: 3.0, nonText: 3.0 },
      engine: 'registry/contrast-engine.mjs',
      sampling: '1001 points (0..100 step 0.1) + all stops, on 7 real text backgrounds per theme',
      sampleCount: GRADIENT_SAMPLE_COUNT,
      gradientInterpolation: GRADIENT_INTERPOLATION,
      cssInterpolation: 'linear-gradient(90deg in srgb, ...)',
      backgroundMatrix: v.backgrounds,
      verdict: v.verdict,
      gradient: {
        light: { minRatio: v.gradient.light.minRatio, passes45: v.gradient.light.passesNormalText45 },
        dark: { minRatio: v.gradient.dark.minRatio, passes45: v.gradient.dark.passesNormalText45 },
      },
      legacyGradient: {
        light: v.gradient.light.legacyWorst.ratio, dark: v.gradient.dark.legacyWorst.ratio,
        note: '历史渐变不达 4.5:1，E28 例外在 7.0 注销',
      },
      syntax: { lightMin: v.syntax.light.minRatio, darkMin: v.syntax.dark.minRatio },
      brandSolid: { lightMin: v.brandSolid.light.minRatio, darkMin: v.brandSolid.dark.minRatio },
    },
    states: {
      base: ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'],
      extended: ['selected', 'read-only', 'editable', 'collapsed', 'expanded', 'copy-success', 'copy-failure'],
    },
    syntaxLanguages: [
      'JavaScript', 'TypeScript', 'JSX', 'TSX', 'JSON', 'JSONC', 'HTML', 'CSS', 'SCSS',
      'Bash', 'Shell', 'cURL', 'Python', 'Go', 'Java', 'Rust', 'SQL', 'YAML', 'TOML',
      'Markdown', 'MDX', 'XML', 'GraphQL', 'Dockerfile', 'Diff', 'Plain Text',
    ],
    highlighterEngines: [
      { name: 'CodeMirror 6', version: '^6.x', adapter: 'HighlightStyle + syntaxHighlighting', renderer: 'code-block.tsx' },
      { name: 'Lezer', version: '@lezer/highlight ^1.2.3', adapter: 'tags → --ds-syntax-*', renderer: 'code-block.tsx' },
      { name: 'Yace', version: '^1.1.0', adapter: 'token class → --ds-syntax-*', renderer: 'json-code-editor.tsx' },
      { name: 'Marked', version: '^18.0.5', adapter: 'code fence → shared renderer', renderer: 'components/ui/markdown.tsx' },
      { name: 'Shiki', version: '^4.3.0', adapter: 'language type only; colors must map to --ds-syntax-*', renderer: 'code-block.tsx' },
    ],
    // §5.1 VS Code 官方主题对照：20 个语法 Token 的权威来源与差异登记。
    vscodeTheme: {
      source: VSCODE_SYNTAX.source,
      files: VSCODE_SYNTAX.files,
      includeChain: VSCODE_SYNTAX.includeChain,
      editor: VSCODE_SYNTAX.editor,
      uterCodeBackground: VSCODE_SYNTAX.uterCodeBackground,
      wcagTarget: VSCODE_SYNTAX.wcagTarget,
      mapping: VSCODE_SYNTAX.rows,
      baselineDifferenceCount: VSCODE_SYNTAX.rows.reduce((a, r) => a + (r.baselineDiffers.light ? 1 : 0) + (r.baselineDiffers.dark ? 1 : 0), 0),
      adjustedCount: VSCODE_SYNTAX.rows.filter((r) => r.adjustment.light.adjusted || r.adjustment.dark.adjusted).length,
      evidence: 'audit/vscode/SOURCE-METADATA.json',
    },
    // §4.5 / §八 图表不得只靠颜色区分数据。
    chartPolicy: {
      seriesCount: 12,
      nonColorChannels: CHART_NON_COLOR_CHANNELS,
      rule: 'series > 6 时必须直接标注；线型 / 点型 / 图例三通道必须可用',
    },
    // §2.3 / §十二 运行时接入边界：bridge 只注入颜色语义层，不覆盖 3.0 同名变量。
    // 标量（字号/行高/圆角/间距）已于 2026-11-16 经用户授权在 web/src 真源文件
    // 字面切换为 7.0 值（tokens.test.ts 三方守卫钉死），不经 bridge 注入。
    runtimeBridge: {
      canonicalPrefix: '--ds-',
      runtimePrefix: '--ds8-',
      isolationReason: 'web/src/design-system/tokens/colors.css 已定义同名 --ds-* 且取值冲突（surface-overlay 语义反转）',
      injectedFile: 'web/src/design-system/tokens/uds-semantic-bridge.css',
      entryImport: 'web/src/styles/index.css',
      rollback: '删除 web/src/styles/index.css 中 uds-semantic-bridge.css 一行 import 即完整回滚',
      excludeScalarTokens: true,
      scalarAlignment: 'web/src 真源字面值 = TOKEN-MANIFEST 值（2026-11-16 经用户授权切换，tokens.test.ts 钉死）',
    },
    fontPolicy: {
      uiStackVerifiedAgainst: 'web/src/styles/theme.css:301-306',
      monoStackVerifiedAgainst: 'web/src/styles/theme.css:324-328',
      rule: '保留 Uter 当前字体体系；不允许换成 Geist / Roboto / Arial-only / 其它新字体',
      cjkFallback: 'CJK 字体族置于 generic monospace 之后，保证拉丁数字仍等宽',
    },
    tokens,
    tokenCount: Object.keys(tokens).length,
  }
}
