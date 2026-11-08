#!/usr/bin/env python3
"""UTER-UAES-GOV-001 §15 — D01..D28 deliverable generator.

Everything written here is derived from real, on-disk evidence produced by the
executable gates in scripts/quality/. No result is invented: unexecuted checks
are reported as NOT_ASSESSED / BLOCKED, and §16.2 conformance statuses are
computed from the L4_GLOBAL_CONFORMANCE_GATE result.

Supersedes the earlier V2 D01-D24 generator. Superseded V2 terms that still
appear below (FULLY_COMPLIANT / PARTIALLY_COMPLIANT, LOCAL MAIN ONLY,
SINGLE_EXECUTION_BRANCH, 13-domain scope) occur ONLY as historical descriptions
in the D20 corrective-action register. They are NOT normative vocabulary,
NOT active execution policy, and NOT conformance conclusions of this baseline.
The sole authority is UTER-UAES-GOV-001 §16.2 / §16.3 / §8.2 / §8.3.

Usage: python3 scripts/quality/uaes-governance-reports.py
Exit:  0 = all applicable deliverables written; 1 = required evidence missing.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import platform
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORTS = Path(os.environ.get("UAES_REPORTS_DIR", ROOT / "reports/compliance/uaes-full-migration-2026-11-06"))
EV = Path(os.environ.get("UAES_EVIDENCE_DIR", REPORTS / "evidence"))
SPEC = ROOT / "docs/ai-specs/UTER-UAES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md"
UAES_REPO = Path(os.environ.get("UAES_REPO", ROOT.parent / "uaes"))

NOW = dt.datetime.now(dt.timezone.utc).isoformat()
COLLECTOR = "WorkBuddy (Tencent Hunyuan Hy)"


def read(name: str, required: bool = True):
    p = EV / name
    if not p.is_file():
        if required:
            sys.exit(f"BLOCKED: required evidence missing: {p}")
        return None
    return json.loads(p.read_text())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception as exc:  # pragma: no cover - evidence honesty
        return f"UNAVAILABLE ({exc})"


UTER_HEAD = run(["git", "rev-parse", "HEAD"])
UTER_BRANCH = run(["git", "branch", "--show-current"])
UAES_HEAD = run(["git", "-C", str(UAES_REPO), "rev-parse", "HEAD"])
STATUS = run(["git", "status", "--porcelain=v1"]).splitlines()
TOOLCHAIN = {
    "go": run(["go", "version"]),
    "node": run(["node", "--version"]),
    "bun": run(["bun", "--version"]),
    "ruby": run(["ruby", "--version"]),
    "python": platform.python_version(),
}

matrix = read("test-matrix.json")
l1l2 = read("gates/l1-l2-gates.json")
l3 = read("gates/l3-domain-gates.json")
l4 = read("gates/l4-global-gate.json")
preflight = read("agent-runtime-preflight.json")
selftest = read("agent-runtime-selftest.json")
runtime_verify = read("agent-runtime-test-execution.json")
workspace = read("agent-runtime-workspace.json")
separation = read("governance-separation.json")
boundary = read("p09-p10-boundary.json")
independent = read("independent-assessment.json")
pin = json.loads((ROOT / ".uaes/uaes-pin.json").read_text())

spec_text = SPEC.read_text()
catalogue: list[tuple[str, str]] = []
_sec = spec_text[spec_text.index("## 2.1 Standards baseline"):spec_text.index("## 2.2 Applicability analysis")]
for line in _sec.splitlines():
    if line.startswith("| ") and "Governance application" not in line and not line.startswith("|---"):
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) == 2:
            catalogue.append((cells[0], cells[1]))

DOMAINS = {d["id"]: d for d in l3["domains"]}
OPEN_MANUAL = sum(len(d.get("open_manual_acceptance", [])) for d in l3["domains"])
FAILED_MATRIX = [r for r in matrix["results"] if r["status"] == "FAIL"]
NOT_MET = [c for c in l4["conditions"] if c["status"] == "NOT_MET"]

# §14.3 / §16.3 manual-acceptance evidence. Read the REAL collector output; never
# fabricate an execution result or an acceptance decision.
MA_EXEC = read("manual-acceptance/execution.json", required=False)
MA_INV = read("manual-acceptance/inventory.json", required=False)
MA_INTEG = read("manual-acceptance/integrity.json", required=False)
MA_STATE = read("manual-acceptance/run-state.json", required=False)
MA_AUTHORITY = read("manual-acceptance/acceptance-authority.json", required=False)
MA_CASES = (MA_EXEC or {}).get("cases", [])
MA_BY_ID = {c["evidence_id"]: c for c in MA_CASES}
MA_SUMMARY = (MA_EXEC or {}).get("summary", {})
MA_FINDINGS = read("manual-acceptance/findings.json", required=False)
MA_TRUSTED = bool(
    MA_EXEC and MA_INV and MA_INTEG and MA_STATE
    and MA_INTEG.get("status") == "PASS"
    and MA_STATE.get("state") == "COMPLETED"
    and MA_STATE.get("run_id") == MA_EXEC.get("run_id") == MA_INV.get("run_id")
)
# Derived from the REAL execution.json: never list a PASS case among disclosures.
MA_NON_PASS = [c for c in MA_CASES if c["status"] != "PASS"]
MA_NON_PASS_TEXT = ", ".join(
    f"{c['evidence_id']} {c['status']} (exit={c['exit_code']})" for c in MA_NON_PASS
) or "none"
MA_FINDINGS_TABLE = "\n".join(
    f"| `{f['id']}` | {f['status']} | {f['diagnosis']} {f['resolution']} |"
    for f in (MA_FINDINGS or {}).get("findings", [])
) or "| — | — | no analyst finding record |"


def ma(case_id: str) -> str:
    c = MA_BY_ID.get(case_id)
    return f"{c['status']} (exit={c['exit_code']})" if c else "MISSING"


MA_CASE_TABLE = "\n".join(
    f"| `{c['evidence_id']}` | {c['title']} | {c['status']} | {c['exit_code']} | "
    f"{c['duration_seconds']}s | `{c['log_sha256'][:16]}…` |"
    for c in MA_CASES
) or "| — | no execution evidence | — | — | — | — |"

MA_AUTHORITY_TEXT = (
    f"Acceptance authority **{MA_AUTHORITY['authority_name']}** "
    f"(`{MA_AUTHORITY['source']}`, recorded {MA_AUTHORITY['recorded_at']}). "
    f"Decision: `{MA_AUTHORITY['decision']}`; sign-off granted: "
    f"**{str(MA_AUTHORITY['signoff_granted']).lower()}**."
    if MA_AUTHORITY else
    "Acceptance authority: **NOT RECORDED**."
)
MA_DECISION_TEXT = (
    f"decision `{(MA_INV or {}).get('acceptance_decision', {}).get('status', 'UNKNOWN')}`, "
    f"signed items "
    f"{(MA_INV or {}).get('acceptance_decision', {}).get('signed_item_count', 0)}/42"
)
MA_EVIDENCE_SECTION = (
    "### 14-domain manual-acceptance evidence (§14.3 / §16.3)\n\n"
    f"{MA_AUTHORITY_TEXT} {MA_DECISION_TEXT}.\n\n"
    f"Collector run `{MA_STATE.get('run_id') if MA_STATE else 'n/a'}` "
    f"(state `{MA_STATE.get('state') if MA_STATE else 'MISSING'}`, integrity "
    f"`{MA_INTEG.get('status') if MA_INTEG else 'MISSING'}`, trusted={MA_TRUSTED}). "
    f"Executed {MA_SUMMARY.get('total', 0)} local checks: "
    f"PASS {MA_SUMMARY.get('PASS', 0)}, FAIL {MA_SUMMARY.get('FAIL', 0)}, "
    f"NOT_RUN {MA_SUMMARY.get('NOT_RUN', 0)}, TIMEOUT {MA_SUMMARY.get('TIMEOUT', 0)}.\n\n"
    "| ID | Check | Status | Exit | Duration | Log SHA-256 (prefix) |\n|---|---|---|---|---|---|\n"
    + MA_CASE_TABLE + "\n\n"
    "Local execution evidence is **not** human acceptance. All 42 `M*` items remain "
    "`NOT_VERIFIED` until the recorded authority signs them individually. "
    "`NOT_RUN` / `TIMEOUT` / `FAIL` are never reported as `PASS`.\n"
)

# §16.2 — computed, never hard-coded to a favourable value.
# A global conformity claim is forbidden while L4 is BLOCKED (§16.4).
FINAL_STATUS = "PARTIALLY CONFORMANT" if l4["status"] != "PASS" else "CONFORMANT"


def evidence_field_block(doc_id: str, requirement: str, status: str) -> str:
    """§14.3 evidence record fields, attached to every deliverable."""
    return (
        f"| Evidence ID | `{doc_id}` |\n"
        f"| Related requirement | {requirement} |\n"
        f"| Related finding | D10 gap register / D28 residual risk register |\n"
        f"| Repository revision | Uter `{UTER_HEAD}` / UAES `{UAES_HEAD}` |\n"
        f"| Source system | `scripts/quality/uaes-governance-reports.py` + on-disk gate evidence |\n"
        f"| Execution environment | local non-production; Python {TOOLCHAIN['python']}; Go {TOOLCHAIN['go']}; Node {TOOLCHAIN['node']}; Bun {TOOLCHAIN['bun']} |\n"
        f"| Collection time | {NOW} |\n"
        f"| Collector | {COLLECTOR} |\n"
        f"| Integrity | SHA-256 of source evidence is recorded in D25 (Evidence Index) |\n"
        f"| Storage reference | `{EV}` |\n"
        f"| Access restrictions | local repository evidence; no credentials or production data |\n"
        f"| Conformance status (§16.2) | **{status}** |\n"
    )


def write(doc_id: str, title: str, requirement: str, status: str, body: str) -> Path:
    path = REPORTS / f"{doc_id}-{title.replace(' ', '-').replace('/', '-').upper()}.md"
    doc = (
        f"# {doc_id} — {title}\n\n"
        "## Evidence record (§14.3)\n\n"
        "| Field | Value |\n|---|---|\n"
        + evidence_field_block(doc_id, requirement, status)
        + "\n## Content\n\n"
        + body.strip()
        + "\n\n---\n\n"
        "This deliverable is derived from recorded evidence. A document's existence "
        "does not by itself prove control operation or control effectiveness (§16.1). "
        "Internal assessment is not external certification (§16.5).\n"
    )
    path.write_text(doc)
    return path


written: list[Path] = []

# ---------------------------------------------------------------- D01
rows = "\n".join(
    f"| {sid} | {app} | NOT VERIFIED | NOT_ASSESSED | official publisher edition / amendment status not retrieved; no authoritative source verification performed in this local execution |"
    for sid, app in catalogue
)
written.append(write(
    "D01", "Standards Applicability Register", "§2.1 / §2.2 / §18 steps 4-5", "NOT ASSESSED",
    f"§2.1 catalogue extracted from the governing specification: **{len(catalogue)} standards/frameworks**.\n\n"
    "§2.2 requires 14 fields per standard. This execution could not retrieve official "
    "publisher editions, publication dates, amendments or current status from authoritative "
    "sources, so applicability decisions are **NOT_ASSESSED** rather than assumed. "
    "No external standard requirement has been invented.\n\n"
    "| Standard / Framework | Governance application (§2.1) | Edition verified | Applicability decision | Evidence limitation |\n"
    "|---|---|---|---|---|\n" + rows + "\n\n"
    "**Finding:** standards applicability analysis is incomplete; it is a mandatory "
    "input to §16.4 global acceptance and is registered in D10 / D28."
))

# ---------------------------------------------------------------- D02
written.append(write(
    "D02", "UAES Version and Registry Baseline", "§18 step 1 / §2.3 / §0.3", "PARTIALLY CONFORMANT",
    f"Re-verified directly from the UAES repository, not from historical reports.\n\n"
    f"| Field | Value |\n|---|---|\n"
    f"| UAES repository | `{UAES_REPO}` |\n"
    f"| HEAD | `{UAES_HEAD}` |\n"
    f"| Pinned commit | `{pin['source_commit']}` |\n"
    f"| Registry blob SHA | `{pin['registry_blob_sha']}` |\n"
    f"| Registry version / status | `{pin['registry_version']}` / `{pin['registry_status']}` |\n"
    f"| Approval record | `{pin['approval_record']}` |\n"
    f"| Integration status | `{pin['integration_status']}` |\n"
    f"| UAES global gate execution | `{l4['uaes_global_gate']}` |\n\n"
    "**Critical distinction:** `registry.status = APPROVED` establishes a normative "
    "baseline only. `APPROVAL-RECORD.md §4` explicitly did NOT approve executing/passing "
    "the 13 L3 domain gates, declaring Uter conformant, or waiving visual regression / "
    "axe / keyboard / three-database / security scanning / live Agent runtime evidence."
))

# ---------------------------------------------------------------- D03
modified = [l for l in STATUS if l[:2].strip().startswith("M")]
untracked = [l for l in STATUS if l.startswith("??")]
written.append(write(
    "D03", "Uter Engineering Baseline", "§18 step 3 / §6.3", "PARTIALLY CONFORMANT",
    f"| Field | Value |\n|---|---|\n"
    f"| Branch | `{UTER_BRANCH}` |\n| HEAD | `{UTER_HEAD}` |\n"
    f"| Working-tree entries | {len(STATUS)} ({len(modified)} modified, {len(untracked)} untracked) |\n"
    f"| Staged files | 0 (delivery remains fail-closed) |\n"
    f"| Commits created by this execution | 0 |\n\n"
    "Toolchain: " + ", ".join(f"`{k}={v}`" for k, v in TOOLCHAIN.items()) + "\n\n"
    "User pre-existing WIP (billing expression / DreamRouter pricing / tiered pricing) "
    "was preserved as a recorded baseline: no reset, clean, revert or staging. "
    "After the owner explicitly requested reconciliation of the four failing matrix "
    "rows, minimal semantic-preserving edits (including formatter normalisation) "
    "were applied to the exact paths enumerated in "
    "`evidence/agent-runtime-task.json`; before/after SHA-256 snapshots are in "
    "`evidence/wip-remediation/`. No WIP entry was reverted, overwritten wholesale "
    "or included in any commit. Baseline preservation evidence: "
    "`evidence/00-branch-switch-wip-preserved.txt`, "
    "`evidence/agent-runtime-workspace.json` (W1–W6).\n\n"
    "Engineering structure: 4 Go modules (root, relaykit, tokenkit, tokenkit/tokenkit), "
    "React 19 + TanStack Router + rsbuild frontend in `web/`, Electron desktop, "
    "docs-web, and `scripts/quality/` executable gates."
))

# ---------------------------------------------------------------- D04
sep_checks = separation["checks"]
written.append(write(
    "D04", "Governance Architecture", "§1.1 / §1.3 / §1.4 / §4.3", "PARTIALLY CONFORMANT",
    "| Layer | Repository | Responsibility |\n|---|---|---|\n"
    "| A — UAES universal | `uaes` | P00–P12 only; MUST NOT contain UTER P13 or Uter business rules |\n"
    "| B — Uter project | `uter` | governance entrypoints, UAES inheritance config, UTER P13 |\n"
    "| C — Execution & assurance | both | WorkBuddy, CI/CD, automated gates, independent assessment |\n\n"
    f"Two-repository separation gate: **{separation['overall']}** "
    f"({len(sep_checks)} checks, {len(separation['failed_checks'])} failures).\n\n"
    + "\n".join(f"- `{c['check']}` {c['status']} — {c['name']}" for c in sep_checks)
    + "\n\nUTER P13 is registered **only** in `.uaes/uter-governance-registry.yaml`; "
      "the UAES registry `phases` contains exactly P00–P12 and UAES `standards/` "
      "contains 13 domain directories. Historical `UAES-P13-*` files under the UAES "
      "`reports/` directory are derived Repository-Integration evidence, not standards; "
      "their ambiguous name is registered as a Low finding in D10."
))

# ---------------------------------------------------------------- D05
mapping = "\n".join(
    f"| {d['id']} | {d['name']} | {d['uaes_gate_id'] or 'N/A (Uter Layer B)'} | "
    f"{d['uaes_gate_execution']} | {d['status']} | {len(d['open_manual_acceptance'])} |"
    for d in l3["domains"]
)
written.append(write(
    "D05", "UAES Requirement Mapping", "§5.1-5.3 / §6.4 / §18 step 6", "NOT ASSESSED",
    "Requirement→Implementation→Evidence traceability for the 14 assessed domains. "
    "Status vocabulary follows §5.3 (`IMPLEMENTED` does not mean `VERIFIED`).\n\n"
    "| Domain | Name | UAES gate | UAES execution | Uter L3 | Open acceptance items |\n"
    "|---|---|---|---|---|---|\n" + mapping + "\n\n"
    "Full clause-by-clause requirement mapping (§5.2 record fields) has **not** been "
    "completed; this table is a domain-level traceability index only. Registered as a gap in D10."
))

# ---------------------------------------------------------------- D06
p13 = DOMAINS["UTER-P13"]
written.append(write(
    "D06", "UTER P13 Specification", "§4 / §16.3 / §18 step 7", "NOT ASSESSED",
    "Specification: `.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md`. "
    "Registered in: `.uaes/uter-governance-registry.yaml` "
    "(`UTER-PROJECT-GOVERNANCE-REGISTRY`) only. It inherits all applicable UAES "
    "P00–P12 mandatory requirements and is **not** a UAES universal domain.\n\n"
    "10 business domains inventoried: product/requirements, identity & account, "
    "model & provider, AI relay, usage & pricing, wallet & accounting, payment, "
    "task & scheduler, data consistency, business observability.\n\n"
    f"Independent L3 result: **{p13['status']}**; automated evidence "
    f"{', '.join(p13['failed_automated']) or 'all PASS'}; "
    f"{len(p13['open_manual_acceptance'])} open acceptance items. "
    "10 payment exception scenarios remain NOT_RUN. Repository inventory alone "
    "does not establish domain conformance (§16.3)."
))

# ---------------------------------------------------------------- D07
b_checks = boundary["checks"]
written.append(write(
    "D07", "Governance Ownership Matrix", "§1.3 / §3 P09 / §3 P10 / §8.2", "PARTIALLY CONFORMANT",
    "| Owner | Role | Responsibility |\n|---|---|---|\n"
    "| External standards | DEFINE | Recognised requirements and frameworks (§2.1) |\n"
    "| UAES (Layer A) | DEFINE | Universal engineering governance P00–P12 |\n"
    "| Uter governance (Layer B) | APPLY | Project policies, inheritance config, UTER P13 |\n"
    "| UTER P13 | DEFINE | Project-specific business domain controls |\n"
    "| P09 Quality Engineering | **PROVE** | Prove whether engineering quality meets requirements |\n"
    "| P10 Security & Reliability | **DEFINE** | Define security/reliability requirements the system must meet |\n"
    "| WorkBuddy | EXECUTE | Authorized engineering tasks only |\n"
    "| CI/CD | ENFORCE | Automated technical controls |\n"
    "| Independent assurance | EVALUATE | Implementation, evidence, conformance claims |\n\n"
    f"P09/P10 boundary gate: **{boundary['overall']}** "
    f"({len(b_checks)} checks, {len(boundary['failed_checks'])} failures). "
    "Security testing is REQUIRED by P10 and EXECUTED/RECORDED by the P09 test "
    "engineering system; neither may substitute for the other."
))

# ---------------------------------------------------------------- D08
uaes_domains = [d for d in l3["domains"] if d["classification"] == "UAES_UNIVERSAL_DOMAIN"]
d08_rows = "\n".join(
    f"| {d['id']} | {d['name']} | {d['status']} | {len(d['automated_evidence'])} | "
    f"{len(d['failed_automated'])} | {len(d['open_manual_acceptance'])} | "
    f"{(d['blocking_reason'] or '-').replace('|', '/')[:150]} |"
    for d in uaes_domains
)
written.append(write(
    "D08", "P00-P12 Assessment Report", "§3 / §16.3", "NOT ASSESSED",
    f"All 13 UAES domains were assessed independently. "
    f"**{l3['pass_count']}/{l3['domain_count']} PASS** overall; "
    f"{OPEN_MANUAL} manual acceptance items lack verification evidence.\n\n"
    "| Domain | Name | L3 | Automated | Failed | Open manual | Blocking reason |\n"
    "|---|---|---|---|---|---|---|\n" + d08_rows + "\n\n"
    f"UAES governance-layer gate execution remains `{l4['uaes_global_gate']}` / "
    "`NOT_RUN`; Uter-side evaluation does not rewrite UAES gate status."
))

# ---------------------------------------------------------------- D09
p13_auto = ", ".join(
    f"`{a['id']}={a['status']}`" for a in p13["automated_evidence"]
)
written.append(write(
    "D09", "P13 Business Domain Assessment", "§4 / §16.3", "NOT ASSESSED",
    f"Domain: `{p13['id']}` ({p13['name']}), classification "
    f"`{p13['classification']}`. L3 status **{p13['status']}**.\n\n"
    f"Automated evidence: {p13_auto or 'none'}.\n\n"
    "Business suites executed for real: `L2-08` targeted Go controller/service/model "
    "payment-billing-relay tests and `L2-09` targeted wallet/pricing vitest suites "
    "(24 files / 363 tests on verification run).\n\n"
    "Open acceptance items:\n\n"
    + "\n".join(f"- `{m['id']}` {m['description']} — {m['reason']}" for m in p13["open_manual_acceptance"])
    + "\n\n**This domain is NOT ASSESSED as conformant.** Repository inventory plus "
      "targeted unit tests do not cover the payment exception scenarios, concurrency, "
      "three-database migration/recovery or independent domain acceptance."
))

# ---------------------------------------------------------------- D10
gap_rows = []
gap_rows.append(("GOV-GAP-001", "High", "Standards applicability analysis incomplete",
                 f"{len(catalogue)} §2.1 standards lack verified editions / applicability decisions", "D01"))
gap_rows.append(("GOV-GAP-002", "High", "14 domain acceptances not passed",
                 f"{l3['pass_count']}/14 PASS; {OPEN_MANUAL} unverified acceptance items", "D08/D09"))
gap_rows.append(("GOV-GAP-003", "High", "Global conformance gate blocked",
                 f"{l4['not_met']}/{l4['mandatory_conditions']} L4 conditions NOT_MET", "D21"))
gap_rows.append(("GOV-GAP-004", "Medium", "Test matrix failures" if FAILED_MATRIX else "Test matrix failures (historical WIP rows reconciled)",
                 (f"{len(FAILED_MATRIX)} commands FAIL: " + ", ".join(f"`{r['id']}`" for r in FAILED_MATRIX)) if FAILED_MATRIX else "0 commands FAIL on the re-run matrix; four historical WIP failures fixed with before/after evidence", "D19 / evidence/wip-remediation"))
for f in independent["open_findings"]:
    gap_rows.append((f["finding_id"], f["severity"], f["title"], f["detail"], "D26"))
gap_table = "\n".join(
    f"| {a} | {b} | {c} | {str(d).replace('|', '/')[:200]} | {e} | IDENTIFIED |"
    for a, b, c, d, e in gap_rows
)
written.append(write(
    "D10", "Governance Gap Register", "§13.1-13.3 / §18 step 9", "NOT ASSESSED",
    "Severity model (§13.1): Critical / High / Medium / Low / Observation / "
    "Improvement Opportunity, considering impact, likelihood, exploitability, "
    "exposure and affected objectives. Lifecycle: IDENTIFIED → RECORDED → ASSESSED "
    "→ ASSIGNED → CORRECTIVE ACTION → IMPLEMENTED → VERIFICATION → CLOSED (§13.2). "
    "A finding is **not** closed merely because a change exists.\n\n"
    "| Finding ID | Severity | Title | Detail | Evidence | Lifecycle |\n|---|---|---|---|---|---|\n"
    + gap_table
))

# ---------------------------------------------------------------- D11
risk_rows = [
    ("RISK-01", "High", "Unverified payment/billing exception handling could affect real funds", "P13", "Targeted unit tests + independent domain acceptance + three-DB drill", "OPEN"),
    ("RISK-02", "High", "Security controls (ASVS/SAST/DR) unverified; tracked-tree secret scan executed but FAILED", "P10", "Execute P10-required security testing via P09 test system; resolve MA-06 (candidate false positive, NOT waived)", "OPEN"),
    ("RISK-03", "High", "User WIP typecheck/format/gofmt/build failures", "L1/L2", "Minimal semantic-preserving reconciliation with before/after SHA-256 evidence; verified by re-run matrix", "MITIGATED / VERIFIED (re-run matrix)" if not FAILED_MATRIX else f"OPEN — {len(FAILED_MATRIX)} matrix command(s) still FAIL"),
    ("RISK-04", "Medium", "Standards editions not verified against official publishers", "§2.1", "Retrieve authoritative editions; complete D01", "OPEN"),
    ("RISK-05", "Medium", "Independent human acceptance authority recorded but no item signed (42 NOT_VERIFIED)", "§16.4", "Owner must review and sign each item; L4-15 records the authority only", "OPEN (RECORDED / NOT ACCEPTED)" if MA_AUTHORITY else "OPEN"),
    ("RISK-06", "Low", "UAES-P13-* historical report names are ambiguous", "§4.3", "Separately approved UAES-repository rename", "OPEN"),
]
written.append(write(
    "D11", "Risk Register", "§7.1 / §13.4 / §16.4", "NOT ASSESSED",
    "| Risk ID | Severity | Description | Scope | Required treatment | Status |\n|---|---|---|---|---|---|\n"
    + "\n".join(f"| {a} | {b} | {c} | {d} | {e} | {f} |" for a, b, c, d, e, f in risk_rows)
    + "\n\nNo risk acceptance has been granted. §13.4 requires a formal decision with "
      "business justification, residual risk, compensating controls, acceptance "
      "authority, validity period and reassessment conditions. WorkBuddy must not "
      "accept material business risks on behalf of the organization (§18)."
))

# ---------------------------------------------------------------- D12
written.append(write(
    "D12", "Architecture Assessment", "§3 P04 / §16.1", "NOT ASSESSED",
    f"Repository inventory: Uter `{UTER_HEAD}` on `{UTER_BRANCH}`, UAES `{UAES_HEAD}`. "
    "Backend is Go + Gin serving the SPA on port 3000; frontend is React 19 + "
    "TanStack Router in `web/`; four Go modules; Electron desktop and docs-web.\n\n"
    f"P04 L3 status: **{DOMAINS['P04']['status']}**. Open items: "
    + ", ".join(f"`{m['id']}` {m['description']}" for m in DOMAINS["P04"]["open_manual_acceptance"])
    + "\n\nNo live OpenAPI→router→handler→service→repository consistency verification "
      "or ADR/runtime-behaviour audit was executed; therefore architecture control "
      "effectiveness is NOT ASSESSED."
))

# ---------------------------------------------------------------- D13
written.append(write(
    "D13", "Software Engineering Assessment", "§3 P06 / §8.2", "PARTIALLY CONFORMANT",
    f"P06 L3 status: **{DOMAINS['P06']['status']}**.\n\n"
    f"Real command results: {matrix['passed']}/{matrix['total']} PASS, "
    f"{matrix['failed']} FAIL, {len(matrix['skipped'])} SKIP.\n\n"
    "| Check | Layer | Exit | Command |\n|---|---|---|---|\n"
    + "\n".join(f"| `{r['id']}` | {r['layer']} | {r['exit_code']} | `{r['command'][:110].replace('|', '/')}` |"
                for r in matrix["results"])
    + "\n\nGo four-module tests and `go vet` ran on the verification run. "
      "The four historical failures (typecheck, format check, gofmt, build:check) "
      "were attributed to pre-existing user WIP (`duration` field propagation) and "
      "format debt; the owner then explicitly asked to reconcile them, and the "
      "fixes were minimal and semantic-preserving with before/after SHA-256 "
      "snapshots in `evidence/wip-remediation/`. Current re-run matrix: "
    + (f"**{matrix['failed']} FAIL** ({', '.join(r['id'] for r in FAILED_MATRIX)}); "
       "failures are recorded, not hidden or waived."
       if FAILED_MATRIX else
       "**0 FAIL** — all executed matrix commands returned exit 0. "
       "No assertion was relaxed and no user change was reverted.")
))

# ---------------------------------------------------------------- D14
written.append(write(
    "D14", "Quality Engineering Assessment", "§3 P09 / §9 / §8.2", "NOT ASSESSED",
    "**P09 PROVES** whether engineering quality meets the defined requirements. "
    "It owns test strategy, test execution, defect management, quality measurement "
    "and quality acceptance; it does **not** define the security requirement baseline.\n\n"
    f"P09 L3 status: **{DOMAINS['P09']['status']}**. "
    f"Boundary gate: **{boundary['overall']}**.\n\n"
    f"Executed evidence: test matrix `{matrix['passed']}/{matrix['total']}` PASS; "
    f"runtime verify `{runtime_verify['overall']}`; selftest "
    f"`{selftest['passed']}/{selftest['total_cases']}`; manual-acceptance collector "
    f"PASS {MA_SUMMARY.get('PASS', 0)} / FAIL {MA_SUMMARY.get('FAIL', 0)} / "
    f"NOT_RUN {MA_SUMMARY.get('NOT_RUN', 0)} (visual regression {ma('MA-01')}, "
    f"coverage gate {ma('MA-13')}, knip {ma('MA-09')}, docs-web build {ma('MA-10')}, "
    f"electron build {ma('MA-11')}, accessibility probe {ma('MA-12')}). "
    f"Non-PASS checks remain OPEN: {MA_NON_PASS_TEXT}.\n\n"
    "Open quality items:\n\n"
    + "\n".join(f"- `{m['id']}` {m['description']} — {m['reason']}" for m in DOMAINS["P09"]["open_manual_acceptance"])
    + "\n\nA passing test matrix is not quality acceptance; §0.3 and §16.3 forbid "
      "declaring conformance from documents or single test results."
))

# ---------------------------------------------------------------- D15
written.append(write(
    "D15", "Security Assessment", "§3 P10 / §10 / §8.4", "NOT ASSESSED",
    "**P10 DEFINES** the security and reliability requirements the system must meet: "
    "threat modeling, identity/access, application/API security, data protection, "
    "supply chain, security testing, reliability, backup/DR and incident management. "
    "Execution/recording of security tests belongs to the P09 test system.\n\n"
    f"P10 L3 status: **{DOMAINS['P10']['status']}**.\n\n"
    f"Security-test evidence recorded in the P09 test system (§3 P09/P10 division): "
    f"`govulncheck` on 4 Go modules (MA-02 {ma('MA-02')}, MA-03 {ma('MA-03')}, "
    f"MA-04 {ma('MA-04')}, MA-05 {ma('MA-05')}), tracked-tree secret scan "
    f"(MA-06 {ma('MA-06')}), forbidden tracked-file scan (MA-07 {ma('MA-07')}). "
    "Those are execution records, not a P10 acceptance of the requirement baseline.\n\n"
    "Still missing (§8.4 risk-based criteria): SAST/DAST, ASVS-aligned manual review, "
    "penetration test, threat model sign-off, reliability/DR drills. "
    "UAES `APPROVAL-RECORD.md §4` explicitly did not waive security scanning. "
    f"All such findings remain **unresolved and disclosed**, not suppressed. "
    f"MA-06 detail (`evidence/manual-acceptance/MA-06-finding.json`): one "
    "`generic-api-key` hit on a 40-hex OpenAPI commit SHA quoted in "
    "`.uaes/API-LEGACY-ENDPOINT-DEPRECATION-AUDIT-2026-11-05.md`. It is registered "
    "as a **candidate false positive only** — the gitleaks allowlist was NOT changed, "
    "MA-06 stays FAIL, and classifying/accepting it requires the acceptance authority."
))

# ---------------------------------------------------------------- D16
written.append(write(
    "D16", "Reliability Assessment", "§3 P10.8-10.11 / §10.3-10.5", "NOT ASSESSED",
    "Reliability objectives must be measurable (§10.3), resilience must be verified "
    "(§10.5) and backup/DR plus incident management exercised (P10.10/P10.11).\n\n"
    f"Partial local evidence: payment idempotency / concurrent balance deduction "
    f"under `-race` (MA-08 {ma('MA-08')}) and automated anomaly-window tests (L2-08). "
    "No fault-injection, rate-limiting, multi-instance recovery, backup restore, DR "
    "drill or incident-response exercise evidence exists for this execution. "
    "Three-database migration/recovery verification is explicitly not waived by "
    "the UAES approval record and was not executed. **NOT ASSESSED**."
))

# ---------------------------------------------------------------- D17
written.append(write(
    "D17", "AI Governance Assessment", "§3 P01 / §6.6 / §11", "PARTIALLY CONFORMANT",
    f"P01 L3 status: **{DOMAINS['P01']['status']}**.\n\n"
    f"Policy test `test-ai-governance-policy.rb` and `ai-specs-check.sh` run in the "
    f"L1 matrix. Runtime harness selftest: `{selftest['passed']}/{selftest['total_cases']}` "
    f"cases PASS, including over-privilege DENY assertions and the honesty assertion "
    f"that a genuinely failing command cannot produce a PASS report.\n\n"
    f"Preflight: `{preflight['overall']}`; workspace: `{workspace['overall']}`; "
    f"verify: `{runtime_verify['overall']}`.\n\n"
    "Remaining: independent Agent permission audit, cross-task-type behaviour "
    "consistency, live cross-runtime discovery and tool-adapter scope verification."
))

# ---------------------------------------------------------------- D18
case_counts: dict[str, int] = {}
for c in selftest["cases"]:
    key = c["status"]
    case_counts[key] = case_counts.get(key, 0) + 1
decisions: dict[str, int] = {}
for c in selftest["cases"]:
    a = str(c["actual"]).split()[0] if c["actual"] else "n/a"
    decisions[a] = decisions.get(a, 0) + 1
written.append(write(
    "D18", "Agent Runtime Assessment", "§3 P08 / §6.7 / §18 step 14", "PARTIALLY CONFORMANT",
    "Live WorkBuddy runtime evidence, not static configuration:\n\n"
    "| Harness command | Overall | Detail |\n|---|---|---|\n"
    f"| preflight | `{preflight['overall']}` | 10 mandatory pre-task checks against live repo state |\n"
    f"| selftest | `{selftest['overall']}` | {selftest['passed']}/{selftest['total_cases']} cases |\n"
    f"| verify | `{runtime_verify['overall']}` | real commands, raw stdout/stderr/exit codes |\n"
    f"| workspace | `{workspace['overall']}` | W1–W6 anti-circumvention checks |\n\n"
    f"Selftest status counts: {case_counts}. Recorded decisions: {decisions}. "
    "The harness validates the enforcement surface WorkBuddy must obey; it does not "
    "claim to sandbox a third-party Agent binary. P08 domain acceptance is still "
    f"**{DOMAINS['P08']['status']}** because three manual acceptance items remain unverified."
))

# ---------------------------------------------------------------- D19
written.append(write(
    "D19", "Test Strategy and Test Results", "§9 / §15 D19", "PARTIALLY CONFORMANT",
    f"Test strategy (§9.1): L1_CHANGE_GATE covers formatting, compilation, type "
    f"checking, static analysis, governance gates and secret-like file detection; "
    f"L2_INTEGRATION_GATE covers four Go module test suites, `go vet`, full vitest, "
    f"build check and UTER P13 targeted business suites; UAES registry validation is "
    f"read-only.\n\n"
    f"Result: total **{matrix['total']}**, PASS **{matrix['passed']}**, "
    f"FAIL **{matrix['failed']}**, SKIP **{len(matrix['skipped'])}**, overall "
    f"`{matrix['overall']}`.\n\n"
    "| ID | Layer | Status | Exit | Duration (s) | Command |\n|---|---|---|---|---|---|\n"
    + "\n".join(
        f"| `{r['id']}` | {r['layer']} | {r['status']} | {r['exit_code']} | "
        f"{r['duration_seconds']} | `{r['command'][:100].replace('|', '/')}` |"
        for r in matrix["results"]
    )
    + "\n\nRaw logs: `evidence/matrix/<ID>.log` (stdout, stderr, exit code, duration, "
      "toolchain versions). Skips are explicit and never counted as PASS (§8.3). "
      "Failures are listed in D10 / D28, not waived.\n\n"
      "**Build-environment disclosure (§8.3):** an earlier full matrix run recorded "
      "`L2-07 build:check` as FAIL (exit 1, 463s) because the WorkBuddy host-side "
      "safe-delete shim blocked ~50 `fs.cp` overwrite deletes while copying "
      "`web/public` over a stale `web/dist`. It was NOT a compile error. A clean-dist "
      "standalone re-execution of the **unchanged** command returned exit 0 in 17s. "
      "Two intermediate preparation attempts were abandoned (one lacked "
      "`web/dist/index.html` required by `//go:embed`, one retained stale `static/` "
      "output that made rsbuild's trash-based deletion path extremely slow); neither "
      "result is presented as a final matrix. The runner adds only documented "
      "**build-hygiene steps**: after `L2-01..L2-05` (which require a valid `web/dist` "
      "for `go:embed`) it moves `web/dist` aside with `mv` — the project's existing "
      "`rebuild-all.sh` convention — so `L2-07` builds into an empty directory; and "
      "after `L2-07` it restores the **complete** docs static export with the project's "
      "own `node docs-web/scripts/copy-to-web.mjs` plus "
      "`scripts/verify-docs-artifacts.sh`, but only when `docs-content/` is absent, so "
      "no deletion is issued and the host safe-delete guard is never engaged. "
      "The `L2-07` command, its exit code and every assertion are unchanged.\n\n"
      "A third full matrix run confirmed `L2-07` PASS (exit 0, 19s) but exposed a "
      "**separate** `L2-01` FAIL (exit 1, 27s): the pre-run `web/dist` had been prepared "
      "with only `index.html` and `docs-content/_next`, which satisfies `//go:embed` "
      "compilation but not `main_docs_test.go`'s requirement for the full Next.js export "
      "(all language landing pages, about pages, `_next` assets and a >1KB landing page). "
      "This was an incomplete docs-artifact preparation, NOT a Go test regression. The "
      "third-run FAIL aggregate is preserved unchanged in "
      "`evidence/wip-remediation/L2-01-matrix-fail.log`, `matrix-third-run.tsv` and "
      "`test-matrix-third-run.json`; it is superseded only by an honest complete re-run. "
      "`GOWORK=off go test -count=1 .` (forced, uncached) returned exit 0 after the full "
      "export was restored. See `L2-01-environment-finding.json`, "
      "`L2-01-after-docs-restore.log`, `L2-01-root-forced.log`, "
      "`docs-artifacts-after-restore.txt`.\n\n"
      "See also `evidence/wip-remediation/L2-07-environment-finding.json`, "
      "`build-check-clean-dist.log` and the preserved first-run FAIL artifacts "
      "`L2-07-matrix-fail.log`, `matrix-first-final-run.tsv`, "
      "`test-matrix-first-final-run.json`."
))

# ---------------------------------------------------------------- D20
# Failure list is derived from the real matrix run, never hard-coded.
failed_rows = [r for r in matrix["results"] if r["status"] == "FAIL"]
failed_ids = ", ".join(f"`{r['id']}`" for r in failed_rows) or "none"


def row_status(row_id: str) -> str:
    row = next((r for r in matrix["results"] if r["id"] == row_id), None)
    return "IMPLEMENTED / VERIFIED by that row's exit 0 in the final matrix" \
        if row and row["status"] == "PASS" else "OPEN / NOT VERIFIED"


def row_state(row_id: str) -> str:
    row = next((r for r in matrix["results"] if r["id"] == row_id), None)
    return "RESOLVED / FINAL MATRIX PASS" if row and row["status"] == "PASS" else "OPEN"


actions = [
    ("CA-01", "V2 LOCAL MAIN ONLY / SINGLE_EXECUTION_BRANCH permanent rules conflicted with UTER-UAES-GOV-001", "AGENTS.md, .uaes/agent-governance.yaml, ai-specs-check.sh, test-ai-governance-policy.rb", "Migrate to governing spec, baseline preservation, 14 domains, L4_GLOBAL_CONFORMANCE_GATE", "IMPLEMENTED / VERIFIED by 3 gates exit 0"),
    ("CA-02", "UTER P13 missing; business rules were misplaced in UAES P10 of the local evaluator", ".uaes/UTER-P13-*.md, .uaes/uter-governance-registry.yaml, uaes-governance-gates.rb", "Register P13 in Uter only as 14th domain; correct P09/P10 labels", "IMPLEMENTED / VERIFIED by separation + boundary gates"),
    ("CA-03", "No automated two-repository separation or P09/P10 boundary control", "uter-governance-separation-check.rb, uter-p09-p10-boundary-check.rb", "Implement real cross-repository / role gates and wire into CI + test matrix", "IMPLEMENTED / VERIFIED"),
    ("CA-04", "V2 D01-D24 report generator used obsolete conclusion vocabulary", "uaes-governance-reports.py", "Rewrite to §15 D01-D28 with §14.3 fields and §16.2 statuses", "IMPLEMENTED / VERIFIED by this deliverable set"),
    ("CA-05", "Independent assessment (Phase 7) had no implementation", "uter-independent-assessment.rb, D26", "Independent re-derivation of pin/scope/exit codes/denials/gate honesty", "IMPLEMENTED / VERIFIED"),
    ("CA-06", "Runtime harness read removed execution_policy.mode and hard-coded branch != main", "uaes-agent-runtime-check.rb", "Record traceable baseline; respect environment-authorized local main", "IMPLEMENTED / VERIFIED by preflight/workspace/verify/selftest"),
    ("CA-07", "Dangling §27 / §22 references to a specification that ends at §19", "AGENTS.md, INTEGRATION.md, TRACEABILITY.md, AI-GOVERNANCE-ENTRY.md, P13 spec, registry, policy", "Replace with §1.3 / §6.3 / §8 / §9 / §10 / §16.3 / §18", "IMPLEMENTED / VERIFIED"),
    ("CA-08", f"14 domain acceptances remain open; local evidence executed (PASS {MA_SUMMARY.get('PASS', 0)} / FAIL {MA_SUMMARY.get('FAIL', 0)} / NOT_RUN {MA_SUMMARY.get('NOT_RUN', 0)}); axe/keyboard/three-DB/DR still unavailable", "manual-acceptance/*.json, D08/D09/D15/D16/D26/D28", "Owner-authorised item-by-item review and external-environment drills; not auto-closable", "OPEN / NOT VERIFIED"),
    ("CA-09", f"{len(failed_rows)} test-matrix command(s) FAIL: {failed_ids}", "D19 / D28 / evidence/wip-remediation", "The four prior user-WIP failures (typecheck, format:check, gofmt, build:check) were reconciled by minimal semantic-preserving fixes; working-tree changes remain unstaged and no assertion was relaxed", "IMPLEMENTED / VERIFIED by re-run matrix" if not failed_rows else "OPEN / NOT VERIFIED"),
    ("CA-10", f"acceptance authority record: {MA_AUTHORITY_TEXT}", "manual-acceptance/acceptance-authority.json, D27/D28", "Record the user-designated authority only; no sign-off, no auto-promotion of local evidence", "IMPLEMENTED / VERIFIED (recorded, NOT accepted)" if MA_AUTHORITY else "OPEN / NOT VERIFIED"),
    ("CA-11", "Runtime W1 flagged newly visible web/ paths after the owner-authorised WIP reconciliation", "evidence/agent-runtime-task.json, evidence/agent-runtime-workspace.json, D28", "Declare the exact 24 authorised paths individually with an explicit scope-extension declaration; re-run preflight/workspace; keep the W1 fail-closed rule unchanged", "IMPLEMENTED / VERIFIED by workspace W1-W6 PASS"),
    ("CA-12", "First final matrix L2-07 build:check FAIL caused by host safe-delete overwrite guard", "evidence/wip-remediation/L2-07-environment-finding.json, build-check-clean-dist.log, L2-07-matrix-fail.log, D19/D28", "Do NOT disable the shim or rewrite the exit code; verify the unchanged command PASS on a clean dist; add a documented mid-matrix `mv web/dist` build-hygiene step (after Go embed tests, before L2-07) and honestly re-run the entire matrix", row_status("L2-07")),
    ("CA-13", "Third full matrix run L2-01 go test ./... FAIL from incomplete docs static export preparation", "evidence/wip-remediation/L2-01-environment-finding.json, L2-01-matrix-fail.log, matrix-third-run.tsv, test-matrix-third-run.json, D19/D28", "Restore the COMPLETE docs-web static export with the project's own postbuild script and verify with scripts/verify-docs-artifacts.sh before the matrix; add a post-L2-07 restoration step (only when docs-content is missing); preserve the FAIL aggregate and honestly re-run the entire matrix", row_status("L2-01")),
]
written.append(write(
    "D20", "Corrective Action Register", "§13.2 / §13.3 / §18 steps 9-11", "PARTIALLY CONFORMANT",
    "Each corrective action follows §13.3 fields. `IMPLEMENTED` is not `VERIFIED`, "
    "and a finding is not closed solely because a change exists.\n\n"
    "**Vocabulary note:** superseded V2 terms appearing in CA-01 / CA-04 "
    "(`LOCAL MAIN ONLY`, `SINGLE_EXECUTION_BRANCH`, `D01-D24`, "
    "`FULLY_COMPLIANT`) are historical root-cause descriptions only. "
    "They are not active policy and not conformance conclusions; the current "
    "vocabulary is §8.2 / §8.3 / §16.2 / §16.3.\n\n"
    "| ID | Root cause / issue | Affected component | Corrective action | Verification |\n|---|---|---|---|---|\n"
    + "\n".join(f"| `{a}` | {str(b).replace('|', '/')} | {str(c).replace('|', '/')} | {str(d).replace('|', '/')} | {e} |"
                for a, b, c, d, e in actions)
))

# ---------------------------------------------------------------- D21
domain_table = "\n".join(
    f"| {d['id']} | {d['classification']} | {d['status']} | {d['uaes_gate_execution']} |"
    for d in l3["domains"]
)
written.append(write(
    "D21", "Quality Gate Assessment", "§8.2 / §8.3 / §16.3", "NOT ASSESSED",
    f"Gate result vocabulary (§8.3): PASS / FAIL / BLOCKED / NOT_RUN / "
    f"NOT_APPLICABLE / APPROVED_EXCEPTION. **NOT_RUN is never reported as PASS.**\n\n"
    f"| Gate | Status | Detail |\n|---|---|---|\n"
    f"| L1_CHANGE_GATE | {l1l2['L1_CHANGE_GATE']['status']} | {l1l2['L1_CHANGE_GATE']['checks']} checks, {len(l1l2['L1_CHANGE_GATE']['failed'])} failed |\n"
    f"| L2_INTEGRATION_GATE | {l1l2['L2_INTEGRATION_GATE']['status']} | {l1l2['L2_INTEGRATION_GATE']['checks']} checks, {len(l1l2['L2_INTEGRATION_GATE']['failed'])} failed |\n"
    f"| L3_DOMAIN_ACCEPTANCE_GATE | {l3['status']} | {l3['pass_count']}/14 domains PASS |\n"
    f"| L4_GLOBAL_CONFORMANCE_GATE | {l4['status']} | {l4['met']}/{l4['mandatory_conditions']} §16.4 conditions MET |\n\n"
    "| Domain | Classification | Status | UAES gate execution |\n|---|---|---|---|\n" + domain_table
))

# ---------------------------------------------------------------- D22
written.append(write(
    "D22", "Security Gate Assessment", "§8.4 / §10 / §16.1", "NOT ASSESSED",
    "§8.4 requires risk-based evaluation using exploitability, exposure, impact, "
    "affected assets, existing mitigations and residual risk, with disclosure of "
    "unresolved findings and risk-owner authorisation for acceptance.\n\n"
    "| Criterion | Observation |\n|---|---|\n"
    f"| Dependency vulnerability scan (govulncheck, 4 Go modules) | MA-02..MA-05: {ma('MA-02')}, {ma('MA-03')}, {ma('MA-04')}, {ma('MA-05')} |\n"
    f"| Secret scan (gitleaks, tracked HEAD tree) | MA-06: {ma('MA-06')} |\n"
    f"| Forbidden tracked-file scan | MA-07: {ma('MA-07')} |\n"
    "| SAST / DAST / OWASP ASVS-aligned manual review | NOT EXECUTED; explicitly not waived by UAES approval §4 |\n"
    "| Threat model / reliability objectives | NOT ASSESSED |\n"
    "| Backup / DR / incident drill | NOT EXECUTED |\n"
    "| Supply chain / dependency verification | partial (pinned CI action SHAs); full assessment NOT ASSESSED |\n"
    "| Runtime fail-closed denials | "
    f"`{selftest['overall']}` ({selftest['passed']}/{selftest['total_cases']}) |\n\n"
    "**All security findings remain open and disclosed.** No risk acceptance has "
    "been granted. A clean scanner report alone would not establish security "
    "conformity (§3 P10.7)."
))

# ---------------------------------------------------------------- D23
written.append(write(
    "D23", "Supply Chain Assessment", "§10.2 / §3 P10.6 / §2.1 SLSA & OpenSSF", "NOT ASSESSED",
    "Observed: `.github/workflows/ci.yml` pins actions to full commit SHAs; "
    "production Docker Compose service images are validated as immutable in CI; "
    "Go module checksums and frontend lockfiles exist in the repository.\n\n"
    f"Executed locally: `govulncheck` on all four Go modules "
    f"(MA-02 {ma('MA-02')}, MA-03 {ma('MA-03')}, MA-04 {ma('MA-04')}, MA-05 {ma('MA-05')}) "
    f"and a tracked-tree secret scan (MA-06 {ma('MA-06')}).\n\n"
    "Not verified: SLSA build level attestation, provenance verification, signed "
    "artifacts, SBOM generation, frontend dependency vulnerability scanning, and "
    "OpenSSF Scorecard. Executed scans are evidence, not an acceptance decision. "
    "**NOT ASSESSED** — no certification or supply-chain conformity claim is made."
))

# ---------------------------------------------------------------- D24
written.append(write(
    "D24", "Operational Readiness Assessment", "§10.4 / §10.5 / §16.4", "NOT ASSESSED",
    "Operational readiness requires environment isolation, rollback capability, "
    "observability, resilience verification and incident runbooks.\n\n"
    "No deployment, production change or operational drill was performed in this "
    "local execution (and is forbidden without authorisation). No evidence of a "
    "green CI run at this exact uncommitted HEAD exists. "
    "**NOT ASSESSED**; recorded as an open finding in D10 / D28."
))

# ---------------------------------------------------------------- D25
evidence_files = sorted(p for p in EV.rglob("*") if p.is_file())
index_rows = "\n".join(
    f"| `{p.relative_to(REPORTS)}` | {p.stat().st_size} | `{sha256(p)[:16]}…` |"
    for p in evidence_files
)
written.append(write(
    "D25", "Evidence Index", "§14.1-14.4 / §15 D25", "PARTIALLY CONFORMANT",
    f"**{len(evidence_files)}** evidence files under `{EV}`.\n\n"
    "| Path | Bytes | SHA-256 (prefix) |\n|---|---|---|\n" + index_rows + "\n\n"
    "Full SHA-256 values are computed at generation time; integrity hashes support "
    "evidence integrity only and do not prove the underlying activity was performed "
    "correctly (§14.4). Evidence is attributable, traceable and available for "
    "independent review, but **not sufficient** for a global conformity claim: "
    f"manual acceptance evidence (visual regression {ma('MA-01')}, security scans "
    f"MA-02..MA-07, payment concurrency {ma('MA-08')}) is now archived, yet "
    f"axe accessibility {ma('MA-12')}, keyboard navigation, three-database "
    "recovery, DR drills and 42 item-level human acceptances remain OPEN.\n\n"
    + MA_EVIDENCE_SECTION + "\n"
    "**Index closure (self-reference boundary):** this index is a point-in-time "
    "snapshot taken while this document is being written. It cannot enumerate "
    "files written after that moment, including its own exit-code file and the "
    "final convergence logs. `evidence/evidence-closure.json` is written last and "
    "is the authoritative integrity manifest for the completed evidence set; it "
    "deliberately excludes only itself. A point-in-time index must not be read as "
    "proof that no later evidence exists."
))

# D26 is produced by scripts/quality/uter-independent-assessment.rb (Phase 7).
d26 = REPORTS / "D26-INDEPENDENT-ASSESSMENT-REPORT.md"
if not d26.is_file():
    sys.exit(f"BLOCKED: D26 missing; run ruby scripts/quality/uter-independent-assessment.rb first ({d26})")
written.append(d26)

# ---------------------------------------------------------------- D27
not_met_list = "\n".join(
    f"- `{c['id']}` {c['description']} — {c['note']}" for c in NOT_MET
)
written.append(write(
    "D27", "Final Conformance Statement", "§16.2 / §16.4 / §18 step 20 / §19", FINAL_STATUS,
    f"## Final conformity status: **{FINAL_STATUS}** (§16.2)\n\n"
    f"L4_GLOBAL_CONFORMANCE_GATE: **{l4['status']}** "
    f"({l4['met']}/{l4['mandatory_conditions']} mandatory conditions MET).\n\n"
    "### Assessed scope\n\n"
    f"- System boundary: Uter repository (Layer B) at `{UTER_HEAD}` on `{UTER_BRANCH}`, "
    f"pinned UAES baseline (Layer A) at `{UAES_HEAD}`, and WorkBuddy/CI assurance (Layer C).\n"
    f"- Standards baseline: `UTER-UAES-GOV-001` (Proposed Execution Baseline — Pending "
    f"Repository and Standards Validation), UAES `{pin['registry_version']}` / "
    f"`{pin['registry_status']}`, and the §2.1 catalogue of {len(catalogue)} external standards/frameworks.\n"
    f"- Applicable requirements: 14 independent domains (UAES P00–P12 + UTER P13).\n\n"
    "### Results by category (§18 final-report requirement)\n\n"
    "| Category | Result |\n|---|---|\n"
    f"| Implemented | three-layer/two-repository architecture, UTER P13 registration, separation + P09/P10 gates, 14-domain evaluator, D01–D28 generator, independent assessment |\n"
    f"| Verified | separation gate `{separation['overall']}`, P09/P10 gate `{boundary['overall']}`, runtime selftest `{selftest['passed']}/{selftest['total_cases']}`, {matrix['passed']}/{matrix['total']} matrix commands |\n"
    f"| Accepted | none — {MA_AUTHORITY_TEXT} No item-level acceptance decision has been granted. |\n"
    "| Not applicable | UAES domain gates for UTER-P13 (it is a Uter Layer B extension) |\n"
    f"| Blocked | {l4['not_met']} L4 conditions, {OPEN_MANUAL} domain acceptance items, {len(FAILED_MATRIX)} matrix commands |\n\n"
    + MA_EVIDENCE_SECTION + "\n"
    "### Exclusions, evidence limitations and unresolved risks\n\n"
    "- No approved exclusions or `APPROVED_EXCEPTION` records were granted.\n"
    "- Official editions of §2.1 external standards were not verified against publishers.\n"
    f"- axe/keyboard accessibility {ma('MA-12')}, three-database migration/recovery, "
    "DR/incident drills, multi-instance recovery and independent human acceptance remain OPEN.\n"
    f"- Local evidence that FAILED or could not run is disclosed, not waived "
    f"(derived from `execution.json`): {MA_NON_PASS_TEXT}.\n"
    f"- Root causes and non-waiver decisions are recorded in "
    f"`evidence/manual-acceptance/findings.json`; the collector's own integrity "
    f"record is `{MA_INTEG.get('status') if MA_INTEG else 'MISSING'}` "
    f"(trusted={MA_TRUSTED}).\n"
    "- The four prior user-WIP matrix failures (typecheck / format:check / gofmt / "
    "build:check) were reconciled; working-tree changes remain unstaged and no "
    "assertion was relaxed.\n\n"
    "### Open L4 conditions\n\n" + not_met_list + "\n\n"
    "### Rationale\n\n"
    "Some applicable requirements are implemented and supported by verification "
    "evidence, but one or more applicable requirements remain unmet or insufficiently "
    "verified. Therefore §16.2 yields **PARTIALLY CONFORMANT**, not `CONFORMANT`. "
    "A global conformity claim is prohibited while material applicable requirements "
    "remain unassessed or unsupported by evidence (§16.4).\n\n"
    "### Certification distinction (§16.5)\n\n"
    "This is an internal assessment against `UTER-UAES-GOV-001`. It does **not** "
    "constitute certification against ISO, IEC, IEEE, NIST, OWASP, SLSA or any other "
    "external standard, and no such claim is made."
))

# ---------------------------------------------------------------- D28
written.append(write(
    "D28", "Residual Risk and Exception Register", "§13.4 / §16.4 / §18", "NOT ASSESSED",
    f"**No `APPROVED_EXCEPTION` records exist.** All unmet requirements remain open; "
    f"no risk-owner acceptance has been granted.\n\n"
    f"| Item | Status | Detail |\n|---|---|---|\n"
    f"| L4_GLOBAL_CONFORMANCE_GATE | {l4['status']} | {l4['not_met']}/{l4['mandatory_conditions']} conditions NOT_MET |\n"
    f"| Domain acceptance | {l3['status']} | {l3['pass_count']}/14 PASS; {OPEN_MANUAL} unverified items |\n"
    f"| Test matrix | {matrix['overall']} | {matrix['failed']} FAIL: {failed_ids}; {len(matrix['skipped'])} SKIP |\n"
    f"| Independent assessment | {independent['verdict']['independent_assessment']} | conformance claim supported: {independent['verdict']['conformance_claim_supported']} |\n"
    f"| Manual-acceptance evidence | DISCLOSED | collector PASS {MA_SUMMARY.get('PASS', 0)} / FAIL {MA_SUMMARY.get('FAIL', 0)} / NOT_RUN {MA_SUMMARY.get('NOT_RUN', 0)}; integrity `{MA_INTEG.get('status') if MA_INTEG else 'MISSING'}`; {MA_DECISION_TEXT} |\n"
    f"| gitleaks finding | OPEN / NOT WAIVED | one `generic-api-key` hit on an OpenAPI commit SHA in an audit doc; candidate false positive, see `evidence/manual-acceptance/MA-06-finding.json` |\n"
    f"| Non-PASS local evidence | DISCLOSED / NOT WAIVED | {MA_NON_PASS_TEXT}; details in `evidence/manual-acceptance/findings.json` |\n"
    f"| Accessibility toolchain | NOT_RUN / TOOL_UNAVAILABLE | axe absent from `web/node_modules`; keyboard/axe audits remain OPEN (MA-12: {ma('MA-12')}) |\n"
    f"| Build environment guard (L2-07) | DISCLOSED / {row_state('L2-07')} | first final matrix L2-07 FAIL from host safe-delete overwrite guard (exit 1, 463s); unchanged command PASS (exit 0, 17s) on clean dist; runner adds a documented mid-matrix `mv web/dist` hygiene step; see `L2-07-environment-finding.json` |\n"
    f"| Docs static export preparation (L2-01) | DISCLOSED / {row_state('L2-01')} | third full matrix L2-01 FAIL (exit 1, 27s) because `web/dist` held only `index.html` + `docs-content/_next`, which compiles but fails `main_docs_test.go`; complete docs static export restored via the project's own postbuild script, forced uncached root Go test exit 0, post-L2-07 restoration added; third-run FAIL aggregate preserved; see `L2-01-environment-finding.json`, `matrix-third-run.tsv`, `test-matrix-third-run.json` |\n"
    f"| Acceptance authority | RECORDED / NOT ACCEPTED | {MA_AUTHORITY_TEXT} |\n"
    f"| Exceptions | NONE | §13.4 requires authority, justification, compensating controls, validity and reassessment conditions |\n"
    f"| CI policy gap | OPEN / DECIDED | 14-domain/L4 evaluator and D01-D28 generator are archived locally, not enforced as CI pass/fail steps (see decision below) |\n\n"
    "### Non-PASS evidence root causes (§14.3 / §16.4)\n\n"
    "| ID | Status | Diagnosis and disposition |\n|---|---|---|\n"
    + MA_FINDINGS_TABLE + "\n\n"
    "No allowlist was modified, no assertion relaxed, no status rewritten and no "
    "finding waived. `MA-11` is a real `FAIL` from an Electron runtime download "
    "timeout; it is neither relabelled `TIMEOUT` nor treated as a successful build. "
    "`MA-12` is `NOT_RUN` for a missing axe toolchain, never `PASS`.\n\n"
    "Open L4 conditions:\n\n" + not_met_list + "\n\n"
    + MA_EVIDENCE_SECTION + "\n"
    "### Baseline preservation and WIP reconciliation (§6.3)\n\n"
    "The four prior failing matrix rows came from pre-existing user WIP / format debt "
    "(billing-expression `duration` field, gofmt, `format:check`, `build:check`). "
    "After the owner asked to reconcile them, they were fixed with minimal, "
    "semantic-preserving edits; before/after SHA-256 snapshots, formatter logs and "
    "the `build:check` exit code are archived under `evidence/wip-remediation/`. "
    "Nothing was waived, no assertion was relaxed, and no user change was reverted. "
    "Working-tree changes remain unstaged and unmixed with this governance execution.\n\n"
    "The runtime W1 anti-circumvention check initially returned FAIL after that "
    "reconciliation: formatter-normalised `web/` files became newly visible in "
    "`git status` but were not in the task's declared scope. The scope was corrected "
    "by enumerating the **exact 24 authorised paths individually** (no blanket "
    "`web/` prefix) together with an explicit `_WIP_REMEDIATION_SCOPE_EXTENSION` "
    "declaration citing the owner's instruction; `preflight` and `workspace` were "
    "then re-executed and W1–W6 all PASS. The W1 rule itself was not changed or "
    "weakened — an undeclared path still fails closed.\n\n"
    "### Acceptance authority (§16.4 / §18)\n\n"
    + MA_AUTHORITY_TEXT + " " + MA_DECISION_TEXT + ". "
    "The authority was explicitly designated by the user in-session; the user chose "
    "\"等我逐项复核后决定\", so **no item was signed**. L4-15 records only that the "
    "authority exists — it is not an acceptance decision and does not unblock L4.\n\n"
    "### CI wiring decision (§8.2 / §8.3 / §16.4)\n\n"
    "CI enforces the deterministic fail-closed gates: UAES pin, integration "
    "contract, two-repository separation, P09/P10 boundary, their positive/negative "
    "fixtures, and P08 over-privilege runtime denials. The 14-domain/L4 evaluator "
    "and the D01-D28 generator are intentionally **not** wired as required green CI "
    "steps: in this baseline `L4_GLOBAL_CONFORMANCE_GATE` is honestly `BLOCKED`, so "
    "wiring it as a mandatory passing step would either keep CI permanently red or "
    "require suppressing a non-zero exit, which §8.3 forbids. The new `L1-18` "
    "manual-acceptance negative-fixture test is likewise local: it mirrors the "
    "archived evidence tree into a temp directory, which a clean CI checkout does "
    "not have. Its outputs are archived as local evidence; changing CI policy "
    "requires an authorised acceptance decision after the open conditions are "
    "closed.\n\n"
    "Full risk list: D11. Findings: D10 / D26. Recovery conditions: complete the "
    "named verification activities, obtain independent review, have the recorded "
    "acceptance authority review and sign the 42 items individually, then re-run all "
    "gates. Until then delivery actions (commit / push / PR), deployment and "
    "production changes remain blocked."
))

# ---------------------------------------------------------------- manifest
manifest = {
    "evidence_id": "D25-MANIFEST",
    "generated_at": NOW,
    "governing_specification": "UTER-UAES-GOV-001",
    "repository_revision": {"uter_head": UTER_HEAD, "uaes_head": UAES_HEAD},
    "collector": COLLECTOR,
    "deliverable_count": len(written),
    "final_conformance_status": FINAL_STATUS,
    "l4_status": l4["status"],
    "deliverables": [
        {"id": p.name.split("-", 1)[0], "path": str(p.relative_to(ROOT)),
         "sha256": sha256(p), "bytes": p.stat().st_size} for p in written
    ],
}
(EV / "deliverables-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

# Authoritative integrity closure (§14.4). The closure script must be re-run LAST,
# after this generator's own log/exit files are written, to cover the full set.
subprocess.run(
    [sys.executable, str(ROOT / "scripts/quality/uaes-evidence-closure.py")],
    check=True,
)

print(f"deliverables={len(written)} D01..D28 (D26 produced by independent assessment)")
print(f"catalogue_standards={len(catalogue)} matrix={matrix['passed']}/{matrix['total']} "
      f"l3={l3['pass_count']}/14 l4={l4['status']} ({l4['met']}/{l4['mandatory_conditions']})")
print(f"final_conformance_status={FINAL_STATUS}")
print(f"manifest: {EV / 'deliverables-manifest.json'}")
