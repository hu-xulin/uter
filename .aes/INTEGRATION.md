# AES Integration Contract — Uter

**Normative authority:** [AES](https://github.com/hu-xulin/aes), main branch.  
**Machine pin:** `.aes/aes-pin.json`.  
**Project registry:** `.aes/uter-governance-registry.yaml`.  
**Project extension:** `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`.  
**Status:** MIGRATION_PENDING until the live AES fingerprint, Uter requirement mapping, runtime enforcement and all applicable product gates are machine-verified.

## Repository separation

- AES owns universal enterprise governance P00–P12.
- Uter owns implementation, product requirements, project-specific business constraints and UTER-P13.
- Uter MUST NOT copy or fork AES universal standards as a second normative source.
- Uter local overlays MAY retain product-specific facts and enforcement details, but MUST map to AES requirements and MUST NOT weaken them.

## Autonomous internal acceptance

All internal specification review, registry validation, code review, test acceptance, remediation closure and release-readiness decisions MUST be performed by executable machine checks and independent machine verification. Human approval and third-party signatures are not internal acceptance prerequisites.

The engine MUST preserve the distinction between internal machine verification and external legal/regulatory acts. No external signature, certificate or production authorization may be fabricated. An external action that lacks machine-verifiable authority is automatically denied; this does not block internal engineering acceptance.

## Mandatory evidence

Each applicable AES requirement MUST map to:
Requirement → Rule → Executable verifier → Actual execution → Evidence → Decision.

PASS requires a real successful execution and current evidence. FAIL, BLOCKED, NOT_RUN, UNKNOWN and NOT_VERIFIED are not PASS. A content fingerprint or a registry pin proves which rules are in force; it does not prove Uter product conformance.

## Required continuous checks

1. Verify AES pin and recompute the governed fingerprint using the AES-owned verifier.
2. Resolve all applicable P00–P12 requirements and UTER-P13 project requirements.
3. Verify Agent bootstrap and policy enforcement for WorkBuddy, Claude Code and Codex.
4. Run product tests, security tests, quality gates and business invariants.
5. Independently re-read changed files and rerun all affected checks.
6. Compute Uter conformance status from evidence; never hand-edit a success status.


## Canonical Uter governance artifacts

- Agent permission policy: `.aes/agent-governance.yaml`.
- Requirement traceability inventory: `.aes/TRACEABILITY.md`.
- Legacy AI-spec disposition inventory: `.aes/AI-SPEC-DISPOSITION-REGISTRY.yaml` (historical inventory; machine reassessment required before deleting any local spec).
- Uter-specific business controls: `.aes/business/`, registered through P13.
- Downstream version-event synchronization policy: `.aes/autonomous/config/downstream-policy.json`.

The former `.uaes/` tree is a migration source only. No active gate, policy or runtime entrypoint may read it after migration. Its unique business documents have been moved to `.aes/business/`; historical machine records are retained as immutable archive evidence before the old directory is removed.
