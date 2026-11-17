---
id: ADR-0002
title: Preserve UDS 3.0 runtime compatibility boundary pending authorized migration
status: Accepted
date: 2026-11-17
decision_owner: Uter Project Owner
clarifies: ADR-0001
---

# ADR-0002：在获准迁移并完成验证前保留 UDS 3.0 runtime compatibility boundary

## 背景

UDS 8.0.0 已建立为当前设计系统事实来源，状态为 `ACCEPTANCE_READY`，但尚未被用户最终接受。8.0.0 的文档、Token 或 Showcase 已存在，不等于现有运行时兼容边界可以自动退役。当前源码仍保留带有历史兼容语义的运行时值与说明；仅凭旧迁移文件不存在、旧引用扫描结果或文档状态，无法证明所有运行时消费者均已完成迁移。

## 决策

1. UDS 8.0.0 的 `TOKEN-MANIFEST.json` 继续作为新建和修改 UI 的唯一设计系统事实来源；不得创建第二套设计系统或第二个 Token 真源。
2. **现有 UDS 3.0 runtime compatibility boundary 必须保留**。不得删除、改写、绕过或静默改变该边界覆盖的现有运行时兼容行为，直到项目所有者明确授权迁移，且迁移及回归验证均已完成。
3. 迁移授权必须明确给出范围、目标 HEAD 和可验证的验收条件。迁移至少需要：真实消费者盘点、兼容行为映射、逐项迁移证据、Web/H5 与受影响平台的行为和视觉回归、可访问性验证、无未分类差异，以及绑定当前 HEAD 的证据清单。
4. 只有在上述检查全部通过并获得项目所有者明确接受后，才允许提出退役兼容边界的变更。文件缺失、旧文档删除、静态扫描零命中、UDS 8.0.0 的 `ACCEPTANCE_READY` 均不得单独作为退役证明。
5. 本 ADR 补充并限定 ADR-0001：兼容边界仅用于保护现有运行时消费者，不构成并行设计系统或新的 Token 来源；所有新 UI 仍必须遵循 UDS 8.0.0。

## 适用范围

本决策只覆盖仓库中现存的 UDS 3.0 运行时兼容边界及其消费者，不批准新增旧版设计实现，也不批准任何生产部署、数据库变更或真实支付操作。

## 可核验实现锚点

- `docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`
- `docs/design-system/TOKEN-MANIFEST.json`
- `docs/design-system/UDS-8.0.0-FINAL-IMPLEMENTATION-AND-ACCEPTANCE-REPORT.md`
- `web/src/styles/theme.css`
- `web/src/design-system/tokens/typography.css`

这些路径用于定位当前规范、运行时源文件和状态证据；它们的存在不单独证明兼容边界已完整验证。验证器必须读取文件内容、核对状态并保留失败或未验证结果。

## 后果

- UAP 规范、验证器、探针与知识索引必须将 UDS 8.0.0 的规范就绪状态和 3.0 运行时兼容边界分开判定。
- 不再依赖已删除的 `UDS-8.0.0-MIGRATION-REPORT.md`、`COMPAT-MAP.json` 或 `FINAL-ACCEPTANCE-REPORT.md` 推断迁移状态。
- 未取得迁移授权或未完成当前 HEAD 验证时，兼容边界状态保持 `PRESERVED / NOT_VERIFIED_FOR_RETIREMENT`，不得报告为已退役。
