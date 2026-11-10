# Uter 自动化与持续监控报告（PROVISIONAL，8.2 / 8.3）

- 执行时间：2026-11-10 GMT+8 · `/Users/lincolnhu/uter` @ `main 775e9eb50`
- 上游：`/Users/lincolnhu/aes` registry `1.12.2` · pin `4438ad0f35fc`
- 证据：`docs/governance/reports/evidence/`

## 1. 本次真实执行的自动化检查

| 命令 | 真实结果 | 判定 |
|---|---|---|
| `bash scripts/quality/aes-pin-check.sh` | `PASS scope=static-integrity status=ACTIVE version=1.12.2 fingerprint=4438ad0f35fc` | ✅ |
| `bash scripts/quality/aes-integration-check.sh` | PASS（9 项）；NOTE：`static wiring only … makes no conformance claim` | ⚠️ 静态 |
| `node --test tools/aes/integration-adapter.test.mjs` | `23 tests / 17 pass / **6 fail** / EXIT=1` | ❌ |
| `go test ./common/... -count=1` | 2 包 `ok`，EXIT=0 | ✅ |
| `go test ./controller/... -run 资金安全 -count=1` | `ok controller 26.320s`，EXIT=0 | ✅ |
| `sync-to-uter.mjs --check`（AES 侧只读） | `NOOP … changed files 0` | ✅ 漂移检测可用 |
| `change-impact.mjs --example`（AES 侧） | 9 域 / 21 规则 / 9 门禁 / 19 验证命令（含 `gofmt`、`go-vet`、`golangci-lint`、`go-test-per-module`、`secret-scan`、`security-scan`、`web-test`、`docs-web-build` 等） | ✅ 影响分析可用 |

## 2. 持续监控机制核对（8.2）

| 要求 | 实现 | 状态 |
|---|---|---|
| AES 版本变化检测 | `aes-pin.json` + `aes-pin-check.sh` + `aes-integration-check.sh` 比对 live fingerprint | ✅ 配置 + 实跑 PASS |
| AES 适用标准变化检测 | `sync-to-uter.mjs --check` / `drift-detect.mjs` | ✅ 机制存在，实跑 NOOP |
| Uter 代码合规性检测 | `ci.yml`、`nightly-full-audit.yml`、`scripts/verify-all.sh` | ⚠️ 配置存在，未实跑远程 CI |
| 产品需求与实现追溯 | `.aes/TRACEABILITY.md`、`reports/compliance/STANDARD-TO-CODE-MAPPING.md` | ⚠️ 处于用户未提交修改状态，未复核 |
| 设计系统合规检查 | `bun run lint:design:strict`（change-impact 列出）、86 个文件真实使用 token | ⚠️ 未实跑门禁 |
| 测试覆盖检查 | `scripts/coverage-gate.sh`、`coverage.out` | ⚠️ 未重跑 |
| 安全与可靠性检查 | `weekly-security-audit.yml`、gitleaks 配置 | ⚠️ 未实跑 |
| Agent 规范加载检查 | `.claude`/`.agents` skills + `aes-integration-check.sh` | ❌ AES 侧 NT-08 证明删除入口不被检测 |
| CI 质量门禁检查 | `ci.yml`、`release-gate.yml` | ⚠️ 未实跑远程 CI |
| 规范漂移报告 | `sync-to-uter.mjs`、`drift-detect.mjs` | ✅ 机制存在 |

## 3. 自动执行频率（8.3）

| 频率 | 配置 | 本次是否实跑 |
|---|---|---|
| 每次代码变更（受影响规范检查） | `change-impact.mjs`（AES 侧） | ✅ 已用 `--example` / `--files` 实跑 |
| 每次提交（必需质量门禁） | `ci.yml` push/PR | ❌ 未提交、未 push、未触发远程 CI |
| 每次 PR / 等效交付（完整适用门禁） | `release-gate.yml`（`workflow_dispatch`） | ❌ 未触发 |
| 每日（漂移 + 关键配置） | `nightly-full-audit.yml` `cron '0 19 * * *'` | ❌ 未触发 |
| 每周（全面合规巡检） | `weekly-security-audit.yml` `cron '0 19 * * 1'` | ❌ 未触发 |
| AES 发布新版本（影响分析 + 兼容性） | `sync-to-uter.mjs` + `integration-adapter.test.mjs` | ⚠️ 上游无新版本；但适配器 6 FAIL 证明兼容性未恢复 |

**本地可实际运行的命令**（本次已在本地实跑，无定时任务依赖）：
```
bash scripts/quality/aes-pin-check.sh
bash scripts/quality/aes-integration-check.sh
node --test tools/aes/integration-adapter.test.mjs
go test ./common/... -count=1
go test ./controller/... -run 'TopUp|Refund|Callback|Billing|Security|Outbox|Idempot' -count=1
# AES 侧只读：
node /Users/lincolnhu/aes/quality/scripts/aes/sync-to-uter.mjs --check
node /Users/lincolnhu/aes/quality/scripts/aes/drift-detect.mjs status
```

按 8.3「不得声称尚未运行的任务已经自动运行」及用户最终通过条件第 5 条：**长期自动化治理未建立**（配置齐备，但定时任务未在本次实跑，且 6 项必需门禁测试失败未修复）。

## 4. 负向测试与规范漂移测试（第二十步）

| 项 | 结果 |
|---|---|
| Uter 侧隔离副本负向测试 | **`NOT_EXECUTED`**：Uter 有 491 项用户未提交修改，创建完整隔离副本并注入违规会涉及大量业务代码与数据库依赖；本次未执行，不伪造 |
| AES 侧隔离负向测试（覆盖 Uter 上游） | 11 类实跑：5 DETECTED / 6 NOT_DETECTED（见 `../../../../aes/docs/governance/reports/evidence/NEGATIVE-TEST-RESULTS.md`） |
| 规范漂移测试 | `sync-to-uter --check` → NOOP/0 changed files；AES `drift-detect status` → 400 份 attestation 全 REVOKED |
| 模拟 AES 升级 | 未做完整模拟（F 测试 `NOT_EXECUTED`）；但 6 项适配器 FAIL 已实证升级兼容性破损 |

## 5. 结论

```
UTER_AUTOMATION_STATUS = PROVISIONAL / NOT_VERIFIED
- 必需自动化门禁：局部 PASS（pin/集成/go 测试），但集成适配器 6 FAIL
- 必需 Agent 验证率：1/3
- 持续检查机制：配置存在，未实跑定时任务
- 规范漂移检测：机制可用，但上游 400 份认证已全部 REVOKED
```

**不能因 CI 配置文件齐备就宣布长期自动化治理已建立。**
