# 需求追溯与映射注册表规范

> UTER 产品原型与 PRD 一体化系统 · 规范编号 STD-TRACE-01 · 生效版本 v1 · 2026-11-09T15:47:41.777Z
> 本规范由统一需求模型驱动；唯一事实源 `docs/product/registry/product-model.json`。设计基线：UDS 8.0.0。

## 1. 追溯链
`Feature ID → Requirement ID → Prototype Page ID → Interaction ID / Component ID → API ID / Data Model ID → Acceptance ID → Test Case ID → Change ID`

## 2. 注册表
| 文件 | 内容 |
| --- | --- |
| registry/product-model.json | 唯一权威结构化模型（SSOT） |
| registry/feature-registry.yaml | 功能主表 |
| registry/requirement-registry.yaml | 需求主表 |
| registry/prototype-registry.yaml | 原型页面 / 组件 / 交互主表 |
| registry/feature-mapping.yaml | 双向映射注册表 |
| registry/change-registry.yaml | 变更事件与版本 |
| mappings/FEATURE-TRACEABILITY-MATRIX.md | 可读追溯矩阵 |

## 3. 自动校验
- ID 唯一、路径存在、映射有效、无重复、无失效路径、无跨 Feature 错误关联。
- 检查项 `V-MAP-COMPLETE / V-MAP-NO-ORPHAN / V-MAP-NO-DUP / V-CROSS-*` 与 `validate({checkFiles:true})` 的文件存在性检查。
- 每次有效变更后 `buildMappings()` 重建注册表，映射版本号随模型版本递增。
