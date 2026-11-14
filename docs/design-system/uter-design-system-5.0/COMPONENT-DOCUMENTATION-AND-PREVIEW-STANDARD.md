# COMPONENT-DOCUMENTATION-AND-PREVIEW-STANDARD — 组件文档与展示中心规范

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S23` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | UTER 组件展示中心（`docs/design-system/showcase.html`）、组件文档、组件注册 ID 与「规范 ↔ 代码 ↔ 注册 ID」双向关联；PC Web / H5 |
| 验证状态 | `NOT_VERIFIED`（本轮仅撰写规范，未改造展示中心、未执行验证） |

---

## 1. 决策 D3：扩展既有展示中心，不重复建设

| 项 | 结论 |
|---|---|
| 既有系统 | `docs/design-system/showcase.html` 已存在：**2,188 行 / 86,313 B**、**24 个区域**、浏览器真实 DOM 渲染（0 个 `<img>`、0 处 `React`），数据驱动自 3.0 §28 TOKEN-MANIFEST 内联快照，具备 Light/Dark 与密度三档的交互切换与 24 个区域渲染器 |
| Storybook | **不存在**：0 依赖、0 配置、0 `*.stories.*`、全仓 `storybook` 字面命中 0 |
| 决策 | **`Adapt`（决策 D3，`UDS5-AUDIT-01` §9）**：扩展既有 `showcase.html`，**不引入 Storybook**（引入成本高于收益），**不使用静态截图冒充组件展示** |
| 新增方向 | 补齐 Props / 变体与状态切换 / 组件级 a11y / 代码示例 / 注册 ID，并新增「规范 ↔ 代码 ↔ 注册 ID」双向关联面板 |
| 禁止 | 不新建第二套展示系统；不把 showcase 伪装成 `web/src/components/ui/*.tsx` 的 React 组件实例（当前 `web/src` 内无任何引用）；不以 `showcase-3.0.html` / `showcase-3.0.generated.html` 等不存在文件作为交付物 |

> 依据：`UDS5-AUDIT-01` §2（组件展示行）、§5.1（展示中心真实能力）、§9 D3、§11.3（展示中心重构）、`CLERK-DESIGN-REFERENCE-ANALYSIS.md` 决策表（Reject Storybook）。

---

## 2. 现状写实基线（不得美化为已具备）

### 2.1 已具备的能力（真实 DOM，非截图）

| 项 | 实际值 | 证据 |
|---|---|---|
| 文件规模 | `docs/design-system/showcase.html` **2,188 行 / 86,313 B** | `UDS5-AUDIT-01` §2、§5.1 |
| 区域数 | **24 个区域**渲染器，数据来自 §28 Manifest 内联快照 | `showcase.html:8-23,1342-1487,1718` |
| 渲染方式 | 浏览器真实 DOM（`0` 个 `<img>`、`0` 处 `React`） | §5.1 |
| 主题切换 | Light / Dark 可交互切换（`data-theme="light"`），密度三档可切换（`data-density="Default"`） | `showcase.html:2`、§5.1；`applyTheme()` / `applyDensity()` |
| 数据链 | HTTP(S) 打开 `fetch` 规范原文；`file://` 打开读内联快照；`sync-design-showcase.mjs --check` 逐值比对，漂移即 FAIL | `showcase.html:8-23`；`17 PASS / 0 FAIL / 0 SKIP` |
| 兼容回退 | 同目录 `showcase.tokens.js`（1,241 行）为旧版兼容回退 | `showcase.html:16-17`、§3 |

### 2.2 明确缺失的能力（写实数字）

| 缺失项 | 实际值 | 证据 |
|---|---|---|
| 尺寸 / Variant / 状态切换 | 尺寸（9 档）、Variant（6 档）、状态（7 态）均为**并排静态展示，不可切换** | `UDS5-AUDIT-01` §5.1 |
| `Props` | **0 处** | §5.1 |
| `UTER-CMP` 注册 ID | **0 处** | §5.1 |
| 组件级无障碍要求 | **0 处** | §5.1 |
| 代码示例（使用示例） | **0 处** | §5.1 |
| React 路由级展示页 | **无**：80 个路由文件中 0 个 showcase / design-system 路由 | §5.1 |
| Storybook | **无** | §2 |
| React 组件实例 | showcase **不是** `web/src/components/ui/*.tsx` 的实例（`web/src` 内无任何引用） | §5.1 |
| 锚点覆盖 | `add-showcase-anchors.mjs:49-218` 的 **22 条锚点未覆盖区域 23 `breakpoints`、24 `token-layers`** | §5.1 |
| 展示页引用 | `showcase-3.0.html` 已退役更名 → `showcase.html`（2026-11-14 修正 `visual-regression.mjs` / `tokens.test.ts` 引用）；`showcase-3.0.generated.html` 按需生成不入库，非「不存在的虚构文件」 | §5.1 |

### 2.3 组件注册与文档侧缺口（关联）

| 项 | 实际值 | 证据 |
|---|---|---|
| 组件注册 | `component-registry.json` **65 条 / 2,094 行**，`registered=65 / discovered=65 / errors=0` | §5 |
| 证据状态 | `VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56` / `EXCEPTION 0`；`--strict` **EXIT=1** | §5 / §3.1 |
| registry 缺字段 | `layer / source / implementation_path / specification_path / test_path / story_path / variants / states(顶层) / accessibility(顶层) / deprecated / replacement` 全部缺失 | §5 |
| 组件 README | 全仓仅 `web/src/components/data-table/README.md` **1 份** | §5 |
| `designSystem` 字段 | 当前为 `"UTER Design System 3.0"`，升级 5.0 时须同步 `check-component-registry.mjs:45` 硬编码校验 | §11.3、§5 |

---

## 3. 十二项能力逐项规范（每项 4 字段）

> 字段固定为：`5.0 要求` / `现状` / `差距` / `改造路径`。`现状` 列全部依据 §2 写实基线，未跑验证一律 `NOT_VERIFIED`。

### 3.1 独立展示页

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 每个已登记组件具备可单独访问、可深链接的展示单元（锚点或路由片段），支持从组件注册 ID 一键定位；展示页可 `file://` 单文件打开，也可 HTTP(S) 打开，且不依赖本地起服务 |
| 现状 | `showcase.html` 为单文件、24 个区域、具备区域锚点（`add-showcase-anchors.mjs` 22 条）；**无 React 路由级展示页**（80 路由中 0 个），`web/src` 内无引用 |
| 差距 | 22 条锚点漏区域 23 `breakpoints`、24 `token-layers`；无「组件 → 展示单元」的一对一映射；无按注册 ID 的深链接 |
| 改造路径 | 扩展既有 `showcase.html`：补齐 23/24 区锚点；为每个 `UTER-CMP-*` 生成稳定锚点 `id`；新增注册 ID → 锚点的映射表；不新建 React 路由展示页（决策 D3 不重复建设），不引入 Storybook |

### 3.2 左效果右规范

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 展示单元采用「左侧实时效果 / 右侧规范说明」双栏：右侧含组件 ID、所属层级、Token 依赖、状态清单、a11y 要求、测试状态、关联规范文档链接 |
| 现状 | 现 showcase 为纵向分区（24 区），以 Token 值展示为主，无「左效果 / 右规范」版式；无组件 ID、无规范文档链接面板 |
| 差距 | 缺少组件级规范右栏；缺少与 `UDS5-Sxx` 分册的显式引用 |
| 改造路径 | 新增组件展示单元模板（左 iframe/实时 DOM 效果 + 右规范卡片）；右侧数据来自组件注册表与规范元数据；`file://` 打开时用内联快照保证右栏可用 |

### 3.3 状态切换

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 每个组件可交互切换 default / hover / focus / pressed / disabled / loading / error / success 八态，且切换后展示对应状态 Token 与 a11y 属性（如 `aria-disabled`） |
| 现状 | 状态（**7 态**）为**并排静态展示，不可切换**；组件级 a11y 0 处 |
| 差距 | 缺交互切换器；缺八态中 error / success 的补齐；状态与 a11y 属性未联动 |
| 改造路径 | 为每个组件加状态切换控件（radio / select），绑定 `data-state` 驱动样式；补齐八态并登记到 `component-registry.json` 顶层 `states`；每个状态标注对应 Token 与 ARIA 属性 |

### 3.4 variant 切换

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 可交互切换组件全部 variant（如 `ui/button.tsx` 的 6 variant），展示每个 variant 的 `cva()` 定义与语义用途 |
| 现状 | Variant（**6 档**）为**并排静态展示，不可切换**；`Props` 0 处 |
| 差距 | 缺 variant 切换器；variant 与 `cva()` 定义无关联展示 |
| 改造路径 | 加 variant 切换控件并读取组件 `cva()` 配置生成选项；每个 variant 标注语义用途与 Token 依赖；不按名称重复实现组件（`ui/button.tsx` 已覆盖 ≥10 个按钮名称） |

### 3.5 尺寸切换

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 可交互切换组件全部尺寸档（如 button 9 size），并展示对应间距 / 字号 / 命中区 Token；H5 下标注命中区 ≥24px（推荐 44px） |
| 现状 | 尺寸（**9 档**）为**并排静态展示，不可切换**；无命中区标注 |
| 差距 | 缺尺寸切换器；尺寸与 Token、命中区无关联 |
| 改造路径 | 加尺寸切换控件；每档标注间距 / 字号 Token 与命中区数值；密度三档切换（已有）与尺寸切换解耦，避免概念混淆 |

### 3.6 Light-Dark

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 展示中心支持 Light / Dark 交互切换，且每个组件在两主题下均渲染；切换须与主题成对 Token 校验一致；品牌渐变深浅同值例外（E28）需标注 |
| 现状 | **已具备** Light/Dark 交互切换（`data-theme`、`applyTheme()`）；但仅 8 色品牌 + 2 档 elevation 有 design-system 内部 Dark 覆盖，组件级双主题渲染未逐一登记 |
| 差距 | 缺「每组件双主题成对」校验；缺 Light/Dark 变量成对校验器（关联 `UDS5-S21` §4.4） |
| 改造路径 | 保留既有切换；新增 Light/Dark 变量成对校验器；为每个组件展示单元记录两主题截图/DOM 快照与 E28 例外标注；不使用静态截图冒充实时渲染 |

### 3.7 Props

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 每个组件展示完整 Props 表（名称 / 类型 / 默认值 / 必填 / 说明 / 关联 Token / 关联状态），Props 数据来自组件 API 规范与注册表，禁止手工维护第二份真源 |
| 现状 | `Props` **0 处**；registry 顶层 `variants` / `states` 等字段缺失 |
| 差距 | 完全缺失；无 Props 与组件代码的同步机制 |
| 改造路径 | 由组件 API 规范（`UDS5-S15`）与 `component-registry.json` 生成 Props 表；`sync-design-showcase.mjs` 增补「Props 与代码一致」校验；禁止在 showcase 内手写 Props 真值 |

### 3.8 使用示例

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 每个组件提供可复制的代码示例（最小用法 + 典型组合 + 反例），示例语法与 `web/src/components/ui/*.tsx` 真实导出一致，并经 `file://` 打开可读 |
| 现状 | 代码示例 **0 处**；showcase 非 React 实例，`web/src` 内无引用 |
| 差距 | 完全缺失；且示例若凭空编写会与真实导出不一致 |
| 改造路径 | 从组件真实导出生成示例片段（静态字符串，非运行时执行）；新增「示例 ↔ 导出」一致性校验；明确示例为说明用途、非可执行 React 实例，避免与决策 D3 冲突 |

### 3.9 无障碍要求

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 每个组件展示单元标注组件级 a11y 要求：键盘操作、焦点管理、ARIA 属性、`aria-expanded` / `aria-selected` 与视觉状态一致、Reduce Motion、对比度数值与 WCAG 2.2 AA 对照 |
| 现状 | 组件级无障碍要求 **0 处**；全仓有 `foundations/accessibility.css`、11 个守卫测试、`verify-contrast.mjs` 31 条、`test:axe` 2 spec，但未落到展示中心 |
| 差距 | 缺组件级 a11y 面板；E24 两处对比度缺陷（3.76:1 / 3.30:1）未登记到展示单元 |
| 改造路径 | 每单元加 a11y 卡片，数据来自注册表顶层 `accessibility` 字段与对比度门禁输出；登记 E24 待修与 E28 例外；`test:axe` 结果作为「测试状态」输入之一（注意 `test:axe` 未接 CI） |

### 3.10 测试状态

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 每个组件展示单元显示测试状态（单测 / 视觉 / a11y / E2E），状态取自真实测试结果，未执行者标 `NOT_VERIFIED`，禁止默认勾选通过 |
| 现状 | 65 组件 `VERIFIED 0` / `PARTIAL 9` / `NOT_VERIFIED 56`；`--strict` **EXIT=1**；22 页视觉基线（44 张 PNG）；`test:axe` / `test:business:e2e` / `test:visual:e2e` 未接 CI |
| 差距 | 展示中心无测试状态面板；registry 的 `evidence.tests[]` 未与展示单元联动 |
| 改造路径 | 由 `component-registry.json` 的 `contract.evidence` 生成测试状态徽标；未接 CI 的轨道明确标「开发机手动 / `NOT_VERIFIED`」；与 `UDS5-S25` 八状态口径一致 |

### 3.11 注册 ID

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 每个组件具备全局唯一 `UTER-CMP-*` 注册 ID，作为「规范 ↔ 代码 ↔ 展示 ↔ 测试」的关联主键；ID 在注册表、规范文档、展示锚点、测试证据中一致出现 |
| 现状 | `UTER-CMP` 注册 ID **0 处**；registry 顶层仅有 `id,name,file,category,status,contract`，无跨文档主键 |
| 差距 | 完全缺失；无唯一 ID 体系，无法做双向关联与「删组件检查引用」 |
| 改造路径 | 定义 `UTER-CMP-<类别>-<序号>` 编号规则并写入注册表；为 65 个组件逐一分配；`sync-design-showcase.mjs` 增补「ID 唯一 / 引用有效」校验；与 `UDS5-S24` 规范一致性检查联动 |

### 3.12 双向关联

| 字段 | 内容 |
|---|---|
| 5.0 要求 | 建立「规范 ↔ 代码 ↔ 注册 ID」双向关联面板，覆盖 §4 全部 5 个场景，任何一侧变更都能定位对侧 |
| 现状 | 无关联面板；registry 缺 `specification_path / implementation_path / test_path / story_path` 等路径字段；`web/src` 内无 showcase 引用；文档与代码无机器可校验的对应 |
| 差距 | 5 个关联场景全部缺失（详见 §4） |
| 改造路径 | 在 `component-registry.json` 补齐路径字段并在 showcase 新增关联面板；每个关联方向由一个 Validator 支撑（见 §8）；JSON 仍为唯一真源，YAML / 展示面板为其投影 |

---

## 4. 双向关联五场景（必须全部覆盖）

| # | 场景 | 触发动作 | 期望定位结果 | 依赖字段 | 支撑校验 | 当前状态 |
|---|---|---|---|---|---|---|
| A1 | **改规范 → 定位代码** | 修改某 `UDS5-Sxx` 分册中某组件条目 | 列出该组件的 `implementation_path`（`web/src/components/ui/*.tsx`）与相关测试 / 页面引用 | `specification_path` ↔ `implementation_path` | 规范一致性 Validator：引用路径有效、代码存在 | `NOT_VERIFIED` |
| A2 | **改代码 → 定位规范** | 修改某组件 `.tsx` | 列出其 `UTER-CMP-*` ID、对应规范分册与展示锚点 | `implementation_path` → `id` / `specification_path` / `story_path` | 组件检查 Validator：未登记 / API 不一致 | `NOT_VERIFIED` |
| A3 | **改 API → 发现使用位置** | 修改组件 props / `cva()` variant / 导出 | 列出全仓使用该 API 的页面与组件（含 73 路由源码、30 feature） | `contract.variants` / Props 表 | API 变更影响面扫描 | `NOT_VERIFIED` |
| A4 | **删组件 → 检查引用** | 计划删除 / 废弃某组件 | 若存在任何引用则阻断，列出引用文件与 `deprecated / replacement` 迁移映射 | `deprecated` / `replacement` / 引用图 | 组件检查 Validator：废弃仍用 / 删除前依赖检查 | `NOT_VERIFIED` |
| A5 | **改 Token → 定位受影响组件** | 修改任一 `--ds-*` / `@theme --text-*` Token | 列出消费该 Token 的全部组件、展示单元与页面，触发回归 | `contract.tokens` / Token 依赖表 | Token 检查 Validator：未使用 / 未登记 / 主题 Token 缺失 | `NOT_VERIFIED` |

> 五场景共同依赖「注册 ID 作为主键」（§3.11）与「路径字段补齐」（§3.12）。当前 `component-registry.json` 缺 8 类字段，故五场景**全部 `NOT_VERIFIED`**，不得描述为已具备。

---

## 5. 展示中心数据链与真源约束（继承 3.0 有效机制）

| 项 | 规则 | 证据 |
|---|---|---|
| 唯一真源 | `component-registry.json` 为组件注册唯一真源；Token 值真源为 3.0 §28 TOKEN-MANIFEST / 5.0 对应 Manifest | `UDS5-AUDIT-01` §3 / §5 |
| 内联快照 | showcase 内联快照为**派生产物，禁止手工编辑**；`sync-design-showcase.mjs --check` 逐值比对，漂移即 FAIL（17 PASS / 0 FAIL / 0 SKIP） | `showcase.html:19-23`、§4.4 |
| 无 Token 副本 | 展示页 `:root` 禁止出现任何 Manifest 声明值（§28.3 校验），fallback 用不落在刻度上的中性值 | `showcase.html:24-31` |
| 兼容回退 | `showcase.tokens.js` 为可选回退产物，主交付为内联快照；变更须先同步 17 条校验契约 | `UDS5-AUDIT-01` §11.2 |
| 禁止截图冒充 | 组件效果必须为真实 DOM 渲染，不得用 `<img>` 静态截图代替；当前 showcase 为 0 `<img>` | §5.1、决策 D3 |
| 过时注释清理 | `generate-design-showcase.mjs:25-29` 的 `showcase-3.0.html` / `showcase-3.0.generated.html` 叙述须删除（文件不存在） | §5.1 / §11.4 |

---

## 6. 分期改造顺序（与并发 WIP 约束协调）

| 阶段 | 动作 | 前置条件 | 状态 |
|---|---|---|---|
| P0 | 补齐 23/24 区锚点；清理 2 个过时文件注释 | 不触碰 `web/e2e/visual/*` 等 12 个并发 WIP 禁改文件 | `NOT_STARTED` |
| P1 | 定义 `UTER-CMP-*` 编号规则，补齐 registry 8 类路径字段 | 与 `UDS5-S27` 迁移指南同变更内协调 `designSystem` 字段与 `check-component-registry.mjs:45` | `NOT_STARTED` |
| P2 | 新增左效果右规范模板、状态 / variant / 尺寸切换器、Props / 示例 / a11y / 测试状态面板 | 每处改动先写回归测试；不执行全量构建 | `NOT_STARTED` |
| P3 | 新增双向关联面板与 5 个 Validator | 依赖 P1 路径字段 | `NOT_STARTED` |
| P4 | 逐组件补八态证据、双主题快照、a11y 登记，推进 `--strict` 由 EXIT=1 转 EXIT=0 | 依赖 `UDS5-S24` 门禁与 `UDS5-S25` 验收 | `NOT_STARTED` |

> 约束：审计期间存在 211 项并发 WIP（51 `M` + 160 `??`），12 个文件禁改；按项目约定不执行全量构建、不批量重写，改用只读门禁验证（`UDS5-AUDIT-01` §1 / §14）。

---

## 6.1 规范性语言与文档状态机（业务域蓝图补充 → 全局治理规则）

> 来源：业务域蓝图《Design Documentation Standard》§1–§7。**本节是面向全部 32 份 5.0 分册的全局治理规则**，不局限于组件文档。

### 6.1.1 规范性语言（MUST / SHOULD / MAY）

| 关键词 | 含义 | 例外要求 |
|---|---|---|
| **MUST / MUST NOT** | **强制**要求，违反即判不合规（可被门禁或验收拦截） | 无例外，或例外须走 `UDS5-S01` §19 变更流程并登记 |
| **SHOULD / SHOULD NOT** | **推荐**，有充分理由时可例外 | 例外必须**记录**（文件 + 理由 + 责任人 + 到期日），**不得以模糊词绕过约束** |
| **MAY** | **可选** | 无需记录 |

| 项 | 规则 |
|---|---|
| N-1 | 5.0 全部规范条文按上述四档理解；**「必须」「禁止」「应当」「建议」「可以」是同一语义的不同表述**，不因用词不同而改变强度。 |
| N-2 | **禁止用模糊词绕过约束**：不得写「尽量避免」「原则上不」「视情况」等既非强制又非推荐的表述来承载可判定规则。 |
| N-3 | 门禁可自动判定者写 MUST；人工审查项写 SHOULD 并注明**审查方式**（如「人工审查 + a11y 测试（未验证）」，参照 `UDS5-S02` §5 表）。 |
| N-4 | **例外一律登记**：文件路径、规则、原因、影响、责任人、到期日期、移除计划；**过期例外自动失败**（蓝图《Design Engineering Standard》§7）。 |
| N-5 | 本轮各分册新增的「治理候选」「待办」条目**不得**表述为 MUST——它们是 SHOULD/待办，不是强制项。 |

### 6.1.2 文档状态机

| 状态 | 含义 | 可否作为验收基线 | 必备字段 |
|---|---|---|---|
| `DRAFT`（草案） | 编写中 | **否** | 文档 ID / 版本 / 状态 / 适用范围 / 验证状态 |
| `ACTIVE`（现行） | 已批准并生效 | **是** | 同上 + 生效日期 + 上级规范 + 与其他规范的关系 + 代码实施位置 + 自动化验证 + 验证状态 |
| `DEPRECATED`（已弃用） | 不再适用但保留追溯 | **否**，必须指向替代文档 | 同上 + **替代文档 ID** + 移除计划 |
| `ARCHIVED`（历史归档） | 仅供追溯 | **否** | 同上 + 归档原因 |

| 项 | 规则 |
|---|---|
| DS-1 | **状态不得省略**；注册表 `status_values` = `ACTIVE` / `DEPRECATED` / `PENDING` / `DRAFT`，与本文档状态机对应（`PENDING` 对应「已登记待补齐」的治理候选条目）。 |
| DS-2 | `DEPRECATED` **必须有替代文档**；无替代的不得标 `DEPRECATED`，按 `ARCHIVED` 处理。 |
| DS-3 | **禁止覆盖历史批准版本而不留记录**（蓝图 §7）；版本变更走 `UDS5-S26` 变更日志。 |
| DS-4 | 每份规范必须包含：编号、标题、版本、状态、适用范围、规范性要求、数值 / Token、**反例**、验收方法、关联文档和变更记录（蓝图 §1）。**仓库现状**：32 份分册中「反例」与「验收方法」并非每册齐备——登记为 `S23-D1`（治理候选）。 |
| DS-5 | **示例必须与当前 API 和 Token 匹配**；禁止展示已弃用写法而不标注；代码示例应可复制、可编译，或**明确注明伪代码**。 |
| DS-6 | **结构化信息须有机器可读来源**：Token、组件 API、状态映射、断点和验收规则应尽量同时存在于 Registry；**Markdown 是可读说明，不得成为唯一无法自动解析的事实来源**。 |
| DS-7 | 每份文档列出**依赖、被依赖项和覆盖范围**；变更基础 Token 时必须识别所有引用组件和页面。 |

### 6.1.3 关联关系与变更影响

| 项 | 规则 | 仓库现状 |
|---|---|---|
| DL-1 | 每份文档列出依赖与被依赖项 | 32 份分册均设「与其他规范的关系」段（**已覆盖** ✓） |
| DL-2 | 变更基础 Token 时必须识别**所有引用组件和页面** | 仓库有 `unusedTokenCandidates: 102`（`design:5:check` 实测）与 `tokenFiles: 8` / `uniqueTokenVariables: 245` 的扫描能力，但**未建立「Token → 引用方」的完整反向索引**；登记为 `S23-D2`（治理候选） |
| DL-3 | 关联关系须有机器可读来源 | 注册表 `dependencies` 字段已提供（`design:5:check` 校验依赖不得悬空）；**已覆盖** ✓ |

---

## 6.2 差异与例外登记

| 编号 | 内容 | 状态 |
|---|---|---|
| S23-D1 | 蓝图《Design Documentation Standard》§1 要求每份规范含**反例**与**验收方法**；仓库 32 份分册中并非每册齐备 | **治理候选**（补全属文档工作，可在本轮或后续节点逐册补齐；本轮未逐册普查覆盖率，不虚构比例） |
| S23-D2 | 蓝图 §5 要求「变更基础 Token 时必须识别所有引用组件和页面」；仓库 `design:5:check` 已能扫描 Token 唯一性与未使用候选（实测 `unusedTokenCandidates: 102`），但**未建立「Token → 引用方」的完整反向索引** | **治理候选**（登记为待建能力，不虚构已有索引） |
| S23-D3 | 蓝图 §3 的文档状态集为 `Draft` / `Approved` / `Deprecated` / `Archived`；仓库注册表 `status_values` 为 `ACTIVE` / `DEPRECATED` / `PENDING` / `DRAFT` | 已登记（**以仓库为准**；映射见 §6.1.2，`PENDING` 对应治理候选条目） |
| S23-D4 | 蓝图 §4「Token / 组件 API / 状态映射 / 断点 / 验收规则应尽量同时存在机器可读 Registry」；仓库注册表 `dependencies` + `implementation` + `verification` 已提供机器可读来源 | 已登记（**已覆盖** ✓） |

---

## 7. 与其他规范的关系

| 规范 ID | 关系 | 说明 |
|---|---|---|
| `UDS5-S01` | 上级 | 服从总纲效力、ID 体系与验证状态口径 |
| `UDS5-AUDIT-01` | 事实依据 | §2 / §5.1 / §9 D3 / §11.3 提供展示中心全部写实数字与决策 |
| `UDS5-S14`（组件规范） | 上游 | 八态、组件清单与合并 3 处同名 `EmptyState` 的定义来源 |
| `UDS5-S15`（组件 API 规范） | 上游 | Props / variant / slot / composition 唯一扩展路径，Props 表真源 |
| `UDS5-S13`（无障碍规范） | 上游 | 组件级 a11y 要求、E24 / E28 登记、WCAG 2.2 AA |
| `UDS5-S10`（主题规范） | 被引用 | Light/Dark 变量成对校验器 |
| `UDS5-S21` | 被引用 | 组件八态与 a11y 登记到展示中心（§4.12 / §4.13） |
| `UDS5-S24`（自动化规范） | 下游 | 本文档一致性、组件检查、Token 检查的 8 类 Validator 由其定义 |
| `UDS5-S25`（验收规范） | 下游 | 测试状态口径与八状态一致；平台验收 `NOT_VERIFIED` |
| `UDS5-S27`（迁移指南） | 关联 | registry `designSystem` 字段与硬编码校验同变更内升级 |
| `UDS5-S28`（废弃规范） | 关联 | `deprecated / replacement` 字段与删除前引用检查 |

---

## 8. 代码实施位置

| 类别 | 真实路径 | 本文关联 | 本轮状态 |
|---|---|---|---|
| 展示中心 | `docs/design-system/showcase.html`（2,188 行 / 24 区） | §3 全表、§5 | 存在，未改造 |
| 兼容回退 | `docs/design-system/showcase.tokens.js`（1,241 行） | §5 | 存在，未改造 |
| 锚点脚本 | `web/scripts/add-showcase-anchors.mjs:49-218`（22 条锚点） | §3.1 / §2.2 | 存在，未改造 |
| 展示同步脚本 | `web/scripts/sync-design-showcase.mjs`（17 条校验） | §5 / §8 | 存在，未改造 |
| 生成脚本（含过时注释） | `web/scripts/generate-design-showcase.mjs:25-29` | §2.2 / §5 | 存在，未改造 |
| 组件注册 | `web/src/design-system/component-registry.json`（65 条 / 2,094 行） | §3.7 / §3.11 / §3.12 / §4 | 存在，未改造 |
| 注册校验 | `web/scripts/check-component-registry.mjs`（`:45` 硬编码 `designSystem`） | §2.3 / §6 P1 | 存在，未改造 |
| UI 组件根 | `web/src/components/ui/*.tsx`（65 实现） | §3.4 / §3.8 | 存在，未改造 |
| 唯一组件 README | `web/src/components/data-table/README.md` | §2.3 | 存在，未改造 |
| Token 真源 | `web/src/design-system/tokens/*.css`（14 个 CSS） | §4 A5 | 存在，未改造 |

> 本文为展示与文档规范，**不新增、不修改任何代码文件**；§3 `改造路径` 与 §6 分期表为 5.0 目标动作，非本轮已实施。

---

## 9. 自动化验证

| 检查项 | 现有实现 | 5.0 拟补充 | 当前结果 |
|---|---|---|---|
| 展示页数据链一致 | `design:showcase:check` → `sync-design-showcase.mjs --check`（17 PASS / 0 FAIL / 0 SKIP，EXIT=0，已接 CI） | Props / 注册 ID / 示例代码一致性的新增校验契约 | 既有通过，5.0 补充 `NOT_VERIFIED` |
| 锚点覆盖 | `add-showcase-anchors.mjs` 22 条锚点 | 区域 23 / 24 锚点补齐校验 | 缺 2 区，`NOT_VERIFIED` |
| 注册结构 | `components:registry:check`（65/65/0 errors，已接 CI） | 8 类路径字段 + `UTER-CMP-*` 唯一性校验 | 既有通过，5.0 补充 `NOT_VERIFIED` |
| 组件证据 | `components:registry:strict`（`--strict` EXIT=1，**未接 CI**） | 八态 / a11y / 双主题证据登记后转 EXIT=0 | EXIT=1，`NOT_VERIFIED` |
| 双向关联 5 场景 | 无 | A1–A5 五个 Validator | 未建立 `NOT_VERIFIED` |
| 对比度 / a11y | `verify-contrast.mjs`（31 PASS / 0 FAIL，已接 CI）、`test:axe`（2 spec，未接 CI） | 组件级 a11y 面板数据联动 | 既有通过，5.0 补充 `NOT_VERIFIED` |
| 视觉回归 | `test:visual`（已接 CI）、`test:visual:e2e`（未接 CI） | 展示单元双主题快照 | 部分覆盖，`NOT_VERIFIED` |

> 本轮未运行任何验证命令；「既有通过」仅复述 `UDS5-AUDIT-01` §4.4 / §5 / §7 只读门禁实测结论。CI 已接 / 未接清单与 `UDS5-S22` §9 一致：`test:axe` / `test:business:e2e` / `test:visual:e2e` / `components:registry:strict` / `format:check` 刻意未接。

---

## 10. 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 本文 12 项能力逐项规范 | `IMPLEMENTED_NOT_VERIFIED` | 规范文本已撰写，未改造展示中心 |
| 决策 D3（扩展既有、不引入 Storybook、不截图冒充） | `IMPLEMENTED` | §1 已声明 |
| 现状写实数字（24 区 / 2188 行 / Props 0 / 注册 ID 0 / a11y 0 / 示例 0 / 22 锚点漏 2 区） | `IMPLEMENTED` | §2 依据 `UDS5-AUDIT-01` §5.1 如实登记 |
| 双向关联 5 场景（A1–A5） | `NOT_STARTED` | 依赖 registry 路径字段补齐 |
| 状态 / variant / 尺寸切换器 | `NOT_STARTED` | §6 P2 |
| Props / 示例 / a11y / 测试状态面板 | `NOT_STARTED` | §6 P2 |
| `UTER-CMP-*` 注册 ID 体系 | `NOT_STARTED` | §6 P1 |
| `--strict` 由 EXIT=1 转 EXIT=0 | `NOT_STARTED` | §6 P4，当前 65 组件 0 VERIFIED |
| PC Web / H5 展示回归 | `NOT_VERIFIED` | 未针对 5.0 重跑 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无实现，不得用 Web 结果代替 |

**总体验证状态：`NOT_VERIFIED`**。本文不得被解读为 `FULLY_IMPLEMENTED_AND_VERIFIED`；展示中心改造的最终状态以 `UDS5-S25`（验收规范）与最终验收报告为准。
