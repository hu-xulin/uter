# 尚未解决事项及正式例外清单

- **Document:** `14/14` of §11 (14 mandated deliverables)
- **Generated:** 2026-11-09T05:04:20Z
- **Uter commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`
- **UAES commit SHA:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618`
- **Execution environment:** macOS-26.7.2-x86_64-i386-64bit-Mach-O
- **Collector:** WorkBuddy (Tencent Hunyuan Hy)
- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`

> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，
> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。

---


## 正式例外

**无。** `independent-assessment.json` 中 `exception_approvals.count = 0`；
`07-findings-register.json` 的 policy 明确 `waiver_granted=false`、
`allowlist_modified=false`、`status_rewritten=false`。本审计未授予、未请求、
也未伪造任何例外。

## 尚未解决事项

| Finding | 级别 | 状态 | 阻塞原因 | 所需授权 / 后续动作 |
|---|---|---|---|---|
| FIND-FCA-002 | P1 | OPEN | 仓库只有域级命令与域级门禁；域级命令对单条规范只是 INDIRECT 证据，不能证明任何单条要求。批准基线只把 BLOCKED 变成 NOT_ASSESSED，不产生 PASS。 | 为每条适用要求建立 implementation mapping + requirement-specific verification case + 原始退出码证据。 |
| FIND-FCA-004 | P1 | OPEN | 这些验证需要授权运行环境（DAST 工具、三库环境、真实备份目标、压力负载）或产品侧会话配置；本地已无工具链类阻塞（axe 已安装并真实执行）。 | 由授权环境执行 DAST/渗透/三库迁移/DR/备份恢复/性能验证；鉴权页 axe 扫描需产品开放密码登录或提供 OAuth 测试会话。 |
| FIND-FCA-009 | P1 | OPEN | L3 pass_count=0/14；L4 status=BLOCKED，4 条未满足。 | 完成 14 域人工验收与逐条验证后重跑门禁。 |
| FIND-FCA-011 | P1 | OPEN | real BLOCK gates = ['CHANGE_GATE', 'CODE_REVIEW_GATE', 'TESTING_GATE', 'SECURITY_GATE', 'BUSINESS_ACCEPTANCE_GATE', 'RELEASE_GATE', 'GLOBAL_UAES_CONFORMANCE_GAT | 按 FIND-FCA-001..009 逐项解除后重跑八类门禁。 |


## 需要用户 / UAES Owner 决定的事项

1. **UAES Owner**：批准 178 份 DRAFT 标准条目并执行 13 个 L3 域门禁（FIND-FCA-001）。
2. **项目 Owner（用户本人）**：逐项复核并签署 42 项人工验收（FIND-FCA-003）。
3. **安全授权**：提供 DAST / 渗透 / API 安全 / 三库 / DR / 备份恢复的授权环境，
   并裁定 MA-06 gitleaks 候选误报（FIND-FCA-004）。
4. **工程决策**：逐项确认 knip unused files 清理范围，禁止批量删除用户 WIP（FIND-FCA-005）。
5. **工程资源**：为 2884 条要求建立逐条实现映射与逐条验证（FIND-FCA-002）。

## 未完成即不得宣布全面符合

在上述事项解决并重跑全部门禁前，禁止使用 `CONFORMANT`，禁止
commit / push / PR / merge / deploy。
