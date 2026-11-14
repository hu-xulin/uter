# DESIGN-SYSTEM-MIGRATION-GUIDE — 3.0 → 5.0 迁移指南

| 字段 | 值 |
|---|---|
| 文档 ID | `UDS5-S27` |
| 版本 | `5.0.0` |
| 状态 | `ACTIVE` |
| 上级规范 | `UDS5-S01` |
| 生效日期 | `2026-11-14` |
| 适用范围 | UTER Design System 3.0 → 5.0 的规范、Token、组件、展示、注册与版本的迁移动作；PC Web / H5 |
| 验证状态 | `NOT_VERIFIED`（本轮仅撰写迁移指南，未执行任何迁移动作与验证） |

---

## 1. 迁移原则与边界

| # | 原则 | 依据 |
|---|---|---|
| M1 | **先写回归测试，再改动**；每处改动后可重跑只读门禁 | `UDS5-AUDIT-01` §9 D7 |
| M2 | **分期推进，不批量重写**全站 UI（3.0 自身 73 项验收未勾选、65 组件 0 VERIFIED） | `UDS5-AUDIT-01` §9 D7 / §14 结论 B |
| M3 | **不执行 git 操作**：不创建 / 切换分支、不暂存、不提交、不推送、不合并、不 `reset`；回滚走「备份还原 + 批次回退」 | `UDS5-AUDIT-01` §1 第 4 条、§13 第 5 条、`permission-policy.yaml` |
| M4 | **不触碰并发 WIP 禁改文件**（12 个）与 `.uap/**` 全部；211 项并发 WIP 不读取内容、不暂存、不覆盖 | `UDS5-AUDIT-01` §1 |
| M5 | **不执行全量构建**（`./rebuild-all.sh`、`bun run build:check`、`./scripts/verify-all.sh`）与 `./uap *` 写状态命令；改用只读门禁 | `UDS5-AUDIT-01` §1 第 3 条、§13 |
| M6 | **业务红线零改动**：支付 / 充值 / 余额 / 退款 / 订单 / 认证 / 授权 / 数据库契约零改动 | `UDS5-AUDIT-01` §6.1、§13 第 2 条 |
| M7 | **不引入新依赖**（Clerk SDK、Storybook 等） | `UDS5-AUDIT-01` §13 第 3 条、决策 D3 / D8 |
| M8 | 5.0 定位为「继承 + 统一版本 + 补齐证据与治理结构」，**非推倒重建** | `UDS5-AUDIT-01` §14 结论 A |

> 本文为迁移指南，**不新增、不修改任何代码 / 配置 / 历史版本文件**；下述四节为规划动作，非本轮已执行。

---

## 2. 版本号口径与「禁止混用无说明」

### 2.1 经审计核实的版本标识

| 标识 | 实际位置 | 值 | 证据 |
|---|---|---|---|
| 规范版本 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` | 3.0（全文唯一权威文件） | `UDS5-AUDIT-01` §3 |
| Token Manifest 版本 | 3.0 §28.5 `TOKEN-MANIFEST` | `version 3.0.1` / `updated 2026-11-13` | `UDS5-AUDIT-01` §3 |
| 组件注册表版本 | `web/src/design-system/component-registry.json` | `registryVersion 1.0.0` / `designSystem "UTER Design System 3.0"` | `UDS5-AUDIT-01` §5 |
| 5.0 规范版本 | `docs/design-system/uter-design-system-5.0/*.md` | `5.0.0` / `UDS5-S01`..`UDS5-S32` | 本组元数据表 |

### 2.2 「3.1」口径说明（防虚构）

| 项 | 说明 |
|---|---|
| 事实 | 经 `UDS5-AUDIT-01` 审计，仓库中**未发现独立的「3.1」规范文件**；存在的是 `TOKEN-MANIFEST version 3.0.1`（Manifest 版本，非规范版本）与 `registryVersion 1.0.0` |
| 约束 | 任何文档、注释、注册表或规范引用若出现「3.1」，**必须**在引用处标注其确切来源与与 3.0 / 5.0 的差异；不得以「3.1」作为未说明的版本依据 |
| 禁止 | **禁止 3.0 / 3.1 / 5.0 混用而无说明**：同一变更、同一文档、同一组件条目内不得同时引用多个版本标识而不标注归属；不得把 3.0 的验收状态继承为 5.0 的「已通过」 |

### 2.3 版本归属标注格式（强制）

```
[版本: 5.0.0 | 依据: UDS5-Sxx | 旧版: UTER-DESIGN-SYSTEM-3.0.md §yy | 变更: <保留/合并/删除/统一>]
```

> 引用旧版时必须写明 `旧版:` 章节号与变更类型；`UDS5-S24` 规范一致性检查 S01 / S03 / S04 负责拦截未标注的混用。

---

## 3. 第一节：保留（Keep）

> 字段固定为：`3.0 位置 → 5.0 位置 → 迁移动作 → 依赖检查 → 回滚方式`。依据 `UDS5-AUDIT-01` §11.1（经代码核实有效，8 条）。

| 项 | 3.0 位置 → 5.0 位置 | 迁移动作 | 依赖检查 | 回滚方式 |
|---|---|---|---|---|
| K1 品牌色全套 | `UTER-DESIGN-SYSTEM-3.0.md` §17.5 / `source/brand.tokens.json` → 5.0 颜色规范 `UDS5-S03` + 同一 DTCG 真源 | 全文继承，不改色值；品牌渐变深浅同值例外（E28）保留登记 | `generate-design-tokens.mjs --check` 源与生成 CSS 同步；`verify-contrast.mjs` 31 PASS | 无需回滚（未改动）；若误改，从备份还原 `source/brand.tokens.json` 并重跑 `design:tokens:check` |
| K2 字体与字号阶梯 | 3.0 §1.2 / `tokens/typography.css` `@theme --text-*`（18 档） → 5.0 字体规范 `UDS5-S04` + 保留同一 CSS | 保留 `@theme --text-*`（决策 D1，删除会使全站字号静默回退）；另立 `--ds-font-*` 语义别名仅用于文档与跨端映射 | `tokens.test.ts` 断言、17 条 showcase 校验、T1 门禁、`text-sm` 等 18 个工具类 | 从备份还原 `typography.css`；重跑 `lint:design:strict` 与 `sync-design-showcase.mjs --check` |
| K3 间距 / 边框 / 圆角 / 焦点环 | 3.0 §1.3–1.6 → 5.0 对应基础规范 | 继承 4pt 间距、1px 边框、8 个命名派生档 + `rounded-full` 特殊档（运行时 T10 称「圆角九档」）（5.0 纠正七档→八档）、2px 焦点环（`ring-2`，已裁决，取代 1px）、表面色差优先于重阴影 | `check-design-tokens.mjs --strict` 违规 0 | 同上，按文件备份还原 |
| K4 三层 Token 架构 + Spec/Runtime/派生产物 | 3.0 §28 Spec SSOT / `web/src/design-system/tokens/` Runtime SSOT / `showcase.html` 内联快照 → 5.0 保持一致 | 不新建第二套 TS 值 Token（决策 D6）；只补「Token 元数据注册表 + 校验器」 | 17 条 `sync-design-showcase.mjs` 校验、Manifest `3.0.1` 哈希自洽 | 还原新增校验器文件（删除即可），真源文件未动 |
| K5 T1–T17 门禁 / ALLOWLIST / 基线 / `--strict` | 3.0 §19.5 → 5.0 `UDS5-S24` | 保留 `ALLOWLIST=[]`、`web/design-tokens.baseline.json` 0 条只减不增、`--strict` 为 CI 唯一阻断模式；**不降低阈值、不扩基线** | 门禁配置核对、`design-tokens.baseline.json` 0 条 | 还原门禁脚本与 baseline 备份；重跑严格门禁 |
| K6 组件单一实现根 / `data-table/` / 注册表一致性 | `web/src/components/ui/*`（65）、`data-table/`（24 导出）、`component-registry.json` → 5.0 保持 | 保留单一实现根与双向一致性检查；`dropdown-menu.test.tsx` 平铺差异属 schema 显式排除（`:40`），**不补注册** | `components:registry:check`（65/65/0 errors） | 还原注册表备份；重跑 `components:registry:check` |
| K7 两个收口文件 | `brand-colors.ts`（T8 唯一裸色值所有者）、`chart-typography.ts`（T4 TS 镜像） → 5.0 保持 | 不拆分、不新增第二裸色值出口 | T8 / T4 静态扫描 | 按文件备份还原 |
| K8 3.0 全文 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（4,111 行 / 197,053 B） → 完整保留为历史版本 | **不删除、不改写**；5.0 分册通过 `旧版:` 标注引用 | 文件存在性 + 行数 / 字节数核对 | 从备份还原（本项本身不产生改动） |

---

## 4. 第二节：合并（Merge）

> 依据 `UDS5-AUDIT-01` §11.2（5 条，均为 5.0 决定、本轮未执行）。

| 项 | 3.0 位置 → 5.0 位置 | 迁移动作 | 依赖检查 | 回滚方式 |
|---|---|---|---|---|
| G1 三处同名 `EmptyState` | `components/empty-state.tsx:42`（正式）、`notification-popover.tsx:156`（局部）、`features/pricing/components/empty-state.tsx:29`（feature 内） → 统一到 `components/empty-state.tsx` | 合并重复实现，记录 feature 侧能力缺口；`notification-popover.tsx` 属并发 WIP 禁改文件，须待对应会话合入后执行 | 全仓引用扫描（P07 / C02）；确认 2 处局部实现无独有 props 依赖；`components:registry:check` | 按批次还原 3 个文件备份；重跑页面空态检查与注册表检查 |
| G2 52 个同名调色板 | `theme.css` / `theme-presets.css` 的 52 个同名基础键 → 单一 `:root` 基础层 + 预设只列差异键 | 重排声明，不改最终色值；`theme.css` 属并发 WIP 禁改文件 | 逐值比对 Light/Dark 与 7+ 套预设输出；`verify-contrast.mjs`；`build:check` 因并发 WIP 不执行，改只读门禁 | 还原 `theme.css` / `theme-presets.css` 备份；重跑 `lint:design:strict` |
| G3 typography 值 ↔ 工具类映射 | `tokens/typography.css`（值）与 `foundations/typography.css`（工具类） → 补「L1 声明 ↔ L3 消费」机器可校验映射表 | 新增映射表（不新建第二套值 Token，决策 D6）；同时根治 3 个纯别名构建压缩缺陷（`foundations/typography.css:55-66`） | 映射表与 `@theme` / `@utility` 一致性校验；`var()` 引用必须有声明（T02） | 删除新增映射表并还原 `foundations/typography.css` 备份；重跑 17 条校验 |
| G4 双产物统一 | `showcase.html` 内联快照（主交付）与 `showcase.tokens.js`（1,241 行兼容回退） → 「主交付=内联快照，回退=可选产物」 | **须先同步修改 17 条 `sync-design-showcase.mjs` 校验契约方可变更**；回退产物保留但不作为第二真源 | `sync-design-showcase.mjs --check` 17 PASS / 0 FAIL；`design:showcase:check` 已接 CI | 还原 `showcase.html` / `showcase.tokens.js` / 校验脚本备份；重跑 `design:showcase:check` |
| G5 注册表模型投影 | `component-registry.json`「契约 + 证据」模型 → 与 5.0「路径 / 文档 / 展示」模型合并 | 由生成式 YAML 投影合并，**JSON 仍为唯一真源**；补齐 11 项字段（`layer / source / implementation_path / specification_path / test_path / story_path / variants / states / accessibility / deprecated / replacement`） | `components:registry:check` 65/65/0；`--strict` EXIT=1 须保留至证据补齐 | 还原 `component-registry.json` 备份及投影产物；重跑注册表检查 |

---

## 5. 第三节：删除（Deprecate / Delete）

### 5.1 删除前置条件（必须全部满足，缺一不可）

| # | 前置条件 | 判定方式 |
|---|---|---|
| D1 | **无依赖**：目标文件 / Token / 组件在全仓无任何静态或间接引用 | `UDS5-S24` T03 / S04 / A4 引用扫描；`@theme` 变量由工具类间接消费、语义色由 Tailwind 类消费，均须逐项验证构建产物 |
| D2 | **不影响业务**：删除不触及支付 / 余额 / 订单 / 退款 / 认证 / 授权 / 数据库契约与前端行为 | diff 审计 + 业务红线拦截器（`UDS5-S22` §1、R1–R5） |
| D3 | **先备份**：删除前在约定位置留存可还原副本，并记录备份路径、时间、原文件哈希 | 备份清单登记 |
| D4 | **走废纸篓**：优先移入废纸篓 / 归档目录而非永久删除，保留可恢复窗口 | 归档路径登记；禁止 `rm -rf` 不可逆删除 |
| D5 | **每批 ≤ 10**：单批删除条目数 ≤ 10，逐批重跑只读门禁后再进入下一批 | 批次台账 + `lint:design:strict` / `components:registry:check` / `design:showcase:check` |
| D6 | 本轮**不执行删除**：`UDS5-AUDIT-01` §13 第 4 条「不删除任何组件、测试、Token 或业务代码」；本节仅列候选与流程 | 审计约束 |

### 5.2 删除候选逐项表

> 依据 `UDS5-AUDIT-01` §11.4（列候选、不删除）。所有候选当前状态 `NOT_STARTED`。

| 项 | 3.0 位置 → 5.0 位置 | 迁移动作 | 依赖检查 | 回滚方式 |
|---|---|---|---|---|
| X1 零引用 Token 候选（25 个） | `tokens/primitives.css:33-68` 的 `--primitive-font-size-*`(8) / `--primitive-line-*`(7) / `--primitive-space-*`(10) → 候选清理清单（`UDS5-S28` 废弃登记） | **仅登记候选，不删除**；约 93 个零静态引用变量是候选清理上限，非死代码结论 | D1 逐项验证 `@theme` / Tailwind 间接消费；按 §11 流程验证构建产物 | 候选未删除无需回滚；若误删，从废纸篓还原并逐值比对 Manifest 哈希 |
| X2 约 93 个零引用中的其余项 | 约 33 个 `--ds-color-*`、9 个 `--ds-radius-*` 等 → 候选清单 | 逐项核实后再决定是否进入废弃流程；**不批量删除** | 同 D1 | 同上 |
| X3 展示页引用修正 | `showcase-3.0.html` 已于 `9a7234787` 退役、`412f0a28b` 更名为 `showcase.html`；遗留引用在 `visual-regression.mjs` / `tokens.test.ts` 已改为 `showcase.html`（2026-11-14） | 修正引用路径，不改展示页内容 | 已修正；`showcase-3.0.generated.html` 仍按需生成不入库 | 重跑 `design:showcase:check`（17/0 PASS） |
| X4 临时状态退出 | E24 / P1–P3 / 字体轴 / PageHeader 的「临时状态」 → `UDS5-S28` 退出条件台账 | 给出明确退出条件，未达成前保持 Pending；**不得把 3.0 §22 的 73 个未勾选继承为已通过** | 退出条件证据链（对比度 / 色板 / 图表 Token / 装饰层 / 字体轴 / 独立组件） | 台账为新增文档，回退即删除台账条目（不影响业务代码） |
| X5 `dropdown-menu.test.tsx` 归位（重构，非删除） | 平铺在 `ui/` → `ui/__tests__/` | 移动文件并同步 `evidence.tests` 路径；属重构，**不删除测试**（G3 铁律） | `components:registry:check` 的 `:40` 显式排除规则；`evidence.tests[]` 路径有效（S07） | 还原文件位置与注册表 `evidence.tests` 备份；重跑注册表检查 |

---

## 6. 第四节：版本统一

| 项 | 3.0 位置 → 5.0 位置 | 迁移动作 | 依赖检查 | 回滚方式 |
|---|---|---|---|---|
| V1 `designSystem` 字段 | `web/src/design-system/component-registry.json` 的 `designSystem "UTER Design System 3.0"` → `5.0` | **必须与 `web/scripts/check-component-registry.mjs:45` 的硬编码校验在同一变更内升级** | 见 §6.1 | 见 §6.1 |
| V2 规范元数据版本 | 3.0 单文件 → 5.0 全部 32 份分册（S01–S32 = 28 基础 + 4 业务域）元数据表 `版本 5.0.0` / `上级规范 UDS5-S01` / `验证状态 NOT_VERIFIED` | 统一元数据口径；文档 ID 唯一且与文件名一一对应 | `UDS5-S24` S01 / S05（文档存在且非空、≥100 行、必备章节齐全） | 按文件备份还原；重跑规范一致性检查 |
| V3 引用版本标注 | 3.0 §yy 引用 → 5.0 分册引用须带 `旧版:` 与变更类型 | 按 §2.3 格式标注；禁止 3.0 / 3.1 / 5.0 混用无说明 | S01 / S03 / S04 引用路径与版本归属检查 | 还原引用处文本；重跑 S04 |
| V4 `TOKEN-MANIFEST` 版本 | 3.0 §28.5 `version 3.0.1` → 5.0 Manifest | 升级须同步内联快照与 17 条校验契约（与 G4 同一约束） | `sync-design-showcase.mjs --check` 哈希自洽、17 PASS / 0 FAIL | 还原 Manifest / 快照 / 校验脚本备份；重跑 `design:showcase:check` |
| V5 `registryVersion` | `component-registry.json` `registryVersion 1.0.0` → 5.0 视字段补齐情况统一 | 与 V1 同变更协调；不得单独改动导致格式校验失败 | S03 注册格式校验 | 还原注册表备份 |

### 6.1 V1 同变更内升级的硬约束（重点）

| 项 | 内容 |
|---|---|
| 事实 | `component-registry.json` 的 `designSystem` 当前为 `"UTER Design System 3.0"`；`check-component-registry.mjs:45` 含硬编码版本校验 |
| 约束 | 二者**必须在同一变更内升级**（`UDS5-AUDIT-01` §11.3 第 4 条）：只改 JSON 不改脚本校验，或只改脚本不改 JSON，都会导致 `components:registry:check` / `--strict` 门禁失败 |
| 依赖检查 | 变更前：记录两处旧值与备份；变更后：`components:registry:check` 须 `65/65/0 errors`、`designSystem` 值一致；`--strict` 当前 EXIT=1 属未闭合项，升级动作本身不得使其恶化 |
| 禁止 | 不得为绕过该校验而删除 / 放宽 `:45` 的硬编码规则（违反 `UDS5-S24` G1–G3） |
| 回滚方式 | 同批次还原 `component-registry.json` 与 `check-component-registry.mjs` 两个备份文件，重跑 `components:registry:check` 确认回到 65/65/0；**不通过 git 分支 / reset 实现**（M3） |

---

## 7. 旧版迁移历史必须保留

| 项 | 保留要求 | 依据 |
|---|---|---|
| 3.0 全文 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（4,111 行 / 197,053 B）不删除、不改写 | `UDS5-AUDIT-01` §11.1 第 8 条 |
| 3.0 审计证据 | `docs/design-system/audit/evidence/` 16 个文件（2026-11-03）保留；标注为基线快照、非 3.0 终版复核 | `UDS5-AUDIT-01` §3 |
| 变更日志 | `UDS5-S26` 记录 2026-11-03 / 11-12 / 11-13 / 11-14 全部时间线与五类动作 | `UDS5-S26` |
| 废弃登记 | 所有删除 / 退役条目按 `UDS5-S28` 登记格式留痕（编号 / 生效版本 / 原因 / 替代 / 迁移期限 / 责任人 / 证据） | `UDS5-S28` |
| 例外与待办 | E24 / E28 / P1–P3 / 字体轴 / PageHeader 的临时状态与退出条件保留台账 | `UDS5-AUDIT-01` §11.4、`UDS5-S28` |
| 派生产物回退 | `showcase.tokens.js` 兼容回退保留为可选产物（G4 不永久删除） | `UDS5-AUDIT-01` §11.2 第 4 条 |

> 迁移历史不是「可清理的临时文件」；任何删除迁移历史的动作视为违反 M8 与 §11.1 第 8 条。

---

## 8. 迁移批次与回滚总流程

| 步骤 | 动作 | 门禁 / 证据 |
|---|---|---|
| B0 | 建立备份清单（路径、时间、原文件哈希），确认 12 个并发 WIP 禁改文件未被纳入本批 | `UDS5-AUDIT-01` §1 |
| B1 | 单批 ≤ 10 条（删除类严格按 §5.1 D5；合并 / 版本统一类同样分批） | 批次台账 |
| B2 | 每处改动先写回归测试（M1） | 新增 / 更新的测试文件 |
| B3 | 执行改动（保留 / 合并 / 删除候选 / 版本统一） | diff 仅限白名单路径 |
| B4 | 重跑只读门禁：`lint:design:strict`、`design:tokens:check`、`design:showcase:check`、`verify:contrast`、`components:registry:check` | 违规 0 / 17 PASS / 31 PASS / 65-65-0 |
| B5 | 失败则按各节「回滚方式」还原本批备份并重跑 B4；**不通过降低阈值 / 忽略规则 / 删测试制造 PASS** | `UDS5-S24` G1–G3 |
| B6 | 记录本批结果到 `UDS5-S26` 变更日志与 `UDS5-S28` 废弃登记 | 台账更新 |
| B7 | 全量构建与 `./uap *` 不执行，标 `NOT_EXECUTED`；三平台验收标 `NOT_VERIFIED` | `UDS5-AUDIT-01` §1 / §14 |

---

## 9. 与其他规范的关系

| 规范 ID | 关系 | 说明 |
|---|---|---|
| `UDS5-S01` | 上级 | 服从总纲效力、ID 体系与验证状态口径 |
| `UDS5-AUDIT-01` | 事实依据 | §11.1–11.4 提供保留 / 合并 / 重构 / 废弃全部决定；§1 / §13 提供迁移边界 |
| `UDS5-S21` | 被引用 | 业务红线零改动与「不引入 Clerk SDK」约束 |
| `UDS5-S23` | 关联 | G4 双产物统一与 17 条校验契约、注册 ID 补齐 |
| `UDS5-S24` | 下游 / 执行 | S01 / S03 / S04 / S07 检查与 G1–G7 铁律为本指南提供门禁与拦截 |
| `UDS5-S25` | 下游 | 迁移结果作为验收清单证据；8 状态口径一致 |
| `UDS5-S26` | 关联 | 迁移批次结果登记到变更日志 |
| `UDS5-S28` | 关联 | 删除候选与临时状态退出条件由废弃治理标准登记 |

---

## 10. 代码实施位置

| 类别 | 真实路径 | 本文关联 | 本轮状态 |
|---|---|---|---|
| 3.0 历史版本 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（4,111 行 / 197,053 B） | §3 K8 / §7 | 存在，未改动 |
| Token 真源 | `web/src/design-system/tokens/*.css`（14 个 CSS）、`source/brand.tokens.json` | §3 K1–K4 | 存在，未改造 |
| 主题（禁改） | `web/src/styles/theme.css`、`theme-presets.css` | §4 G2 | 存在，属并发 WIP 禁改 |
| 基础样式 | `web/src/design-system/foundations/typography.css:55-66` | §4 G3 | 存在，未改造 |
| UI 组件（禁改部分） | `web/src/components/ui/*`、`components/empty-state.tsx`、`notification-popover.tsx`、`features/pricing/components/empty-state.tsx` | §4 G1 | 存在，未改造 |
| 组件注册 | `web/src/design-system/component-registry.json`（`designSystem "UTER Design System 3.0"`） | §6 V1 | 存在，未改造 |
| 注册校验 | `web/scripts/check-component-registry.mjs:45` | §6 V1 | 存在，未改造 |
| 展示中心 | `docs/design-system/showcase.html`、`showcase.tokens.js` | §4 G4 | 存在，未改造 |
| 展示脚本 | `web/scripts/sync-design-showcase.mjs`、`generate-design-showcase.mjs:25-29` | §4 G4 / §5 X3 | 存在，未改造 |
| 门禁脚本 | `web/scripts/check-design-tokens.mjs`、`generate-design-tokens.mjs`、`verify-contrast.mjs` | §8 B4 | 存在，未改造 |
| 审计证据 | `docs/design-system/audit/evidence/`（16 个文件） | §7 | 存在，未改动 |

> 本文为迁移指南，**不新增、不修改任何代码 / 配置 / 历史版本文件**；§3–§6 的迁移动作均为规划项，本轮状态 `NOT_STARTED` / `NOT_VERIFIED`。

---

## 11. 自动化验证

| 验证项 | 现有实现 | 5.0 拟补充 | 当前结果 |
|---|---|---|---|
| 版本统一一致性（V1） | `components:registry:check`（65/65/0） | `designSystem` 与 `:45` 同变更校验（S03） | 未执行 `NOT_VERIFIED` |
| 删除前置条件 D1–D6 | 无 | 引用扫描 / 业务红线拦截 / 批次 ≤10 检查 | 未建立 `NOT_VERIFIED` |
| 合并后数据链一致 | `design:showcase:check`（17 PASS）、`design:tokens:check`（EXIT=0） | 合并后逐值比对 | 未执行 `NOT_VERIFIED` |
| 禁止 3.0/3.1/5.0 混用 | 无 | 版本归属标注格式检查（§2.3） | 未建立 `NOT_VERIFIED` |
| 旧版迁移历史保留 | 文件存在性核对 | 3.0 全文 / 证据 / 变更日志 / 废弃登记完整性检查 | 未执行 `NOT_VERIFIED` |
| 门禁铁律 | `lint:design:strict`、`verify-contrast.mjs` 等 | 回滚后重跑 B4 流程 | 未执行 `NOT_VERIFIED` |

> 本轮未运行任何验证命令；「现有实现」列的实测结论复述自 `UDS5-AUDIT-01` §4.4 / §5 / §7，非本轮执行结果。CI 已接 / 未接清单见 `UDS5-S24` §9。

---

## 12. 验证状态

| 项 | 状态 | 说明 |
|---|---|---|
| 保留 / 合并 / 删除 / 版本统一四节逐项 5 字段 | `IMPLEMENTED_NOT_VERIFIED` | 迁移指南已撰写，未执行迁移 |
| 删除前置条件 D1–D6 | `IMPLEMENTED` | §5.1 已定义 |
| `designSystem` + `:45` 同变更内升级硬约束 | `IMPLEMENTED` | §6.1 已声明 |
| 禁止 3.0/3.1/5.0 混用无说明 | `IMPLEMENTED` | §2 已定义，附 3.1 口径防虚构说明 |
| 旧版迁移历史保留 | `IMPLEMENTED` | §7 已声明 |
| 全部迁移动作（K/G/X/V） | `NOT_STARTED` | 按 §8 批次推进 |
| 全量构建 / `./uap *` / 视觉双轨 / 原生验收 | `NOT_EXECUTED` / `NOT_VERIFIED` | `UDS5-AUDIT-01` §1 / §14 |
| PC Web / H5 | `NOT_VERIFIED` | 未针对 5.0 重跑 |
| Android / iOS / HarmonyOS | `NOT_VERIFIED` | 无实现（决策 D4） |

**总体验证状态：`NOT_VERIFIED`**。本文不得被解读为 `FULLY_IMPLEMENTED_AND_VERIFIED`；迁移完成的最终状态以 `UDS5-S25`（验收规范）与最终验收报告为准。
