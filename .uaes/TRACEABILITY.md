# UAES → Uter Standard Traceability Matrix

**Audit date:** 2026-11-05  
**UAES source:** hu-xulin/uaes  
**UAES lifecycle:** DRAFT  
**Uter integration:** MIGRATION_PENDING  
**This matrix is an inventory, not a compliance certificate.** A path being present does not prove a rule is implemented or enforced.

## Phase mapping

| UAES phase | Uter current source / implementation | Mapping status | Required next evidence |
|---|---|---|---|
| P00 Foundation | AGENTS.md, CLAUDE.md, .ai/AIES.md, docs/ai-specs/, scripts/quality/ai-specs-check.sh | PARTIAL | Reconcile precedence and migrate generic rules after UAES approval |
| P01 AI Governance | Root agent instructions, task routing, branch strategy, auto-fix permission boundaries, .agents/rules/ | PARTIAL | Machine-readable permission mapping and runtime negative tests |
| P02 Product Engineering | docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md | PRESENT / NOT_VERIFIED | Trace requirements to product acceptance tests and approved business rules |
| P03 Knowledge Engineering | .ai/ project context and task artifacts; project documentation | PARTIAL | Verified knowledge registry, provenance, freshness, and conflict workflow |
| P04 System Architecture | docs/ai-specs/ARCHITECTURE-STANDARD.md, root Go modules, web/electron architecture | PRESENT / NOT_VERIFIED | Architecture inventory, module dependency graph, ADR and API/data-flow evidence |
| P05 Experience & Design | docs/design-system/UTER-DESIGN-SYSTEM-3.0.md, web/AGENTS.md, design-token scripts and frontend CI | PRESENT / NOT_VERIFIED | Token source/generator parity, component contract registry, visual and accessibility evidence |
| P06 Software Engineering | docs/ai-specs/DEVELOPMENT-STANDARD.md, root and nested Go modules, web/package.json, electron/ | PRESENT / NOT_VERIFIED | Four-module vet/build/test evidence and language-specific static analysis |
| P07 Cross-Platform Engineering | web/, electron/, docs-web/ | PARTIAL | Explicit supported-platform matrix and Electron/Web parity evidence; do not assume native mobile support |
| P08 Agent Engineering | AGENTS.md, CLAUDE.md, web/AGENTS.md, .agents/skills/uaes-integration/ | PARTIAL | Role/skill registry, runtime discovery tests, permission and handoff evaluations |
| P09 Quality Engineering | docs/ai-specs/engineering-quality/, scripts/quality/uter-quality.sh, scripts/verify-all.sh, CI workflows | PRESENT / PARTIAL | UEQE review stage is now wired into CI; full engine stages and evidence still require validation |
| P10 Security & Reliability | docs/ai-specs/SECURITY-STANDARD.md, govulncheck, gitleaks, race tests, Electron secret persistence tests | PRESENT / NOT_VERIFIED | Confirm every module and critical business flow is covered; record residual vulnerabilities |
| P11 DevOps & Delivery | .github/workflows/ci.yml, Dockerfiles, Compose files, deploy/, release scripts | PARTIAL | Release promotion, rollback, artifact provenance, environment approval, and branch protection evidence |
| P12 Lifecycle & Evolution | docs/ai-specs/CHANGE-MANAGEMENT-STANDARD.md, migration scripts, versioning and release docs | PARTIAL | Technical-debt, deprecation, schema-evolution, postmortem, and retirement evidence |

## 2026-11-05 integration audit evidence

The following evidence supplements the phase inventory above. It does **not** promote any phase to VERIFIED.

| Area | Evidence collected | Remaining limitation |
|---|---|---|
| Uter CI baseline | Uter PR #15 commit `442ddb5a7c234f2ee2d78651e0882407e9371c91` passed CI run [41897312764](https://github.com/hu-xulin/uter/actions/runs/41897312764), including backend, frontend, race, vulnerability, Electron secret-persistence, UAES static wiring, and UEQE review jobs. | This is one pinned PR revision, not proof of every UAES rule or runtime agent discovery. |
| Go module architecture | UAES architecture source checks observed `MOD-GO-ROOT → MOD-RELAYKIT, MOD-TOKENKIT`; four Go module manifests are inventoried. | Does not prove every module's full semantic boundary or all package-level rules. |
| API contract | Both OpenAPI documents passed structural and compatibility checks: 161 management operations / 8 schemas and 38 relay operations / 52 schemas. | Runtime route comparison found two documented management operations without matching Gin/plugin routes: `POST /api/oauth/wechat/bind`, `GET /api/verify/status`. Contract-owner decision remains required. |
| Database migrations | Inventory covers 20 custom migration steps and 2 manual SQL files. Selected migration tests passed on SQLite, MySQL 8.4.4, and PostgreSQL 17.4 in [UAES run 41908683578](https://github.com/hu-xulin/uaes/actions/runs/41908683578). | Not full replay of all 20 steps, not ClickHouse log-database coverage, and not full rollback/recovery certification. Migration safety remains NOT_VERIFIED. |
| Frontend module graph | 1,500 source files scanned; production/test imports are separated, generated route-tree imports excluded, and 21 lower-level-to-feature import edges identified for review. | Inventory is not an approved dependency policy. Semantic import-kind classification and boundary migration remain in progress; no boundary gate is enforced. |
| UAES governance | UAES governance validation passed on the current DRAFT PR branch in [run 41908670106](https://github.com/hu-xulin/uaes/actions/runs/41908670106). | UAES PR #1 is not merged or approved; its registry remains DRAFT and is not an immutable release. |

### Current integration gate scope

Uter's `scripts/quality/uaes-integration-check.sh` is a static wiring and overlay-preservation gate. It checks lifecycle/pin declarations, P00–P12 traceability rows, critical Uter-owned payment/billing/auth/database/design-system rules, and agent-entrypoint/skill-adapter references. Positive and negative fixtures are maintained separately. Passing this gate does not prove WorkBuddy or Claude Code has discovered and loaded the canonical UAES skill at runtime. The strengthened gate's latest CI result must be checked before treating this control as PASS.

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

### Candidate for migration to UAES

Only after semantic review and approval:

- Generic AI execution behavior and task lifecycle rules.
- Generic code review and testing requirements.
- Generic quality-gate state semantics and report schemas.
- Generic agent/skill/workflow contracts.
- Generic security and delivery governance.
- Generic documentation and change-management requirements.

### Removal gate

A Uter-local generic document may be deprecated only when all conditions are met:

1. A corresponding UAES standard is APPROVED and immutably pinned.
2. A paragraph/rule-level semantic parity report exists.
3. Every Uter-specific exception is moved to a project overlay.
4. Uter agent entrypoints route to the approved UAES source.
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
