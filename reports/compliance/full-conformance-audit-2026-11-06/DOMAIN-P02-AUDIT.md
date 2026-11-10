# §4 Domain Audit — P02 Product Engineering

**Generated:** 2026-11-07T01:25:08Z  
**Commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`  
**AES baseline:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618` (registry 1.9.0 / APPROVED)  
**Normative source status:** 0/178 AES standards are DRAFT  
**Requirements recorded:** 124 (none skipped)  
**Audit results:** {'NOT_ASSESSED': 124}

## 1. 规范审计 (Specification)

- Source: `AES standards/02-product-engineering` 
- Every normative statement is keyed by source file + line in `evidence/02-compliance-matrix.json`.
- AES `.aes/APPROVAL-RECORD.md` §4 explicitly does NOT approve individual DRAFT entries; see FIND-FCA-001.

## 2. 实际实现审计 (Implementation)

- No per-requirement implementation mapping exists in the repository. Recorded as `NOT MAPPED` for every row.
- This is a genuine gap, not a hidden skip: the mapping is enumerable from the matrix.

## 3. 流程审计 (Process)

- Governing entry: `AGENTS.md`, `.aes/AI-GOVERNANCE-ENTRY.md`, `.aes/uter-governance-registry.yaml`.
- Historical `reports/compliance/FINAL-COMPLIANCE-REPORT.md` is SUPERSEDED (CONF-004); current evidence is this package.

## 4. 自动化控制审计 (Automated controls)

- Domain-linked REAL commands (indirect evidence only): `L2-09`.
- Domain-linked manual acceptance cases: none.
- `evidence/matrix/<ID>.log` holds raw stdout/stderr/exit code.

## 5. 证据审计 (Evidence)

- Matrix aggregate at this commit: 28/29 PASS, overall `FAIL`.
- Manual-acceptance run integrity is separately verified by `python3 scripts/quality/aes-manual-acceptance.py --verify-only`.

## 6. 有效性验证 (Effectiveness)

- Domain-level commands are INDIRECT for individual normative statements; they do NOT prove any single requirement.
- Requirement-specific verified rows in this domain: **0/124**.

## 7. 不符合项 (Findings)

- FIND-FCA-001 (P0): AES normative baseline not individually approved; 13 domain gates NOT_RUN.
- FIND-FCA-002 (High): 0 rows in this domain are BLOCKED by DRAFT/PROPOSED source status.
- FIND-FCA-003 (High): 124 rows lack requirement-specific verification.
- Non-PASS local evidence (unchanged, not waived): .

## 8. 整改和复测 (Remediation & revalidation)

- Required authorisation: AES owner approval of DRAFT entries + execution of 13 L3 domain gates.
- Required engineering: per-requirement implementation mapping + requirement-specific verification with raw evidence.
- Revalidation result: **NOT REVALIDATED**. No row may be reported as PASS until the above exists.

## Requirement extract (first 25 rows; full set in JSON)

| Requirement ID | Source | Level | Result |
|---|---|---|---|
| `REQ-02-751c36579d46` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:8` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-68996b4f6618` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:74` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-26f5ccdef74b` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:76` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-5912858e5e44` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:94` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-a09414c7be19` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:107` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-bca9f9dca259` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:117` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-b804f487ab1d` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:143` | MUST | NOT_ASSESSED |
| `REQ-02-56994fd05332` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:144` | MUST | NOT_ASSESSED |
| `REQ-02-51e68f2ff1ca` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:145` | MUST | NOT_ASSESSED |
| `REQ-02-da254e4040c8` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:146` | MUST | NOT_ASSESSED |
| `REQ-02-a93abc2b36f8` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:147` | MUST | NOT_ASSESSED |
| `REQ-02-c9ce065c93a2` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:148` | MUST | NOT_ASSESSED |
| `REQ-02-8f317e7e8c23` | `standards/02-product-engineering/AES-02-001-REQUIREMENT-ENGINEERING.md:149` | MUST | NOT_ASSESSED |
| `REQ-02-82aa7dc80a4b` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:16` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-72f1db868707` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:34` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-74f085961cad` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:42` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-0dc9361ce588` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:54` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-02-6963e94fc927` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:73` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-cb74116c7653` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:94` | MUST | NOT_ASSESSED |
| `REQ-02-226c487180fb` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:95` | MUST | NOT_ASSESSED |
| `REQ-02-6c4152c849e7` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:96` | MUST | NOT_ASSESSED |
| `REQ-02-765a2b5144c0` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:97` | MUST | NOT_ASSESSED |
| `REQ-02-133f258c18a4` | `standards/02-product-engineering/AES-02-002-USER-STORY.md:98` | MUST | NOT_ASSESSED |
| `REQ-02-643d84764c15` | `standards/02-product-engineering/AES-02-003-BUSINESS-RULES.md:8` | MUST (中文) | NOT_ASSESSED |
| `REQ-02-9f263cbd806c` | `standards/02-product-engineering/AES-02-003-BUSINESS-RULES.md:10` | MUST (中文) | NOT_ASSESSED |
| … | 99 more rows in `evidence/02-compliance-matrix.json` | | |

---

Audit result vocabulary follows §12. `BLOCKED`/`NOT ASSESSED` are never PASS.
