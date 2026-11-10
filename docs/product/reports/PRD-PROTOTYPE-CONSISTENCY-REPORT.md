# UTER PRD / Prototype 一致性检查报告

> 检查引擎 `engine.validate(model, null, {checkFiles:true})` · 模型 v1 · 2026-11-09T15:47:41.816Z

## 结果
| 项 | 值 |
| --- | --- |
| 结论 | PASS |
| 检查项总数 | 1185 |
| 失败项 | 0 |
| 错误 | 0 |
| 警告 | 0 |

## 失败明细
无失败项。

## 警告明细（文件存在性）
所有 PRD / 原型投影文件均存在。

## 检查维度
| 前缀 | 检查内容 |
| --- | --- |
| V-FID / V-ID | Feature ID 格式与全局唯一、关联 ID 无重复 |
| V-PRD | PRD 12 章节、验收标准、业务规则 |
| V-PROTO | 页面、状态、组件、按钮行为、交互归属、跳转目标、表单校验 |
| V-MAP | 需求→原型 / 验收 / 测试映射、注册表完整性、孤立与重复映射 |
| V-CROSS | 无跨 Feature 错误关联 |
| V-STATUS | 实现状态与原型 planned 标记一致 |
| V-FILE | PRD / 原型投影文件真实存在 |
| V-CHANGE / V-NO-LOOP / V-NO-OVERWRITE / V-CONFLICT | 变更可追溯、同步循环 0、静默覆盖 0、冲突状态合规 |
