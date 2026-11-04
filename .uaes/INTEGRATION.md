# UAES Integration Contract — Uter

**Status:** MIGRATION_PENDING  
**UAES lifecycle:** DRAFT (not an approved replacement for current Uter rules)  
**Owner:** Uter Engineering Governance

## 1. Source identity

| Field | Value |
|---|---|
| UAES repository | https://github.com/hu-xulin/uaes |
| UAES default branch at audit baseline | `main` |
| UAES source commit | `84416f7f55c1166e3f5adfa0575c1ea713ff20d2` |
| Registry path | `.uaes/STANDARD-REGISTRY.yaml` |
| Registry blob SHA at audit baseline | `1c74e918b84b8cc18d2806a936721852b823ca75` |
| Registry version | `1.7.0` |
| Registry status | `DRAFT` |
| Integration status | `MIGRATION_PENDING` |

The commit and blob SHA above identify the inspected audit baseline. They are not a release approval and must be updated only through a reviewed integration change.

## 2. Authority during migration

Until UAES is approved, version-pinned for release, and verified against Uter:

1. User authorization and safety boundaries remain highest priority.
2. Uter root `AGENTS.md` and nested project instructions remain the active project constitution.
3. Uter project-specific security, billing, payment, database, architecture, and design-system constraints remain mandatory.
4. UAES standards are the target governance model and must be used for gap analysis; a DRAFT UAES document does not silently override an existing Uter rule.
5. Where the two systems conflict, mark the task BLOCKED for governance adjudication. Do not choose the more permissive rule.

## 3. Target authority after migration

After the required approval and verification gates pass:

- UAES owns generic engineering governance, normative standards, shared agent/skill contracts, and cross-project quality policy.
- Uter owns project context, actual architecture facts, product/business invariants, technology-specific configuration, design-system implementation, and executable project gates.
- Uter's agent entrypoints become thin adapters that point to the pinned UAES release and the Uter project overlays.
- Generic duplicated local standards may be deprecated only after a semantic parity report and approved migration record exist.

## 4. Project overlays that must remain

At minimum, preserve and map:

- Uter payment, recharge, refund, balance, and financial invariants.
- Token usage, pricing, quota conversion, settlement, and billing safety rules.
- Authentication, authorization, session, OAuth/OIDC, WebAuthn, and account-security details.
- SQLite/MySQL/PostgreSQL compatibility and ClickHouse log-database constraints.
- Go modules, React/TypeScript, Electron, build tooling, and actual repository architecture.
- UTER Design System 3.0 and its project-specific tokens, components, and strict design gates.
- Existing CI workflows, test fixtures, coverage baselines, and operational scripts.

## 5. Existing quality engine reuse

Uter already contains `scripts/quality/uter-quality.sh`, `scripts/verify-all.sh`, and GitHub Actions workflows. UAES P09/P10/P11 integration must govern and validate these existing mechanisms rather than introduce a competing quality runner.

## 6. Completion criteria

Do not change this status to VERIFIED until:

- A released/approved UAES version and immutable commit are pinned.
- All applicable UAES requirements have a Uter traceability mapping.
- Agent entrypoints and runtime skill discovery are proven with the actual coding agents.
- Local generic rules have a documented keep/migrate/deprecate disposition.
- Project overlays are preserved and linked to their owning standards.
- Required Uter quality gates execute locally and in CI with recorded evidence.
- An independent compliance audit passes.

## 7. Audit limitations

This integration record is based on remote GitHub file inspection. Remote source inspection does not execute Uter's Go, Bun, security, visual, or end-to-end test suites. Those results must be produced by a real checkout and CI run.
