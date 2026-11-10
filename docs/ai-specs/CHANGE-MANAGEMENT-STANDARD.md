# CHANGE-MANAGEMENT-STANDARD
# Uter 工程变更管理规范

**项目：** Uter  
**文档类型：** 工程变更与版本管理标准  
**适用范围：** 所有代码、配置、数据库、API 和架构变更  
**规范级别：** 强制执行
**规范版本：** 1.0.0（统一版本登记）  
**规范状态：** Active  
**最后更新：** 2026-11-05  
**下次复核：** 2027-02-03  
**维护责任：** Uter Engineering Maintainers  
**版本追溯：** 以 Git 文件历史及对应 Commit SHA 为准  

---

## 1. 规范目标

建立可追溯、可审查、可验证、可恢复的变更管理机制。

AI 必须保证每次修改都有明确目的、合理范围和完整证据。

## 2. 变更基本原则

1. 每次变更必须有明确目标。
2. 变更范围必须与任务匹配。
3. 不覆盖用户未提交的修改。
4. 不混入无关变更。
5. 重要变更必须进行影响分析。
6. 变更必须可审查。
7. 变更必须可验证。
8. 必要时必须提供回滚方案。

## 3. 变更分类

建议分为：

- FEATURE：新增功能。
- BUGFIX：缺陷修复。
- REFACTOR：重构。
- SECURITY：安全修复。
- PERFORMANCE：性能优化。
- DATABASE：数据库变更。
- API：接口变更。
- CONFIG：配置变更。
- DOCUMENTATION：文档变更。
- BUILD：构建和工程配置变更。

## 4. 变更前检查

开始修改前必须：

- 检查 Git 状态。
- 记录当前分支。
- 记录基线 Commit SHA。
- 检查未提交文件。
- 识别用户已有修改。
- 确认目标文件。
- 评估影响范围。

不得直接重置、清理或覆盖用户现有工作区。

## 5. 变更范围控制

每项任务必须明确：

- 目标文件。
- 允许修改的模块。
- 可能涉及的关联模块。
- 明确禁止修改的范围。

如果开发中发现必须扩大范围：

1. 说明原因。
2. 评估风险。
3. 更新任务计划。
4. 保留变更证据。

不得无理由扩大修改范围。

## 6. Git 分支管理

AI 自动修复和功能开发应在独立分支或隔离 Worktree 中进行。

建议分支命名：

- `feature/<description>`
- `fix/<description>`
- `security/<description>`
- `refactor/<description>`
- `ai-fix/<issue-id>-<description>`

不得直接向受保护主分支提交代码。

不得使用 force push 覆盖远端历史。

## 7. Commit 规范

建议使用 Conventional Commits：

- feat
- fix
- refactor
- perf
- test
- docs
- build
- ci
- security

Commit 信息必须说明实际变更内容。

不得将未完成或未经验证的工作描述为已完成。

## 8. 本地 main 变更证据

每次变更必须生成机器可读的本地变更记录，至少包含：

- Task ID 和需求/问题来源。
- 基线 SHA 与当前 Head SHA。
- 变更文件及内容摘要。
- 核心实现与影响范围。
- 实际测试命令和结果。
- 独立机器 Review 结果。
- Quality Gate 结果。
- 安全和兼容性影响。
- 未解决风险、回滚/恢复说明。
- 本地 Commit SHA（如机器策略允许创建）。

不得伪造测试、审查、覆盖率或证据；不得把自然语言报告替代实际执行结果。

## 9. 数据库变更

数据库迁移必须独立识别。

必须评估：

- 新旧代码兼容性。
- 数据回填。
- 迁移顺序。
- 锁表风险。
- 索引构建。
- 回滚限制。
- 生产数据影响。

AI 不得未经授权操作生产数据库。

## 10. 配置变更

配置变更必须说明：

- 配置名称。
- 默认值。
- 是否必填。
- 是否涉及敏感信息。
- 生效范围。
- 兼容性。
- 回滚方法。

不得提交真实 Secrets。

## 11. 质量门禁

创建本地 main Commit 前必须通过 Uter Engineering Quality Engine 和 AES 独立机器验证。

至少检查：

- Code Review。
- Automated Testing。
- Security。
- Dependency & Supply Chain。
- Coverage。
- Business Critical。
- Auto-Fix Verification。
- Change Integrity。

实际门禁以 QUALITY-GATE-STANDARD 为准。

## 12. 自动提交权限

在 AES 机器策略和本地 main-only 项目策略授权范围内，AI 可以：

- 在本地现有 `main` 工作树修改代码。
- 添加和更新自动化测试。
- 执行全部适用质量检查。
- 在全部门禁 PASS 且独立复验通过后创建本地 Commit。
- 生成机器证据和审计报告。

强制限制：

- 禁止创建、切换或复用执行分支及 linked worktree。
- 禁止 Push、Pull Request、Merge、Rebase、Force Push 和 Deploy。
- 不覆盖用户未提交修改；不得使用破坏性清理命令。
- 不提交真实密钥或生产数据。
- 不绕过质量门禁；NOT_RUN、UNKNOWN、BLOCKED、NOT_VERIFIED 均不是 PASS。

## 13. 禁止操作

未经额外明确授权，AI 不得：

- 创建或更新 Pull Request。
- Push、Merge、Rebase 或 Force Push。
- 部署生产环境。
- 修改生产数据库。
- 修改真实支付配置。
- 修改生产 Secrets。
- 修改 DNS。
- 操作线上用户余额。
- 执行不可逆的数据操作。

## 14. 回滚机制

重要变更必须明确：

- 回滚触发条件。
- 回滚范围。
- 回滚方式。
- 数据恢复方式。
- 回滚后的验证方法。

数据库变更应特别注意：代码回滚不代表数据库能够安全回滚。

## 15. 变更追溯

每项变更应能追溯到：

- 原始任务。
- 基线 SHA。
- 本地 main 基线。
- Commit。
- 测试报告。
- Quality Gate 报告。

## 16. 完成定义

变更只有满足以下条件才算完成：

- 目标已实现。
- 修改范围合理。
- 用户原有工作得到保护。
- 测试已执行。
- Quality Gate 已完成。
- 文档已同步。
- 本地 Commit 和机器证据可追溯。
- 未解决风险已披露。

## 17. Uter 代码事实锚点（2026-11-01 校准）

以下为本仓库 Git 与变更纪律的真实约定（全文以 `AGENTS.md` 四项 AI 协作自律为准）：

- **变更前检查**：`git status --short` 记录脏区——仓库常有并发 WIP，预存在修改绝不混入本次提交。
- **显式暂存**：只允许 `git add <路径>`，禁止 `git add -A` / `-u`；提交前一刻必须复查暂存区（`git diff --cached --name-status`）——并发会话共享同一 index，曾在 add 与 commit 之间混入他人暂存内容（2026-10-30 实测）。
- **授权基线**：当前项目采用本地 main-only。AI 只可在本地 main 工作树执行，机器策略 PASS 后允许本地 Commit；禁止分支、Push、PR、Merge、Rebase、Deploy、生产数据库写入、生产环境修改和真实支付配置修改。
- **禁用破坏性操作**：无 `rm -rf`、无 `git clean -fd`；删文件走废纸篓，每批 ≤10。
- **禁止入库物**：`.env`、`*.db`/`-shm`/`-wal`、`logs/`、构建产物（`web/dist`）不进提交、代码与文档。
- **提交身份**：`Uter.ai <huxulin.hxl@gmail.com>`；被 pre-commit 拒绝 = 身份不对，**禁止 `--no-verify`**。
- **远端**：只读核对 origin 和远程 main 基线；禁止远程写入。远程 main 与本地基线漂移时自动 BLOCKED，不自动推送或覆盖。
- **Commit 风格**（仓库历史实际用法）：`feat(scope): 描述` / `fix(scope): 描述` / `refactor(web): 描述` / `style: 描述`，scope 用实际域（design-system、monitor、brand、web、auth…）。
- **四步闭环**：改动 → 回归（verify-all.sh，🚫不带 --no-docs）→ `./rebuild-all.sh` → 提交。
- **分支与 PR**：本地 main-only，不创建任何执行分支、linked worktree 或 PR；不得 Push、Merge、Rebase 或 Deploy。CI 状态必须按当前提交的真实结果报告。

---

**变更管理的核心目标是让每一次 AI 修改都可机器审查、可验证、可追溯、可恢复；内部验收不依赖人工或第三方。**