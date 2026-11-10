# AES Integration Contract — Uter

**Normative authority:** AES, `https://github.com/hu-xulin/aes`, `main`.  
**Machine pin:** `.aes/aes-pin.json`.  
**Project registry:** `.aes/uter-governance-registry.yaml`.  
**Project extension:** `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`.  
**Current conformance:** `MIGRATION_PENDING` until every applicable AES and UTER-P13 requirement has current executable PASS evidence.

## Repository separation

- AES owns universal enterprise governance P00–P12.
- Uter owns implementation, product requirements, project-specific business constraints and UTER-P13.
- Uter MUST NOT copy or fork AES universal standards as a second normative source.
- Uter local overlays MUST map to AES requirements and MUST NOT weaken them.

## Autonomous execution and acceptance

All specification lifecycle decisions, registry validation, code review, test acceptance, remediation closure and release-readiness decisions MUST be produced by executable machine policy and independently rerun machine verifiers.

The execution policy is default-deny. Operations outside the authorized repository workspace are automatically denied. Ambiguous requirements, missing evidence, policy conflicts and failed checks automatically produce BLOCKED or FAIL; they never create an interactive approval queue and never become PASS by timeout or omission.

## Mandatory evidence

Every applicable requirement MUST map to:

`Requirement → Rule → Executable verifier → Actual execution → Evidence → Independent verification → Decision`.

PASS requires a real successful execution against the current repository revision. FAIL, BLOCKED, NOT_RUN, UNKNOWN, NOT_VERIFIED and missing evidence are not PASS. A content fingerprint proves which AES rules are in force; it does not prove Uter product conformance.

## Continuous checks

1. Recompute and verify the AES governed fingerprint and seal.
2. Resolve every applicable P00–P12 requirement and UTER-P13 project requirement.
3. Verify Agent bootstrap, runtime policy loading and permission-denial behavior.
4. Run backend, frontend, cross-platform, security, quality and business-invariant tests.
5. Independently re-read changed files and rerun all affected checks.
6. Derive conformance only from complete current evidence; never hand-edit a success state.

## Canonical Uter governance artifacts

- Agent execution policy: `.aes/agent-governance.yaml`.
- Requirement traceability: `.aes/TRACEABILITY.md`.
- Local overlay inventory: `.aes/AI-SPEC-DISPOSITION-REGISTRY.yaml`.
- Uter-specific business controls: `.aes/business/`, registered through P13.
- AES pin synchronization: `.aes/autonomous/config/downstream-policy.json`.

The former `.uaes/` tree is a migration source only. No active gate, policy or runtime entrypoint may read it after migration. Unique project business documents are maintained under `.aes/business/`; archived records are not active normative sources.

## P09 / P10 boundary

P09 Quality Engineering proves whether engineering quality meets the requirements. P10 Security & Reliability defines the security and reliability requirements. Security testing is required by P10 and executed and recorded by the P09 quality system.
