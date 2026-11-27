# Cross-Platform Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-26T11:12:26.552Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 平台目录探测

| 路径 | 存在 | 文件数 |
| --- | --- | --- |
| web | YES | 4531 |
| electron | YES | 14 |
| desktop | NO | 0 |
| web/src/design-system | YES | 41 |
| web/src/features/wallet | YES | 43 |
| docs/design-system | YES | 211 |


## 设计系统约束

UDS 8.0.0 文档集：PRESENT / ACCEPTANCE_READY / accepted=false; --ds-* bridge 由 TOKEN-MANIFEST 派生；UDS 3.0 runtime compatibility boundary 保留至项目所有者明确授权迁移且迁移证据验证完成，不以已删除的 COMPAT/MIGRATION 文件推断退役；web/AGENTS.md：存在。

## 结论

仅报告真实探测到的目录与命令结果；未完成独立平台构建验证的部分不标记为 PASS。
