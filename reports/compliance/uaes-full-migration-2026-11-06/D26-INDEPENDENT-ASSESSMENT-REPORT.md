# D26 — Independent Assessment Report

- Evidence ID: `D26-INDEPENDENT-ASSESSMENT`
- Generated: 2026-11-08T18:42:14Z
- Collector: WorkBuddy independent assessment pass (re-derived from source, not from remediation self-declarations)
- Uter HEAD: `424dfa2c55c534bf110fa5871420fe3fd679d307`
- UAES HEAD: `4344979777433fbcdbe23ef2aa0111fe2e8a52e7`

## Assessment scope (§16.4)

- System boundary: Uter repository (Layer B) + pinned UAES 1.12.1 ACTIVE baseline (Layer A, read-only) + WorkBuddy/CI assurance (Layer C)
- Standards baseline: UTER-UAES-GOV-001 + UAES 1.12.1 ACTIVE + §2.1 external standards catalogue
- Domains independently assessed: 14 (P00–P12 + UTER-P13)

## Independent re-evaluation (not self-declarations)

| ID | Control | Status | Detail |
|---|---|---|---|
| IA-01 | pinned UAES approved baseline re-derived | PASS | {"pinned_fingerprint" => "4713310d9f51a175", "live_fingerprint" => "4713310d9f51a175", "seal_intact" => true, "pinned_blob" => "a806eef48e6242d82dcb1d39d5c094e0d7d981a1", "computed_blob" => "a806eef48e6242d82dcb1d39d5c094e0d7d981a1", "version" => "1.12.1", "re |
| IA-02 | 14 independently assessed domains re-derived from source | PASS | {"uaes_phases" => 13, "uter_registry_domains" => 14, "extra_domain" => ["UTER-P13"], "gate_evaluator_domain_count" => 14} |
| IA-03 | no PASS without a real exit code in its raw log | PASS | {"pass_count" => 31, "unverifiable_pass_rows" => [], "explicit_skips" => [], "note" => "Skips are recorded explicitly and are never counted as PASS (§8.3)."} |
| IA-04 | over-privilege DENY expectations re-checked | PASS | {"cases" => 20, "passed" => 20, "mismatches" => []} |
| IA-05 | no NOT_RUN/FAIL promoted to a PASS domain | PASS | {"domain_count" => 14, "pass_count" => 0, "improperly_passed_domains" => []} |
| IA-07 | acceptance authority + manual evidence independently re-derived | PASS | {"authority_source" => "USER_EXPLICIT_DESIGNATION", "run_state" => "COMPLETED", "collector_integrity" => "PASS", "independent_hash_mismatches" => [], "verified_items" => 0, "l4_signoff_granted" => false, "note" => "An authority record is NOT an acceptance deci |
| IA-08 | control effectiveness re-evaluated by fault injection | PASS | {"probes" => 6, "passed" => 6, "failed" => [], "distinguishes_operation_from_effectiveness" => true, "scope" => "machine-executable controls in the Uter + pinned UAES repositories"} |
| IA-06 | no unsupported global conformity claim while L4 is BLOCKED | PASS | {"l4_status" => "BLOCKED", "not_met_conditions" => 4, "d27_claims" => [{"file" => "D27-FINAL-CONFORMANCE-STATEMENT.md", "claims_conformant" => false, "disclaims_certification" => true}]} |

## Open findings (§13.1 / §13.2)

| ID | Severity | Finding | Verification |
|---|---|---|---|
| FIND-IA-07 | High | 42 domain acceptance items remain unverified | NOT_VERIFIED |
| FIND-IA-08 | High | 4 L4 global conditions remain NOT_MET | NOT_VERIFIED |
| FIND-IA-10 | Low | no APPROVED_EXCEPTION records granted | NOT_VERIFIED |

## Evidence integrity (§14.4)

- `governance-separation.json` present=true sha256=`8cbe6a4306933146675a1b14a88055014117e8f66d636005fbcec1db3cf97a6c` missing_fields=
- `p09-p10-boundary.json` present=true sha256=`5f82c603b78c555c5bc511f08860912849351b1881b27e2b2a2e6df90edcd6c9` missing_fields=
- `independent-assessment.json` present=true sha256=`43d6f0a14b25b3b7075ac6d2c48373108ea469a2bba67dc5a34dd26a5dd21680` missing_fields=

SHA-256 values support evidence integrity only; they do not prove the underlying activity was performed correctly (§14.4). The independent-assessment.json row is self-referential and is re-hashed by the next assessment run.

## Control effectiveness (§16.1 dimension 4)

**Operation (dimensions 1-3):** did the control run? Verified via raw exit codes, hashes and re-derived DENY decisions above. **Effectiveness (dimension 4):** would it catch a violation? Verified by assessor-executed fault injection — these are different questions.

| Probe | Control | Negative case | Exit | Marker | Status |
|---|---|---|---|---|---|
| CE-01 | registry DRAFT/ACTIVE live derivation | hard-coded 304 / stale registry fixture | 0 | true | PASS |
| CE-02 | manual-acceptance evidence fail-closed | auto-promoted VERIFIED item / broken integrity chain | 0 | true | PASS |
| CE-03 | two-repository governance boundary deny paths | governance rules duplicated into product repo | 0 | true | PASS |
| CE-04 | gitleaks allowlist narrowness regression | real-form secret injected into an exempted-pattern file | 0 | true | PASS |
| CE-05 | secret-scan allowlist does not mask a real leak |  | nil | nil | PASS |
| CE-06 | requirement resolver two-level coverage | rule-only mapping resolves fewer requirements | 0 | true | PASS |

- Result: **PASS** (6/6 probes), distinguishes operation from effectiveness = **true**.
- Scope: machine-executable controls in the Uter + pinned UAES repositories. **This PASS is scope-limited** and does not certify human sign-off, third-party review, external-environment drills or risk-owner acceptance.
- Out of scope (remain NOT_MET): 42 item-by-item human acceptance sign-offs (§14.3 / §18); independent third-party review conclusions for M00-02/M01-01/M06-01/M08-01/M08-02/M13-05; human risk-owner residual-risk acceptance or APPROVED_EXCEPTION (§13.4); three-database / multi-instance / production-like DR drills; CI/CD green run at the exact committed head (§11).

## Conformance claim review

- L4_GLOBAL_CONFORMANCE_GATE: **BLOCKED** (4/16 NOT_MET)
- Unsupported CONFORMANT claim: **false**
- Exception approvals: 0
- §16.5: internal assessment is not external certification.

## Verdict

Independent assessment **COMPLETED**; conformance claim **NOT SUPPORTED**. Recommended §16.2 status: **PARTIALLY CONFORMANT**, with L4 **BLOCKED**. A completed assessment report is not an acceptance approval.
