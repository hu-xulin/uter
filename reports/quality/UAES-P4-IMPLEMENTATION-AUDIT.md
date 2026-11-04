# UAES-P4-IMPLEMENTATION-AUDIT — P4 Design System Implementation Audit Record

**Report ID:** UAES-P4-IMPLEMENTATION-AUDIT  
**Report Name:** P4 Design System Implementation Audit Record  
**Version:** 1.0.0  
**Status:** DRAFT  
**Domain:** UAES-05 Experience & Design  
**Phase:** P4  
**Classification:** Implementation Evidence Report  
**Related Standard:** UAES-05  
**Related Gate:** UAES-05-GATE-001  
**Baseline Commit:** 77dab9bf56fff59d6bed0d11cb88fa0901253c4a  
**Implementation Branch:** uaes/p4-design-token-engine  
**Result:** NOT_RUN  

---

> 本文件是 P4 实施证据记录，**不是 UAES 标准文件**，不得用于覆盖、替代或改写 UAES 权威资产。
> 权威基线：`quality/acceptance/UAES-P4-ACCEPTANCE-BASELINE.md`；
> 权威门禁：`quality/gates/UAES-05-GATE-001-EXPERIENCE-AND-DESIGN-GATE.md`。
> UAES 全局注册表的唯一事实源是 UAES 规范库 `.uaes/STANDARD-REGISTRY.yaml`；
> 本仓库不另立注册表，也不在此新增未登记的标准编号。
> 下方「原始记录元数据」与正文保留自分支原始记录，除状态值按 UAES-00-003-005
> 归一到允许枚举外，未作删改。

## 0. 原始记录元数据

- 项目：Uter
- 审计基线：`77dab9bf56fff59d6bed0d11cb88fa0901253c4a`
- 目标分支：`uaes/p4-design-token-engine`
- 审计范围：设计规范、Token、主题、React UI 组件、脚本、测试、CI。
- 审计方式：固定 SHA 的 GitHub 静态读取；未将远程源码阅读等同于本地测试或浏览器实测。

## 1. 现有资产盘点

| 资产 | 路径 | 现状 |
|---|---|---|
| 正式设计规范 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` | 已覆盖字体、颜色、布局、组件、无障碍、响应式、Token、Quality Gate |
| Token CSS | `web/src/design-system/tokens/` | typography / primitives / semantic / spacing / colors / elevation |
| 主题 | `web/src/styles/theme.css`、`theme-presets.css` | Light / Dark 与多套主题预设 |
| Foundations | `web/src/design-system/foundations/` | accessibility / decoration / icons / motion / typography |
| React UI | `web/src/components/ui/` | Button、Input、Dialog、Select、Table 等正式组件 |
| 组件边界 | `web/src/design-system/index.ts` | 明确 `components/ui/` 是正式 UI 组件实现位置，禁止重复实现 |
| 静态扫描 | `web/scripts/check-design-tokens.mjs` | 已有 T1–T16、allowlist、baseline、strict |
| 对比度 | `web/scripts/verify-contrast.mjs` | 已有品牌状态计算；原值此前手工写在脚本中 |
| 测试 | `web/src/design-system/__tests__/` | Token、颜色、无障碍、动效、规范守卫 |
| 视觉回归 | `web/e2e/visual/`、`web/visual-regression/` | 已有 Playwright 与截图基线 |
| CI | `.github/workflows/ci.yml` | 已执行 typecheck、Vitest、lint、严格 Token 扫描、生产构建 |

## 2. 主要发现

### 2.1 不应重复建设的部分
- 不新增第二套 Button / Input / Dialog / Select / Table。
- 不重建已有 CSS Token 分层、静态扫描器和 Playwright 基础设施。
- 既有静态扫描负责代码违规；新增生成器负责结构化 Token 数据与 CSS 输出同步。

### 2.2 Token 真源尚未完全机器化
运行时值分布在 `design-system/tokens/*.css`、`styles/theme.css`、`theme-presets.css` 和 `brand-colors.ts`。文档、CSS、对比度脚本和测试存在手工重复值。当前有分层，但尚未形成完整机器可读源数据及确定性生成流程。

### 2.3 品牌主色漂移
基线文档和 CSS 默认 Light 主色为 `#5558D8`；用户于 2026-11-04 确认的主色为 `#5B5EE6`。本阶段将 Light 主色纳入结构化源数据。
- 白字 on `#5B5EE6`：约 **5.01:1**，AA 通过。
- `#5558D8` on `#F0F0FF`：约 **4.93:1**，继续作为独立 Soft 前景值。
Dark 及其余状态值先从现有 3.0 实现迁入，并明确标记为既有实现数据，不代表用户重新确认每个值。

### 2.4 组件治理缺口
现有基础组件数量较多，但没有独立的机器可读组件契约注册表。后续 P4-IV 需要先登记正式组件路径，再按组件类型声明适用状态、键盘行为、Accessible Name 和测试证据；不能把 Button 的状态要求机械套用到所有组件。

### 2.5 React 组件静态审计

- `web/src/components/ui/` 当前有 **68 个文件**；`__tests__/` 有 **11 个测试文件**。另有 `web/src/design-system/__tests__/` 的 10 个设计系统守卫测试。
- `web/src/design-system/index.ts` 明确规定基础 UI 组件仍由 `components/ui/` 实现，避免建立第二套组件库。
- Button、Input、Textarea、Select、Checkbox、RadioGroup、Switch、Tabs 等关键控件均可见 `focus-visible:ring-1` 规则；Button 还提供 loading、`aria-busy` 和自动 disabled 行为。
- Dialog、AlertDialog、Popover、Tooltip、DropdownMenu、Menubar、Drawer、Sheet 等组件封装 Base UI primitives。仅靠静态 class 扫描无法证明焦点陷阱、键盘遍历、弹层关闭和焦点还原，必须保留浏览器 E2E 验证。
- Table、Card、Alert 属于语义容器或内容组件，不应机械要求拥有 Button 的 hover / disabled / loading 状态。
- 当前没有机器可读的组件注册表，尚不能自动证明全部 UI 文件都有组件契约及适用状态测试。

**已识别的 P2 差距：H5 表单输入字号。** `input.tsx`、`textarea.tsx` 和 `select.tsx` 当前使用 `text-sm`（14px），未见 H5 专用 16px 输入文字策略；这与 UTER Design System 3.0 §1.7 的 H5 输入文字至少 16px 要求不一致。本轮先记录为待整改项，不在 Token 基础设施提交中顺带改动表单视觉。

### 2.6 Quality Gate
CI 已运行 `lint:design:strict` 和 Vitest，但原有对比度脚本未纳入前端 CI。本次增加源数据漂移检查和品牌对比度检查。视觉回归保留现有 Playwright 流程；认证后页面仍需有效测试会话。

## 3. 本阶段交付
- 品牌 Token JSON 源数据与 JSON Schema。
- 确定性 CSS 生成器及生成文件。
- Token 源数据单元测试。
- 品牌对比度脚本改为读取结构化源数据。
- CI 接入 Token 同步和品牌对比度门禁。
- 正式设计规范同步 Light 品牌主色。

## 4. 验证状态
本轮 GitHub 远程文件操作不具备本地安装依赖、运行 Node/Bun、启动浏览器的能力：
- 生成器执行：NOT_RUN
- Vitest：NOT_RUN
- typecheck / lint / build：NOT_RUN
- Playwright / axe：NOT_RUN
- CI 结果：待分支工作流实际运行后回填

本阶段只把**品牌色**作为第一批结构化源数据；其他 Token 类别仍由现有 CSS 分层承载，不宣称已全部迁入 JSON。

## 5. 后续阶段
- P4-III：迁移 typography / spacing / radius / elevation / motion，逐类生成并验证 CSS。
- P4-IV：建立 React 组件注册表和组件契约。
- P4-V：扩展主题预设、对比度、Token 未使用和循环引用检查。
- P4-VI：补充认证后页面会话，执行 Playwright + axe 和视觉回归。
- P4-VII：以固定 SHA 汇总验收证据；强制项全部 PASS 后才可 ACCEPT。


## 6. P4-IV — React Component Registry

- Fixed-SHA inventory found **65 eligible `.tsx` implementation files** under `web/src/components/ui/`, excluding tests.
- Added `web/src/design-system/component-registry.json` with 65 stable component IDs, categories, applicable states, accessibility expectations, responsive requirements, semantic Token rules and explicit evidence status.
- Added `web/src/design-system/schemas/component-registry.schema.json`.
- Added `web/scripts/check-component-registry.mjs` to compare registry entries with the actual UI filesystem, detect duplicate IDs/paths, missing contract sections and missing referenced test files.
- Added normal structural validation to the existing frontend CI. Strict mode remains a later acceptance gate because component behavior evidence is not yet complete.
- Existing tests are linked only where a directly relevant test file was found. File existence does not imply that every contract requirement is tested or passed.
- Component registry implementation record: `reports/quality/UAES-P4-IV-COMPONENT-REGISTRY-IMPLEMENTATION.md`（分支原以未登记的 `UAES-05-014` 标准编号命名，已按 UAES-00-003-001 编号唯一性规则撤销，改为实施证据记录）。

**P4-IV verification status:** source inventory and registry generation are complete. The scanner has not yet been executed in a local runtime or CI; browser behavior, ARIA, keyboard and responsive evidence remain NOT_VERIFIED.
