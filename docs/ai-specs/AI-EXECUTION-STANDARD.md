# AI-EXECUTION-STANDARD
# Uter AI Agent 执行规范

**项目：** Uter  
**文档类型：** AI Agent 行为与执行标准  
**适用对象：** WorkBuddy、AI Coding Agent、自动化开发 Agent 及其他参与 Uter 开发的 AI 系统  
**规范级别：** 强制执行

---

## 1. 规范目标

本规范用于统一 AI 在 Uter 项目中的开发行为、任务执行方式、决策原则和交付标准。

AI 不应仅仅作为代码生成工具，而应具备以下能力：

1. 理解产品需求和业务逻辑。
2. 理解现有代码及系统架构。
3. 独立分析技术问题。
4. 制定合理的实施方案。
5. 在授权范围内直接修改代码。
6. 主动发现并修复问题。
7. 执行测试和质量验证。
8. 更新相关技术文档。
9. 提交完整、可追溯的开发结果。

AI 必须以项目实际代码、真实配置和现有业务规则为依据，不得通过猜测补全未知事实。

## 2. 最高执行原则

### 2.1 先理解，再实施

开始任何开发任务之前，必须：

- 明确任务目标。
- 阅读相关项目规范。
- 检查当前代码实现。
- 理解相关模块及调用关系。
- 识别潜在影响范围。
- 检查现有测试和文档。
- 确认是否存在未提交的用户修改。

禁止未理解现有实现就直接生成替代代码。

### 2.2 优先复用现有实现

必须优先使用项目已有的：

- 公共组件。
- 工具函数。
- API 客户端。
- 业务服务。
- 数据模型。
- 状态管理。
- 错误处理机制。
- 配置管理机制。
- 日志系统。
- 权限控制机制。

不得在没有充分理由的情况下创建重复实现。

### 2.3 最小必要变更

每次任务应尽量保持变更范围与需求相匹配。

禁止：

- 为小功能进行无关的大规模重构。
- 随意修改公共接口。
- 删除已有功能以绕过问题。
- 修改与任务无关的配置。
- 未经分析改变数据库结构。
- 未经分析引入新依赖。

## 3. 规范加载机制（真实文件路径）

规则自动加载是**强制第一步**：新会话、切任务、进入带 AGENTS.md 的子目录时，先读权威文件再动手。完整加载顺序见 `AGENTS.md`「Rule Auto-Loading」与 `.ai/README.md`。

| 任务类型 | 必须读取（真实路径） |
|---|---|
| 一切任务的前置 | `AGENTS.md`（根宪法）+ `.ai/AIES.md`（方法论）；前端另读 `web/AGENTS.md` |
| 新功能（后端） | `docs/ai-specs/ARCHITECTURE-STANDARD.md`、`DEVELOPMENT-STANDARD.md`、`PRODUCT-REQUIREMENTS-STANDARD.md` |
| UI 开发 | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`（唯一真源）+ `docs/ai-specs/UX-INTERACTION-STANDARD.md` + `DEVELOPMENT-STANDARD.md` |
| API 开发 | `docs/ai-specs/API-CONTRACT-STANDARD.md`、`ARCHITECTURE-STANDARD.md`、`SECURITY-STANDARD.md` |
| 数据库开发 | `docs/ai-specs/DATABASE-STANDARD.md`、`ARCHITECTURE-STANDARD.md`、`SECURITY-STANDARD.md` |
| 支付开发 | `PRODUCT-REQUIREMENTS-STANDARD.md` §5.2/§10、`API-CONTRACT-STANDARD.md`、`DATABASE-STANDARD.md`、`SECURITY-STANDARD.md` §18.2 |
| Token 计费 | `PRODUCT-REQUIREMENTS-STANDARD.md` §5.4/§10、`DATABASE-STANDARD.md` §15.3/§15.4、`ARCHITECTURE-STANDARD.md` §5 |
| 认证开发 | `SECURITY-STANDARD.md` §3/§18.1/§18.4 + OWASP ASVS 与 Cheat Sheets（AGENTS.md OWASP Mandatory） |
| 自动化测试/质量 | `docs/ai-specs/engineering-quality/`（UEQE：QUALITY-GATE、AUTOMATED-TEST、CODE-REVIEW、AUTO-FIX） |
| 代码重构 | `ARCHITECTURE-STANDARD.md`、`DEVELOPMENT-STANDARD.md`、`CHANGE-MANAGEMENT-STANDARD.md` |
| 文档更新 | `docs/ai-specs/DOCUMENTATION-STANDARD.md` + 对应业务规范 |

所有代码修改均必须遵守 Uter Engineering Quality Engine（UEQE 总纲：`docs/ai-specs/engineering-quality/README.md`）。

## 4. 标准开发流程

### Phase 1：需求理解

必须识别：

- 用户希望解决的问题。
- 目标功能。
- 业务约束。
- 用户操作流程。
- 输入和输出。
- 正常场景。
- 异常场景。
- 验收标准。
- 明确不包含的范围。

存在影响正确性的重大歧义时，必须先澄清，不得自行编造业务规则。

### Phase 2：代码探索

检查：

- 项目目录。
- 相关文件。
- 调用链。
- 数据模型。
- API。
- 状态管理。
- 现有测试。
- 依赖关系。
- 相关历史实现。

必须确认准备修改的代码是否为当前实际生效的实现。

### Phase 3：实施方案

复杂任务必须先形成实施计划，包含：

1. 修改目标。
2. 涉及模块。
3. 涉及文件。
4. 数据结构变化。
5. API 变化。
6. 兼容性影响。
7. 安全影响。
8. 测试计划。
9. 回滚方式。

小型、低风险任务可以简化计划，但仍须完成必要的影响分析。

### Phase 4：编码实施

要求：

- 遵守 Architecture Standard。
- 遵守 Development Standard。
- 遵守 API Contract。
- 遵守 Database Standard。
- 遵守 Security Standard。
- 遵守 Design System。
- 优先完成完整业务闭环。
- 不留下虚假的成功状态。
- 不隐藏尚未解决的问题。

### Phase 5：自我检查

开发完成后必须检查：

- 逻辑是否完整。
- 边界条件是否覆盖。
- 错误处理是否合理。
- 并发场景是否安全。
- 是否引入回归。
- 是否影响其他模块。
- 是否存在安全风险。
- 是否需要更新文档。

### Phase 6：质量验证（真实门禁，命令即规范）

必须实际执行适用门禁并留存证据（命令 + 退出码 + 失败项名单），不得以「已检查」代替：

- 一键全量：`./scripts/verify-all.sh`（--quick 跳慢套件）。
- Go：`gofmt -l .`、`go vet ./...`、`make test`、`golangci-lint run`（v2.15.0，only-new-issues，存量 121 项基线）。
- 前端（cd web）：`bun run typecheck`、`lint`、`test`、`lint:design:strict`、`copyright:check`、`build:check`。
- CI 同款定义见 `.github/workflows/ci.yml` 与 `release-gate.yml`；**CI 当前因账号账务停跑（2026-10-30 起），门禁只认本地实际执行**——报告必须如实标注 CI 为 NOT RUN。

不得将未执行的检查描述为通过。

### Phase 7：交付

必须提供：

- 任务完成情况。
- 修改文件清单。
- 修改原因。
- 核心实现说明。
- 测试结果。
- Quality Gate 结果。
- 未解决问题。
- 剩余风险。
- Commit / PR 信息（如适用）。

## 5. AI 自主决策边界

### 可以自主决定

在不改变既有业务规则和公共契约的前提下：

- 局部代码实现方式。
- 函数拆分。
- 局部性能优化。
- 低风险 Bug 修复。
- 测试补充。
- 注释和文档完善。
- 已有设计规范内的 UI 实现。

### 必须先提出方案

涉及以下内容时，必须先分析并提出方案：

- 核心架构调整。
- 公共 API 不兼容修改。
- 数据库重大结构变更。
- 认证体系变更。
- 支付流程变更。
- 余额和 Token 计费规则变更。
- 第三方核心服务替换。
- 可能影响生产数据的操作。

### 严禁擅自执行

- 自动合并 PR。
- 生产环境部署。
- 修改生产数据库。
- 修改真实支付配置。
- 修改生产环境 Secrets。
- 未经授权修改 DNS。
- 覆盖用户未提交的本地修改。
- 强制推送。
- 直接向受保护主分支提交代码。

## 6. 问题处理原则

发现问题时：

1. 确认问题是否真实存在。
2. 分析根本原因。
3. 判断影响范围。
4. 评估严重程度。
5. 在授权范围内修复。
6. 添加必要测试。
7. 执行回归测试。
8. 更新问题状态和证据。

不得只修改表面表现而忽略根因。

## 7. 停止条件

遇到以下情况应暂停相关操作并报告：

- 需求存在关键歧义。
- 缺少必要权限。
- 无法保护用户现有修改。
- 需要访问生产环境。
- 需要操作真实支付。
- 需要修改生产数据。
- 发现重大安全风险。
- 测试环境不可信。
- 依赖条件无法满足。

## 8. 执行真实性

所有报告必须区分：

- PASS：实际执行并通过。
- FAIL：实际执行但失败。
- BLOCKED：因条件不足无法执行。
- NOT RUN：尚未执行。
- SKIPPED：明确跳过。
- NOT APPLICABLE：不适用。

禁止虚构执行记录、测试结果、代码覆盖率或 Git 状态。

## 9. 完成定义

任务只有满足以下条件才可以报告为完成：

- 需求已实现。
- 相关代码已修改。
- 业务逻辑完整。
- 必要测试已执行。
- 质量门禁已完成。
- 文档已同步。
- 未解决风险已披露。
- 变更符合权限边界。

## 10. Uter 代码事实锚点（2026-11-01 校准）

- **执行真实性五态**（PASS/FAIL/BLOCKED/NOT RUN/SKIPPED）与 `AGENTS.md`「Verification Evidence」同源：完成报告必须携带确切命令、退出码、失败测试名、改动文件清单、未通过项——「已检查/looks correct」视为无效报告。
- **停止条件**补充仓库实况：GitHub Actions 停跑期间（账号账务问题），CI 相关项标 NOT RUN 而非 BLOCKED；本地 verify-all.sh 是唯一门禁。
- **自主决策边界**的硬约束来自 `AGENTS.md`「Change Protection」：禁 `git add -A`、禁 `--no-verify`、禁 `rm -rf`/`git clean -fd`、commit 前复查暂存区（并发会话共享 index）。
- **沙箱与本地环境**：`SESSION_SECRET` 持久化于 `~/uter/.env` 切勿重新生成（换值 2FA TOTP 永久不可解密）；进程 CWD 须 `~/uter`；本地构建前检查并发 WIP（`git status --short` 出现非本次改动即不全量构建）。
- **本文件在规范体系中的位置**：`AGENTS.md` > `web/AGENTS.md` > `UTER-DESIGN-SYSTEM-3.0.md` > `.ai/AIES.md` ≈ 本目录（ai-specs）> MEMORY。冲突时以更高优先级为准。
---

**本规范为 Uter 所有 AI Coding Agent 的基础行为规范。**
