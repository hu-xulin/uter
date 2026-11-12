---
id: ADR-0001
title: UTER Design System 3.0 作为设计规范唯一事实来源
status: Accepted
date: 2026-11-03
decision_owner: Uter Project Maintainers
---

# ADR-0001：UTER Design System 3.0 作为设计规范唯一事实来源

## 背景

Uter 的视觉 Token、字号、颜色、组件与设计约束曾分散在多个文档或历史版本中，容易导致 AI Agent 和开发人员读取到不一致或已经废弃的规则。项目已明确将 UTER Design System 3.0 收敛为正式设计标准，并要求旧版分篇不再作为当前依据。

## 决策

将 `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` 作为 Uter 设计规范的唯一权威文档；配套 `showcase-3.0.html` 用于展示和核验规范效果。其他文档只能引用该权威来源，不得复制维护平行版本，也不得引用已废弃的 `design-system.md` 作为当前标准。

## 决策依据

- `AGENTS.md` 将 UTER Design System 3.0 标记为单一权威设计文件。
- `AGENTS.md` 同时约定了目录纪律：设计规范相关文档集中于 `docs/design-system/`，不得另建平行真源（原 `uaes/standards/` 与 `.ai/` 规范已于 2026-11-12 退休删除，其相关约束由本 ADR 与 `AGENTS.md` 承接）。

## 后果

- 设计 Token、颜色、字号或组件规则发生变化时，必须更新权威设计系统文档并运行对应设计门禁。
- 其他规范不得创建重复的设计 Token 真源。
- 发现旧路径、旧版本或冲突描述时，必须修正引用并保留必要的历史说明。
- 任何拟改变该决策的行为必须提交新的 ADR，不得直接覆盖本记录。

## 实施与验证

| 验证对象 | 当前证据 |
|---|---|
| 权威设计文档 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` |
| 项目宪法引用 | `AGENTS.md` |
| 文档治理规则 | `AGENTS.md` |
| 方法论入口 | `AGENTS.md`（原 `.ai/README.md` 已于 2026-11-12 退休删除） |

本 ADR 记录的是已经在项目规范中明确批准的决策；它不声称所有历史设计相关实现已经完成独立运行时审计。实施符合性仍由对应设计门禁和后续审计验证。
