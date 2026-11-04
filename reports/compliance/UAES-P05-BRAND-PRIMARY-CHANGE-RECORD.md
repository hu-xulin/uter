# UAES-P05-BRAND-PRIMARY-CHANGE-RECORD — P4 Brand Primary Color Change Record

| Field | Value |
|---|---|
| Report ID | UAES-P05-BRAND-PRIMARY-CHANGE-RECORD |
| Version | 1.0.0 |
| Status | DRAFT |
| Domain | UAES-05 Experience & Design |
| Phase | P4 |
| Gate | UAES-05-GATE-001 |
| Result | NOT_VERIFIED |

> 本文件是**实施证据记录**，不是 UAES 标准文件，不得覆盖或替代权威资产。
> 权威资产位于 UAES 规范库：`quality/acceptance/UAES-P05-ACCEPTANCE-BASELINE.md`、
> `quality/gates/UAES-05-GATE-001-DESIGN-QUALITY-GATE.md`，
> 唯一事实源为 `.uaes/STANDARD-REGISTRY.yaml`；本仓库不另立注册表。
> 依 `UAES-05-GATE-001` §4/§6，`NOT_RUN` / `NOT_VERIFIED` 不得记为 `PASS`。

---

## 1. 原规则与新规则

| 项 | 原值 | 新值 |
|---|---|---|
| Light 主题品牌主色 | `#5558D8` | `#5B5EE6` |
| 链接 / 焦点环 / 主按钮 | 沿用 `#5558D8` 或 `#6366F1` | 统一指向结构化 Token `--uaes-brand-primary` |
| Token 承载方式 | CSS 硬编码 | `web/src/design-system/source/brand.tokens.json`（DTCG）→ 生成 `web/src/design-system/tokens/generated/brand.css` |

## 2. 变更原因

分支实施审计记录（`reports/quality/UAES-P05-IMPLEMENTATION-AUDIT.md` §2.3）记载：用户于 2026-11-04 确认品牌主色为 `#5B5EE6`。该记录是分支内的陈述，**未附带 Exception ID、审批人或批准日期**，因此本变更记录的状态为 DRAFT、结果为 NOT_VERIFIED。

## 3. 影响范围

- 规范文档：`docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（品牌主色、Token 表、对比度表、示例）。
- 样式：`web/src/styles/theme.css`（`--primary`、`--primary-foreground`、`--ring`、`--fg-link`、`--sidebar-active-foreground`、`--sidebar-ring`、`--primary-subtle-foreground` 等改为引用 `--uaes-brand-*`）、`web/src/styles/index.css`（引入生成文件）。
- 结构化源与产物：`web/src/design-system/source/brand.tokens.json`、`web/src/design-system/tokens/generated/brand.css`。
- 脚本与测试：`web/scripts/generate-design-tokens.mjs`、`web/scripts/verify-contrast.mjs`、`web/src/design-system/__tests__/token-source.test.ts`、`sidebar-active-guard.test.ts`、`status-badge-contrast.test.ts`。
- CI：`.github/workflows/ci.yml` 新增 `design:tokens:check` 与 `verify:contrast`。

## 4. 兼容性与迁移方案

- `#5558D8` 未删除：保留为独立的 Soft 前景值（`--uaes-brand-soft-foreground`），与 `#F0F0FF` 浅底配对约 4.93:1，满足 WCAG AA 普通文本。
- `brand-hover` `#4F52D1`、`brand-active` `#4A4DC5` 保持既有值。
- 深色主题及其它状态值由既有 3.0 实现迁入结构化源，属于「既有实现数据」，不代表逐值重新确认。
- 未完成迁移的 Token 家族（typography、spacing、radius、elevation、motion、语义色、主题预设）仍由 CSS 承载，不得宣称整个设计系统已机器化。

## 5. 对比度证据（分支记录值，需脚本复核）

| 组合 | 计算值 | 门槛 | 结果 |
|---|---:|---:|---|
| 白字 / `#5B5EE6` | 5.01:1 | 4.5:1 | PASS |
| 白字 / hover `#4F52D1` | 6.07:1 | 4.5:1 | PASS |
| 白字 / active `#4A4DC5` | 6.65:1 | 4.5:1 | PASS |
| `#5558D8` / `#F0F0FF` | 4.93:1 | 4.5:1 | PASS |
| 深色前景 `#020617` / `#A1A3F7` | 8.74:1 | 4.5:1 | PASS |
| 深色 Soft 前景 `#B1B3FF` / `#25264A` | 7.40:1 | 4.5:1 | PASS |

上述为分支记录的确定性计算值，仅覆盖所列组合，不构成全语义色、全主题预设、全组件状态或渲染页面的合规证明。实际以 `bun run verify:contrast` 的输出为准。

## 6. 待补齐的审批项（不得留空视为通过）

- Exception ID：待补。
- 责任人 / Reviewer：待补。
- 审批记录与 Approval Date：待补。
- 风险与到期时间：待补。
- 修复 / 复核计划：待补。

在以上字段补齐并经审批前，按 UAES-05-GATE-001 §5.3，本变更不得被标记为已批准，也不得计入 P4 验收通过项。
