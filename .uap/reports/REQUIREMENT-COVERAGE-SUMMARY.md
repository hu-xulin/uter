# 需求验证覆盖摘要（诚实 / audit P2-06）

> 由 `node .uap/tools/requirement-verification.mjs` 的真实运行生成。生成时间：2026-11-14T02:47:51.682Z。
> 执行绑定：execution_id=UAP-EXEC-20261114024749-0d25182b / git_head=d83e81f3ed69182c612b3c1dc8dec165caa0fccd / worktree_fingerprint=50331c1b2ae5024f3634685462789bce47d8beef5c4092efd42387492d522478。

## 结论先行

- 需求总数 **538**（强制性 402 / 验收 136）。
- 本轮真实执行的**有界行为套件命令**数：**2**（不盲目执行 538 条命令矩阵）。
- 真实观测到的**独立行为断言**数：**6**。
- 只有绑定了这些独立行为断言、命令 exit 0、且证据哈希有效并绑定当前执行的要求，才是 VERIFIED。

## 状态分布（严格 4 态）

| 状态 | 数量 |
| --- | ---: |
| VERIFIED | 6 |
| NOT_VERIFIED | 526 |
| BLOCKED | 6 |
| NOT_APPLICABLE | 0 |

## 各状态桶的证据索引

### VERIFIED (6)
- `UAP-02-002-REQ-004` → FK enforced (evidence UAP-EV-20261114024751-9195d173, sha 9d8881d02ea7)
- `UAP-06-002-REQ-002` → --- PASS: TestOrderQueryFourState (evidence UAP-EV-20261114024749-0f50a0c9, sha b7d8a092590b)
- `UAP-06-002-REQ-003` → --- PASS: TestRefundStatusIdempotent (evidence UAP-EV-20261114024749-0f50a0c9, sha b7d8a092590b)
- `UAP-06-002-REQ-004` → --- PASS: TestDuplicateNotificationIsIdempotent (evidence UAP-EV-20261114024749-0f50a0c9, sha b7d8a092590b)
- `UAP-06-002-REQ-006` → --- PASS: TestAmountSnapshotMismatchRejected (evidence UAP-EV-20261114024749-0f50a0c9, sha b7d8a092590b)
- `UAP-06-002-REQ-007` → --- PASS: TestSignatureVerificationRejectsTampered (evidence UAP-EV-20261114024749-0f50a0c9, sha b7d8a092590b)

### NOT_VERIFIED (526) — 按原因码
- `PROBE_SHARED_EVIDENCE`: 526

### BLOCKED (6)
- `UAP-00-003-REQ-005` → 外部依赖未满足：Explicit production deployment authorisation (permission-policy.yaml production_deploy: deny)；解除条件：Written user authorisation + policy change
- `UAP-05-002-REQ-010` → 外部依赖未满足：Real payment provider account and production credentials (real_payment: deny)；解除条件：Explicit authorisation + provider sandbox/production credentials
- `UAP-06-002-REQ-017` → 外部依赖未满足：Real payment provider account and production credentials (real_payment: deny)；解除条件：Explicit authorisation + provider sandbox/production credentials
- `UAP-06-002-ACC-007` → 外部依赖未满足：Real payment provider account and production credentials (real_payment: deny)；解除条件：Explicit authorisation + provider sandbox/production credentials
- `UAP-08-001-REQ-010` → 外部依赖未满足：Explicit production deployment authorisation (permission-policy.yaml production_deploy: deny)；解除条件：Written user authorisation + policy change
- `UAP-08-002-REQ-010` → 外部依赖未满足：Explicit production deployment authorisation (permission-policy.yaml production_deploy: deny)；解除条件：Written user authorisation + policy change

### NOT_APPLICABLE (0)
- （无，未登记任何豁免）

## 明确声明：哪些没有验证

- **526 条 NOT_VERIFIED**：占绝大多数。它们没有针对本要求的独立真实行为断言；
  旧引擎的 `PARTIALLY_VERIFIED` 来自通用套件/CLI/构建命令与「实现文件存在」这类共享/静态证据，
  并不代表这些要求的行为被真正执行验证过。本轮未将任何 `IMPLEMENTED` 批量转换为 `VERIFIED`。
- **6 条 BLOCKED**：依赖生产授权/真实支付/服务商沙箱/真机等外部条件，未满足，绝不假通过。
- 旧引擎事实：17 个 STATIC_EXISTENCE 探针（文件/符号/配置/报告卡/文本哈希）、
  27 个通用 BEHAVIOR_EXECUTION 命令（整套件/整 CLI/整构建，共享证据）；
  **0/538 条要求**在旧引擎中拥有独立真实行为断言。
- 外键等「观察即通过」的测试：本引擎要求真实断言（如 `FK enforced` + `orphan rejected`）出现在输出中，
  仅「命令 exit 0」不足以 VERIFIED。

## 复现命令

- `node .uap/tools/requirement-verification.mjs`（真实运行，写出 RESULTS + 全 538 严格 MATRIX + 本摘要）
- `node .uap/tools/requirement-verification.mjs --print-states`（从矩阵重算并打印诚实 `states:` 行）
- `node .uap/tools/requirement-verification.mjs --dry-run`（单元/负向测试用，不执行命令、不写文件）

