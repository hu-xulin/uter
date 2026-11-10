# Uter AI Auto-Fix Standard
## AI 自动代码修复与本地 main 提交规范

**项目：** Uter  
**规范编号：** UTER-ENG-003  
**版本：** 1.0.0  
**规范版本：** 1.0.0  
**规范状态：** Active  
**最后更新：** 2026-11-05  
**下次复核：** 2027-02-03  
**维护责任：** Uter Engineering Maintainers  
**版本追溯：** 以 Git 文件历史及对应 Commit SHA 为准  
**适用范围：** Uter 全部代码仓库、工程模块及自动化修复流程  
**执行主体：** AI Coding Agent、Auto-Fix Engine、GitHub Actions  
**关联规范：**
- CODE-REVIEW-STANDARD.md
- AUTOMATED-TEST-STANDARD.md
- QUALITY-GATE-STANDARD.md

**上位标准（Normative parent）：**
本文件是 **Uter 项目执行层**规范，不是企业级标准。自动修复的权限、生命周期与
验证闭包由 AES 定义，本文件只补充 Uter 的 main-only 执行策略、自动验证与工具命令。
**本文件不得扩大 Agent 权限**；权限以 `AES-01-002` 与 `.aes/agent-governance.yaml` 为准。

| 归属 | 来源 | 关系 |
|---|---|---|
| 自动修复生命周期与修复验证 | AES `AES-09-014-AUTO-FIX-AND-REPAIR-VERIFICATION` | 上位；本文件为 Uter 实施细则 |
| Agent 权限与授权边界 | AES `AES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS` | 上位；最高约束 |
| 机器自动决策与外部权限边界隔离 | AES `AES-01-003-AUTONOMOUS-DECISION-AND-ESCALATION` | 上位 |
| 代码修改与重构 | AES `AES-06-010-REFACTORING-AND-MIGRATION` | 上位 |
| 安全缺陷修复 | AES `AES-10-011-SECURITY-TESTING-AND-VULNERABILITY-MANAGEMENT` | 上位 |
| Git / PR 与 CI 交付 | AES `AES-11-003`、`AES-11-004` | 上位 |

AES 基线与规范版本以 `.aes/aes-pin.json` 的机器指纹和当前 ACTIVE Registry 为准；不得硬编码提交 SHA 或旧版本。
冲突处理：与 AES 冲突时以 AES 为准，尤其权限相关条款不得放宽；Uter 专属
业务约束按 `AES-00-002` 顺序处理，并登记至 `.aes/AI-SPEC-DISPOSITION-REGISTRY.yaml`。

---

# 1. 规范目标

## 1.1 核心目标

建立一套安全、可控、可追溯的 AI 自动代码修复机制，使 Uter 能够自动完成：

1. 接收代码审查发现的缺陷。
2. 确认缺陷是否真实存在。
3. 分析问题根因。
4. 制定修复方案。
5. 创建隔离修复环境。
6. 自动修改代码。
7. 自动增加或更新测试。
8. 执行相关测试和回归测试。
9. 由独立机器审查器重新读取差异并执行代码审查。
10. 通过全部质量门禁并验证证据完整性。
11. 仅在本地现有 `main` 工作树执行；禁止创建、切换或复用任何执行分支。
12. 按机器策略自动生成本地 Commit；不 Push、不创建 Pull Request、不 Merge、不 Deploy。
13. 自动生成完整修复报告、测试报告和机器证据。

最终实现：

**Issue Detection → Root Cause Analysis → Code Fix → Test → Regression → Independent Machine Re-Review → Quality Gate → Local Main Commit → Evidence Report**

## 1.2 基本原则

AI 自动修复必须遵循：

- 正确性优先于修复速度。
- 业务安全优先于代码简洁。
- 最小修改优先于大规模重构。
- 测试证据优先于 AI 自我判断。
- 隔离执行优先于直接修改主工作区。
- 可回滚优先于不可逆操作。
- 不确定时停止，不得猜测性修改。
- 不允许通过删除测试或降低检查标准掩盖问题。

---

# 2. 自动修复适用范围

## 2.1 允许自动修复的问题

在完成缺陷确认及风险评估后，可以自动处理：

### 代码质量问题
- 明确的逻辑错误。
- 空指针及异常处理问题。
- 边界条件错误。
- 资源未释放。
- 内存泄漏。
- 并发安全问题。
- 重复代码。
- 无效代码。
- 类型错误。
- 明确的性能问题。

### API 和业务逻辑
- 参数校验遗漏。
- 状态流转错误。
- 错误码不一致。
- 数据格式处理错误。
- 接口返回不符合既定契约。
- 明确的业务条件判断错误。

### 数据库
- SQL 查询错误。
- 缺少必要索引的明确问题。
- 事务边界错误。
- 数据竞争。
- 查询性能问题。
- 数据一致性问题。

涉及破坏性数据迁移时，必须由机器策略验证精确的资源、环境、数据范围、备份、回滚与双重机器验证条件；缺少任一条件自动拒绝，不设置人工审批步骤。

### 认证与权限
- 权限检查遗漏。
- Session 校验错误。
- Token 生命周期处理错误。
- 明确的认证逻辑缺陷。
- 权限边界错误。

### 支付与计费
- 签名验证逻辑错误。
- 重复回调处理错误。
- 幂等性缺陷。
- 金额精度错误。
- 余额计算错误。
- Token 计费错误。
- 退款状态流转错误。

支付、余额及计费修复属于高风险领域，必须执行专项测试和额外审查。

### 前端
- 页面状态错误。
- 表单校验错误。
- API 调用错误。
- 权限展示错误。
- 页面崩溃。
- 内存泄漏。
- 明确的交互缺陷。

### 工程配置
- Lint 配置错误。
- 测试脚本错误。
- CI 配置错误。
- 依赖版本不一致。
- 明确的构建配置错误。

不得擅自修改生产部署配置。

## 2.2 默认禁止自动执行的操作

以下操作不得由 AI 自动执行：

- 自动合并远程变更或 Pull Request。
- 自动部署生产环境。
- 修改生产数据库。
- 删除生产数据。
- 修改真实支付商户配置。
- 修改真实支付密钥。
- 修改生产环境 Secrets。
- 修改线上服务器权限。
- 修改域名 DNS。
- 修改真实用户余额。
- 直接执行不可逆数据迁移。
- 删除用户已有代码或分支。
- 强制覆盖远程 Git 历史。

如确实需要上述操作，必须另行取得明确授权。

---

# 3. 缺陷确认机制

## 3.1 缺陷来源

Auto-Fix Engine 可以接收以下来源的问题：

- Code Review Engine。
- Testing Engine。
- Security Scanner。
- CI Failure。
- 人工提交的 Issue。
- 人工确认的代码缺陷。
- 定时全仓库审计。

所有问题必须转换为统一的缺陷记录。

## 3.2 缺陷记录格式

每项缺陷必须包含：

| 字段 | 说明 |
|---|---|
| issue_id | 唯一缺陷编号 |
| title | 问题标题 |
| severity | P0-P4 风险等级 |
| module | 所属模块 |
| file | 文件路径 |
| line | 代码位置 |
| description | 问题描述 |
| root_cause | 初步根因 |
| reproduction | 复现步骤 |
| evidence | 相关证据 |
| expected_behavior | 预期行为 |
| actual_behavior | 实际行为 |
| fix_allowed | 是否允许自动修复 |
| required_tests | 必须补充的测试 |
| base_sha | 原始 Commit SHA |
| status | 当前处理状态 |

## 3.3 缺陷真实性判断

AI 必须先确认问题是否真实存在。

确认方式：

1. 阅读相关源代码。
2. 阅读调用链。
3. 检查相关数据结构。
4. 检查业务状态流转。
5. 检查现有测试。
6. 尽可能构造复现测试。
7. 确认问题触发条件。
8. 判断影响范围。

缺少证据的问题不得直接作为已确认 Bug 进行自动修复。

问题状态统一为：

- CONFIRMED：已确认。
- SUSPECTED：疑似问题。
- FALSE_POSITIVE：误报。
- NEEDS_REPRODUCTION：需要进一步复现。
- BLOCKED：缺少必要环境或权限。
- FIXED：已修复。
- VERIFIED：修复已验证。
- LOCAL_COMMIT_RECORDED：本地 main Commit 已记录。
- CLOSED：已关闭。

---

# 4. 风险分级及自动修复权限

## 4.1 风险等级

| 等级 | 风险定义 |
|---|---|
| P0 | 严重资金损失、重大安全漏洞、数据破坏或系统级事故 |
| P1 | 高危安全问题、支付错误、余额错误、关键业务不可用 |
| P2 | 重要功能缺陷、明显业务逻辑错误、较高性能风险 |
| P3 | 一般功能缺陷、兼容性问题、代码质量问题 |
| P4 | 优化建议、低风险技术债 |

## 4.2 自动修复权限矩阵

| 等级 | 自动分析 | 隔离修复 | 自动测试 | 独立机器复验 | main Commit |
|---|---|---|---|---|---|
| P0 | 必须 | 仅允许隔离诊断与安全修复 | 必须 | 必须 | 仅当风险解除且全部门禁 PASS；否则自动阻断 |
| P1 | 必须 | 允许 | 必须 | 必须 | 全部门禁 PASS 且机器策略授权后允许 |
| P2 | 必须 | 允许 | 必须 | 必须 | 全部门禁 PASS 后允许 |
| P3 | 必须 | 允许 | 必须 | 必须 | 全部门禁 PASS 后允许 |
| P4 | 必须 | 按需允许 | 按需执行 | 适用时必须 | 按策略执行 |

P0 发现后：

1. 自动生成结构化问题记录并绑定源文件、规则 ID、证据哈希。
2. 自动隔离受影响任务、权限或发布状态。
3. 自动执行安全诊断、根因分析和可逆修复。
4. 自动运行负向测试、回归测试和独立机器复验。
5. 任一关键条件未通过时自动阻断 main Commit 和发布，不创建人工待办。

P1 发现后：

1. 自动在隔离工作区分析并制定修复计划。
2. 自动实施授权范围内的修复。
3. 自动运行必需测试、安全测试和回归测试。
4. 独立验证器重新读取变更并复验全部相关要求。
5. 全部 PASS 且机器策略授权后才允许 main Commit；否则自动 BLOCKED。
6. 本治理流程不创建分支或 PR，不自动合并或部署。

P0/P1 的决策由机器策略和独立验证器完成，不设置人工审批或第三方签署环节。

---

# 5. 修复执行流程

## 5.1 标准流程

### Step 1：接收问题

读取缺陷记录，确认：

- 缺陷编号。
- 风险等级。
- 模块。
- 文件路径。
- 代码位置。
- 原始 SHA。
- 复现条件。
- 修复权限。

### Step 2：固定代码基线

记录：

- Repository。
- Base Branch。
- Base SHA。
- 当前工作区状态。
- 未提交修改。
- 未跟踪文件。
- 当前执行环境。

审查和修复必须基于明确的代码版本。

如果基线发生变化，必须重新评估修复方案。

### Step 3：分析根因

分析：

- 问题发生原因。
- 调用链。
- 影响模块。
- 影响数据。
- 业务影响。
- 安全影响。
- 是否存在连锁问题。
- 是否需要数据库迁移。
- 是否需要接口兼容处理。

不得只修改报错位置而忽略真正根因。

### Step 4：制定修复方案

修复方案必须说明：

- 修改目标。
- 修改文件。
- 修改原因。
- 可能影响的模块。
- 数据兼容性。
- API 兼容性。
- 回滚方式。
- 测试要求。

优先采用最小必要修改。

### Step 5：创建隔离环境

优先使用：

- Git Worktree。
- 独立临时目录。
- 独立容器。
- 独立测试数据库。

禁止直接覆盖用户当前工作区。

如果用户存在未提交修改，必须保留原始状态。

### Step 6：执行代码修复

修复要求：

- 只修改必要文件。
- 保持现有架构约定。
- 保持代码风格。
- 不引入无关依赖。
- 不修改无关业务。
- 不删除有效测试。
- 不通过忽略错误掩盖问题。
- 不降低安全检查标准。

### Step 7：增加测试

每项修复必须有对应验证。

测试应覆盖：

1. 原始问题复现。
2. 修复后的预期行为。
3. 边界条件。
4. 异常条件。
5. 相关业务回归。
6. 必要的并发场景。

优先补充自动化测试，而不是只进行人工验证。

### Step 8：执行测试

至少执行：

- 相关单元测试。
- 相关集成测试。
- 相关模块完整测试。
- 相关回归测试。
- 必要的静态检查。
- 必要的安全扫描。

关键业务必须执行专项测试。

### Step 9：重新代码审查

修复完成后必须再次执行 Code Review Engine。

检查：

- 是否真正解决问题。
- 是否引入新的缺陷。
- 是否修改了不相关逻辑。
- 是否影响其他模块。
- 是否引入安全问题。
- 是否破坏兼容性。

### Step 10：质量门禁

调用 QUALITY-GATE-STANDARD.md。

未通过门禁时：

- 不得标记为 VERIFIED。
- 不得自动发布为已验证修复。
- 可以生成诊断报告。
- 可以在安全范围内继续修复。
- 超过自动修复次数限制时停止并报告。

---

# 6. 自动修复重试机制

## 6.1 重试限制

默认允许最多 3 轮自动修复尝试。

每轮必须记录：

- 修复方案。
- 修改文件。
- 测试结果。
- 失败原因。
- 与上一轮的差异。

不得无限循环修改代码。

## 6.2 停止条件

出现以下情况立即停止：

- 连续修复失败。
- 测试持续失败且无法确定根因。
- 修复涉及未经授权的生产配置。
- 发现新的 P0。
- 修复影响范围明显扩大。
- 出现数据迁移风险。
- 存在不可恢复的数据风险。
- 需要真实支付交易验证。
- 无法安全隔离用户修改。
- 远程 main 与本地基线发生漂移且无法通过只读证据安全判定。

停止后必须输出诊断报告。

---

# 7. Git 分支与版本控制

## 7.1 本地 main-only 工作模式（强制）

Uter 工程治理只允许在本地现有 `main` 工作树直接执行，不创建、不切换、不复用任何执行分支，也不创建 Pull Request。

- 开始前读取当前分支、HEAD、工作区状态和完整 diff。
- 当前分支不是 `main` 时自动停止写操作；不得擅自切换分支。
- 不覆盖用户未提交修改；仅编辑明确属于本任务且不存在冲突的文件。
- 每项问题使用独立 Finding ID、Commit（如获机器策略许可）和证据记录追踪，不以分支隔离问题。
- 默认禁止 Push、Pull Request、Merge、Rebase、Force Push 和 Deploy。
- 若远程 main 与本地基线发生漂移，保留本地状态并将结果标记为 BLOCKED；不得自动覆盖或推送远端。
- 禁止使用 `git reset --hard`、`git clean -fd` 或其他破坏性方式清理工作区。

## 7.3 Commit 规范

采用 Conventional Commits。

格式：

`<type>(<scope>): <description>`

示例：

`fix(payment): prevent duplicate balance credit`

`fix(auth): validate session refresh state`

`fix(billing): correct token usage calculation`

`test(payment): add concurrent callback regression tests`

Commit 必须清楚说明实际修改内容。

## 7.4 Commit 前检查

执行：

- git status。
- git diff。
- git diff --check。
- 检查敏感文件。
- 检查 Secrets。
- 检查无关文件。
- 检查测试报告。
- 检查质量门禁。

不允许提交：

- `.env` 中的真实密钥。
- 私钥。
- 支付证书。
- 生产数据库凭证。
- 测试生成的大型临时文件。
- 无关个人配置。

---

# 8. 本地 main Commit 与远程操作边界

## 8.1 远程操作禁止项

本规范的默认执行范围仅为本地现有 `main` 工作树：

- 允许在机器策略授权范围内自动修改、测试、复验和生成本地 Commit。
- 禁止创建或切换执行分支。
- 禁止 Push、Pull Request、Merge、Rebase、Force Push 和 Deploy。
- 禁止调用 GitHub 写接口绕过本地工作树和证据门禁。
- 不得要求用户或第三方完成内部代码审查、签批或验收。

## 8.2 本地 main Commit 条件

仅当以下条件全部满足时，才允许创建本地 Commit：

1. 缺陷、需求和受影响规则已自动识别并可追溯。
2. 修复已完成，且未覆盖用户既有未提交内容。
3. 必需测试、相关回归和安全检查真实执行并通过。
4. 独立机器验证器已重新读取变更并复验。
5. 质量门禁、权限策略和证据完整性全部 PASS。
6. 不存在 FAIL、BLOCKED、NOT_RUN、UNKNOWN 或 NOT_VERIFIED。
7. 不存在未授权的敏感文件或生产配置修改。
8. P1 已通过机器策略授权与独立复验；授权不得由执行 Agent 自行修改或生成。

任何条件不满足时自动 BLOCKED，记录原因并继续执行不受影响的安全任务；不得转入人工审批队列。

## 8.3 Commit 标题

格式：

`[AI Fix][P2] Prevent duplicate payment credit`

示例：

`[AI Fix][P3] Fix frontend loading state`

## 8.4 PR 描述模板

```markdown
## Summary
修复内容概述。

## Related Issues
关联缺陷编号。

## Severity
P0/P1/P2/P3/P4。

## Base
Base Commit SHA。

## Root Cause
问题根因。

## Changes
修改文件及具体内容。

## Tests Added
新增或修改的测试。

## Test Results
实际执行结果。

## Regression
回归测试结果。

## Security Impact
安全影响。

## Compatibility
接口及数据兼容性。

## Rollback
回滚方案。

## Remaining Risks
尚未解决的问题。

## Quality Gate
Code Review: PASS/FAIL
Automated Tests: PASS/FAIL
Security Scan: PASS/FAIL
Regression: PASS/FAIL

## AI Execution
Execution ID:
Fix Branch:
Commit SHA:
```

不得将未执行的测试标记为 PASS。

## 8.5 main Commit 后的行为

提交后：

- 更新缺陷状态为 COMMITTED。
- 保存 main Commit SHA。
- 保存测试、审查和独立机器复验报告。
- 记录剩余风险和自动回滚条件。
- 重新执行 main 分支门禁并验证证据链。

提交不代表合并、部署或生产授权；这些动作仍由独立机器策略决定，缺少精确授权时自动拒绝。

---

# 9. 安全控制

## 9.1 权限隔离

不同任务应使用不同权限：

- 普通代码审查：只读权限。
- 自动测试：只读源码和测试环境权限。
- 自动修复：隔离工作区写权限。
- 本地 main Commit：仅限机器策略授权且独立复验 PASS。
- 远程写入：禁止 Push、PR、Merge、Rebase 和 Deploy。

不应将所有权限授予所有 Workflow。

## 9.2 Secrets 管理

严禁：

- 打印密钥。
- 提交密钥。
- 在审查报告、日志或远程协作平台暴露密钥。
- 向 AI 提供生产密钥。
- 将生产凭证用于自动化测试。

只使用专门的测试凭证和最小权限 Token。

## 9.3 第三方依赖

如果自动修复需要升级依赖：

- 先检查漏洞和兼容性。
- 说明升级原因。
- 尽量单独提交。
- 执行完整相关测试。
- 检查许可证。
- 检查锁文件。
- 不允许无理由大范围升级。

---

# 10. 修复记录与报告

每轮修复必须生成报告。

推荐结构：

```text
reports/
└── auto-fix/
    └── <execution-id>/
        ├── auto-fix-report.md
        ├── auto-fix-report.json
        ├── changes.patch
        ├── test-results.json
        ├── review-results.json
        └── execution.log
```

报告至少包含：

- Execution ID。
- Issue ID。
- 风险等级。
- Base SHA。
- Fix Branch。
- Commit SHA。
- 修改文件。
- 修复前问题。
- 根因。
- 修复方案。
- 测试新增内容。
- 实际测试结果。
- 回归结果。
- 审查结果。
- 安全扫描结果。
- 质量门禁结果。
- PR URL。
- 遗留风险。

报告不得包含密钥、密码或其他敏感信息。

---

# 11. Auto-Fix Engine 状态机

建议统一状态：

```text
RECEIVED
   ↓
TRIAGING
   ↓
CONFIRMED
   ↓
PLANNING
   ↓
ISOLATING
   ↓
FIXING
   ↓
TESTING
   ↓
REGRESSION
   ↓
REVIEWING
   ↓
QUALITY_GATE
   ↓
VERIFIED
   ↓
COMMITTING
   ↓
EVIDENCE_ARCHIVED
```

异常状态：

- REJECTED
- FALSE_POSITIVE
- BLOCKED
- FAILED
- BLOCKED_BY_POLICY
- CANCELLED

状态必须持久化，避免任务中断后无法恢复执行记录。

---

# 12. 验收标准

Auto-Fix Engine 必须通过以下验收：

1. 能够接收 Code Review Engine 的缺陷。
2. 能够确认缺陷真实性。
3. 能够生成根因分析。
4. 能够创建隔离工作区。
5. 能够修改代码。
6. 能够新增测试。
7. 能够实际运行测试。
8. 能够执行相关回归。
9. 能够重新执行代码审查。
10. 能够根据风险等级执行权限控制。
11. 能够严格在 main 上执行，拒绝创建任何执行分支或 PR。
12. 能够按机器策略自动创建本地 main Commit。
13. 能够拒绝 Push、PR、Merge、Rebase 和 Deploy。
14. 不创建执行分支，不创建 PR，不等待人工审核。
15. main Commit 关联完整测试、修复与独立复验机器证据。
16. P0 能正确阻断。
17. P1 能触发机器策略授权、自动隔离和独立机器复验。
18. 不会自动合并。
19. 不会自动部署。
20. 不会覆盖用户未提交修改。

必须至少完成一次真实、低风险的端到端自动修复、自动验证和 main-only 提交流程演练；不得创建分支或 PR。

只生成脚本或配置文件不算验收通过。

---

# 13. 最终执行要求

AI Coding Agent 必须：

- 阅读本规范。
- 遵守代码审查规范。
- 遵守自动化测试规范。
- 遵守质量门禁规范。
- 在隔离环境执行修复。
- 对修复进行真实验证。
- 仅在机器策略授权范围内创建本地 main Commit；不 Push、不创建分支或 PR。
- 保留完整执行证据。

**最终原则：内部修复、审查、测试和验收完全自动化；只有机器策略授权且独立复验 PASS 才能提交 main。任何超出机器授权范围的生产、部署、资金或外部法律行为均自动拒绝，不引入人工审批或伪造外部授权。**