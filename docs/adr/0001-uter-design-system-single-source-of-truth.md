---
id: ADR-0001
title: UDS 8.0.0 作为唯一设计系统事实来源
status: Accepted
date: 2026-11-16
decision_owner: Uter Project Maintainers
---

# ADR-0001：UDS 8.0.0 作为唯一设计系统事实来源

## 背景

Uter 的视觉 Token、字号、颜色、组件与页面约束必须有单一权威来源，否则 AI Agent 与开发人员会读取到不一致规则，业务 UI 也会出现并行 Token 体系。

## 决策

1. **UDS 8.0.0 是仓库唯一现行设计系统**，也是唯一有效执行依据；不存在并行版本、兼容层、旧 Token 或第二套主题。
2. **`docs/design-system/TOKEN-MANIFEST.json` 是全部设计数值的唯一事实源**。CSS、TypeScript、注册表、规范文档与 Showcase 一律由 `docs/design-system/registry/build.mjs` 从该文件派生，禁止手改派生值。
3. **组件注册表与页面注册表是自动生成并验证的正式资产**：`COMPONENT-REGISTRY.json`、`PAGE-REGISTRY.json` 必须与实际组件、真实路由一致。
4. **所有业务 UI 必须遵守 UDS 8.0.0**：颜色、字号、行高、间距、圆角、边框、阴影、动效与交互状态只能引用已登记 Token 或共享组件，不得写死设计数值。
5. **禁止独立设计 Token 体系、旧版兼容实现、绕过设计系统或未登记组件/页面。**
6. **权威文档集合**：`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`、38 份编号规范、`TOKEN-MANIFEST.json`、8 份注册表与 `SHOWCASE-8.0.0.html`。

## 决策依据

- `AGENTS.md` 将 UDS 8.0.0 标记为唯一设计系统权威。
- `bun run design:8:check` 对规范完整性、Token 唯一性、引用、Light/Dark、注册表一致性、Showcase 同步、旧版本零残留等执行 fail-closed 检查。
- `bun run lint:design:strict`、`typecheck`、`lint`、`test`、`format:check`、`build:check` 与 `./scripts/verify-all.sh` 共同约束真实实现。

## 后果

- 修改任何设计数值必须：先改 `TOKEN-MANIFEST.json` 源定义（`registry/tokens.mjs`）→ 运行 `registry/build.mjs` → 通过全部设计门禁 → 再提交。
- 新增组件或页面必须登记并重新生成注册表。
- 不允许恢复已删除的旧版本设计系统文件、迁移说明、兼容映射或旧 Token。
- 任何拟改变本决策的行为必须提交新的 ADR，不得直接覆盖本记录。

## 实施与验证

| 验证对象 | 当前证据 |
|---|---|
| 唯一数值来源 | `docs/design-system/TOKEN-MANIFEST.json`（389 tokens） |
| 唯一生成入口 | `docs/design-system/registry/build.mjs` |
| 检查器 | `web/scripts/check-design-system-8.0.0.mjs` |
| 设计门禁 | `design:8:check` / `design:tokens:check` / `design:showcase:check` / `lint:design:strict` |
| 全仓门禁 | `./scripts/verify-all.sh` |

本 ADR 记录已批准的治理决策；具体实现符合性由设计门禁与全仓门禁的真实验证结果判定，不以本文件存在作为通过依据。