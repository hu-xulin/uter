# AES → Uter Requirement Traceability Matrix

**Normative source:** AES `https://github.com/hu-xulin/aes`, `main`.  
**Machine pin:** `.aes/aes-pin.json` (fingerprint and registry components are refreshed by `.aes/autonomous/engine/sync.mjs`).  
**Project registry:** `.aes/uter-governance-registry.yaml`.  
**Project extension:** `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`.  
**Last structural refresh:** 2026-11-10.

> This matrix is a machine-maintained traceability index, not a conformance assertion. A repository path, passing build, or registry pin does not prove an individual requirement. Only current requirement-level execution evidence can produce PASS.

## Repository ownership

- AES owns universal engineering requirements P00–P12.
- Uter owns project implementation and UTER-P13 business-domain requirements.
- Uter project overlays may add stricter requirements but cannot weaken AES.
- UTER-P13 is registered only in the Uter project registry.

## Domain mapping

| Domain | Uter normative/project sources | Executable verification surfaces | Current state |
|---|---|---|---|
| P00 Foundation | `AGENTS.md`, `CLAUDE.md`, `.aes/agent-governance.yaml`, `.aes/INTEGRATION.md`, `.aes/uter-governance-registry.yaml` | `scripts/quality/ai-native-internal-gate.rb`, `scripts/quality/aes-integration-check.mjs` | PARTIAL — governance structure checked; full requirement mapping not closed |
| P01 AI Governance | `.aes/agent-governance.yaml`, `.aes/AI-GOVERNANCE-ENTRY.md`, `.ai/task-schema.json`, agent skills | P01 policy fixtures, internal gate check 07, runtime agent tests | NOT_VERIFIED — runtime discovery and denial evidence must be current |
| P02 Product Engineering | `docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md` | product acceptance tests, API contract tests, frontend feature tests | NOT_VERIFIED |
| P03 Knowledge Engineering | `docs/ai-specs/DOCUMENTATION-STANDARD.md`, ADR and knowledge registries | `scripts/quality/ai-specs-check.sh`, link/reference and source-drift checks | NOT_VERIFIED |
| P04 System Architecture | `docs/ai-specs/ARCHITECTURE-STANDARD.md`, `docs/ai-specs/API-CONTRACT-STANDARD.md`, database standards | Go module dependency checks, OpenAPI/router parity, schema and migration tests | NOT_VERIFIED |
| P05 Experience & Design | `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md`, `docs/ai-specs/UX-INTERACTION-STANDARD.md` | design-token parity, Vitest, Playwright visual tests, axe accessibility tests | NOT_VERIFIED |
| P06 Software Engineering | `docs/ai-specs/DEVELOPMENT-STANDARD.md` | gofmt, go vet, Go build/test across modules, frontend typecheck/lint/build | NOT_VERIFIED |
| P07 Cross-Platform | Web, Electron and docs-web architecture overlays | platform build/test matrix and runtime compatibility tests | NOT_VERIFIED |
| P08 Agent Engineering | `AGENTS.md`, `CLAUDE.md`, `.agents/skills/`, WorkBuddy execution contract | runtime load tests, task-scope bypass tests, permission-denial tests | NOT_VERIFIED |
| P09 Quality Engineering | `docs/ai-specs/engineering-quality/`, `scripts/quality/uter-quality.sh` | code review, test, security, coverage, regression and quality-gate stages | NOT_VERIFIED |
| P10 Security & Reliability | `docs/ai-specs/SECURITY-STANDARD.md` | govulncheck, gitleaks, SAST, dependency checks, auth/payment security tests, recovery tests | NOT_VERIFIED |
| P11 DevOps & Delivery | CI workflows, Dockerfiles, release and rollback scripts | exact-HEAD CI, reproducible build, artifact integrity, rollback tests | NOT_VERIFIED |
| P12 Lifecycle & Evolution | `docs/ai-specs/CHANGE-MANAGEMENT-STANDARD.md`, migration and deprecation records | compatibility, migration, rollback, API deprecation and drift checks | NOT_VERIFIED |
| UTER-P13.1 Product & requirements | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`, `docs/ai-specs/PRODUCT-REQUIREMENTS-STANDARD.md` | requirement-to-feature and acceptance-test mapping | NOT_VERIFIED |
| UTER-P13.2 Identity & accounts | auth, user, organization, OAuth and access-token services | auth, tenancy, permission and session tests | NOT_VERIFIED |
| UTER-P13.3 Model & provider | model/channel/pricing services and overlays | model sync, provider contract and pricing tests | NOT_VERIFIED |
| UTER-P13.4 AI relay | `relay/`, relay controllers and protocol adapters | protocol, timeout, retry, streaming and failover tests | NOT_VERIFIED |
| UTER-P13.5 Usage & pricing | billing, usage, quota and pricing services | decimal, rounding, quota and billing invariants | NOT_VERIFIED |
| UTER-P13.6 Wallet & accounting | quota reserve, top-up, redemption and accounting models | idempotency, concurrency, ledger and reconciliation tests | NOT_VERIFIED |
| UTER-P13.7 Payments | WeChat, Alipay, Epay, Stripe and payment reconciliation code | callback replay, signature verification, order-state, amount-match and refund tests using simulated gateways | NOT_VERIFIED |
| UTER-P13.8 Tasks & scheduling | task plugins, refund outbox and recovery workers | duplicate delivery, retry, lease, recovery and multi-worker tests | NOT_VERIFIED |
| UTER-P13.9 Data consistency | migrations and persistence models | SQLite/MySQL/PostgreSQL/ClickHouse migration and recovery matrix | NOT_VERIFIED |
| UTER-P13.10 Observability | usage logs, audit events and metrics | redaction, audit integrity and metrics contract tests | NOT_VERIFIED |

## P09 / P10 division\n\nP09 proves whether engineering quality meets requirements. P10 defines the security and reliability requirements. Security testing is required by P10 and executed and recorded by the P09 quality system.\n\n## Requirement-level evidence contract

Each AES requirement and each UTER-P13 requirement must have a unique ID and the following machine record:

`requirement_id`, `source_path`, `source_line`, `source_digest`, `applicability`, `implementation_refs`, `verifier_id`, `command`, `execution_head`, `exit_code`, `evidence_digest`, `independent_verification`, `decision`.

Allowed decisions: `PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`, `NOT_VERIFIED`, `NOT_APPLICABLE`. Every `NOT_APPLICABLE` result requires a machine-verifiable applicability reason. No domain or repository-level PASS may be inferred from aggregate build success.

## Current acceptance boundary

The AES pin proves normative-source identity only. The Uter internal governance gate proves integration structure only. Neither proves full product conformance.

Uter remains `MIGRATION_PENDING` until:
1. all applicable AES P00–P12 requirements have complete requirement-level mappings;
2. all UTER-P13 business invariants have executable tests;
3. all required commands execute on the current Uter HEAD;
4. every applicable mandatory requirement has PASS evidence;
5. independent machine verification reproduces all results;
6. no P0/P1 findings remain open.

No interactive approval or review queue is part of this lifecycle. Missing or ambiguous source requirements are automatically marked `NOT_VERIFIED` or `BLOCKED`, never guessed into PASS.
