#!/usr/bin/env python3
"""FULL CONFORMANCE AUDIT & ACCEPTANCE -- §9 / §10 / §11 / §12 deliverables.

Produces the 14 mandated deliverables from REAL on-disk evidence only. It never
promotes BLOCKED / NOT_RUN / NOT ASSESSED to PASS, and never emits CONFORMANT
unless every §10 condition is met by evidence.

Standalone verification for an independent reviewer:
  python3 scripts/quality/full_conformance_deliver.py --verify-only
"""
from __future__ import annotations

import csv
import hashlib
import json
import pathlib
import platform
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "reports/compliance/full-conformance-audit-2026-11-06"
EV = OUT / "evidence"
LEGACY = ROOT / "reports/compliance/uaes-full-migration-2026-11-06/evidence"
MA = LEGACY / "manual-acceptance"
UAES = pathlib.Path("/Users/lincolnhu/uaes")

DOMAIN_NAMES = {
    "00": "Foundation", "01": "AI Governance", "02": "Product Engineering",
    "03": "Knowledge Engineering", "04": "System Architecture",
    "05": "Experience & Design Engineering", "06": "Software Engineering",
    "07": "Cross-Platform Engineering", "08": "AI Agent Engineering",
    "09": "Quality Engineering", "10": "Security & Reliability",
    "11": "DevOps & Delivery", "12": "Lifecycle & Evolution",
    "13": "UTER Business Domain Engineering",
}

D_FILES = [
    "01-FULL-COMPLIANCE-MATRIX.md",
    "02-P00-P13-DOMAIN-AUDITS.md",
    "03-EXTERNAL-STANDARDS-MAPPING.md",
    "04-AI-AGENT-EXECUTION-REPORT.md",
    "05-ARCHITECTURE-COMPLIANCE-REPORT.md",
    "06-SOFTWARE-QUALITY-AUDIT-REPORT.md",
    "07-SECURITY-RELIABILITY-AUDIT-REPORT.md",
    "08-TEST-EXECUTION-REPORT.md",
    "09-CICD-GATE-VERIFICATION-REPORT.md",
    "10-NONCONFORMITIES-AND-RISKS.md",
    "11-REMEDIATION-AND-REVALIDATION.md",
    "12-FINAL-EVIDENCE-INDEX.md",
    "13-FINAL-CONFORMANCE-ASSESSMENT.md",
    "14-OPEN-ITEMS-AND-EXCEPTIONS.md",
]

EXTERNAL_STANDARDS = [
    ("ISO/IEC/IEEE 12207", "Software lifecycle processes", "P11 / P12"),
    ("ISO/IEC/IEEE 15288", "System lifecycle processes, where applicable", "P04 / P12"),
    ("ISO/IEC 25010", "Product quality model", "P09"),
    ("ISO/IEC 25040", "Product quality evaluation", "P09"),
    ("ISO/IEC 9001", "Quality management system, where adopted", "P09"),
    ("ISO/IEC 27001", "Information security management system", "P10"),
    ("ISO/IEC 27002", "Information security controls guidance", "P10"),
    ("ISO/IEC 27005", "Information security risk management", "P10"),
    ("ISO/IEC 27701", "Privacy information management, where applicable", "P10"),
    ("ISO/IEC 42001", "Artificial intelligence management system", "P01 / P08"),
    ("ISO/IEC 23894", "AI risk management guidance", "P01 / P08"),
    ("ISO/IEC/IEEE 29119", "Software testing", "P09"),
    ("ISO/IEC/IEEE 20246", "Software review", "P06 / P09"),
    ("ISO/IEC/IEEE 25023", "Software product quality measurement", "P09"),
    ("ISO/IEC/IEEE 16085", "Risk management in lifecycle processes", "P10 / P12"),
    ("NIST CSF 2.0", "Cybersecurity risk management", "P10"),
    ("NIST SP 800-218", "Secure Software Development Framework", "P10 / P11"),
    ("NIST AI RMF 1.0", "AI risk management", "P01 / P08"),
    ("OWASP ASVS", "Application security verification", "P10"),
    ("OWASP SAMM", "Software assurance maturity", "P10 / P09"),
    ("OWASP Top 10", "Application security risk awareness", "P10"),
    ("SLSA", "Software supply chain security", "P11"),
    ("OpenSSF", "Open-source software security practices", "P10 / P11"),
    ("WCAG 2.2", "Web accessibility", "P05"),
    ("W3C WAI-ARIA", "Accessible interface semantics", "P05"),
]


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256(p: pathlib.Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else ""


def jread(path: pathlib.Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {} if default is None else default


def jwrite(path: pathlib.Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def md(name: str, text: str) -> pathlib.Path:
    p = OUT / name
    p.write_text(text.rstrip() + "\n", encoding="utf-8")
    return p


def head(title: str, section: str, commit: str) -> str:
    return (f"# {title}\n\n"
            f"- **Document:** `{section}` of §11 (14 mandated deliverables)\n"
            f"- **Generated:** {now()}\n"
            f"- **Uter commit SHA:** `{commit}`\n"
            f"- **UAES commit SHA:** `{jread(EV / '00-baseline.json', {}).get('uaes', {}).get('commit_sha', 'UNKNOWN')}`\n"
            f"- **Execution environment:** {platform.platform()}\n"
            f"- **Collector:** WorkBuddy (Tencent Hunyuan Hy)\n"
            f"- **Evidence root:** `reports/compliance/full-conformance-audit-2026-11-06/evidence/`\n\n"
            f"> 本文件由真实仓库状态与真实命令退出码生成。未执行的验证一律记为 `NOT_RUN` / `BLOCKED`，\n"
            f"> 绝不以文档、代码改动或 Agent 自述代替工程验证（§12 / §13）。\n\n---\n\n")


def table(headers: list[str], rows: list[list]) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(x).replace("|", "\\|").replace("\n", " ") for x in r) + " |")
    return "\n".join(out) + "\n"


# ------------------------------------------------------------------ registers
def build_findings(baseline: dict, matrix: dict, verify: dict, gates: dict,
                   agent: dict, legacy: dict) -> dict:
    s = matrix["summary"]
    ma_exec = jread(MA / "execution.json", {})
    ma_find = jread(MA / "findings.json", {})
    indep = jread(LEGACY / "independent-assessment.json", {})
    l3 = jread(LEGACY / "gates/l3-domain-gates.json", {})
    l4 = jread(LEGACY / "gates/l4-global-gate.json", {})
    inv = jread(MA / "inventory.json", {})
    auth = jread(MA / "acceptance-authority.json", {})
    non_pass = [c for c in ma_exec.get("cases", []) if c.get("status") != "PASS"]
    items = [
        {"id": "FIND-FCA-001", "severity": "P0", "status": "RESOLVED / EVIDENCE-LIMITED",
         "title": "UAES 规范性基线未被逐条批准，无法作为正式符合性基准",
         "location": "UAES commit `0c9386b`（2026-11-07 01:28 +0800）`feat(governance): approve all 178 UAES normative standards (v1.10.0)`；`standards/**` 178/178 APPROVED",
         "evidence": ["evidence/00-baseline.json", "evidence/01-conflict-register.json (CONF-005)"],
         "root_cause": "此前 Registry 1.9.0 只批准了注册表基线，178 个标准文件中 2851 条要求仍为 DRAFT。",
         "impact": f"基线阻塞已解除：DRAFT 0/178，BLOCKED {s['by_result'].get('BLOCKED', 0)} 条（仅余 UTER-P13 的 PROPOSED_BASELINE 29 条）。",
         "corrective_action": ("已由 Owner 授权并完成批准（UAES commit 0c9386b）。**但批准不产生 PASS**："
                              "矩阵判定逻辑对 APPROVED 且无逐条证据的要求返回 NOT_ASSESSED，"
                              f"故 requirement_specific_verified 仍为 {s['requirement_specific_verified']}。"
                              "真正的符合性缺口转入 FIND-FCA-002。"),
         "required_authorization": "已获授权并执行", "revalidation": "REVALIDATED: DRAFT 2851→0，BLOCKED→29，NOT_ASSESSED 2843"},
        {"id": "FIND-FCA-002", "severity": "P1", "status": "OPEN",
         "title": "无逐条实现映射与逐条验证，requirement-specific PASS 为 0",
         "location": "evidence/02-compliance-matrix.json 的 implementation_location / verification_method 字段",
         "evidence": ["evidence/02-compliance-matrix.json", "evidence/04-engineering-verification.json"],
         "root_cause": "仓库只有域级命令与域级门禁；域级命令对单条规范只是 INDIRECT 证据，不能证明任何单条要求。批准基线只把 BLOCKED 变成 NOT_ASSESSED，不产生 PASS。",
         "impact": f"{s['total_requirements']} 条要求中逐条验证数为 {s['requirement_specific_verified']}；任何单条 PASS 均无证据支撑。",
         "corrective_action": "为每条适用要求建立 implementation mapping + requirement-specific verification case + 原始退出码证据。",
         "required_authorization": "项目 Owner 排期 / 工程资源", "revalidation": "NOT REVALIDATED"},
        {"id": "FIND-FCA-003", "severity": "P1", "status": "RESOLVED / DELEGATED_SIGNOFF",
         "title": "42 项人工验收未被验收负责人逐项接受",
         "location": "evidence/manual-acceptance/inventory.json、acceptance-authority.json",
         "evidence": ["reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/inventory.json",
                      "reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/acceptance-authority.json"],
         "root_cause": "用户此前明确「等我逐项复核后决定」，故 signoff_granted=false。",
         "impact": (f"2026-11-07 Owner 授权代签：item_count={inv.get('item_count')}，"
                    f"全部签署，signoff_granted={auth.get('signoff_granted')}，"
                    f"signoff_nature={auth.get('signoff_nature')}。"),
         "corrective_action": ("已按 Owner 书面授权完成签署，每条记录标记 signoff_nature=DELEGATED。"
                               "**这不是**「Owner 已逐项人工复核」的声明；独立复核者须按 "
                               "DELEGATED_SIGNOFF 而非 HUMAN_REVIEWED_SIGNOFF 对待。"),
         "required_authorization": "已获授权并执行", "revalidation": "REVALIDATED: 42/42 signed, nature=DELEGATED"},
        {"id": "FIND-FCA-004", "severity": "P1", "status": "OPEN",
         "title": "需要授权运行环境的安全/可靠性验证仍未执行（本地可修复部分已闭环）",
         "location": "DAST / 渗透 / API 安全 / 三库迁移 / DR / 备份恢复 / 性能测试 NOT_RUN；鉴权页 axe 扫描因管理员禁用密码登录而显式 skip",
         "evidence": ["evidence/04-engineering-verification.json", "evidence/06-gates-verification.json",
                      "reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/findings.json",
                      "web/e2e/axe/authed.spec.ts"],
         "root_cause": "这些验证需要授权运行环境（DAST 工具、三库环境、真实备份目标、压力负载）或产品侧会话配置；本地已无工具链类阻塞（axe 已安装并真实执行）。",
         "impact": "SECURITY_GATE BLOCK；§6 多项要求不可判定。本地可修复项（MA-06/MA-12）已在本轮闭环并复测。",
         "corrective_action": "由授权环境执行 DAST/渗透/三库迁移/DR/备份恢复/性能验证；鉴权页 axe 扫描需产品开放密码登录或提供 OAuth 测试会话。",
         "required_authorization": "安全测试授权 / 运行环境 / 产品会话配置", "revalidation": "PARTIAL: local toolchain items revalidated PASS"},
        {"id": "FIND-FCA-005", "severity": "P2", "status": "FIXED / REVALIDATED",
         "title": "构建与静态分析既有失败已全部闭环（无断言放宽、无豁免）",
         "location": "MA-09 knip、MA-10 docs-web build、MA-11 electron build；修复记录见 evidence/08-remediation-register.json FIX-06..FIX-08",
         "evidence": ["evidence/04-engineering-verification.json",
                      "reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/execution.json",
                      "reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-10.log",
                      "reports/compliance/uaes-full-migration-2026-11-06/evidence/manual-acceptance/MA-11.log"],
         "root_cause": "MA-09 knip 复跑 PASS（本审计未做任何清理动作）；MA-10 受宿主 safe-delete 批量删除拦截（旧 .next 产物）；MA-11 为 Electron 运行时下载网络超时（镜像吞吐 ~47KB/s，撞 600s 请求超时）。",
         "impact": "三项均以原始命令真实复跑 PASS；未删测试、未放宽断言、未改写状态。",
         "corrective_action": "FIX-06 mv 卫生预置；FIX-07 8 路并行续传下载并 SHA-256 校验后种子 @electron/get 缓存；FIX-08 安装 axe 工具链并修复真实违规。",
         "required_authorization": "无（用户已裁定环境修复路径）", "revalidation": "REVALIDATED: collector final run all local checks PASS"},
        {"id": "FIND-FCA-006", "severity": "P2", "status": "FIXED / REVALIDATED",
         "title": "本轮审计引擎 4 个真实缺陷（漏记中文要求、状态解析、P13 空域、commit 绑定）",
         "location": "scripts/quality/full-conformance-audit.py",
         "evidence": ["evidence/bugfix/02-compliance-matrix.BEFORE.json",
                      "evidence/bugfix/02-compliance-matrix.AFTER.json",
                      "evidence/01-conflict-register.json (CONF-007)"],
         "root_cause": "初版只匹配英文 MUST/SHALL；只解析 `**Status:**`；P13 为中文；D19 使用 `uter_commit` 键。",
         "impact": f"要求数 1592 → {s['total_requirements']}；DRAFT 45/178 → 178/178；P13 0 → {s['by_domain'].get('UTER-P13', 0)}；matrix_commit_sha 由 null 变为真实 SHA。",
         "corrective_action": "已修复：双语匹配 + SHOULD + 引用行、standard_meta()、P13 中文抽取、uter_commit 绑定；覆盖账本逐行对账。",
         "required_authorization": "无（Uter 侧工具缺陷）", "revalidation": "REVALIDATED: py_compile OK + 三次真实重跑 + BEFORE/AFTER hash"},
        {"id": "FIND-FCA-007", "severity": "P2", "status": "DISCLOSED / SUPERSEDED",
         "title": "历史报告 reports/compliance/FINAL-COMPLIANCE-REPORT.md 状态过期",
         "location": "reports/compliance/FINAL-COMPLIANCE-REPORT.md",
         "evidence": ["evidence/01-conflict-register.json (CONF-004)"],
         "root_cause": "该报告基于 PR #15 基线写 UAES registry DRAFT / 13 gates NOT_RUN。",
         "impact": "不改写历史证据；新审计包以当前真实基线为准。",
         "corrective_action": "标记 SUPERSEDED，保留原文以供复核。",
         "required_authorization": "无", "revalidation": "DISCLOSURE VERIFIED"},
        {"id": "FIND-FCA-008", "severity": "P3", "status": "DISCLOSED",
         "title": "UAES reports/ 下历史 UAES-P13-* 命名易与 UTER P13 混淆",
         "location": "UAES 仓库 reports/（非 standards/、非 .uaes/registry/）",
         "evidence": ["reports/compliance/uaes-full-migration-2026-11-06/evidence/governance-separation.json"],
         "root_cause": "Repository Integration 阶段派生报告的历史命名。",
         "impact": "UAES 通用规范目录中 P13 命中为 0；不违反双仓库分别治理。",
         "corrective_action": "不修改 UAES 仓库（含 5 项未提交用户修改）；仅披露并持续由分离门禁监控。",
         "required_authorization": "UAES Owner", "revalidation": "MONITORED BY GATE"},
        {"id": "FIND-FCA-009", "severity": "P1", "status": "OPEN",
         "title": "14 域 L3 与 L4 全局门禁仍 BLOCKED",
         "location": "gates/l3-domain-gates.json、gates/l4-global-gate.json",
         "evidence": ["reports/compliance/uaes-full-migration-2026-11-06/evidence/gates/l3-domain-gates.json",
                      "reports/compliance/uaes-full-migration-2026-11-06/evidence/gates/l4-global-gate.json"],
         "root_cause": f"L3 pass_count={l3.get('pass_count')}/14；L4 status={l4.get('status')}，{l4.get('not_met')} 条未满足。",
         "impact": "RELEASE_GATE / GLOBAL_UAES_CONFORMANCE_GATE 阻断；禁止 commit/push/PR/merge/deploy。",
         "corrective_action": "完成 14 域人工验收与逐条验证后重跑门禁。",
         "required_authorization": "验收负责人 + UAES Owner", "revalidation": "NOT REVALIDATED"},
        {"id": "FIND-FCA-010", "severity": "P3", "status": "CLOSED BY JUSTIFICATION",
         "title": f"{s['by_result'].get('NOT_APPLICABLE', 0)} 条 N/A 引用行",
         "location": "evidence/02-compliance-matrix.json (keyword_class=REFERENCE_ROW)",
         "evidence": ["evidence/02-compliance-matrix.json"],
         "root_cause": "交叉引用索引行带 native UAES ID 但无规范性谓词。",
         "impact": "不构成义务；每条均附书面适用性依据（§10）。",
         "corrective_action": "已记录且不跳过；无进一步整改。",
         "required_authorization": "无", "revalidation": "JUSTIFICATION RECORDED"},
        {"id": "FIND-FCA-011", "severity": "P1", "status": "OPEN",
         "title": "八类质量门禁中存在 BLOCK 结果",
         "location": "evidence/06-gates-verification.json",
         "evidence": ["evidence/06-gates-verification.json"],
         "root_cause": f"real BLOCK gates = {gates.get('summary', {}).get('gates_BLOCK', [])}",
         "impact": "§8 门禁未全部放行；每个门禁的负向阻断测试已真实执行。",
         "corrective_action": "按 FIND-FCA-001..009 逐项解除后重跑八类门禁。",
         "required_authorization": "同上", "revalidation": "NEGATIVE BLOCKING TESTS EXECUTED"},
        {"id": "FIND-FCA-012", "severity": "P2", "status": "FIXED / REVALIDATED",
         "title": "审计执行层 harness() 无法解析纯文本子命令输出，AG-07/08/09 被误判 FAIL",
         "location": "scripts/quality/full-conformance-execution.py harness()；evidence/bugfix/05-agent-verification.BEFORE.json / AFTER.json",
         "evidence": ["evidence/bugfix/05-agent-verification.BEFORE.json",
                      "evidence/bugfix/05-agent-verification.AFTER.json",
                      "evidence/05-agent-verification.json"],
         "root_cause": "workspace/selftest/verify 子命令输出纯文本而非 JSON；harness() 只尝试 stdout 内联 JSON 解析，未回退读取 harness 写出的结构化证据文件（agent-runtime-workspace.json 等），导致 3 个实际 PASS 的用例被审计器自身误记为 FAIL。",
         "impact": "修复前 agent 10 例 7 PASS / 3 FAIL（全部为解析误判，非真实绕过）；底层控制全部有效（两个绕过尝试均被 DENY exit 2）。",
         "corrective_action": "harness() 增加 `evidence: <path>` 回退解析；重跑 agent 与 gates 阶段，agent 10/10 PASS、负向阻断 8/8 证实。",
         "required_authorization": "无（审计器自身缺陷）", "revalidation": "REVALIDATED: agent cases=10 passed=10 failed=[]"},
        {"id": "FIND-FCA-013", "severity": "P2", "status": "OPEN / EXTERNAL ACTION",
         "title": "执行分支出现完整验证前的 commit（非本审计会话所为），workspace W3 保持 fail-closed FAIL",
         "location": "commit ec6501adc（HEAD 领先 main 1 个提交）；scripts/quality/uaes-agent-runtime-check.rb W3（HEAD == main）",
         "evidence": ["reports/compliance/full-conformance-audit-2026-11-06/evidence/agent/agent-runtime-workspace.json",
                      "reports/compliance/full-conformance-audit-2026-11-06/evidence/agent-runtime-task.json"],
         "root_cause": "2026-11-06 17:12:30，用户账号（Uter.ai <huxulin.hxl@gmail.com>）通过并行会话提交 ec6501adc「fix(governance): abbreviate commit SHA misdetected as API key by gitleaks」——内容正是 MA-06 gitleaks 误报的正式修复（缩短审计文档中的完整 SHA 并提交）。本审计会话自始至终零 commit；依并发红线不得 reset/merge 撤销他人提交，W3 断言亦不得放宽。",
         "impact": "workspace W3 FAIL → 矩阵 L1-16 FAIL → L1 17/18；L1/L2 层因此未能全绿。交付门禁保持关闭（无 push/PR）。",
         "corrective_action": "由用户裁定其一：① 授权该 commit 作为执行基线的一部分并相应更新 W3 判定基线；② 撤销该 commit 后重跑。两者均超出本会话权限。",
         "required_authorization": "项目 Owner（用户本人）", "revalidation": "NOT REVALIDATED"},
    ]
    return {"evidence_id": "FCA-FINDINGS-REGISTER", "generated_at": now(),
            "commit_sha": baseline["uter"]["commit_sha"],
            "policy": {"waiver_granted": False, "allowlist_modified": False,
                       "assertion_relaxed": False, "status_rewritten": False,
                       "auto_promotion_to_verified": False},
            "prior_open_findings": indep.get("open_findings", []),
            "prior_manual_non_pass": [{"id": c.get("evidence_id"), "status": c.get("status")} for c in non_pass],
            "prior_findings_disclosed": ma_find.get("findings", []),
            "findings": items,
            "count": len(items),
            "p0_p1_open": [f["id"] for f in items if f["severity"] in ("P0", "P1") and f["status"] == "OPEN"]}


def build_remediation(baseline: dict, matrix: dict) -> dict:
    before = jread(EV / "bugfix/02-compliance-matrix.BEFORE.json", {})
    after = jread(EV / "bugfix/02-compliance-matrix.AFTER.json", {})
    b, a = before.get("summary", {}), after.get("summary", {})
    fixes = [
        {"fix_id": "FIX-01", "finding_id": "FIND-FCA-006", "defect": "只匹配英文 MUST/SHALL，1333 行中文强制性语句被漏记",
         "file": "scripts/quality/full-conformance-audit.py",
         "change": "新增 CN_NORMATIVE(不得|必须|禁止|严禁|应当|不应) + SHOULD + native-ID 引用行匹配，并输出逐行覆盖账本",
         "before": f"CN_MANDATORY={b.get('by_keyword_class', {}).get('CN_MANDATORY', 0)}",
         "after": f"CN_MANDATORY={a.get('by_keyword_class', {}).get('CN_MANDATORY', 0)}",
         "risk": "只增加记录，不改变任何业务代码或断言", "revalidation": "PASS"},
        {"fix_id": "FIX-02", "finding_id": "FIND-FCA-006", "defect": "只解析 **Status:**，133/178 个表格头标准被判 MISSING",
         "file": "scripts/quality/full-conformance-audit.py",
         "change": "shared standard_meta() 同时支持 bold 与 `| Status | `DRAFT` |` 表头",
         "before": f"MISSING={b.get('by_source_status', {}).get('MISSING', 0)} DRAFT标准={b.get('uaes_draft_standard_files', 45)}/178",
         "after": f"MISSING={a.get('by_source_status', {}).get('MISSING', 0)} DRAFT标准={a.get('uaes_draft_standard_files', 178)}/178",
         "risk": "只读解析修正；暴露了更严重的真实基线限制", "revalidation": "PASS"},
        {"fix_id": "FIX-03", "finding_id": "FIND-FCA-006", "defect": "UTER P13 中文规范产生 0 条要求，14 域实际只有 13 域有内容",
         "file": "scripts/quality/full-conformance-audit.py",
         "change": "P13 使用同一双语匹配器，并读取其 PROPOSED_BASELINE 真实状态",
         "before": f"UTER-P13={b.get('by_domain', {}).get('UTER-P13', 0)}",
         "after": f"UTER-P13={a.get('by_domain', {}).get('UTER-P13', 0)}",
         "risk": "无", "revalidation": "PASS"},
        {"fix_id": "FIX-04", "finding_id": "FIND-FCA-006", "defect": "matrix_commit_sha 读到 null（真实键为 uter_commit）",
         "file": "scripts/quality/full-conformance-audit.py",
         "change": "real_evidence_index() 依次读取 uter_commit / commit_sha / repository_revision",
         "before": f"matrix_commit_sha={b.get('matrix_commit_sha')}",
         "after": f"matrix_commit_sha={a.get('matrix_commit_sha')}",
         "risk": "证据现在可绑定到真实 Commit SHA", "revalidation": "PASS"},
        {"fix_id": "FIX-05", "finding_id": "FIND-FCA-012", "defect": "harness() 无法解析 workspace/selftest/verify 纯文本输出，AG-07/08/09 实际 PASS 被误判 FAIL",
         "file": "scripts/quality/full-conformance-execution.py",
         "change": "harness() 增加证据文件回退解析（`evidence:` 行指向 harness 写出的结构化 JSON）",
         "before": f"agent passed={jread(EV / 'bugfix/05-agent-verification.BEFORE.json', {}).get('summary', {}).get('passed', '?')}/{jread(EV / 'bugfix/05-agent-verification.BEFORE.json', {}).get('summary', {}).get('total', '?')}",
         "after": f"agent passed={jread(EV / '05-agent-verification.json', {}).get('summary', {}).get('passed', '?')}/{jread(EV / '05-agent-verification.json', {}).get('summary', {}).get('total', '?')}",
         "risk": "仅修正审计器自身解析；底层 harness 与被测控制未改动", "revalidation": "PASS"},
        {"fix_id": "FIX-06", "finding_id": "FIND-FCA-005", "defect": "MA-10 docs-web 构建被宿主 safe-delete 批量删除拦截（旧 .next 产物 >50 文件）",
         "file": "environment (docs-web/.next, docs-web/out)",
         "change": "构建前用 mv 把旧产物移出工作区（与 uaes-test-matrix.sh L2-07 build hygiene 同一既有策略）；MA-10 命令与断言零改动、未绕过 shim",
         "before": "MA-10 exit 1（SAFE_DELETE_BULK_CONFIRM_REQUIRED）",
         "after": "MA-10 exit 0（Next 构建 + postbuild copy-to-web 全链路成功）",
         "risk": "无", "revalidation": "PASS"},
        {"fix_id": "FIX-07", "finding_id": "FIND-FCA-005", "defect": "MA-11 electron 构建超时：镜像吞吐 ~47KB/s，125MB 的 Electron 运行时必撞 600s 请求超时",
         "file": "environment (@electron/get cache: ~/Library/Caches/electron/<sha256(dirname(url))>)",
         "change": "8 路并行分段续传下载 electron-v42.11.18-darwin-x64.zip（125627718 字节，与 SHASUMS256.txt SHA-256 匹配 bcbb66d3...）+ SHASUMS256.txt 种子缓存；MA-11 原始命令 `npx electron-builder --dir` 零改动、零 env 依赖地命中缓存离线完成",
         "before": "MA-11 exit 1（Timeout awaiting request for 600000ms）",
         "after": "MA-11 exit 0，产物 electron/dist/mac/Uter.app",
         "risk": "缓存内容经官方 SHASUMS256.txt 校验；未修改任何项目文件", "revalidation": "PASS"},
        {"fix_id": "FIX-08", "finding_id": "FIND-FCA-004", "defect": "MA-12 axe 工具链缺失（NOT_RUN）且无可访问性测试资产",
         "file": "web/package.json (test:axe)、web/e2e/axe/*（4 个新文件）、docs-web/src/lib/docs-search.tsx",
         "change": "安装 axe-core 4.14.0 + @axe-core/playwright 4.14.0；新建真实扫描套件（13 公开页逐页 + 鉴权页批量，复用 visual 轨的服务门禁/软锚点/动画等待约定，critical/serious 阻断）；扫描发现真实 serious 违规并修复：docs 侧栏搜索按钮 kbd 可见文本不在 aria-label 内（label-content-name-mismatch，WCAG 2.5.3），以 aria-hidden 标注装饰性键位提示后重建 docs-web（654 页）",
         "before": "MA-12 NOT_RUN；首次真实扫描 10 failed / 4 passed",
         "after": "MA-12 PASS（工具链在位）；复扫 8 passed / 1 skipped / 0 failed（唯一 skip 为鉴权轨：管理员禁用密码登录，显式 skip 并注明原因，非假通过）",
         "risk": "新增 devDependencies 与测试文件；未改动业务组件逻辑（仅 docs-search.tsx 一处 aria 属性）", "revalidation": "PASS"},
        {"fix_id": "FIX-09", "finding_id": "FIND-FCA-004", "defect": "MA-06 gitleaks 旧轮记录的命中（完整 SHA 行）在当前 HEAD 已不存在",
         "file": "无改动（纯复验）",
         "change": "核实 HEAD 第 62 行已是短 SHA `4aa9c0849` 且工作区与 HEAD 无 diff；旧 observed 为上一轮运行时的过期内容。重跑 gitleaks 扫描 HEAD 树 PASS。未豁免、未改 allowlist、未修改审计文档。（后续用户/并行会话以 commit ec6501adc 将该修复正式提交入库）",
         "before": "旧 findings.json 记录 MA-06 FAIL（1 leak）",
         "after": "MA-06 exit 0（HEAD 树 0 leak）",
         "risk": "无", "revalidation": "PASS"},
    ]
    return {"evidence_id": "FCA-REMEDIATION-REGISTER", "generated_at": now(),
            "commit_sha": baseline["uter"]["commit_sha"],
            "before_sha256": sha256(EV / "bugfix/02-compliance-matrix.BEFORE.json"),
            "after_sha256": sha256(EV / "bugfix/02-compliance-matrix.AFTER.json"),
            "coverage_ledger": a.get("coverage_ledger", {}),
            "revalidation_commands": [
                "python3 -m py_compile scripts/quality/full-conformance-audit.py",
                "python3 scripts/quality/full-conformance-audit.py baseline matrix domains",
                "python3 scripts/quality/full-conformance-execution.py all",
            ],
            "policy": {"production_change": False, "user_wip_overwritten": False,
                       "test_deleted": False, "assertion_relaxed": False,
                       "exit_code_rewritten": False, "failed_result_hidden": False},
            "not_auto_fixed": [
                {"finding_id": "FIND-FCA-001", "reason": "UAES 规范批准属于 UAES Owner 权限；双仓库分别治理", "risk": "越权修改通用标准", "required_authorization": "UAES Owner"},
                {"finding_id": "FIND-FCA-003", "reason": "人工验收接受权属于用户本人，且用户明确要求逐项复核", "risk": "代签导致虚假合规", "required_authorization": "项目 Owner"},
                {"finding_id": "FIND-FCA-004", "reason": "DAST/渗透/三库/DR 需授权运行环境；MA-06 误报需负责人裁定", "risk": "越出风险边界 / 自动豁免", "required_authorization": "安全授权 + 负责人裁定"},
                {"finding_id": "FIND-FCA-005", "reason": "批量删除 unused files 会触碰用户 WIP 与运营数据，且不得靠放宽规则关闭", "risk": "不可逆数据丢失", "required_authorization": "项目 Owner 逐项确认"},
                {"finding_id": "FIND-FCA-013", "reason": "commit ec6501adc 由用户并行会话创建（MA-06 正式修复）；撤销需 reset、接受需更新 W3 基线，均超出本会话权限", "risk": "破坏他人提交 / 放宽门禁断言", "required_authorization": "项目 Owner（用户本人）裁定"},
            ],
            "fixes": fixes}


# ------------------------------------------------------------------ deliverables
def deliver(baseline: dict, matrix: dict, root: pathlib.Path, uaes: pathlib.Path,
            out: pathlib.Path, ev: pathlib.Path, legacy: pathlib.Path,
            domain_names: dict) -> None:
    global ROOT, OUT, EV, LEGACY, MA, UAES
    ROOT, OUT, EV, LEGACY, UAES = root, out, ev, legacy, uaes
    MA = legacy / "manual-acceptance"
    verify = jread(EV / "04-engineering-verification.json", {})
    agent = jread(EV / "05-agent-verification.json", {})
    gates = jread(EV / "06-gates-verification.json", {})
    conflicts = jread(EV / "01-conflict-register.json", {})
    domains = jread(EV / "03-domain-audits.json", {})
    commit = baseline["uter"]["commit_sha"]
    s = matrix["summary"]
    legacy_data = {"independent": jread(LEGACY / "independent-assessment.json", {})}

    findings = build_findings(baseline, matrix, verify, gates, agent, legacy_data)
    remediation = build_remediation(baseline, matrix)
    jwrite(EV / "07-findings-register.json", findings)
    jwrite(EV / "08-remediation-register.json", remediation)

    # ---- CSV export of ALL requirement rows (independent re-verification)
    fields = ["requirement_id", "uaes_domain", "requirement_description", "source_standard",
              "source_line", "source_version", "source_status", "normative_level", "keyword_class",
              "applicability", "applicability_justification", "implementation_location",
              "verification_method", "acceptance_criteria", "evidence_location", "audit_result",
              "finding_id", "corrective_action", "revalidation_result", "commit_sha",
              "linked_real_commands"]
    with (EV / "matrix-export.csv").open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in matrix["requirements"]:
            row = dict(r)
            row["linked_real_commands"] = ";".join(r.get("linked_real_commands", []))
            w.writerow(row)

    # ---- 01 full compliance matrix
    cov = s.get("coverage_ledger", {}).get("totals", {})
    scanned = cov.get("lines_scanned", 0)
    accounted = sum(v for k, v in cov.items() if k != "lines_scanned")
    md(D_FILES[0], head("UAES × Uter 全量符合性矩阵", "1/14", commit) + f"""
## 1. 结论摘要

| 指标 | 值 |
|---|---|
| 唯一 Requirement ID 总数 | **{s['total_requirements']}** |
| 适用要求 (APPLICABLE) | {s['by_applicability'].get('APPLICABLE', 0)} |
| 不适用 (NOT_APPLICABLE，均附书面依据) | {s['by_applicability'].get('NOT_APPLICABLE', 0)} |
| 逐条验证为 PASS | **{s['requirement_specific_verified']}** |
| 审计结果分布 | `{json.dumps(s['by_result'], ensure_ascii=False)}` |
| 源标准状态 | `{json.dumps(s['by_source_status'], ensure_ascii=False)}` |
| UAES DRAFT 标准文件 | {s.get('uaes_draft_standard_files')}/{s.get('uaes_standard_md_files')} |
| 域级测试矩阵（同 SHA） | {s['matrix_passed']}/{s['matrix_total']} PASS，overall `{s['matrix_overall']}` |
| 绑定的真实 Commit SHA | `{s['matrix_commit_sha']}` |

**结论：适用要求全部 `BLOCKED`。** 根因是 UAES 规范性基线未逐条批准（FIND-FCA-001），
且仓库不存在逐条实现映射与逐条验证（FIND-FCA-002）。域级命令仅登记为 `INDIRECT`，
绝不提升任何单条要求为 PASS。

## 2. §3 十五字段

`evidence/02-compliance-matrix.json` 每条记录包含：Requirement ID、UAES Domain、
Requirement Description、Source Standard、Source Version、Applicability、
Implementation Location、Verification Method、Acceptance Criteria、Evidence Location、
Audit Result、Finding ID、Corrective Action、Revalidation Result，以及补充的
source_line / source_status / normative_level / keyword_class / commit_sha /
applicability_justification / linked_real_commands / linked_manual_cases。

完整 {s['total_requirements']} 行同时导出为 `evidence/matrix-export.csv`（UTF-8），
可用任意表格工具按 `source_standard + source_line` 回查 UAES 原文重新核验。

## 3. 逐域要求数

{table(['Domain', '名称', '要求数', 'PASS', 'BLOCKED', 'NOT_APPLICABLE'],
       [[d['domain'], domain_names.get(d['domain'].replace('P','').replace('UTER-',''), ''),
         d['requirements'], d['results'].get('PASS', 0), d['results'].get('BLOCKED', 0),
         d['results'].get('NOT_APPLICABLE', 0)] for d in domains.get('reports', [])])}

## 4. 无跳过证明（覆盖账本）

| 项 | 行数 |
|---|---|
| 扫描总行数 | {scanned} |
| 已登记各类型合计 | {accounted} |
| 差额（必须为 0） | **{scanned - accounted}** |

{table(['分类', '行数'], [[k, v] for k, v in cov.items()])}

匹配器：EN `MUST/MUST NOT/SHALL/SHALL NOT/REQUIRED/PROHIBITED` +
中文 `不得/必须/禁止/严禁/应当/不应` + `SHOULD/SHOULD NOT` + native-ID 引用行。
代码围栏内内容、空行、非规范性描述行均按显式理由计入 `skipped_*`，不会静默丢弃。

## 5. 复现命令

```bash
python3 scripts/quality/full-conformance-audit.py baseline matrix domains
python3 -c "import json;d=json.load(open('reports/compliance/full-conformance-audit-2026-11-06/evidence/02-compliance-matrix.json'));print(d['summary'])"
```

## 6. 状态语义

`BLOCKED` / `NOT RUN` / `NOT ASSESSED` 一律不等于 PASS（§13）。本矩阵中
`implementation_location` 为 `NOT MAPPED` 是真实缺口，不是隐藏跳过。
""")

    # ---- 02 domain audits index
    md(D_FILES[1], head("P00–P13 分领域审计报告（索引）", "2/14", commit) + f"""
共 {domains.get('count', 14)} 份独立域报告，每份均包含 §4 要求的 8 类审计：
规范审计 / 实际实现审计 / 流程审计 / 自动化控制审计 / 证据审计 / 有效性验证 /
不符合项记录 / 整改和复测。

{table(['域', '名称', '报告文件', '要求数', '结果分布', 'SHA-256'],
       [[d['domain'], domain_names.get(d['domain'].replace('P','').replace('UTER-',''), ''),
         f"`{d['file']}`", d['requirements'], json.dumps(d['results'], ensure_ascii=False),
         f"`{d['sha256'][:16]}…`"] for d in domains.get('reports', [])])}

所有域的 `Requirement-specific verified rows` 均为 0，`Revalidation result` 均为
`NOT REVALIDATED`。UTER-P13 只存在于 Uter 仓库，不写入 UAES `standards/`。
""")

    # ---- 03 external standards
    probe = verify.get("probe_result", {})
    md(D_FILES[2], head("外部标准适用性及映射清单", "3/14", commit) + f"""
来源：权威规范 `docs/ai-specs/UTER-UAES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md`
`UTER-UAES-GOV-001` §2.1，共 **{len(EXTERNAL_STANDARDS)}** 项；§2.2 要求逐项记录标识、
官方名称、发布者、版本、发布日期、现行状态、修订、适用范围、相关要求、适用性决定、
裁剪决定、责任人、验证方法、证据位置。

**重要限制（如实披露）**：本次为本地仓库审计，未从权威发布者获取正式文本与版本元数据。
下表 `official_title / publisher / edition / publication_date / current_status /
amendments` 一律记为 `NOT_VERIFIED`，**不虚构**；`applicability` 为基于内部域映射的
初步判定，**不构成外部认证**（§16.5）。

{table(['标准/框架', '§2.1 治理用途', '内部域映射', '官方版本/发布日期', '状态', '适用性初判', '验证证据'],
       [[n, use, dom, 'NOT_VERIFIED', 'NOT_VERIFIED',
         'APPLICABLE (初步)', 'INDIRECT: 见 evidence/04-engineering-verification.json']
        for n, use, dom in EXTERNAL_STANDARDS])}

### 未能完成 §2.2 全字段的原因与所需授权

- 需从 ISO/IEC、NIST、OWASP、W3C、OpenSSF 等官方发布者取得现行版本与修订记录。
- 需为每项标准指定 Responsible owner 与 tailoring decision，并形成正式适用性评审记录。
- 相关环境探针：`{probe.get('dast_tool')=}`、`{probe.get('axe_toolchain')=}`、
  `{probe.get('playwright_installed')=}`；完整探针结果见 `evidence/raw/EV-00-PROBE.log`。
- 内部完成度：安全相关验证见 `07-SECURITY-RELIABILITY-AUDIT-REPORT.md`，
  其中 DAST / 渗透 / API 安全 / 三库 / DR / 备份恢复均为 `NOT_RUN`。

**结论：外部标准映射清单为 `PARTIAL / NOT_VERIFIED`，不能作为完全符合的证据。**
""")

    # ---- 04 AI Agent
    acases = agent.get("cases", [])
    md(D_FILES[3], head("AI Agent 实际执行验证报告（§5）", "4/14", commit) + f"""
验证方式：对 `scripts/quality/uaes-agent-runtime-check.rb` 的 `preflight / authorize /
workspace / verify / selftest` 发起**真实 CLI 调用**与**负向 fixture**，
不是询问 Agent 是否遵守规范。Harness 证据目录通过 `UAES_EVIDENCE_DIR` 重定向到
`evidence/agent/`，不覆盖 D01–D28 既有证据。

**汇总：{agent.get('summary', {}).get('passed', 0)}/{agent.get('summary', {}).get('total', 0)} PASS，
失败={agent.get('summary', {}).get('failed', [])}**

{table(['用例', '§5 能力', '期望', '退出码', '结果', '原始证据'],
       [[c['case_id'], c['title'], c['expected'], c['exit_code'], c['result'], f"`{c['raw_log']}`"]
        for c in acases])}

### 反向绕过测试要点

- 普通提示绕过：在环境变量中注入 `UAES_BYPASS=1` / `WB_AGENT_OVERRIDE=allow_all` /
  忽略治理规则的 prompt，`git.push.main` 仍 `DENY`（exit 2）。
- 任务切换：切换 `orchestrator` profile 并带 `--validation-passed`，
  `git.pull_request.merge` 仍 `DENY`。
- 其他执行路径：从临时 cwd 以绝对路径调用 harness；workspace 的
  W2/W3/W5/W6 仍照常执行，bypass 字段不产生任何授权。
- 规范版本漂移：构造真实临时 git 仓库，把 UAES registry 版本改为
  `9.9.9-FCA-DRIFT-FIXTURE`，preflight step 3 因 blob/版本不匹配而 FAIL。
- CI 持续遵循：本地执行 `.github/workflows/ci.yml` 的 8 条 deny 断言全部 PASS。

原始数据：`evidence/05-agent-verification.json`、`evidence/raw/AG-*.log`、
`evidence/agent/fixtures/`。
""")

    # ---- 05 architecture
    sep = jread(LEGACY / "governance-separation.json", {})
    p910 = jread(LEGACY / "p09-p10-boundary.json", {})
    arch = gates.get("real", {}).get("ARCHITECTURE_GATE", {})
    md(D_FILES[4], head("架构符合性报告", "5/14", commit) + f"""
## 三层治理架构

| 层 | 归属仓库 | 内容 |
|---|---|---|
| A. UAES 通用工程治理 | UAES (`{baseline['uaes']['commit_sha'][:12]}`) | P00–P12，178 份标准 |
| B. UTER 项目治理 | Uter (`{commit[:12]}`) | 治理入口、UAES 继承配置、UTER P13 |
| C. 执行与保障 | Uter + CI | WorkBuddy、质量门禁、独立评估、证据体系 |

## 真实验证

| 检查 | 系统 | 结果 |
|---|---|---|
| 双仓库分别治理（13 项） | `uter-governance-separation-check.rb` | `{sep.get('overall')}`，failed={len(sep.get('failed_checks', []))} |
| P09 证明 / P10 定义（11 项） | `uter-p09-p10-boundary-check.rb` | `{p910.get('overall')}`，failed={len(p910.get('failed_checks', []))} |
| 14 域独立评估 | `gates/l3-domain-gates.json` | domain_count=14，pass_count=0 |
| ARCHITECTURE_GATE | `evidence/06-gates-verification.json` | `{arch.get('verdict')}` |

ARCHITECTURE_GATE 逐项检查：
{table(['check', 'PASS?'], [[k, v] for k, v in arch.get('checks', {}).items()])}

## 架构层面的不符合项

- 14 域 L3 全部 BLOCKED；架构静态接线 PASS 不等于业务域验收（FIND-FCA-009）。
- 逐条实现映射缺失（FIND-FCA-002）：`implementation_location` 全为 `NOT MAPPED`。
- UTER P13 状态 `PROPOSED_BASELINE`，不是已批准基线。
""")

    # ---- 06 software quality
    vr = verify.get("re_run", [])
    md(D_FILES[5], head("软件质量审计报告（§6 质量部分）", "6/14", commit) + f"""
| 指标 | 值 |
|---|---|
| 本轮真实重跑命令 | {verify.get('summary', {}).get('re_run_total', 0)} |
| PASS / FAIL / TIMEOUT | {verify.get('summary', {}).get('re_run_pass', 0)} / {verify.get('summary', {}).get('re_run_fail', 0)} / {verify.get('summary', {}).get('re_run_timeout', 0)} |
| 非 PASS 编号 | `{', '.join(verify.get('summary', {}).get('re_run_fail_ids', []))}` |
| 同 SHA 既有真实用例 | {verify.get('summary', {}).get('prior_cases', 0)} |
| 既有非 PASS | `{', '.join(verify.get('summary', {}).get('prior_non_pass', []))}` |
| NOT_RUN 项 | {verify.get('summary', {}).get('not_run_total', 0)} |
| 已执行但非 PASS 项（EXECUTED_NOT_PASS） | {verify.get('summary', {}).get('executed_not_pass_total', 0)} |
| 最终 29 条测试矩阵（同 SHA） | {s['matrix_passed']}/{s['matrix_total']} PASS |

## 本轮重跑明细（真实退出码）

{table(['ID', '类别', '命令', 'exit', '结果', '耗时(s)', '原始日志'],
       [[r['evidence_id'], r.get('category'), f"`{r['command'][:110]}`", r['exit_code'],
         r['status'], r['duration_seconds'], f"`{r['raw_log']}`"] for r in vr])}

## 已执行但未通过的验证（EXECUTED_NOT_PASS，绝不计为 PASS）

这些项目**真实执行过**，工具链在位。此前被记为 `NOT_RUN` 并附「缺工具链」理由，
经 2026-11-07 实跑推翻，故改为如实记录执行结果。

{table(['ID', '类别', '真实执行结果与根因', '要求'],
       [[r['evidence_id'], r.get('category'), r.get('reason'), r.get('linked_requirement')]
        for r in verify.get('executed_not_pass', [])])}

## 质量结论

编译、类型检查、lint、格式、单元测试、Go 全量测试、竞态测试、覆盖率门禁的
真实结果以本表为准；任何 FAIL 都保留 OPEN，不改写为 PASS。
`knip` / `gitleaks` 属于安全与静态技术债，见 `07-SECURITY-RELIABILITY-AUDIT-REPORT.md`。
软件质量层面**不足以**支持 `CONFORMANT`：域级命令只是 INDIRECT 证据。
""")

    # ---- 07 security
    sec = gates.get("real", {}).get("SECURITY_GATE", {})
    nr = verify.get("not_run", [])
    prior = verify.get("prior_same_commit", [])
    md(D_FILES[6], head("安全与可靠性审计报告（§6 安全部分）", "7/14", commit) + f"""
## P09 / P10 分工（不得互相替代）

- **P10 定义**系统必须达到什么安全与可靠性要求。
- **P09 组织执行测试工程体系并证明**是否达到（真实命令 + 原始退出码）。
- 本报告的测试执行属于 P09 证据；安全要求基线属于 P10。

## SECURITY_GATE 判定：`{sec.get('verdict')}`

{table(['check', '满足?'], [[k, v] for k, v in sec.get('checks', {}).items()])}

## 同 SHA 既有真实安全用例

{table(['ID', '用例', '状态', 'exit', '原始日志'],
       [[p['evidence_id'], p.get('title'), p['status'], p['exit_code'], f"`{p.get('raw_log')}`"]
        for p in prior if p['evidence_id'] in
        ('MA-02','MA-03','MA-04','MA-05','MA-06','MA-07','MA-08','MA-10','MA-11','MA-12','MA-13')])}

MA-06 `gitleaks` 命中 1 项：`.uaes/API-LEGACY-ENDPOINT-DEPRECATION-AUDIT-2026-11-05.md`
第 62 行的 40 位 OpenAPI commit SHA，判定为候选误报。**未豁免、未改 allowlist、
未改状态**，需验收负责人裁定。

## NOT_RUN（§6 未完成项）

{table(['ID', '类别', '状态', '原因', '所需授权'],
       [[x['evidence_id'], x['category'], x['status'], x['reason'], x['required_authorization']] for x in nr])}

**结论：安全与可靠性验证不完整，SECURITY_GATE BLOCK。**
""")

    # ---- 08 test execution
    md(D_FILES[7], head("测试执行报告", "8/14", commit) + f"""
本报告列出全部真实执行、同 SHA 既有执行以及未执行项，三者严格区分。

### 本轮真实重跑（{len(vr)} 条）

{table(['ID', '命令', 'cwd', 'exit', '状态', '开始时间', '日志 SHA-256(前16)'],
       [[r['evidence_id'], f"`{r['command'][:90]}`", r['cwd'], r['exit_code'], r['status'],
         r['started_at'], f"`{r['raw_log_sha256'][:16]}`"] for r in vr])}

### 同 SHA 既有真实执行（{len(prior)} 条，PRIOR_REAL_RUN_AT_SAME_COMMIT）

{table(['ID', '状态', 'exit', '命令', '日志'],
       [[p['evidence_id'], p['status'], p['exit_code'], f"`{str(p.get('command'))[:90]}`", f"`{p.get('raw_log')}`"]
        for p in prior])}

### 未执行 / 不可用（{len(nr)} 项）

{table(['ID', '类别', '状态', '原因'],
       [[x['evidence_id'], x['category'], x['status'], x['reason']] for x in nr])}

### 最终矩阵（同 Commit SHA）

`{s['matrix_commit_sha']}` 的 `29/29 PASS` 来自
`reports/compliance/uaes-full-migration-2026-11-06/evidence/test-matrix.json`，
逐条原始日志在同级 `matrix/L*.log`。该矩阵是**域级**证据，
不能替代本审计 §3 的 {s['total_requirements']} 条逐条验证。

**不得把 BLOCKED / NOT RUN / NOT ASSESSED 视为 PASS（§13）。**
""")

    # ---- 09 gates
    greal = gates.get("real", {})
    gneg = gates.get("negative", [])
    md(D_FILES[8], head("CI/CD 门禁验证报告（§8 八类门禁）", "9/14", commit) + f"""
真实状态评估 {gates.get('gate_count', 8)} 类门禁；每类另做一次**真实子进程负向阻断测试**：
把一份「不符合要求的变更」写成 fixture state，再调用
`gate-check --state <fixture> --gate <ID>`，要求 exit 2 / verdict BLOCK。

**负向阻断证明：{gates.get('summary', {}).get('negative_blocking_proven', 0)}/{gates.get('summary', {}).get('negative_total', 0)}**

## 真实状态判定

{table(['门禁', '真实 verdict', '通过检查数', '未通过检查', '判定说明'],
       [[g, greal.get(g, {}).get('verdict'), f"{greal.get(g, {}).get('passed_checks', 0)}/{greal.get(g, {}).get('total_checks', 0)}",
         ', '.join(greal.get(g, {}).get('failed_checks', [])),
         greal.get(g, {}).get('notes', {}).get('scope', '')] for g in gates.get('real_verdicts', {})])}

## 负向阻断测试

{table(['门禁', '注入的不合规变更', 'exit', 'verdict', '阻断成立', '原始日志'],
       [[n['gate'], n['mutation'], n['exit_code'], n['parsed_verdict'], n['blocking_proven'], f"`{n['raw_log']}`"]
        for n in gneg])}

## CI 接线

`.github/workflows/ci.yml` 含 `test-uaes-integration-check.rb`、`test-uaes-pin-check.rb`、
`test-ai-governance-policy.rb`、`test-uter-governance-boundaries.rb`、
`uaes-agent-runtime-check.rb selftest` 与 authorize deny 循环。
本轮在本地真实执行了同一 deny 循环（AG-10）与 8 条门禁负向测试。
**未在 GitHub 上产生真实 CI 运行**：无授权 push / PR，记为 `NOT_RUN`（NR-09）。

## 与四层门禁的关系

`UTER-UAES-GOV-001` 的 L1/L2/L3/L4 继续保留；本指令 §8 的八类门禁作为
额外的可执行层映射到它（CONF-002），两者不互相替代。
""")

    # ---- 10 findings
    md(D_FILES[9], head("不符合项及风险清单", "10/14", commit) + f"""
共 {findings['count']} 条，其中未解决 P0/P1：`{', '.join(findings['p0_p1_open'])}`。
完整机器可读版本：`evidence/07-findings-register.json`。

{table(['ID', '级别', '状态', '标题', '影响', '所需授权'],
       [[f['id'], f['severity'], f['status'], f['title'], f['impact'][:150], f['required_authorization']]
        for f in findings['findings']])}

### 每条的完整信息（位置 / 根因 / 证据 / 整改）

""" + "\n".join(
        f"#### {f['id']} — {f['title']}\n\n"
        f"- 级别/状态：`{f['severity']}` / `{f['status']}`\n"
        f"- 位置：{f['location']}\n- 根因：{f['root_cause']}\n"
        f"- 影响：{f['impact']}\n- 证据：{', '.join('`'+e+'`' for e in f['evidence'])}\n"
        f"- 整改：{f['corrective_action']}\n- 复测：`{f['revalidation']}`\n"
        for f in findings['findings']) + f"""

### 既有未解决发现（独立评估）

{json.dumps(findings['prior_open_findings'], ensure_ascii=False, indent=2)}

### 既有非 PASS 本地证据

{', '.join(f"{x['id']}={x['status']}" for x in findings['prior_manual_non_pass'])}

**未授予任何正式例外 / waiver**；`policy` 中 5 项自动关闭手段全部为 `false`。
""")

    # ---- 11 remediation
    fixes = remediation["fixes"]
    md(D_FILES[10], head("整改记录和复测证据", "11/14", commit) + f"""
## 已完成的真实整改

{table(['编号', '缺陷', '修改文件', '修复前', '修复后', '复测'],
       [[f['fix_id'], f['defect'], f"`{f['file']}`", f['before'], f['after'], f['revalidation']] for f in fixes])}

- 修复前矩阵 SHA-256：`{remediation['before_sha256']}`
- 修复后矩阵 SHA-256：`{remediation['after_sha256']}`
- 原始快照：`evidence/bugfix/02-compliance-matrix.BEFORE.json` / `.AFTER.json`

## 覆盖账本（修复后）

{table(['分类', '行数'], [[k, v] for k, v in remediation['coverage_ledger'].get('totals', {}).items()])}

## 复测命令（真实执行）

```bash
{chr(10).join(remediation['revalidation_commands'])}
```

## 未自动修复项（§7.10：原因 / 风险 / 所需授权）

{table(['Finding', '原因', '风险', '所需授权'],
       [[x['finding_id'], x['reason'], x['risk'], x['required_authorization']]
        for x in remediation['not_auto_fixed']])}

## 整改纪律

{table(['禁止手段', '是否使用'], [[k, v] for k, v in remediation['policy'].items()])}

未覆盖任何用户未提交修改；未修改 UAES 仓库；未改动业务代码；
未 commit / push / PR / merge / deploy。
""")

    # ---- 13 final assessment (written before index so index can cite it)
    conditions = [
        ("C01", "所有适用要求均完成审计", bool(s["total_requirements"]) and scanned == accounted),
        ("C02", "所有强制性要求均 PASS", s["requirement_specific_verified"] >= s["by_applicability"].get("APPLICABLE", 1)),
        ("C03", "所有 N/A 均有适用性依据", all(r.get("applicability_justification") for r in matrix["requirements"] if r["audit_result"] == "NOT_APPLICABLE")),
        ("C04", "不存在未解决的 P0/P1 不符合项", not findings["p0_p1_open"]),
        ("C05", "不存在未经授权的重大风险例外", jread(LEGACY / "independent-assessment.json", {}).get("exception_approvals", {}).get("count", 0) == 0),
        ("C06", "所有整改均完成有效性复测", all(f["revalidation"] != "NOT REVALIDATED" for f in findings["findings"] if f["status"] == "OPEN") is False or not [f for f in findings["findings"] if f["status"] == "OPEN"]),
        ("C07", "所有关键测试和安全验证通过", gates.get("real_verdicts", {}).get("TESTING_GATE") == "ALLOW" and gates.get("real_verdicts", {}).get("SECURITY_GATE") == "ALLOW"),
        ("C08", "AI Agent 实际执行验证通过", agent.get("summary", {}).get("failed") == [] and agent.get("summary", {}).get("total", 0) > 0),
        ("C09", "CI/CD 门禁验证通过", all(v == "ALLOW" for v in gates.get("real_verdicts", {}).values()) and gates.get("summary", {}).get("negative_blocking_proven") == gates.get("summary", {}).get("negative_total")),
        ("C10", "审计证据完整且可追溯", bool(commit) and bool(s["matrix_commit_sha"]) and commit == s["matrix_commit_sha"]),
        ("C11", "最终审计报告通过独立复核", jread(LEGACY / "independent-assessment.json", {}).get("verdict", {}).get("conformance_claim_supported") is True),
    ]
    met = [c for c, _, ok in conditions if ok]
    unmet = [c for c, _, ok in conditions if not ok]
    if not unmet:
        verdict = "CONFORMANT"
    elif s["by_result"].get("BLOCKED", 0) > 0 and not conditions[3][2]:
        verdict = "BLOCKED"
    else:
        verdict = "PARTIALLY CONFORMANT"
    rationale = (
        f"§10 的 {len(conditions)} 项条件中 {len(met)} 项满足、{len(unmet)} 项未满足。"
        f"{s['by_result'].get('BLOCKED', 0)} 条适用要求因 UAES 规范基线未逐条批准且缺逐条验证而 BLOCKED；"
        f"42 项人工验收未由负责人签署；DAST/渗透/三库/DR/备份恢复等需要授权环境，记为 NOT_RUN；"
        f"逐条 PASS 数为 {s['requirement_specific_verified']}。"
        "关键验证因权限与外部依赖无法完成，因此最精确的 §12 结论是 BLOCKED。"
    )
    assessment = {
        "evidence_id": "FCA-FINAL-ASSESSMENT", "generated_at": now(),
        "commit_sha": commit, "uaes_commit_sha": baseline["uaes"]["commit_sha"],
        "related_requirement": "§10 / §12",
        "conditions": [{"id": c, "description": d, "met": ok} for c, d, ok in conditions],
        "met": met, "unmet": unmet,
        "final_verdict": verdict, "rationale": rationale,
        "allowed_vocabulary": ["CONFORMANT", "PARTIALLY CONFORMANT", "NON-CONFORMANT", "BLOCKED", "NOT ASSESSED"],
        "not_conformant_because": [
            "0 requirement-specific PASS out of " + str(s["by_applicability"].get("APPLICABLE", 0)) + " applicable requirements",
            "178/178 UAES standards are DRAFT and UAES APPROVAL-RECORD §4 does not approve them",
            "13 UAES L3 domain gates remain NOT_RUN; 14-domain L3 group is 0/14 PASS",
            "42 manual acceptance items remain NOT_VERIFIED with signoff_granted=false",
            "security verification is incomplete: MA-06 gitleaks and MA-12 axe are now PASS (user commit ec6501adc + installed axe-core/@axe-core/playwright real scan), but DAST / penetration / API security / three-database migration / DR / backup-restore / performance testing remain NOT_RUN (authorised environment required, see FIND-FCA-004)",
            "several of the eight §8 gates are BLOCK",
        ],
        "conclusion_boundary": (
            "Locally-executable MA items are now resolved (MA-06 gitleaks PASS via user commit "
            "ec6501adc, MA-09 knip PASS, MA-10 docs-web build PASS, MA-11 electron build PASS, "
            "MA-12 axe PASS with a real serious violation found and fixed); a NON-CONFORMANT "
            "classification would also be defensible only if the authorised-environment items were "
            "counted as failures. BLOCKED is selected because the dominant, evidence-backed "
            "condition is that key verification cannot be completed at all due to an unapproved "
            "normative baseline and missing authorised environments. In no case may CONFORMANT be "
            "used."),
        "internal_assessment_is_not_external_certification": True,
    }
    jwrite(EV / "10-final-assessment.json", assessment)
    md(D_FILES[12], head("最终符合性评估报告", "13/14", commit) + f"""
## 最终结论（§12 唯一词汇）

# `{verdict}`

{rationale}

## §10 最终验收条件逐项核对

{table(['条件', '描述', '满足?'], [[c, d, ok] for c, d, ok in conditions])}

- 满足：`{', '.join(met)}`
- 未满足：`{', '.join(unmet)}`

## 为什么不是 CONFORMANT

""" + "\n".join(f"{i+1}. {x}" for i, x in enumerate(assessment["not_conformant_because"])) + f"""

## 结论边界

{assessment['conclusion_boundary']}

## 声明限制

- 本评估是内部工程审计，**不是** ISO / IEC / IEEE / NIST / OWASP / W3C 等外部认证（§16.5）。
- `NOT_APPLICABLE` 仅作为逐条要求的适用性取值，不作为报告级结论。
- 未执行项保持 `NOT_RUN` / `BLOCKED`，不得视为 PASS。
- 无正式例外 / waiver；无 commit / push / PR / merge / deploy。
- 机器可读结论：`evidence/10-final-assessment.json`。
""")

    # ---- 14 open items
    md(D_FILES[13], head("尚未解决事项及正式例外清单", "14/14", commit) + f"""
## 正式例外

**无。** `independent-assessment.json` 中 `exception_approvals.count = 0`；
`07-findings-register.json` 的 policy 明确 `waiver_granted=false`、
`allowlist_modified=false`、`status_rewritten=false`。本审计未授予、未请求、
也未伪造任何例外。

## 尚未解决事项

{table(['Finding', '级别', '状态', '阻塞原因', '所需授权 / 后续动作'],
       [[f['id'], f['severity'], f['status'], f['root_cause'][:160], f['corrective_action']]
        for f in findings['findings'] if f['status'] == 'OPEN'])}

## 需要用户 / UAES Owner 决定的事项

1. **UAES Owner**：批准 178 份 DRAFT 标准条目并执行 13 个 L3 域门禁（FIND-FCA-001）。
2. **项目 Owner（用户本人）**：逐项复核并签署 42 项人工验收（FIND-FCA-003）。
3. **安全授权**：提供 DAST / 渗透 / API 安全 / 三库 / DR / 备份恢复的授权环境，
   并裁定 MA-06 gitleaks 候选误报（FIND-FCA-004）。
4. **工程决策**：逐项确认 knip unused files 清理范围，禁止批量删除用户 WIP（FIND-FCA-005）。
5. **工程资源**：为 {s['total_requirements']} 条要求建立逐条实现映射与逐条验证（FIND-FCA-002）。

## 未完成即不得宣布全面符合

在上述事项解决并重跑全部门禁前，禁止使用 `CONFORMANT`，禁止
commit / push / PR / merge / deploy。
""")

    # ---- 12 evidence index + closure (written last)
    excluded = {"evidence/09-evidence-index.json", "evidence/10-evidence-closure.json",
                OUT.joinpath(D_FILES[11]).name}
    index_rows = []
    for p in sorted(EV.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(OUT).as_posix()
        if rel in excluded or rel.endswith(".tmp"):
            continue
        raw = ""
        if rel.startswith("evidence/raw/") and rel.endswith(".log"):
            txt = p.read_text(encoding="utf-8", errors="replace")
            m = re.search(r"^# command=(.*)$", txt, re.M)
            raw = m.group(1) if m else ""
            m2 = re.search(r"^# exit_code=(.*)$", txt, re.M)
            if m2:
                raw += f"  |  exit_code={m2.group(1)}"
        index_rows.append({
            "path": rel, "sha256": sha256(p), "bytes": p.stat().st_size,
            "requirement_linkage": {"group": ("§3 all requirement IDs" if "02-compliance-matrix" in rel else
                                              "§5 Agent" if rel.startswith("evidence/agent") or "AG-" in rel else
                                              "§8 gates" if rel.startswith("evidence/gates") or "GATE-NEG" in rel else
                                              "§6 verification" if rel.startswith("evidence/raw/EV") else
                                              "§2/§4/§9/§10"),
                                    "scope": "INDIRECT unless a requirement-specific case exists (none at present)",
                                    "finding_ids": ["FIND-FCA-001", "FIND-FCA-002"]},
            "commit_sha": commit, "generated_at": now(),
            "execution_environment": platform.platform(),
            "tool_versions": verify.get("toolchain", {}),
            "command": raw, "raw_result": ("see log" if raw else ""),
            "audit_conclusion": "referenced by §11 deliverables; never a self-declared PASS",
            "revalidation_record": "evidence/08-remediation-register.json",
        })
    index = {"evidence_id": "FCA-EVIDENCE-INDEX", "generated_at": now(),
             "commit_sha": commit, "self_reference_exclusions": sorted(excluded),
             "files": index_rows, "count": len(index_rows),
             "note": "Paths are relative to reports/compliance/full-conformance-audit-2026-11-06/"}
    jwrite(EV / "09-evidence-index.json", index)

    # §11 deliverables are also evidence; include them in closure
    deliverable_rows = []
    for name in D_FILES:
        p = OUT / name
        if p.is_file() and name != D_FILES[11]:
            deliverable_rows.append({"path": name, "sha256": sha256(p), "bytes": p.stat().st_size})
    closure = {"evidence_id": "FCA-EVIDENCE-CLOSURE", "generated_at": now(),
               "commit_sha": commit, "self_excluded": ["10-evidence-closure.json", D_FILES[11]],
               "evidence_files": index_rows, "deliverables": deliverable_rows,
               "total_listed": len(index_rows) + len(deliverable_rows)}
    jwrite(EV / "10-evidence-closure.json", closure)

    md(D_FILES[11], head("最终证据索引", "12/14", commit) + f"""
本索引列出 {len(index_rows)} 个证据文件与 {len(deliverable_rows)} 份交付物的
SHA-256、字节数、Commit SHA、执行环境、工具版本、命令、原始结果位置、
Finding ID 与复测记录。机器可读版本：`evidence/09-evidence-index.json`；
完整性清单：`evidence/10-evidence-closure.json`。

## 自指边界

索引与完整性清单不能哈希自身，以下文件从清单中排除并显式声明：
`{', '.join(sorted(excluded))}`。最终 evidence index 报告本身也排除。

## 证据文件（前 200 条，全量见 JSON）

{table(['路径', 'SHA-256', 'bytes', '命令 / exit'],
       [[r['path'], f"`{r['sha256'][:20]}…`", r['bytes'], (r['command'][:120] or '—')]
        for r in index_rows[:200]])}

## 交付物

{table(['文件', 'SHA-256', 'bytes'],
       [[r['path'], f"`{r['sha256'][:20]}…`", r['bytes']] for r in deliverable_rows])}

## 独立复核方法

```bash
python3 scripts/quality/full_conformance_deliver.py --verify-only
python3 scripts/quality/full-conformance-audit.py all
python3 scripts/quality/full-conformance-execution.py all
sha256sum reports/compliance/full-conformance-audit-2026-11-06/evidence/02-compliance-matrix.json
```

复核者可用 `evidence/matrix-export.csv` 的 `source_standard:source_line` 直接回查
UAES 仓库 `ff7cf878...` 的规范原文，逐条重放审计结论。
""")

    print(f"[deliver] deliverables={len(D_FILES)} evidence_files={len(index_rows)} "
          f"findings={findings['count']} p0_p1_open={len(findings['p0_p1_open'])} "
          f"verdict={verdict} conditions_met={len(met)}/{len(conditions)}")


def verify_only() -> int:
    closure = jread(EV / "10-evidence-closure.json", {})
    if not closure:
        print("FAIL: evidence/10-evidence-closure.json missing", file=sys.stderr)
        return 1
    rows = closure.get("evidence_files", []) + closure.get("deliverables", [])
    problems = []
    for r in rows:
        p = OUT / r["path"]
        if not p.is_file():
            problems.append(f"missing: {r['path']}")
            continue
        if sha256(p) != r["sha256"]:
            problems.append(f"hash mismatch: {r['path']}")
        if p.stat().st_size != r["bytes"]:
            problems.append(f"size mismatch: {r['path']}")
    actual = {p.relative_to(OUT).as_posix() for p in EV.rglob("*") if p.is_file()
              and not p.name.endswith(".tmp")}
    listed = {r["path"] for r in rows}
    excluded = {"evidence/09-evidence-index.json", "evidence/10-evidence-closure.json"}
    extra = sorted(actual - listed - excluded - {D_FILES[11]})
    print(f"EVIDENCE CLOSURE: listed={len(rows)} missing={len([p for p in problems if p.startswith('missing')])} "
          f"hash_mismatch={len([p for p in problems if p.startswith('hash')])} "
          f"size_mismatch={len([p for p in problems if p.startswith('size')])} extra={len(extra)}")
    if problems or extra:
        for p in problems[:20]:
            print("  " + p, file=sys.stderr)
        for p in extra[:20]:
            print("  extra: " + p, file=sys.stderr)
        return 1
    print("DELIVERABLES: " + str(len(closure.get("deliverables", []))))
    return 0


def main(argv: list[str]) -> int:
    if argv == ["--verify-only"]:
        return verify_only()
    baseline = jread(EV / "00-baseline.json", {})
    matrix = jread(EV / "02-compliance-matrix.json", {})
    if not baseline or not matrix:
        print("FAIL: run `python3 scripts/quality/full-conformance-audit.py baseline matrix domains` first", file=sys.stderr)
        return 1
    # Standalone entry point. The audit engine is `full-conformance-audit.py`
    # (hyphenated, therefore not importable as a Python module), so use the
    # identical canonical domain-name table declared in this module instead.
    # When invoked through `full-conformance-audit.py deliver`, the engine passes
    # its own DOMAIN_NAMES, which is byte-for-byte the same mapping.
    deliver(baseline, matrix, ROOT, UAES, OUT, EV, LEGACY, DOMAIN_NAMES)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
