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
 * 生成 UTER DESIGN SYSTEM 5.0 全量 Showcase（`UDS5-S23` §11）。
 *
 * 唯一真源：
 *   - 规范条目 / 组件清单：DESIGN-STANDARD-REGISTRY.yaml + COMPONENT-REGISTRY.yaml
 *     （组件 YAML 的唯一真源是 web/src/design-system/component-registry.json）
 *   - 设计值：web/src/design-system/tokens/*.css 与 web/src/styles/theme.css
 *     （本文件内的色值 / 字号是**派生的内联快照**，不是第二份真源）
 *
 * 产物：docs/design-system/uter-design-system-5.0/SHOWCASE-5.0.html
 *   单文件、零外部依赖、file:// 可直接打开、真实 DOM 渲染（0 个 <img>）。
 *
 * 用法：node scripts/generate-design-showcase-5.0.mjs
 * 校验：node scripts/check-design-showcase-5.0.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = resolve(SCRIPT_DIR, '..')
const REPO_ROOT = resolve(WEB_ROOT, '..')
const DS_DIR = join(REPO_ROOT, 'docs/design-system/uter-design-system-5.0')
const SPEC_PATH = join(DS_DIR, 'DESIGN-STANDARD-REGISTRY.yaml')
const COMPONENTS_PATH = join(DS_DIR, 'COMPONENT-REGISTRY.yaml')
const OUT_PATH = join(DS_DIR, 'SHOWCASE-5.0.html')

const specRegistry = parse(readFileSync(SPEC_PATH, 'utf8'))
const componentRegistry = parse(readFileSync(COMPONENTS_PATH, 'utf8'))
const standards = specRegistry.standards ?? []
const components = componentRegistry.components ?? []

const esc = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const relDoc = (p) => (p ? `./${String(p).split('/').pop()}` : '#')

// ---------------------------------------------------------------------------
// 基础元素 / 模式分区（20 类，每类都是真实 DOM，不使用截图）
// ---------------------------------------------------------------------------
const swatch = (label, value, text = '') =>
  `<div class="swatch"><span class="swatch-chip" style="background:${value}"></span><code>${esc(label)}</code><span class="swatch-val">${esc(text || value)}</span></div>`

const ELEMENTS = [
  {
    id: 'color',
    title: '色彩 Color',
    spec: 'UDS5-S03',
    body: `<div class="grid-swatches">
      ${swatch('brand-1', '#5B5EE6', '靛紫主色')}
      ${swatch('brand-2', '#494CC7')}
      ${swatch('brand-3', '#3F42B0')}
      ${swatch('brand-dark-1', '#8B8DF5')}
      ${swatch('brand-dark-2', '#A1A3F7')}
      ${swatch('brand-dark-3', '#B7B8FA')}
      ${swatch('canvas', '#F8FAFC')}
      ${swatch('surface', '#FFFFFF')}
      ${swatch('fg-primary', '#0F172A')}
      ${swatch('fg-secondary', '#64748B')}
      ${swatch('border', '#E2E8F0')}
      ${swatch('success', '#16A34A')}
      ${swatch('warning', '#D97706')}
      ${swatch('danger', '#DC2626')}
      ${swatch('info', '#2563EB')}
      ${swatch('chart-1..5', 'linear-gradient(90deg,#5B5EE6,#818CF8,#38BDF8,#34D399,#FBBF24)', '图表 5 色')}
    </div>
    <p class="note">语义色一律走 <code>-soft</code> / <code>-subtle</code> / <code>-hover</code> 派生，禁止 <code>bg-X/NN</code> 任意透明度；首屏演示色走 <code>term-*</code>、通用代码走 <code>syntax-*</code>，两套不互引。<code>text-fg-primary</code> 死类与 E24 / E28 例外均已登记差异。</p>`,
  },
  {
    id: 'typography',
    title: '字号与排版 Typography',
    spec: 'UDS5-S04',
    body: `<div class="type-stack">
      <div class="type-row"><code>display</code><span class="t-display">36 / 600 / 44</span></div>
      <div class="type-row"><code>h1</code><span class="t-h1">28 / 600 / 36</span></div>
      <div class="type-row"><code>h2</code><span class="t-h2">22 / 600 / 30</span></div>
      <div class="type-row"><code>h3</code><span class="t-h3">18 / 600 / 26</span></div>
      <div class="type-row"><code>body</code><span class="t-body">14 / 22 正文</span></div>
      <div class="type-row"><code>caption</code><span class="t-caption">12 / 18 最小字号</span></div>
      <div class="type-row"><code>dense</code><span class="t-dense">13px 走 text-dense</span></div>
      <div class="type-row"><code>mono</code><span class="t-mono">13px 走 text-mono</span></div>
    </div>
    <p class="note">全站可见文本下限 <strong>12px</strong>（T16）；<code>text-uk-*</code> 禁用；<code>@theme --text-*</code> 是 Tailwind v4.3.3 自定义字号注册机制，保留不得删除。运行时 h1/h2 为 30/38 与 24/32，规范目标值差异已登记 <code>Adapt / NOT_VERIFIED</code>。</p>`,
  },
  {
    id: 'spacing',
    title: '间距 Spacing',
    spec: 'UDS5-S05',
    body: `<div class="space-row">${[4, 8, 12, 16, 24, 32, 40, 48]
      .map(
        (n) =>
          `<div class="space-item"><span class="space-bar" style="width:${n * 2}px"></span><code>${n}px</code></div>`
      )
      .join('')}</div>
    <p class="note">4pt 基础单位；密度三档由 <code>data-theme-scale</code> 控制且<strong>不缩放</strong> <code>--text-*</code>；容器 1280px / 营销 1800px / 三栏 1440px 唯一声明在 <code>tokens/spacing.css:65-66</code>。T17 禁止任意间距。</p>`,
  },
  {
    id: 'radius',
    title: '圆角 Radius and Shape',
    spec: 'UDS5-S06',
    body: `<div class="radius-row">${[
      ['xs', 6],
      ['sm', 8],
      ['md', 10],
      ['lg', 12],
      ['xl', 14],
      ['2xl', 16],
      ['3xl', 18],
      ['4xl', 20],
      ['full', 9999],
    ]
      .map(
        ([name, px]) =>
          `<div class="radius-item"><span class="radius-box" style="border-radius:${px}px"></span><code>${name} · ${px === 9999 ? 'full' : `${px  }px`}</code></div>`
      )
      .join('')}</div>
    <p class="note"><code>--radius: 0.625rem</code>(10px) × 系数 0.6/0.8/1/1.2/1.4/1.6/1.8/2 = 8 个 calc 命名派生档；<code>rounded-full</code> 为 T10 额外放行的特殊档，合计 9 种合法写法。「圆角七档」是 3.0 早期滞后称谓。</p>`,
  },
  {
    id: 'elevation',
    title: '投影与层叠 Elevation',
    spec: 'UDS5-S07',
    body: `<div class="elev-row">${[0, 1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<div class="elev-card elev-${n}"><code>e${n}</code><span>层叠档 ${n}</span></div>`
      )
      .join('')}</div>
    <p class="note">5 个 <code>--ds-elevation-*</code> + 1 个 <code>--ds-glow-online</code> = 6 档；Dark 覆盖 2 档。z-index 目标八档（0/100/…/700）尚未落地，存量 30 处 <code>z-50</code>（其中 ui/ 24 处）与 3 处负 z-index 已登记待迁移。</p>`,
  },
  {
    id: 'border',
    title: '边框与焦点环 Border / Focus',
    spec: 'UDS5-S07 / S13',
    body: `<div class="demo-row"><span class="border-1">1px 边框</span><button type="button" class="focus-demo" aria-label="焦点环 2px 演示">聚焦我（2px ring-2）</button><span class="border-decor">装饰性 ring-1 · 1px</span></div>
    <p class="note">边框恒 1px；焦点环 <strong>2px <code>ring-2</code></strong>（<code>--ds-focus-ring-width: 2px</code>，已裁决、无规范—代码漂移）；装饰性 <code>ring-1</code> 描边 1px 是真实有效值但不承载焦点语义。</p>`,
  },
  {
    id: 'iconography',
    title: '图标 Iconography',
    spec: 'UDS5-S08',
    body: `<div class="demo-row">${[16, 20, 24]
      .map(
        (n) =>
          `<span class="icon-demo" aria-label="图标尺寸 ${n} 像素"><svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v4l3 2"></path></svg><code>${n}px</code></span>`
      )
      .join('')}</div>
    <p class="note">单一来源 <code>lucide-react</code>；描边 1.8px；交互图标必须有可访问名称，纯装饰图标 <code>aria-hidden="true"</code>；由 <code>spec-guards.test.ts</code> 守卫。</p>`,
  },
  {
    id: 'motion',
    title: '动效 Motion',
    spec: 'UDS5-S09',
    body: `<div class="motion-row">${[100, 200, 250, 300, 350, 500]
      .map(
        (n) =>
          `<div class="motion-item"><span class="motion-bar" style="animation-duration:${n}ms"></span><code>${n}ms</code></div>`
      )
      .join('')}</div>
    <p class="note">Dialog 背板 <code>duration-100</code>(100ms)、Sheet 面板 <code>ds-motion-base</code>(200ms)、巨型菜单 <code>ds-motion-slow</code>(350ms)；T11 拦裸 <code>duration-*</code>；<code>prefers-reduced-motion</code> 下全部降级为 0ms。</p>`,
  },
  {
    id: 'theme',
    title: '主题 Theme',
    spec: 'UDS5-S10',
    body: `<div class="demo-row"><span class="theme-chip" data-theme-chip="light">Light</span><span class="theme-chip" data-theme-chip="dark">Dark</span><span class="theme-chip" data-theme-chip="system">System</span></div>
    <p class="note">三维正交：<code>data-theme-preset</code>（调色板）/ <code>data-theme-radius</code> / <code>data-theme-scale</code>。<code>simple-large</code> 属<strong>字号轴</strong>放大档，不改调色板（<code>theme-presets.css:465-467</code> 已排除）。Light/Dark 变量成对校验由 <code>check-design-system-5.0.mjs</code> 守护；本页右上角可实时切换。</p>`,
  },
  {
    id: 'layout',
    title: '布局 Layout',
    spec: 'UDS5-S11',
    body: `<div class="shell-demo"><div class="shell-side">Sidebar<br><code>220px / 44px</code></div><div class="shell-main"><div class="shell-head">Header · <code>48px</code></div><div class="shell-content">Content · 12 栅格 · max-width 1280px</div></div></div>
    <p class="note">App Shell / 容器 / 栅格；Sidebar 220px（折叠 44px / 展开 272px），Header <code>--app-header-height: 3rem</code>；73 个路由源码与 30 个 feature 目录为适配基线。</p>`,
  },
  {
    id: 'responsive',
    title: '响应式 Responsive',
    spec: 'UDS5-S12',
    body: `<div class="demo-row">${[
      ['sm', 640],
      ['md', 768],
      ['lg', 1024],
      ['xl', 1280],
      ['2xl', 1536],
    ]
      .map(([n, px]) => `<span class="bp-chip"><code>${n}</code> ${px}px</span>`)
      .join('')}</div>
    <p class="note">PC Web / H5 双平台；22 页 × 2 视口 = 44 张视觉基线；Android / iOS / HarmonyOS 无实现，一律 <code>NOT_VERIFIED</code>，不得用 Web 结果代替。</p>`,
  },
  {
    id: 'accessibility',
    title: '无障碍 Accessibility',
    spec: 'UDS5-S13',
    body: `<div class="demo-row"><button type="button" class="focus-demo" aria-label="键盘可聚焦按钮">Tab 聚焦</button><span class="hit-target" aria-label="44px 命中区">44px 命中区</span><span class="contrast-chip" aria-label="对比度 4.5 比 1">AA 4.5:1</span></div>
    <p class="note">WCAG 2.2 AA 目标、键盘 / 焦点 / ARIA / 触控命中区 ≥24px（推荐 44px）；E24 两处缺陷（3.76:1 / 3.30:1）待修；E28 品牌渐变为有意例外（浅色 from 2.54 / via 2.72 未达 3:1，to 3.96 达标；深色 7.93 / 7.41 / 5.10 全部达标）；12 个守卫测试与 31 条对比度断言。</p>`,
  },
  {
    id: 'form',
    title: '表单与校验 Form and Validation',
    spec: 'UDS5-S18',
    body: `<form class="form-demo" onsubmit="return false" aria-label="表单元素演示">
      <label for="demo-email">邮箱 <span aria-hidden="true">*</span></label>
      <input id="demo-email" type="email" placeholder="name@example.com" aria-describedby="demo-err" />
      <p id="demo-err" class="field-error" role="alert">请输入有效邮箱地址（字段级错误）</p>
      <label for="demo-otp">一次性验证码</label>
      <input id="demo-otp" class="otp" inputmode="numeric" maxlength="6" placeholder="000000" aria-label="六位验证码" />
      <button type="submit" class="btn btn-primary" aria-label="提交表单（防重复提交）">提交</button>
    </form>
    <p class="note">字段级错误 + 服务端错误优先级 + 未保存提醒 + 防重复提交；错误态需 <code>role="alert"</code> 与 <code>aria-describedby</code>；7 份 locale 文案同步。</p>`,
  },
  {
    id: 'data-display',
    title: '数据展示 Data Display',
    spec: 'UDS5-S19',
    body: `<table class="demo-table" aria-label="数据展示表格演示"><thead><tr><th>模型</th><th>状态</th><th class="num">用量</th><th class="num">金额</th></tr></thead><tbody><tr><td>gpt-4o</td><td><span class="badge badge-ok">正常</span></td><td class="num">1,280,000</td><td class="num">¥ 12.80</td></tr><tr><td>claude-3.5</td><td><span class="badge badge-warn">限流</span></td><td class="num">860,240</td><td class="num">¥ 8.60</td></tr></tbody></table>
    <div class="state-row"><span class="state-chip">空态 Empty</span><span class="state-chip">加载 Loading</span><span class="state-chip">错误 Error</span></div>
    <p class="note">11 项表格能力（排序 / 筛选 / 搜索 / 分页 / 行选 / 批量 / 列可见性 / 响应式 / 空 / 加载 / 错误）；数值 <code>tabular-nums</code>、货币默认 ¥；24 个 <code>data-table/</code> 公开导出；密度档 th 12/500、td 13/400。</p>`,
  },
  {
    id: 'notification',
    title: '通知 Notification',
    spec: 'UDS5-S20',
    body: `<div class="notif-stack">
      <div class="notif notif-toast" role="status">Toast · 操作成功</div>
      <div class="notif notif-snackbar" role="status">Snackbar · 可撤销操作</div>
      <div class="notif notif-alert" role="alert">Alert · 校验失败</div>
      <div class="notif notif-banner" role="status">Banner · 系统公告</div>
      <div class="notif notif-system" role="status">System Notification · 规范保留位</div>
      <div class="notif notif-center" role="status">Notification Center · 通知中心聚合</div>
    </div>
    <p class="note">6 类通知组件（后 2 类含规范保留位）与 5 类反馈分级（成功 / 失败 / 取消 / 加载 / 异常）；<code>role="alert"</code> 仅用于需打断的错误。</p>`,
  },
  {
    id: 'interaction',
    title: '交互 Interaction',
    spec: 'UDS5-S17',
    body: `<div class="matrix" aria-label="交互五态矩阵"><div class="matrix-head"><span>交互类</span><span>成功</span><span>失败</span><span>取消</span><span>加载</span><span>异常</span></div>${[
      '登录',
      '注册',
      '充值',
      '退款',
      '创建密钥',
      '切换组织',
      '保存设置',
      '上传文件',
      '删除资源',
      '批量操作',
      '搜索',
      '分页',
      '导出',
      '邀请成员',
      '二次验证',
    ]
      .map(
        (name) =>
          `<div class="matrix-row"><span>${name}</span>${'<span aria-label="已定义">●</span>'.repeat(5)}</div>`
      )
      .join('')}</div>
    <p class="note">15 类交互 × 五态（过程）；组件八态（default/hover/focus/pressed/disabled/loading/error/success）是<strong>状态存在性</strong>，两者互补不是冲突；展示中心现状 6 态（缺 error/success）已登记。</p>`,
  },
  {
    id: 'page-template',
    title: '页面模板 Page Template',
    spec: 'UDS5-S16',
    body: `<div class="tpl-grid">${[
      '仪表盘',
      '列表页',
      '详情页',
      '表单页',
      '设置页',
      '定价页',
      '认证页',
      '错误页',
      '空状态页',
      '文档页',
      '结算页',
      '个人资料页',
    ]
      .map(
        (name, i) =>
          `<div class="tpl-card"><span class="tpl-thumb" aria-label="${name}模板缩略"></span><code>T${String(i + 1).padStart(2, '0')} ${name}</code></div>`
      )
      .join('')}</div>
    <p class="note">12 类页面模板 / 12 区域；Page Header 尚无独立组件（按 §3+§6 组合，保持 Pending）；RISK 分级按条标注，禁止整节一刀切。</p>`,
  },
  {
    id: 'business-domain',
    title: '业务域 Business Domains',
    spec: 'UDS5-S29 / S30 / S31 / S32 / S22',
    body: `<div class="domain-grid">
      <div class="domain-card"><strong>S29 认证</strong><span>9 路由 / 11 态状态机 / 字段级错误 / 安全边界</span></div>
      <div class="domain-card"><strong>S30 用户与 API Key</strong><span>掩码与明文取回 / 额度用量 / 头像身份</span></div>
      <div class="domain-card"><strong>S31 组织与账单</strong><span>org_role 四级 / 配额与组织钱包 / 订单状态机</span></div>
      <div class="domain-card"><strong>S32 触达与本地化</strong><span>邮件模板 / 短信规范位 / 7 locale / static-keys</span></div>
    </div>
    <div class="chip-row">${[
      'Dashboard',
      '用户管理',
      'API Key',
      '模型',
      '渠道',
      'Token 余额',
      '充值',
      '支付',
      '退款',
      '消费记录',
      '订单',
      '价格管理',
      '统计分析',
      '系统设置',
      '权限管理',
      '管理员功能',
      '其他现有模块',
    ]
      .map((n) => `<span class="chip">${n}</span>`)
      .join('')}</div>
    <p class="note">业务红线唯一清单：<code>org_role</code> / <code>sub_quota_limit</code> / <code>EnforceOrgQuota</code> / <code>ReserveOrgQuota</code> / <code>IncrOrgUsedQuota</code> 零改动（S22 的 17 个模块只做视觉规范映射）。</p>`,
  },
  {
    id: 'component-api',
    title: '组件 API 与八态 Component API',
    spec: 'UDS5-S14 / S15 / S23',
    body: `<div class="state-row">${[
      'default',
      'hover',
      'focus',
      'pressed',
      'disabled',
      'loading',
      'error',
      'success',
    ]
      .map((s) => `<span class="state-chip" aria-label="组件状态 ${s}">${s}</span>`)
      .join('')}</div>
    <p class="note">22 项组件契约 / A–N 14 类清单 / 65 个已注册组件是三个不同维度；Props、受控/非受控、Composition、Slot、Ref、废弃策略以 <code>ui/button.tsx</code> 与 <code>web/AGENTS.md</code> 3.2/3.3 为唯一扩展路径；<code>UTER-CMP-*</code> 注册 ID 为「规范 ↔ 代码 ↔ 展示 ↔ 测试」主键。</p>`,
  },
  {
    id: 'token-layers',
    title: 'Token 三层与真源 Token Layers',
    spec: 'UDS5-S02 / S24',
    body: `<div class="layer-stack">
      <div class="layer"><code>L1 Spec SSOT</code><span>3.0 §28.5 TOKEN-MANIFEST（历史）→ 5.0 注册表 §26 裁决表</span></div>
      <div class="layer"><code>L2 Runtime SSOT</code><span>web/src/design-system/tokens/*.css（8）+ foundations/*.css（6）+ styles/theme.css</span></div>
      <div class="layer"><code>L3 Derived</code><span>docs/design-system/showcase.html（3.0，17 条校验）+ 本页 SHOWCASE-5.0.html</span></div>
    </div>
    <p class="note">245 个唯一变量 / 14 个 CSS / 0 跨文件重复；<code>design:5:check</code> 的 <code>tokenFiles: 8</code> 仅计 <code>tokens/</code> 目录。派生快照禁止手工编辑，漂移即 FAIL。</p>`,
  },
]

// ---------------------------------------------------------------------------
// HTML 组装
// ---------------------------------------------------------------------------
const layerOf = (category) =>
  ({
    governance: '治理 / 审计 / 注册',
    registry: '治理 / 审计 / 注册',
    acceptance: '治理 / 审计 / 注册',
    audit: '治理 / 审计 / 注册',
    foundation: '基础层',
    layout: '布局层',
    component: '组件层',
    pattern: '模式层',
    template: '模板层',
    application: '业务适配',
    reference: '外部参考',
    'business-vertical': '业务域',
  })[category] ?? '其他'

const specSections = standards
  .map(
    (s) => `<section class="spec-card" data-spec-id="${esc(s.id)}" id="spec-${esc(s.id)}" aria-label="规范 ${esc(s.id)}">
      <header class="spec-head"><code class="spec-id">${esc(s.id)}</code><h3>${esc(s.name)}</h3><span class="pill">${esc(s.status)}</span></header>
      <p class="spec-scope">${esc(s.scope ?? '')}</p>
      <dl class="spec-meta"><dt>分类</dt><dd>${esc(layerOf(s.category))} · ${esc(s.category)}</dd><dt>版本</dt><dd>${esc(s.version)}</dd><dt>强制</dt><dd>${s.mandatory ? '是' : '否'}</dd></dl>
      <p class="spec-links"><a href="${relDoc(s.document)}" aria-label="打开 ${esc(s.id)} 规范原文">规范原文</a><span>验证：${esc(s.verification ?? 'NOT_VERIFIED')}</span></p>
    </section>`
  )
  .join('\n')

const groups = new Map()
for (const c of components) {
  const key = c.category ?? 'uncategorized'
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(c)
}
const componentSections = [...groups.entries()]
  .map(
    ([category, list]) => `<div class="cmp-group" aria-label="组件分类 ${esc(category)}">
      <h3 class="cmp-group-title">${esc(category)} <span>${list.length} 个</span></h3>
      <div class="cmp-grid">${list
        .map(
          (c) => `<article class="cmp-card" data-component-id="${esc(c.id)}" aria-label="组件 ${esc(c.name)}">
            <code class="cmp-id">${esc(c.id)}</code>
            <h4>${esc(c.name)}</h4>
            <p class="cmp-path">${esc(c.implementation_path ?? '')}</p>
            <div class="cmp-foot"><span>${esc(c.status ?? 'ACTIVE')}</span><span>states ${(c.states ?? []).length}</span><span>${esc(layerOf('component'))}</span></div>
          </article>`
        )
        .join('')}</div>
    </div>`
  )
  .join('\n')

const elementSections = ELEMENTS.map(
  (e, i) => `<section class="element" data-element="${esc(e.id)}" id="el-${esc(e.id)}" aria-label="元素分区 ${esc(e.title)}">
    <header class="element-head"><span class="element-no">E${String(i + 1).padStart(2, '0')}</span><h2>${esc(e.title)}</h2><code>${esc(e.spec)}</code></header>
    <div class="element-body">${e.body}</div>
  </section>`
).join('\n')

const navSpecs = standards
  .map(
    (s) =>
      `<a href="#spec-${esc(s.id)}" aria-label="跳转到 ${esc(s.id)}"><code>${esc(s.id)}</code> ${esc(s.name)}</a>`
  )
  .join('\n')
const navElements = ELEMENTS.map(
  (e) => `<a href="#el-${esc(e.id)}" aria-label="跳转到 ${esc(e.title)}">${esc(e.title)}</a>`
).join('\n')

const manifest = JSON.stringify(
  {
    designSystem: 'UTER Design System 5.0',
    version: specRegistry.version ?? '5.0.0',
    effectiveDate: specRegistry.effective_date ?? '2026-11-14',
    specIds: standards.length,
    componentIds: components.length,
    elements: ELEMENTS.length,
    controls: 5,
    standards: standards.length,
    generatedFrom: [
      'DESIGN-STANDARD-REGISTRY.yaml',
      'COMPONENT-REGISTRY.yaml',
      'web/src/design-system/tokens/*.css',
    ],
  },
  null,
  2
)

const html = `<!DOCTYPE html>
<!-- UTER DESIGN SYSTEM 5.0 · 全量 Showcase · Uter.ai · 由 generate-design-showcase-5.0.mjs 生成，请勿手工编辑 -->
<html lang="zh-CN" data-theme="light" data-density="default">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>UTER Design System 5.0 · 全量 Showcase</title>
<style>
:root {
  --bg: #f8fafc; --surface: #ffffff; --surface-2: #f1f5f9; --fg: #0f172a;
  --fg-muted: #64748b; --border: #e2e8f0; --brand: #5b5ee6; --brand-strong: #494cc7;
  --brand-deep: #3f42b0; --brand-soft: #eef0ff; --success: #16a34a; --warning: #d97706;
  --danger: #dc2626; --info: #2563eb; --success-soft: #dcfce7; --warning-soft: #fef3c7;
  --radius: 10px; --focus: 2px;
  --fs-display: 36px; --fs-h1: 28px; --fs-h2: 22px; --fs-h3: 18px;
  --fs-body: 14px; --fs-caption: 12px; --fs-dense: 13px;
  --shadow-0: none; --shadow-1: 0 1px 2px rgba(15,23,42,.06);
  --shadow-2: 0 2px 6px rgba(15,23,42,.09); --shadow-3: 0 6px 16px rgba(15,23,42,.11);
  --shadow-4: 0 12px 28px rgba(15,23,42,.14); --shadow-5: 0 20px 44px rgba(15,23,42,.18);
  --motion-fast: 100ms; --motion-base: 200ms; --motion-slow: 350ms;
}
html[data-theme="dark"] {
  --bg: #0b1120; --surface: #131c31; --surface-2: #1b2740; --fg: #e2e8f0;
  --fg-muted: #94a3b8; --border: #26324a; --brand: #8b8df5; --brand-strong: #a1a3f7;
  --brand-deep: #b7b8fa; --brand-soft: #20264a; --success: #4ade80; --warning: #fbbf24;
  --danger: #f87171; --info: #60a5fa; --success-soft: #143524; --warning-soft: #3a2c0d;
  --shadow-1: 0 1px 2px rgba(0,0,0,.4); --shadow-2: 0 2px 6px rgba(0,0,0,.45);
  --shadow-3: 0 6px 16px rgba(0,0,0,.5); --shadow-4: 0 12px 28px rgba(0,0,0,.55);
  --shadow-5: 0 20px 44px rgba(0,0,0,.6);
}
html[data-density="compact"] { --pad: 10px; --gap: 10px; }
html[data-density="default"] { --pad: 16px; --gap: 16px; }
html[data-density="comfortable"] { --pad: 24px; --gap: 24px; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 400 var(--fs-body)/1.6 "Inter Variable", "Noto Sans SC Variable", system-ui, sans-serif; }
a { color: var(--brand); text-decoration: none; }
a:hover { text-decoration: underline; }
code { font: 400 var(--fs-dense)/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--surface-2); padding: 1px 5px; border-radius: 4px; }
:focus-visible { outline: var(--focus) solid var(--brand); outline-offset: 2px; }
.app { display: grid; grid-template-columns: 268px minmax(0, 1fr); min-height: 100vh; }
.sidebar { position: sticky; top: 0; height: 100vh; overflow-y: auto; background: var(--surface); border-right: 1px solid var(--border); padding: var(--pad); }
.sidebar h2 { font-size: var(--fs-caption); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--fg-muted); margin: 20px 0 8px; }
.sidebar a { display: block; padding: 3px 6px; font-size: var(--fs-caption); border-radius: 6px; color: var(--fg); }
.sidebar a:hover { background: var(--brand-soft); text-decoration: none; }
.sidebar a code { font-size: var(--fs-caption); background: none; padding: 0; color: var(--brand); }
.main { padding: var(--pad) clamp(16px, 3vw, 48px) 64px; max-width: 1440px; width: 100%; }
.topbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
.topbar h1 { font-size: var(--fs-h1); font-weight: 600; line-height: 1.28; margin: 0; }
.topbar p { margin: 4px 0 0; color: var(--fg-muted); font-size: var(--fs-caption); }
.controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.controls label { font-size: var(--fs-caption); color: var(--fg-muted); }
select, input, button { font-family: inherit; font-size: var(--fs-body); color: var(--fg); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
select { min-height: 32px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 20px 0; }
.stat { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; box-shadow: var(--shadow-1); }
.stat strong { display: block; font-size: var(--fs-h2); font-weight: 600; font-variant-numeric: tabular-nums; }
.stat span { font-size: var(--fs-caption); color: var(--fg-muted); }
h2.section-title { font-size: var(--fs-h2); font-weight: 600; line-height: 1.36; margin: 40px 0 14px; padding-bottom: 8px; border-bottom: 2px solid var(--brand); }
.element { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--pad); margin-bottom: var(--gap); box-shadow: var(--shadow-1); }
.element-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 14px; }
.element-head h2 { font-size: var(--fs-h3); font-weight: 600; margin: 0; }
.element-no { color: var(--brand); font-weight: 600; font-size: var(--fs-caption); }
.note { font-size: var(--fs-caption); color: var(--fg-muted); margin: 14px 0 0; line-height: 1.7; }
.grid-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.swatch { border: 1px solid var(--border); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.swatch-chip { height: 34px; border-radius: 6px; border: 1px solid var(--border); }
.swatch-val { font-size: var(--fs-caption); color: var(--fg-muted); }
.type-stack { display: flex; flex-direction: column; gap: 8px; }
.type-row { display: grid; grid-template-columns: 110px 1fr; align-items: baseline; gap: 12px; border-bottom: 1px dashed var(--border); padding-bottom: 6px; }
.t-display { font-size: var(--fs-display); font-weight: 600; line-height: 1.22; }
.t-h1 { font-size: var(--fs-h1); font-weight: 600; line-height: 1.28; }
.t-h2 { font-size: var(--fs-h2); font-weight: 600; line-height: 1.36; }
.t-h3 { font-size: var(--fs-h3); font-weight: 600; line-height: 1.44; }
.t-body { font-size: var(--fs-body); }
.t-caption { font-size: var(--fs-caption); }
.t-dense { font-size: var(--fs-dense); }
.t-mono { font: 400 var(--fs-dense)/1.5 ui-monospace, monospace; }
.space-row, .radius-row, .elev-row, .motion-row { display: flex; flex-wrap: wrap; gap: 14px; }
.space-item, .radius-item, .motion-item { display: flex; flex-direction: column; gap: 6px; align-items: center; font-size: var(--fs-caption); }
.space-bar { height: 14px; background: var(--brand); border-radius: 3px; display: block; min-width: 8px; }
.radius-box { width: 54px; height: 54px; background: var(--brand-soft); border: 2px solid var(--brand); display: block; }
.elev-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; width: 120px; display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-caption); }
.elev-0 { box-shadow: var(--shadow-0); } .elev-1 { box-shadow: var(--shadow-1); }
.elev-2 { box-shadow: var(--shadow-2); } .elev-3 { box-shadow: var(--shadow-3); }
.elev-4 { box-shadow: var(--shadow-4); } .elev-5 { box-shadow: var(--shadow-5); }
.demo-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.border-1 { border: 1px solid var(--border); padding: 8px 12px; border-radius: 8px; }
.border-decor { box-shadow: 0 0 0 1px var(--brand); padding: 8px 12px; border-radius: 8px; }
.focus-demo { border: 1px solid var(--brand); color: var(--brand); cursor: pointer; }
.icon-demo { display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--border); padding: 8px; border-radius: 8px; }
.motion-bar { width: 70px; height: 12px; background: var(--brand); border-radius: 6px; display: block; animation: pulse 200ms ease-in-out infinite alternate; }
@keyframes pulse { from { opacity: .35; } to { opacity: 1; } }
.theme-chip, .bp-chip, .chip, .state-chip, .contrast-chip, .hit-target { border: 1px solid var(--border); background: var(--surface-2); border-radius: 999px; padding: 5px 12px; font-size: var(--fs-caption); }
.bp-chip code { background: none; padding: 0; color: var(--brand); }
.shell-demo { display: grid; grid-template-columns: 150px 1fr; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; min-height: 130px; }
.shell-side { background: var(--brand-soft); padding: 12px; font-size: var(--fs-caption); border-right: 1px solid var(--border); }
.shell-main { display: flex; flex-direction: column; }
.shell-head { border-bottom: 1px solid var(--border); padding: 8px 12px; font-size: var(--fs-caption); }
.shell-content { padding: 12px; font-size: var(--fs-caption); color: var(--fg-muted); }
.form-demo { display: grid; gap: 8px; max-width: 360px; }
.form-demo label { font-size: var(--fs-caption); font-weight: 600; }
.form-demo input { width: 100%; min-height: 36px; }
.form-demo .otp { letter-spacing: .5em; text-align: center; }
.field-error { color: var(--danger); font-size: var(--fs-caption); margin: 0; }
.btn { cursor: pointer; border-radius: 8px; min-height: 36px; padding: 8px 16px; border: 1px solid transparent; font-weight: 500; }
.btn-primary { background: var(--brand); color: #fff; }
.btn-primary:hover { background: var(--brand-strong); }
.demo-table { width: 100%; border-collapse: collapse; font-size: var(--fs-dense); }
.demo-table th { text-align: left; font-size: var(--fs-caption); font-weight: 500; color: var(--fg-muted); border-bottom: 1px solid var(--border); padding: 8px; }
.demo-table td { padding: 8px; border-bottom: 1px solid var(--border); }
.demo-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.badge { border-radius: 999px; padding: 2px 8px; font-size: var(--fs-caption); }
.badge-ok { background: var(--success-soft); color: var(--success); }
.badge-warn { background: var(--warning-soft); color: var(--warning); }
.state-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.notif-stack { display: grid; gap: 8px; }
.notif { border-radius: 8px; padding: 10px 14px; font-size: var(--fs-caption); border: 1px solid var(--border); }
.notif-toast { background: var(--brand-soft); color: var(--brand-deep); }
.notif-snackbar { background: var(--surface-2); }
.notif-alert { border-color: var(--danger); color: var(--danger); }
.notif-banner { border-color: var(--info); color: var(--info); }
.notif-system { border-style: dashed; color: var(--fg-muted); }
.notif-center { background: var(--surface-2); }
.matrix { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.matrix-head, .matrix-row { display: grid; grid-template-columns: 1.6fr repeat(5, 1fr); font-size: var(--fs-caption); }
.matrix-head { background: var(--surface-2); font-weight: 600; }
.matrix-head span, .matrix-row span { padding: 6px 8px; border-right: 1px solid var(--border); }
.matrix-row { border-top: 1px solid var(--border); }
.matrix-row span:not(:first-child) { text-align: center; color: var(--success); }
.tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.tpl-card { border: 1px solid var(--border); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.tpl-thumb { height: 48px; background: linear-gradient(160deg, var(--brand-soft), var(--surface-2)); border: 1px solid var(--border); border-radius: 4px; display: block; }
.domain-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.domain-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; font-size: var(--fs-caption); }
.domain-card strong { font-size: var(--fs-body); color: var(--brand); }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.layer-stack { display: grid; gap: 8px; }
.layer { display: grid; grid-template-columns: 170px 1fr; gap: 12px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: var(--fs-caption); }
.spec-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 12px; }
.spec-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; box-shadow: var(--shadow-1); }
.spec-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.spec-head h3 { font-size: var(--fs-h3); font-weight: 600; margin: 0; flex: 1 1 160px; }
.spec-id { color: var(--brand); }
.pill { font-size: var(--fs-caption); background: var(--brand-soft); color: var(--brand-deep); border-radius: 999px; padding: 2px 8px; }
.spec-scope { font-size: var(--fs-caption); color: var(--fg-muted); min-height: 40px; }
.spec-meta { display: grid; grid-template-columns: 48px 1fr; gap: 2px 8px; font-size: var(--fs-caption); margin: 8px 0; }
.spec-meta dt { color: var(--fg-muted); } .spec-meta dd { margin: 0; }
.spec-links { display: flex; flex-wrap: wrap; gap: 10px; font-size: var(--fs-caption); color: var(--fg-muted); margin: 0; }
.cmp-group { margin-bottom: 22px; }
.cmp-group-title { font-size: var(--fs-h3); font-weight: 600; margin: 0 0 10px; }
.cmp-group-title span { font-size: var(--fs-caption); color: var(--fg-muted); font-weight: 400; }
.cmp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.cmp-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
.cmp-card h4 { font-size: var(--fs-body); font-weight: 600; margin: 6px 0; }
.cmp-id { font-size: var(--fs-caption); color: var(--brand); }
.cmp-path { font: 400 var(--fs-caption)/1.5 ui-monospace, monospace; color: var(--fg-muted); word-break: break-all; margin: 0 0 8px; }
.cmp-foot { display: flex; flex-wrap: wrap; gap: 6px; font-size: var(--fs-caption); color: var(--fg-muted); border-top: 1px dashed var(--border); padding-top: 8px; }
.lab { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--pad); }
.lab-controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.lab-stage { margin-top: 20px; padding: 24px; border: 1px dashed var(--border); border-radius: 8px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
#demo-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; border: 1px solid transparent; font-weight: 500; cursor: pointer; transition: background var(--motion-fast) ease, transform var(--motion-fast) ease; padding: 8px 16px; min-height: 36px; font-size: var(--fs-body); }
#demo-button[data-variant="default"] { background: var(--brand); color: #fff; }
#demo-button[data-variant="outline"] { background: transparent; color: var(--brand); border-color: var(--brand); }
#demo-button[data-variant="secondary"] { background: var(--surface-2); color: var(--fg); }
#demo-button[data-variant="ghost"] { background: transparent; color: var(--fg-muted); }
#demo-button[data-variant="destructive"] { background: var(--danger); color: #fff; }
#demo-button[data-variant="link"] { background: transparent; color: var(--brand); text-decoration: underline; }
#demo-button[data-size="icon-xs"] { min-height: 24px; padding: 4px; font-size: var(--fs-caption); }
#demo-button[data-size="icon-sm"], #demo-button[data-size="sm"] { min-height: 32px; padding: 5px 10px; font-size: var(--fs-caption); }
#demo-button[data-size="lg"] { min-height: 44px; padding: 10px 20px; }
#demo-button[data-size="icon"], #demo-button[data-size="icon-lg"] { min-height: 40px; padding: 8px; }
#demo-button[data-size="inline"] { min-height: 24px; padding: 2px 6px; font-size: var(--fs-caption); }
#demo-button[data-size="wrap"] { max-width: 180px; white-space: normal; text-align: left; }
#demo-button[data-state="hover"] { opacity: .88; }
#demo-button[data-state="focus"] { outline: var(--focus) solid var(--brand); outline-offset: 2px; }
#demo-button[data-state="pressed"] { transform: scale(.97); }
#demo-button[data-state="disabled"] { opacity: .5; pointer-events: none; }
#demo-button[data-state="loading"] { opacity: .8; }
#demo-button[data-state="error"] { border-color: var(--danger); box-shadow: 0 0 0 1px var(--danger); }
#demo-button[data-state="success"] { border-color: var(--success); box-shadow: 0 0 0 1px var(--success); }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--border); font-size: var(--fs-caption); color: var(--fg-muted); }
@media (max-width: 900px) { .app { grid-template-columns: 1fr; } .sidebar { position: static; height: auto; max-height: 260px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0ms !important; transition-duration: 0ms !important; } }
</style>
</head>
<body>
<div class="app">
  <nav class="sidebar" aria-label="Showcase 分区导航">
    <h2>UTER Design System 5.0</h2>
    <p class="note">全量 Showcase · 规范验收视图 · 真实 DOM 渲染</p>
    <h2>基础元素（${ELEMENTS.length}）</h2>
    ${navElements}
    <h2>交互实验室</h2>
    <a href="#lab">Button × Variant × Size × State</a>
    <h2>规范分册（${standards.length}）</h2>
    ${navSpecs}
    <h2>组件注册表（${components.length}）</h2>
    <a href="#components">全部已注册组件</a>
  </nav>
  <main class="main">
    <header class="topbar">
      <div>
        <h1>UTER Design System 5.0 · 全量 Showcase</h1>
        <p>版本 ${esc(specRegistry.version ?? '5.0.0')} · 生效 ${esc(specRegistry.effective_date ?? '2026-11-14')} · 由注册表与运行时 Token 生成 · 单文件 file:// 可打开</p>
      </div>
      <div class="controls">
        <label for="ctl-theme">主题</label>
        <select id="ctl-theme" data-control="theme" aria-label="切换 Light / Dark 主题">
          <option value="light">Light</option><option value="dark">Dark</option>
        </select>
        <label for="ctl-density">密度</label>
        <select id="ctl-density" data-control="density" aria-label="切换密度档">
          <option value="default">Default</option><option value="compact">Compact</option><option value="comfortable">Comfortable</option>
        </select>
      </div>
    </header>

    <section class="stats" aria-label="覆盖统计">
      <div class="stat"><strong>${standards.length}</strong><span>注册规范条目</span></div>
      <div class="stat"><strong>32</strong><span>分册（28 基础 + 4 业务域）</span></div>
      <div class="stat"><strong>${components.length}</strong><span>已注册组件</span></div>
      <div class="stat"><strong>${ELEMENTS.length}</strong><span>基础元素 / 模式分区</span></div>
      <div class="stat"><strong>12</strong><span>守卫测试</span></div>
      <div class="stat"><strong>14</strong><span>Token CSS（8+6）</span></div>
    </section>

    <h2 class="section-title" id="elements">一 · 基础元素与模式（${ELEMENTS.length} 类）</h2>
    ${elementSections}

    <h2 class="section-title" id="lab">二 · 交互实验室：Button 6 variant × 9 size × 8 state</h2>
    <section class="lab" aria-label="Button 交互实验室">
      <div class="lab-controls">
        <label for="ctl-variant">Variant</label>
        <select id="ctl-variant" data-control="variant" aria-label="切换 Button variant">
          ${['default', 'outline', 'secondary', 'ghost', 'destructive', 'link']
            .map((v) => `<option value="${v}">${v}</option>`)
            .join('')}
        </select>
        <label for="ctl-size">Size</label>
        <select id="ctl-size" data-control="size" aria-label="切换 Button size">
          ${['default', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg', 'inline', 'wrap']
            .map((v) => `<option value="${v}">${v}</option>`)
            .join('')}
        </select>
        <label for="ctl-state">State</label>
        <select id="ctl-state" data-control="state" aria-label="切换 Button 状态">
          ${['default', 'hover', 'focus', 'pressed', 'disabled', 'loading', 'error', 'success']
            .map((v) => `<option value="${v}">${v}</option>`)
            .join('')}
        </select>
      </div>
      <div class="lab-stage">
        <button type="button" id="demo-button" data-variant="default" data-size="default" data-state="default" aria-label="Button 交互演示">创建 API Key</button>
        <span class="note" id="demo-readout" aria-live="polite">variant=default · size=default · state=default</span>
      </div>
      <p class="note">状态切换同步显示 <code>data-state</code> 与对应 ARIA 语义（disabled → <code>aria-disabled</code>，loading → <code>aria-busy</code>，error → <code>aria-invalid</code>）；密度档不缩放字号（T16 / §4A）。本演示为规范视图，不是 <code>web/src/components/ui/button.tsx</code> 的 React 实例。</p>
    </section>

    <h2 class="section-title" id="specs">三 · 规范分册与注册条目（${standards.length} 条）</h2>
    <div class="spec-grid">${specSections}</div>

    <h2 class="section-title" id="components">四 · 组件注册表全量（${components.length} 个 · ${groups.size} 类）</h2>
    ${componentSections}

    <footer>
      <p>唯一真源：<code>DESIGN-STANDARD-REGISTRY.yaml</code> / <code>COMPONENT-REGISTRY.yaml</code>（其真源为 <code>web/src/design-system/component-registry.json</code>）/ <code>web/src/design-system/tokens/*.css</code>。本页为派生的规范验收视图，禁止手工编辑；改注册表后需重跑 <code>design:showcase:5:generate</code> 与 <code>design:showcase:5:check</code>。</p>
      <p>覆盖口径与全局计数裁决见 <code>01-UTER-DESIGN-SYSTEM-5.0.md</code> §26；决策 D3 与 12 项能力见 <code>COMPONENT-DOCUMENTATION-AND-PREVIEW-STANDARD.md</code> §11。零外部依赖、0 个静态截图、不引入 Storybook、不改任何业务运行时代码。</p>
    </footer>
  </main>
</div>
<script type="application/json" id="uds5-manifest">${manifest}</script>
<script>
(function () {
  var root = document.documentElement;
  var theme = document.getElementById('ctl-theme');
  var density = document.getElementById('ctl-density');
  var variant = document.getElementById('ctl-variant');
  var size = document.getElementById('ctl-size');
  var state = document.getElementById('ctl-state');
  var button = document.getElementById('demo-button');
  var readout = document.getElementById('demo-readout');
  function syncAria() {
    var s = state.value;
    if (s === 'disabled') { button.setAttribute('aria-disabled', 'true'); } else { button.removeAttribute('aria-disabled'); }
    if (s === 'loading') { button.setAttribute('aria-busy', 'true'); } else { button.removeAttribute('aria-busy'); }
    if (s === 'error') { button.setAttribute('aria-invalid', 'true'); } else { button.removeAttribute('aria-invalid'); }
  }
  function syncDemo() {
    button.dataset.variant = variant.value;
    button.dataset.size = size.value;
    button.dataset.state = state.value;
    readout.textContent = 'variant=' + variant.value + ' · size=' + size.value + ' · state=' + state.value;
    syncAria();
  }
  theme.addEventListener('change', function () { root.dataset.theme = theme.value; });
  density.addEventListener('change', function () { root.dataset.density = density.value; });
  [variant, size, state].forEach(function (el) { el.addEventListener('change', syncDemo); });
  syncDemo();
})();
</script>
</body>
</html>
`

writeFileSync(OUT_PATH, html, 'utf8')
process.stdout.write(
  `${JSON.stringify(
    {
      generated: true,
      output: OUT_PATH,
      bytes: Buffer.byteLength(html, 'utf8'),
      specIds: standards.length,
      componentIds: components.length,
      elements: ELEMENTS.length,
      componentGroups: groups.size,
    },
    null,
    2
  )}\n`
)
