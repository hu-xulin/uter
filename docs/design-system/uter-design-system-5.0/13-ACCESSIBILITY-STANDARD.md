# 13 · 无障碍规范（Accessibility Standard）

> UTER Design System 5.0 · 分册 S13。本规范定义 WCAG 2.2 AA 目标下的逐条可执行判定，并登记现有证据与未闭合缺陷。**硬红线：保留 E24 两处对比度待修与 E28 例外登记，禁止勾选通过、禁止宣称平台已验收**。**5.0 为当前唯一正式体系，3.0 保留为历史**，本文引用 3.0 §15 / §22 / §26、BASELINE-AUDIT 仅用于溯源与证据定位。除标明已核实的真源代码位置外，未宣称任何测试通过或平台验收。

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S13` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01`（UTER Design System 5.0 总纲） |
| 生效日期 | `2026-11-14` |
| 适用范围 | `web/` 全部组件 / 路由 / 浮层、`foundations/accessibility.css`、`showcase.html` 第 21 区（Focus）；PC Web / H5 一致适用，三原生平台见 `UDS5-S12` |
| 验证状态 | `NOT_VERIFIED` |

---

## 1. 总则

| 编号 | 原则 | 说明 |
|---|---|---|
| A-1 | 内建而非补丁 | 可访问性内建于组件（Clerk 参考分析 2.21「可访问性内建」），不做后置视觉修补。 |
| A-2 | 目标明确 | **现状 WCAG 2.1 AA，5.0 目标 WCAG 2.2 AA**（统一约定）；AAA 条款不得误称为 AA 要求。 |
| A-3 | 逐条可判定 | 每条要求给「可执行判定 + 现有证据 + 验证状态」三元组，禁止空泛承诺。 |
| A-4 | 不勾选通过 | 3.0 §22 有 73 个 `- [ ]`、0 个 `- [x]`（BASELINE-AUDIT §3.1）；5.0 **不得继承「已完成」、不得勾选通过**。 |
| A-5 | 缺陷保持待修 | E24 编号虽注销但缺陷须保持待修；E28 保留登记并明写例外边界。 |
| A-6 | 设计值以代码为准 | 24px 最小 / 44px 推荐命中区、**2px 焦点环**（`--ds-focus-ring-width: 2px`）、对比度阈值按运行真值继承；「1px `ring-1`」是已作废的过时记忆，不作为 5.0 基线。 |
| A-7 | 例外可枚举 | 验收口径例外（E28）不进 `ALLOWLIST`；静态扫描例外仍为 0 条。 |

---

## 2. WCAG 目标与现状口径

| 项 | 内容 |
|---|---|
| 现状 | WCAG **2.1 AA**（统一约定） |
| 5.0 目标 | WCAG **2.2 AA** |
| 3.0 参照 | 3.0 §15.2 已按 WCAG 2.2 AA 写阈值、§15.3 引 2.5.8、§15.1 引 1.4.11 / 2.4.13；5.0 以「目标态 + 现状差异」登记，不宣称已达 2.2 AA |
| 易错点 | **Focus Appearance（2.4.13）属 AAA，不得误称为 AA 要求**（3.0 §15.1:2198） |
| 对比度阈值 | 见 §3.7 |

---

## 3. 逐条规范（判定 / 证据 / 状态）

### 3.1 Keyboard（键盘可操作）

| 项 | 内容 |
|---|---|
| 可执行判定 | 所有交互控件可 `Tab` / `Shift+Tab` 到达并可 `Enter` / `Space` 激活；下拉 / 弹窗 / Tabs 支持方向键；无键盘陷阱。 |
| 现有证据 | 3.0 §15.4「键盘可操作」；`accessibility.test.ts`（10 守卫之一）；`test:axe` 2 个 spec（`web/e2e/axe/`） |
| 验证状态 | `NOT_VERIFIED`（`test:axe` 刻意不接 CI，BASELINE-AUDIT §7；本轮 `NOT_EXECUTED`） |

### 3.2 Focus Management（焦点管理）

| 项 | 内容 |
|---|---|
| 可执行判定 | 弹窗打开后焦点移入并陷于其中；关闭后焦点返回触发元素；路由切换后焦点落到合理位置；焦点不被 Sticky Header / 浮层覆盖（Focus Not Obscured Minimum，3.0 §15.4）。 |
| 现有证据 | 3.0 §15.4「弹窗打开后正确管理焦点 / 关闭后焦点返回合理位置」；`ui/dialog.tsx` / `alert-dialog.tsx` 基于 Base UI；`test:axe` |
| 验证状态 | `NOT_VERIFIED`（未逐弹层复核焦点陷阱测试用例） |

### 3.3 Focus Visible（焦点可见）

| 项 | 内容 |
|---|---|
| 可执行判定 | 使用 `:focus-visible`；焦点状态清晰；Light / Dark 分别验收；不被父容器圆角裁切、不被浮层覆盖；无替代方案不得删除默认焦点。 |
| 5.0 登记口径 | 焦点环 **2px `ring-2`**（`web/src/design-system/tokens/semantic.css:123` 的 `--ds-focus-ring-width: 2px`）；装饰性 `ring-1` 描边为 1px 但**不承载焦点语义**（3.0 §15.1 分类）。 |
| 口径裁决 | 用户指令 PART 0 原则 A 只规定「边框 1px」，未规定焦点环宽度；「1px `ring-1`」来自项目一份已过时的长期记忆，已被 2026-11-13 的代码变更推翻。按 `AGENTS.md`「设计值来自代码」原则，5.0 采用运行时真值 2px，详见 §7。 |
| 对比度 | 焦点指示器按 WCAG 2.2 AA **1.4.11 非文本对比度 3:1** 验收（3.0 §15.1:2196）。 |
| 现有证据 | `semantic.css:123-124`（`--ds-focus-ring-width` / `--ds-focus-ring-color: var(--ring)`）；`foundations/accessibility.css`（据 CLERK 参考分析 2.21） |
| 验证状态 | `NOT_VERIFIED` |

### 3.4 Screen Reader（屏幕阅读器）

| 项 | 内容 |
|---|---|
| 可执行判定 | 屏幕阅读器可识别所有控件与状态；图标按钮有可访问名称；纯装饰图标 `aria-hidden="true"`；非文本状态有文字或图标辅助（3.0 §15.4）。 |
| 现有证据 | `accessibility.test.ts`；`spec-guards.test.ts`（图标几何，S08 §10）；`test:axe` 2 spec |
| 验证状态 | `NOT_VERIFIED` |

### 3.5 Semantic HTML（语义化）

| 项 | 内容 |
|---|---|
| 可执行判定 | 使用原生语义元素（`main` / `nav` / `header` / `footer` / `button` / `label`）；一个页面一个 `<main>`；标题层级连续；不以 `<div onClick>` 代替按钮。 |
| 现有证据 | `components/layout/components/main.tsx`（S11）；`__root.tsx` 的 `<Outlet />`；`test:axe` |
| 验证状态 | `NOT_VERIFIED`（未在 73 路由上逐页核对标题层级） |

### 3.6 ARIA

| 项 | 内容 |
|---|---|
| 可执行判定 | `aria-expanded` / `aria-selected` 与视觉状态一致（Clerk 参考分析 2.12）；`aria-invalid` 用于错误态；Tooltip 不得成为唯一信息来源（3.0 §15.4）；不滥用 `role`。 |
| 现有证据 | `ui/dropdown-menu.tsx` / `select.tsx` / `combobox.tsx` / `menubar.tsx`；`test:axe` |
| 验证状态 | `NOT_VERIFIED` |

### 3.7 Color Contrast（颜色对比度）

| 内容 | 最低对比度（3.0 §15.2） |
|---|---:|
| 普通文字 | 4.5:1 |
| 大号文字 | 3:1 |
| 必要 UI 组件边界 | 3:1 |
| 必要图形对象 | 3:1 |

| 项 | 内容 |
|---|---|
| 大号文字定义 | 至少 24px 常规字重，或约 18.67px 粗体（3.0 §15.2:2211） |
| 计算要求 | 必须考虑实际背景、Alpha 透明度、颜色叠加、Hover / Active / Disabled、Light / Dark、最终渲染颜色；**不能仅比较两个 Token 的 HEX 字符串就认定通过**（3.0 §15.2:2215-2224） |
| 现有证据 | `verify-contrast.mjs`（`verify:contrast`）：BASELINE-AUDIT §4.4 记录曾 **31 PASS / 0 FAIL**（含 E28 渐变锚定与负例拒绝）；`status-badge-contrast.test.ts`（10 守卫之一）；`elevation-motion.test.ts` |
| 待修缺陷 | **E24 两处对比度不达标，见 §5** |
| 验证状态 | `NOT_VERIFIED`（审计曾 31 PASS 属历史快照，本轮未执行，不继承为通过） |

### 3.8 Dynamic Text（动态文本 / 缩放）

| 项 | 内容 |
|---|---|
| 可执行判定 | 支持浏览器字号放大与 `data-theme-scale` 密度档（S10）；放大后不裁切、不重叠、不丢失内容；全站可见文本下限 12px（T16）；H5 输入 ≥16px 防缩放（S12）。 |
| 现有证据 | `tokens/typography.css`（`@theme --text-*` 阶梯，D1 禁止删除）、`tokens/spacing.css`（`[data-theme-scale]` 三档）、`control-typography.test.ts`（10 守卫之一）、`check-design-tokens.mjs` T16 |
| 验证状态 | `NOT_VERIFIED` |

### 3.9 Reduced Motion（减少动效）

| 项 | 内容 |
|---|---|
| 可执行判定 | 支持 `@media (prefers-reduced-motion: reduce)`；装饰动画停止/缩短、循环 Shimmer/Pulse/Caret 停止、页面进退改即时；**必要反馈（成功/焦点/Loading）必须保留**；不得一条全局规则关闭所有动画；不得导致状态不可辨认（3.0 §9.4 / S09 §7）。 |
| 现有证据 | `styles/index.css:180,461,490` 的降级块；`elevation-motion.test.ts`；`test:axe` |
| 验证状态 | `NOT_VERIFIED` |

### 3.10 Touch Target（触控目标）

| 项 | 内容 |
|---|---|
| 可执行判定 | WCAG 2.2 AA **2.5.8 Target Size Minimum** 通常要求 ≥ **24 × 24 CSS px**（有标准规定例外）；Uter 推荐重要移动端操作 **44 × 44px**；小型图标视觉可 16 / 18 / 24px，但须单独提供足够命中区（3.0 §15.3）。 |
| 口径 | 44px 是 Uter 设计推荐，**不是** WCAG 2.2 AA 的统一最低要求（3.0 §15.3:2236）。 |
| 现有证据 | 3.0 §15.3；`showcase.html` 第 21 区「视觉 16px + 命中区 24px」对照；`test:axe` |
| 验证状态 | `NOT_VERIFIED` |

### 3.11 Error Announcement（错误播报）

| 项 | 内容 |
|---|---|
| 可执行判定 | 表单错误可被识别并就近展示；错误态 `aria-invalid` + 文字提示（不只靠颜色）；`aria-live` 播报异步错误；字段级错误有优先级；防重复提交（Clerk 参考分析 2.6 / S18）。 |
| 现有证据 | 3.0 §15.4「表单错误可被识别」；`react-hook-form` + `zod` + `handleServerError`；`ui/form.tsx` / `field.tsx` / `form-label-tier.tsx` |
| 验证状态 | `NOT_VERIFIED` |

### 3.12 其他要求（3.0 §15.4 继承）

| 项 | 判定 |
|---|---|
| WCAG 2.2 AA 适用拖动操作须提供不依赖拖动的替代方式 | 逐组件核对 |
| Tooltip 不得成为唯一信息来源 | 逐组件核对 |
| 图标按钮必须具有可访问名称 | 见 §3.4 / S08 §10 |
| Focus Not Obscured（Minimum） | 见 §3.2 |
| 验证状态 | `NOT_VERIFIED` |

---

## 4. 现有证据清单（真实，不夸大）

### 4.1 10 个设计系统守卫测试

`web/src/design-system/__tests__/`（BASELINE-AUDIT §12 记 10 个，CLERK 参考分析 2.21 亦引）：

| # | 文件 | 主要关联 |
|---:|---|---|
| 1 | `accessibility.test.ts` | Keyboard / Screen Reader / 基础 a11y |
| 2 | `control-typography.test.ts` | Dynamic Text / 控件字号 |
| 3 | `elevation-motion.test.ts` | S07 / S09 集合与 Dark 覆盖 |
| 4 | `semantic-colors.test.ts` | Color Contrast / 语义色 |
| 5 | `sidebar-active-guard.test.ts` | ARIA 状态 / Sidebar |
| 6 | `spec-guards.test.ts` | 图标几何 / 单一来源（S08） |
| 7 | `status-badge-contrast.test.ts` | Color Contrast / 状态徽标 |
| 8 | `text-color-fallback.test.ts` | 文字色兜底 |
| 9 | `token-source.test.ts` | Token 单一来源 |
| 10 | `tokens.test.ts` | 字号阶梯 / `calc(var(--radius) * N)` |

### 4.2 门禁脚本与测试轨

| 证据 | 内容 | 状态 |
|---|---|---|
| `verify-contrast.mjs`（`verify:contrast`） | BASELINE-AUDIT §4.4 记录 **31 PASS / 0 FAIL**，含 E28 渐变锚定与负例拒绝 | 本轮 `NOT_VERIFIED`（未执行，不继承为通过） |
| `test:axe` / `axe-audit.mjs` | `web/e2e/axe/` 2 个 spec；BASELINE-AUDIT §7：**刻意不接 CI**（像素基线依赖本机渲染、需完整服务栈） | `NOT_EXECUTED` |
| `test:visual` / `test:visual:e2e` | 22 页 × 2 视口 / 44 张 PNG；E2E 轨刻意不接 CI | `NOT_EXECUTED` |
| `check-design-tokens.mjs`（T1–T17） | T16 最小字号、T13–T15 透明度层级等静态门禁 | 本轮 `NOT_VERIFIED` |
| `lint:design:strict` | CI 唯一阻断模式 | 本轮 `NOT_VERIFIED` |
| 3.0 §22 验收清单 | **73 个 `- [ ]`、0 个 `- [x]`** | 不得继承为「已完成」 |

---

## 5. E24 待修登记（P1，禁止勾选通过）

依据 BASELINE-AUDIT §3.1（`:79`）、§10（`:257`）、§14 结论 B：

| 项 | 内容 |
|---|---|
| 缺陷 | 浅色溢价 **3.76:1**、深色折扣 **3.30:1**，均低于普通文字 4.5:1 |
| 位置 | 3.0 `:3228`、`:3587` |
| 状态 | **编号注销但缺陷须保持待修**；列为 **P1 无障碍缺陷**，5.0 **不得勾选通过** |
| 5.0 处置 | 保持 Pending + 明确退出条件：两处达到 4.5:1 并经 `verify-contrast.mjs` 与视觉证据链复核后方可关闭 |
| 禁止 | 禁止用「禁用态豁免」解释残留（这些不是禁用控件）；禁止通过压深品牌渐变「修」对比度（E28 另有口径） |
| 验证状态 | `NOT_VERIFIED` |

---

## 6. E28 例外登记（B 类验收口径，不进 ALLOWLIST）

依据 BASELINE-AUDIT §3.1（`:80`）、§11.4、3.0 §17.5（`:2536-2565`）、§26.2（`:3528`）：

| 项 | 内容 |
|---|---|
| 对象 | 首屏品牌渐变标题（`.ds-text-gradient-brand`，hero / CTA 装饰性大号标题） |
| 实测（浅色 `#FFFFFF` / 深色 `#020617`） | from `#60a5fa` **2.54:1 / 7.93:1**；via `#a78bfa` **2.72:1 / 7.41:1**；to `#a855f7` **3.96:1 / 5.10:1** |
| 判定 | 浅色 from / via 未达大文本 3:1；深色三档全部达标 |
| 例外性质 | **有意例外（B 类验收口径）**，理由：对外传播品牌资产、装饰性辅助标题、深浅同值优先；**不进 `ALLOWLIST`**（A 类静态扫描例外仍 0 条） |
| 验收条件 | `verify-contrast.mjs` 对本节的验收是「逐值锚定上游 + 深浅同值 + 单一 owner + 实测值已登记」，**不是普通文本 4.5:1** |
| 退出条件 | 上游 new-api 改了这三档值，或该渐变被移出装饰性标题场景；届时按 §17.5 重算并注销本条 |
| 5.0 处置 | 保留登记，**明写例外边界**；不得因本例外把 E24 一并勾选通过 |
| 验证状态 | `NOT_VERIFIED` |

---

## 7. 焦点环口径裁决与差异登记（已裁决，2026-11-14）

| 口径来源 | 值 | 说明 |
|---|---|---|
| 用户指令 PART 0 原则 A | **未规定** | 指令列出的品牌基线含「边框：1px」，**没有**规定焦点环宽度 |
| 项目过时长期记忆 | 1px `ring-1` | `MEMORY.md` 旧条目「焦点环 1px 勿回 2px」，已被 2026-11-13 的代码变更推翻，**本轮判定作废** |
| 运行时真源 `web/src/design-system/tokens/semantic.css:120-123` | **`--ds-focus-ring-width: 2px`** | 注释原文：「2026-11-13 复核后重新定为 2px —— 1px 在 36px 控件与 1px 描边上辨识度不足」；并要求「全站只有一档，原生元素兜底与组件层 `focus-visible:ring-2` 同读这个 Token」 |
| 3.0 §15.1（`:2160-2198`） | **恒 2px `ring-2`**，宽度只有一档 | 明说「2026-11-13 用户裁决由 1px 改回 2px」；1px `ring-1` 仅属**装饰性描边**（弹层/卡片/日历格），不承载焦点语义 |
| **5.0 采用值** | **2px `ring-2`** | 依据 `AGENTS.md`「Design System Enforcement」：文档与实现冲突时，**设计值来自代码（`tokens/`、`theme.css`），规则与边界来自规范** |

| 处置 | 内容 |
|---|---|
| 5.0 声明 | 采用 2px `ring-2`，与运行时真源、3.0 §15.1、原生元素兜底及组件层完全一致，**不存在规范—代码漂移** |
| 不执行代码变更 | 本轮不改 `semantic.css`、不改组件、不改 §28 Manifest；因为代码本身已是正确的 2px，无需变更 |
| 记忆同步 | 已同步更正 `MEMORY.md` 中过时的「1px 勿回 2px」条目 |
| 若未来要改为 1px | 须按 3.0 §27.3 / §28.2 先改 §28 Manifest，再同步 `semantic.css`、组件层、守卫、`showcase.html` 快照**五者同提交**，并说明 1px 在 36px 控件上的辨识度如何满足 WCAG 2.2 AA 2.4.11 / 1.4.11 |
| 验证状态 | `NOT_VERIFIED`（本轮未执行焦点环的浏览器级守卫复核，不得勾选通过） |

---

## 8. 禁止事项汇总（禁止勾选通过）

1. 禁止把 3.0 §22 的 73 个未勾选项继承为「已通过」。
2. 禁止把审计曾记录的 `verify-contrast.mjs` 31 PASS / `check-design-tokens.mjs` 0 违规继承为 5.0 通过证据（本轮未执行）。
3. 禁止勾选 E24、禁止用 E28 例外为 E24 背书。
4. 禁止把 E28 写进 `ALLOWLIST`。
5. 禁止把 Focus Appearance 2.4.13（AAA）误称为 AA 要求。
6. 禁止无替代方案删除默认焦点、禁止焦点被裁切/遮挡。
7. 禁止用「禁用态豁免」解释对比度残留、禁止压深品牌渐变修对比度。
8. 禁止宣称 `FULLY_IMPLEMENTED_AND_VERIFIED`（三平台 `NOT_VERIFIED`，见 `UDS5-S12`）。

---

## 9. 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S13-D1 | E24 两处对比度（3.76:1 / 3.30:1）待修 | `NOT_VERIFIED`（P1 待修，禁止勾选） |
| S13-D2 | E28 品牌渐变 B 类例外，不进 ALLOWLIST | 已登记边界，`NOT_VERIFIED` |
| S13-D3 | 焦点环口径已于 2026-11-14 裁决为 2px `ring-2`；过时记忆 1px 作废 | 已裁决；浏览器级守卫复核 `NOT_VERIFIED`（见 §7） |
| S13-D4 | 现状 WCAG 2.1 AA → 目标 WCAG 2.2 AA 的差距逐条闭合 | `NOT_VERIFIED` |
| S13-D5 | `test:axe` / 视觉 E2E 刻意不接 CI（BASELINE-AUDIT §7） | `NOT_EXECUTED` |
| S13-D6 | 65 个 `ui/` 组件证据 `VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56`（BASELINE-AUDIT §5） | `NOT_VERIFIED` |
| S13-D7 | 3 个纯别名 `--ds-color-*` 生产构建被压缩丢弃，靠 `var(--x, fallback)` 缓解 | P1 构建缺陷（BASELINE-AUDIT §3.1），`NOT_VERIFIED` |

---

## 与其他规范的关系

| 规范 | 关系 | 边界 |
|---|---|---|
| `UDS5-S01`（总纲） | 上级 | 5.0 效力、最终状态治理 |
| `UDS5-S03`（Color） | 依赖 | 语义色 / 状态色 / 对比度 Token |
| `UDS5-S04`（Typography） | 依赖 | 最小字号 12px、H5 输入 ≥16px、`@theme --text-*`（D1） |
| `UDS5-S06`（Radius） | 约束 | 焦点环不被圆角裁切 |
| `UDS5-S07`（Elevation） | 约束 | 焦点环不被浮层覆盖、非文本对比度 3:1 |
| `UDS5-S08`（Icon） | 依赖 | 图标按钮可访问名称 / 装饰图标 `aria-hidden` |
| `UDS5-S09`（Motion） | 依赖 | Reduced Motion 降级（§3.9） |
| `UDS5-S10`（Theme） | 依赖 | Light/Dark 分别验收、密度档 |
| `UDS5-S11`（Layout） | 依赖 | 语义 `main` / Sticky Header 不遮挡 |
| `UDS5-S12`（Responsive） | 依赖 | 24/44px 命中区在三平台口径下为 `NOT_VERIFIED` |
| `UDS5-S14`（Component） | 落地 | 八态（含 error/disabled/loading）可达性 |
| `UDS5-S18`（Form） | 落地 | 错误播报 / `aria-invalid` |
| 3.0 §15 / §22 / §26 / BASELINE-AUDIT | 历史 / 事实源 | 3.0 保留为历史，仅用于溯源与证据定位 |

---

## 代码实施位置

| 路径 | 职责 |
|---|---|
| `web/src/design-system/foundations/accessibility.css` | a11y 基础层（据 CLERK 参考分析 2.21 记录） |
| `web/src/design-system/tokens/semantic.css:113,117-124` | `--ds-stroke-width: 1px`、`--ds-focus-ring-width` / `--ds-focus-ring-color` |
| `web/src/design-system/tokens/typography.css:68` | `@theme --text-*` 字号阶梯（D1 禁止删除） |
| `web/src/design-system/tokens/spacing.css:30,69,87` | `[data-theme-scale]` 三档（Dynamic Text） |
| `web/src/styles/index.css:180,461,490` | `prefers-reduced-motion` 降级块 |
| `web/src/design-system/__tests__/accessibility.test.ts` | Keyboard / Screen Reader 守卫 |
| `web/src/design-system/__tests__/status-badge-contrast.test.ts` | 状态徽标对比度守卫 |
| `web/src/design-system/__tests__/semantic-colors.test.ts` | 语义色对比度守卫 |
| `web/src/design-system/__tests__/control-typography.test.ts` | 动态文本 / 控件字号守卫 |
| `web/src/design-system/__tests__/`（其余 6 个） | 见 §4.1 清单 |
| `web/src/components/ui/dialog.tsx` / `alert-dialog.tsx` | 焦点陷阱 / 焦点返回 |
| `web/src/components/ui/form.tsx` / `field.tsx` / `form-label-tier.tsx` | 错误播报 / `aria-invalid` |
| `web/e2e/axe/` | `test:axe` 2 个 spec（刻意不接 CI） |
| `web/scripts/verify-contrast.mjs` | 31 条对比度 / E28 锚定校验 |
| `web/scripts/axe-audit.mjs` | axe 自动化 |
| `web/scripts/check-design-tokens.mjs` | T1–T17（T13–T16 相关） |
| `docs/design-system/showcase.html`（第 21 区） | 焦点环与触控目标对照 |

---

## 自动化验证

| 脚本 / npm 脚本 | 关联 | 说明 |
|---|---|---|
| `verify:contrast`（`verify-contrast.mjs`） | §3.7 / E28 | 31 条对比度校验、渐变逐值锚定与负例拒绝 |
| `test:axe`（`axe-audit.mjs`） | §3.1–§3.12 | axe-core 自动无障碍扫描（2 spec，刻意不接 CI） |
| `check-design-tokens.mjs` | T13–T16 | 透明度层级、最小字号、任意间距静态门禁 |
| `lint:design:strict` | 门禁 | CI 唯一阻断模式 |
| `test:visual` / `test:visual:e2e` | 焦点/命中区视觉 | 22 页 × 2 视口基线（E2E 轨不接 CI） |
| `sync-design-showcase.mjs`（`design:showcase:check`） | 展示一致 | `--check` 17 条校验含 Focus 区快照 |
| `visual-regression.mjs` | 视觉 | 焦点环 / 状态可辨认的视觉复核 |
| `accessibility.test.ts` 等 10 个守卫 | 单元测试 | `web/src/design-system/__tests__/`（非门禁脚本） |

> 说明：10 个守卫为测试文件；门禁脚本以上表所列 `.mjs` 与 npm 脚本为限。

---

## 验证状态

| 项 | 状态 | 依据 / 备注 |
|---|---|---|
| WCAG 2.2 AA 目标逐条闭合 | `NOT_VERIFIED` | §3 全部 12 条均为目标态，未逐项复核 |
| `verify-contrast.mjs` 31 条 | `NOT_VERIFIED` | 审计曾 31 PASS / 0 FAIL，本轮未执行，不继承为通过 |
| 10 个守卫测试 | `NOT_VERIFIED` | 文件存在，本轮未运行 |
| `test:axe`（2 spec） | `NOT_EXECUTED` | 刻意不接 CI（BASELINE-AUDIT §7），本轮未执行 |
| `test:visual` / `test:visual:e2e` | `NOT_EXECUTED` | BASELINE-AUDIT §14 明确未执行 |
| E24 两处对比度 | `NOT_VERIFIED` | **P1 待修，不得勾选通过**（§5） |
| E28 例外 | `NOT_VERIFIED` | 保留登记、明写边界，不进 ALLOWLIST（§6） |
| 焦点环 2px `ring-2` 口径 | `NOT_VERIFIED` | 已按运行时真值 2px 裁决，与 `semantic.css:123` / 3.0 §15.1 一致；本轮未执行浏览器级守卫复核，不得勾选通过（§7） |
| 65 组件证据 | `NOT_VERIFIED` | `VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56`（BASELINE-AUDIT §5） |
| 3.0 §22 的 73 项 | `NOT_VERIFIED` | 0 个勾选，5.0 不继承「已完成」 |
| 全量构建 / 视觉回归双轨 | `NOT_EXECUTED` | BASELINE-AUDIT §14 明确未执行，不得伪装 PASS |
| 平台验收（Android / iOS / HarmonyOS） | `NOT_VERIFIED` | 见 `UDS5-S12` 与 BASELINE-AUDIT §8 |

**结论**：本分册为规范声明。**E24 保持待修、E28 保留登记、全部验收项 `NOT_VERIFIED` / `NOT_EXECUTED`，未勾选任何测试通过或平台验收，未宣称 WCAG 2.2 AA 已达成或 `FULLY_IMPLEMENTED_AND_VERIFIED`**。
