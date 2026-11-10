# UTER 产品文档与原型覆盖率报告

> 数据源 `registry/product-model.json` v1 · 2026-11-09T15:47:41.816Z · 由 `engine.coverage()` 真实计算

## 总览
| 指标 | 数值 |
| --- | --- |
| 盘点功能总数 | 56 |
| 有实现证据的功能 | 55 |
| PRD 文档数 | 56 |
| Prototype 文档数 | 56 |
| 原型页面总数 | 90 |
| 可交互页面数 | 89 |
| 有效需求数 | 124 |
| 双向映射数 | 124 |
| 未解决冲突 | 0 |
| NEEDS_REVIEW 功能数 | 0 |
| 待产品决策项 | 3 |

## 状态分布
| 状态 | 数量 |
| --- | --- |
| IMPLEMENTED | 46 |
| BACKEND_ONLY | 8 |
| NOT_IMPLEMENTED | 1 |
| PARTIALLY_IMPLEMENTED | 1 |

## 覆盖率指标
| 指标 | 百分比 / 数值 |
| --- | --- |
| inventory_coverage | 100% |
| prd_coverage_implemented | 100% |
| prototype_coverage_implemented | 100% |
| prd_not_implemented | 100% |
| prd_to_prototype_mapping | 100% |
| prototype_to_prd_mapping | 100% |
| requirement_to_test | 100% |
| mapping_registry_coverage | 100% |
| feature_id_unique | 100% |
| change_traceability | 100% |
| sync_success_rate | 100% |
| sync_loops | 0 |
| silent_overwrites | 0 |

> `sync_loops` 与 `silent_overwrites` 是计数不是百分比，均为 0 表示无同步循环、无静默覆盖。

## 说明
- `prd_coverage_implemented` 与 `prototype_coverage_implemented` 以有实现证据的 55 项功能为分母。
- `inventory_coverage = 100%` 指本次盘点已覆盖扫描到的全部前端路由 / feature 模块 / 后端路由与控制器维度，不代表 Uter 未来新增功能自动纳入。
- 覆盖率由模型实时计算，不手工填写；新增功能后需重新执行 `node tools/product-workspace/render-docs.mjs --all`。
