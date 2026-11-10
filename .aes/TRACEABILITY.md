# AES → Uter Standard Traceability Matrix

**Governing specification:** `UTER-AES-GOV-001` (`docs/ai-specs/UTER-AES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md`)  
**Audit date:** 2026-11-05 (refreshed 2026-11-06)  
**AES source:** hu-xulin/aes — universal P00–P12 only  
**AES lifecycle:** ACTIVE — registry `1.12.1`, `AES-APPROVAL-2026-11-07-004`, commit `74e5d2eea215c96b845d7a0b2111b7fa011c540f`  
**Uter integration:** MIGRATION_PENDING — AES domain gates remain `NOT_RUN`, global gate `BLOCKED`, Requirement→Evidence mapping incomplete  
**This matrix is an inventory, not a conformance certificate.** A path being present does not prove a rule is implemented, enforced or verified. Registry approval is a normative baseline, not a Uter conformance certificate; see `.aes/INTEGRATION.md` §4 in the AES repository.

**Repository separation:** this table covers AES P00–P12 (Layer A, owned by the
`aes` repository). UTER P13 is a **Uter project-specific extension** (Layer B),
registered only in `.aes/uter-governance-registry.yaml` and specified in
`.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`. It is assessed as an independent
14th domain and must never be registered in the AES universal registry.

**P09 / P10 division (§1.3 / §8 / §9 / §10 / §16.3):** P09 *proves* whether engineering quality meets
requirements; P10 *defines* the security and reliability requirements. Security
testing is required by P10 and executed/recorded by the P09 test system. The
earlier `SPEC-001` finding (an older execution order labelled P09 as Security and
P10 as Business Domain) is **resolved**: `UTER-AES-GOV-001` formally adopts
P09 Quality Engineering and P10 Security & Reliability, matching the actual AES
`09-quality-engineering/` / `10-security-reliability/` layout, and moves business
domain rules to UTER P13. AES was never modified to accommodate Uter.

## Phase mapping

| AES phase | Uter current source / implementation | Mapping status | Required next evidence |
|---|---|---|---|
| P00 Foundation | AGENTS.md, CLAUDE.md, .ai/AIES.md, docs/ai-specs/, scripts/quality/ai-specs-check.sh, .aes/INTEGRATION.md, docs/ai-specs/CONFLICT-REPORT.md | PARTIAL | Complete 15-control evidence mapping; reconcile AES/Uter result-state semantics; full local-standard conflict review; current-head Uter CI and runtime agent permission-denial evidence; migrate generic rules only after AES approval |
| P01 AI Governance | Root agent instructions, `.aes/agent-governance.yaml`, `.ai/task-schema.json`, P01 policy contract tests, CI single-work-branch check | PARTIAL | Exact-head CI; WorkBuddy/Claude runtime permission denial tests; local dirty-worktree preservation; interruption/resume and multi-agent runtime evidence |
| P02 Product Engineering | docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md | PRESENT / NOT_VERIFIED | Trace requirements to product acceptance tests and approved business rules |
| P03 Knowledge Engineering | `.ai/` context, 10 domain standards, 4 UEQE standards, ADR registry, `CONFLICT-REPORT.md`, `ai-specs-check.sh`, OpenAPI drift audit | PARTIAL | Version/owner/status metadata and 90-day review-date enforcement added; source-path/branch/ADR checks added; API drift audit still records about 240 implemented but undocumented routes; full Markdown link validation, business-doc/code consistency sampling, historical ADR inventory, runtime Agent knowledge-load/retrieval evidence, and exact-head CI remain open |
| P04 System Architecture | docs/ai-specs/ARCHITECTURE-STANDARD.md, root Go modules, web/electron architecture | PRESENT / NOT_VERIFIED | Architecture inventory, module dependency graph, ADR and API/data-flow evidence |
| P05 Experience & Design | docs/design-system/UTER-DESIGN-SYSTEM-3.0.md, web/AGENTS.md, design-token scripts and frontend CI | PRESENT / NOT_VERIFIED | Token source/generator parity, component contract registry, visual and accessibility evidence |
| P06 Software Engineering | docs/ai-specs/DEVELOPMENT-STANDARD.md, root and nested Go modules, web/package.json, electron/ | PRESENT / NOT_VERIFIED | Four-module vet/build/test evidence and language-specific static analysis |
| P07 Cross-Platform Engineering | web/, electron/, docs-web/ | PARTIAL | Explicit supported-platform matrix and Electron/Web parity evidence; do not assume native mobile support |
| P08 Agent Engineering | AGENTS.md, CLAUDE.md, web/AGENTS.md, .agents/skills/aes-integration/ | PARTIAL | Role/skill registry, runtime discovery tests, permission and handoff evaluations |
| P09 Quality Engineering | docs/ai-specs/engineering-quality/, scripts/quality/uter-quality.sh, scripts/verify-all.sh, CI workflows | PRESENT / PARTIAL | UEQE review stage is now wired into CI; full engine stages and evidence still require validation |
| P10 Security & Reliability | docs/ai-specs/SECURITY-STANDARD.md, govulncheck, gitleaks, race tests, Electron secret persistence tests | PRESENT / NOT_VERIFIED | Confirm every module and critical business flow is covered; record residual vulnerabilities |
| P11 DevOps & Delivery | .github/workflows/ci.yml, Dockerfiles, Compose files, deploy/, release scripts | PARTIAL | Release promotion, rollback, artifact provenance, environment approval, and branch protection evidence |
| P12 Lifecycle & Evolution | docs/ai-specs/CHANGE-MANAGEMENT-STANDARD.md, migration scripts, versioning and release docs | PARTIAL | Technical-debt, deprecation, schema-evolution, postmortem, and retirement evidence |

## UTER P13 — project-specific extension (Layer B, Uter only)

| P13 domain | Uter current implementation (inventory) | Mapping status | Required next evidence |
|---|---|---|---|
| P13.1–P13.10 (10 business domains) | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md` §2 inventory: `controller/topup_*`, `service/billing*`, `model/quota_reserve.go`, `relay/`, `plugins/tasks/`, `web/src/features/wallet|pricing|models|channels/` | `IMPLEMENTED` (code located) / **NOT VERIFIED** | Approved business requirements + owners, domain invariants, state transitions, 10 payment exception scenarios, independent domain acceptance |
| Inheritance of P00–P12 | `.aes/uter-governance-registry.yaml` `aes_inheritance` | `IMPLEMENTED` / NOT VERIFIED | Per-domain Requirement→Implementation→Verification→Evidence mapping |
| Registration boundary | P13 absent from AES `standards/` and `.aes/registry/` (verified 0 hits) | `IMPLEMENTED` | `uter-governance-separation-check.rb` gate evidence |

**P13 conformance status: `NOT_ASSESSED`** (§16.2). Code presence is not business
rule approval and is not verification (§0.3 / §4.2).

## 2026-11-05 integration audit evidence

The following evidence supplements the phase inventory above. It does **not** promote any phase to VERIFIED.

| Area | Evidence collected | Remaining limitation |
|---|---|---|
| Uter CI baseline | Uter PR #15 commit `422caafffb7a64370700ddd4859a057911f5f9e0` passed all 8 CI jobs in [run 41970513914](https://github.com/hu-xulin/uter/actions/runs/41970513914), including the docs deprecation filter regression, backend, frontend, race, vulnerability, Electron secret-persistence, AES static wiring, and UEQE review jobs. | This is one pinned PR revision, not proof of every AES rule or runtime agent discovery. |
| Go module architecture | AES architecture source checks observed `MOD-GO-ROOT → MOD-RELAYKIT, MOD-TOKENKIT`; four Go module manifests are inventoried. | Does not prove every module's full semantic boundary or all package-level rules. |
| API contract | Owner-approved Option B consumer audit: `.aes/API-LEGACY-ENDPOINT-DEPRECATION-AUDIT-2026-11-05.md`. Removed only `POST /api/oauth/wechat/bind` and `GET /api/verify/status`; OpenAPI now contains 134 paths / 159 operations. AES Architecture Source Checks [run 41971060421](https://github.com/hu-xulin/aes/actions/runs/41971060421) PASS: 197 documented operations covered by 484 static Gin and built-in plugin routes. | Repository-local consumer survey found no runtime/frontend callers; external API usage telemetry is unavailable, so external-client absence is not asserted. |
| Database migrations | Inventory covers 20 custom migration steps and 2 manual SQL files. Selected migration tests passed on SQLite, MySQL 8.4.4, and PostgreSQL 17.4 against Uter source `422caafffb7a64370700ddd4859a057911f5f9e0` in [AES run 41971060428](https://github.com/hu-xulin/aes/actions/runs/41971060428). | Not full replay of all 20 steps, not ClickHouse log-database coverage, and not full rollback/recovery certification. Migration safety remains NOT_VERIFIED. |
| Frontend module graph | Revalidated against Uter commit `008ec53adc9652ee454090b4fb1152536dd45bf3` in [AES Architecture Source Checks run 41968779803](https://github.com/hu-xulin/aes/actions/runs/41968779803): 1,500 source files (1,217 production, 282 test, 1 generated), 2 generated route-tree imports excluded; 5,444 production runtime / 518 type-only / 16 dynamic imports; 698 test runtime / 104 type-only / 33 dynamic imports. The 21 lower-level-to-feature edges remain 18 runtime and 3 type-only; positive/negative fixtures passed. | Inventory is not an approved dependency policy. Symbol-level consumer inventory is not exhaustive; boundary migration remains in progress; no boundary gate is enforced. |
| AES governance | Re-verified 2026-11-08 against AES `main` `74e5d2eea215c96b845d7a0b2111b7fa011c540f` — the current pinned commit of the unified governance run, following release commit `6c78ab50dc2b1adfedc035c88a70a906564318e4` which published the 178 standards as ACTIVE: registry `1.12.1 / ACTIVE` under `AES-APPROVAL-2026-11-07-004`, blob `a806eef48e6242d82dcb1d39d5c094e0d7d981a1`, 178 standards formally published. Registry `1.12.1` is a normative correction release (registry signature record repaired, project authorisation baseline removed from AES-09-014 §3, three independent-verifier defects fixed) and carries the re-sealed digest `c49d3938fd9f` and a re-verified detached release signature. Uter's `.aes/aes-pin.json`, `INTEGRATION.md` and this matrix were refreshed to that commit on 2026-11-07 (earlier baseline `3bc8285` was `1.9.0 / APPROVED`; `0c9386b` carried none of the six declared artefacts). | Publication is an **upstream** lifecycle event, not Uter conformance: the 14 Uter domain gates remain 0/14 PASS, L4 global gate `BLOCKED`, 42 manual acceptances unsigned, Requirement→Evidence mapping incomplete, integration status `MIGRATION_PENDING`. The pin notes disclose a single-machine separation-of-duties exception for the release signature (non-independent authority environment) that the AES Authority has not yet adjudicated; the AES working tree also still has uncommitted changes. |

### Current integration gate scope

Uter's `scripts/quality/aes-integration-check.sh` is a static wiring and overlay-preservation gate. It checks lifecycle/pin declarations, P00–P12 traceability rows, critical Uter-owned payment/billing/auth/database/design-system rules, and agent-entrypoint/skill-adapter references. Positive and negative fixtures are maintained separately. Passing this gate does not prove WorkBuddy or Claude Code has discovered and loaded the canonical AES skill at runtime. The strengthened gate's latest CI result must be checked before treating this control as PASS.

## Duplicate and overlay disposition

### Keep in Uter

These are project-owned and must not be deleted by generic-standard migration:

- Payment, recharge, refund, balance, ledger, and reconciliation invariants.
- Token usage, model pricing, quota conversion, settlement, and relay behavior.
- Authentication, authorization, account/session, and API-key implementation details.
- Actual database compatibility, migrations, indexes, and cache behavior.
- Current repository architecture, module ownership, and runtime configuration.
- UTER Design System 3.0 and the actual React/Electron component implementation.
- Existing test fixtures, CI scripts, quality thresholds, and deployment constraints.

### Candidate for migration to AES

Only after semantic review and approval:

- Generic AI execution behavior and task lifecycle rules.
- Generic code review and testing requirements.
- Generic quality-gate state semantics and report schemas.
- Generic agent/skill/workflow contracts.
- Generic security and delivery governance.
- Generic documentation and change-management requirements.

### Removal gate

A Uter-local generic document may be deprecated only when all conditions are met:

1. A corresponding AES standard is APPROVED and immutably pinned.
2. A paragraph/rule-level semantic parity report exists.
3. Every Uter-specific exception is moved to a project overlay.
4. Uter agent entrypoints route to the approved AES source.
5. The target runtime demonstrably loads the rules and skills.
6. Uter CI enforces the mapped MUST/MUST_NOT requirements.
7. The old document is no longer referenced by scripts, workflows, links, or agents.
8. An independent review approves the deprecation.

## Status vocabulary

- PRESENT: a plausible source or implementation exists; not proof of enforcement.
- PARTIAL: incomplete mapping or incomplete enforcement.
- NOT_VERIFIED: evidence has not been collected.
- VERIFIED: all applicable criteria have reproducible evidence and independent approval.

No phase in this matrix is currently marked VERIFIED.


### Legacy API deprecation audit

Option B was explicitly selected by the API contract owner on 2026-11-05. The two stale OpenAPI paths were removed after repository-local consumer review. The full evidence and limitations are recorded in `.aes/API-LEGACY-ENDPOINT-DEPRECATION-AUDIT-2026-11-05.md`. This is an API contract cleanup only; it does not promote any AES phase or the Uter integration status to VERIFIED.


### Legacy API deprecation verification gate

The owner-approved Option B cleanup is implemented in the Uter integration branch. OpenAPI has 134 paths / 159 operations; both obsolete paths are absent. All 14 affected locale API-reference files were checked and contain neither legacy path. The docs synchronization filter has positive/negative regression tests wired into Uter CI. The detailed consumer audit is in `.aes/API-LEGACY-ENDPOINT-DEPRECATION-AUDIT-2026-11-05.md`. Exact-head CI and AES route parity remain pending; no phase is marked VERIFIED.


### Final Option B acceptance evidence

Uter CI run 41970513914 passed all 8 jobs at implementation source commit `422caafffb7a64370700ddd4859a057911f5f9e0`. AES Architecture Source Checks run 41971060421 and Database Migration Dialect Matrix run 41971060428 passed at AES PR #1 head `88b96136d48cad65056918cac72a1ac6017fe139`. The legacy API deprecation audit records the detailed scope and remaining external telemetry limitation.


### Midjourney refund transaction design

A source-grounded draft contract is maintained in `.aes/MIDJOURNEY-REFUND-TRANSACTION-DESIGN-2026-11-05.md` (Uter PR #18). It defines the required immutable billing snapshot, local-task refund idempotency, one-primary-DB transaction boundary, transaction-aware accounting helpers, LOG_DB outbox delivery, independent recovery, controller terminal-failure handling, legacy migration safeguards, and crash/concurrency/dialect verification matrix.

**Mapping status: DESIGN DRAFT / NOT IMPLEMENTED / NOT VERIFIED.** The contract deliberately leaves organization-funded Midjourney behavior, subscription funding support, partial-charge semantics, historical backfill, and retry/alert thresholds unresolved pending owner decisions. No billing behavior or production data was changed by the design PR.
### 2026-11-05 refund and task-billing implementation evidence

| Control area | Implementation evidence | Status / limitation |
|---|---|---|
| Midjourney refund transaction | PR #19/#20: `model/midjourney_refund_operation.go`, `model/midjourney_refund_outbox.go`, `model/midjourney_refund_transaction.go`; transaction-level wallet/Token/usage/task-state updates and durable reconciliation-required snapshots. | PARTIAL — exact-head CI and crash/concurrency/dialect acceptance pending. |
| Refund recovery | PR #19/#20: `FindPendingMidjourneyRefundTaskIDs`, `controller/midjourney_refund_recovery_task.go`, registered independent SystemTask handler. | PARTIAL — multi-instance lease and restart acceptance pending. |
| Refund log delivery | PR #19/#20: `model/midjourney_refund_log_outbox.go`; SQL LOG_DB receipt keyed by event key, SHA-256 payload identity, receipt+log transaction, retry/backoff/dead-letter. | PARTIAL — ClickHouse adapter is deliberately fail-closed and not implemented; SQL dialect matrix and operational replay tooling remain open. |
| Generic task-billing CAS | PR #17/#19/#20: retry-count increment is part of the same conditional UPDATE; reconciliation writes only from nonterminal states; zero-quota refunds re-read durable state. | PARTIAL — new regression tests are awaiting exact-head CI. |
| Refund result contract and polling liveness | PR #17/#19/#20: lost refund claims return success only when durable state is refunded; snapshot read errors fail closed; polling and local terminal cleanup continue without adapter registry. | PARTIAL — full restart/concurrency tests remain open. |
| Violation fee ordering | PR #17/#19/#20: `relay/request_billing.go` waits for the asynchronous refund via optional `relaycommon.RefundWaiter` before applying a violation fee. | PARTIAL — regression test and exact-head CI pending. |
| Malformed Midjourney action parsing | PR #17/#19/#20: `ConvertSimpleChangeParams` uses whitespace-safe tokenization and validates action length before indexing. | PARTIAL — malformed-input regression suite and exact-head CI pending. |

These changes remain in unmerged Draft PRs. Passing individual CI jobs does not make these controls VERIFIED. No production configuration, production database, or payment credentials were changed.


### Async task billing funding-ledger follow-up — 2026-11-05

Code-level remediation on the integration branch:

- `service/task_billing.go` now applies organization-funded task settlement/refunds through `AdjustOrgAndMemberUsedQuota`, keeping the shared organization ledger and member sub-quota usage in one transaction.
- Subscription-funded async task settlement now uses `PostConsumeUserSubscriptionDeltaCappedWithWallet`, so subscription overrun is capped and charged to the task owner's wallet atomically instead of being rejected or silently mis-accounted.
- `taskAdjustFunding` rejects nil task snapshots and returns immediately for zero deltas; unresolved organization snapshots remain fail-closed.
- `PostConsumeUserSubscriptionDeltaCappedWithWallet` now verifies that the subscription belongs to the supplied user before changing subscription usage or charging wallet overflow.

Regression coverage added in `service/task_billing_funding_test.go` includes organization debit/refund symmetry, member and organization underflow rollback, missing member rollback, missing organization snapshot, subscription overflow charging, no-overflow behavior, subscription refund/carryover, missing wallet rollback, foreign subscription ownership, zero-delta no-op, nil task, and invalid funding snapshots.

**Acceptance status: IMPLEMENTED / TESTS_AUTHORED / RUNTIME_NOT_VERIFIED.** These tests have been committed but have not yet been executed in this environment. Do not mark task-billing acceptance or any AES phase VERIFIED until the applicable test suites and independent review produce reproducible evidence.

- Personal-wallet task adjustments now request the persisted DB-first quota path, and the regression suite covers both debit and refund persistence.


### P01 governance remediation — 2026-11-05

- Added `.aes/agent-governance.yaml`: fail-closed default, 11 explicit Agent identities/roles, least-privilege profiles, task lifecycle, audit fields, single non-main branch limit, and explicit denials for PR merge, deployment, production database writes, production credentials, and real payment configuration.
- Extended `.ai/task-schema.json`: R0–R4, requester/Agent identity, scoped authorization, lifecycle history, execution audit, resume checkpoint, and one-work-branch maximum.
- Aligned `AGENTS.md`, `.ai/AIES.md`, and `CHANGE-MANAGEMENT-STANDARD.md` with the authorized Uter repair workflow: Commit/Push/PR on the one work branch only; no direct main push, force-push, merge, deployment, or production writes.
- Added `scripts/quality/test-ai-governance-policy.rb` and wired it into the AES CI job. CI also checks the live GitHub branch inventory and fails when more than one non-main branch exists.
- **Status: IMPLEMENTED / EXACT-HEAD-CI-PENDING / RUNTIME-UNVERIFIED.** Static policy tests do not prove that WorkBuddy/Claude external tool runtimes enforce the policy. GitHub main branch protection remains unconfigured/unverified because this integration connection does not expose an administrative write operation.

### P11 DevOps & Delivery — Compose image immutability remediation (2026-11-05)

- Production docker-compose.yml now pins Redis 7 and PostgreSQL 15 to verified multi-platform Docker Official Image index digests:
  - Redis: `redis:7-alpine@sha256:8da19c7399dca900c6822a1cf30f9d2285585e2c4b457ff4095b0f4500054d3f`
  - PostgreSQL: `postgres:15@sha256:c961aa287d8698297cb26cdfadfbe9fd2cbaf77e53cfffe9636e8d8a1e4d842c`
- Development docker-compose.dev.yml now pins Redis 7 and PostgreSQL 15 Alpine to verified multi-platform index digests:
  - Redis: same Redis 7 digest as production.
  - PostgreSQL: `postgres:15-alpine@sha256:54e0dd8e8cddcdbb9156c2486eed5a43eccb7214d7c6828097d41ce049fb3984`
- CI now validates both Compose files with `docker compose config --quiet` and rejects Redis/PostgreSQL image references without a complete 64-character SHA-256 digest. The digest matcher was exercised locally against all four service declarations; CI remains the authoritative environment-backed validation.
- Docker Hub official image evidence: [Redis 7-alpine manifest](https://hub.docker.com/layers/library/redis/7-alpine/images/sha256-1cf73a2f04808e55a8bd2f5706c2aa0ebb0f71938f93deb7af79f48311cd5cb9) and [PostgreSQL 15 manifest](https://hub.docker.com/layers/library/postgres/15.19/images/sha256-d6c2fe0850b06b13764b81df8b5e9978aadae92fbf5c751999959a59cb55fb93), [PostgreSQL 15 Alpine manifest](https://hub.docker.com/layers/library/postgres/15-alpine/images/sha256-84f43042200e6feb307f42deb4cba37512f04c6398cf03b9fa5ba7ad03ab01b4).
- **Status: IMPLEMENTED / LOCAL_PATTERN_CHECK_PASSED / EXACT_HEAD_CI_PENDING.** No database container was pulled or started in this session; no migration, backup, restore, production environment, or production data was touched.
- **Remaining P11 blockers:** GitHub main-branch protection and required-check administration; actual Docker Compose pull/start/healthcheck on supported architectures; database migration backup/restore and interrupted-migration recovery drills; release rollback rehearsal; artifact digest/SBOM/provenance verification against the source Commit; and a complete exact-head CI PASS.


## Current AES migration status (machine-maintained)

- Canonical enterprise source: `https://github.com/hu-xulin/aes`, branch `main`.
- Uter canonical integration directory: `.aes/`; legacy `.uaes/` is retired after content migration.
- Current Uter conformance: `NOT_ASSESSED` until all applicable AES requirements have executable Uter-side evidence.
- This traceability matrix is an inventory and mapping aid, not a conformance certificate.
