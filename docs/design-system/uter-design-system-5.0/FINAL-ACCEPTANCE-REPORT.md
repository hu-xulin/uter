<!--
UDS5-F01
-->
# UTER Design System 5.0 · 最终验收报告

> 文档 ID：`UDS5-F01`
> 版本：`UTER_DESIGN_SYSTEM_VERSION = 5.0`
> 编制日期：2026-11-14
> 编制人：team-lead（UAP 治理执行）
> 关联规范：`UDS5-S25`《DESIGN-SYSTEM-ACCEPTANCE-STANDARD.md》

---

## 0. 结论先行（诚实状态）

**最终状态：`IMPLEMENTED_NOT_VERIFIED`（已实现-未验证）**

`FULLY_IMPLEMENTED_AND_VERIFIED` 在本轮**不可达**，原因如下（逐项见 §3 / §5）：

1. 组件工程与页面适配**未做实际代码改动**——65 个组件的 `VERIFIED` 证据仍为 `0 VERIFIED / 9 PARTIAL / 56 NOT_VERIFIED`，`components:registry:strict` 仍 `EXIT=1`。
2. Android / iOS / HarmonyOS 平台**无原生工程、无任何实现**，按验收标准必须 `NOT_VERIFIED`。
3. 3.0 §22 的 73 项验收、E24 两处对比度、Uter 品牌三态色值与运行时 DTCG 差异、`h1/h2` 字号差异、`--ds-font-*` 语义别名落地等**均未闭合**。
4. **独立验收未执行**——本报告使用的是实施阶段同批次的验证证据，未另起隔离环境复测，按 `UDS5-S25` 不得登记为 `INDEPENDENT_VERIFIED`。
5. 工作区存在 391 项并发脏区（其他 UAP/会话 WIP），**未做 git 提交**，因此无 Commit SHA 可供固化证据链。

本报告不伪造 `PASS`，不宣布 `FULLY_IMPLEMENTED_AND_VERIFIED`。

---

## 1. 用户原始交付目标对照

| # | 目标项 | 要求 | 本轮实际 |
|---|-------|------|----------|
| 1 | `SPECIFICATIONS` | COMPLETE | **PARTIAL** — 28 份 5.0 规范 + 2 份审计报告 + 2 份注册表 + 变更/废弃/验收/迁移文档均已创建（内容完整），但每份文档 `验证状态` 一律 `NOT_VERIFIED`，未执行文档级验收。 |
| 2 | `DESIGN_TOKENS` | COMPLETE | **PARTIAL** — Token 三层真源（3.0 §28 Manifest / `tokens/`+`theme.css` / `showcase.html` 内联快照）工程化校验通过（`design:tokens:check`、`design:showcase:check` 17/0、`sync-design-showcase.mjs`）；但 `--ds-font-*` 语义别名未落地、品牌三态色值差异未闭合。 |
| 3 | `COMPONENT_REGISTRY` | COMPLETE | **PARTIAL** — `component-registry.json`（65 组件真源）+ `COMPONENT-REGISTRY.yaml`（5.0 投影）已生成且双向一致（`components:registry:check` EXIT=0）；但 65 组件证据 `NOT_VERIFIED`（strict 仍 EXIT=1）。 |
| 4 | `COMPONENT_IMPLEMENTATION` | COMPLETE | **NOT_DONE** — 本轮未对 `web/src/components/ui/*` 做任何组件代码升级/合并/清理；仅完成注册表与文档登记。 |
| 5 | `PAGE_ADAPTATION` | COMPLETE | **NOT_DONE** — 未对现有业务页面做 5.0 适配代码改动。 |
| 6 | `AUTOMATED_VALIDATION` | PASS | **PARTIAL** — 新增 `design:5:check` 校验器 + `design:5:check/sync/strict` 三个 npm scripts + CI `frontend` job 接入；既有门禁（`lint:design:strict`、`design:tokens:check`、`design:showcase:check`、`verify:contrast`、`components:registry:check`）全部 EXIT=0。但 `test:visual` 在 `showcase.html` 上暴露既有页面级 a11y 问题、`components:registry:strict` 仍 EXIT=1。 |
| 7 | `INDEPENDENT_ACCEPTANCE` | PASS | **NOT_DONE** — 未执行隔离环境独立复测。 |
| 8 | `FINAL_STATUS` | `FULLY_IMPLEMENTED_AND_VERIFIED` | **`IMPLEMENTED_NOT_VERIFIED`**（不达标，如实报告）。 |

---

## 2. 已交付物（真实存在、可核对）

### 2.1 规范文档（35 份，位于 `docs/design-system/uter-design-system-5.0/`）
- 总纲 `01-UTER-DESIGN-SYSTEM-5.0.md`（458 行）及其下 02–13 共 12 份基础/组件/页面/交互/表单/数据/通知/Clerk/业务适配/展示/自动化/验收/迁移/废弃标准（合计 28 份标准文档，编号 `UDS5-S01`–`UDS5-S28`）。
- 审计报告 2 份：`audit/BASELINE-AUDIT.md`（`UDS5-AUDIT-01`）、`audit/CLERK-DESIGN-REFERENCE-ANALYSIS.md`（`UDS5-AUDIT-02`）。
- 注册表 2 份：`DESIGN-STANDARD-REGISTRY.yaml`（`UDS5-R01`）、`COMPONENT-REGISTRY.yaml`（`UDS5-R02`）。
- 变更/治理文档：`DESIGN-SYSTEM-CHANGELOG.md`、`DESIGN-SYSTEM-MIGRATION-GUIDE.md`、`DESIGN-SYSTEM-DEPRECATION-STANDARD.md`（编号 `UDS5-S26`–`UDS5-S28`）。

### 2.2 自动化治理（新增，真实文件）
- `web/scripts/check-design-system-5.0.mjs`：规范 ID 唯一性、文档 ID 反向登记、注册表与真源一致、Token 跨文件无重复、`@theme` 字号唯一来源、Primitive→Semantic 单向依赖、Light/Dark 品牌变量成对、显式已知缺口登记。支持 `--generate`（由 JSON 真源生成 YAML 投影）与 `--strict`。
- `web/package.json` 新增脚本：`design:5:check`、`design:5:sync`、`design:5:strict`。
- `.github/workflows/ci.yml` 的 `frontend` job 新增步骤：`bun run design:5:check`（不降低 T1–T17、ALLOWLIST 或 baseline）。

### 2.3 回归测试（新增，真实文件）
- `web/src/design-system/__tests__/design-system-5-governance.test.ts`：7 个 Vitest 用例，保护 5.0 Token/注册表不变量（`@theme --text-*` 唯一 owner、`registeredFiles==implementationFiles`、`yamlIds==jsonIds` 等）。运行：`7 passed / 0 failed`，EXIT=0。

### 2.4 缺陷根因修复（本轮实际修复的破坏项）
- **展示页失效引用根因修复**（commit `9a7234787` 删除 `showcase-3.0.html`、`412f0a28b` 改为 `showcase.html` 但遗留引用）：
  - `web/scripts/visual-regression.mjs`：L18/L37/L300 由 `showcase-3.0.html` 改为 `showcase.html`。
  - `web/src/design-system/__tests__/tokens.test.ts`：`SHOWCASES` 由 `showcase-3.0.html` 改为直接比对 `theme.css` ↔ `primitives.css` 圆角阶梯（去 HTML 依赖，仍为有意义不变量）。结果：`tokens.test.ts` 由 `3 failed / 40 passed` → `48 passed / 0 failed`，EXIT=0；`design:showcase:check` 仍为 17/0 PASS。
- **`/docs` axe 失败根因**：非源码缺陷，而是 `web/dist` **构建产物过期**（构建于 11/13 19:00，早于接入 rehype 插件的提交 `80b386083` 11/14 00:58）。重新构建后 `bun run test:axe` → `EXIT=0`（13 passed / 1 skipped，`/docs` 在通过之列）。构建期插件 `rehypeTasklistLabels`（`rsbuild.config.ts:57`）与运行时兜底 `task-checkbox-a11y.ts` 均已生效。

---

## 3. 十二项验收条件（`UDS5-S25` §6）逐条核对

| 条件 | 要求 | 状态 | 说明 |
|------|------|------|------|
| C1 | 规范文档 100% 创建且 ID 唯一 | 33 ID 唯一（validator 已验证） | **PARTIAL** — 文档存在、ID 唯一，但每份 `验证状态` 未闭合（`NOT_VERIFIED`）。 |
| C2 | Design Tokens 三态完整且零重复 | 245 唯一变量 / 8 CSS / 0 跨文件重复 | **PARTIAL** — 工程化校验通过；`--ds-font-*` 未落地、品牌色差异未闭合。 |
| C3 | 组件注册表与真源一致 | json=65 / yaml=65 / 双向一致 | **PARTIAL** — 一致已验证；但 65 组件证据 `NOT_VERIFIED`。 |
| C4 | 组件实现 100% 升级/合并/清理 | — | **NOT_DONE** — 未做组件代码改动。 |
| C5 | 页面适配 100% 完成 | — | **NOT_DONE** — 未做页面代码改动。 |
| C6 | 展示中心具备 Props/ID/a11y/示例 | — | **NOT_DONE** — `showcase.html` 为静态快照，无 Props/注册 ID/组件级 a11y/代码示例（23/24 区锚点缺失）。 |
| C7 | 自动化治理 100% 接入 CI | `design:5:check` 已接 CI | **PARTIAL** — 校验器已接 CI；`components:registry:strict`、`test:visual:e2e`、`test:axe` 等未全部接入。 |
| C8 | 全量测试通过（typecheck/lint/test/build/visual/a11y/responsive/dark） | — | **PARTIAL** — `typecheck` 仅定向通过（全量 lint 9 errors 为 WIP/既有文件）、`test` 全量 `4 failed / 3057 passed`（2 为 showcase 引用已修、1 为 channel-configuration 超时、1 为另 timeout）、`build` 通过、`test:axe` 重建后通过、`test:visual` 暴露 `showcase.html` 既有问题。 |
| C9 | 独立验收通过 | — | **NOT_DONE** — 未执行隔离复测。 |
| C10 | 迁移结果可复核 | 迁移指南 + 废弃标准已建 | **PARTIAL** — 文档就绪；实际代码迁移（组件 registry `designSystem` 字段升级等）未执行。 |
| C11 | 变更文件清单 + Commit SHA | — | **NOT_DONE** — 工作区 391 项脏区未提交，无 SHA。 |
| C12 | 遗留问题/未验证项显式登记 | 本报告 §5 | **DONE** — 已逐项登记。 |

> 仅当 C1–C12 全部 `VERIFIED` 或 `DONE` 才允许 `FULLY_IMPLEMENTED_AND_VERIFIED`。当前 C4/C5/C6/C9/C11 = NOT_DONE，故最终判级 `IMPLEMENTED_NOT_VERIFIED`。

---

## 4. 自动化与门禁实际结果（真实退出码）

| 检查 | 命令 | 结果 | 备注 |
|------|------|------|------|
| 5.0 结构治理 | `bun run design:5:check` | **EXIT=1 → 创建本报告后 EXIT=0**（仅 1 error：本报告曾缺失） | 74 个 `NOT_VERIFIED` gap 在默认模式下不阻断；strict 模式会升级为失败。 |
| 5.0 治理回归测试 | `vitest design-system-5-governance.test.ts` | 7/7 PASS，EXIT=0 | 新增 7 用例。 |
| 设计门禁 | `bun run lint:design:strict` | EXIT=0（1276 文件 / 0 违规） | T1–T17。 |
| Token 校验 | `bun run design:tokens:check` | EXIT=0 | DTCG 源↔生成 CSS。 |
| 展示页校验 | `bun run design:showcase:check` | 17 PASS / 0 FAIL，EXIT=0 | 内联快照↔Manifest 逐值。 |
| 对比度 | `bun run verify:contrast` | 31 PASS / 0 FAIL，EXIT=0 | E24/E28。 |
| 组件注册表 | `bun run components:registry:check` | EXIT=0（65 warning） | strict 仍 EXIT=1（证据 NOT_VERIFIED）。 |
| 单测（全量） | `bun run test` | 4 failed / 3057 passed，EXIT=1 | 2 个 showcase 引用（已修，待重跑确认归零）；2 个为 channel-configuration 超时（既有/WIP，非 5.0 引入）。 |
| 视觉回归 | `bun run test:visual` | EXIT=1 | 修复路径后真实加载 `showcase.html`，暴露该页面**既有** a11y/溢出/字号问题（MIN_FONT_SIZE / ACCESSIBLE_NAMES / AXE_WCAG / RESPONSIVE_OVERFLOW），属 `showcase.html` 自身问题，非 5.0 引入，本轮不修改该页。 |
| 可访问性 | `bun run test:axe` | 重建后 EXIT=0（13 passed / 1 skipped） | `/docs` 之前因 stale `web/dist` 失败，重建后通过。 |
| 类型检查（定向） | `bunx tsc` 针对新增文件 | EXIT=0 | 全量 lint 仍有 9 errors，均为 WIP/既有文件（如 `src/__axe-experiment.test.ts`）。 |

---

## 5. 未验证项与遗留问题（显式登记，不掩盖）

### 5.1 平台验收（必须 NOT_VERIFIED）
- **Android / iOS / HarmonyOS**：仓库无原生工程、无 `*.kt/*.swift/*.java/*.m/*.mm`、无 Capacitor/Flutter/RN/uni-app。无任何实现 → `NOT_VERIFIED`。

### 5.2 组件与页面工程
- 65 组件 `VERIFIED` 证据：`0 VERIFIED / 9 PARTIAL / 56 NOT_VERIFIED` → `components:registry:strict` `EXIT=1`。
- 3 处同名 `EmptyState` 合并未在代码层执行（仅文档登记）。
- 现有业务页面零 5.0 适配代码改动。

### 5.3 展示中心
- `showcase.html` 为静态 DOM 展示，无 Props、注册 ID、组件级 a11y、代码示例、状态/variant/尺寸/Light-Dark 切换面板；区域 23/24 锚点缺失。无 Storybook（D3 决定不引入）。

### 5.4 规范层差异（已登记 Adapt / NOT_VERIFIED，本轮不改代码值）
- **品牌三态色值**：用户基线六色（`#5B5EE6/#494CC7/#3F42B0` + Dark `#8B8DF5/#A1A3F7/#B7B8FA`）与运行时 DTCG（`source/brand.tokens.json`、`generated/brand.css`：`#4F52D1/#4A4DC5/#A1A3F7/#B1B3FF/#9294F7`）不一致；`brand.tokens.json` `status: DRAFT` / `decision: AUTO_BLOCKED` 未解除。按 `AGENTS.md`「设计值来自代码」，运行时以 `brand.css` 为准；规范层保留用户基线声明；差异于 `01 §4.2`、`03 §2.1`、`10 §10.1 / S10-D7` 登记 `Adapt / NOT_VERIFIED`。
- **`h1/h2` 字号**：用户基线 `h1 28/600/36`、`h2 22/600/30` 与 `@theme` 运行真值 `h1 30/38`（`--text-4xl`）、`h2 24/32`（`--text-3xl`）不一致；于 `01 §4.2`、`04 §4.3` 登记 `Adapt / NOT_VERIFIED`。`h3 18/26`、`display 36/44` 一致。
- **焦点环**：裁决为 **2px `ring-2`**（`tokens/semantic.css:123` `--ds-focus-ring-width: 2px`；3.0 §15.1 恒 2px）；用户 PART 0 仅规定边框 1px、未规定焦点环；旧 MEMORY.md 的「1px `ring-1` 勿回 2px」为过时记忆，已作废。`NOT_VERIFIED`（未执行浏览器级守卫复核）。装饰性 `ring-1` 描边 1px 为真实有效值，不承载焦点语义，原样保留。
- **`--ds-font-*` 语义别名**：D1 决策为保留运行时 `@theme --text-*`，规范层另立 `--ds-font-*` 别名方案，但**未落地**到任何代码。

### 5.5 3.0 历史验收
- 3.0 §22 的 **73 项验收**未勾选（验收项本身未闭合）。
- **E24** 两处对比度登记为 `NOT_VERIFIED`（对比度脚本 31 PASS 不含 E24 专项）。

### 5.6 缺陷根因修复状态
- showcase 失效引用：已修复，`tokens.test.ts` 归零待全量复跑确认。
- `/docs` axe stale dist：已重建通过；但提示「前端改动后须运行 `./rebuild-all.sh`（带 `--no-docs` 防 web/dist 回滚）再嵌入 Go 二进制」，否则运行实例仍服务旧产物。

### 5.7 并发 WIP 与 Git
- 工作区 `git status --short` = **391 项脏区**（含 152 个 `.uap/` 未跟踪、其他会话的 `.uap/reports/*`、`.github/workflows/ci.yml`、`web/src/__axe-experiment.test.ts` 等）。
- 本轮**未执行任何 git add / commit / push / branch**，避免混入并发 WIP 或覆盖未提交修改。
- 因此无 Commit SHA，证据链未固化。

---

## 6. 治理裁决汇总（本轮定案）

| 编号 | 议题 | 裁决 | 依据 |
|------|------|------|------|
| D-焦点环 | 焦点环宽度 | **2px `ring-2`**；1px 过时记忆作废 | `AGENTS.md`「设计值来自代码」+ `semantic.css:123` + 3.0 §15.1；HEAD 提交 `412f0a28b` 已采用 2px |
| D-装饰描边 | `ring-1` 装饰性描边 | **保留 1px**（真实值，不承载焦点语义） | 3.0 §15.1 分类；07 分册登记 |
| D-品牌色 | 六色基线 vs 运行时 DTCG | **Adapt / NOT_VERIFIED**；运行时以 `brand.css` 为准，不改色值 | `AGENTS.md` 设计值来自代码；DRAFT/AUTO_BLOCKED 未解除 |
| D-h1/h2 | 字号差异 | **Adapt / NOT_VERIFIED**；不改代码值 | `@theme` 运行真值 |
| D-展示页 | 是否引入 Storybook | **不引入**（D3） | 维护成本与增益不匹配 |
| D-平台 | 原生平台验收 | **NOT_VERIFIED** | 无实现 |

---

## 7. 变更文件清单（本轮创建/修改，未提交）

新增：
- `docs/design-system/uter-design-system-5.0/` 下 35 份规范/审计/注册/治理文档。
- `web/scripts/check-design-system-5.0.mjs`
- `web/src/design-system/__tests__/design-system-5-governance.test.ts`

修改：
- `web/package.json`（新增 `design:5:check` / `design:5:sync` / `design:5:strict`）
- `.github/workflows/ci.yml`（`frontend` job 增加 `bun run design:5:check`）
- `web/scripts/visual-regression.mjs`（showcase 路径 → `showcase.html`）
- `web/src/design-system/__tests__/tokens.test.ts`（圆角断言改为 `theme.css↔primitives.css` 真源比对）
- 5.0 规范文档内的治理裁决登记（焦点环/品牌色/h1-h2/装饰描边/路径笔误修正）

未修改（刻意保持）：所有 `web/src/components/ui/*` 组件、所有业务页面、所有 `.go` 文件、所有支付/余额/订单/退款/认证/授权逻辑、运行时代码色值。

---

## 8. 建议的下一步（不自动执行）

1. **组件/页面工程**：对 65 组件做实际 5.0 升级/合并/清理，补齐 `VERIFIED` 证据，使 `components:registry:strict` 归零。
2. **平台验收**：如确有移动端需求，另起原生工程并登记验收证据；否则在验收标准中显式标注「不适用」。
3. **差异闭合**：品牌三态色值与 h1/h2 差异走 `01 §19` 变更流程（先写回归测试 → 改 `brand.tokens.json`/`theme.css` → 同步 Manifest/ALLOWLIST → 补证据），并解除 `AUTO_BLOCKED`。
4. **展示中心**：按要求为 `showcase.html` 增补 Props/注册 ID/组件级 a11y/代码示例与状态切换面板（或明确降级为纯静态展示并调整验收期望）。
5. **固化证据**：在并发 WIP 收敛后，将本轮 5.0 变更独立提交，记录 Commit SHA，并重跑全量 `verify-all.sh` 与隔离独立验收。
6. **`showcase.html` 既有 a11y**：作为独立缺陷立项修复（与 5.0 规范升级解耦）。

---

## 9. 验收判级（终）

```
UTER_DESIGN_SYSTEM_VERSION = 5.0
SPECIFICATIONS            = PARTIAL   (内容完整 / 每份 NOT_VERIFIED)
DESIGN_TOKENS             = PARTIAL   (工程化通过 / --ds-font-* 未落地 / 品牌色差异未闭合)
COMPONENT_REGISTRY        = PARTIAL   (一致已验证 / 证据 NOT_VERIFIED)
COMPONENT_IMPLEMENTATION  = NOT_DONE
PAGE_ADAPTATION           = NOT_DONE
AUTOMATED_VALIDATION       = PARTIAL   (design:5:check + CI 已接 / strict/visual:e2e/axe 未全接)
INDEPENDENT_ACCEPTANCE    = NOT_DONE
FINAL_STATUS              = IMPLEMENTED_NOT_VERIFIED
```

> 任何条件不满足时如实报告实际状态，不提前宣布完成——本判级遵守该铁律。
