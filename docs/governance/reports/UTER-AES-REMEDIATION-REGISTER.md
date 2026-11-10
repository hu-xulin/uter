# Uter 整改登记册（PROVISIONAL）

- 执行时间：2026-11-10 GMT+8 · `/Users/lincolnhu/uter` @ `main 775e9eb50`
- 上游基线未批准 → 本登记册为预审整改清单，**不代表正式验收销项**。
- 保护约束：Uter 有 **491 项已跟踪变更 + 41 项未跟踪**，均为用户正在进行的 UAES→AES 迁移；本次**未删除、未覆盖、未改名任何用户文件**。

## 1. 已自动完成并复测（2 项，本批不足 10 项，如实报告）

| Issue ID | Requirement ID | 描述 | 级别 | 影响文件/模块 | 复现 | 修复方案 | 状态 | 验证命令 | 验证结果 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|
| UTER-F-01 | 11.2 | `docs/governance/reports/` 不存在，6 份指定交付报告缺失 | P2 | `docs/governance/reports/*.md` | `ls docs/governance/reports/` → 不存在 | 新建目录与 6 份报告（用户显式要求，覆盖 `AGENTS.md` 的 docs 新增约束） | `AUTO_FIXED` | `ls -1 docs/governance/reports/*.md` | 6 份；`??` 新增未跟踪 | `docs/governance/reports/` |
| UTER-F-02 | 证据可追溯 | 真实执行日志仅存 `/tmp` | P2 | `docs/governance/reports/evidence/` | `ls /tmp/uter-*.log` | 归档 5 个实跑日志 + AES 负向测试汇总 | `AUTO_FIXED` | `ls -1 evidence/ \| wc -l` | 6 个文件 | `evidence/` |

## 2. 等待用户授权（7 项）

| Issue ID | Requirement ID | 描述 | 级别 | 影响文件/模块 | 复现 | 修复方案 | 状态 | 验证命令 | 验证结果 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|
| UTER-I-01 | P09 / 5.9 | 集成适配器 6 项测试 FAIL（`release payload absent` / signature-verified 与 AES 无签名模型不兼容） | **P1** | `tools/aes/integration-adapter.mjs`、`.test.mjs` | `node --test tools/aes/integration-adapter.test.mjs` | 需授权改变测试/适配器契约以对齐 `aes-machine-evidence-v1`；**不得删除测试或降低断言** | `UNFIXED_AWAITING_AUTHORIZATION` | 同上 | `17 pass / 6 fail / EXIT=1` | `evidence/uter-adapter.log` |
| UTER-I-02 | P00 / 版本锁定 | `aes-pin.json` 顶层 `governed_fingerprint 4438ad0f…` 与 `notes` / 迁移报告所称 `e9e6274e…` 冲突；`registry_blob_sha` 亦不一致 | **P1** | `.aes/aes-pin.json`、`.aes/INTEGRATION.md`、`UTER-LEGACY-STANDARD-MIGRATION-REPORT.md` | 对比字段 | 由授权主体确认唯一当前指纹后统一修订（涉及下游 pin，不可擅自改） | `UNFIXED_AWAITING_AUTHORIZATION` | `cat .aes/aes-pin.json` | 冲突仍存在 | `.aes/aes-pin.json` |
| UTER-I-03 | 5.2 / 42 项人工验收 | 42 项逐项验收签批缺失，`verified_item_count=0` | **P1** | `.aes/`、验收台账 | `aes-pin.json` 自述 | 指定责任主体逐项签署；不得代签 | `UNFIXED_AWAITING_AUTHORIZATION` | 人工核查 | 未完成 | `AES-HUMAN-APPROVAL-REQUIRED.md` |
| UTER-I-04 | 5.7 / 14 域门禁 | 14 个独立域门禁未执行，L3/L4 门禁 `BLOCKED` | **P1** | `scripts/quality/`、`reports/compliance/` | `aes-integration-check.sh` NOTE | 授权在生产等价环境执行并归档证据 | `UNFIXED_AWAITING_AUTHORIZATION` | `aes-integration-check.sh` | `static wiring only` | `evidence/uter-integration.log` |
| UTER-I-05 | 6.4 冲突 | `.ai/AIES.md` §0 优先级表未把 AES 列为最高权威，却把 `AGENTS.md` / `uaes/standards/` 列为高/中高 | P2 | `.ai/AIES.md`（48KB，**处于用户未提交修改状态**） | 读 §0 | 需授权修改用户正在编辑的文件，加入「AES 企业级唯一真源」优先级 | `UNFIXED_AWAITING_AUTHORIZATION` | `head -28 .ai/AIES.md` | 冲突仍存在 | `.ai/AIES.md` |
| UTER-I-06 | 5.2 全量审计 | `full-conformance-audit.py all` 写入 `reports/compliance/full-conformance-audit-2026-11-06/`，该目录文件全部为用户未提交修改 | P2 | `scripts/quality/full-conformance-audit.py`、`reports/compliance/` | `git status --porcelain reports/compliance/` | 需授权在**隔离副本**中运行，或由用户先提交/备份其修改 | `UNFIXED_AWAITING_AUTHORIZATION` | 同上 | 本次**未运行**（安全阻断） | `UTER-AES-CODE-AND-ARCHITECTURE-AUDIT.md` §4 |
| UTER-I-07 | 10.2 映射 | 2150 条 Requirement 的逐条「文件/代码/配置/检查/测试/证据」映射未完成 | **P1** | `reports/compliance/STANDARD-TO-CODE-MAPPING.md`（M 状态） | 映射矩阵 §2 | 需授权在隔离副本生成完整矩阵，避免覆盖用户修改 | `UNFIXED_AWAITING_AUTHORIZATION` | 人工核查 | `UNKNOWN=2131` | `UTER-AES-COMPLIANCE-MATRIX.md` |

## 3. 无法自动解决（外部约束 5 项）

| Issue ID | Requirement ID | 描述 | 级别 | 影响文件/模块 | 复现 | 修复方案 | 状态 | 验证命令 | 验证结果 | 证据路径 |
|---|---|---|---|---|---|---|---|---|---|---|
| UTER-I-08 | 7 Agent 实测 | `claude` / `codex` CLI `NOT_FOUND` → 测试 B/C/F `NOT_EXECUTED` | **P1** | `.claude/`、`agents/` | `command -v claude codex` | 需暴露 CLI 后重跑 A–F；本次不伪造 | `UNFIXED_EXTERNAL_CONSTRAINT` | `command -v` | `NOT_FOUND` | `UTER-AES-AGENT-EXECUTION-VERIFICATION.md` |
| UTER-I-09 | 8.3 持续运行 | 每日/每周 CI 为远程 GitHub Actions，本次未 push、未触发 | P2 | `nightly-full-audit.yml`、`weekly-security-audit.yml` | 检查触发器 | 需在远程 CI 实际运行；已提供本地可运行命令 | `UNFIXED_EXTERNAL_CONSTRAINT` | 本地命令已实跑 | 定时任务未实跑 | `UTER-AES-AUTOMATION-REPORT.md` §3 |
| UTER-I-10 | 5.7 安全专项 | 对账/备份恢复/依赖漏洞/并发压测未实跑；未连接真实支付渠道（按约束禁止） | **P1** | 资金相关模块 | 无实跑证据 | 需等价测试环境与资金安全专项授权 | `UNFIXED_EXTERNAL_CONSTRAINT` | — | `UNKNOWN` | `UTER-AES-CODE-AND-ARCHITECTURE-AUDIT.md` §5 |
| UTER-I-11 | 5.5 / 5.7 跨端 | Android / iOS / HarmonyOS 原生工程未在本仓库发现；视觉回归未比对 | P2 | `docs/design-system/`、移动端目录 | 目录盘点 | 需项目所有者确认适用范围或提供对应仓库 | `UNFIXED_EXTERNAL_CONSTRAINT` | `find` | 未发现 | 同上 §3 |
| UTER-I-12 | 第五部分前置 | AES 正式基线未批准（`FAIL — AUTOMATION_NOT_VERIFIED`） | **P1** | 上游 `/Users/lincolnhu/aes` | `AES-FINAL-ACCEPTANCE-REPORT.md` | 上游先完成 A-01…A-08 授权与整改 | `UNFIXED_EXTERNAL_CONSTRAINT` | 上游验收 | 未通过 | 上游报告 |

## 4. 统计

| 项 | 数 |
|---|---:|
| 发现问题总数 | **14** |
| 已自动修复 | **2** |
| 已复测通过 | **2** |
| 未修复 | **12** |
| 等待用户授权 | **7** |
| 无法自动解决 | **5** |
| 未解决 **P1** | **8**（I-01/02/03/04/07/08/10/12） |
| 未解决 P2 | 4 |

按用户最终通过条件第 2 条「Uter 有一项未解决的 P0/P1，不允许宣布全面符合」——本登记册有 8 项未解决 P1，**Uter 不得宣布全面符合 AES**。

## 5. 删除清单 / 兼容迁移清单

| 类别 | 结论 |
|---|---|
| 删除清单 | **空**（未删除任何文件） |
| Uter 项目扩展规范清单 | `uaes/` 全套（用户明确澄清保留，`AES wins on conflict`） |
| 旧规范合并清单 | 18 份 `docs/ai-specs/` → `uaes/standards/`，见 `UTER-LEGACY-STANDARD-MIGRATION-REPORT.md` |
| 兼容迁移清单 | 同上 §4「引用更新，0 残留」；`uaes/` 目录名本身作为历史兼容映射保留 |
| 冲突解决清单 | `.ai/AIES.md` 优先级表述（UTER-I-05）、pin 指纹矛盾（UTER-I-02） |
| 第二套竞争治理体系 | **未认定**：`uaes-standard-registry.yaml` 明确从属 AES，属第六部分规则 3 的合规项目级扩展 |
