# Uter Engineering Quality Gate Standard
## 统一工程质量门禁规范

**项目：** Uter  
**规范编号：** UTER-ENG-004  
**版本：** 1.0.0  
**规范版本：** 1.0.0  
**规范状态：** Active  
**最后更新：** 2026-11-05  
**下次复核：** 2027-02-03  
**维护责任：** Uter Engineering Maintainers  
**版本追溯：** 以 Git 文件历史及对应 Commit SHA 为准  
**适用范围：** 全仓库代码审查、自动化测试、安全扫描、AI 自动修复及本地 main 质量门禁  
**执行主体：** Quality Orchestrator、Code Review Engine、Testing Engine、Auto-Fix Engine、GitHub Actions

**关联规范：**
- CODE-REVIEW-STANDARD.md
- AUTOMATED-TEST-STANDARD.md
- AUTO-FIX-STANDARD.md

**上位标准（Normative parent）：**
本规范是 **Uter 项目执行层**规范，不是企业级标准。企业级要求由 AES 定义，
本文件不得重新定义、削弱或平行维护 AES 已定义的质量治理要求。

| 归属 | 来源 | 关系 |
|---|---|---|
| 企业级质量治理、质量模型、风险分级 | AES `AES-09-001-QUALITY-MODEL-AND-GOVERNANCE` | 上位；本规范必须遵循 |
| 代码审查工程 | AES `AES-09-002-CODE-REVIEW-ENGINEERING` | 上位；本规范补充 Uter 执行细则 |
| 测试策略与执行 | AES `AES-09-003` ~ `AES-09-013` | 上位；本规范补充 Uter 工具与命令 |
| 自动修复与修复验证 | AES `AES-09-014-AUTO-FIX-AND-REPAIR-VERIFICATION` | 上位；本规范补充 Uter 权限边界 |
| 质量报告与证据 | AES `AES-09-015-QUALITY-REPORT-AND-EVIDENCE` | 上位；本规范补充 Uter 报告位置 |

AES 基线与规范版本以 `.aes/aes-pin.json` 的机器指纹和当前 ACTIVE Registry 为准；不得硬编码提交 SHA 或旧版本，
机器授权依据：AES 当前 ACTIVE Registry、`.aes/aes-pin.json` 与可复算机器证据；不得引用历史人工审批记录作为当前授权。

冲突处理：本规范与 AES 冲突时，以 AES 为准；Uter 专属的业务、支付、资金、
渠道约束不受影响，按 AES `AES-00-002` 的冲突解决顺序处理，并登记在
`.aes/AI-SPEC-DISPOSITION-REGISTRY.yaml` 的 `conflicts_registered` 中。

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

根据真实执行结果，判断代码是否满足 main Commit 的机器门禁；所有内部审查、测试、缺陷关闭和验收均由自动化执行器与独立机器验证器完成。

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

所有质量检查必须采用统一状态。本表与 AES `AES-09-001` §11 及
`AES-09-015` 的状态词汇严格对齐（C-02 已修正）：AES 使用 `NOT_RUN` 与
`NOT_VERIFIED`，本文件此前使用 `NOT RUN`（含空格）与 `SKIPPED`，造成同一
门禁在两套词汇下产生不同判定，现统一为下表。`SKIPPED` 作为 AES 词汇中
不存在的一档已删除；原先记为 `SKIPPED` 的情形按真实语义拆分为
`NOT_APPLICABLE`（经确认不适用）或 `NOT_VERIFIED`（已声明但无证据）。

| 状态 | 含义 |
|---|---|
| PASS | 已实际执行并满足要求，且存在真实执行证据 |
| FAIL | 已实际执行但不满足要求 |
| BLOCKED | 因权限、环境或依赖缺失无法执行 |
| NOT_RUN | 尚未执行 |
| NOT_VERIFIED | 已声明或已配置，但没有可核验的执行证据 |
| NOT_APPLICABLE | 经确认不适用，且理由可追溯 |

## 3.1 状态使用规则

PASS：

必须存在真实执行记录和证据。

FAIL：

必须存在失败原因和日志。

BLOCKED：

必须说明阻塞原因、影响范围和解除条件。

NOT_RUN：

不得当作通过。

NOT_VERIFIED：

不得当作通过；配置存在不等于执行通过。

NOT_APPLICABLE：

必须有合理依据。

不得把 BLOCKED、NOT_RUN 或 NOT_VERIFIED 自动转换为 PASS。

**词汇一致性自检**：任何报告、脚本或 YAML 中出现的状态值必须是上表六值之一。
出现 `SKIPPED`、`NOT RUN`（含空格）或其他别名即视为不合规，由
`scripts/quality/ai-specs-check.sh` 与 AES 侧状态校验共同拦截。

## 3.2 总体状态计算

总体状态使用以下优先级：

1. 存在阻断性风险：FAIL。
2. 必需检查失败：FAIL。
3. 必需检查被阻塞：BLOCKED。
4. 必需检查未执行：BLOCKED 或 NOT_RUN。
5. 所有必需检查通过：PASS。

可选检查不应阻断已通过全部必需门禁的本地 main Commit，但必须在报告中保留状态。

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
| P0 | 自动隔离；未解除风险前阻断 main Commit 和发布 |
| P1 | 必须自动修复、机器策略授权并通过独立复验；不得人工审批 |
| P2 | 必须修复或满足机器策略定义的例外 |
| P3 | 自动修复并复验后按策略提交 main |
| P4 | 机器记录并按风险策略处理 |

## 5.3 审查范围

必须包括：

- 当前变更文件。
- 相关调用链。
- 受影响模块。
- 相关业务状态。
- 关键数据路径。
- 必要的上下游接口。

对于全仓库审计，必须同时记录已审查和未审查模块。

不得将仅审查局部变更差异标记为全仓库审查通过。

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
| NOT_RUN | 必需测试未完成 |
| NOT_VERIFIED | 已声明但无执行证据，不得视为通过 |
| NOT_APPLICABLE | 必须说明原因 |

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

1. 自动阻断 main Commit 和发布状态转换。
2. 不得将密钥复制到报告。
3. 记录文件路径和脱敏证据。
4. 自动触发凭证隔离、撤销/轮换（仅限预授权范围）；无法安全自动处理时保持 BLOCKED 并记录机器处置计划。
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

发现高风险依赖漏洞时必须自动 FAIL/BLOCKED、隔离受影响依赖和变更，并触发自动修复与独立复验；不得进入人工风险审批队列。

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
- 超过重试上限后自动隔离该修复任务、生成根因报告并保持 BLOCKED；不得转为人工审批队列。

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
- 本地审查基线 SHA。

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
2. 使用临时隔离测试副本或临时目录；不得创建 Git 分支或 linked worktree。
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

| 情况 | 质量门禁 | main Commit | 发布/外部动作 |
|---|---|---|---|
| 无阻断问题，必需测试与独立复验通过 | PASS | 机器策略授权后允许 | 仍需独立发布策略授权 |
| 存在 P0 | FAIL | 自动阻断 | 自动隔离并阻断 |
| P1 缺少机器策略授权或独立复验 | BLOCKED | 自动阻断 | 自动阻断 |
| P1 机器授权且验证通过 | PASS | 机器策略授权后允许 | 仍需独立发布策略授权 |
| P2 已修复且验证通过 | PASS | 机器策略授权后允许 | 按发布策略 |
| P3 已修复且验证通过 | PASS | 机器策略授权后允许 | 按发布策略 |
| 必需测试失败 | FAIL | 自动阻断 | 自动阻断 |
| 必需测试被阻塞 | BLOCKED | 自动阻断 | 自动阻断 |
| 安全扫描发现阻断风险 | FAIL | 自动阻断 | 自动隔离并阻断 |
| 只有非必需检查被阻塞 | 按策略判定；不得掩盖必需项 | 仅在全部必需项 PASS 时允许 | 按发布策略 |

## 13.3 禁止人工条件通过

内部质量门禁不使用等待人工审批的 CONDITIONAL PASS 状态。所有必需控制必须真实执行并 PASS；不满足时只能为 FAIL 或 BLOCKED。机器策略例外必须由独立机器规则校验范围、期限、补偿控制、证据和自动撤销条件，且例外状态不等同于 PASS。记录必须包含机器决策 ID、策略版本、验证器、证据摘要、未满足条件和自动复验时间。

CONDITIONAL PASS 不等于完全通过。

---

# 14. 本地 main 变更质量门禁

## 14.1 每次本地 main 变更

必须完成：

- 全部变更的机器代码审查。
- 编译、Lint、类型检查和格式检查。
- 受影响模块的单元与集成测试。
- 必要端到端和回归测试。
- 依赖、许可证、漏洞和 Secrets 扫描。
- 变更完整性、权限和证据链检查。
- 独立机器验证器重新读取差异并复验。

## 14.2 AI 自动修复变更

必须额外保存：

- 缺陷确认和根因分析。
- 修复前后差异及影响范围。
- 新增或更新的回归测试。
- 修复后独立机器审查结果。
- 机器策略授权和证据摘要。

## 14.3 P1 本地 main Commit 条件

必须满足机器策略精确授权、关键业务验证、安全影响评估、回滚/恢复方案和独立机器复验；任何条件缺失均自动 BLOCKED。不得要求人工或第三方签署。

## 14.4 P0

P0 不得通过自动化流程绕过门禁提交或发布。必须自动隔离、冻结风险状态、执行安全诊断与可逆修复，并在独立验证器确认风险解除前保持 BLOCKED；不转入人工审批流程。

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
   ├── PASS → READY_FOR_LOCAL_MAIN_COMMIT
   ├── FAIL → AUTO_REMEDIATE_AND_REVERIFY
   └── BLOCKED / NOT_RUN / UNKNOWN / NOT_VERIFIED
             → BLOCKED_AND_AUTO_RETRY
```

每次状态变化必须保存 Execution ID、Previous Status、New Status、Timestamp、Trigger、Evidence 和 Decision Reason。不得仅根据 AI 的自然语言判断修改状态；不得设置 WAITING_FOR_APPROVAL 或人工待办状态。

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
PASS / FAIL / BLOCKED / NOT_RUN / NOT_VERIFIED / NOT_APPLICABLE
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
- 本地 main Commit。
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

## 17.1 main 变更持续集成检查

每次 main 提交以及定时审计：

- 执行全量或受影响范围的机器代码审查。
- 执行相关测试与回归测试。
- 执行安全、依赖、许可证和 Secrets 扫描。
- 执行变更完整性、规范映射和证据链检查。
- 输出机器可解析的门禁结果；失败时非零退出。

## 17.2 完整审计

事件或定时触发：

- 全仓库审查。
- 全仓库测试。
- 深度安全扫描。
- 覆盖率统计。
- 关键业务专项测试。
- 汇总报告。

## 17.3 自动修复

AI 修复任务必须：

1. 调用 Auto-Fix Engine。
2. 获取真实测试结果。
3. 获取独立机器复审结果。
4. 调用 Quality Gate。
5. 仅在全部必需门禁 PASS 且机器策略授权后创建本地 main Commit。
6. 禁止 Push、Pull Request、Merge、Rebase 和 Deploy。

## 17.4 main-only 执行控制

Uter 工程修复固定在本地现有 main 工作树执行。Agent 不创建执行分支、linked worktree 或 PR，不调用远程写接口。CI 在远程 main 提交和定时事件上独立运行；本地提交是否允许由同一组可执行门禁和机器证据决定。缺少 GitHub Branch Protection 不构成放宽本地门禁的理由，也不产生人工审批待办。

---

# 18. 质量策略配置

使用统一配置文件：

`.quality/policy.env`

（C-03 已修正：本文件此前写为 `.quality/policy.yml`，仓库中实际存在并被
`scripts/quality/uter-quality.sh:34` 真实 `source` 的是 `.quality/policy.env`。
语义等价，但文件名必须与磁盘一致，否则引用即为悬空。）

参考结构：

```yaml
version: 1

quality_gate:
  enabled: true

  statuses:
    pass: PASS
    fail: FAIL
    blocked: BLOCKED
    not_run: NOT_RUN
    not_verified: NOT_VERIFIED
    not_applicable: NOT_APPLICABLE

  main_commit:
    require_independent_machine_review: true
    require_tests: true
    require_security_scan: true
    require_change_integrity: true
    require_no_unverified_requirements: true

  risk_policy:
    P0:
      block_auto_fix: true
      block_commit: true
      block_push: true
      block_pr: true
      auto_isolate: true
      block_until_machine_verified: true

    P1:
      allow_isolated_fix: true
      require_machine_policy_authorization: true
      require_independent_machine_verification: true
      block_if_any_mandatory_check_not_pass: true

    P2:
      allow_auto_fix: true
      allow_auto_commit: true
      allow_auto_push: false
      allow_auto_pr: false

    P3:
      allow_auto_fix: true
      allow_auto_commit: true
      allow_auto_push: false
      allow_auto_pr: false

    P4:
      allow_auto_fix: true
      allow_auto_commit: true
      allow_auto_push: false
      allow_auto_pr: false

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
    forbid_branch_creation: true
    forbid_linked_worktree: true
    forbid_remote_push: true
    forbid_pull_request: true
    forbid_force_push: true
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
- 自动复验与修复闭环时间。
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
11. 能够识别 NOT_RUN。
12. 能够阻止虚假 PASS。
13. 能够生成 Markdown 报告。
14. 能够生成 JSON 报告。
15. 能够被 GitHub Actions 调用。
16. 能够为本地 main Commit 提供真实门禁结果。
17. 能够阻止未授权的远程写入、Push、PR 和 Merge。
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

预期：FAIL，阻止本地 Commit 和发布。

### 场景 C：P1 缺少机器策略授权

- 审查发现 P1。
- 修复已完成。
- 测试通过。
- 缺少有效机器策略授权或独立验证证据。

预期：BLOCKED；自动隔离，不允许 main Commit 或发布。

### 场景 D：P1 机器授权且验证通过

- 修复完成。
- 必需测试通过。
- 机器策略授权有效，独立验证器重新执行并全部 PASS。

预期：PASS，允许机器策略范围内创建本地 main Commit；不创建 PR。

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

预期：FAIL，不允许创建本地 Commit。

### 场景 H：密钥泄露

- 发现真实密钥进入代码变更。

预期：FAIL，阻断本地 Commit。

### 场景 I：正常 AI 自动修复

- P2 缺陷确认。
- 隔离修复完成。
- 测试通过。
- 复审通过。
- 安全检查通过。

预期：PASS，允许创建本地 main Commit；禁止 Push、PR、Merge 和 Deploy。

---

# 21. 最终执行原则

1. Quality Gate 是统一判定中心。
2. Code Review Engine 和 Testing Engine 保持独立。
3. 所有结果必须基于真实执行记录。
4. 所有状态必须可追溯。
5. 所有风险必须明确记录。
6. 不允许 AI 自行绕过门禁。
7. 不允许创建或自动合并 PR。
8. 不允许自动部署生产环境。
9. P0 和 P1 必须严格控制。
10. 所有质量规则必须可配置、可验证、可持续维护。

**最终目标：让 Uter 的每次本地 main 代码变更和 AI 自动修复都经过统一、可靠、可追溯的机器质量验证；内部审查、测试、整改和验收不依赖人工或第三方。**