# Uter AI Governance Entry Point

**Purpose:** thin, deterministic pointer to the governance sources every AI Agent
must load before engineering work in this repository. This file contains **no
copy** of AES generic standard text.

**Governing universal specification:** AES `AES-SPEC-CORE` —
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
| Machine pin | `.aes/aes-pin.json` (current fingerprint, registry version and source provenance; never hard-code a commit or digest here) |
| Registry | AES `.aes/STANDARD-REGISTRY.yaml` (read from the pinned AES checkout) |
| Registry version / status | Derived from the live machine pin and AES registry at execution time |
| Machine authorization | `AES-AUTONOMOUS-GOVERNANCE-POLICY` + recomputable machine evidence; no human/third-party sign-off dependency |
| Integration status | `MIGRATION_PENDING` (AES domain gates remain `NOT_RUN`) |

Machine-readable pin: `.aes/aes-pin.json`.
Human contract: `.aes/INTEGRATION.md`.
Phase mapping: `.aes/TRACEABILITY.md`.
Canonical integration skill (in the AES repository): `skills/aes-uter-integration/SKILL.md`.

Registry `ACTIVE` is a normative baseline, **not** a Uter conformance
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

### 4.1 Keeping in step with AES — machine-pinned inheritance

AES is the sole owner of universal P00–P12 rules. Uter keeps a content-addressed pin and project-specific overlays. The pin is updated only after AES's own seal is verified; source commit SHA is provenance, while the governed fingerprint identifies the normative content.

Run from the Uter repository:

```bash
AES_ROOT="${AES_ROOT:-../aes}"
node "$AES_ROOT/quality/scripts/aes/governed-fingerprint.mjs" --json --require-intact
node scripts/quality/aes-integration-check.mjs --aes-root "$AES_ROOT"
node .aes/autonomous/engine/sync.mjs --check
```

A successful pin check proves only that Uter references the exact sealed AES rule set. It does not prove product conformance. Any fingerprint mismatch, invalid seal, missing requirement mapping, missing verifier, or stale evidence blocks integration and is repaired before the pin can be accepted.

Internal governance, standard lifecycle, code review, test acceptance, defect closure and release-readiness are decided by executable machine policy plus independent machine verification. No human approval, human signature, third-party review or third-party certification is an internal acceptance prerequisite. External legal/regulatory/contractual acts and real production/funds actions are not fabricated or auto-authorized: if machine-verifiable authority is absent, the action is automatically denied without blocking internal engineering verification.

`NOT_RUN`, `UNKNOWN`, `BLOCKED`, `NOT_VERIFIED` and missing evidence are never PASS. Historical records under `reports/compliance/legacy-uaes-archive/` are provenance only and MUST NOT be loaded as active policy or current acceptance evidence.
### 4.2 Executable gates

| Gate | Command |
|---|---|
| AES pin, seal, registry and requirement mapping | `node scripts/quality/aes-integration-check.mjs --aes-root "$AES_ROOT"` |
| AES pin negative/positive tests | `node --test scripts/quality/aes-integration-check.test.mjs` |
| AES downstream event sync | `node .aes/autonomous/engine/sync.mjs --check` |
| Uter internal machine acceptance (11 checks) | `AES_ROOT="$AES_ROOT" ruby scripts/quality/ai-native-internal-gate.rb` |
| P09/P10 responsibility boundary | `ruby scripts/quality/uter-p09-p10-boundary-check.rb` |
| Project AI-spec integrity | `bash scripts/quality/ai-specs-check.sh` |
| P01 permission policy fixtures | `ruby scripts/quality/test-ai-governance-policy.rb` |
| Independent AES machine review | `UTER_ROOT="$PWD" node "$AES_ROOT/governance/ai-native/engine/cli.mjs" review` |
| AES Agent execution self-check | `node "$AES_ROOT/governance/ai-native/engine/cli.mjs" self-check` |
| Full Uter engineering verification | `./scripts/verify-all.sh` |

A gate is complete only when its command actually executes and produces current evidence. A missing tool, missing report, skipped suite or unverified requirement is a failure/blocked state, never an implicit pass. The independent machine review is an internal technical control, not a third-party certification.
## 5. Status

`MIGRATION_PENDING` / conformance `NOT_ASSESSED`. This entry point does not claim
Uter is conformant with AES. Registry approval, the 13 AES domain gates,
UTER P13 independent domain acceptance, Requirement→Evidence mapping, live Agent
runtime discovery, CI enforcement and the independent assessment all require
separate reproducible evidence.
