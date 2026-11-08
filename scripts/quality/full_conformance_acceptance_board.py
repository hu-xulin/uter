#!/usr/bin/env python3
"""UTER x UAES FINAL ACCEPTANCE BOARD -- §10 conditions, computed from evidence.

This is NOT a hand-written checklist. Every row is derived from an evidence file
on disk; the reviewer can re-run this script to reproduce every boolean.

Usage:
  python3 scripts/quality/full_conformance_acceptance_board.py
Exit:
  0 = all 10 acceptance conditions met (CONFORMANT eligible)
  1 = at least one condition unmet (honest aggregate, never masked)
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "reports/compliance/full-conformance-audit-2026-11-06"
EV = OUT / "evidence"
LEG = ROOT / "reports/compliance/uaes-full-migration-2026-11-06/evidence"


def jread(p: pathlib.Path, default=None):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {} if default is None else default


def build():
    msum = jread(EV / "02-compliance-matrix.json").get("summary", {})
    dom = jread(EV / "03-domain-audits.json")
    ver = jread(EV / "04-engineering-verification.json").get("summary", {})
    ag = jread(EV / "05-agent-verification.json").get("summary", {})
    gt = jread(EV / "06-gates-verification.json")
    fr = jread(EV / "07-findings-register.json")
    rem = jread(EV / "08-remediation-register.json")
    clo = jread(EV / "10-evidence-closure.json")
    fa = jread(EV / "10-final-assessment.json")
    ind = jread(LEG / "independent-assessment.json")
    ma = jread(LEG / "manual-acceptance/execution.json").get("summary", {})
    auth = jread(LEG / "manual-acceptance/acceptance-authority.json")

    applicable = msum.get("by_applicability", {}).get("APPLICABLE", 0)
    verified = msum.get("requirement_specific_verified", 0)
    blocked = msum.get("by_result", {}).get("BLOCKED", 0)
    na = msum.get("by_result", {}).get("NOT_APPLICABLE", 0)
    total_req = msum.get("total_requirements", 0)

    p0p1 = fr.get("p0_p1_open", [])
    open_findings = [f for f in fr.get("findings", []) if str(f.get("status", "")).startswith("OPEN")]
    fixes = rem.get("fixes", [])
    fixes_revalidated = [f for f in fixes if f.get("revalidation") == "PASS"]
    real_verdicts = gt.get("real_verdicts", {})
    gates_allow = [g for g, v in real_verdicts.items() if v == "ALLOW"]
    gates_block = [g for g, v in real_verdicts.items() if v == "BLOCK"]
    neg_proven = gt.get("summary", {}).get("negative_blocking_proven")
    neg_total = gt.get("summary", {}).get("negative_total")

    rows = []

    dom_count = dom.get("count", 0)
    rows.append(dict(
        n=1, name="P00–P13 全部审计完成",
        ok=(dom_count == 14),
        detail=(f"域审计 {dom_count}/14；要求登记 {total_req} 条"
                f"（适用 {applicable} + N/A {na}）"),
        evidence="evidence/03-domain-audits.json, evidence/02-compliance-matrix.json",
    ))

    judged = blocked + na
    rows.append(dict(
        n=2, name="所有适用要求均已判定",
        ok=(total_req > 0 and judged == total_req),
        detail=(f"判定覆盖 {judged}/{total_req} = "
                f"{100.0 * judged / total_req if total_req else 0:.1f}%；"
                f"结果分布 BLOCKED={blocked} / N/A={na} / PASS={verified}"),
        evidence="evidence/02-compliance-matrix.json#summary.by_result",
    ))

    rows.append(dict(
        n=3, name="强制性要求全部 PASS",
        ok=(applicable > 0 and verified >= applicable),
        detail=f"逐条 PASS = {verified} / 适用 {applicable}",
        evidence="evidence/02-compliance-matrix.json#summary.requirement_specific_verified",
    ))

    rows.append(dict(
        n=4, name="P0/P1 不符合项全部销项",
        ok=(len(p0p1) == 0),
        detail=(f"P0/P1 仍开放 {len(p0p1)} 条: {', '.join(p0p1) if p0p1 else '无'}"),
        evidence="evidence/07-findings-register.json#p0_p1_open",
    ))

    rows.append(dict(
        n=5, name="AI Agent 实际执行验证通过",
        ok=(ag.get("total", 0) > 0 and ag.get("failed") == []),
        detail=f"Agent 用例 {ag.get('passed')}/{ag.get('total')} PASS，failed={ag.get('failed')}",
        evidence="evidence/05-agent-verification.json",
    ))

    rows.append(dict(
        n=6, name="质量和安全验证通过",
        ok=(ver.get("re_run_fail", 1) == 0
            and ver.get("re_run_total", 0) > 0
            and real_verdicts.get("SECURITY_GATE") == "ALLOW"),
        detail=(f"本地可执行 {ver.get('re_run_pass')}/{ver.get('re_run_total')} PASS；"
                f"NOT_RUN {ver.get('not_run_total')} 项需授权环境；"
                f"EXECUTED_NOT_PASS {ver.get('executed_not_pass_total', 0)} 项"
                f"（{', '.join(ver.get('executed_not_pass_ids', [])) or '无'}）；"
                f"SECURITY_GATE={real_verdicts.get('SECURITY_GATE')}"),
        evidence="evidence/04-engineering-verification.json, evidence/06-gates-verification.json",
    ))

    rows.append(dict(
        n=7, name="CI/CD 门禁阻断测试通过",
        ok=(neg_proven == neg_total and neg_total not in (None, 0)
            and len(gates_block) == 0),
        detail=(f"负向阻断 {neg_proven}/{neg_total} 已证实；"
                f"门禁 ALLOW {len(gates_allow)}/8，BLOCK: {', '.join(gates_block) if gates_block else '无'}"),
        evidence="evidence/06-gates-verification.json",
    ))

    rows.append(dict(
        n=8, name="整改项全部完成复测",
        ok=(not open_findings and len(fixes_revalidated) == len(fixes) and len(fixes) > 0),
        detail=(f"FIX 已复测 {len(fixes_revalidated)}/{len(fixes)}；"
                f"仍 OPEN 的 finding {len(open_findings)} 条: "
                f"{', '.join(f.get('id', '?') for f in open_findings) if open_findings else '无'}"),
        evidence="evidence/08-remediation-register.json, evidence/07-findings-register.json",
    ))

    files = clo.get("evidence_files", [])
    listed = clo.get("total_listed", len(files))
    missing = [f for f in files if f.get("exists") is False or f.get("missing")]
    hash_mm = [f for f in files if f.get("sha256_match") is False]
    size_mm = [f for f in files if f.get("size_match") is False]
    problems = clo.get("problems", [])
    rows.append(dict(
        n=9, name="证据完整且可追溯",
        ok=(len(missing) == 0 and len(hash_mm) == 0 and len(size_mm) == 0
            and len(problems) == 0 and listed > 0),
        detail=(f"证据闭包 total_listed={listed} missing={len(missing)} "
                f"hash_mismatch={len(hash_mm)} size_mismatch={len(size_mm)} problems={len(problems)}"),
        evidence="evidence/10-evidence-closure.json",
    ))

    ind_ok = ind.get("verdict", {}).get("conformance_claim_supported") is True
    collector = ind.get("collector") or ind.get("assessor") or "WorkBuddy (self)"
    rows.append(dict(
        n=10, name="独立复核通过",
        ok=ind_ok,
        detail=(f"独立评估 conformance_claim_supported={ind_ok}；"
                f"执行者={collector}（须为未参与整改的第三方人员签署）"),
        evidence="uaes-full-migration-2026-11-06/evidence/independent-assessment.json",
    ))

    met = [r["n"] for r in rows if r["ok"]]
    return dict(
        rows=rows, met=met, unmet=[r["n"] for r in rows if not r["ok"]],
        verdict=fa.get("final_verdict"),
        verdict_conditions=f"{len(fa.get('met', []))}/{len(fa.get('met', [])) + len(fa.get('unmet', []))}",
        ma=ma, signoff=auth.get("signoff_granted"),
        commit=jread(EV / "00-baseline.json").get("uter", {}).get("commit_sha"),
    )


def render(b: dict) -> str:
    lines = ["# UTER × UAES 最终验收看板（由证据实时计算）", "",
             f"- 生成方式：`scripts/quality/full_conformance_acceptance_board.py`（可重跑复核）",
             f"- Uter commit SHA：`{b['commit']}`",
             f"- 达成：**{len(b['met'])}/10**",
             f"- §10 最终评估条件：**{b['verdict_conditions']}**，结论 `{b['verdict']}`",
             f"- 人工验收执行：{b['ma'].get('PASS')}/{b['ma'].get('total')} PASS",
             f"· `signoff_granted` = {b['signoff']}",
             "", "| # | 验收条件 | 达成 | 实测依据 | 证据文件 |", "|---|---|---|---|---|"]
    for r in b["rows"]:
        mark = "✅" if r["ok"] else "❌"
        lines.append(f"| {r['n']} | {r['name']} | {mark} | {r['detail']} | `{r['evidence']}` |")
    lines += ["", f"未达成：{b['unmet'] if b['unmet'] else '无'}", "",
              "> 本看板勾选不代表已取得工程证据以外的结论；每行均绑定磁盘证据文件。",
              "> 任何 BLOCKED / NOT_RUN 均不得计为 PASS。"]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    b = build()
    text = render(b)
    p = OUT / "00-ACCEPTANCE-BOARD.md"
    p.write_text(text, encoding="utf-8")
    print(text)
    print(f"written: {p}")
    sys.exit(0 if not b["unmet"] else 1)