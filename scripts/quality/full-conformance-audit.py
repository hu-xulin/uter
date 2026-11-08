#!/usr/bin/env python3
"""UTER x UAES FULL CONFORMANCE AUDIT & ACCEPTANCE -- reproducible audit engine.

This program is deliberately evidence-driven. It NEVER invents a PASS. Every
requirement record points at the exact source file/line, and an audit result of
PASS may only be produced from a real command/exit-code record that this run (or
an explicitly cited prior run at the SAME commit SHA) actually produced.

Phases:
  baseline  -- §2 real repository/spec state + §2.6 conflict register
  matrix    -- §3 full compliance matrix (unique Requirement ID, 15 fields)
  domains   -- §4 14 per-domain audit reports
  deliver   -- §11 all 14 deliverables + §9 evidence index + §12 final verdict
  all       -- all of the above in order

Usage:
  python3 scripts/quality/full-conformance-audit.py all
  UAES_REPO=/path/to/uaes python3 scripts/quality/full-conformance-audit.py all
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import platform
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[2]
UAES = pathlib.Path(os.environ.get("UAES_REPO", "/Users/lincolnhu/uaes"))
OUT = ROOT / "reports/compliance/full-conformance-audit-2026-11-06"
EV = OUT / "evidence"
LEGACY = ROOT / "reports/compliance/uaes-full-migration-2026-11-06/evidence"
DOMAIN_NAMES = {
    "00": "Foundation", "01": "AI Governance", "02": "Product Engineering",
    "03": "Knowledge Engineering", "04": "System Architecture",
    "05": "Experience & Design Engineering", "06": "Software Engineering",
    "07": "Cross-Platform Engineering", "08": "AI Agent Engineering",
    "09": "Quality Engineering", "10": "Security & Reliability",
    "11": "DevOps & Delivery", "12": "Lifecycle & Evolution",
    "13": "UTER Business Domain Engineering",
}
DOMAIN_DIRS = {
    "00": "00-foundation", "01": "01-ai-governance",
    "02": "02-product-engineering", "03": "03-knowledge-engineering",
    "04": "04-system-architecture", "05": "05-experience-design",
    "06": "06-software-engineering", "07": "07-cross-platform",
    "08": "08-agent-engineering", "09": "09-quality-engineering",
    "10": "10-security-reliability", "11": "11-devops-delivery",
    "12": "12-lifecycle-evolution",
}
# §3 "任何要求都不得在没有记录的情况下被跳过": UAES standards are bilingual.
# The first engine version only recognised English MUST/SHALL and therefore
# silently dropped 1333 Chinese normative lines (不得/必须/禁止/应当/严禁).
# FIND-FCA-005 records that coverage defect and this is the corrected matcher.
NORMATIVE = re.compile(r"\b(?:MUST(?:\s+NOT)?|SHALL(?:\s+NOT)?|REQUIRED|PROHIBITED)\b")
CN_NORMATIVE = re.compile(r"(?:不得|必须|禁止|严禁|应当|不应)")
SHOULD = re.compile(r"\bSHOULD(?:\s+NOT)?\b")
TABLE_ID = re.compile(r"^\|\s*(UAES-\d{2}-\d{3}(?:-\d{3})?)\s*\|")
ID_ANY = re.compile(r"UAES-\d{2}-\d{3}(?:-\d{3})?")
STATUS_BOLD = re.compile(r"\*\*Status:\*\*\s*(\S+)")
STATUS_TABLE = re.compile(r"^\|\s*Status\s*\|\s*([^|]+?)\s*\|", re.M)
VERSION_BOLD = re.compile(r"\*\*Version:\*\*\s*(\S+)")
VERSION_TABLE = re.compile(r"^\|\s*Version\s*\|\s*([^|]+?)\s*\|", re.M)


def _cell(m) -> str:
    if not m:
        return "MISSING"
    val = m.group(1).strip()
    # `PROPOSED_BASELINE` — explanation  ->  PROPOSED_BASELINE
    if val.startswith("`"):
        val = val[1:].split("`", 1)[0].strip()
    return val.split("—", 1)[0].strip() or "MISSING"


def standard_meta(path: pathlib.Path) -> tuple[str, str]:
    """Read Status/Version from BOTH header styles used by UAES standards.

    45 files use `**Status:** DRAFT`, 133 use a markdown table row
    `| Status | `DRAFT` |`. The old bold-only parser mislabelled 1332
    requirements as `MISSING` (FIND-FCA-006).
    """
    head = "\n".join(path.read_text(encoding="utf-8", errors="replace").splitlines()[:20])
    sm = STATUS_BOLD.search(head) or STATUS_TABLE.search(head)
    vm = VERSION_BOLD.search(head) or VERSION_TABLE.search(head)
    return _cell(sm), _cell(vm)


def keyword_class(text: str) -> str | None:
    if NORMATIVE.search(text):
        return "EN_MANDATORY"
    if CN_NORMATIVE.search(text):
        return "CN_MANDATORY"
    if SHOULD.search(text):
        return "RECOMMENDED"
    if TABLE_ID.match(text.strip()):
        return "REFERENCE_ROW"
    return None


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def run(cmd: list[str], cwd: pathlib.Path | None = None) -> tuple[int, str]:
    p = subprocess.run(cmd, cwd=cwd or ROOT, capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr).strip()


def git_head(repo: pathlib.Path) -> str:
    rc, out = run(["git", "rev-parse", "HEAD"], repo)
    return out.strip() if rc == 0 else "UNKNOWN"


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else ""


def jwrite(path: pathlib.Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def jread(path: pathlib.Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def toolchain() -> dict:
    out = {}
    for key, cmd in (("go", ["go", "version"]), ("node", ["node", "--version"]),
                     ("bun", ["bun", "--version"]), ("python", ["python3", "-V"]),
                     ("ruby", ["ruby", "-e", "print RUBY_VERSION"])):
        rc, text = run(cmd)
        out[key] = text if rc == 0 else "UNAVAILABLE"
    out["os"] = platform.platform()
    return out


# ------------------------------------------------------------------ §2 baseline
def phase_baseline() -> dict:
    rc_u, branch_u = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    _, remote_u = run(["git", "remote", "-v"])
    _, status_u = run(["git", "status", "--porcelain=v1"])
    rc_a, branch_a = run(["git", "rev-parse", "--abbrev-ref", "HEAD"], UAES)
    _, remote_a = run(["git", "remote", "-v"], UAES)
    _, status_a = run(["git", "status", "--porcelain=v1"], UAES)

    standards = sorted((UAES / "standards").rglob("*.md"))
    status_counter, versions, meta = Counter(), Counter(), {}
    for p in standards:
        st, ver = standard_meta(p)
        meta[str(p.relative_to(UAES))] = {"status": st, "version": ver}
        status_counter[st] += 1
        versions[ver] += 1

    gates = (UAES / ".uaes/registry/gates.yaml").read_text(encoding="utf-8")
    gate_not_run = len(re.findall(r"^\s*execution:\s*NOT_RUN", gates, re.M))
    registry = (UAES / ".uaes/STANDARD-REGISTRY.yaml").read_text(encoding="utf-8")
    reg_version = re.search(r'^\s*version:\s*"([^"]+)"', registry, re.M)
    reg_status = re.search(r'^\s*status:\s*"([^"]+)"', registry, re.M)

    baseline = {
        "evidence_id": "FCA-BASELINE-001",
        "generated_at": now(),
        "related_requirement": "§2 audit prerequisites",
        "uter": {
            "path": str(ROOT), "branch": branch_u.strip(), "commit_sha": git_head(ROOT),
            "remotes": [l for l in remote_u.splitlines() if "github" in l][:4],
            "staged_count": len([l for l in status_u.splitlines() if l[:2].strip() and l[0] != "?" and l[1] != "?"]),
            "worktree_count": len(status_u.splitlines()),
            "untracked_count": len([l for l in status_u.splitlines() if l.startswith("??")]),
            "modified_count": len([l for l in status_u.splitlines() if l.startswith(" M")]),
            "wip_policy": "PRESERVE - no reset/clean/overwrite; staged=0",
        },
        "uaes": {
            "path": str(UAES), "branch": branch_a.strip(), "commit_sha": git_head(UAES),
            "remotes": [l for l in remote_a.splitlines() if "github" in l][:4],
            "worktree_count": len(status_a.splitlines()),
            "uncommitted_paths": [l[3:] for l in status_a.splitlines()],
            "wip_policy": "PRESERVE - UAES repository NOT modified by this audit",
        },
        "uaes_registry": {
            "version": reg_version.group(1) if reg_version else None,
            "status": reg_status.group(1) if reg_status else None,
            "sha256": sha256(UAES / ".uaes/STANDARD-REGISTRY.yaml"),
        },
        "uaes_standards": {
            "md_files": len(standards), "status_distribution": dict(status_counter),
            "version_distribution": dict(versions),
            "draft_files": status_counter.get("DRAFT", 0),
            "parser": "standard_meta(): supports **Status:** and | Status | `DRAFT` | headers",
            "per_file": meta,
        },
        "uaes_gates": {"domain_gate_NOT_RUN_count": gate_not_run,
                       "sha256": sha256(UAES / ".uaes/registry/gates.yaml")},
        "toolchain": toolchain(),
        "collector": "WorkBuddy (Tencent Hunyuan Hy)",
        "integrity": "real git/FS reads only; no inferred state",
    }
    jwrite(EV / "00-baseline.json", baseline)

    # §2.6 conflicts / duplicates / stale / invalid content
    conflicts = [
        {"id": "CONF-001", "type": "DELIVERABLE_SCOPE",
         "old": "UTER-UAES-GOV-001 §15: D01-D28 (28 deliverables)",
         "new": "This directive §11: 14 deliverables including a full compliance matrix and P00-P13 per-domain reports",
         "resolution": "Produce a NEW independent audit package in reports/compliance/full-conformance-audit-2026-11-06/; keep D01-D28 intact as prior-stage evidence. No overwrite.",
         "authority": "latest explicit user instruction"},
        {"id": "CONF-002", "type": "GATE_TAXONOMY",
         "old": "UTER-UAES-GOV-001 §8.2: L1_CHANGE_GATE / L2_INTEGRATION_GATE / L3_DOMAIN_ACCEPTANCE_GATE / L4_GLOBAL_CONFORMANCE_GATE",
         "new": "This directive §8: 8 gates (Change, Code Review, Testing, Security, Architecture, Business Acceptance, Release, Global UAES Conformance)",
         "resolution": "Implement the 8 named gates as an additional executable layer; map each to the existing 4-layer evaluator; keep both, do not delete the 4-layer gate.",
         "authority": "latest explicit user instruction"},
        {"id": "CONF-003", "type": "CONCLUSION_VOCABULARY",
         "old": "UTER-UAES-GOV-001 §16.2: CONFORMANT / PARTIALLY CONFORMANT / NON-CONFORMANT / NOT ASSESSED / NOT APPLICABLE / BLOCKED",
         "new": "This directive §12: CONFORMANT / PARTIALLY CONFORMANT / NON-CONFORMANT / BLOCKED / NOT ASSESSED",
         "resolution": "Use ONLY the 5 §12 terms in this audit's final verdict. NOT_APPLICABLE is retained as a per-requirement applicability value (§10 requires justification for every N/A), not as a report-level verdict.",
         "authority": "latest explicit user instruction"},
        {"id": "CONF-004", "type": "STALE_DOCUMENT",
         "old": "reports/compliance/FINAL-COMPLIANCE-REPORT.md states UAES registry is DRAFT and 13 gates NOT_RUN under PR #15 baseline",
         "new": "UAES registry is 1.9.0 APPROVED; a 29/29 PASS matrix exists at the current commit",
         "resolution": "Do NOT rewrite the historical report (evidence preservation). Mark it SUPERSEDED in the new evidence index and cite the current baseline instead.",
         "authority": "real repository state"},
        {"id": "CONF-005", "type": "NORMATIVE_BASELINE_LIMITATION",
         "old": "Assumption: an APPROVED registry is an approved normative baseline for all requirements",
         "new": "UAES .uaes/APPROVAL-RECORD.md §4 explicitly does NOT approve 304 DRAFT entries, does NOT execute 13 domain gates, and does NOT claim Uter conforms",
         "resolution": "Register as P0 finding FIND-FCA-001. No requirement may be reported as formally approved against a published baseline. CONFORMANT is impossible until the UAES owner approves the entries and gates.",
         "authority": "UAES approval record (real file)"},
        {"id": "CONF-006", "type": "REPOSITORY_SEPARATION",
         "old": "This directive §7 asks to fix every non-conformity",
         "new": "Prior binding instruction: UAES and Uter must be governed separately; UTER P13 must not enter UAES; UAES has 5 uncommitted user changes",
         "resolution": "Fix ONLY Uter-side issues. UAES-side DRAFT/NOT_RUN issues are registered as findings with required authorisation, not silently edited.",
         "authority": "prior explicit user instruction + WIP protection"},
        {"id": "CONF-007", "type": "AUDIT_ENGINE_DEFECT",
         "old": "First engine run: English MUST/SHALL matcher only; bold-only Status parser; P13 produced 0 rows; matrix commit key guessed as commit_sha",
         "new": "UAES standards are bilingual (1333 Chinese mandatory lines were dropped); 133/178 standards use a table Status header; P13 is written in Chinese; D19-TEST-MATRIX writes `uter_commit`",
         "resolution": "FIND-FCA-005..008: fixed matcher (EN+CN+SHOULD+reference rows), shared standard_meta(), P13 Chinese extraction, and uter_commit binding. Before/after matrix snapshots preserved in evidence/bugfix/. Requirement count is therefore NOT comparable between the two runs.",
         "authority": "real repository content + §3 no-skip rule"},
    ]
    rec = {"evidence_id": "FCA-CONFLICT-REGISTER", "generated_at": now(),
           "related_requirement": "§2.6 conflict/duplicate/stale/invalid checks",
           "commit_sha": git_head(ROOT), "conflicts": conflicts,
           "count": len(conflicts), "collector": "WorkBuddy (Tencent Hunyuan Hy)"}
    jwrite(EV / "01-conflict-register.json", rec)
    return baseline


# -------------------------------------------------------------------- §3 matrix
def normative_level(text: str, kc: str) -> str:
    if kc == "REFERENCE_ROW":
        return "REFERENCE (non-normative index row)"
    if kc == "CN_MANDATORY":
        if any(w in text for w in ("不得", "禁止", "严禁")):
            return "MUST NOT (中文)"
        if "不应" in text:
            return "SHOULD NOT (中文)"
        return "MUST (中文)"
    if kc == "RECOMMENDED":
        return "SHOULD NOT" if "SHOULD NOT" in text else "SHOULD"
    if "MUST NOT" in text:
        return "MUST NOT"
    if "SHALL NOT" in text:
        return "SHALL NOT"
    if "PROHIBITED" in text:
        return "PROHIBITED"
    if "SHALL" in text:
        return "SHALL"
    if "REQUIRED" in text:
        return "REQUIRED"
    return "MUST"


def extract_requirements() -> tuple[list[dict], dict]:
    """Record EVERY normative statement; also disclose every skipped line.

    §3 forbids silently skipping a requirement. This returns a coverage ledger
    so an independent reviewer can recompute: lines scanned = recorded + each
    explicit skip reason. Bilingual (EN/CN) matchers plus SHOULD and native-ID
    reference rows are all represented.
    """
    reqs, seen, cov = [], {}, Counter()
    per_file = []

    def record(dom: str, rel: str, lineno: int, stripped: str, kc: str,
               std_status: str, std_version: str, prefix: str) -> None:
        digest = hashlib.sha256(f"{prefix}:{lineno}:{stripped}".encode()).hexdigest()[:12]
        rid = f"REQ-{dom}-{digest}"
        if rid in seen:
            cov["duplicate_hash_skipped"] += 1
            return
        native = TABLE_ID.match(stripped)
        any_id = ID_ANY.search(stripped)
        rec = {
            "requirement_id": rid,
            "native_uaes_id": native.group(1) if native else (any_id.group(0) if any_id else None),
            "uaes_domain": ("UTER-P13" if dom == "13" else f"P{dom}"),
            "domain_name": DOMAIN_NAMES[dom],
            "requirement_description": stripped[:400],
            "source_standard": rel,
            "source_line": lineno,
            "source_version": std_version,
            "source_status": std_status,
            "normative_level": normative_level(stripped, kc),
            "keyword_class": kc,
            "source_language": "zh" if kc == "CN_MANDATORY" or CN_NORMATIVE.search(stripped) else "en",
        }
        seen[rid] = rec
        reqs.append(rec)
        cov[f"recorded_{kc.lower()}"] += 1

    for dom, sub in DOMAIN_DIRS.items():
        d = UAES / "standards" / sub
        if not d.is_dir():
            cov["missing_domain_dir"] += 1
            continue
        for p in sorted(d.rglob("*.md")):
            text = p.read_text(encoding="utf-8", errors="replace")
            std_status, std_version = standard_meta(p)
            rel = str(p.relative_to(UAES))
            in_fence, file_lines, file_reqs = False, 0, 0
            for lineno, line in enumerate(text.splitlines(), 1):
                cov["lines_scanned"] += 1
                file_lines += 1
                if line.strip().startswith("```"):
                    in_fence = not in_fence
                    cov["skipped_fence_marker"] += 1
                    continue
                if in_fence:
                    cov["skipped_fence_content"] += 1
                    continue
                stripped = line.strip()
                if not stripped:
                    cov["skipped_blank"] += 1
                    continue
                kc = keyword_class(stripped)
                if kc is None:
                    cov["skipped_non_normative"] += 1
                    continue
                if len(stripped) < 12:
                    cov["skipped_short_fragment"] += 1
                    continue
                before = len(reqs)
                record(dom, rel, lineno, stripped, kc, std_status, std_version, rel)
                file_reqs += len(reqs) - before
            per_file.append({"file": rel, "domain": f"P{dom}", "status": std_status,
                             "version": std_version, "lines": file_lines,
                             "requirements_recorded": file_reqs})

    # UTER P13 (Uter-owned, NOT in UAES). Its normative statements are Chinese.
    p13 = ROOT / ".uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md"
    if p13.is_file():
        rel = ".uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md"
        std_status, std_version = standard_meta(p13)
        text = p13.read_text(encoding="utf-8", errors="replace")
        in_fence, file_reqs = False, 0
        for lineno, line in enumerate(text.splitlines(), 1):
            cov["lines_scanned"] += 1
            if line.strip().startswith("```"):
                in_fence = not in_fence
                cov["skipped_fence_marker"] += 1
                continue
            if in_fence:
                cov["skipped_fence_content"] += 1
                continue
            s = line.strip()
            if not s:
                cov["skipped_blank"] += 1
                continue
            kc = keyword_class(s)
            if kc is None:
                cov["skipped_non_normative"] += 1
                continue
            if len(s) < 12:
                cov["skipped_short_fragment"] += 1
                continue
            before = len(reqs)
            record("13", rel, lineno, s, kc, std_status, std_version, "P13")
            file_reqs += len(reqs) - before
        per_file.append({"file": rel, "domain": "UTER-P13", "status": std_status,
                         "version": std_version, "lines": len(text.splitlines()),
                         "requirements_recorded": file_reqs})

    ledger = {"totals": dict(cov), "files_scanned": len(per_file), "per_file": per_file,
              "matcher_note": "EN MUST/SHALL/REQUIRED/PROHIBITED + CN 不得/必须/禁止/严禁/应当/不应 + SHOULD + native-ID reference rows"}
    return reqs, ledger


def real_evidence_index() -> dict:
    """Only real, on-disk evidence at the SAME commit SHA is admissible."""
    idx = {}
    m = jread(LEGACY / "test-matrix.json", {})
    idx["matrix"] = {
        # D19-TEST-MATRIX writes `uter_commit`; the old key guess left this null.
        "commit_sha": m.get("uter_commit") or m.get("commit_sha") or m.get("repository_revision"),
        "overall": m.get("overall"), "total": m.get("total"),
        "passed": m.get("passed"), "failed": m.get("failed"),
        "results": [{"id": r["id"], "status": r["status"], "exit_code": r["exit_code"],
                     "command": r["command"]} for r in m.get("results", [])],
        "path": str(LEGACY / "test-matrix.json"), "sha256": sha256(LEGACY / "test-matrix.json"),
    }
    for name in ("execution.json", "inventory.json", "integrity.json", "run-state.json",
                 "acceptance-authority.json", "findings.json"):
        p = LEGACY / "manual-acceptance" / name
        idx[name] = {"present": p.is_file(), "sha256": sha256(p), "path": str(p)}
    for name in ("governance-separation.json", "p09-p10-boundary.json",
                 "independent-assessment.json", "agent-runtime-selftest.json",
                 "agent-runtime-test-execution.json", "agent-runtime-workspace.json"):
        p = LEGACY / name
        idx[name] = {"present": p.is_file(), "sha256": sha256(p), "path": str(p)}
    for name in ("l1-l2-gates.json", "l3-domain-gates.json", "l4-global-gate.json"):
        p = LEGACY / "gates" / name
        idx[name] = {"present": p.is_file(), "sha256": sha256(p), "path": str(p)}
    return idx


def applicability(rec: dict) -> tuple[str, str]:
    """§10: every N/A needs a written justification."""
    s = rec["source_standard"]
    txt = rec["requirement_description"]
    if rec.get("keyword_class") == "REFERENCE_ROW":
        return ("NOT_APPLICABLE",
                "This line is a cross-reference/index table row carrying a native UAES ID "
                "but no normative predicate. It is recorded (not skipped) for completeness, "
                "yet it asserts no obligation and therefore cannot be audited for conformance.")
    uaes_internal = ("registry" in s.lower() and "publish" in txt.lower()) or \
                    ("UAES repository" in txt and "Uter" not in txt)
    if uaes_internal:
        return ("NOT_APPLICABLE",
                "Normative statement governs the UAES governance repository's own publication "
                "workflow; Uter is a downstream consumer and is not the actor for this rule "
                "(two-repository separation). Tracked as an out-of-scope actor, not skipped.")
    return ("APPLICABLE", "UAES P00-P12 are inherited by Uter per .uaes/uter-governance-registry.yaml; "
            "UTER-P13 is Uter-owned. No exclusion claimed.")


def verification_binding(dom: str, ev: dict) -> dict:
    """Map a domain to REAL executable verification, never to a wish."""
    m = ev["matrix"]
    by_id = {r["id"]: r for r in m["results"]}
    binds = {
        "00": ["L1-01", "L1-04", "L1-05", "L1-06", "L1-07"],
        "01": ["L1-02", "L1-03", "L1-16", "L1-17"],
        "02": ["L2-09"],
        "03": ["L1-01", "L1-11"],
        "04": ["L2-01", "L2-05", "L2-07"],
        "05": ["L1-10", "L1-12", "L1-08"],
        "06": ["L1-08", "L1-09", "L1-10", "L1-13", "L2-01", "L2-06", "L2-07"],
        "07": ["L2-07"],
        "08": ["L1-03", "L1-16", "L1-17", "L1-18"],
        "09": ["L1-08", "L1-09", "L1-13", "L2-01", "L2-06", "L2-08", "L2-09"],
        "10": ["L1-16", "L2-01", "L2-08", "MA-02", "MA-03", "MA-04", "MA-05", "MA-06"],
        "11": ["L1-01", "L1-05", "L2-05", "L2-07", "U-01", "U-02"],
        "12": ["L1-06", "L1-07", "L1-17", "L1-18"],
        "13": ["L2-08", "L2-09"],
    }
    ids = binds.get(dom, [])
    real = [by_id[i] for i in ids if i in by_id]
    ma = [i for i in ids if i.startswith("MA-")]
    passes = all(r["status"] == "PASS" for r in real) if real else False
    return {
        "verification_method": "; ".join(f"`{r['command']}` (exit {r['exit_code']})" for r in real[:6]) or "NO EXECUTABLE VERIFICATION REGISTERED",
        "acceptance_criteria": "Real command exit code 0 with raw log preserved at evidence/matrix/<ID>.log" if real else "No executable acceptance criterion exists in this repository",
        "evidence_location": ", ".join([f"evidence/matrix/{r['id']}.log" for r in real[:6]] + [f"evidence/manual-acceptance/{i}.log" for i in ma]) or "NONE",
        "linked_real_commands": [r["id"] for r in real],
        "linked_manual_cases": ma,
        "indirect_only": True,
        "note": "A domain-level command is INDIRECT evidence for an individual normative statement. "
                "It cannot by itself prove that specific requirement. Audit result therefore stays "
                "NOT ASSESSED unless a requirement-specific verification exists.",
    }


def phase_matrix(baseline: dict) -> dict:
    reqs, ledger = extract_requirements()
    ev = real_evidence_index()
    commit = baseline["uter"]["commit_sha"]
    execj = jread(LEGACY / "manual-acceptance/execution.json", {})
    ma_by_id = {c["evidence_id"]: c for c in execj.get("cases", [])}
    inv = jread(LEGACY / "manual-acceptance/inventory.json", {})
    verified_ids = {i["id"] for i in inv.get("items", []) if i.get("acceptance_status") == "VERIFIED"}

    findings = []
    for rec in reqs:
        dom = rec["uaes_domain"].replace("P", "").replace("UTER-", "")
        dom = "13" if rec["uaes_domain"] == "UTER-P13" else dom
        app, why = applicability(rec)
        vb = verification_binding(dom, ev)
        # Honest result: no requirement-specific evidence exists in this repository.
        if app == "NOT_APPLICABLE":
            result = "NOT_APPLICABLE"
        elif rec["source_status"] != "APPROVED":
            # Covers DRAFT, PROPOSED_BASELINE (UTER P13) and MISSING alike.
            # No non-APPROVED source may be silently treated as assessable.
            result = "BLOCKED"
        else:
            result = "NOT_ASSESSED"
        rec.update({
            "applicability": app, "applicability_justification": why,
            "implementation_location": "NOT MAPPED - per-requirement implementation mapping does not exist in the repository",
            "verification_method": vb["verification_method"],
            "acceptance_criteria": vb["acceptance_criteria"],
            "evidence_location": vb["evidence_location"],
            "audit_result": result,
            "finding_id": ("FIND-FCA-001;FIND-FCA-002" if result == "BLOCKED" else
                           "FIND-FCA-002" if result == "NOT_ASSESSED" else "FIND-FCA-010"),
            "corrective_action": (
                "Owner must approve the normative baseline, then create a requirement-specific implementation mapping and verification case with raw evidence" if result == "BLOCKED" else
                "No corrective action: recorded reference row asserts no obligation" if result == "NOT_APPLICABLE" else
                "Create requirement-specific verification and re-audit"),
            "revalidation_result": "NOT REVALIDATED",
            "commit_sha": commit,
            "standard_status_limitation": (
                f"Source status {rec['source_status']} is not an approved baseline; "
                "UAES APPROVAL-RECORD §4 does not approve individual DRAFT entries"
                if rec["source_status"] != "APPROVED" else ""),
            "linked_real_commands": vb["linked_real_commands"],
            "linked_manual_cases": vb["linked_manual_cases"],
            "domain_verification_indirect_only": vb["indirect_only"],
        })
    summary = {
        "total_requirements": len(reqs),
        "by_domain": dict(sorted(Counter(r["uaes_domain"] for r in reqs).items())),
        "by_result": dict(Counter(r["audit_result"] for r in reqs)),
        "by_source_status": dict(Counter(r["source_status"] for r in reqs)),
        "by_applicability": dict(Counter(r["applicability"] for r in reqs)),
        "requirement_specific_verified": sum(1 for r in reqs if r["audit_result"] == "PASS"),
        "manual_items_verified": len(verified_ids),
        "matrix_commit_sha": ev["matrix"].get("commit_sha"),
        "matrix_overall": ev["matrix"].get("overall"),
        "matrix_passed": ev["matrix"].get("passed"),
        "matrix_total": ev["matrix"].get("total"),
        "ma_non_pass": [c["evidence_id"] for c in execj.get("cases", []) if c["status"] != "PASS"],
        "by_keyword_class": dict(Counter(r["keyword_class"] for r in reqs)),
        "by_normative_level": dict(Counter(r["normative_level"] for r in reqs)),
        "coverage_ledger": {"totals": ledger["totals"], "files_scanned": ledger["files_scanned"]},
        "uaes_draft_standard_files": baseline["uaes_standards"]["draft_files"],
        "uaes_standard_md_files": baseline["uaes_standards"]["md_files"],
    }
    matrix = {
        "evidence_id": "FCA-COMPLIANCE-MATRIX", "generated_at": now(),
        "related_requirement": "§3 / §9 / §10", "commit_sha": commit,
        "uaes_commit_sha": baseline["uaes"]["commit_sha"],
        "source_of_requirements": "every MUST/MUST NOT/SHALL/REQUIRED/PROHIBITED line in UAES standards/*.md plus UTER-P13, keyed by source file + line + text hash",
        "field_names": ["Requirement ID", "UAES Domain", "Requirement Description", "Source Standard",
                        "Source Version", "Applicability", "Implementation Location", "Verification Method",
                        "Acceptance Criteria", "Evidence Location", "Audit Result", "Finding ID",
                        "Corrective Action", "Revalidation Result"],
        "fail_closed_rules": [
            "No PASS without a requirement-specific real command and raw exit-code evidence",
            "Domain-level commands are recorded as INDIRECT only and never promote a requirement to PASS",
            "BLOCKED / NOT_RUN / NOT ASSESSED are never reported as PASS",
            "Every NOT_APPLICABLE carries a written applicability justification",
            "DRAFT normative sources are explicitly disclosed, never treated as approved",
        ],
        "summary": summary, "requirements": reqs, "evidence_index": ev,
        "coverage_ledger": ledger,
        "collector": "WorkBuddy (Tencent Hunyuan Hy)",
    }
    jwrite(EV / "02-compliance-matrix.json", matrix)
    # human-readable matrix (chunked, one file per domain in phase_domains)
    return matrix


# ------------------------------------------------------------------ §4 domains
def phase_domains(matrix: dict, baseline: dict) -> None:
    ev = matrix["evidence_index"]
    by_dom = defaultdict(list)
    for r in matrix["requirements"]:
        by_dom[r["uaes_domain"]].append(r)
    execj = jread(LEGACY / "manual-acceptance/execution.json", {})
    ma = {c["evidence_id"]: c for c in execj.get("cases", [])}
    reports = []
    for key, name in DOMAIN_NAMES.items():
        dom = f"P{key}" if key != "13" else "UTER-P13"
        rows = by_dom.get(dom, [])
        results = Counter(r["audit_result"] for r in rows)
        vb = verification_binding(key, ev)
        real_cmds = vb["linked_real_commands"]
        lines = [
            f"# §4 Domain Audit — {dom} {name}", "",
            f"**Generated:** {now()}  ",
            f"**Commit SHA:** `{baseline['uter']['commit_sha']}`  ",
            f"**UAES baseline:** `{baseline['uaes']['commit_sha']}` (registry {baseline['uaes_registry']['version']} / {baseline['uaes_registry']['status']})  ",
            f"**Normative source status:** {baseline['uaes_standards']['draft_files']}/{baseline['uaes_standards']['md_files']} UAES standards are DRAFT  ",
            f"**Requirements recorded:** {len(rows)} (none skipped)  ",
            f"**Audit results:** {dict(results)}", "",
            "## 1. 规范审计 (Specification)", "",
            f"- Source: `UAES standards/{DOMAIN_DIRS.get(key,'(Uter-owned P13)')}` " if key != "13" else "- Source: `.uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md` (Uter Layer B, NOT in UAES)",
            f"- Every normative statement is keyed by source file + line in `evidence/02-compliance-matrix.json`.",
            "- UAES `.uaes/APPROVAL-RECORD.md` §4 explicitly does NOT approve individual DRAFT entries; see FIND-FCA-001.", "",
            "## 2. 实际实现审计 (Implementation)", "",
            "- No per-requirement implementation mapping exists in the repository. Recorded as `NOT MAPPED` for every row.",
            "- This is a genuine gap, not a hidden skip: the mapping is enumerable from the matrix.", "",
            "## 3. 流程审计 (Process)", "",
            "- Governing entry: `AGENTS.md`, `.uaes/AI-GOVERNANCE-ENTRY.md`, `.uaes/uter-governance-registry.yaml`.",
            "- Historical `reports/compliance/FINAL-COMPLIANCE-REPORT.md` is SUPERSEDED (CONF-004); current evidence is this package.", "",
            "## 4. 自动化控制审计 (Automated controls)", "",
            f"- Domain-linked REAL commands (indirect evidence only): {', '.join('`'+c+'`' for c in real_cmds) or 'none'}.",
            f"- Domain-linked manual acceptance cases: {', '.join('`'+c+'`' for c in vb['linked_manual_cases']) or 'none'}.",
            "- `evidence/matrix/<ID>.log` holds raw stdout/stderr/exit code.", "",
            "## 5. 证据审计 (Evidence)", "",
            f"- Matrix aggregate at this commit: {ev['matrix'].get('passed')}/{ev['matrix'].get('total')} PASS, overall `{ev['matrix'].get('overall')}`.",
            "- Manual-acceptance run integrity is separately verified by `python3 scripts/quality/uaes-manual-acceptance.py --verify-only`.", "",
            "## 6. 有效性验证 (Effectiveness)", "",
            "- Domain-level commands are INDIRECT for individual normative statements; they do NOT prove any single requirement.",
            f"- Requirement-specific verified rows in this domain: **{results.get('PASS',0)}/{len(rows)}**.", "",
            "## 7. 不符合项 (Findings)", "",
            f"- FIND-FCA-001 (P0): UAES normative baseline not individually approved; 13 domain gates NOT_RUN.",
            f"- FIND-FCA-002 (High): {results.get('BLOCKED',0)} rows in this domain are BLOCKED by DRAFT/PROPOSED source status.",
            f"- FIND-FCA-003 (High): {results.get('NOT_ASSESSED',0)} rows lack requirement-specific verification.",
            f"- Non-PASS local evidence (unchanged, not waived): {', '.join(matrix['summary']['ma_non_pass'])}.", "",
            "## 8. 整改和复测 (Remediation & revalidation)", "",
            "- Required authorisation: UAES owner approval of DRAFT entries + execution of 13 L3 domain gates.",
            "- Required engineering: per-requirement implementation mapping + requirement-specific verification with raw evidence.",
            "- Revalidation result: **NOT REVALIDATED**. No row may be reported as PASS until the above exists.", "",
            "## Requirement extract (first 25 rows; full set in JSON)", "",
            "| Requirement ID | Source | Level | Result |", "|---|---|---|---|",
        ]
        for r in rows[:25]:
            lines.append(f"| `{r['requirement_id']}` | `{r['source_standard']}:{r['source_line']}` | {r['normative_level']} | {r['audit_result']} |")
        if len(rows) > 25:
            lines.append(f"| … | {len(rows)-25} more rows in `evidence/02-compliance-matrix.json` | | |")
        lines += ["", "---", "", "Audit result vocabulary follows §12. `BLOCKED`/`NOT ASSESSED` are never PASS.", ""]
        p = OUT / f"DOMAIN-{dom}-AUDIT.md"
        p.write_text("\n".join(lines), encoding="utf-8")
        reports.append({"domain": dom, "name": name, "file": p.name,
                        "requirements": len(rows), "results": dict(results),
                        "sha256": sha256(p)})
    jwrite(EV / "03-domain-audits.json", {"generated_at": now(), "reports": reports,
                                          "count": len(reports), "commit_sha": baseline["uter"]["commit_sha"]})


def main(argv: list[str]) -> int:
    phases = argv or ["all"]
    if "all" in phases:
        phases = ["baseline", "matrix", "domains", "deliver"]
    state = {}
    if "baseline" in phases or "matrix" in phases or "domains" in phases or "deliver" in phases:
        state["baseline"] = phase_baseline()
        print(f"[baseline] Uter {state['baseline']['uter']['commit_sha'][:12]} "
              f"UAES {state['baseline']['uaes']['commit_sha'][:12]} "
              f"DRAFT={state['baseline']['uaes_standards']['draft_files']}/{state['baseline']['uaes_standards']['md_files']}")
    if "matrix" in phases or "domains" in phases or "deliver" in phases:
        state["matrix"] = phase_matrix(state["baseline"])
        s = state["matrix"]["summary"]
        print(f"[matrix] requirements={s['total_requirements']} results={s['by_result']} "
              f"requirement_specific_verified={s['requirement_specific_verified']}")
    if "domains" in phases or "deliver" in phases:
        phase_domains(state["matrix"], state["baseline"])
        print("[domains] 14 per-domain audit reports written")
    if "deliver" in phases:
        from full_conformance_deliver import deliver
        deliver(state["baseline"], state["matrix"], ROOT, UAES, OUT, EV, LEGACY, DOMAIN_NAMES)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
