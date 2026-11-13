# 安全验证报告

> 本段落由 `.uap/tools/acceptance-report-generator.mjs` 于 2026-11-13T03:32:54.652Z 从本次真实执行产物自动生成；不覆盖任何已有内容。

- **执行日期**：2026-11-13
- **Git HEAD**：`7b98646915f75026e0e643f9f4b0a6a3ff3ab67c`
- **分支**：`main`
- **最终状态（程序化计算）**：**IMPLEMENTED_NOT_VERIFIED**（claim_allowed=false）
- **原始日志**：`.uap/state/acceptance-20261113/logs/`

| 检查 | 结果 |
|---|---|
| 权限策略 fail-closed | default_effect=deny；production_* / real_payment / real_refund 全部 DENY |
| 发布门禁 | uap release check EXIT=1，deploy_decision=DENY（预期阻断，未执行任何部署） |
| 修复权限分级 | 支付/退款/密钥/部署 DENY；迁移 DATA_SAFETY_REVIEW；认证 SECURITY_REVIEW；余额 FINANCIAL_REVIEW |
| WIP 保护 | 目标文件存在未提交修改时拒绝修复（边界测试 PASS） |
| 静态安全审计 | uap audit 0 blockers |
