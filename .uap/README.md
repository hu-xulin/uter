# UAP 1.0 — Uter Autonomous Engineering Platform

UAP 是 Uter 仓库内部**唯一**的自主 AI 工程治理与执行系统。它不是一个文档集合：规范层、
配置层、运行时层、执行引擎层、验证层、证据层都是真实存在、可以启动、可以执行任务、
可以独立判定结果的代码。

- 版本：见 `.uap/VERSION`
- 规范索引：`.uap/SPECIFICATION-INDEX.md`
- 机器配置：`.uap/config/*.yaml`（6 份）
- 系统入口：仓库根 `AGENTS.md` / `CLAUDE.md`（顶部 UAP Entry Point，原有项目约定完整保留）
- 命令入口：`./uap <command>` 或 `node .uap/bin/uap.mjs <command>`

## 1. 分层

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 规范层 | `.uap/{core,product,architecture,agents,development,quality,security,cross-platform,delivery,evolution}/` | 32 份独立规范，定义工程规则 |
| 配置层 | `.uap/config/` | 把规则映射到机器可解析的执行器 / 验证器 / Agent / 权限 / 工作流 |
| 运行时层 | `.uap/runtime/` | 10 个可测试组件：调度、任务、状态机、事件、资源、恢复、Agent、证据、策略、编排 |
| 执行引擎层 | `.uap/engines/` | 10 个真实工程引擎（产品、架构、开发、审查、测试、修复、安全、跨平台、交付、知识） |
| 验证层 | `.uap/validators/` | 32 个注册验证器，独立于执行器判定结果 |
| 证据层 | `.uap/evidence/` `.uap/state/` `.uap/reports/` | 不可覆盖的证据、可恢复状态、可追溯报告 |

## 2. 快速开始

```bash
./uap status              # 平台状态（真实读取状态与证据）
./uap doctor              # 启动 Runtime 并对 10 个组件做真实健康检查
./uap audit               # 对 Uter 全项目扫描，生成 DEFECT-REGISTRY.json
./uap validate            # 执行全部 32 个验证器
./uap validate --all      # 验证器 + 6 份配置 + 2 份入口 + 执行器覆盖率
./uap test                # 运行 UAP 自身测试
./uap test --all          # UAP 测试 + Uter 真实门禁（Go / Bun / 构建）
./uap task list           # 列出持久化任务
./uap task run <task-id>  # 执行任务
./uap task resume <id>    # 从磁盘状态恢复任务
./uap repair              # 有界自动修复闭环（沙箱）
./uap build               # 全量门禁与产物验证
./uap release check       # 发布前检查（生产操作一律 BLOCKED）
./uap report              # 生成全部规定报告
```

所有命令返回真实退出码：`0` 成功，`1` 存在失败，`2` 环境不满足或被阻断。
命令执行会写入 `.uap/evidence/` 证据与 `.uap/state/events.jsonl` 事件流。

## 3. 三个必须分开的验收结论

UAP 明确拒绝用一层的证据替代另一层：

1. **规范完整性** — 证据来自 `registryIntegrity()` 与 `SPECIFICATION-REGISTRY-REPORT.md`。
   文件存在 ≠ 规范已实施。
2. **UAP 实际运行能力** — 证据来自 `uap doctor`、Runtime 18 类自身测试、任务 DAG / 中断恢复 /
   端到端工作流的真实运行记录。
   规范写得好 ≠ Runtime 能跑。
3. **Uter 真实合规性** — 证据来自全项目扫描、缺陷注册表、真实项目门禁的退出码与业务专项验证。
   UAP 能跑 ≠ Uter 已合规。

## 4. 安全边界

默认 `deny`。生产读写、生产部署、真实支付、真实退款、密钥导出、强制推送、建/切分支、
破坏性 Git 操作、关闭质量门禁、删测试造 PASS 全部被 `permission-policy.yaml` 拒绝，
并由 `.uap/runtime/policy-engine/index.mjs` 在动作前 fail-closed 检查。
资金验证一律 `simulated_only`，需要生产授权的事项如实记为 `BLOCKED`。

## 5. 独立性

UAP 不依赖 AES / UAES / `docs/ai-specs` / `uaes/standards`（该体系已于 2026-11-12 退役）。
运行时不读取任何外部治理平台的注册表、执行器或审批结果。
`registryIntegrity()` 有一项专门检查：6 份配置中不得出现对已退役体系的运行时引用。

## 6. 当前设计系统与历史证据边界

- 当前设计系统事实来源：`docs/design-system/00-UTER-DESIGN-SYSTEM-OVERVIEW.md`、`TOKEN-MANIFEST.json`、`UDS-8.0.0-FINAL-IMPLEMENTATION-AND-ACCEPTANCE-REPORT.md` 与 `SHOWCASE-8.0.0.html`。
- UDS 8.0.0 当前为 `ACCEPTANCE_READY`、`accepted=false`；不得将其表述为用户已接受。
- UDS 3.0 runtime compatibility boundary 按 ADR-0002 保留，直到项目所有者明确授权迁移且当前 HEAD 绑定的消费者盘点、行为/视觉/兼容回归证据全部验证通过。
- 已删除的 `UDS-8.0.0-MIGRATION-REPORT.md`、`COMPAT-MAP.json`、旧版 `FINAL-ACCEPTANCE-REPORT.md` 不得作为当前状态来源；缺失这些文件不构成兼容边界已退役的证据。
- 任何历史 UAP 验收报告均不代表当前 HEAD。只有本次执行重新生成、包含唯一 requirement ID、精确证据引用、HEAD/工作树指纹和显式 BLOCKED/NOT_VERIFIED 项的报告才可用于当前验收。

## 7. 状态口径

`NOT_BUILT` / `PARTIALLY_BUILT` / `IMPLEMENTED_NOT_VERIFIED` / `PARTIALLY_VERIFIED` /
`FULLY_VERIFIED` / `FULLY_OPERATIONAL` / `BLOCKED` / `FAILED`。

`FULLY_OPERATIONAL` 只在 Runtime 真实启动、端到端任务、恢复演练与全量验证都有证据时使用；
未跑过的验证一律写 `NOT_EXECUTED`，不得写成 PASS。
