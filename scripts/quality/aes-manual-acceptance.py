#!/usr/bin/env python3
"""UTER-AES-GOV-001 §14.3 / §16.3 — manual-acceptance evidence collector.

Runs ONLY checks that can genuinely execute on this machine. Every result is
recorded with the command, cwd, exit code, duration, log path and SHA-256.

Fail-closed rules:
  * A missing tool is NOT_RUN, never PASS.
  * A timeout is TIMEOUT, never PASS.
  * Execution evidence alone never becomes human acceptance (VERIFIED); that
    requires a recorded acceptance authority and an explicit per-item sign-off.
  * Items needing a human reviewer, a live/production environment, a third-party
    runtime or an installer are listed as OPEN in inventory.json.
  * A partial/interrupted run never leaves a silently valid evidence set: a
    run-state marker plus a post-write SHA-256 self-check must pass.

Usage:
  aes-manual-acceptance.py            run all local checks and write evidence
  aes-manual-acceptance.py --verify-only   only re-check evidence integrity
  aes-manual-acceptance.py --help     print this help (never executes checks)

Exit codes:
  0 = collection completed and evidence integrity verified (case FAIL/NOT_RUN
      results are DATA, not collector errors; the gate evaluator consumes them)
  3 = evidence integrity failure / interrupted run / bad arguments
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# Overridable only for negative/fixture tests: a test may point this at a temp
# mirror of the evidence tree. The production path is unchanged by default.
EV = Path(os.environ.get(
    "AES_MANUAL_EVIDENCE_DIR",
    ROOT / "reports/compliance/aes-full-migration-2026-11-06/evidence/manual-acceptance",
))
EV.mkdir(parents=True, exist_ok=True)

# The pinned AES checkout. Same default as aes-governance-gates.rb so both
# evaluators read the same baseline.
AES_REPO = Path(os.environ.get("AES_REPO", str(ROOT.parent / "aes")))

# Live DRAFT/ACTIVE reader lives in a shared, side-effect-free module so the
# evaluator and the fixtures that test it read the registry the same way.
# See scripts/quality/lib/registry_draft_state.py for why this is not a literal.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib import registry_draft_state as _draft_state  # noqa: E402


def registry_draft_state() -> dict:
    """Count DRAFT/ACTIVE entries in the pinned AES registry, live."""
    return _draft_state.read(AES_REPO)


def draft_state_note() -> str:
    """One-line, always-current wording for open_reason strings."""
    return _draft_state.note(AES_REPO)


def utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def tool_version(cmd: list[str]) -> str:
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        return (out.stdout or out.stderr).strip().splitlines()[0][:160] if (out.stdout or out.stderr).strip() else "unknown"
    except Exception:
        return "unknown"


USAGE = """UTER-AES-GOV-001 §14.3 / §16.3 manual-acceptance evidence collector

  (no args)       run all locally executable checks, write execution.json,
                  inventory.json, MA-*.log / MA-*.exit and a run-state marker
  --verify-only   do NOT execute anything; re-check SHA-256 / exit-code
                  consistency of the recorded evidence and report mismatches
  --help          show this message and exit without running any check
"""

RUN_STATE = EV / "run-state.json"
CONSOLE = EV / "runner-console.log"


def write_json_atomic(path: Path, payload: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    os.replace(tmp, path)


def load_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def read_acceptance_authority() -> dict | None:
    """Read the SEPARATE, user-authored authority record.

    The collector never invents an acceptance authority. Only an explicit record
    with source=USER_EXPLICIT_DESIGNATION may populate inventory.json, and only
    its explicit signed_item_ids may promote an item to VERIFIED.
    """
    rec = load_json(EV / "acceptance-authority.json")
    if not isinstance(rec, dict):
        return None
    if rec.get("source") != "USER_EXPLICIT_DESIGNATION":
        return None
    if not rec.get("authority_name"):
        return None
    return rec


def verify_integrity(execution: dict) -> list[str]:
    """Re-check every recorded hash/exit code against the files on disk."""
    problems = []
    for r in execution.get("cases", []):
        # Resolve from EV, not ROOT: a fixture may mirror the evidence tree into
        # a temp directory, and integrity must be checked against that mirror.
        log = EV / f"{r['evidence_id']}.log"
        if not log.is_file():
            problems.append(f"{r['evidence_id']}: log missing")
            continue
        actual = sha256(log)
        if actual != r["log_sha256"]:
            problems.append(f"{r['evidence_id']}: log_sha256 mismatch")
        if log.stat().st_size != r["log_bytes"]:
            problems.append(f"{r['evidence_id']}: log_bytes mismatch")
        exit_file = EV / f"{r['evidence_id']}.exit"
        recorded = "" if r["exit_code"] is None else str(r["exit_code"])
        if not exit_file.is_file() or exit_file.read_text() != recorded:
            problems.append(f"{r['evidence_id']}: exit file mismatch")
    return problems


# --------------------------------------------------------------------------
# Classification of all 42 open manual acceptance items from l3-domain-gates.json
# --------------------------------------------------------------------------
# category values: LOCAL_EXECUTED / LOCAL_PARTIAL / HUMAN_SIGNOFF /
#                  EXTERNAL_ENVIRONMENT / TOOL_UNAVAILABLE
INVENTORY = [
    ("P00", "M00-01", "governance responsibility and approval workflow sign-off", "HUMAN_SIGNOFF", [], "requires a named acceptance authority and a signed decision"),
    ("P00", "M00-02", "formal-standard vs draft isolation review", "HUMAN_SIGNOFF", [], "isolation review needs an independent reviewer; " + draft_state_note()),
    ("P01", "M01-01", "Agent permission audit with independent reviewer", "HUMAN_SIGNOFF", [], "independent reviewer evidence not recorded"),
    ("P01", "M01-02", "AI decision record and exception-behaviour detection", "LOCAL_PARTIAL", ["L1-03"], "runtime selftest covers deny/allow honesty, not a live anomaly-detection sweep"),
    ("P02", "M02-01", "requirement / user-story traceability audit", "HUMAN_SIGNOFF", [], "needs a reviewer comparing requirements to implementation"),
    ("P02", "M02-02", "product state-machine and business-rule audit", "HUMAN_SIGNOFF", [], "needs a domain reviewer"),
    ("P02", "M02-03", "product E2E regression", "EXTERNAL_ENVIRONMENT", ["L2-06"], "Playwright E2E needs a running backend, browser and login fixtures; full vitest is only partial evidence"),
    ("P03", "M03-01", "documentation vs code consistency audit", "LOCAL_PARTIAL", ["MA-14", "L1-01"], "automated spec/reference checks pass; a human doc/code audit is still open"),
    ("P03", "M03-02", "API / database / architecture documentation consistency", "HUMAN_SIGNOFF", [], "needs a reviewer"),
    ("P03", "M03-03", "stale knowledge identification", "HUMAN_SIGNOFF", [], "one stale TRACEABILITY row was fixed; full sweep not executed"),
    ("P04", "M04-01", "OpenAPI -> router -> handler -> service -> repository consistency", "EXTERNAL_ENVIRONMENT", [], "needs live cross-layer verification against a running instance"),
    ("P04", "M04-02", "architecture / ADR / running behaviour consistency", "HUMAN_SIGNOFF", [], "needs an architecture reviewer"),
    ("P05", "M05-01", "visual regression suite", "LOCAL_EXECUTED", ["MA-01"], "explicitly NOT waived by AES approval §4; local headless-Chrome baseline executed"),
    ("P05", "M05-02", "axe accessibility audit (WCAG 2.2 / WAI-ARIA)", "LOCAL_EXECUTED", ["MA-12"], "explicitly NOT waived by AES approval §4; axe-core 4.14 + @axe-core/playwright are installed and the full public-page suite is executed by MA-12"),
    ("P05", "M05-03", "keyboard navigation audit", "EXTERNAL_ENVIRONMENT", [], "explicitly NOT waived by AES approval §4; needs a live browser and a human keyboard walkthrough"),
    ("P05", "M05-04", "dark-mode / responsive review", "EXTERNAL_ENVIRONMENT", [], "needs a human visual review on real viewports"),
    ("P06", "M06-01", "code review gate sign-off", "HUMAN_SIGNOFF", [], "no independent review recorded"),
    ("P06", "M06-02", "complexity / duplication / maintainability audit", "LOCAL_PARTIAL", ["MA-09", "L1-09"], "knip + oxlint executed; maintainability judgement still needs a reviewer"),
    ("P07", "M07-01", "Electron main/renderer isolation, CSP, IPC, preload security", "HUMAN_SIGNOFF", [], "security review of the Electron boundary not executed"),
    ("P07", "M07-02", "docs-web / electron / web full build matrix", "LOCAL_PARTIAL", ["MA-10", "MA-11", "L2-07"], "web build executed; docs-web/electron builds depend on locally installed dependencies"),
    ("P07", "M07-03", "installer and upgrade verification", "EXTERNAL_ENVIRONMENT", [], "needs signed installers and an upgrade target"),
    ("P08", "M08-01", "independent Agent behaviour-consistency test across task types", "EXTERNAL_ENVIRONMENT", [], "only one task type has been executed"),
    ("P08", "M08-02", "third-party Agent runtime discovery cross-check", "EXTERNAL_ENVIRONMENT", [], "needs a second live Agent runtime"),
    ("P08", "M08-03", "Agent tool-adapter runtime scope verification", "EXTERNAL_ENVIRONMENT", [], "needs a live tool-adapter runtime"),
    ("P09", "M09-01", "documented test strategy and coverage evaluation", "LOCAL_PARTIAL", ["MA-13", "L2-06"], "coverage evidence executed; strategy acceptance still needs a signed quality decision"),
    ("P09", "M09-02", "defect management and closure evidence", "HUMAN_SIGNOFF", [], "no closed-finding records with verification evidence"),
    ("P09", "M09-03", "quality metrics and quality acceptance decision", "HUMAN_SIGNOFF", [], "no signed quality acceptance decision"),
    ("P09", "M09-04", "security test execution recorded in P09 test system", "LOCAL_EXECUTED", ["MA-02", "MA-03", "MA-04", "MA-05", "MA-06", "MA-07"], "govulncheck x4 + gitleaks + forbidden-file scan executed and recorded in P09 evidence system"),
    ("P10", "M10-01", "threat model and security requirements baseline", "HUMAN_SIGNOFF", [], "needs a security architect"),
    ("P10", "M10-02", "OWASP ASVS-aligned input validation / XSS / CSRF / SSRF review", "HUMAN_SIGNOFF", [], "needs a security reviewer"),
    ("P10", "M10-03", "secret scan / SAST / dependency vulnerability scan", "LOCAL_EXECUTED", ["MA-02", "MA-03", "MA-04", "MA-05", "MA-06", "MA-07"], "explicitly NOT waived by AES approval §4; govulncheck x4 + gitleaks + forbidden-file scan executed"),
    ("P10", "M10-04", "reliability objectives, backup/DR and incident drill", "EXTERNAL_ENVIRONMENT", [], "needs a production-like environment and a real drill"),
    ("UTER-P13", "M13-01", "three-database migration / recovery verification", "EXTERNAL_ENVIRONMENT", [], "explicitly NOT waived by AES approval §4; needs three live databases"),
    ("UTER-P13", "M13-02", "payment success / local-order anomaly window and duplicate notification", "LOCAL_PARTIAL", ["MA-08", "L2-08"], "automated idempotency/anomaly tests executed; isolated payment-environment drill still open"),
    ("UTER-P13", "M13-03", "concurrent balance deduction and idempotent accounting", "LOCAL_PARTIAL", ["MA-08"], "race-detector concurrency tests executed; a multi-instance drill is still open"),
    ("UTER-P13", "M13-04", "multi-instance consistency and task recovery", "EXTERNAL_ENVIRONMENT", [], "needs multiple live instances"),
    ("UTER-P13", "M13-05", "10 UTER P13 business domains independently accepted", "HUMAN_SIGNOFF", [], "only repository inventory completed"),
    ("P11", "M11-01", "CI/CD workflow audit and green run at this exact head", "EXTERNAL_ENVIRONMENT", [], "no commit/push is authorized for the uncommitted execution branch"),
    ("P11", "M11-02", "artifact integrity, release / rollback and environment isolation", "EXTERNAL_ENVIRONMENT", [], "needs a release pipeline and environments"),
    ("P12", "M12-01", "standard upgrade compatibility and deprecation management", "HUMAN_SIGNOFF", [], "needs a governance reviewer"),
    ("P12", "M12-02", "periodic compliance audit and technical-debt lifecycle", "HUMAN_SIGNOFF", [], "needs a recurring audit owner"),
    ("P12", "M12-03", "migration / rollback plan validation", "EXTERNAL_ENVIRONMENT", [], "needs a rehearsal environment"),
]

# --------------------------------------------------------------------------
# Locally executable checks. `tool` gates availability; missing => NOT_RUN.
# --------------------------------------------------------------------------
CASES = [
    dict(id="MA-01", title="visual regression baseline (local headless Chrome)",
         command="bun run test:visual", cwd="web", tool="bun", timeout=420),
    dict(id="MA-02", title="govulncheck root module",
         command="GOWORK=off govulncheck ./...", cwd=".", tool="govulncheck", timeout=900),
    dict(id="MA-03", title="govulncheck tokenkit module",
         command="GOWORK=off govulncheck ./...", cwd="tokenkit", tool="govulncheck", timeout=900),
    dict(id="MA-04", title="govulncheck relaykit module",
         command="GOWORK=off govulncheck ./...", cwd="relaykit", tool="govulncheck", timeout=900),
    dict(id="MA-05", title="govulncheck tokenkit/tokenkit module",
         command="GOWORK=off govulncheck ./...", cwd="tokenkit/tokenkit", tool="govulncheck", timeout=900),
    dict(id="MA-06", title="gitleaks secret scan on tracked HEAD tree",
         command="tmp=$(mktemp -d /tmp/aes-gitleaks-XXXXXX) && git archive HEAD | tar -x -C \"$tmp\" && (cd \"$tmp\" && gitleaks dir . --no-banner --config '" + str(ROOT / ".quality/gitleaks.toml") + "') && echo \"scanned_tree=$tmp\"",
         cwd=".", tool="gitleaks", timeout=420),
    dict(id="MA-07", title="forbidden tracked file check (.env / *.db / *.sqlite3)",
         command="out=$(git ls-files '.env' '*.db' '*.sqlite3' | head -3); if [ -n \"$out\" ]; then echo \"$out\"; exit 1; fi; echo 'no forbidden tracked files'",
         cwd=".", tool="git", timeout=120),
    dict(id="MA-08", title="payment idempotency + concurrency tests with -race",
         command="GOWORK=off go test -race -count=1 ./model/ -run 'TestRechargeEpayConcurrentCallbacksCreditOnce|TestRechargeOfficialCreditsQuotaExactlyOnce|TestRechargeEpayCreditsQuotaExactlyOnce|TestManualCompleteTopUpIdempotentSkipsZeroValueSideEffects' -v",
         cwd=".", tool="go", timeout=900),
    dict(id="MA-09", title="unused-code / duplication signal (knip)",
         command="bun run knip", cwd="web", tool="bun", timeout=420),
    dict(id="MA-10", title="docs-web build",
         command="if [ ! -d node_modules ]; then echo 'NOT_RUN: docs-web/node_modules missing'; exit 2; fi; npm run build",
         cwd="docs-web", tool="npm", timeout=900),
    dict(id="MA-11", title="electron build",
         command="if [ ! -d node_modules ]; then echo 'NOT_RUN: electron/node_modules missing'; exit 2; fi; npx electron-builder --dir",
         cwd="electron", tool="npm", timeout=900),
    dict(id="MA-12", title="axe accessibility audit (WCAG 2.2 / WAI-ARIA, real public-page suite)",
         command="bun run test:axe",
         cwd="web", tool="bun", timeout=900),
    dict(id="MA-13", title="Go root-module coverage profile + coverage gate",
         command="GOWORK=off go test -count=1 -coverprofile='" + str(ROOT / ".quality/.state/manual-acceptance-coverage.out") + "' -timeout 600s ./... && bash scripts/coverage-gate.sh '" + str(ROOT / ".quality/.state/manual-acceptance-coverage.out") + "' \"$(go list -m)\" controller=39 model=45 service=43",
         cwd=".", tool="go", timeout=1200),
    dict(id="MA-14", title="AI spec / documentation reference integrity",
         command="bash scripts/quality/ai-specs-check.sh", cwd=".", tool="bash", timeout=180),
]


def run_case(case: dict) -> dict:
    cid = case["id"]
    log_path = EV / f"{cid}.log"
    started = utc()
    t0 = time.monotonic()
    tool = case["tool"]
    if shutil.which(tool) is None:
        log_path.write_text(f"NOT_RUN: required tool '{tool}' is not installed\n")
        status, exit_code = "NOT_RUN", None
    else:
        cwd = ROOT / case["cwd"]
        if not cwd.is_dir():
            log_path.write_text(f"NOT_RUN: cwd {cwd} does not exist\n")
            status, exit_code = "NOT_RUN", None
        else:
            try:
                with log_path.open("wb") as f:
                    proc = subprocess.run(
                        ["bash", "-c", case["command"]],
                        cwd=cwd, stdout=f, stderr=subprocess.STDOUT,
                        timeout=case["timeout"], env=os.environ.copy(),
                    )
                exit_code = proc.returncode
                status = "PASS" if exit_code == 0 else "FAIL"
                if exit_code == 2 and "NOT_RUN" in log_path.read_text(errors="replace")[:200]:
                    status = "NOT_RUN"
            except subprocess.TimeoutExpired:
                exit_code = None
                status = "TIMEOUT"
                with log_path.open("ab") as f:
                    f.write(f"\nTIMEOUT after {case['timeout']}s\n".encode())
    elapsed = round(time.monotonic() - t0, 3)
    (EV / f"{cid}.exit").write_text("" if exit_code is None else str(exit_code))
    return {
        "evidence_id": cid,
        "title": case["title"],
        "command": case["command"],
        "cwd": case["cwd"],
        "status": status,
        "exit_code": exit_code,
        "started_at": started,
        "duration_seconds": elapsed,
        "log": str(log_path.relative_to(ROOT)) if log_path.is_relative_to(ROOT) else str(log_path),
        "log_sha256": sha256(log_path),
        "log_bytes": log_path.stat().st_size,
        "timeout_seconds": case["timeout"],
    }


def emit(line: str, sink: list[str]) -> None:
    print(line, flush=True)
    sink.append(line)


def matrix_index() -> dict:
    """Real statuses from test-matrix.json; never hardcode a PASS for a link."""
    doc = load_json(EV.parent / "test-matrix.json")
    if not isinstance(doc, dict):
        return {}
    return {r["id"]: r["status"] for r in doc.get("results", [])}


def collect() -> int:
    sink: list[str] = []
    run_id = datetime.now(timezone.utc).strftime("RUN-%Y%m%dT%H%M%SZ")
    write_json_atomic(RUN_STATE, {
        "run_id": run_id, "state": "RUNNING", "started_at": utc(),
        "note": "A COMPLETED marker is required before execution.json may be trusted.",
    })

    toolchain = {
        "go": tool_version(["go", "version"]),
        "node": tool_version(["node", "--version"]),
        "bun": tool_version(["bun", "--version"]),
        "python": sys.version.split()[0],
        "govulncheck": "installed" if shutil.which("govulncheck") else "NOT_INSTALLED",
        "gitleaks": "installed" if shutil.which("gitleaks") else "NOT_INSTALLED",
    }

    results = []
    for case in CASES:
        result = run_case(case)
        results.append(result)
        emit(f"[{result['evidence_id']}] {result['status']:8} exit={result['exit_code']} "
             f"{result['duration_seconds']}s  {result['title']}", sink)

    execution = {
        "evidence_id": "MANUAL-ACCEPTANCE-EXECUTION",
        "generated_at": utc(), "run_id": run_id,
        "related_requirement": "UTER-AES-GOV-001 §14.3 / §16.3",
        "uter_commit": subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"],
                                      capture_output=True, text=True).stdout.strip(),
        "toolchain": toolchain,
        "fail_closed_rules": [
            "NOT_RUN is never reported as PASS",
            "TIMEOUT is never reported as PASS",
            "execution evidence alone never becomes human acceptance (VERIFIED)",
            "a case FAIL is recorded as data; the L3/L4 gate evaluator decides acceptance",
        ],
        "cases": results,
        "summary": {
            "total": len(results),
            "PASS": sum(1 for r in results if r["status"] == "PASS"),
            "FAIL": sum(1 for r in results if r["status"] == "FAIL"),
            "NOT_RUN": sum(1 for r in results if r["status"] == "NOT_RUN"),
            "TIMEOUT": sum(1 for r in results if r["status"] == "TIMEOUT"),
        },
    }
    write_json_atomic(EV / "execution.json", execution)

    authority = read_acceptance_authority()
    signed = set(authority.get("signed_item_ids", [])) if authority else set()
    decision = (authority or {}).get("decision", "PENDING_ITEM_BY_ITEM_REVIEW")
    if decision != "GRANTED":
        signed = set()  # only an explicit GRANTED decision can sign anything
    by_matrix = matrix_index()
    cases_by_id = {r["evidence_id"]: r for r in results}

    items = []
    for domain, mid, desc, category, links, note in INVENTORY:
        linked = []
        for link in links:
            if link.startswith("MA-"):
                r = cases_by_id.get(link)
                linked.append({"id": link, "status": r["status"] if r else "MISSING",
                               "exit_code": r["exit_code"] if r else None,
                               "log": r["log"] if r else None,
                               "source": "manual-acceptance/execution.json"})
            else:
                linked.append({"id": link, "status": by_matrix.get(link, "MISSING"),
                               "source": "test-matrix.json"})
        evidence_collected = any(x["status"] == "PASS" for x in linked)
        items.append({
            "domain": domain, "id": mid, "description": desc,
            "category": category,
            "acceptance_status": "VERIFIED" if mid in signed else "NOT_VERIFIED",
            "evidence_collected": evidence_collected,
            "verified_by": authority["authority_name"] if mid in signed else None,
            "verified_at": utc() if mid in signed else None,
            "linked_evidence": linked, "open_reason": note,
        })
    inventory = {
        "evidence_id": "MANUAL-ACCEPTANCE-INVENTORY",
        "generated_at": utc(), "run_id": run_id,
        "related_requirement": "UTER-AES-GOV-001 §16.3 / §16.4",
        "domain_count": 14,
        "item_count": len(items),
        "category_summary": {c: sum(1 for i in items if i["category"] == c)
                             for c in sorted({i["category"] for i in items})},
        "acceptance_authority": authority,
        "acceptance_decision": {
            "status": decision,
            "signed_item_count": sum(1 for i in items if i["acceptance_status"] == "VERIFIED"),
            "note": "No item is auto-promoted by local execution evidence. Only an explicit per-item sign-off from the recorded acceptance authority can set VERIFIED.",
        },
        "note": "Every item remains NOT_VERIFIED until a named acceptance authority signs off; local execution evidence is recorded separately and never auto-promotes an item.",
        "items": items,
    }
    write_json_atomic(EV / "inventory.json", inventory)

    problems = verify_integrity(execution)
    integrity = {
        "evidence_id": "MANUAL-ACCEPTANCE-INTEGRITY",
        "generated_at": utc(), "run_id": run_id,
        "checked_cases": len(results),
        "problems": problems,
        "status": "PASS" if not problems else "FAIL",
    }
    write_json_atomic(EV / "integrity.json", integrity)

    emit(json.dumps({"execution": execution["summary"],
                     "categories": inventory["category_summary"],
                     "acceptance_decision": inventory["acceptance_decision"]["status"],
                     "integrity": integrity["status"]}, indent=2), sink)

    write_json_atomic(RUN_STATE, {
        "run_id": run_id, "state": "COMPLETED" if not problems else "INTEGRITY_FAILED",
        "started_at": execution["cases"][0]["started_at"] if results else None,
        "finished_at": utc(), "integrity_status": integrity["status"],
        "note": "A COMPLETED marker is required before execution.json may be trusted.",
    })
    CONSOLE.write_text("\n".join(sink) + "\n")
    if problems:
        emit("INTEGRITY FAILED: " + "; ".join(problems), sink)
        CONSOLE.write_text("\n".join(sink) + "\n")
        return 3
    return 0


def verify_only() -> int:
    execution = load_json(EV / "execution.json")
    state = load_json(RUN_STATE)
    if not isinstance(execution, dict):
        print("INTEGRITY FAILED: execution.json missing or invalid")
        return 3
    problems = verify_integrity(execution)
    if not isinstance(state, dict) or state.get("state") != "COMPLETED":
        problems.append("run-state marker is not COMPLETED (interrupted or mixed run)")
    inventory = load_json(EV / "inventory.json")
    if not isinstance(inventory, dict) or inventory.get("run_id") != execution.get("run_id"):
        problems.append("inventory.json run_id does not match execution.json")
    print(json.dumps({
        "run_id": execution.get("run_id"),
        "run_state": (state or {}).get("state"),
        "cases": execution.get("summary"),
        "integrity": "PASS" if not problems else "FAIL",
        "problems": problems,
    }, indent=2))
    return 0 if not problems else 3


def main(argv: list[str]) -> int:
    if any(a in ("--help", "-h") for a in argv):
        print(USAGE)
        return 0
    if argv == ["--verify-only"]:
        return verify_only()
    if argv:
        print("unknown arguments: " + " ".join(argv) + "\n\n" + USAGE, file=sys.stderr)
        return 3
    return collect()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
