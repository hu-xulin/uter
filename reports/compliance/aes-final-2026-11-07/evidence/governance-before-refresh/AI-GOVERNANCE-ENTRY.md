# Uter AI Governance Entry Point

**Purpose:** thin, deterministic pointer to the governance sources every AI Agent
must load before engineering work in this repository. This file contains **no
copy** of AES generic standard text.

**Governing specification:** `UTER-AES-GOV-001` —
`docs/ai-specs/UTER-AES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md`.
Where earlier execution orders conflict, this specification governs.

## 0. Three-layer, two-repository architecture (§1.1 / §1.3)

| Layer | Repository | Responsibility |
|---|---|---|
| A — AES universal | `aes` | P00–P12 only. MUST NOT contain Uter business rules or UTER P13. |
| B — Uter project | `uter` | Governance entrypoints, AES inheritance config, **UTER P13**. |
| C — Execution & assurance | both | WorkBuddy executes; CI/CD, tests and independent assessment verify. |

The two repositories are governed separately: UTER P13 and Uter business rules
stay in `uter`; AES universal standards stay in `aes`. Neither may absorb the
other's content. Enforced by `scripts/quality/uter-governance-separation-check.rb`.

**P09 proves / P10 defines (§1.3 / §8 / §9 / §10 / §16.3)**: P09 Quality Engineering proves whether
engineering quality meets requirements; P10 Security & Reliability defines the
security and reliability requirements the system must meet. Security testing is
required by P10, executed and recorded by the P09 test system.
Enforced by `scripts/quality/uter-p09-p10-boundary-check.rb`.

## 1. Normative source (AES — generic engineering governance)

| Field | Value |
|---|---|
| Repository | `hu-xulin/aes` (https://github.com/hu-xulin/aes) |
| Branch | `main` |
| Pinned commit | `3bc8285861b9c9c7ede63e6d9d08b508f1bd74b8` |
| Registry | `.aes/STANDARD-REGISTRY.yaml` |
| Registry blob SHA | `e5c9777843b606ca62f5287d2263056dfbfbf845` |
| Registry version / status | `1.9.0` / `APPROVED` |
| Approval record | `AES-APPROVAL-2026-11-06-001` + `3bc8285` (178/178 APPROVED; 0 PUBLISHED) |
| Integration status | `MIGRATION_PENDING` (AES domain gates remain `NOT_RUN`) |

Machine-readable pin: `.aes/aes-pin.json`.
Human contract: `.aes/INTEGRATION.md`.
Phase mapping: `.aes/TRACEABILITY.md`.
Canonical integration skill (in the AES repository): `skills/aes-uter-integration/SKILL.md`.

Registry `APPROVED` is a normative baseline, **not** a Uter conformance
certificate (§0.3 / §16.5).

## 2. Uter project layer (Layer B)

- **`.aes/uter-governance-registry.yaml`** — machine-readable inheritance config,
  three-layer architecture, P09/P10 ownership and UTER P13 registration.
- **`.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`** — UTER P13, the
  project-specific business domain extension (10 domains, inherits P00–P12).
  Registered **only** in the Uter project governance registry.
- Root `AGENTS.md` and `web/AGENTS.md` — project constitution and frontend scope.
- `docs/design-system/UTER-DESIGN-SYSTEM-3.0.md` — design tokens and UI rules.
- `docs/ai-specs/` — project engineering standards (keep/migrate/deprecate
  disposition recorded in TRACEABILITY.md).
- `.ai/AIES.md`, `.ai/README.md`, `.ai/task-schema.json`, `.ai/checklists/` — execution methodology.
- `.agents/rules/billing.md`, `.agents/skills/` — project-specific rules and canonical skills.
- `.aes/agent-governance.yaml` — P01 permission profile.
- `scripts/quality/`, `scripts/verify-all.sh`, `.github/workflows/` — executable gates.

## 3. Agent load order (§6.4 / §18)

1. `AGENTS.md` (repo root), then `web/AGENTS.md` when touching `web/`.
2. This entry point, then `.aes/uter-governance-registry.yaml`.
3. `.aes/INTEGRATION.md` and `.aes/TRACEABILITY.md`.
4. The pinned AES registry and applicable P00–P12 domain standards.
5. **`.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`** and the applicable Uter
   business overlays in §2 (§18 step 7).
6. Confirm permissions, inspect the working tree and record the baseline (§6.3 / §6.6).
7. Execute the task, then run the applicable gates in §4.
8. Record evidence and requirement/finding status (§14 / §13).

A file existing in the repository does **not** prove that the runtime Agent
loaded or followed it (§6.4). Runtime evidence must come from an actual task.

## 4. Verification entry points

| Gate | Command |
|---|---|
| AES pin integrity | `bash scripts/quality/aes-pin-check.sh` |
| AES wiring / overlays | `bash scripts/quality/aes-integration-check.sh` |
| Repository separation (AES vs Uter) | `ruby scripts/quality/uter-governance-separation-check.rb` |
| P09 / P10 boundary | `ruby scripts/quality/uter-p09-p10-boundary-check.rb` |
| Spec integrity | `bash scripts/quality/ai-specs-check.sh` |
| P01 policy contract | `ruby scripts/quality/test-ai-governance-policy.rb` |
| WorkBuddy runtime | `ruby scripts/quality/aes-agent-runtime-check.rb preflight` / `selftest` / `workspace` / `verify` |
| Independent assessment | `ruby scripts/quality/uter-independent-assessment.rb` |
| Unified quality gate | `./scripts/verify-all.sh` |

## 5. Status

`MIGRATION_PENDING` / conformance `NOT_ASSESSED`. This entry point does not claim
Uter is conformant with AES. Registry approval, the 13 AES domain gates,
UTER P13 independent domain acceptance, Requirement→Evidence mapping, live Agent
runtime discovery, CI enforcement and the independent assessment all require
separate reproducible evidence.
