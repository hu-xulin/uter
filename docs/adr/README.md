# Architecture Decision Records（ADR）

本目录是 Uter 已批准架构与工程决策的正式注册入口。ADR 用于记录决策背景、状态、理由、影响和实施证据；不得用新文档覆盖旧决策。

## 状态定义

- **Proposed**：待批准，不得作为已生效规范。
- **Accepted**：已批准，适用范围内必须遵循。
- **Rejected**：已否决，仅保留历史。
- **Deprecated**：已废弃，不得作为当前依据。
- **Superseded**：已被后续 ADR 替代，必须链接替代记录。

## 决策索引

| ID | 标题 | 状态 | 日期 |
|---|---|---|---|
| [ADR-0001](0001-uter-design-system-single-source-of-truth.md) | UTER Design System 3.0 作为设计规范唯一事实来源 | Accepted | 2026-11-03 |

## 维护规则

1. 新 ADR 必须先核对现有决策，避免重复编号或重复决策。
2. 只有明确批准的决策才能标记 Accepted。
3. ADR 必须记录决策来源、适用范围、实施状态和可核验的代码/文档证据。
4. 代码、配置或流程偏离 Accepted ADR 时，必须修复实现或通过新 ADR 正式替代旧决策。
5. ADR 状态变化不得删除历史记录；更新索引并保留 Git 历史。
6. 现有规范、设计文档和 Commit 中的历史决策必须逐项盘点；未经核实不得批量补写为 Accepted。
