# Uter AI Governance Entry Point

**Purpose:** thin, deterministic pointer to the governance sources every AI Agent
must load before engineering work in this repository. This file contains **no
copy** of UAES generic standard text.

**Governing specification:** `UTER-UAES-GOV-001` —
`docs/ai-specs/UTER-UAES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md`.
Where earlier execution orders conflict, this specification governs.

## 0. Three-layer, two-repository architecture (§1.1 / §1.3)

| Layer | Repository | Responsibility |
|---|---|---|
| A — UAES universal | `uaes` | P00–P12 only. MUST NOT contain Uter business rules or UTER P13. |
| B — Uter project | `uter` | Governance entrypoints, UAES inheritance config, **UTER P13**. |
| C — Execution & assurance | both | WorkBuddy executes; CI/CD, tests and independent assessment verify. |

The two repositories are governed separately: UTER P13 and Uter business rules
stay in `uter`; UAES universal standards stay in `uaes`. Neither may absorb the
other's content. Enforced by `scripts/quality/uter-governance-separation-check.rb`.

**P09 proves / P10 defines (§1.3 / §8 / §9 / §10 / §16.3)**: P09 Quality Engineering proves whether
engineering quality meets requirements; P10 Security & Reliability defines the
security and reliability requirements the system must meet. Security testing is
required by P10, executed and recorded by the P09 test system.
Enforced by `scripts/quality/uter-p09-p10-boundary-check.rb`.

## 1. Normative source (UAES — generic engineering governance)

| Field | Value |
|---|---|
| Repository | `hu-xulin/uaes` (https://github.com/hu-xulin/uaes) |
| Branch | `main` |
| Pinned commit | `586f6227d1248e57173ac785e1b8537cb880362f` |
| Registry | `.uaes/STANDARD-REGISTRY.yaml` |
| Registry blob SHA | `72fbcbea78b54290b00fb9b989ea67d6a6faaccc` |
| Registry version / status | `1.12.2` / `ACTIVE` |
| Approval record | `UAES-APPROVAL-2026-11-07-004` + `586f622` (historical approval basis for the 1.12.1 baseline: governed content unchanged from `74e5d2e`, registry blob `a806eef4`, 178/178 ACTIVE. The current 1.12.2 pin is an index correction and carries no new approval; release-signature separation-of-duties caveat recorded in `INTEGRATION.md` §1) |
| Integration status | `MIGRATION_PENDING` (UAES domain gates remain `NOT_RUN`) |

Machine-readable pin: `.uaes/uaes-pin.json`.
Human contract: `.uaes/INTEGRATION.md`.
Phase mapping: `.uaes/TRACEABILITY.md`.
Canonical integration skill (in the UAES repository): `skills/uaes-uter-integration/SKILL.md`.

Registry `ACTIVE` is a normative baseline, **not** a Uter conformance
certificate (§0.3 / §16.5).

## 2. Uter project layer (Layer B)

- **`.uaes/uter-governance-registry.yaml`** — machine-readable inheritance config,
  three-layer architecture, P09/P10 ownership and UTER P13 registration.
- **`.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`** — UTER P13, the
  project-specific business domain extension (10 domains, inherits P00–P12).
  Registered **only** in the Uter project governance registry.
- Root `AGENTS.md` and `web/AGENTS.md` — project constitution and frontend scope.
- `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` — design tokens and UI rules.
- `docs/ai-specs/` — project engineering standards (keep/migrate/deprecate
  disposition recorded in TRACEABILITY.md).
- `.ai/AIES.md`, `.ai/README.md`, `.ai/task-schema.json`, `.ai/checklists/` — execution methodology.
- `.agents/rules/billing.md`, `.agents/skills/` — project-specific rules and canonical skills.
- `.uaes/agent-governance.yaml` — P01 permission profile.
- `scripts/quality/`, `scripts/verify-all.sh`, `.github/workflows/` — executable gates.

## 3. Agent load order (§6.4 / §18)

1. `AGENTS.md` (repo root), then `web/AGENTS.md` when touching `web/`.
2. This entry point, then `.uaes/uter-governance-registry.yaml`.
3. `.uaes/INTEGRATION.md` and `.uaes/TRACEABILITY.md`.
4. The pinned UAES registry and applicable P00–P12 domain standards.
5. **`.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`** and the applicable Uter
   business overlays in §2 (§18 step 7).
6. Confirm permissions, inspect the working tree and record the baseline (§6.3 / §6.6).
7. Execute the task, then run the applicable gates in §4.
8. Record evidence and requirement/finding status (§14 / §13).

A file existing in the repository does **not** prove that the runtime Agent
loaded or followed it (§6.4). Runtime evidence must come from an actual task.

## 4. Verification entry points

### 4.1 Keeping in step with UAES — one direction

UAES is the only place a rule is maintained. Do **not** hand-edit Uter's pin or the prose contracts when a UAES standard changes: run the propagation command in the UAES repository and it updates exactly the fields UAES owns.

| Step | Command (run in the UAES repository) |
|---|---|
| Is Uter behind? | `node quality/scripts/uaes/uaes.mjs propagate --check` — `NOOP` when in sync, `DRIFTED` with the affected standards and a remediation checklist when not |
| Bring Uter up to date | `node quality/scripts/uaes/uaes.mjs propagate --execute` |
| Which standards apply to these files? | `node quality/scripts/uaes/uaes.mjs standards --files <paths>` |
| Full chain, from both sides | `bash quality/scripts/uaes/e2e-propagation.sh` |

`propagate` exits `0` when in sync, `1` when drift was reported, `2` when it refused to write. It refuses when the UAES seal does not verify — that means a covered standard, schema, gate or requirement file was edited without re-sealing, and copying that downstream would launder a tampered tree into this repository.

Two things propagation will **never** do, by design:

1. **It never touches Uter's own declarations.** `integration_status`, `approval_state`, `approval_record` and the Uter verdicts are this repository's to state. A tool that could flip them would be a way to fabricate compliance evidence.
2. **It never marks anything VERIFIED.** A propagated pin means Uter now *knows* the new rules. It does not mean Uter complies. The 14 domain gates, the 42 manual acceptances and the Requirement→Evidence mapping remain this repository's responsibility.

`source_commit` in the pin is provenance only. It records which UAES tree the fingerprint was taken from. UAES HEAD moves on every governance report and verifier fix, and no gate may fail on that difference alone — the governed fingerprint is what decides whether the rules changed.

### 4.2 Gates

| Gate | Command |
|---|---|
| UAES pin integrity | `bash scripts/quality/uaes-pin-check.sh` |
| UAES wiring / overlays | `bash scripts/quality/uaes-integration-check.sh` |
| Repository separation (UAES vs Uter) | `ruby scripts/quality/uter-governance-separation-check.rb` |
| P09 / P10 boundary | `ruby scripts/quality/uter-p09-p10-boundary-check.rb` |
| Spec integrity | `bash scripts/quality/ai-specs-check.sh` |
| P01 policy contract | `ruby scripts/quality/test-ai-governance-policy.rb` |
| WorkBuddy runtime | `ruby scripts/quality/uaes-agent-runtime-check.rb preflight` / `selftest` / `workspace` / `verify` |
| Independent assessment | `ruby scripts/quality/uter-independent-assessment.rb` |
| Unified quality gate | `./scripts/verify-all.sh` |

## 5. Status

`MIGRATION_PENDING` / conformance `NOT_ASSESSED`. This entry point does not claim
Uter is conformant with UAES. Registry approval, the 13 UAES domain gates,
UTER P13 independent domain acceptance, Requirement→Evidence mapping, live Agent
runtime discovery, CI enforcement and the independent assessment all require
separate reproducible evidence.
