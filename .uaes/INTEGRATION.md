# UAES Integration Contract — Uter

**Governing specification:** `UTER-UAES-GOV-001` (`docs/ai-specs/UTER-UAES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md`)  
**Status:** MIGRATION_PENDING  
**UAES lifecycle:** ACTIVE — registry `1.12.1` (`UAES-APPROVAL-2026-11-07-004`)  
**Owner:** Uter Engineering Governance

## 0. Governance architecture (§1.1 / §1.3)

This contract implements a **three-layer, two-repository** architecture. The two
repositories are governed separately and neither may absorb the other's rules.

| Layer | Repository | Responsibility |
|---|---|---|
| A — UAES universal | `uaes` | P00–P12 universal engineering governance only. MUST NOT contain Uter payment, billing, relay, wallet, order or channel business rules, and MUST NOT register UTER P13. |
| B — Uter project | `uter` | Project governance entrypoints, UAES inheritance configuration, and **UTER P13 — Business Domain Engineering**. MUST NOT weaken any mandatory UAES requirement. |
| C — Execution & assurance | both | WorkBuddy executes authorized work; CI/CD, automated tests and independent assessment verify it. |

Machine-readable registration: `.uaes/uter-governance-registry.yaml`.
UTER P13 specification: `.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`.
Enforcement: `scripts/quality/uter-governance-separation-check.rb`.

**P09 / P10 division (§1.3 / §8 / §9 / §10 / §16.3)**: P09 Quality Engineering *proves* whether
engineering quality meets the defined requirements (test strategy, execution,
defect closure, metrics, quality gates). P10 Security & Reliability *defines*
what security and reliability requirements the system must meet. Security
testing is required by P10 and executed/recorded by the P09 test system.
Enforcement: `scripts/quality/uter-p09-p10-boundary-check.rb`.

## 1. Source identity

| Field | Value |
|---|---|
| UAES repository | https://github.com/hu-xulin/uaes |
| UAES default branch at audit baseline | `main` |
| UAES source commit | `5f566b24b799daaa744d9501da7211bae0613a04` |
| Registry path | `.uaes/STANDARD-REGISTRY.yaml` |
| Registry blob SHA at audit baseline | `a806eef48e6242d82dcb1d39d5c094e0d7d981a1` |
| Registry version | `1.12.1` |
| Registry status | `ACTIVE` |
| Integration status | `MIGRATION_PENDING` |
| Approval record | `UAES-APPROVAL-2026-11-07-004` (`.uaes/APPROVAL-RECORD.md` in the UAES repository) |
| Uter project governance registry | `.uaes/uter-governance-registry.yaml` (Layer B; registers UTER P13) |
| UTER P13 specification | `.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md` (Uter only) |

The commit and blob SHA above identify the inspected audit baseline. They are immutable for this pin and must be updated only through a reviewed integration change. This pin was advanced from `46c6488` (registry `1.12.0`) to `74e5d2e` (registry `1.12.1`) by the UAES x Uter unified governance run; registry `1.12.1` is a normative correction release that repairs the specification-registry signature record, removes a project authorisation baseline that had been embedded inside enterprise standard UAES-09-014, and fixes three independent-verifier defects. The requirement map advanced from 2132 to 2150 items because the rewritten UAES-09-014 section states additional explicit MUST clauses; no existing requirement was deleted or weakened.

The machine-readable counterpart is `.uaes/uaes-pin.json`; `scripts/quality/uaes-pin-check.sh` cross-checks this contract against that pin so a spec-version refresh cannot desynchronise the two. On 2026-11-07 UAES published its 178 standards as ACTIVE in the immutable release commit `6c78ab50dc2b1adfedc035c88a70a906564318e4` (`release(governance): publish 178 standards as ACTIVE, registry 1.12.0`). The pin was then advanced to `46c648836ee4cf06e285712ae2504da7ccab5602` (`chore(governance): consolidate post-release regression fixes and final reports`), and finally to `74e5d2eea215c96b845d7a0b2111b7fa011c540f` (`fix(uaes): correct registry-integrity defects and release v1.12.1`), the normative correction release described above, which carries the re-sealed `UAES-SPEC-CORE@2.0.0` digest `c49d3938fd9f` and a re-verified detached sshsig-ed25519 release signature. This contract and the other Uter governance entrypoints are synced to that final pinned commit; `verify-pin` reports all six declared governance artefacts PRESENT. The pin was then advanced twice more, from `74e5d2e` to `36b62d2` (`fix(uaes): reap the process group when a verification command times out`) and then to `5f566b24b799daaa744d9501da7211bae0613a04` (`feat(governance): add G-025 so a declared gate cannot live only on a local disk`), to name the tree in which verification `UAES-VER-20261108-986573` was executed and the record closed. That advance changed no governed content: the registry blob is still `a806eef4`, version `1.12.1`, status `ACTIVE`, seal `c49d3938fd9f`; the intervening commits repair only the verification harness (`mappings.yaml`, `independent-verifier.mjs`, `validate-registry.mjs`, reports), none of which lies inside the seal coverage set. The registry is `1.12.1 / ACTIVE` with 178 formally published standards. **Publishing UAES does not make Uter conformant:** the Uter 14 domain gates remain 0/14 PASS, the L4 global gate is `BLOCKED`, 42 manual acceptances are unsigned, and the Requirement→Evidence mapping is incomplete. Integration status therefore remains `MIGRATION_PENDING`, and no Uter requirement may be marked `VERIFIED` on this basis.

**Open governance caveat (not adjudicated by this repository):** the pin's own notes disclose that the release signature for `UAES-SPEC-CORE@2.0.0` was produced inside the executor worktree under the owner's written authorisation as a single-machine separation-of-duties exception, not in an independent authority environment. Whether that satisfies the UAES root trust policy is for the UAES Authority to confirm. The UAES working tree also still carries uncommitted changes; only the immutable commit above is treated as the baseline. This caveat is recorded, not waived.

## 2. Authority during migration

Until the 14 domain gates, the Requirement→Evidence mapping, agent runtime discovery, and CI enforcement are verified against this published baseline:

1. User authorization and safety boundaries remain highest priority.
2. Uter root `AGENTS.md` and nested project instructions remain the active project constitution.
3. Uter project-specific security, billing, payment, database, architecture, and design-system constraints remain mandatory.
4. UAES `1.12.1` is the published normative baseline for **generic** engineering governance. UTER P13 and the Uter project policies are the authority for **project-specific business** rules. UAES approval does not by itself retire any Uter rule, and no local standard may be deleted until semantic parity, approved lifecycle, project mapping, runtime discovery, and CI enforcement are all evidenced (see the UAES canonical skill `skills/uaes-uter-integration/SKILL.md`, Procedure §10).
5. Where the two systems conflict, document and escalate for governance adjudication (§1.4); mark the affected requirement BLOCKED. Do not choose the more permissive rule and do not waive a mandatory requirement.
6. Repository separation is mandatory: UTER P13 and Uter business rules must never be written into UAES `standards/`, `.uaes/registry/` or the UAES Registry; UAES generic standard text must not be copied into a competing local standard.

## 3. Target authority after migration

After the required approval and verification gates pass:

- UAES owns generic engineering governance P00–P12, normative standards, shared agent/skill contracts, and cross-project quality policy — and nothing project-specific.
- Uter owns project context, actual architecture facts, product/business invariants (formally **UTER P13**), technology-specific configuration, design-system implementation, and executable project gates.
- UTER P13 is assessed as an independent 14th domain (§16.3); it inherits P00–P12 and must not redefine or weaken them.
- Uter's agent entrypoints become thin adapters that point to the pinned UAES release and the Uter project overlays.
- Generic duplicated local standards may be deprecated only after a semantic parity report and approved migration record exist.

## 4. Project overlays that must remain

At minimum, preserve and map:

- Uter payment, recharge, refund, balance, and financial invariants.
- Token usage, pricing, quota conversion, settlement, and billing safety rules.
- Authentication, authorization, session, OAuth/OIDC, WebAuthn, and account-security details.
- SQLite/MySQL/PostgreSQL compatibility and ClickHouse log-database constraints.
- Go modules, React/TypeScript, Electron, build tooling, and actual repository architecture.
- UTER Design System 3.0 and its project-specific tokens, components, and strict design gates.
- Existing CI workflows, test fixtures, coverage baselines, and operational scripts.

## 5. Existing quality engine reuse

Uter already contains `scripts/quality/uter-quality.sh`, `scripts/verify-all.sh`, and GitHub Actions workflows. UAES integration must govern and validate these existing mechanisms rather than introduce a competing quality runner.

**P09 / P10 boundary**: P09 owns these test processes, defect closure, metrics and quality-gate operation — it *proves* whether requirements are met. P10 owns the security/reliability requirement definitions (threat model, identity/API/data controls, SLO/RTO/RPO, backup, incident response) — it *defines* what must be met. Security tests are required by P10 and executed/recorded through the P09 test engineering system. A clean scanner report alone is not security conformity (§10.7), and a single passing test is not system conformity (§0.3).

## 6. Completion criteria

Do not change this status to VERIFIED until:

- A released/approved UAES version and immutable commit are pinned.
- All applicable UAES requirements have a Uter traceability mapping.
- Agent entrypoints and runtime skill discovery are proven with the actual coding agents.
- Local generic rules have a documented keep/migrate/deprecate disposition.
- Project overlays are preserved and linked to their owning standards.
- Required Uter quality gates execute locally and in CI with recorded evidence.
- An independent compliance audit passes.

## 7. Audit limitations

This integration record is based on direct inspection of the local `uaes` and
`uter` checkouts (re-verified 2026-11-06): `git rev-parse HEAD`, `git status`,
registry blob SHA, asset inventory and approval-record review. Repository
inspection alone does not execute Uter's Go, Bun, security, visual, or end-to-end
test suites, and does not prove runtime Agent behaviour. Those results must come
from real command executions with archived stdout/stderr/exit codes, plus an
independent assessment (§12 Phase 7). Per §0.3, neither documentation nor
individual test success establishes conformity.

## 8. Traceability matrix

The P00–P12 project mapping and keep/migrate/deprecate decisions are maintained
in `.uaes/TRACEABILITY.md`; UTER P13 is registered in
`.uaes/uter-governance-registry.yaml` and specified in
`.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`. The matrix is an inventory,
not a conformance certificate; no requirement may be marked `VERIFIED` without
reproducible evidence and independent approval.
