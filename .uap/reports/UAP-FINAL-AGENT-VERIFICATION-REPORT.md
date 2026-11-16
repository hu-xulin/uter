# UAP Agent 验证报告

> 仓库 https://github.com/hu-xulin/uter · 分支 `main` · HEAD `cfb471c6cd043d81228e9703ff95d6d61c61da62` · 执行 `UAP-EXEC-20261116115030-6a0ef6da` · 生成于 2026-11-16 20:12:05
> 证据来源：`.uap/state/`、`.uap/reports/*.json`、`.uap/evidence/` 与真实命令退出码。任何 PASS 均绑定本次执行。

## 注册与权限

- `agent-registry.yaml` 注册 11 个 Agent；UAP 测试类别 4 断言 `listAgents()=11`。
- `assertTool` 拒绝未声明工具；`invoke` 对未注册 Agent 返回 BLOCKED。
- 权限：12 组 mustDeny 全部 deny；default_effect=deny；DENY 写入 `policy-audit.jsonl`。
- 产物：每次调用均产生 execution/evidence 绑定记录（`.uap/evidence/`）。

## 结论

Agent 注册、职责、权限与失败处理均有真实断言覆盖；未发现仅登记无实现的 Agent。
