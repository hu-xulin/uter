# Uter Engineering Quality Gate Standard
## 统一工程质量门禁规范

**项目：** Uter  
**规范编号：** UTER-ENG-004  
**版本：** 1.0  
**适用范围：** 全仓库代码审查、自动化测试、安全扫描、AI 自动修复及 Pull Request  
**执行主体：** Quality Orchestrator、Code Review Engine、Testing Engine、Auto-Fix Engine、GitHub Actions

**关联规范：**
- CODE-REVIEW-STANDARD.md
- AUTOMATED-TEST-STANDARD.md
- AUTO-FIX-STANDARD.md

---

# 1. 规范目标

## 1.1 核心目标

建立统一的工程质量判定机制。

Quality Gate 负责汇总：

1. Code Review Engine 的审查结果。
2. Testing Engine 的测试结果。
3. 安全扫描结果。
4. 依赖及供应链扫描结果。
5. 测试覆盖率。
6. AI 自动修复结果。
7. 关键业务专项验证。
8. 代码变更及版本基线。

根据真实执行结果，判断代码是否满足创建 PR、通过 PR 检查或进入人工审核的条件。

## 1.2 设计原则

- 审查与测试分别执行、统一判定。
- 质量判断必须有证据。
- 测试通过不代表代码审查通过。
- 代码审查通过不代表测试通过。
- 覆盖率不能代替测试有效性。
- AI 不能自行忽略阻断条件。
- 不允许将未执行项目标记为通过。
- 不允许用平均分掩盖高风险问题。
- 不允许通过修改门禁阈值掩盖失败。

---

# 2. Quality Gate 总体架构

```text
Code Review Engine
        │
        ├── Review Findings
        │
Testing Engine
        │
        ├── Test Results
        │
Security Scanner
        │
        ├── Security Findings
        │
Coverage Engine
        │
        ├── Coverage Results
        │
Auto-Fix Engine
        │
        └── Fix Verification
                 │
                 ▼
           Quality Gate
                 │
       ┌─────────┼─────────┐
       │         │         │
     PASS      FAIL     BLOCKED
       │         │         │
       ▼         ▼         ▼
    允许进入   阻断流程   等待条件满足
    下一阶段   生成报告
```

Quality Gate 不负责代替各引擎执行具体检查。

它负责：

- 收集。
- 校验。
- 关联。
- 判定。
- 记录。
- 输出。

---

# 3. 统一状态定义

所有质量检查必须采用统一状态。

| 状态 | 含义 |
|---|---|
| PASS | 已实际执行并满足要求 |
| FAIL | 已实际执行但不满足要求 |
| BLOCKED | 因权限、环境或依赖缺失无法执行 |
| SKIPPED | 根据明确规则跳过 |
| NOT RUN | 尚未执行 |
| NOT APPLICABLE | 经确认不适用 |

## 3.1 状态使用规则

PASS：

必须存在真实执行记录和证据。

FAIL：

必须存在失败原因和日志。

BLOCKED：

必须说明阻塞原因、影响范围和解除条件。

SKIPPED：

必须说明跳过依据。

NOT RUN：

不得当作通过。

NOT APPLICABLE：

必须有合理依据。

不得把 BLOCKED、SKIPPED 或 NOT RUN 自动转换为 PASS。

## 3.2 总体状态计算

总体状态使用以下优先级：

1. 存在阻断性风险：FAIL。
2. 必需检查失败：FAIL。
3. 必需检查被阻塞：BLOCKED。
4. 必需检查未执行：BLOCKED 或 NOT RUN。
5. 所有必需检查通过：PASS。

可选检查不应阻断普通 PR，但必须在报告中保留状态。

---

# 4. 质量门禁组成

Quality Gate 包含八个检查维度。

| 编号 | 维度 | 主要职责 |
|---|---|---|
| QG-01 | Code Review | 检查代码质量和缺陷 |
| QG-02 | Automated Testing | 检查测试结果 |
| QG-03 | Security | 检查安全风险 |
| QG-04 | Dependency | 检查依赖与供应链 |
| QG-05 | Coverage | 检查测试覆盖情况 |
| QG-06 | Business Critical | 检查资金和核心业务路径 |
| QG-07 | Auto-Fix Verification | 检查自动修复有效性 |
| QG-08 | Change Integrity | 检查版本、变更和提交完整性 |

---

# 5. QG-01：Code Review Gate

## 5.1 审查要求

必须确认：

- 审查基线明确。
- 变更范围明确。
- 相关模块已审查。
- 审查结果已记录。
- 缺陷已分类。
- 高风险问题已处理。
- 证据可以追溯。

## 5.2 缺陷等级处理

| 等级 | 门禁要求 |
|---|---|
| P0 | 阻断自动发布及 PR 创建 |
| P1 | 必须人工审批，不能标记为无条件通过 |
| P2 | 必须修复或记录经批准的例外 |
| P3 | 按 PR 策略处理 |
| P4 | 可以记录为优化事项 |

## 5.3 审查范围

必须包括：

- 当前变更文件。
- 相关调用链。
- 受影响模块。
- 相关业务状态。
- 关键数据路径。
- 必要的上下游接口。

对于全仓库审计，必须同时记录已审查和未审查模块。

不得将仅审查 PR 差异标记为全仓库审查通过。

## 5.4 通过条件

同时满足：

1. 审查实际执行。
2. 审查基线明确。
3. 没有未处理 P0。
4. 没有未经批准的 P1。
5. 相关 P2 已处理或取得有效例外批准。
6. 关键变更经过复审。

否则不能标记为 Review Passed。

---

# 6. QG-02：Automated Testing Gate

## 6.1 必需检查

根据项目真实技术栈执行：

- 编译。
- 类型检查。
- Lint。
- 单元测试。
- 集成测试。
- API 测试。
- 相关回归测试。
- 必要的 E2E 测试。

具体执行范围根据变更影响和风险决定。

## 6.2 测试结果判定

| 结果 | 门禁处理 |
|---|---|
| PASS | 满足对应测试要求 |
| FAIL | 阻断相关质量门禁 |
| BLOCKED | 记录阻塞，不得视为通过 |
| SKIPPED | 必须提供合理原因 |
| NOT RUN | 必需测试未完成 |
| NOT APPLICABLE | 必须说明原因 |

## 6.3 关键测试要求

支付、余额、Token 计费、认证和数据库一致性等关键路径：

- 不允许因为测试环境不足而假装通过。
- 不允许只依赖 Mock 而忽略关键状态验证。
- 必须根据风险执行必要的集成测试。
- 必须验证异常及边界条件。
- 必须验证幂等性和并发安全性（适用时）。

## 6.4 通过条件

所有本次变更要求执行的必需测试必须实际通过。

存在必需测试失败时，Tests Passed 不成立。

---

# 7. QG-03：Security Gate

## 7.1 检查范围

必须根据实际技术栈选择工具，覆盖：

- 静态安全分析。
- 依赖漏洞。
- Secret 扫描。
- SQL 注入。
- XSS。
- CSRF。
- SSRF。
- 权限绕过。
- 身份认证问题。
- 不安全反序列化。
- 命令注入。
- 文件路径访问。
- 不安全加密。
- 敏感日志。
- CI/CD 权限。
- 第三方 Action 风险。

## 7.2 风险处理

| 风险 | 处理 |
|---|---|
| Critical | 阻断 |
| High | 默认阻断，除非经授权的安全例外 |
| Medium | 按影响范围及暴露条件评估 |
| Low | 记录并跟踪 |
| Informational | 记录 |

安全扫描工具的等级需要统一映射到 Uter 的风险体系。

不得仅根据不同扫描工具的原始等级机械判断。

## 7.3 Secret 检查

发现真实密钥泄露时：

1. 阻断 PR 质量门禁。
2. 不得将密钥复制到报告。
3. 记录文件路径和脱敏证据。
4. 通知人工处理。
5. 根据实际情况建议撤销和轮换凭证。

不能因为删除文件就认为已经消除密钥泄露风险。

---

# 8. QG-04：Dependency & Supply Chain Gate

检查：

- 依赖漏洞。
- 依赖来源。
- 锁文件一致性。
- 依赖许可证。
- 过期依赖。
- 恶意依赖风险。
- GitHub Actions 来源。
- Action 固定版本。
- 构建脚本。
- 安装脚本。
- 依赖混淆风险。

发现高风险依赖漏洞时必须阻断或进入人工风险审批。

依赖升级必须验证兼容性。

不得为了消除扫描提示而盲目升级所有依赖。

---

# 9. QG-05：Coverage Gate

## 9.1 覆盖率统计

根据真实项目情况统计：

- 全仓库覆盖率。
- Go Module 覆盖率。
- 核心业务覆盖率。
- 关键资金路径覆盖率。
- 前端核心模块覆盖率。

## 9.2 覆盖率规则

优先采用：

**不降低现有有效覆盖率，并逐步提高核心业务覆盖率。**

覆盖率阈值必须根据真实基线制定，不得虚构统一百分比。

建议分三步建立：

第一阶段：

- 采集真实覆盖率。
- 确定各模块基线。
- 找出没有测试的关键路径。

第二阶段：

- 新增代码不得降低对应模块覆盖率。
- 新增核心业务必须提供有效测试。
- 对历史低覆盖模块建立改善计划。

第三阶段：

- 根据模块风险和成熟度逐步设定门禁阈值。

## 9.3 禁止行为

- 删除测试提高通过率。
- 排除大量关键文件。
- 使用无意义断言提高覆盖率。
- 将 Mock 覆盖率当成真实业务覆盖率。
- 虚构覆盖率。

覆盖率不可用时，必须如实标记。

---

# 10. QG-06：Business Critical Gate

这是 Uter 最重要的专项门禁之一。

以下业务路径必须单独检查。

## 10.1 支付

验证：

- 签名正确。
- 金额正确。
- 订单状态正确。
- 重复回调不会重复入账。
- 并发回调不会重复入账。
- 异常通知可以安全重试。
- 主动查询和异步通知状态一致。
- 退款处理正确。

任何可能导致错误入账、重复入账或资金损失的问题都必须阻断。

## 10.2 余额

验证：

- 余额计算正确。
- 并发扣费正确。
- 不允许非法负余额。
- 退款正确。
- 重试不会重复扣费。
- 交易记录与余额一致。

## 10.3 Token 计费

验证：

- Token 统计正确。
- 模型价格正确。
- 输入输出计费正确。
- Cached Token 计费正确。
- 预扣费和实际扣费一致。
- 请求失败返还正确。
- 并发结算正确。
- 账单可追溯。

## 10.4 认证和权限

验证：

- 身份认证有效。
- 权限边界正确。
- Session 状态正确。
- Token 生命周期正确。
- API 越权不可发生。
- 敏感数据不会泄露。

## 10.5 数据库

验证：

- 事务正确。
- 数据一致性正确。
- 关键约束有效。
- 并发访问安全。
- 迁移具备兼容及回滚策略。

以上专项检查只对实际存在和受影响的业务模块执行，但任何跳过必须说明理由。

---

# 11. QG-07：Auto-Fix Verification Gate

自动修复后必须重新验证。

## 11.1 必须检查

- 原始缺陷已解决。
- 新增测试能够复现并验证原始问题。
- 相关测试通过。
- 相关回归通过。
- 修复后代码审查完成。
- 没有引入新的 P0。
- 没有引入未处理的 P1。
- 没有修改无关文件。
- 没有泄露 Secrets。
- 修复范围与 Issue 一致。

## 11.2 自动修复通过条件

必须同时满足：

1. 原始缺陷已验证。
2. 新增或更新测试通过。
3. 必需回归测试通过。
4. 修复后审查通过。
5. 安全检查满足要求。
6. 代码变更完整。
7. 质量报告完整。

只有全部满足，才能标记：

FIX VERIFIED。

## 11.3 修复失败

如果测试失败或修复无效：

- 不得自动发布已验证修复。
- 不得将失败报告标记为 PASS。
- 可以在隔离环境进行有限次数重试。
- 超过重试上限后转人工处理。

---

# 12. QG-08：Change Integrity Gate

## 12.1 基线检查

每次执行必须记录：

- Repository。
- Base Branch。
- Base SHA。
- Execution SHA。
- Fix Branch。
- Commit SHA。
- PR Base SHA。

所有测试和审查结果必须对应明确版本。

## 12.2 变更检查

提交前必须检查：

- git status。
- git diff。
- git diff --check。
- 变更文件列表。
- 敏感文件。
- 未跟踪文件。
- 不相关修改。
- 测试产物。
- 密钥扫描结果。

## 12.3 用户修改保护

不得覆盖用户已有未提交修改。

如果发现工作区变更：

1. 记录原始状态。
2. 使用独立 Worktree。
3. 只处理授权范围内的文件。
4. 不得强制清理工作区。
5. 发生冲突时停止自动提交。

## 12.4 Git 安全

禁止：

- 强制 Push。
- 自动合并。
- 删除其他分支。
- 覆盖远程历史。
- 直接推送主分支。

---

# 13. 风险等级与门禁决策

## 13.1 统一风险等级

| 等级 | 说明 |
|---|---|
| P0 | 严重资金、安全或数据风险 |
| P1 | 高危业务、安全或稳定性风险 |
| P2 | 重要业务缺陷 |
| P3 | 一般缺陷 |
| P4 | 优化建议 |

## 13.2 决策矩阵

| 情况 | 质量门禁 | PR 创建 | 合并 |
|---|---|---|---|
| 无阻断问题，必需测试通过 | PASS | 允许 | 人工决定 |
| 存在 P0 | FAIL | 禁止自动创建修复 PR | 禁止 |
| 存在未审批 P1 | BLOCKED | 等待人工批准 | 禁止 |
| P1 已审批且验证通过 | CONDITIONAL PASS | 允许 | 人工审核 |
| P2 已修复且验证通过 | PASS | 允许 | 人工审核 |
| P3 已修复且验证通过 | PASS | 允许 | 人工审核 |
| 必需测试失败 | FAIL | 不得以验证通过的名义创建 | 禁止 |
| 必需测试被阻塞 | BLOCKED | 依照修复策略处理，不得标记完全通过 | 禁止 |
| 安全扫描发现阻断风险 | FAIL | 阻断 | 禁止 |
| 只有非必需检查被阻塞 | 按策略判定 | 可允许 | 人工审核 |

## 13.3 CONDITIONAL PASS

仅用于已完成专项审批的 P1 等高风险修复。

必须明确记录：

- 审批人。
- 审批时间。
- 审批依据。
- 已完成的验证。
- 未完成的检查。
- 遗留风险。

CONDITIONAL PASS 不等于完全通过。

---

# 14. PR 质量门禁

## 14.1 普通 PR

必须完成：

- 变更审查。
- 编译。
- Lint。
- 相关单元测试。
- 必要集成测试。
- 安全基础扫描。
- 变更完整性检查。

## 14.2 AI 修复 PR

在普通 PR 要求基础上增加：

- 缺陷确认记录。
- 根因分析。
- 修复前后差异。
- 新增测试。
- 回归测试。
- 修复后审查。
- 风险评估。
- 自动修复执行记录。

## 14.3 P1 修复 PR

额外要求：

- 人工专项审批。
- 关键业务验证。
- 安全影响评估。
- 回滚方案。
- 明确标记高风险。
- 禁止自动合并。

## 14.4 P0

不得通过自动化修复 PR 流程发布。

应转入紧急人工事件处理机制。

---

# 15. Quality Gate 状态机

```text
CREATED
   ↓
COLLECTING
   ↓
VALIDATING
   ↓
EVALUATING
   │
   ├── PASS
   │     ↓
   │   READY_FOR_PR
   │
   ├── CONDITIONAL_PASS
   │     ↓
   │   WAITING_FOR_APPROVAL
   │
   ├── FAIL
   │     ↓
   │   BLOCKED_BY_FAILURE
   │
   └── BLOCKED
         ↓
      WAITING_FOR_DEPENDENCY
```

每次状态变化必须保存：

- Execution ID。
- Previous Status。
- New Status。
- Timestamp。
- Trigger。
- Evidence。
- Decision Reason。

不得仅根据 AI 的自然语言判断修改状态。

---

# 16. 统一报告格式

## 16.1 Markdown 报告

文件：

`uter-quality-report.md`

推荐结构：

```markdown
# Uter Quality Report

## 1. Execution
Execution ID:
Repository:
Branch:
Base SHA:
Execution SHA:
Timestamp:
Environment:

## 2. Overall Status
Overall Quality Gate:

## 3. Code Review
Status:
Reviewed Modules:
Unreviewed Modules:
P0:
P1:
P2:
P3:
P4:

## 4. Automated Testing
Status:
Total:
Passed:
Failed:
Blocked:
Skipped:
Not Run:

## 5. Security
Status:
Critical:
High:
Medium:
Low:

## 6. Dependency
Status:
Vulnerabilities:
License Risks:

## 7. Coverage
Repository:
Core Modules:
Critical Paths:

## 8. Business Critical
Payment:
Balance:
Token Billing:
Authentication:
Database Consistency:

## 9. Auto-Fix
Status:
Issues Fixed:
Issues Pending:
Failed Fixes:

## 10. Git
Branch:
Commit:
Push:
Pull Request:

## 11. Remaining Risks
List:

## 12. Final Decision
PASS / CONDITIONAL PASS / FAIL / BLOCKED
```

## 16.2 JSON 报告

同时生成：

`uter-quality-report.json`

JSON 必须包含机器可读的状态字段、执行基线、各检查项、证据位置、风险等级和最终决策。

不能只将 Markdown 文本简单复制到 JSON 字符串中。

## 16.3 证据

报告必须能定位：

- 测试日志。
- 审查记录。
- 安全扫描结果。
- 覆盖率文件。
- 修复差异。
- Commit。
- PR。
- CI 执行记录。

不得在报告中输出密钥或敏感数据。

---

# 17. GitHub Actions 集成

Quality Gate 必须能够被 GitHub Actions 调用。

建议：

- `quality-check.yml`
- `ai-code-review.yml`
- `ai-auto-fix.yml`
- `nightly-full-audit.yml`
- `weekly-security-audit.yml`

每个 Workflow 必须将执行结果交给统一 Quality Gate。

不能让不同 Workflow 各自使用不一致的通过条件。

## 17.1 PR 检查

每次 PR：

- 执行增量审查。
- 执行相关测试。
- 执行基础安全扫描。
- 执行变更完整性检查。
- 输出门禁结果。

## 17.2 完整审计

定时或人工触发：

- 全仓库审查。
- 全仓库测试。
- 深度安全扫描。
- 覆盖率统计。
- 关键业务专项测试。
- 汇总报告。

## 17.3 自动修复

AI 修复任务必须：

1. 调用 Auto-Fix Engine。
2. 获取测试结果。
3. 获取复审结果。
4. 调用 Quality Gate。
5. 根据结果决定是否允许 Commit、Push 和创建 PR。

不得绕过统一质量门禁直接创建标记为验证通过的 PR。

## 17.4 分支保护补偿控制（2026-11-01 验收整改落地）

Uter 仓库为私有免费仓，GitHub Branch Protection / Required Status Checks
API 不可用（HTTP 403），「必需状态检查」无法在平台层强制。补偿控制如下，
四层次中「GitHub 强制阻断」一栏以补偿态运行：

1. **CI 服务端检查为权威强制层**：`ci.yml`（push main + 全部 PR 触发，
   backend / race / coverage / vulnscan / frontend / desktop）在 GitHub
   runner 上执行，AI 与本地环境无法宣布其通过。
2. **发布门禁**：`release-gate.yml`（workflow_call/dispatch）作为发版前
   最后一道完整检查。
3. **CODEOWNERS**（`.github/CODEOWNERS`）：免费私有仓下仅为审查提示，
   不构成强制；文件内注明升级路径。
4. **流程纪律**：AGENTS.md「逐次单独授权」（commit/push/merge/rebase/
   部署逐项授权、禁 force push、禁 --no-verify）作为流程性补偿。
5. **退出码契约**：`scripts/quality/uter-quality.sh` 执行类阶段与
   `full` 在存在 FAILED/BLOCKED 子项时必须以非零码退出（verdict=FAIL），
   使编排器可被任何脚本链/CI step 直接消费为阻断门禁；NOT_RUN 不阻断
   但必须在报告与 verdict（PASS_WITH_NOTES）中显式披露。
6. **升级条件**：仓库转公开或升级付费计划后，应立即为 main 配置
   Required Status Checks（backend/race/coverage/vulnscan/frontend），
   届时本节补偿控制降级为辅助。

---

# 18. 质量策略配置

建议使用统一配置文件：

`.quality/policy.yml`

参考结构：

```yaml
version: 1

quality_gate:
  enabled: true

  statuses:
    pass: PASS
    fail: FAIL
    blocked: BLOCKED
    skipped: SKIPPED
    not_run: NOT_RUN
    not_applicable: NOT_APPLICABLE

  pull_request:
    require_review: true
    require_tests: true
    require_security_scan: true
    require_change_integrity: true

  risk_policy:
    P0:
      block_auto_fix: true
      block_commit: true
      block_push: true
      block_pr: true
      require_human_decision: true

    P1:
      allow_isolated_fix: true
      require_human_approval_before_push: true
      require_human_approval_before_pr: true
      block_auto_merge: true

    P2:
      allow_auto_fix: true
      allow_auto_commit: true
      allow_auto_push: true
      allow_auto_pr: true

    P3:
      allow_auto_fix: true
      allow_auto_commit: true
      allow_auto_push: true
      allow_auto_pr: true

    P4:
      allow_auto_fix: true
      allow_auto_commit: true
      allow_auto_push: true
      allow_auto_pr: true

  security:
    block_critical: true
    block_high: true
    secret_scan_required: true

  testing:
    require_relevant_tests: true
    require_regression: true
    forbid_fake_results: true

  coverage:
    use_baseline: true
    prevent_regression: true

  git:
    forbid_force_push: true
    forbid_direct_main_push: true
    forbid_auto_merge: true
    forbid_auto_deploy: true
```

以上仅为配置结构参考。

WorkBuddy 必须根据实际引擎实现的配置 Schema 进行校验，不能仅创建 YAML 而不让执行器读取它。

如某些字段与实际执行机制不兼容，必须调整 Schema，并在文档中说明。

---

# 19. 质量趋势分析

Quality Gate 应支持长期质量趋势统计：

- 每次审查缺陷数量。
- P0-P4 分布。
- 每个模块的缺陷趋势。
- 自动修复成功率。
- 自动修复失败率。
- 测试通过率。
- 测试覆盖率变化。
- 安全漏洞变化。
- 平均修复时间。
- PR 等待审核时间。
- 重复缺陷比例。
- 回归缺陷数量。

趋势分析不能取代单次门禁判断。

不能因为整体趋势良好而放过当前 P0 或 P1。

---

# 20. 最终验收标准

Quality Gate 必须通过以下验收：

1. 能够独立接收 Code Review 结果。
2. 能够独立接收 Testing 结果。
3. 能够接收安全扫描结果。
4. 能够接收覆盖率结果。
5. 能够接收 Auto-Fix 验证结果。
6. 能够统一关联执行基线。
7. 能够正确识别 P0。
8. 能够正确识别 P1。
9. 能够阻断必需测试失败。
10. 能够识别 BLOCKED。
11. 能够识别 NOT RUN。
12. 能够阻止虚假 PASS。
13. 能够生成 Markdown 报告。
14. 能够生成 JSON 报告。
15. 能够被 GitHub Actions 调用。
16. 能够为 PR 提供真实门禁结果。
17. 能够阻止未授权的自动合并。
18. 能够阻止未经授权的生产部署。

必须通过以下场景验证：

### 场景 A：正常通过

- 审查通过。
- 测试通过。
- 安全扫描通过。
- 变更完整性通过。

预期：PASS。

### 场景 B：P0 缺陷

- 审查发现 P0。

预期：FAIL，阻止自动修复发布和 PR 创建。

### 场景 C：P1 未审批

- 审查发现 P1。
- 修复已完成。
- 测试通过。
- 没有人工专项审批。

预期：BLOCKED，不允许 Push 和创建正式 PR。

### 场景 D：P1 已审批

- 修复完成。
- 必需测试通过。
- 人工专项审批存在。

预期：CONDITIONAL PASS，允许创建 PR，仍然禁止自动合并。

### 场景 E：测试失败

- 代码审查通过。
- 必需测试失败。

预期：FAIL。

### 场景 F：测试被阻塞

- 审查通过。
- 必需测试因缺少环境无法执行。

预期：BLOCKED，不得标记完全通过。

### 场景 G：自动修复回归失败

- 原始问题已解决。
- 其他模块回归失败。

预期：FAIL，不允许创建验证通过的 PR。

### 场景 H：密钥泄露

- 发现真实密钥进入代码变更。

预期：FAIL，阻断 PR。

### 场景 I：正常 AI 自动修复

- P2 缺陷确认。
- 隔离修复完成。
- 测试通过。
- 复审通过。
- 安全检查通过。

预期：PASS，允许 Commit、Push 和创建 PR。

---

# 21. 最终执行原则

1. Quality Gate 是统一判定中心。
2. Code Review Engine 和 Testing Engine 保持独立。
3. 所有结果必须基于真实执行记录。
4. 所有状态必须可追溯。
5. 所有风险必须明确记录。
6. 不允许 AI 自行绕过门禁。
7. 不允许自动合并 PR。
8. 不允许自动部署生产环境。
9. P0 和 P1 必须严格控制。
10. 所有质量规则必须可配置、可验证、可持续维护。

**最终目标：让 Uter 的每次代码变更、AI 自动修复和 Pull Request 都经过统一、可靠、可追溯的工程质量验证。**