# Gate evaluation summary (UTER-UAES-GOV-001 §8.2 / §16)

- Generated: 2026-11-07T16:56:25Z
- Uter commit: `ec6501adceb008d46140a7e5ab6508eb78006731`
- UAES commit: `46c648836ee4cf06e285712ae2504da7ccab5602` (1.12.0 / ACTIVE)
- Conformance status vocabulary (§16.2): CONFORMANT / PARTIALLY CONFORMANT / NON-CONFORMANT / NOT ASSESSED / NOT APPLICABLE / BLOCKED

| Gate | Status | Detail |
|---|---|---|
| L1_CHANGE_GATE | FAIL | 18 checks, 1 failed |
| L2_INTEGRATION_GATE | PASS | 9 checks, 0 failed |
| L3_DOMAIN_ACCEPTANCE_GATE (14 domains) | BLOCKED | 0/14 PASS |
| L4_GLOBAL_CONFORMANCE_GATE | BLOCKED | 9/16 mandatory conditions MET |

| Domain | Classification | Status | UAES gate | Blocking reason |
|---|---|---|---|---|
| P00 Foundation | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 2 manual acceptance item(s) lack real verification evidence |
| P01 AI Governance | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | automated checks not passing: L1-16=FAIL |
| P02 Product Engineering | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 3 manual acceptance item(s) lack real verification evidence |
| P03 Knowledge Engineering | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 3 manual acceptance item(s) lack real verification evidence |
| P04 System Architecture | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 2 manual acceptance item(s) lack real verification evidence |
| P05 Experience & Design | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 4 manual acceptance item(s) lack real verification evidence |
| P06 Software Engineering | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 2 manual acceptance item(s) lack real verification evidence |
| P07 Cross-Platform Engineering | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 3 manual acceptance item(s) lack real verification evidence |
| P08 AI Agent Engineering | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | automated checks not passing: L1-16=FAIL |
| P09 Quality Engineering | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | automated checks not passing: L1-16=FAIL |
| P10 Security & Reliability | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 4 manual acceptance item(s) lack real verification evidence |
| UTER-P13 Business Domain Engineering | UTER_PROJECT_SPECIFIC_EXTENSION | BLOCKED | NOT_APPLICABLE | 5 manual acceptance item(s) lack real verification evidence |
| P11 DevOps & Delivery | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 2 manual acceptance item(s) lack real verification evidence |
| P12 Lifecycle & Evolution | UAES_UNIVERSAL_DOMAIN | BLOCKED | NOT_RUN | 3 manual acceptance item(s) lack real verification evidence |

## L4 mandatory conditions (§16.4)

| ID | Status | Note |
|---|---|---|
| L4-01 | MET | integration status is MIGRATION_PENDING, not conformance |
| L4-02 | MET | 25-item §2.1 catalogue applicability decisions required per standard |
| L4-03 | MET | separation gate must inspect both real repositories |
| L4-04 | MET | assessment != acceptance |
| L4-05 | NOT_MET | 0/14 PASS; NOT_RUN never counted as PASS |
| L4-06 | NOT_MET | 1 L1 failure(s) |
| L4-07 | MET | 0 L2 failure(s) |
| L4-08 | MET | neither domain may substitute for the other |
| L4-09 | NOT_MET | preflight/selftest/verify/workspace all required |
| L4-10 | NOT_MET | material applicable requirements remain unassessed |
| L4-11 | NOT_MET | no human risk-owner acceptance; exceptions require APPROVED_EXCEPTION with authority and review date (§13.4) |
| L4-12 | NOT_MET | control operation vs effectiveness not independently evaluated |
| L4-13 | NOT_MET | open evidence gaps: integrity=PASS, verified_items=0/42; axe / keyboard / three-database / human sign-off remain OPEN |
| L4-14 | MET | Phase 7 report must re-evaluate controls, evidence integrity and conformance claims |
| L4-15 | MET | authority recorded = 项目 Owner / Acceptance Authority（用户本人） (USER_EXPLICIT_DESIGNATION); acceptance decision = DELEGATED_BLANKET_SIGNOFF; no item-level sign-off and no global conformity claim (§18) |
| L4-16 | MET | must distinguish implemented / verified / accepted / not applicable / blocked; no certification claim (§16.5) |
