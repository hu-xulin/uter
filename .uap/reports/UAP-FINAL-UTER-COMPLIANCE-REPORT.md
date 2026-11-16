# Uter 合规报告

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

## 工程门禁

- `./scripts/verify-all.sh`：**14/14 PASS，exit 0**。
- Go 四模块：gofmt 空、build/vet 0、`make test` 65 ok / 0 FAIL。
- 前端：tsgo 0、lint 0 error、design strict PASS、showcase 数据链 PASS、format PASS、copyright PASS、vitest 289 文件 / 3064 用例 PASS、build PASS。
- 安全：48 项负向检查 PASS + gitleaks clean + govulncheck 四模块 PASS。

## 需求证据

- 538 条需求：VERIFIED 123 / NOT_VERIFIED 415 / BLOCKED 0 / N/A 0。
- 415 条因缺少逐需求独立行为断言被工具拒绝计入（PROBE_SHARED_EVIDENCE），未用共享套件冒充。

## 结论

Uter 工程实现与门禁达标；UAP 需求证据尚未全量闭合，因此不能宣称 FULLY_VERIFIED。
