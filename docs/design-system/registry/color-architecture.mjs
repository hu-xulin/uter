/**
 * UDS 8.0.0 — 五层颜色架构（§4.1）与真实消费者语义
 *
 * 五层：
 *   L1 Primitive Colors        → 基础色值，业务组件不得直接引用
 *   L2 Semantic Colors         → Brand/Text/Surface/Border/Status/Neutral/Focus/Selection/Overlay
 *   L3 Component Colors        → 22 类组件的 surface / foreground
 *   L4 Interaction Colors      → Default/Hover/Active/Focus/Selected/Disabled/Loading/Error
 *   L5 Product Context Colors  → 余额/充值/支付/退款/订单/API Key/Token/模型状态/API 调用/用量/计费/任务状态
 *
 * 所有值都是确定的 Light / Dark 实色；禁止 TBD。
 * consumer 字段是「登记的预期消费者」，真实性由 registry/consumer-scan.mjs 扫描后
 * 写入 TOKEN-REGISTRY.json 的 actualConsumers，检查器做双向断言。
 *
 * 统一命名：canonical name 与运行时名同为 --ds-*（历史过渡前缀已删除）；
 * build.mjs 派生的 runtimeName 为 --ds-*，避免覆盖 3.0 运行时同名不同值变量。
 */

/** 每项：[短名, light, dark, 说明, 语义, 登记消费者] */
const I = (short, light, dark, description, semantic, consumer) => [short, light, dark, description, semantic, consumer]

export const EXTRA_COLOR_GROUPS = [
  /* ── L2 Semantic：中性色层次（修正 secondary / muted / accent 同值） ────────── */
  {
    colorLayer: 'semantic', layer: 'semantic', prefix: 'neutral',
    description: 'Neutral 语义色阶 —— 主/次/辅/禁用文字与表面层次明确区分',
    contrastRequirement: 'normalText >= 4.5:1 on canvas + surface；disabled 按 WCAG 1.4.3 例外单独登记',
    items: [
      I('page', '#F8FAFC', '#0B1120', '页面画布', '最外层页面背景', 'web/src/styles/theme.css'),
      I('surface', '#FFFFFF', '#111827', '卡片基础面', '卡片 / 面板背景', 'web/src/styles/theme.css'),
      I('raised', '#FFFFFF', '#1B2436', '浮起面', '弹层 / 下拉 / Popover', 'web/src/styles/theme.css'),
      I('sunken', '#F1F5F9', '#080D18', '下沉面', '代码块 / 井 / 输入框内凹', 'web/src/styles/theme.css'),
      I('text-primary', '#0F172A', '#F1F5F9', '主文本', '正文与标题最高层级', 'web/src/styles/theme.css'),
      I('text-secondary', '#475569', '#CBD5E1', '次级文本', '描述 / 表头 / 卡片副标题', 'web/src/styles/theme.css'),
      I('text-tertiary', '#64748B', '#94A3B8', '辅助文本', '时间戳 / 脚注 / 计数', 'web/src/styles/theme.css'),
      I('text-muted', '#5B6779', '#A1B0C3', '弱化文本', '占位提示 / 非关键信息', 'web/src/styles/theme.css'),
      I('text-disabled', '#94A3B8', '#64748B', '禁用文本', '禁用控件（WCAG 1.4.3 例外）', 'web/src/styles/theme.css'),
      I('border-subtle', '#EEF2F7', '#1F2A3D', '弱边框', '分组分隔 / 表格内线', 'web/src/styles/theme.css'),
      I('border-default', '#E2E8F0', '#263349', '默认边框', '卡片 / 输入 / 表格', 'web/src/styles/theme.css'),
      I('border-strong', '#CBD5E1', '#3B4A63', '强边框', '强调区域 / 聚焦前态', 'web/src/styles/theme.css'),
    ],
  },

  /* ── L2 Semantic：4 状态 × 6 变体 ─────────────────────────────────────────── */
  {
    colorLayer: 'semantic', layer: 'semantic', prefix: 'status',
    description: 'Status Colors —— Foreground / Background / Border / Hover / Active / Subtle 六变体',
    contrastRequirement: 'foreground on subtle-background >= 4.5:1；border on surface >= 3:1（非文本）',
    items: [
      I('success-hover', '#166534', '#34D399', '成功 Hover', '成功态按钮 / 链接悬停', 'web/src/components/ui/badge.tsx'),
      I('success-active', '#14532D', '#10B981', '成功 Active', '成功态按下', 'web/src/components/ui/badge.tsx'),
      I('warning-hover', '#92400E', '#FBBF24', '警告 Hover', '警告态悬停', 'web/src/components/ui/badge.tsx'),
      I('warning-active', '#78350F', '#F59E0B', '警告 Active', '警告态按下', 'web/src/components/ui/badge.tsx'),
      I('danger-hover', '#991B1B', '#F87171', '危险 Hover', '危险态悬停', 'web/src/components/ui/button.tsx'),
      I('danger-active', '#7F1D1D', '#EF4444', '危险 Active', '危险态按下', 'web/src/components/ui/button.tsx'),
      I('info-hover', '#1E40AF', '#7DD3FC', '信息 Hover', '信息态悬停', 'web/src/components/ui/alert.tsx'),
      I('info-active', '#1E3A8A', '#38BDF8', '信息 Active', '信息态按下', 'web/src/components/ui/alert.tsx'),
      I('success-subtle', '#F0FDF4', '#052E16', '成功浅底', '成功提示背景', 'web/src/components/ui/alert.tsx'),
      I('warning-subtle', '#FFFBEB', '#451A03', '警告浅底', '警告提示背景', 'web/src/components/ui/alert.tsx'),
      I('danger-subtle', '#FEF2F2', '#450A0A', '危险浅底', '错误提示背景', 'web/src/components/ui/alert.tsx'),
      I('info-subtle', '#EFF6FF', '#172554', '信息浅底', '信息提示背景', 'web/src/components/ui/alert.tsx'),
    ],
  },

  /* ── L2 Semantic：图表 12 色 + 非颜色通道 ─────────────────────────────────── */
  {
    colorLayer: 'semantic', layer: 'semantic', prefix: 'chart',
    description: 'Chart Colors 6–12（1–5 见 tokens.mjs）—— 12 色体系，颜色不得作为唯一区分手段',
    contrastRequirement: '每个系列色 on chart surface >= 3:1（非文本）；任意两系列在正常视觉 + protanopia / deuteranopia / tritanopia 模拟下 CIEDE2000 >= 10（正常视觉 >= 12）',
    // 2026-11-15：v5 色板搜索定稿后接入真实图表运行时。消费者是
    // brand-colors.ts 的调用时解析器（读 --ds-color-chart-N，生成数组兜底），
    // 由 dashboard/lib/charts.ts 的 getDashboardChartColors / USER_COLORS 使用。
    items: [
      I('6', '#9D6013', '#CD3503', '系列 6 赭橙', '第 6 数据系列', 'web/src/design-system/tokens/brand-colors.ts'),
      I('7', '#E94BAF', '#E36CC0', '系列 7 粉', '第 7 数据系列', 'web/src/design-system/tokens/brand-colors.ts'),
      I('8', '#0E21C1', '#04F0E4', '系列 8 深蓝/青', '第 8 数据系列', 'web/src/design-system/tokens/brand-colors.ts'),
      I('9', '#A88900', '#FFF596', '系列 9 金/浅黄', '第 9 数据系列', 'web/src/design-system/tokens/brand-colors.ts'),
      I('10', '#AE005D', '#BF8800', '系列 10 玫红/金', '第 10 数据系列', 'web/src/design-system/tokens/brand-colors.ts'),
      I('11', '#72007A', '#98F600', '系列 11 紫红/黄绿', '第 11 数据系列', 'web/src/design-system/tokens/brand-colors.ts'),
      I('12', '#9D0000', '#AFD49F', '系列 12 深红/灰绿', '第 12 数据系列', 'web/src/design-system/tokens/brand-colors.ts'),
    ],
  },

  /* ── L2 Semantic：独立 Terminal Theme（禁止深浅共用纯黑） ─────────────────── */
  {
    colorLayer: 'semantic', layer: 'semantic', prefix: 'terminal',
    description: 'Terminal Light / Dark 独立主题 + ANSI16 + 状态色（不与 CodeBlock / Editor 共用背景）',
    contrastRequirement: 'foreground / ansi-* on terminal-background >= 4.5:1（Light 与 Dark 分别验证）',
    items: [
      // background / foreground 由 tokens.mjs 现有 terminal 组定义（值已改为 Light/Dark 独立）。
      // 2026-11-15 消费者更正：产品内没有真实终端模拟器（无 xterm），首页
      // hero-terminal-demo.tsx 只消费 term-* 别名中的 command/flag/property/
      // string/number，不引用下列任何变量 —— 原登记为虚假消费者。这 22 色的
      // 真实消费者是 Showcase 终端区（scopedTerminalVars 按 pane 注入
      // --ds-color-terminal-*，光标 / 选区 / 状态输出 / ANSI16 全部 var() 消费）。
      // 本组只做增量补齐，避免同名 Token 重复定义。
      I('cursor', '#5B5EE6', '#A1A3F7', '终端光标', '光标块 / 竖线', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('selection', '#C7D2FE', '#33417A', '终端选区', '文本选中背景', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('error', '#B91C1C', '#FCA5A5', '终端错误', 'stderr / 失败输出', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('warning', '#A54600', '#FCD34D', '终端警告', 'warn 输出', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('success', '#15803D', '#6EE7B7', '终端成功', '成功输出', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('info', '#1D4ED8', '#93C5FD', '终端信息', 'info 输出', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-0', '#1E293B', '#334155', 'ANSI 0 black', 'ANSI 标准黑', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-1', '#B91C1C', '#F87171', 'ANSI 1 red', 'ANSI 标准红', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-2', '#15803D', '#4ADE80', 'ANSI 2 green', 'ANSI 标准绿', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-3', '#A16207', '#FBBF24', 'ANSI 3 yellow', 'ANSI 标准黄', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-4', '#1D4ED8', '#60A5FA', 'ANSI 4 blue', 'ANSI 标准蓝', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-5', '#A21CAF', '#E879F9', 'ANSI 5 magenta', 'ANSI 标准品红', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-6', '#0E7490', '#22D3EE', 'ANSI 6 cyan', 'ANSI 标准青', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-7', '#475569', '#CBD5E1', 'ANSI 7 white', 'ANSI 标准白', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-8', '#64748B', '#94A3B8', 'ANSI 8 bright black', 'ANSI 亮黑', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-9', '#DC2626', '#FCA5A5', 'ANSI 9 bright red', 'ANSI 亮红', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-10', '#16A34A', '#86EFAC', 'ANSI 10 bright green', 'ANSI 亮绿', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-11', '#CA8A04', '#FDE68A', 'ANSI 11 bright yellow', 'ANSI 亮黄', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-12', '#2563EB', '#93C5FD', 'ANSI 12 bright blue', 'ANSI 亮蓝', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-13', '#C026D3', '#F0ABFC', 'ANSI 13 bright magenta', 'ANSI 亮品红', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-14', '#0891B2', '#67E8F9', 'ANSI 14 bright cyan', 'ANSI 亮青', 'docs/design-system/registry/showcase-extensions.mjs'),
      I('ansi-15', '#0F172A', '#F8FAFC', 'ANSI 15 bright white', 'ANSI 亮白', 'docs/design-system/registry/showcase-extensions.mjs'),
    ],
  },

  /* ── L2 Semantic：代码编辑器与代码块/终端三者背景分离 ─────────────────────── */
  {
    colorLayer: 'semantic', layer: 'semantic', prefix: 'code',
    description: 'Editor / CodeBlock / Terminal 各自独立背景与完整编辑器装饰色',
    contrastRequirement: '所有前景 on editor-background >= 4.5:1；装饰色非文本 >= 3:1',
    items: [
      I('codeblock-background', '#F1F5F9', '#080D18', '只读代码块背景（区别于编辑器）', 'fenced code / CodeBlock', 'web/src/components/ai-elements/code-block.tsx'),
      I('editor-background', '#FFFFFF', '#0E1524', '可编辑代码区背景（区别于代码块）', 'CodeBlockEditor / JSON 编辑器', 'web/src/components/json-code-editor.tsx'),
      I('toolbar-background', '#F8FAFC', '#16203A', '代码工具栏背景', '语言标签 / 复制按钮区', 'web/src/components/ai-elements/code-block.tsx'),
      I('bracket-match', '#DBEAFE', '#1E3A8A', '括号匹配高亮', 'matching bracket 背景', 'web/src/components/ai-elements/code-block.tsx'),
      I('indent-guide', '#CBD5E1', '#3B4A63', '缩进引导线', 'indent guide（非文本 3:1）', 'web/src/components/ai-elements/code-block.tsx'),
      I('fold-control', '#64748B', '#94A3B8', '折叠控件', 'fold gutter 标记', 'web/src/components/ai-elements/code-block.tsx'),
      I('error-decoration', '#B91C1C', '#F87171', '错误装饰', 'lint error 下划线', 'web/src/components/ai-elements/code-block.tsx'),
      I('warning-decoration', '#A54600', '#FCD34D', '警告装饰', 'lint warning 下划线', 'web/src/components/ai-elements/code-block.tsx'),
      I('diff-added', '#DCFCE7', '#064E3B', '新增行底', 'diff added 背景', 'web/src/components/ai-elements/code-block.tsx'),
      I('diff-removed', '#FEE2E2', '#450A0A', '删除行底', 'diff removed 背景', 'web/src/components/ai-elements/code-block.tsx'),
      I('active-line-border', '#C7D2FE', '#3730A3', '当前行边框', 'active line indicator', 'web/src/components/ai-elements/code-block.tsx'),
    ],
  },

  /* ── L3 Component Colors：22 类 ─────────────────────────────────────────── */
  {
    colorLayer: 'component', layer: 'component', prefix: 'component',
    description: 'Component Colors —— 22 类组件 surface / foreground，引用 L2 语义层',
    contrastRequirement: 'component foreground on component surface >= 4.5:1',
    items: COMPONENT_ITEMS(),
  },

  /* ── L4 Interaction Colors：8 态 ─────────────────────────────────────────── */
  {
    colorLayer: 'interaction', layer: 'component', prefix: 'interaction',
    description: 'Interaction Colors —— Default / Hover / Active / Focus / Selected / Disabled / Loading / Error',
    contrastRequirement: '交互态前景 on 对应表面 >= 4.5:1；Disabled 单独登记例外',
    items: [
      I('default', '#5B5EE6', '#8B8DF5', 'Default 品牌交互色', '默认态', 'web/src/components/ui/button.tsx'),
      I('hover', '#494CC7', '#A1A3F7', 'Hover 交互色', '指针悬停', 'web/src/components/ui/button.tsx'),
      I('active', '#3F42B0', '#B7B8FA', 'Active 交互色', '按下', 'web/src/components/ui/button.tsx'),
      I('focus', '#5B5EE6', '#8B8DF5', 'Focus 焦点环', '键盘聚焦', 'web/src/components/ui/button.tsx'),
      I('selected', '#EDEEFF', '#2A2C5E', 'Selected 选中底', '列表 / 标签选中', 'web/src/components/ui/select.tsx'),
      I('disabled', '#94A3B8', '#64748B', 'Disabled 禁用', '禁用（WCAG 1.4.3 例外）', 'web/src/components/ui/button.tsx'),
      I('loading', '#64748B', '#94A3B8', 'Loading 载入', '进度 / 骨架', 'web/src/components/ui/button.tsx'),
      I('error', '#B91C1C', '#FCA5A5', 'Error 错误', '校验失败', 'web/src/components/ui/input.tsx'),
    ],
  },

  /* ── L5 Product Context Colors：12 类业务语义 ───────────────────────────── */
  {
    colorLayer: 'product', layer: 'component', prefix: 'product',
    description: 'Product Context Colors —— Uter 真实业务状态；严禁借用 chart / 装饰色',
    contrastRequirement: '业务状态前景 on 页面表面 >= 4.5:1；不得与 chart-1..12 取同值',
    items: [
      I('balance', '#0F766E', '#5EEAD4', '账户余额', '余额数值与卡片强调', 'web/src/features/wallet/components/wallet-stats-card.tsx'),
      I('recharge', '#15803D', '#6EE7B7', '充值', '充值成功 / 入账', 'web/src/features/wallet/components/recharge-form-card.tsx'),
      I('payment', '#1D4ED8', '#93C5FD', '支付', '支付中 / 支付完成', 'web/src/features/wallet/components/recharge-form-card.tsx'),
      I('refund', '#A54600', '#FCD34D', '退款', '退款中 / 已退款', 'web/src/features/wallet/components/wallet-stats-card.tsx'),
      I('order', '#4338CA', '#A5B4FC', '订单', '订单号 / 订单状态', 'web/src/features/wallet/components/wallet-stats-card.tsx'),
      I('api-key', '#7E22CE', '#D8B4FE', 'API Key', '密钥展示 / 复制态', 'web/src/features/wallet/components/wallet-stats-card.tsx'),
      I('token', '#0E7490', '#67E8F9', 'Token', 'Token 用量 / 消耗', 'web/src/features/usage-logs/components/log-cost-display.tsx'),
      I('model-status', '#15803D', '#4ADE80', '模型状态', '渠道在线 / 可用', 'web/src/features/channels/components/dialogs/codex-usage-dialog.tsx'),
      I('api-call', '#1D4ED8', '#7DD3FC', 'API 调用', '请求计数 / 调用趋势', 'web/src/features/usage-logs/components/log-cost-display.tsx'),
      I('usage', '#4338CA', '#C4B5FD', '用量', '用量统计 / 配额', 'web/src/features/usage-logs/components/log-cost-display.tsx'),
      I('billing', '#9A3412', '#FDBA74', '计费', '计费规则 / 费率', 'web/src/features/pricing/components/model-details-api.tsx'),
      I('task-status', '#B91C1C', '#FCA5A5', '任务状态', '任务失败 / 异常', 'web/src/features/task-plugins/lib/plugin-icon.ts'),
    ],
  },
]

/** 22 类组件：surface 与 foreground 成对，值引用 L2 语义色（层级可追踪）。 */
function COMPONENT_ITEMS() {
  const names = [
    'button', 'input', 'select', 'checkbox', 'radio', 'switch', 'card', 'dialog',
    'drawer', 'dropdown', 'tooltip', 'tabs', 'table', 'badge', 'alert', 'toast',
    'navigation', 'sidebar', 'pagination', 'codeblock', 'editor', 'terminal',
  ]
  const surface = {
    light: {
      button: '#5B5EE6', input: '#FFFFFF', select: '#FFFFFF', checkbox: '#FFFFFF', radio: '#FFFFFF',
      switch: '#E2E8F0', card: '#FFFFFF', dialog: '#FFFFFF', drawer: '#FFFFFF', dropdown: '#FFFFFF',
      tooltip: '#0F172A', tabs: '#F1F5F9', table: '#FFFFFF', badge: '#F1F5F9', alert: '#F8FAFC',
      toast: '#FFFFFF', navigation: '#FFFFFF', sidebar: '#F8FAFC', pagination: '#FFFFFF',
      codeblock: '#F1F5F9', editor: '#FFFFFF', terminal: '#F1F5F9',
    },
    dark: {
      button: '#5B5EE6', input: '#111827', select: '#111827', checkbox: '#111827', radio: '#111827',
      switch: '#3B4A63', card: '#111827', dialog: '#1B2436', drawer: '#1B2436', dropdown: '#1B2436',
      tooltip: '#E2E8F0', tabs: '#0B1120', table: '#111827', badge: '#1B2436', alert: '#0B1120',
      toast: '#1B2436', navigation: '#111827', sidebar: '#0B1120', pagination: '#111827',
      codeblock: '#080D18', editor: '#0E1524', terminal: '#0A101E',
    },
  }
  const onDarkSurface = new Set(['button', 'tooltip'])
  const out = []
  for (const n of names) {
    const fgL = onDarkSurface.has(n) ? '#FFFFFF' : '#0F172A'
    const fgD = n === 'tooltip' ? '#0F172A' : n === 'button' ? '#FFFFFF' : '#F1F5F9'
    out.push(I(n + '-surface', surface.light[n], surface.dark[n], n + ' 组件表面', n + ' 的背景 / 填充', 'web/src/components/ui/'))
    out.push(I(n + '-foreground', fgL, fgD, n + ' 组件前景', n + ' 的文字 / 图标', 'web/src/components/ui/'))
  }
  return out
}

/** 组件规格（五层架构第 4 层实体，供 DEPENDENCY-GRAPH 与 Showcase 使用）。 */
export const COMPONENT_SPECS = [
  'Button', 'Input', 'Select', 'Checkbox', 'Radio', 'Switch', 'Card', 'Dialog',
  'Drawer', 'Dropdown', 'Tooltip', 'Tabs', 'Table', 'Badge', 'Alert', 'Toast',
  'Navigation', 'Sidebar', 'Pagination', 'CodeBlock', 'Editor', 'Terminal',
].map((name, i) => ({
  id: 'CS-' + String(i + 1).padStart(2, '0'),
  name,
  surfaceToken: '--ds-color-component-' + name.toLowerCase() + '-surface',
  foregroundToken: '--ds-color-component-' + name.toLowerCase() + '-foreground',
  interactionStates: ['default', 'hover', 'active', 'focus', 'selected', 'disabled', 'loading', 'error'],
  keyboardAccessible: true,
}))

/** 业务上下文语义（禁止借用图表色 / 装饰色）。 */
export const PRODUCT_CONTEXTS = [
  ['balance', '账户余额', '余额数值、余额卡片', '不得使用 chart-*'],
  ['recharge', '充值', '充值成功、入账', '不得使用 chart-*'],
  ['payment', '支付', '支付中、支付完成', '不得使用 chart-*'],
  ['refund', '退款', '退款中、已退款', '不得使用 chart-*'],
  ['order', '订单', '订单号、订单状态', '不得使用 chart-*'],
  ['api-key', 'API Key', '密钥展示、复制态', '不得使用 chart-*'],
  ['token', 'Token', 'Token 用量、消耗', '不得使用 chart-*'],
  ['model-status', '模型状态', '渠道在线 / 可用', '不得使用 chart-*'],
  ['api-call', 'API 调用', '请求计数、调用趋势', '不得使用 chart-*'],
  ['usage', '用量', '用量统计、配额', '不得使用 chart-*'],
  ['billing', '计费', '计费规则、费率', '不得使用 chart-*'],
  ['task-status', '任务状态', '任务失败 / 异常', '不得使用 chart-*'],
].map(([key, name, usage, rule]) => ({
  key, name, usage, rule,
  token: '--ds-color-product-' + key,
}))

export const COLOR_LAYERS = [
  { id: 'L1', name: 'Primitive Colors', description: '基础色值，业务组件不得直接依赖' },
  { id: 'L2', name: 'Semantic Colors', description: 'Brand / Text / Surface / Border / Success / Warning / Danger / Info / Neutral / Focus / Selection / Overlay' },
  { id: 'L3', name: 'Component Colors', description: '22 类组件 surface / foreground' },
  { id: 'L4', name: 'Interaction Colors', description: 'Default / Hover / Active / Focus / Selected / Disabled / Loading / Error' },
  { id: 'L5', name: 'Product Context Colors', description: '12 类 Uter 真实业务语义色' },
]

/** 图表非颜色区分通道（§4.5 / §八 不依赖颜色传递信息）。 */
export const CHART_NON_COLOR_CHANNELS = {
  lineStyles: ['solid', 'dashed', 'dotted', 'dash-dot'],
  pointMarkers: ['circle', 'square', 'triangle', 'diamond', 'cross', 'star'],
  legendRequired: true,
  directLabelRequiredWhenSeriesGt: 6,
  cvdSimulation: ['protanopia', 'deuteranopia', 'tritanopia'],
}
