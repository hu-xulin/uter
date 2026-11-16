# Cross-Platform Report

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-16T12:10:58.684Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 平台目录探测

| 路径 | 存在 | 文件数 |
| --- | --- | --- |
| web | YES | 4431 |
| electron | YES | 14 |
| desktop | NO | 0 |
| web/src/design-system | YES | 37 |
| web/src/features/wallet | YES | 40 |
| docs/design-system | YES | 178 |


## 设计系统约束

UDS 8.0.0 文档集：PRESENT / ACCEPTANCE_READY / accepted=false; UDS 8.0.0 --ds-* 运行时桥接与 3.0 兼容层退役边界按迁移证据核验；web/AGENTS.md：存在。

## 结论

仅报告真实探测到的目录与命令结果；未完成独立平台构建验证的部分不标记为 PASS。
