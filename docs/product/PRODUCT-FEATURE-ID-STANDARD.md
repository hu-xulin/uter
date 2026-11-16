# 统一 Feature ID 与关联 ID 规范

> UTER 产品原型与 PRD 一体化系统 · 规范编号 STD-ID-01 · 生效版本 v1 · 2026-11-09T15:47:41.777Z
> 本规范由统一需求模型驱动；唯一事实源 `docs/product/registry/product-model.json`。设计基线：UDS 8.0.0。

## 1. 格式
| 对象 | 格式 | 示例 |
| --- | --- | --- |
| feature_id | `UTER-{DOMAIN}-{NUMBER}` | UTER-PAY-001 |
| requirement_id | `REQ-{DOMAIN-NUMBER}-{NN}` | REQ-PAY-001-01 |
| prototype_page_id | `PP-{DOMAIN-NUMBER}-{NN}` | PP-PAY-001-01 |
| interaction_id | `INT-{DOMAIN-NUMBER}-{NN}` | INT-PAY-001-01 |
| component_id | `CMP-{DOMAIN-NUMBER}-{NN}` | CMP-PAY-001-01 |
| api_id | `API-{DOMAIN-NUMBER}-{NN}` | API-PAY-001-01 |
| data_model_id | `DM-{DOMAIN-NUMBER}-{NN}` | DM-PAY-001-01 |
| acceptance_id | `AC-{DOMAIN-NUMBER}-{NN}` | AC-PAY-001-01 |
| test_case_id | `TC-{DOMAIN-NUMBER}-{NN}` | TC-PAY-001-01 |
| change_id | `CHG-{TIMESTAMP}-{SEQ}` | CHG-20261109-120000-01 |

## 2. 规则
1. Feature ID 采用 `UTER-{DOMAIN}-{NUMBER}`，DOMAIN 为大写字母，NUMBER 为 3 位数字。
2. 所有关联 ID 以所属 Feature 的 `{DOMAIN}-{NUMBER}` 为命名空间，不得跨 Feature 复用。
3. ID 全局唯一；删除功能后 ID 进入 `feature_id_tombstones`，不得复用。
4. 每项功能必须同时具备 PRD、Prototype、Mapping、Acceptance、Test Case，并由 Change ID 记录变更。
5. 自动检查：`V-FID-*`、`V-ID-GLOBAL`、`V-CROSS-*`、`V-MAP-NO-DUP`。

## 3. 状态分类
| 状态 | 定义 |
| --- | --- |
| `IMPLEMENTED` | 已实现（前后端均有证据） |
| `PARTIALLY_IMPLEMENTED` | 部分实现（存在明确缺口） |
| `FRONTEND_ONLY` | 仅前端（未发现后端实现） |
| `BACKEND_ONLY` | 仅后端（未发现用户侧页面） |
| `DOCUMENTED_ONLY` | 仅文档规划（无代码实现） |
| `NOT_IMPLEMENTED` | 未实现（仅规划原型，非已上线功能） |
| `UNKNOWN` | 证据不足，待确认（不编造业务决策） |
