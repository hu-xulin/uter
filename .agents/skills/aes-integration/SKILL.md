---
name: aes-integration
description: Audit, enforce and maintain Uter's machine-verified inheritance from the central AES governance repository. Use for standards, architecture, agent governance, quality gates, security, release readiness and conformance work.
---

# Uter AES Integration Skill

## Authority and boundaries

- AES at https://github.com/hu-xulin/aes is the sole universal governance authority for P00–P12.
- Uter owns product implementation, project-specific policies and UTER P13 only.
- The current machine pin is `.aes/aes-pin.json`; the project registry is `.aes/uter-governance-registry.yaml`.
- Never create a second universal registry or copy AES generic standards into Uter.
- `reports/compliance/legacy-uaes-archive/` is immutable historical provenance. Never load it as active policy or acceptance evidence.

## Mandatory load sequence

1. Read root `AGENTS.md` and, for frontend work, `web/AGENTS.md`.
2. Read `.aes/AI-GOVERNANCE-ENTRY.md`, `.aes/INTEGRATION.md`, `.aes/TRACEABILITY.md`, `.aes/aes-pin.json` and `.aes/uter-governance-registry.yaml`.
3. Read the Uter project extension `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md` and the applicable project-specific overlay.
4. Resolve the pinned AES checkout from `AES_ROOT` or the sibling `../aes`; read its active registry, machine policy and all applicable P00–P12 standards.
5. Verify the AES seal and governed fingerprint before relying on any inherited rule.

## Required executable verification

Run from the Uter repository:

```bash
AES_ROOT="${AES_ROOT:-../aes}"
node "$AES_ROOT/quality/scripts/aes/governed-fingerprint.mjs" --json --require-intact
node scripts/quality/aes-integration-check.mjs --aes-root "$AES_ROOT"
node --test scripts/quality/aes-integration-check.test.mjs
node .aes/autonomous/engine/sync.mjs --check
AES_ROOT="$AES_ROOT" ruby scripts/quality/ai-native-internal-gate.rb
ruby scripts/quality/uter-p09-p10-boundary-check.rb
bash scripts/quality/ai-specs-check.sh
```

For independent AES machine review:

```bash
UTER_ROOT="$PWD" node "$AES_ROOT/governance/ai-native/engine/cli.mjs" review
node "$AES_ROOT/governance/ai-native/engine/cli.mjs" self-check
```

## Autonomous internal acceptance

- Internal standards review, policy evaluation, engineering review, tests, defect closure, remediation verification and release-readiness are machine-executed.
- No human approval, owner signature, third-party review or third-party certification is an internal acceptance prerequisite.
- A separate machine verifier must independently recompute the decision from current source bytes and execution evidence; the executor cannot approve its own output.
- `PASS` requires a real execution, current evidence, valid hashes and successful independent verification.
- `NOT_RUN`, `UNKNOWN`, `BLOCKED`, `NOT_VERIFIED`, missing evidence and stale evidence are never PASS.
- Do not fabricate ISO/SOC/regulatory certifications, human signatures, third-party attestations or external authority.
- If an external legal, regulatory, contractual, production or real-funds action lacks explicit machine-verifiable authority, automatically deny that external action. Continue unrelated internal engineering work.

## Change and cleanup rules

- Fix the root cause; do not delete assertions, reduce coverage, hide failures or rewrite historical evidence to obtain PASS.
- Retain unique Uter business rules in P13 and the project overlays. Remove duplicate generic standards only after the machine dependency scan proves they are not required.
- Keep historical records immutable and out of active policy paths.
- Use the existing `main` branch for this governance migration. Do not create branches or PRs. Remote writes require explicit user authorization.
- Never force-push, merge, deploy, modify production data or alter live payment configuration as part of an internal governance task.
