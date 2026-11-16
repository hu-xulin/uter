# 需求追溯报告

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

## 四态统计

| 状态 | 数量 |
|---|---|
| VERIFIED | 123 |
| NOT_VERIFIED | 415 |
| BLOCKED | 0 |
| NOT_APPLICABLE | 0 |
| 合计 | 538 |

- 415 条全部为 `PROBE_SHARED_EVIDENCE`：声明的探针是共享套件，未绑定逐需求独立断言。
- VERIFIED 要求均具备：真实行为探针、exit=0、哈希有效证据、独立断言、当前 execution/HEAD/指纹绑定。
- 矩阵生成器：`node .uap/tools/requirement-verification.mjs`（strict），独立校验器 PASS。

## 结论

追溯链完整且 fail-closed；闭合 415 条需要为每条需求编写真实独立行为断言，属于后续工程工作，不能通过共享证据或人工标记完成。
