# Blocked Items

> 由 `./uap report` 依据真实运行产物生成 · 2026-11-24T07:46:11.446Z · UAP 1.0.0
> 数据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与实时文件系统探测。

## 汇总

共 **4** 条。按来源分组：AUTH=4。

## 明细

| ID | 级别 | 原因 | 来源 |
| --- | --- | --- | --- |
| AUTH:production_deploy | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:production_database_write | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:real_payment | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |
| AUTH:real_refund | BLOCKED_BY_DESIGN | requires explicit production authorization; UAP performs local simulation only | .uap/config/permission-policy.yaml |


## 生产授权事项

生产发布、生产数据库写入、真实支付、真实退款、密钥导出均因缺少显式生产授权而记录为 BLOCKED。UAP 已完成本地模拟与源码级验证，不擅自执行。
