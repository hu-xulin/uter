# 证据完整性报告

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

## 证据链

- 每次命令写入不可变 evidence 记录（content_hash 64 位 hex），绑定 execution_id / git_head / worktree / environment 指纹。
- `uap verify-status`：**全部一致性检查 PASS**（同一批次、哈希、绑定、时效）。
- `EVIDENCE-MANIFEST.json` / `EVIDENCE-INDEX.md` 由 `uap accept` / `uap report --final` 重新生成。

## 说明

- 运行时产物（state/reports/evidence）不计入工作区指纹；业务源码变更会正确使旧证据失效。
- 视觉与 E2E 的 BLOCKED/FAIL 以原样保留，未转换为 PASS。
