# TOKEN-CONSUMPTION-AUDIT — Token 真实消费审计

> UTER DESIGN SYSTEM 6.0 · 全面审计整改（P0）· Phase 1 重新审计产出
> 本报告由 `registry/generate-audit.mjs` 从磁盘实时扫描生成，不以任何历史报告结论为依据。

| 元数据 | 值 |
|---|---|
| 生成时间 | 2026-11-15T05:35:55.927Z |
| Git SHA | 012c08eaf6127261f4ba434bf277489261ef6dd5 |
| 分支 | main |
| 工作区脏区条目 | 671（并发 UAP 会话产物，本任务未覆盖、未混入） |
| Node | v22.22.2 |
| 生成命令 | node docs/design-system/uter-design-system-6.0/registry/generate-audit.mjs |
| 审计范围 | web/src 全量 CSS/TSX/TS · TOKEN-MANIFEST.json · TOKEN-REGISTRY.json · 检查器 |

本报告回答：有哪些无消费者 Token、必需 Token 是否都有真实消费者、是否存在硬编码颜色、CSS 与 TypeScript 是否两套真值。

## 1. 实时扫描数据

| 指标 | 实测值 |
|---|---|
| 扫描源码文件数 | 1545 |
| `var(--` 引用总数 | 909 |
| `var(--ds-` 引用总数 | 168 |
| `var(--ds6-` 引用总数（整改前） | 32 |
| 含 HEX 字面量的文件数 | 15 |
| 其中 Token 定义文件 | 5 |

## 2. manifest 字段缺口

```json
{
  "layer": "primitive",
  "category": "brand",
  "type": "color",
  "unit": "color",
  "light": "#5B5EE6",
  "dark": "#8B8DF5",
  "description": "品牌主色 / Dark 浅化档",
  "themeIndependent": false,
  "runtimeName": "--ds6-color-brand-1",
  "semanticMeaning": "品牌主色 / Dark 浅化档",
  "consumer": null,
  "consumerNote": null,
  "contrastRequirement": ">= 4.5:1 on canvas / surface / raised / sunken / overlay / code-bg",
  "deprecated": false,
  "colorLayer": "primitive",
  "runtimeBridge": true,
  "vscodeSource": null
}
```

当前每个 Token 只有 8 个字段；`semanticMeaning` / `consumer` / `contrastRequirement` / `deprecated` 全部缺失（`grep` 零命中）。

## 3. 含 HEX 字面量的文件（区分定义处与业务处）

| 文件 | 命中数 | 是否 Token 定义处 |
|---|---|---|
| web/src/design-system/tokens/uds-semantic-bridge.css | 928 | 是（合规） |
| web/src/styles/theme.css | 108 | 是（合规） |
| web/src/design-system/tokens/brand-colors.ts | 68 | 是（合规） |
| web/src/design-system/tokens/generated/brand.css | 16 | 是（合规） |
| web/src/assets/custom/icon-theme-dark.tsx | 8 | 否 |
| web/src/design-system/tokens/colors.css | 6 | 是（合规） |
| web/src/assets/logo.tsx | 5 | 否 |
| web/src/assets/custom/icon-theme-light.tsx | 4 | 否 |
| web/src/design-system/__tests__/sidebar-active-guard.test.ts | 4 | 否 |
| web/src/design-system/__tests__/token-source.test.ts | 4 | 否 |
| web/src/assets/brand-icons/icon-linuxdo.tsx | 3 | 否 |
| web/src/assets/custom/icon-sub2api.tsx | 3 | 否 |
| web/src/design-system/__tests__/status-badge-contrast.test.ts | 2 | 否 |
| web/src/features/dashboard/lib/flow-selection.test.ts | 2 | 否 |
| web/src/routes/__tests__/public-routes-render.test.tsx | 1 | 否 |

## 4. 问题明细

#### UDS6-T-01

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-01 |
| 严重级别 | P0 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | docs/design-system/uter-design-system-6.0/TOKEN-MANIFEST.json |
| 行号 / 位置 | 169-178；registry/tokens.mjs:425 |
| 当前实际状态 | 每个 token 只有 8 字段 layer/category/type/unit/light/dark/description/themeIndependent；无 semanticMeaning / consumer / contrastRequirement / deprecated。 |
| 违反的规范 | §4.7「统一管理 Token ID / 名称 / Light / Dark / 语义 / 消费者 / 对比度要求 / 废弃状态」/ §10.1。 |
| 对产品的影响 | 无法判断哪些 Token 有真实消费者，也无法发现无消费者冗余 Token。 |
| 整改方案 | 扩展 manifest 字段并在 build.mjs 生成 TOKEN-REGISTRY 时一并派生；consumer 由 registry/consumer-scan.mjs 真实扫描 web/src 得出，不允许手写。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-T01 断言必需字段齐全且 consumer 非空 Token 的引用确实存在 |
| 验收证据 | token-validation.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-T01 PASS · 384 个 Token 逐字段校验；141 条 consumer 路径逐条磁盘存在性检查 |

#### UDS6-T-02

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-02 |
| 严重级别 | P0 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | docs/design-system/uter-design-system-6.0/TOKEN-MANIFEST.json |
| 行号 / 位置 | 24-30；registry/tokens.mjs:425 |
| 当前实际状态 | architecture.layers 文案写五层，但 token 的 layer 只有 primitive/semantic/component 三种取值；后两层仅存在于文案。 |
| 违反的规范 | §4.1 五层颜色架构 / §14 Token 完整性。 |
| 对产品的影响 | 组件规格与页面模板层无法被自动化检查，五层架构是文档声明而非可执行结构。 |
| 整改方案 | manifest 新增 componentSpecs 与 pageTemplates 两个实体数组，DEPENDENCY-GRAPH.json 生成五层节点与允许/禁止边。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-T02 断言五层节点与边齐全 |
| 验收证据 | DEPENDENCY-GRAPH.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-T02 PASS · manifest.architecture 结构化节点 / 边 |

#### UDS6-T-03

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-03 |
| 严重级别 | P0 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | web/scripts/check-design-system-6.0.mjs |
| 行号 / 位置 | 84-335（C01–C17） |
| 当前实际状态 | 17 项检查全部围绕「6.0 文档产物 ↔ manifest 自洽」；唯一读 web/src 的 C12 只比字体字符串。无运行时消费者、硬编码颜色、VS Code 一致性、插值空间、1001 采样、ANSI16、12 色图表检查。 |
| 违反的规范 | §10 自动化治理 / §17「不能只做闭环自证」。 |
| 对产品的影响 | 即使真实页面完全没有 6.0 Token，17 项检查仍全绿——门禁无法发现实现缺口。 |
| 整改方案 | 新增 check-uds6-remediation.mjs（P0 检查器）与 C-R01..C-R20，原有 C01–C17 保留不降级，并新增 C18–C21。 |
| 对应自动化测试 | check-uds6-remediation.mjs 自校验 + 负例注入回归 |
| 验收证据 | design-system-audit.json |
| 整改状态 | RESOLVED |
| 实际证据 | C-T03 PASS · 向副本注入重复 / 额外 Token，校验器必须拒绝；真实执行 |

#### UDS6-T-04

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-04 |
| 严重级别 | P1 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | web/src |
| 行号 / 位置 | var(-- 907 次 / 78 文件；var(--ds- 171 次 / 21 文件 |
| 当前实际状态 | 引用次数前 7 名中 6 个是 Token/CSS 定义文件自身；业务消费者进入前 10 的仅 CustomerServiceWidget.css、visual-condition-tree.css、sonner.tsx。 |
| 违反的规范 | §10.1「未使用 Token」/ §14「必需 Token 均有真实消费者」。 |
| 对产品的影响 | 大量 Token 只有自引用，实际产品页面没有消费，无法证明规范可执行。 |
| 整改方案 | consumer-scan.mjs 逐 token 扫描 web/src 真实引用，生成 TOKEN-CONSUMPTION-AUDIT.md；无消费者 Token 标记 UNUSED 并给保留理由或列入废弃。 |
| 对应自动化测试 | check-uds6-remediation.mjs::C-T04 断言必需组（syntax20/state48/chart12/ansi16）100% 有真实消费者 |
| 验收证据 | TOKEN-CONSUMPTION-AUDIT.md |
| 整改状态 | OPEN |
| 实际证据 | C-T04 FAIL · 真实消费者登记数：{"syntax":20,"chart":0,"ansi16":16,"status":12} / 组大小 {"syntax":20,"chart":12,"ansi16":16,"status":29}；未覆盖项如实登记 UNUSED |

#### UDS6-T-05

| 字段 | 内容 |
|---|---|
| 唯一问题 ID | UDS6-T-05 |
| 严重级别 | P2 |
| 所属域 | TOKEN — Token 管理与真实消费 |
| 文件路径 | web/src/components/ 与 web/src/features/ |
| 行号 / 位置 | 业务区 HEX 字面量 15 次，全部落在注释或 *.test.* 夹具；真实业务样式 0 次 |
| 当前实际状态 | §10.1「非法硬编码颜色」—— 当前无实际违规，但缺少防回归守卫。 |
| 违反的规范 | 当前无产品影响；若未来有人在业务样式写死颜色，现有门禁无法在 6.0 侧发现。 |
| 对产品的影响 | 把「业务区真实样式 HEX = 0」变成可复现的自动化断言，区分注释 / 测试 / 真实样式三种上下文。 |
| 整改方案 | check-uds6-remediation.mjs::C-T05 |
| 对应自动化测试 | token-validation.json 的 hardcodedColor 段 |
| 验收证据 |  |
| 整改状态 | RESOLVED |
| 实际证据 | C-T05 PASS · C16 校验 runtime CSS 与 manifest 一一对应；Showcase 内联 manifest 且色值由生成器展开 |

