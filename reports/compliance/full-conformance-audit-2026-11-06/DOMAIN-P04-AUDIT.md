# §4 Domain Audit — P04 System Architecture

**Generated:** 2026-11-07T01:25:08Z  
**Commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`  
**UAES baseline:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618` (registry 1.9.0 / APPROVED)  
**Normative source status:** 0/178 UAES standards are DRAFT  
**Requirements recorded:** 418 (none skipped)  
**Audit results:** {'NOT_ASSESSED': 406, 'NOT_APPLICABLE': 12}

## 1. 规范审计 (Specification)

- Source: `UAES standards/04-system-architecture` 
- Every normative statement is keyed by source file + line in `evidence/02-compliance-matrix.json`.
- UAES `.uaes/APPROVAL-RECORD.md` §4 explicitly does NOT approve individual DRAFT entries; see FIND-FCA-001.

## 2. 实际实现审计 (Implementation)

- No per-requirement implementation mapping exists in the repository. Recorded as `NOT MAPPED` for every row.
- This is a genuine gap, not a hidden skip: the mapping is enumerable from the matrix.

## 3. 流程审计 (Process)

- Governing entry: `AGENTS.md`, `.uaes/AI-GOVERNANCE-ENTRY.md`, `.uaes/uter-governance-registry.yaml`.
- Historical `reports/compliance/FINAL-COMPLIANCE-REPORT.md` is SUPERSEDED (CONF-004); current evidence is this package.

## 4. 自动化控制审计 (Automated controls)

- Domain-linked REAL commands (indirect evidence only): `L2-01`, `L2-05`, `L2-07`.
- Domain-linked manual acceptance cases: none.
- `evidence/matrix/<ID>.log` holds raw stdout/stderr/exit code.

## 5. 证据审计 (Evidence)

- Matrix aggregate at this commit: 28/29 PASS, overall `FAIL`.
- Manual-acceptance run integrity is separately verified by `python3 scripts/quality/uaes-manual-acceptance.py --verify-only`.

## 6. 有效性验证 (Effectiveness)

- Domain-level commands are INDIRECT for individual normative statements; they do NOT prove any single requirement.
- Requirement-specific verified rows in this domain: **0/418**.

## 7. 不符合项 (Findings)

- FIND-FCA-001 (P0): UAES normative baseline not individually approved; 13 domain gates NOT_RUN.
- FIND-FCA-002 (High): 0 rows in this domain are BLOCKED by DRAFT/PROPOSED source status.
- FIND-FCA-003 (High): 406 rows lack requirement-specific verification.
- Non-PASS local evidence (unchanged, not waived): .

## 8. 整改和复测 (Remediation & revalidation)

- Required authorisation: UAES owner approval of DRAFT entries + execution of 13 L3 domain gates.
- Required engineering: per-requirement implementation mapping + requirement-specific verification with raw evidence.
- Revalidation result: **NOT REVALIDATED**. No row may be reported as PASS until the above exists.

## Requirement extract (first 25 rows; full set in JSON)

| Requirement ID | Source | Level | Result |
|---|---|---|---|
| `REQ-04-4f6927a77f06` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:15` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-6db119546f5c` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:17` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-04-18a8df183d99` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:23` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-464e3f05d575` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:33` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-cbc95333bdf2` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:45` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-04-354fdb3dbe3d` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:49` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-aba67fa114eb` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:51` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-04-703260b38d7a` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:55` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-dbb8217b5759` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:57` | SHOULD NOT (中文) | NOT_ASSESSED |
| `REQ-04-3a89b29a22ab` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:61` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-da1ecec329e0` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:65` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-cd49f68c27ce` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:69` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-11dad3cf5f52` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:78` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-04-1bdf85b0d62c` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:86` | MUST | NOT_ASSESSED |
| `REQ-04-427ea77126e1` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:87` | MUST | NOT_ASSESSED |
| `REQ-04-f510981087f6` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:88` | MUST | NOT_ASSESSED |
| `REQ-04-5da1e7882ea0` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:111` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-356dba26c71d` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:112` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-04-63b9e1fd39a8` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:113` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-8603755a5b26` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:114` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-92b6a8649c0c` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:115` | MUST (中文) | NOT_ASSESSED |
| `REQ-04-6e21dd00c518` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:116` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-04-6c23582c7c09` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:167` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-04-27426022fae1` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:168` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-04-7a1355d96e4a` | `standards/04-system-architecture/UAES-04-001-ARCHITECTURE-PRINCIPLES.md:169` | MUST NOT (中文) | NOT_ASSESSED |
| … | 393 more rows in `evidence/02-compliance-matrix.json` | | |

---

Audit result vocabulary follows §12. `BLOCKED`/`NOT ASSESSED` are never PASS.
