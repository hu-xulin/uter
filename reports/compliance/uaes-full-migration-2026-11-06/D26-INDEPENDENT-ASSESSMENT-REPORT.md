# D26 — Independent Assessment Report

- Evidence ID: `D26-INDEPENDENT-ASSESSMENT`
- Generated: 2026-11-08T08:09:07Z
- Collector: WorkBuddy independent assessment pass (re-derived from source, not from remediation self-declarations)
- Uter HEAD: `2a1059d608b2b2bd5f298a6dea74645d5e35bb73`
- UAES HEAD: `68e9710c0516a13475cfc9379d9725d584ce06db`

## Assessment scope (§16.4)

- System boundary: Uter repository (Layer B) + pinned UAES 1.9.0 baseline (Layer A, read-only) + WorkBuddy/CI assurance (Layer C)
- Standards baseline: UTER-UAES-GOV-001 + UAES 1.9.0 APPROVED + §2.1 external standards catalogue
- Domains independently assessed: 14 (P00–P12 + UTER-P13)

## Independent re-evaluation (not self-declarations)

| ID | Control | Status | Detail |
|---|---|---|---|
| IA-01 | pinned UAES approved baseline re-derived | PASS | {"pinned_fingerprint" => "4713310d9f51a175", "live_fingerprint" => "4713310d9f51a175", "seal_intact" => true, "pinned_blob" => "a806eef48e6242d82dcb1d39d5c094e0d7d981a1", "computed_blob" => "a806eef48e6242d82dcb1d39d5c094e0d7d981a1", "version" => "1.12.1", "re |
| IA-02 | 14 independently assessed domains re-derived from source | PASS | {"uaes_phases" => 13, "uter_registry_domains" => 14, "extra_domain" => ["UTER-P13"], "gate_evaluator_domain_count" => 14} |
| IA-03 | no PASS without a real exit code in its raw log | PASS | {"pass_count" => 28, "unverifiable_pass_rows" => [], "explicit_skips" => [], "note" => "Skips are recorded explicitly and are never counted as PASS (§8.3)."} |
| IA-04 | over-privilege DENY expectations re-checked | PASS | {"cases" => 20, "passed" => 20, "mismatches" => []} |
| IA-05 | no NOT_RUN/FAIL promoted to a PASS domain | PASS | {"domain_count" => 14, "pass_count" => 0, "improperly_passed_domains" => []} |
| IA-07 | acceptance authority + manual evidence independently re-derived | FAIL | {"authority_source" => "USER_EXPLICIT_DESIGNATION", "run_state" => "COMPLETED", "collector_integrity" => "PASS", "independent_hash_mismatches" => [], "verified_items" => 0, "l4_signoff_granted" => false, "note" => "An authority record is NOT an acceptance deci |
| IA-06 | no unsupported global conformity claim while L4 is BLOCKED | PASS | {"l4_status" => "BLOCKED", "not_met_conditions" => 7, "d27_claims" => [{"file" => "D27-FINAL-CONFORMANCE-STATEMENT.md", "claims_conformant" => false, "disclaims_certification" => true}]} |

## Open findings (§13.1 / §13.2)

| ID | Severity | Finding | Verification |
|---|---|---|---|
| FIND-IA-11 | Critical | acceptance authority or manual-acceptance evidence chain is not trustworthy | NOT_VERIFIED |
| FIND-IA-07 | High | 42 domain acceptance items remain unverified | NOT_VERIFIED |
| FIND-IA-08 | High | 7 L4 global conditions remain NOT_MET | NOT_VERIFIED |
| FIND-IA-09 | Medium | 1 test-matrix commands FAIL | NOT_VERIFIED |
| FIND-IA-10 | Low | no APPROVED_EXCEPTION records granted | NOT_VERIFIED |

## Evidence integrity (§14.4)

- `governance-separation.json` present=true sha256=`88295989419f6335843bd302bcf0d580b38e45ff23bdd6bceee4280eafec8136` missing_fields=
- `p09-p10-boundary.json` present=true sha256=`a8c341eb2250572e33f4b548a3863ab275a1e0d142469519ab66450f0abeea94` missing_fields=
- `independent-assessment.json` present=true sha256=`01a9d49d3f11c86555e18df8a57d95837f1f5cd7a5be6f8f8bc0fac4d705def7` missing_fields=

SHA-256 values support evidence integrity only; they do not prove the underlying activity was performed correctly (§14.4). The independent-assessment.json row is self-referential and is re-hashed by the next assessment run.

## Conformance claim review

- L4_GLOBAL_CONFORMANCE_GATE: **BLOCKED** (7/16 NOT_MET)
- Unsupported CONFORMANT claim: **false**
- Exception approvals: 0
- §16.5: internal assessment is not external certification.

## Verdict

Independent assessment **COMPLETED**; conformance claim **NOT SUPPORTED**. Recommended §16.2 status: **PARTIALLY CONFORMANT**, with L4 **BLOCKED**. A completed assessment report is not an acceptance approval.
