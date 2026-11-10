# PRD ↔ Prototype 双向同步规范

> UTER 产品原型与 PRD 一体化系统 · 规范编号 STD-SYNC-01 · 生效版本 v1 · 2026-11-09T15:47:41.777Z
> 本规范由统一需求模型驱动；唯一事实源 `docs/product/registry/product-model.json`。设计基线：UTER Design System 3.0。

## 1. 单一事实源
PRD 视图、Prototype 视图、结构化模型视图都是 `registry/product-model.json` 的投影。禁止用字符串替换、Markdown 覆盖或文件复制充当「同步」。

## 2. 支持的操作
| 方向 | op | 自动同步结果 |
| --- | --- | --- |
| PRD → Prototype | add_requirement | 自动创建组件、交互、验收标准、测试用例、映射 |
| PRD → Prototype | update_requirement | 同步组件名称、校验提示、验收条件、测试状态 |
| PRD → Prototype | update_business_rule | 按 rule_field 同步原型 min / 错误提示 / 边界验收 / 测试状态 |
| PRD → Prototype | update_acceptance | 同步原型 success / error 状态描述 |
| PRD → Prototype | delete_requirement | 影响分析 + 组件/交互失效；敏感域 DEPRECATED 留痕 |
| PRD → Prototype | update_prd_section | 更新背景章节 |
| Prototype → PRD | add_component | 自动创建需求（业务规则标 NEEDS_PRODUCT_DECISION）、验收、测试 |
| Prototype → PRD | add_page | 自动创建需求、页面交互说明、业务流程、验收、测试 |
| Prototype → PRD | update_component | 同步字段说明、校验、验收条件、测试状态 |
| Prototype → PRD | update_interaction | 同步业务流程、恢复路径、验收条件 |
| Prototype → PRD | update_page_state | 同步异常流程说明 |
| Prototype → PRD | delete_component / delete_interaction | 影响分析 + PRD 说明与验收同步 |

## 3. 可靠性约束
- **事务化**：`applyChange()` 在 clone 副本上执行，任一步失败整体回滚，不写半成品；持久化使用临时文件 + rename 原子写。
- **不循环**：自动同步事件在同一次变更中以 `SYSTEM_GENERATED` 记录，不递归调用 `applyChange`，不生成新的用户编辑事件。
- **版本**：每次有效修改生成 Change ID 与 `vN.json` 快照；恢复历史生成新变更事件，不覆盖历史。
- **冲突**：基于 `base_version` + `changed_fields` 路径比较；不同字段自动合并，同字段冲突标记 `CONFLICT` 并进入待处理队列。
- **敏感域**：`PAY / REFUND / BALANCE / BILLING / ADMIN / APIKEY` 的同字段冲突标记 `requires_product_decision`，不允许系统自动任选一方。
- **语义不确定**：无法从原型推断的业务语义标记 `NEEDS_REVIEW` 或 `NEEDS_PRODUCT_DECISION`，不编造业务规则。
- **投影同步**：每次变更后重渲染受影响 Feature 的 PRD / Prototype Markdown，使文件层与模型层一致。
