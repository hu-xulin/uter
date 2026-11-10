# §4 Domain Audit — UTER-P13 UTER Business Domain Engineering

**Generated:** 2026-11-07T01:25:08Z  
**Commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`  
**AES baseline:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618` (registry 1.9.0 / APPROVED)  
**Normative source status:** 0/178 AES standards are DRAFT  
**Requirements recorded:** 29 (none skipped)  
**Audit results:** {'BLOCKED': 29}

## 1. 规范审计 (Specification)

- Source: `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md` (Uter Layer B, NOT in AES)
- Every normative statement is keyed by source file + line in `evidence/02-compliance-matrix.json`.
- AES `.aes/APPROVAL-RECORD.md` §4 explicitly does NOT approve individual DRAFT entries; see FIND-FCA-001.

## 2. 实际实现审计 (Implementation)

- No per-requirement implementation mapping exists in the repository. Recorded as `NOT MAPPED` for every row.
- This is a genuine gap, not a hidden skip: the mapping is enumerable from the matrix.

## 3. 流程审计 (Process)

- Governing entry: `AGENTS.md`, `.aes/AI-GOVERNANCE-ENTRY.md`, `.aes/uter-governance-registry.yaml`.
- Historical `reports/compliance/FINAL-COMPLIANCE-REPORT.md` is SUPERSEDED (CONF-004); current evidence is this package.

## 4. 自动化控制审计 (Automated controls)

- Domain-linked REAL commands (indirect evidence only): `L2-08`, `L2-09`.
- Domain-linked manual acceptance cases: none.
- `evidence/matrix/<ID>.log` holds raw stdout/stderr/exit code.

## 5. 证据审计 (Evidence)

- Matrix aggregate at this commit: 28/29 PASS, overall `FAIL`.
- Manual-acceptance run integrity is separately verified by `python3 scripts/quality/aes-manual-acceptance.py --verify-only`.

## 6. 有效性验证 (Effectiveness)

- Domain-level commands are INDIRECT for individual normative statements; they do NOT prove any single requirement.
- Requirement-specific verified rows in this domain: **0/29**.

## 7. 不符合项 (Findings)

- FIND-FCA-001 (P0): AES normative baseline not individually approved; 13 domain gates NOT_RUN.
- FIND-FCA-002 (High): 29 rows in this domain are BLOCKED by DRAFT/PROPOSED source status.
- FIND-FCA-003 (High): 0 rows lack requirement-specific verification.
- Non-PASS local evidence (unchanged, not waived): .

## 8. 整改和复测 (Remediation & revalidation)

- Required authorisation: AES owner approval of DRAFT entries + execution of 13 L3 domain gates.
- Required engineering: per-requirement implementation mapping + requirement-specific verification with raw evidence.
- Revalidation result: **NOT REVALIDATED**. No row may be reported as PASS until the above exists.

## Requirement extract (first 25 rows; full set in JSON)

| Requirement ID | Source | Level | Result |
|---|---|---|---|
| `REQ-13-517e4e6958bc` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:16` | MUST NOT (中文) | BLOCKED |
| `REQ-13-5ffd4635fca4` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:29` | MUST NOT (中文) | BLOCKED |
| `REQ-13-692085725b3f` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:30` | MUST NOT (中文) | BLOCKED |
| `REQ-13-ceda936084ad` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:31` | MUST NOT (中文) | BLOCKED |
| `REQ-13-4c3accb92551` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:32` | MUST NOT (中文) | BLOCKED |
| `REQ-13-65fb06197407` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:63` | MUST NOT (中文) | BLOCKED |
| `REQ-13-d090c920353a` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:69` | MUST (中文) | BLOCKED |
| `REQ-13-1cc2b658fb69` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:84` | MUST NOT (中文) | BLOCKED |
| `REQ-13-ccb1593118c5` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:90` | MUST (中文) | BLOCKED |
| `REQ-13-14538e407185` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:110` | MUST NOT (中文) | BLOCKED |
| `REQ-13-c99f971c184a` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:112` | MUST (中文) | BLOCKED |
| `REQ-13-0429049d191f` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:114` | MUST (中文) | BLOCKED |
| `REQ-13-6785d1af2636` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:115` | MUST NOT (中文) | BLOCKED |
| `REQ-13-5448d6511052` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:116` | MUST (中文) | BLOCKED |
| `REQ-13-9d26334a4811` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:118` | MUST NOT (中文) | BLOCKED |
| `REQ-13-9d106830f6a3` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:119` | MUST NOT (中文) | BLOCKED |
| `REQ-13-9124fd45101e` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:120` | MUST (中文) | BLOCKED |
| `REQ-13-c48e941a5722` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:121` | MUST NOT (中文) | BLOCKED |
| `REQ-13-ad8d366bdea6` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:122` | MUST NOT (中文) | BLOCKED |
| `REQ-13-066afa86bd17` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:124` | MUST (中文) | BLOCKED |
| `REQ-13-6ff646b1e9c7` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:128` | MUST (中文) | BLOCKED |
| `REQ-13-2fdaa19a49ce` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:130` | MUST NOT (中文) | BLOCKED |
| `REQ-13-6906c9d15a8e` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:138` | MUST NOT (中文) | BLOCKED |
| `REQ-13-42156ab57993` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:139` | MUST NOT (中文) | BLOCKED |
| `REQ-13-18bf6a787e0f` | `.aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md:150` | MUST NOT (中文) | BLOCKED |
| … | 4 more rows in `evidence/02-compliance-matrix.json` | | |

---

Audit result vocabulary follows §12. `BLOCKED`/`NOT ASSESSED` are never PASS.
