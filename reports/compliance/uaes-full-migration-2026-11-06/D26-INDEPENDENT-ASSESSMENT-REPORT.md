# D26 — Independent Assessment Report

- Evidence ID: `D26-INDEPENDENT-ASSESSMENT`
- Generated: 2026-11-08T00:08:38Z
- Collector: WorkBuddy independent assessment pass (re-derived from source, not from remediation self-declarations)
- Uter HEAD: `11455133b7f45bb9149bac4413e24aedf0bcf0b1`
- UAES HEAD: `74e5d2eea215c96b845d7a0b2111b7fa011c540f`

## Assessment scope (§16.4)

- System boundary: Uter repository (Layer B) + pinned UAES 1.9.0 baseline (Layer A, read-only) + WorkBuddy/CI assurance (Layer C)
- Standards baseline: UTER-UAES-GOV-001 + UAES 1.9.0 APPROVED + §2.1 external standards catalogue
- Domains independently assessed: 14 (P00–P12 + UTER-P13)

## Independent re-evaluation (not self-declarations)

| ID | Control | Status | Detail |
|---|---|---|---|
| IA-01 | pinned UAES approved baseline re-derived | FAIL | {"pinned_commit" => "74e5d2eea215c96b845d7a0b2111b7fa011c540f", "actual_commit" => "74e5d2eea215c96b845d7a0b2111b7fa011c540f", "pinned_blob" => "a806eef48e6242d82dcb1d39d5c094e0d7d981a1", "computed_blob" => "a806eef48e6242d82dcb1d39d5c094e0d7d981a1", "version" |
| IA-02 | 14 independently assessed domains re-derived from source | PASS | {"uaes_phases" => 13, "uter_registry_domains" => 14, "extra_domain" => ["UTER-P13"], "gate_evaluator_domain_count" => 14} |
| IA-03 | no PASS without a real exit code in its raw log | PASS | {"pass_count" => 28, "unverifiable_pass_rows" => [], "explicit_skips" => [], "note" => "Skips are recorded explicitly and are never counted as PASS (§8.3)."} |
| IA-04 | over-privilege DENY expectations re-checked | PASS | {"cases" => 20, "passed" => 20, "mismatches" => []} |
| IA-05 | no NOT_RUN/FAIL promoted to a PASS domain | PASS | {"domain_count" => 14, "pass_count" => 0, "improperly_passed_domains" => []} |
| IA-07 | acceptance authority + manual evidence independently re-derived | FAIL | {"authority_source" => "USER_EXPLICIT_DESIGNATION", "run_state" => "COMPLETED", "collector_integrity" => "PASS", "independent_hash_mismatches" => [], "verified_items" => 0, "l4_signoff_granted" => false, "note" => "An authority record is NOT an acceptance deci |
| IA-06 | no unsupported global conformity claim while L4 is BLOCKED | PASS | {"l4_status" => "BLOCKED", "not_met_conditions" => 7, "d27_claims" => [{"file" => "D27-FINAL-CONFORMANCE-STATEMENT.md", "claims_conformant" => false, "disclaims_certification" => true}]} |

## Open findings (§13.1 / §13.2)

| ID | Severity | Finding | Verification |
|---|---|---|---|
| FIND-IA-01 | Critical | UAES baseline pin does not match the repository | NOT_VERIFIED |
| FIND-IA-11 | Critical | acceptance authority or manual-acceptance evidence chain is not trustworthy | NOT_VERIFIED |
| FIND-IA-07 | High | 42 domain acceptance items remain unverified | NOT_VERIFIED |
| FIND-IA-08 | High | 7 L4 global conditions remain NOT_MET | NOT_VERIFIED |
| FIND-IA-09 | Medium | 1 test-matrix commands FAIL | NOT_VERIFIED |
| FIND-IA-10 | Low | no APPROVED_EXCEPTION records granted | NOT_VERIFIED |

## Evidence integrity (§14.4)

- `governance-separation.json` present=true sha256=`7a1ea1d299a22b1719efcb8d8d46dac48c414da009b8859b1aa9cee70db9a29d` missing_fields=
- `p09-p10-boundary.json` present=true sha256=`a8c341eb2250572e33f4b548a3863ab275a1e0d142469519ab66450f0abeea94` missing_fields=
- `independent-assessment.json` present=true sha256=`2e2552bc6e2f67803ada5946ef606b2143431d9e236c03d6bd4526c317ae0677` missing_fields=

SHA-256 values support evidence integrity only; they do not prove the underlying activity was performed correctly (§14.4). The independent-assessment.json row is self-referential and is re-hashed by the next assessment run.

## Conformance claim review

- L4_GLOBAL_CONFORMANCE_GATE: **BLOCKED** (7/16 NOT_MET)
- Unsupported CONFORMANT claim: **false**
- Exception approvals: 0
- §16.5: internal assessment is not external certification.

## Verdict

Independent assessment **COMPLETED**; conformance claim **NOT SUPPORTED**. Recommended §16.2 status: **PARTIALLY CONFORMANT**, with L4 **BLOCKED**. A completed assessment report is not an acceptance approval.
