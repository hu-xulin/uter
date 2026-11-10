# §4 Domain Audit — P10 Security & Reliability

**Generated:** 2026-11-07T01:25:08Z  
**Commit SHA:** `ec6501adceb008d46140a7e5ab6508eb78006731`  
**AES baseline:** `0c9386b192090e901ccc5de6df1f2aebe3f5c618` (registry 1.9.0 / APPROVED)  
**Normative source status:** 0/178 AES standards are DRAFT  
**Requirements recorded:** 209 (none skipped)  
**Audit results:** {'NOT_ASSESSED': 209}

## 1. 规范审计 (Specification)

- Source: `AES standards/10-security-reliability` 
- Every normative statement is keyed by source file + line in `evidence/02-compliance-matrix.json`.
- AES `.aes/APPROVAL-RECORD.md` §4 explicitly does NOT approve individual DRAFT entries; see FIND-FCA-001.

## 2. 实际实现审计 (Implementation)

- No per-requirement implementation mapping exists in the repository. Recorded as `NOT MAPPED` for every row.
- This is a genuine gap, not a hidden skip: the mapping is enumerable from the matrix.

## 3. 流程审计 (Process)

- Governing entry: `AGENTS.md`, `.aes/AI-GOVERNANCE-ENTRY.md`, `.aes/uter-governance-registry.yaml`.
- Historical `reports/compliance/FINAL-COMPLIANCE-REPORT.md` is SUPERSEDED (CONF-004); current evidence is this package.

## 4. 自动化控制审计 (Automated controls)

- Domain-linked REAL commands (indirect evidence only): `L1-16`, `L2-01`, `L2-08`.
- Domain-linked manual acceptance cases: `MA-02`, `MA-03`, `MA-04`, `MA-05`, `MA-06`.
- `evidence/matrix/<ID>.log` holds raw stdout/stderr/exit code.

## 5. 证据审计 (Evidence)

- Matrix aggregate at this commit: 28/29 PASS, overall `FAIL`.
- Manual-acceptance run integrity is separately verified by `python3 scripts/quality/aes-manual-acceptance.py --verify-only`.

## 6. 有效性验证 (Effectiveness)

- Domain-level commands are INDIRECT for individual normative statements; they do NOT prove any single requirement.
- Requirement-specific verified rows in this domain: **0/209**.

## 7. 不符合项 (Findings)

- FIND-FCA-001 (P0): AES normative baseline not individually approved; 13 domain gates NOT_RUN.
- FIND-FCA-002 (High): 0 rows in this domain are BLOCKED by DRAFT/PROPOSED source status.
- FIND-FCA-003 (High): 209 rows lack requirement-specific verification.
- Non-PASS local evidence (unchanged, not waived): .

## 8. 整改和复测 (Remediation & revalidation)

- Required authorisation: AES owner approval of DRAFT entries + execution of 13 L3 domain gates.
- Required engineering: per-requirement implementation mapping + requirement-specific verification with raw evidence.
- Revalidation result: **NOT REVALIDATED**. No row may be reported as PASS until the above exists.

## Requirement extract (first 25 rows; full set in JSON)

| Requirement ID | Source | Level | Result |
|---|---|---|---|
| `REQ-10-7e26f1c45b1b` | `standards/10-security-reliability/AES-10-001-SECURITY-GOVERNANCE-AND-SECURE-SDLC.md:17` | MUST | NOT_ASSESSED |
| `REQ-10-e4daa4456755` | `standards/10-security-reliability/AES-10-001-SECURITY-GOVERNANCE-AND-SECURE-SDLC.md:34` | MUST (中文) | NOT_ASSESSED |
| `REQ-10-9191b115e537` | `standards/10-security-reliability/AES-10-001-SECURITY-GOVERNANCE-AND-SECURE-SDLC.md:50` | MUST | NOT_ASSESSED |
| `REQ-10-1faab41ac4fa` | `standards/10-security-reliability/AES-10-001-SECURITY-GOVERNANCE-AND-SECURE-SDLC.md:64` | MUST | NOT_ASSESSED |
| `REQ-10-576f7a3327e0` | `standards/10-security-reliability/AES-10-001-SECURITY-GOVERNANCE-AND-SECURE-SDLC.md:65` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-10-4fed80e28846` | `standards/10-security-reliability/AES-10-001-SECURITY-GOVERNANCE-AND-SECURE-SDLC.md:66` | MUST NOT | NOT_ASSESSED |
| `REQ-10-bb19aa0684ac` | `standards/10-security-reliability/AES-10-001-SECURITY-GOVERNANCE-AND-SECURE-SDLC.md:67` | MUST (中文) | NOT_ASSESSED |
| `REQ-10-ddd9ef2c0575` | `standards/10-security-reliability/AES-10-002-THREAT-MODELING-AND-SECURITY-REQUIREMENTS.md:15` | MUST | NOT_ASSESSED |
| `REQ-10-0dc8e5562b41` | `standards/10-security-reliability/AES-10-002-THREAT-MODELING-AND-SECURITY-REQUIREMENTS.md:62` | MUST | NOT_ASSESSED |
| `REQ-10-bf3e9fb0712e` | `standards/10-security-reliability/AES-10-002-THREAT-MODELING-AND-SECURITY-REQUIREMENTS.md:72` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-10-7593a2db0cea` | `standards/10-security-reliability/AES-10-002-THREAT-MODELING-AND-SECURITY-REQUIREMENTS.md:76` | MUST | NOT_ASSESSED |
| `REQ-10-0c54b461379f` | `standards/10-security-reliability/AES-10-002-THREAT-MODELING-AND-SECURITY-REQUIREMENTS.md:80` | MUST (中文) | NOT_ASSESSED |
| `REQ-10-14beef32ae37` | `standards/10-security-reliability/AES-10-003-IDENTITY-AUTHENTICATION-AND-AUTHORIZATION.md:15` | MUST (中文) | NOT_ASSESSED |
| `REQ-10-0160ac6c7d75` | `standards/10-security-reliability/AES-10-003-IDENTITY-AUTHENTICATION-AND-AUTHORIZATION.md:16` | MUST | NOT_ASSESSED |
| `REQ-10-44cf8188db18` | `standards/10-security-reliability/AES-10-003-IDENTITY-AUTHENTICATION-AND-AUTHORIZATION.md:17` | MUST NOT (中文) | NOT_ASSESSED |
| `REQ-10-93eaadf60e01` | `standards/10-security-reliability/AES-10-003-IDENTITY-AUTHENTICATION-AND-AUTHORIZATION.md:18` | MUST | NOT_ASSESSED |
| `REQ-10-14b817c788ba` | `standards/10-security-reliability/AES-10-003-IDENTITY-AUTHENTICATION-AND-AUTHORIZATION.md:23` | MUST | NOT_ASSESSED |
| `REQ-10-3a9cf6d8fdcf` | `standards/10-security-reliability/AES-10-003-IDENTITY-AUTHENTICATION-AND-AUTHORIZATION.md:45` | MUST | NOT_ASSESSED |
| `REQ-10-e804fb4500b1` | `standards/10-security-reliability/AES-10-003-IDENTITY-AUTHENTICATION-AND-AUTHORIZATION.md:58` | MUST | NOT_ASSESSED |
| `REQ-10-cfaf5d7f8255` | `standards/10-security-reliability/AES-10-004-SESSION-TOKEN-AND-SECRET-MANAGEMENT.md:15` | MUST | NOT_ASSESSED |
| `REQ-10-70b9f5196fe8` | `standards/10-security-reliability/AES-10-004-SESSION-TOKEN-AND-SECRET-MANAGEMENT.md:16` | MUST | NOT_ASSESSED |
| `REQ-10-bfb1a843b4b0` | `standards/10-security-reliability/AES-10-004-SESSION-TOKEN-AND-SECRET-MANAGEMENT.md:17` | MUST | NOT_ASSESSED |
| `REQ-10-5842fd665df3` | `standards/10-security-reliability/AES-10-004-SESSION-TOKEN-AND-SECRET-MANAGEMENT.md:18` | SHOULD | NOT_ASSESSED |
| `REQ-10-cc73a3a7aa19` | `standards/10-security-reliability/AES-10-004-SESSION-TOKEN-AND-SECRET-MANAGEMENT.md:19` | MUST | NOT_ASSESSED |
| `REQ-10-0a05d33c8ba9` | `standards/10-security-reliability/AES-10-004-SESSION-TOKEN-AND-SECRET-MANAGEMENT.md:20` | MUST NOT (中文) | NOT_ASSESSED |
| … | 184 more rows in `evidence/02-compliance-matrix.json` | | |

---

Audit result vocabulary follows §12. `BLOCKED`/`NOT ASSESSED` are never PASS.
