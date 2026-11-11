# UTER 设计规范全量复审 · 第三轮

**日期**：2026-11-11
**审计对象**：`web/src`（1269 个文件，`src/docs-content` 语料与 `__tests__` 不计入 UI 判定）
**规范基准**：`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（本轮同步修订 8 章）
**机器门禁**：`web/scripts/check-design-tokens.mjs`（T1–T17）

---

## 1. 结论

| 维度 | 结果 |
|---|---|
| 机器门禁 T1–T17 | **0 违规**（1269 文件全扫） |
| 前两轮 24 项例外（E-01 ~ E-24） | **19 项已闭合**，5 项转为「已登记例外」 |
| 本轮新发现 | **7 项**（4 项真实违规已修，1 项破损类已修，2 项登记） |
| 前端全量测试 | 286 文件 / **3032 用例全绿** |
| 类型检查 | `tsgo -b` exit 0 |
| i18n 键检查 | 7308 静态键 + 701 登记键，7 语言包全存在 |
| 格式检查 | 1648 文件全过 |
| 浏览器实测 | 文档页 / 关于页三栏结构、双侧选中态、窄屏折叠均实测通过，控制台 0 error |

**总体判定：符合规范。** 剩余 5 项为**已登记且写明理由**的例外（不是未修），2 项运行时验证项未执行（见 §7）。

---

## 2. 方法与覆盖面

1. **机器门禁**：T1 字号阶梯 / T2 任意字号 / T3 任意行高 / T4 内联字号 / T5 CSS 硬编码字号 / T6 非浮层投影 / T7 调色板直用 / T8 裸色值 / T9 行高覆盖 / T10 任意圆角 / T11 未登记动效 / T12 字距 / T13–T15 透明度凑层级 / T16 低于最小字号 / **T17 任意间距（本轮新增）**。
2. **规则族静态扫描**：按 A 排版 / B 色彩 / C 尺寸 / D 组件 / E 响应式 / F 动效 / G 无障碍 七族逐条 grep，人工判定「真违规 / 规范冲突 / 规范缺项 / 已登记」。
3. **浏览器实测**：Playwright 在 `http://localhost:3001` 实测文档页与关于页的三栏结构、滚动联动选中态、窄屏折叠、控制台错误。

---

## 3. 逐族结果

### A · 排版

| ID | 条文 | 结果 |
|---|---|---|
| A1 | 字号只用十档阶梯 | ✅ 门禁 T2/T5/T16 零违规 |
| A2 | 行高由字号 Token 自带 | ✅ 门禁 T3/T9 零违规 |
| A3 | 16/600 作标题时只能当 `group-title` | ✅ 9 处全部落在允许场景（4 数值 + 2 字段标签 + 1 Markdown + 1 浮动窗口标题 + 1 参数标签） |
| A4 | 列表行标题用 16/500 | ✅ 已全部改为 `text-base font-medium` |
| A5 | 说明性 `<p>` ≥14px | ✅ 20 处已提 `text-sm`，`<p …text-xs>` 归零 |
| A6 | 标题必须由 `Heading` 输出 | ✅ 修复 2 处（用户指南索引、法务文档）；仅剩 Markdown 渲染器（E14 例外） |
| A7 | 禁止 `tracking-*` | ✅ 门禁 T12 零违规 |

**规范示例**

```tsx
// ✅ 分组标题：16/600 + Heading 语义
<Heading variant='group-title' level={4}>通知方式</Heading>

// ✅ 列表行标题：16/500
<p className='text-base font-medium'>{name}</p>

// ❌ 用 p 拼出分组标题的视觉（视觉对、语义错）
<p className='text-base font-semibold'>通知方式</p>
```

**uter 真实案例（本轮修复）**：`features/docs/native/user-guide-index.tsx` 与 `features/legal/legal-document.tsx` 的页面标题此前是裸 `<h1 className='text-2xl font-semibold'>`，绕过 `Heading`；已改为 `<Heading variant='section-title' level={1}>`。

### B · 色彩

| ID | 条文 | 结果 |
|---|---|---|
| B1 | 禁止裸色值 | ✅ 门禁 T8 零违规（Token 定义处 184 处不计） |
| B2 | 禁止调色板直用 | ✅ 门禁 T7 零违规 |
| B3 | 禁止透明度凑层级/悬停/浅底 | ✅ 门禁 T13–T15 零违规 |
| B4 | 禁止手写 `white` / `black` | ✅ 仅剩 5 处 SVG 描边（主题色色块对勾），E-13 已登记的例外 |
| B5 | 三级色只用于允许清单 | ✅ 20 处：页脚 12 + 搜索栏 2 + 营销首屏微文案 3 + 流程图连接图标 3 |
| B6 | `chart-N` 只表达分类，不表达成败 | ✅ 无「用图表色表示成功/失败」的写法 |

**规范示例**

```tsx
// ✅ 遮罩层走 Token，浓淡用透明度修饰表达
<div className='bg-surface-overlay/10' />

// ✅ 纯白表面（二维码底、滑块手柄）走专用 Token
<div className='bg-surface-pure' />

// ❌ 手写白底
<div className='bg-white' />
```

**uter 真实案例（本轮修复）**：`features/pricing/index.tsx` 的页面副标题、`playground-chat.tsx` 的「已隐藏 N 条消息」提示此前用 `text-tertiary-foreground` 当说明文字，已改回 `text-muted-foreground`。

### C · 尺寸与间距

| ID | 条文 | 结果 |
|---|---|---|
| C1 | 禁止任意间距 `p-[3px]` | ✅ 门禁 **T17（本轮新增）** 零违规 |
| C2 | 禁止任意圆角 `rounded-[…]` | ✅ 门禁 T10 零违规（`rounded-[inherit]`、`rounded-[var(--…)]` 放行） |
| C3 | 图标只用 `size-4` / `size-3.5` 等标准档 | ✅ `size-[…]` 归零 |
| C4 | 描边 1px | ✅ 仅剩 2 处非界面描边（营销装饰 `border-2`、loading 圆环 `border-2`） |
| C5 | 焦点环 1px 贴边 | ✅ 全站 `ring-1`，无 `ring-2` / `ring-[3px]` |

**规范示例**

```tsx
// ✅ 就近取标准档
<div className='p-1 gap-0.5' />

// ❌ 自造档位
<div className='p-[3px] gap-[2px]' />
```

**uter 真实案例（本轮修复）**：`components/ui/input-group.tsx` 的内联按钮负边距 `ml-[-0.3rem]` / `ml-[-0.15rem]` 收敛为 `-ml-1` / `-ml-0.5`（视觉差 ≤0.8px）。

### D · 组件

| ID | 条文 | 结果 |
|---|---|---|
| D1 | 加载态用 `loading` 属性，不改变尺寸 | ✅ `Button` 已提供 `loading`（保留文字 + spinner 前置 + 自动 disabled + `aria-busy`），`button-loading.test.tsx` 覆盖 |
| D2 | 图标按钮必须有可访问名称 | ✅ `combobox` 的 `ChipRemove` 已补 `aria-label` |
| D3 | 六态齐全（含 loading） | ✅ 见 D1 |

**规范示例**

```tsx
// ✅ 文字保留在 DOM 里，宽度不塌缩
<Button loading>保存</Button>

// ❌ 用 spinner 替换文字，工具栏抖动
<Button disabled>{loading ? <Spinner /> : '保存'}</Button>
```

### E · 响应式

| ID | 条文 | 结果 |
|---|---|---|
| E1 | 指标数值用 `md:` 不用 `sm:` | ✅ `sm:text-3xl` 归零 |
| E2 | 后台内容区 1280px；营销页按登记值 | ✅ 两个超宽点已收（定价页、模型选择弹窗 → 1280） |
| E3 | 三栏页窄屏折叠而非删导航 | ✅ 右目录折进 `<details>`（`xl` 以下），左导航 `lg` 以下隐藏 |

### F · 动效

| ID | 条文 | 结果 |
|---|---|---|
| F1 | 时长只用 Token 档位 | ✅ 裸 `duration-150/300/500` 归零；仅剩 `duration-100` / `duration-200`（与 Token 同值）与 `animate-in` 配套用法 |
| F2 | 缓动只用三档 Token | ✅ 裸 `ease-in/out/linear` 归零（`linear` 只用于无限循环位移） |

**规范示例**

```css
/* ✅ Token 引用 */
transition: opacity var(--ds-motion-base) var(--ds-motion-ease);

/* ❌ 自造节奏 */
transition: opacity 300ms ease-in-out;
```

**uter 真实案例（本轮修复）**：`CustomerServiceWidget.css` 的 `0.18s ease-out`、`index.css` 的骨架屏与终端脉冲 `ease-in-out` 全部改为 Token 引用。

### G · 无障碍

| ID | 条文 | 结果 |
|---|---|---|
| G1 | 焦点环 1px、贴边、不被裁切 | ✅ 静态确认；键盘全链路**未实测**（见 §7） |
| G2 | 图标按钮有可访问名称 | ✅ 见 D2 |
| G3 | 对比度 ≥4.5:1 / 3:1 | ⚠️ **未实测**（需运行时取 computed color） |

---

## 4. 前两轮例外的最终处置

| 编号 | 内容 | 处置 |
|---|---|---|
| E-08 | 16/600 语义标签不统一 | ✅ 10 处分组标题改 `Heading`，4 处列表行标题改 500 |
| E-09 | 说明性 `<p>` 12px | ✅ 20 处提 14px，规范补 caption 边界 |
| E-10 | 状态色硬编码 8 处 | ✅ canvas 改 Token 表达式 + `color-mix()` 派生 |
| E-11 | `bg-chart-N` 当背景 | ✅ 规范新增「分类可用、成败不可用」判据 |
| E-12 | 三级色残留 | ✅ 5 处禁用态改 `disabled:` Token，2 处说明文字改二级色 |
| E-13 | 手写 `white`/`black` 23 处 | ✅ 新增 `surface-overlay` / `surface-pure`，7 处 DOM 迁移；SVG 描边与营销终端登记 |
| E-14 | 任意间距 4 处 | ✅ 全部改标准档，**新增门禁 T17 防回归** |
| E-15 | 任意圆角 2 处 | ✅ `rounded-[0.6rem]` → `rounded-lg`；tooltip 箭头保留并注明理由 |
| E-16 | 描边非 1px 3 处 | ✅ 营销装饰与 loading 圆环登记（非界面描边） |
| E-17 | 焦点环非 2px 7 处 | ✅ **规范改为 1px 贴边**，实现已全站统一，原「改 2px」的建议作废 |
| E-18 | 图标任意尺寸 6 处 | ✅ `size-[1.2rem]` → `size-5`，`size-[18px]` → 标准档 |
| E-19 | Button 无 `loading` | ✅ 已加，含测试 |
| E-20 | 图标按钮缺名称 1 处 | ✅ 已补 `aria-label` |
| E-21 | 指标数值 `sm:` 4 处 | ✅ 改 `md:`，规范写明理由 |
| E-22 | 内容区超宽 3 处 | ✅ 两处收窄，营销页按登记值 |
| E-23 | 动效 44 处 | ✅ 后台统一 Token，营销面显式引用 `ds-motion-marketing-*` |
| E-24 | 对比度实测 | ⚠️ **未执行**，见 §7 |

---

## 5. 本轮新发现（7 项）

| # | 位置 | 问题 | 处置 |
|---|---|---|---|
| 1 | `components/ui/input-group.tsx` | `ml-[-0.3rem]` / `mr-[-0.15rem]` 任意负间距 | ✅ 收敛为 `-ml-1` / `-ml-0.5` |
| 2 | `features/pricing/index.tsx` | 页面副标题误用三级色 | ✅ 改 `text-muted-foreground` |
| 3 | `features/playground/.../playground-chat.tsx` | 提示文字误用三级色 | ✅ 改 `text-muted-foreground` |
| 4 | `features/docs/native/user-guide-index.tsx` | 页面标题绕过 `Heading` | ✅ 改 `Heading` |
| 5 | `features/legal/legal-document.tsx` | 页面标题绕过 `Heading` | ✅ 改 `Heading` |
| 6 | `features/channels/.../advanced-custom-editor-dialog.tsx:1400` | `max-w-fullg:max-w-[420px]` —— `fullg` 变体不存在，**整条 max-width 失效** | ✅ 改为 `max-w-full lg:max-w-[420px]` |
| 7 | 门禁本身 | 任意间距无机器检查（E-14 只能靠人眼） | ✅ 新增 T17，放行 `var()` / `calc()` / `env()` |

第 6 项不是「不符合规范」，是**真的坏了**：`max-w-fullg:` 被 Tailwind 当作未知变体丢弃，那个 Select 在宽屏上会一直拉伸。

---

## 6. 例外清单（已登记，无需再动）

| 例外 | 处数 | 理由 |
|---|---|---|
| Markdown 正文标题自成一套 | 2 | E14；MDX 内容语料无法逐篇改 `Heading` |
| 营销装饰描边 `border-2` | 1 | 首屏图标环，非界面描边 |
| Loading 圆环 `border-2` | 1 | spinner 几何，不是容器描边 |
| 主题色色块 SVG `stroke-white` | 5 | 色块上的对勾，不是界面表面 |
| 浮动窗口标题条 16/600 | 1 | 可拖拽面板的标题，与 `group-title` 同档，用 `span` 因其不在文档大纲内 |
| 图表 canvas 字号/颜色 | 若干 | 已登记在 `check-design-tokens.mjs` 的 ALLOWLIST |
| 客服挂件内联样式 | 若干 | 第三方挂件，改不动 |
| 页脚/版权/搜索栏/分页省略号/营销微文案/流程图图标 | 20 | 见规范 §2.4「三级文字允许清单」 |

---

## 7. 未执行项（如实标注）

| 项目 | 状态 | 原因 |
|---|---|---|
| WCAG 对比度实测（C5 / G3） | **未执行** | 需运行时取 computed color 并计算比值；本轮只做了静态确认 |
| 键盘 Tab 全链路遍历 | **未执行** | 需真实浏览器逐次 Tab，静态扫描无法覆盖焦点顺序 |
| 屏幕阅读器可访问名称审计 | **部分** | 仅静态判断 `aria-label` / `sr-only` 存在性，未用真实读屏验证 |
| 5 套主题预设 × 3 档密度 × 圆角档交叉验证 | **未执行** | 静态扫描不覆盖运行时属性切换 |
| 深色主题全量走查 | **部分** | 只实测了文档页与关于页两处 |

---

## 8. 复现

```bash
cd web

# 门禁 T1–T17
node scripts/check-design-tokens.mjs --strict

# 设计系统 + UI 组件测试
bun run test -- src/design-system src/components/ui

# 全量测试
bun run test

# 类型 / i18n / 格式
bun run typecheck
node scripts/check-i18n-keys.mjs
bun run format:check

# 三栏布局实测（需本地 dev server）
# /docs/zh/guide/wiki/user-guide/auth   → 左树 + 正文 + 右目录，双侧选中态
# /about/                                → 章节导航 + 正文 + 大纲，双侧选中态
```
