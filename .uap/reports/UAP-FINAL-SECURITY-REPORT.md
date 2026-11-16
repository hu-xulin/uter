# UAP 安全验证报告

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

## 结果

- `uap verify-security`：48/48 真实负向检查 PASS。
- 12 组 mustDeny 权限全部 DENY；未注册 Agent/未声明权限/curl 全部拒绝。
- gitleaks：HEAD 树扫描 0 findings；govulncheck 四模块 0 漏洞。
- 本次提交范围不包含 `.env`、数据库、日志、密钥。

## 结论

安全门禁通过；生产部署、强制推送、密钥导出仍由权限策略拒绝。
