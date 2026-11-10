# UTER PRD ⇄ Prototype 双向同步报告

> 唯一数据源 `registry/product-model.json` v1 · 2026-11-09T15:47:41.816Z · 由变更事件与同步指标实时汇总

## 架构

```
用户编辑 PRD  ─┐
用户编辑 Prototype ─┼→ applyChange() 单事务 → 统一需求模型 → 派生对侧视图
结构化模型编辑 ─┘        ↓ 版本+1 / 映射重建 / 一致性检查 / 快照 / 投影重渲染
```

- 两侧不各自保存事实，只保存 `feature_id + model_version` 派生的可编辑视图。
- 自动同步在同一次事务内以 `SYSTEM_GENERATED` 事件记录，不递归调用 `applyChange`，结构上杜绝同步循环。
- 写操作要求 `X-Uter-Role: admin`；服务仅绑定 `127.0.0.1`，可叠加 Bearer Token。

## 变更事件

| 项 | 数量 |
| --- | --- |
| 变更事件总数 | 1 |
| 用户编辑 (USER_EDIT) | 0 |
| 系统自动同步事件 (SYSTEM_GENERATED) | 0 |
| 冲突解决事件 | 0 |
| 历史恢复事件 (RESTORE) | 0 |
| 开放冲突 | 0 |
| 版本快照 | 1 |

### 来源分布
| Source View | 事件数 |
| --- | --- |
| System Generated | 1 |

### 事件类型分布
| Source Type | 事件数 |
| --- | --- |
| INITIAL_BASELINE | 1 |

## 同步状态与可靠性

| 项 | 值 |
| --- | --- |
| PRD → Prototype 成功 | 0 |
| Prototype → PRD 成功 | 0 |
| 同步成功率 | 100% |
| 同步循环 sync_loops | 0 |
| 静默覆盖 silent_overwrites | 0 |
| 失败变更 | 0 |
| 投影渲染失败 | 0 |
| 需求 → 测试用例追溯率 | 100% |
| 变更历史可追溯率 | 100% |

### Feature 同步状态分布
| 状态 | 功能数 |
| --- | --- |
| SYNCED | 56 |

## 冲突与恢复策略

- 并发修改按 `base_version` 比对；不同字段自动合并，同字段冲突标记 `CONFLICT` 并保留双方值。
- 支付 / 退款 / 余额 / 权限 / 安全相关字段冲突不自动择一，必须走人工合并决策。
- 未解决冲突不会显示 `SYNCED`；解决动作生成新的 `CONFLICT_RESOLUTION` 事件。
- 历史恢复不删除历史：生成 `RESTORE` 事件、版本 +1、写入新快照，并重新渲染两侧投影。
- 无法从原型变化确定业务语义时进入 `NEEDS_REVIEW` / `NEEDS_PRODUCT_DECISION`，不凭空生成规则。

## 自动化验证

自动化用例位于 `tools/product-workspace/tests/`，通过 `node --test tools/product-workspace/tests/*.test.mjs` 执行：
覆盖 PRD→Prototype（新增/修改/删除需求、改字段、改业务规则、改验收标准）、
Prototype→PRD（新增/删除组件/页面、改字段/交互/状态/跳转）、
防循环、不丢失修改、并发冲突、失败回滚、版本恢复、双栏联动与 6 个验收场景。
真实执行结果记录在最终报告的「自动化测试」章节。
