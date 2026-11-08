# §4 Domain Audit — P01 AI Governance

**Generated:** 2026-11-07T01:25:08Z  
**Commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`  
**UAES baseline:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618` (registry 1.9.0 / APPROVED)  
**Normative source status:** 0/178 UAES standards are DRAFT  
**Requirements recorded:** 105 (none skipped)  
**Audit results:** {'NOT_ASSESSED': 105}

## 1. 规范审计 (Specification)

- Source: `UAES standards/01-ai-governance` 
- Every normative statement is keyed by source file + line in `evidence/02-compliance-matrix.json`.
- UAES `.uaes/APPROVAL-RECORD.md` §4 explicitly does NOT approve individual DRAFT entries; see FIND-FCA-001.

## 2. 实际实现审计 (Implementation)

- No per-requirement implementation mapping exists in the repository. Recorded as `NOT MAPPED` for every row.
- This is a genuine gap, not a hidden skip: the mapping is enumerable from the matrix.

## 3. 流程审计 (Process)

- Governing entry: `AGENTS.md`, `.uaes/AI-GOVERNANCE-ENTRY.md`, `.uaes/uter-governance-registry.yaml`.
- Historical `reports/compliance/FINAL-COMPLIANCE-REPORT.md` is SUPERSEDED (CONF-004); current evidence is this package.

## 4. 自动化控制审计 (Automated controls)

- Domain-linked REAL commands (indirect evidence only): `L1-02`, `L1-03`, `L1-16`, `L1-17`.
- Domain-linked manual acceptance cases: none.
- `evidence/matrix/<ID>.log` holds raw stdout/stderr/exit code.

## 5. 证据审计 (Evidence)

- Matrix aggregate at this commit: 28/29 PASS, overall `FAIL`.
- Manual-acceptance run integrity is separately verified by `python3 scripts/quality/uaes-manual-acceptance.py --verify-only`.

## 6. 有效性验证 (Effectiveness)

- Domain-level commands are INDIRECT for individual normative statements; they do NOT prove any single requirement.
- Requirement-specific verified rows in this domain: **0/105**.

## 7. 不符合项 (Findings)

- FIND-FCA-001 (P0): UAES normative baseline not individually approved; 13 domain gates NOT_RUN.
- FIND-FCA-002 (High): 0 rows in this domain are BLOCKED by DRAFT/PROPOSED source status.
- FIND-FCA-003 (High): 105 rows lack requirement-specific verification.
- Non-PASS local evidence (unchanged, not waived): .

## 8. 整改和复测 (Remediation & revalidation)

- Required authorisation: UAES owner approval of DRAFT entries + execution of 13 L3 domain gates.
- Required engineering: per-requirement implementation mapping + requirement-specific verification with raw evidence.
- Revalidation result: **NOT REVALIDATED**. No row may be reported as PASS until the above exists.

## Requirement extract (first 25 rows; full set in JSON)

| Requirement ID | Source | Level | Result |
|---|---|---|---|
| `REQ-01-198a3f7f418b` | `standards/01-ai-governance/UAES-01-001-AI-GOVERNANCE-ROLES.md:35` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-a1ed55fc0abe` | `standards/01-ai-governance/UAES-01-001-AI-GOVERNANCE-ROLES.md:36` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-01-ef2db949422a` | `standards/01-ai-governance/UAES-01-001-AI-GOVERNANCE-ROLES.md:49` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-7b35b7e6c68e` | `standards/01-ai-governance/UAES-01-001-AI-GOVERNANCE-ROLES.md:53` | SHOULD | NOT_ASSESSED |
| `REQ-01-43b3cf595665` | `standards/01-ai-governance/UAES-01-001-AI-GOVERNANCE-ROLES.md:54` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-01-e99f24919f08` | `standards/01-ai-governance/UAES-01-001-AI-GOVERNANCE-ROLES.md:58` | MUST NOT | NOT_ASSESSED |
| `REQ-01-8e5b3a553224` | `standards/01-ai-governance/UAES-01-001-AI-GOVERNANCE-ROLES.md:62` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-1bf79b022579` | `standards/01-ai-governance/UAES-01-001-AI-GOVERNANCE-ROLES.md:80` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-10b03b875e69` | `standards/01-ai-governance/UAES-01-001-AI-GOVERNANCE-ROLES.md:96` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-01-0cc24b5e0341` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:18` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-8e10ca5e4baf` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:60` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-2f6859b5f925` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:64` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-01-3710a7a0d149` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:83` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-01-158df2d0c7bc` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:89` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-c7fc467ee0a2` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:93` | MUST NOT | NOT_ASSESSED |
| `REQ-01-b2252a0cb730` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:97` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-e97e4cd87e78` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:98` | MUST NOT | NOT_ASSESSED |
| `REQ-01-07fbc60657c7` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:102` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-dc4bd834eb18` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:106` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-01-6ac42d59eef5` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:110` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-08459fab05ed` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:114` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-01-5c497677bc4c` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:118` | MUST (中文) | NOT_ASSESSED |
| `REQ-01-1965c6f648c9` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:128` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-01-b56aa0698fb0` | `standards/01-ai-governance/UAES-01-002-AGENT-AUTHORITY-AND-PERMISSIONS.md:134` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-01-e99424b24b14` | `standards/01-ai-governance/UAES-01-003-HUMAN-APPROVAL-AND-ESCALATION.md:22` | MUST (中文) | NOT_ASSESSED |
| … | 80 more rows in `evidence/02-compliance-matrix.json` | | |

---

Audit result vocabulary follows §12. `BLOCKED`/`NOT ASSESSED` are never PASS.
