# §4 Domain Audit — P06 Software Engineering

**Generated:** 2026-11-07T01:25:08Z  
**Commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`  
**UAES baseline:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618` (registry 1.9.0 / APPROVED)  
**Normative source status:** 0/178 UAES standards are DRAFT  
**Requirements recorded:** 297 (none skipped)  
**Audit results:** {'NOT_ASSESSED': 297}

## 1. 规范审计 (Specification)

- Source: `UAES standards/06-software-engineering` 
- Every normative statement is keyed by source file + line in `evidence/02-compliance-matrix.json`.
- UAES `.uaes/APPROVAL-RECORD.md` §4 explicitly does NOT approve individual DRAFT entries; see FIND-FCA-001.

## 2. 实际实现审计 (Implementation)

- No per-requirement implementation mapping exists in the repository. Recorded as `NOT MAPPED` for every row.
- This is a genuine gap, not a hidden skip: the mapping is enumerable from the matrix.

## 3. 流程审计 (Process)

- Governing entry: `AGENTS.md`, `.uaes/AI-GOVERNANCE-ENTRY.md`, `.uaes/uter-governance-registry.yaml`.
- Historical `reports/compliance/FINAL-COMPLIANCE-REPORT.md` is SUPERSEDED (CONF-004); current evidence is this package.

## 4. 自动化控制审计 (Automated controls)

- Domain-linked REAL commands (indirect evidence only): `L1-08`, `L1-09`, `L1-10`, `L1-13`, `L2-01`, `L2-06`, `L2-07`.
- Domain-linked manual acceptance cases: none.
- `evidence/matrix/<ID>.log` holds raw stdout/stderr/exit code.

## 5. 证据审计 (Evidence)

- Matrix aggregate at this commit: 28/29 PASS, overall `FAIL`.
- Manual-acceptance run integrity is separately verified by `python3 scripts/quality/uaes-manual-acceptance.py --verify-only`.

## 6. 有效性验证 (Effectiveness)

- Domain-level commands are INDIRECT for individual normative statements; they do NOT prove any single requirement.
- Requirement-specific verified rows in this domain: **0/297**.

## 7. 不符合项 (Findings)

- FIND-FCA-001 (P0): UAES normative baseline not individually approved; 13 domain gates NOT_RUN.
- FIND-FCA-002 (High): 0 rows in this domain are BLOCKED by DRAFT/PROPOSED source status.
- FIND-FCA-003 (High): 297 rows lack requirement-specific verification.
- Non-PASS local evidence (unchanged, not waived): .

## 8. 整改和复测 (Remediation & revalidation)

- Required authorisation: UAES owner approval of DRAFT entries + execution of 13 L3 domain gates.
- Required engineering: per-requirement implementation mapping + requirement-specific verification with raw evidence.
- Revalidation result: **NOT REVALIDATED**. No row may be reported as PASS until the above exists.

## Requirement extract (first 25 rows; full set in JSON)

| Requirement ID | Source | Level | Result |
|---|---|---|---|
| `REQ-06-932ed04dbddf` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:35` | MUST | NOT_ASSESSED |
| `REQ-06-bd3c26f2c22b` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:36` | MUST | NOT_ASSESSED |
| `REQ-06-c9506a5cfc3d` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:37` | MUST | NOT_ASSESSED |
| `REQ-06-fcdfd04954f1` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:38` | MUST | NOT_ASSESSED |
| `REQ-06-12897527b316` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:39` | MUST | NOT_ASSESSED |
| `REQ-06-ae1dcabd472e` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:40` | MUST | NOT_ASSESSED |
| `REQ-06-5385a88a1238` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:41` | MUST | NOT_ASSESSED |
| `REQ-06-ed1fce5d932a` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:42` | MUST | NOT_ASSESSED |
| `REQ-06-21a6a4131895` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:43` | MUST | NOT_ASSESSED |
| `REQ-06-3fa9e29faa9b` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:44` | MUST | NOT_ASSESSED |
| `REQ-06-bde4f812eeb9` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:58` | MUST (中文) | NOT_ASSESSED |
| `REQ-06-edf66f9a7337` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:62` | MUST NOT | NOT_ASSESSED |
| `REQ-06-657cc5e723da` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:63` | MUST NOT | NOT_ASSESSED |
| `REQ-06-2838c41a11cb` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:64` | MUST NOT | NOT_ASSESSED |
| `REQ-06-2fab8f0b0fa4` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:65` | MUST NOT | NOT_ASSESSED |
| `REQ-06-f831a2447673` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:69` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-06-787652d5217b` | `standards/06-software-engineering/UAES-06-001-CODING-PRINCIPLES.md:81` | MUST (中文) | NOT_ASSESSED |
| `REQ-06-768dc2b55847` | `standards/06-software-engineering/UAES-06-002-REPOSITORY-AND-MODULE-STRUCTURE.md:36` | MUST | NOT_ASSESSED |
| `REQ-06-8188c45f0d15` | `standards/06-software-engineering/UAES-06-002-REPOSITORY-AND-MODULE-STRUCTURE.md:37` | MUST | NOT_ASSESSED |
| `REQ-06-d6a3244e8e6e` | `standards/06-software-engineering/UAES-06-002-REPOSITORY-AND-MODULE-STRUCTURE.md:38` | MUST | NOT_ASSESSED |
| `REQ-06-886d93bb3eb4` | `standards/06-software-engineering/UAES-06-002-REPOSITORY-AND-MODULE-STRUCTURE.md:39` | MUST | NOT_ASSESSED |
| `REQ-06-bc2217f5c09a` | `standards/06-software-engineering/UAES-06-002-REPOSITORY-AND-MODULE-STRUCTURE.md:40` | MUST | NOT_ASSESSED |
| `REQ-06-212de5bc2956` | `standards/06-software-engineering/UAES-06-002-REPOSITORY-AND-MODULE-STRUCTURE.md:41` | MUST | NOT_ASSESSED |
| `REQ-06-62939de5c795` | `standards/06-software-engineering/UAES-06-002-REPOSITORY-AND-MODULE-STRUCTURE.md:42` | MUST | NOT_ASSESSED |
| `REQ-06-7aabad881682` | `standards/06-software-engineering/UAES-06-002-REPOSITORY-AND-MODULE-STRUCTURE.md:43` | MUST | NOT_ASSESSED |
| … | 272 more rows in `evidence/02-compliance-matrix.json` | | |

---

Audit result vocabulary follows §12. `BLOCKED`/`NOT ASSESSED` are never PASS.
