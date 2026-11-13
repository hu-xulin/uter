# 运行时验证报告

> 本段落由 `.uap/tools/acceptance-report-generator.mjs` 于 2026-11-13T03:32:54.652Z 从本次真实执行产物自动生成；不覆盖任何已有内容。

- **执行日期**：2026-11-13
- **Git HEAD**：`7b98646915f75026e0e643f9f4b0a6a3ff3ab67c`
- **分支**：`main`
- **最终状态（程序化计算）**：**IMPLEMENTED_NOT_VERIFIED**（claim_allowed=false）
- **原始日志**：`.uap/state/acceptance-20261113/logs/`

| 组件 | 真实执行 | 结果 |
|---|---|---|
| 10 个运行时组件 | uap doctor | PASS（含中断恢复探针） |
| 32 个 Validator | uap validate --all | 32/32 PASS |
| 7 个 JSON Schema | uap schemas | PASS |
| 7 个 Workflow | uap workflow run --all | 7/7 SUCCEEDED |
| UAP 测试门禁 | uap test --all | 6 文件 / 61+ tests / 0 fail |
| 崩溃恢复 | uap doctor recovery probe | PASS |
| Agent 角色分离 | 真实修复闭环 | 15 个阶段、7 类 Agent |

> 注意：运行时组件健康与「538 条适用要求已验证」是两个不同命题。
> 当前后者为 0/538，故最终状态不得为 FULLY_*。
