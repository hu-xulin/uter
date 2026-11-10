# Uter AI Governance Entry Point

**Purpose:** deterministic bootstrap for every coding and automation agent in this repository. This file contains no duplicate AES standard text.

## 1. Normative source

AES is the sole owner of universal engineering governance P00–P12. Uter owns its implementation, project overlays and UTER-P13 business extension.

| Field | Value |
|---|---|
| Repository | `https://github.com/hu-xulin/aes` |
| Branch | `main` |
| Machine pin | `.aes/aes-pin.json` |
| Project registry | `.aes/uter-governance-registry.yaml` |
| Project extension | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md` |
| Execution policy | `.aes/agent-governance.yaml` |
| Canonical engine | AES `governance/ai-native/engine/cli.mjs` |

AES registry ACTIVE means the normative baseline is published. It does not by itself mean Uter conforms.

## 2. Repository ownership

- AES repository: universal P00–P12 standards, schemas, registries, validators and governance engines.
- Uter repository: product implementation, Uter-specific standards, business invariants, P13 and project execution.
- Uter MUST NOT create a competing copy of AES universal standards.
- UTER-P13 MUST remain in this repository and MUST NOT be registered as an AES universal domain.

P09 Quality Engineering proves whether engineering quality meets requirements. P10 Security & Reliability defines the required security and reliability properties. Security tests are executed and recorded by the P09 quality system.

## 3. Mandatory agent load order

1. Root `AGENTS.md`; additionally load `web/AGENTS.md` for frontend work.
2. This entry point and `.aes/agent-governance.yaml`.
3. `.aes/uter-governance-registry.yaml`, `.aes/INTEGRATION.md` and `.aes/TRACEABILITY.md`.
4. Verify the AES pin and load the applicable P00–P12 standards from the pinned AES source.
5. Load `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md` and applicable `.aes/business/` overlays.
6. Inspect repository state and preserve all pre-existing changes.
7. Execute the task with least privilege and run all applicable gates.
8. Record machine evidence and derive the final status from actual verification.

## 4. Machine verification entry points

Run from the Uter repository:

```bash
AES_ROOT="${AES_ROOT:-../aes}"
node "$AES_ROOT/quality/scripts/aes/governed-fingerprint.mjs" --json --require-intact
node scripts/quality/aes-integration-check.mjs --aes-root "$AES_ROOT"
node .aes/autonomous/engine/sync.mjs --check
AES_ROOT="$AES_ROOT" ruby scripts/quality/ai-native-internal-gate.rb
ruby scripts/quality/uter-p09-p10-boundary-check.rb
bash scripts/quality/ai-specs-check.sh
bash scripts/verify-all.sh
```

The integration check verifies rule identity and registry structure. The internal gate verifies governance integration. Product conformance requires a separate requirement-level execution matrix covering all applicable AES requirements and all UTER-P13 business invariants.

## 5. State semantics

- `PASS`: real execution succeeded on the current revision and independent verification succeeded.
- `FAIL`: an executed check found a violation.
- `BLOCKED`: an operation is denied by policy or a required prerequisite is absent.
- `NOT_RUN`: no execution evidence exists.
- `UNKNOWN` / `NOT_VERIFIED`: evidence is insufficient or stale.

Only PASS satisfies a mandatory requirement. A missing result, stale result, successful build alone, file presence or registry pin cannot imply conformance.

## 6. Execution boundaries

Repository work is performed on local `main`, without creating branches, pushing, creating or merging pull requests, or deploying. Existing user changes and untracked files MUST be preserved. Production database writes, real payment operations, production credential access and irreversible external side effects are automatically denied. A denied action remains BLOCKED and does not enter an interactive approval queue.

## 7. AES inheritance

The pin is updated only from a live AES fingerprint with an intact machine seal. Pin synchronization MUST NOT promote Uter conformance. Integration status is computed only after all applicable requirement-level checks, P13 business invariants, runtime controls and CI gates have current PASS evidence.
