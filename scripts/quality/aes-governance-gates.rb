#!/usr/bin/env ruby
# frozen_string_literal: true

# UTER-AES-GOV-001 §8.2 / §8.3 / §12 / §16.1-16.4 — gate evaluator.
#
# Produces evidence for §15 D21 (Quality Gate Assessment) and D22 (Security Gate
# Assessment), plus the L4_GLOBAL_CONFORMANCE_GATE input. Statuses are derived
# only from real evidence produced by:
#   * scripts/quality/aes-test-matrix.sh
#   * scripts/quality/aes-agent-runtime-check.rb
#   * scripts/quality/uter-governance-separation-check.rb
#   * scripts/quality/uter-p09-p10-boundary-check.rb
#   * scripts/quality/uter-independent-assessment.rb
#   * the pinned AES repository's gates.yaml
#
# Rules enforced here:
#   * §8.3: NOT_RUN is never counted as PASS. A skipped command is never PASS.
#   * One domain's PASS never offsets another domain's FAIL.
#   * 14 domains are assessed independently: AES P00-P12 + UTER P13.
#   * P09 Quality Engineering PROVES quality; P10 Security & Reliability DEFINES
#     security/reliability requirements; UTER P13 owns business domain rules.
#   * L4 is a GLOBAL CONFORMANCE gate, not a code-test aggregate. A single
#     unmet §16.4 condition blocks it; 14 L3 PASS alone does not satisfy it.
#   * AES governance-layer L3 gates (NOT_RUN) are reported separately and are
#     NOT silently converted into Uter-side PASS results.

require "json"
require "yaml"
require "time"
require "fileutils"

ROOT = File.expand_path("../..", __dir__)
EVIDENCE = ENV.fetch("AES_EVIDENCE_DIR", File.join(ROOT, "reports/compliance/aes-full-migration-2026-11-06/evidence"))
REPORTS = ENV.fetch("AES_REPORTS_DIR", File.dirname(EVIDENCE))
AES_REPO = ENV.fetch("AES_REPO", File.expand_path("../aes", ROOT))
OUT = File.join(EVIDENCE, "gates")

def now = Time.now.utc.iso8601

# Live DRAFT/ACTIVE split of the pinned AES registry.
#
# This used to be the literal "304 registry entries remain DRAFT", which was
# accurate at registry 1.9.0 and then silently froze while the registry moved
# to 1.12.1 (real count: 130). A stale hard-coded count inside an evidence
# generator makes the evidence wrong, and wrong evidence is worse than missing
# evidence because it looks verified.
#
# The reader lives in scripts/quality/lib/registry_draft_state.rb so it can be
# required by fixtures without executing this evaluator's main body.
require_relative "lib/registry_draft_state"
# Separate AI-Native INTERNAL acceptance channel. It is emitted by this
# of-record gate runner as an additional evidence file, but it does not feed
# L3/L4 status computation: historical global conformance stays fail-closed.
require_relative "lib/ai_native_internal_gate"

REGISTRY_DRAFT = RegistryDraftState.read(AES_REPO)

def draft_state_note
  REGISTRY_DRAFT["available"] ? REGISTRY_DRAFT["note"] :
    "AES registry could not be read, so the DRAFT/ACTIVE split is UNKNOWN"
end

def read_json(path)
  abort "FAIL: missing evidence #{path}" unless File.file?(path)
  JSON.parse(File.read(path))
end

def optional_json(name)
  path = File.join(EVIDENCE, name)
  File.file?(path) ? JSON.parse(File.read(path)) : nil
end

def report?(prefix)
  !Dir.glob(File.join(REPORTS, "#{prefix}-*.md")).empty?
end

def dump(name, payload)
  FileUtils.mkdir_p(OUT)
  path = File.join(OUT, name)
  File.write(path, JSON.pretty_generate(payload) + "\n")
  path
end

matrix = read_json(File.join(EVIDENCE, "test-matrix.json"))
by_id = matrix.fetch("results").to_h { |r| [r["id"], r] }
preflight = read_json(File.join(EVIDENCE, "agent-runtime-preflight.json"))
selftest = read_json(File.join(EVIDENCE, "agent-runtime-selftest.json"))
runtime_verify = read_json(File.join(EVIDENCE, "agent-runtime-test-execution.json"))
runtime_workspace = read_json(File.join(EVIDENCE, "agent-runtime-workspace.json"))
pin = JSON.parse(File.read(File.join(ROOT, ".aes/aes-pin.json")))
aes_commit = `git -C #{AES_REPO} rev-parse HEAD`.strip

separation = optional_json("governance-separation.json")
boundary = optional_json("p09-p10-boundary.json")
independent = optional_json("independent-assessment.json")

# --------------------------------------------------------------------------
# §14.3 / §16.3 manual-acceptance evidence — consume REAL collected evidence,
# fail-closed. A missing/inconsistent/interrupted evidence set never promotes
# an acceptance item, and local execution never equals human sign-off.
# --------------------------------------------------------------------------
MANUAL_INVENTORY = optional_json("manual-acceptance/inventory.json")
MANUAL_EXECUTION = optional_json("manual-acceptance/execution.json")
MANUAL_INTEGRITY = optional_json("manual-acceptance/integrity.json")
MANUAL_RUN_STATE = optional_json("manual-acceptance/run-state.json")
ACCEPTANCE_AUTHORITY = optional_json("manual-acceptance/acceptance-authority.json")

ACCEPTANCE_RECORDED = ACCEPTANCE_AUTHORITY.is_a?(Hash) &&
  ACCEPTANCE_AUTHORITY["source"] == "USER_EXPLICIT_DESIGNATION" &&
  !ACCEPTANCE_AUTHORITY["authority_name"].to_s.empty?

MANUAL_VERIFIED = MANUAL_INVENTORY.is_a?(Hash) && MANUAL_INVENTORY["items"].is_a?(Array) ?
  MANUAL_INVENTORY["items"].count { |i| i["acceptance_status"] == "VERIFIED" } : 0
# A signed item is only credible when BOTH the inventory decision and the
# authority record explicitly grant it. A tampered inventory alone cannot sign.
MANUAL_GRANTED = ACCEPTANCE_RECORDED &&
  ACCEPTANCE_AUTHORITY["decision"] == "GRANTED" &&
  !Array(ACCEPTANCE_AUTHORITY["signed_item_ids"]).empty? &&
  MANUAL_INVENTORY.is_a?(Hash) &&
  MANUAL_INVENTORY.dig("acceptance_decision", "status") == "GRANTED"

MANUAL_TRUSTED = begin
  inv = MANUAL_INVENTORY
  exe = MANUAL_EXECUTION
  integ = MANUAL_INTEGRITY
  state = MANUAL_RUN_STATE
  inv.is_a?(Hash) && exe.is_a?(Hash) && integ.is_a?(Hash) && state.is_a?(Hash) &&
    integ["status"] == "PASS" && state["state"] == "COMPLETED" &&
    state["run_id"] == exe["run_id"] && inv["run_id"] == exe["run_id"] &&
    inv["item_count"] == 42 && inv["items"].is_a?(Array) && inv["items"].length == 42 &&
    (MANUAL_VERIFIED.zero? || MANUAL_GRANTED)
end

MANUAL_BY_ID = MANUAL_TRUSTED ? MANUAL_INVENTORY["items"].to_h { |i| [i["id"], i] } : {}

gates_yaml = File.join(AES_REPO, ".aes/registry/gates.yaml")
abort "FAIL: missing AES gates.yaml" unless File.file?(gates_yaml)
aes_gates = YAML.safe_load_file(gates_yaml)
aes_gate_index = aes_gates.fetch("gates").to_h { |g| [g["id"], g] }

def evidence_status(by_id, id)
  by_id.dig(id, "status") || "NOT_RUN"
end

# --------------------------------------------------------------------------
# L1_CHANGE_GATE / L2_INTEGRATION_GATE (§8.2)
# --------------------------------------------------------------------------
l1_rows = matrix["results"].select { |r| r["layer"] == "L1" }
l2_rows = matrix["results"].select { |r| r["layer"] == "L2" }
l1_fail = l1_rows.reject { |r| r["status"] == "PASS" }
l2_fail = l2_rows.reject { |r| r["status"] == "PASS" }
l1_status = (l1_rows.any? && l1_fail.empty?) ? "PASS" : "FAIL"
l2_status = (l2_rows.any? && l2_fail.empty?) ? "PASS" : "FAIL"

l1_l2 = {
  "evidence_id" => "GATE-L1-L2", "generated_at" => now,
  "related_requirement" => "§8.2 Change Gate / Integration Gate; §8.3 gate result vocabulary",
  "uter_commit" => matrix["uter_commit"], "aes_commit" => aes_commit,
  "L1_CHANGE_GATE" => { "status" => l1_status, "checks" => l1_rows.length,
                        "failed" => l1_fail.map { |r| { "id" => r["id"], "command" => r["command"], "log" => r["log"] } } },
  "L2_INTEGRATION_GATE" => { "status" => l2_status, "checks" => l2_rows.length,
                             "failed" => l2_fail.map { |r| { "id" => r["id"], "command" => r["command"], "log" => r["log"] } } },
  "skipped" => matrix["skipped"],
  "note" => "Skips are explicit and never counted as PASS (§8.3)."
}
dump("l1-l2-gates.json", l1_l2)

# --------------------------------------------------------------------------
# L3_DOMAIN_ACCEPTANCE_GATE — 14 independent domains (§16.3)
# --------------------------------------------------------------------------
def manual(items)
  items.map do |id, desc, reason|
    rec = MANUAL_BY_ID[id]
    if rec.nil?
      # Fail-closed: no trustworthy, integrity-verified evidence record.
      { "id" => id, "description" => desc, "status" => "NOT_VERIFIED",
        "reason" => "manual acceptance evidence set is missing or not integrity-verified (§14.3); #{reason}",
        "evidence_category" => "EVIDENCE_NOT_TRUSTED", "evidence_collected" => false,
        "linked_evidence" => [], "open_reason" => reason }
    else
      status = rec["acceptance_status"] == "VERIFIED" ? "VERIFIED" : "NOT_VERIFIED"
      { "id" => id, "description" => desc, "status" => status,
        "reason" => rec["open_reason"] || reason,
        "evidence_category" => rec["category"],
        "evidence_collected" => rec["evidence_collected"] == true,
        "linked_evidence" => rec["linked_evidence"] || [],
        "open_reason" => rec["open_reason"] }
    end
  end
end

DOMAINS = [
  { "id" => "P00", "name" => "Foundation", "aes_gate" => "AES-00-GATE-001",
    "automated" => %w[U-01 L1-01 L1-02 L1-04 L1-05 L1-06 L1-07],
    "manual" => manual([
      ["M00-01", "governance responsibility and approval workflow sign-off", "no signed owner approval for this execution's domain acceptance exists"],
      ["M00-02", "formal-standard vs draft isolation review", "isolation review needs an independent reviewer; #{draft_state_note}"]
    ]) },
  { "id" => "P01", "name" => "AI Governance", "aes_gate" => "AES-01-GATE-001",
    "automated" => %w[L1-01 L1-02 L1-03 L1-16],
    "manual" => manual([
      ["M01-01", "Agent permission audit with independent reviewer", "no independent reviewer evidence recorded"],
      ["M01-02", "AI decision record and exception-behaviour detection", "no runtime anomaly-detection evidence recorded"]
    ]) },
  { "id" => "P02", "name" => "Product Engineering", "aes_gate" => "AES-02-GATE-001",
    "automated" => %w[],
    "manual" => manual([
      ["M02-01", "requirement / user-story traceability audit", "not executed"],
      ["M02-02", "product state-machine and business-rule audit", "not executed"],
      ["M02-03", "product E2E regression", "not executed"]
    ]) },
  { "id" => "P03", "name" => "Knowledge Engineering", "aes_gate" => "AES-03-GATE-001",
    "automated" => %w[L1-01],
    "manual" => manual([
      ["M03-01", "documentation vs code consistency audit", "not executed"],
      ["M03-02", "API / database / architecture documentation consistency", "not executed"],
      ["M03-03", "stale knowledge identification", "partially remediated (TRACEABILITY stale row), full sweep not executed"]
    ]) },
  { "id" => "P04", "name" => "System Architecture", "aes_gate" => "AES-04-GATE-001",
    "automated" => %w[],
    "manual" => manual([
      ["M04-01", "OpenAPI -> router -> handler -> service -> repository consistency", "no live cross-layer verification executed"],
      ["M04-02", "architecture / ADR / running behaviour consistency", "not executed"]
    ]) },
  { "id" => "P05", "name" => "Experience & Design", "aes_gate" => "AES-05-GATE-001",
    "automated" => %w[L1-12],
    "manual" => manual([
      ["M05-01", "visual regression suite", "explicitly NOT waived by AES approval §4; not executed"],
      ["M05-02", "axe accessibility audit (WCAG 2.2 / WAI-ARIA)", "explicitly NOT waived by AES approval §4; not executed"],
      ["M05-03", "keyboard navigation audit", "explicitly NOT waived by AES approval §4; not executed"],
      ["M05-04", "dark-mode / responsive review", "not executed"]
    ]) },
  { "id" => "P06", "name" => "Software Engineering", "aes_gate" => "AES-06-GATE-001",
    "automated" => %w[L2-01 L2-02 L2-03 L2-04 L2-05 L1-08 L1-09 L1-10 L1-11 L1-13],
    "manual" => manual([
      ["M06-01", "code review gate sign-off", "no independent review recorded"],
      ["M06-02", "complexity / duplication / maintainability audit", "not executed"]
    ]) },
  { "id" => "P07", "name" => "Cross-Platform Engineering", "aes_gate" => "AES-07-GATE-001",
    "automated" => %w[],
    "manual" => manual([
      ["M07-01", "Electron main/renderer isolation, CSP, IPC, preload security", "not executed"],
      ["M07-02", "web (native docs) / electron full build matrix", "not executed"],
      ["M07-03", "installer and upgrade verification", "not executed"]
    ]) },
  { "id" => "P08", "name" => "AI Agent Engineering", "aes_gate" => "AES-08-GATE-001",
    "automated" => %w[L1-03 L1-16],
    "manual" => manual([
      ["M08-01", "independent Agent behaviour-consistency test across task types", "only one task type executed"],
      ["M08-02", "third-party Agent runtime discovery cross-check (WorkBuddy vs Claude)", "static wiring verified; live cross-runtime discovery not executed"],
      ["M08-03", "Agent tool-adapter runtime scope verification", "not executed"]
    ]) },
  # §3 P09 PROVES quality. Security testing is executed/recorded here but its
  # REQUIREMENTS are defined by P10 — the two domains must not be conflated.
  { "id" => "P09", "name" => "Quality Engineering", "aes_gate" => "AES-09-GATE-001",
    "automated" => %w[L1-03 L1-15 L1-16 L2-06],
    "manual" => manual([
      ["M09-01", "documented test strategy and coverage evaluation (§9.1/§9.2)", "test strategy report not independently accepted"],
      ["M09-02", "defect management and closure evidence (§13.2)", "no closed-finding records with verification evidence"],
      ["M09-03", "quality metrics and quality acceptance decision (P09.6/P09.7)", "no signed quality acceptance decision"],
      ["M09-04", "security test execution recorded in P09 test system (P10.7)", "SAST/DAST/SCA/ASVS verification not executed"]
    ]) },
  # §3 P10 DEFINES the security and reliability requirements the system MUST meet.
  { "id" => "P10", "name" => "Security & Reliability", "aes_gate" => "AES-10-GATE-001",
    "automated" => %w[L1-15],
    "manual" => manual([
      ["M10-01", "threat model and security requirements baseline (P10.2)", "not executed"],
      ["M10-02", "OWASP ASVS-aligned input validation / XSS / CSRF / SSRF review", "not executed"],
      ["M10-03", "secret scan / SAST / dependency vulnerability scan", "explicitly NOT waived by AES approval §4; not executed"],
      ["M10-04", "measurable reliability objectives, backup/DR and incident drill (P10.8-10.11)", "not executed"]
    ]) },
  # Business domain rules belong to UTER P13 (Layer B), never to AES P10.
  { "id" => "UTER-P13", "name" => "Business Domain Engineering", "aes_gate" => nil,
    "automated" => %w[L1-14 L2-08 L2-09],
    "manual" => manual([
      ["M13-01", "three-database migration / recovery verification", "explicitly NOT waived by AES approval §4; not executed"],
      ["M13-02", "payment success / local-order anomaly window and duplicate notification", "not executed in an isolated test environment"],
      ["M13-03", "concurrent balance deduction and idempotent accounting", "no concurrency drill evidence"],
      ["M13-04", "multi-instance consistency and task recovery", "not executed"],
      ["M13-05", "10 UTER P13 business domains independently accepted (§4)", "only repository inventory completed; domain acceptance NOT_ASSESSED"]
    ]) },
  { "id" => "P11", "name" => "DevOps & Delivery", "aes_gate" => "AES-11-GATE-001",
    "automated" => %w[L1-01 L1-02],
    "manual" => manual([
      ["M11-01", "CI/CD workflow audit and evidence of a green run at this exact head", "no CI run exists for the uncommitted execution branch"],
      ["M11-02", "artifact integrity, release / rollback and environment isolation", "not executed"]
    ]) },
  { "id" => "P12", "name" => "Lifecycle & Evolution", "aes_gate" => "AES-12-GATE-001",
    "automated" => %w[],
    "manual" => manual([
      ["M12-01", "standard upgrade compatibility and deprecation management", "not executed"],
      ["M12-02", "periodic compliance audit and technical-debt lifecycle", "not executed"],
      ["M12-03", "migration / rollback plan validation", "not executed"]
    ]) }
].freeze

RUNTIME = {
  "preflight" => preflight["overall"], "selftest" => selftest["overall"],
  "verify" => runtime_verify["overall"], "workspace" => runtime_workspace["overall"]
}.freeze

def domain_status(domain, by_id)
  auto = domain["automated"].map do |id|
    { "id" => id, "status" => (by_id.dig(id, "status") || "NOT_RUN") }
  end
  auto_fail = auto.reject { |a| a["status"] == "PASS" }
  manual_open = domain["manual"].reject { |m| m["status"] == "VERIFIED" }
  status = if auto_fail.any? && manual_open.any? then "BLOCKED"
           elsif auto_fail.any? then "FAIL"
           elsif manual_open.any? then "BLOCKED"
           else "PASS"
           end
  [status, auto, auto_fail, manual_open]
end

domains = DOMAINS.map do |d|
  status, auto, auto_fail, manual_open = domain_status(d, by_id)
  aes_gate = d["aes_gate"] ? (aes_gate_index[d["aes_gate"]] || {}) : {}
  {
    "id" => d["id"], "name" => d["name"], "status" => status,
    "classification" => d["id"] == "UTER-P13" ? "UTER_PROJECT_SPECIFIC_EXTENSION" : "AES_UNIVERSAL_DOMAIN",
    "aes_gate_id" => d["aes_gate"],
    "aes_gate_execution" => d["aes_gate"] ? (aes_gate["execution"] || "UNKNOWN") : "NOT_APPLICABLE",
    "automated_evidence" => auto,
    "live_agent_runtime_evidence" => RUNTIME,
    "failed_automated" => auto_fail.map { |a| a["id"] },
    "open_manual_acceptance" => manual_open,
    "acceptance_criteria" => "§16.3: requirement coverage + implementation + control effectiveness + verification results + exceptions + evidence completeness all satisfied",
    "blocking_reason" => if auto_fail.any?
                           "automated checks not passing: #{auto_fail.map { |a| "#{a['id']}=#{a['status']}" }.join(', ')}"
                         elsif manual_open.any?
                           "#{manual_open.length} manual acceptance item(s) lack real verification evidence"
                         else
                           nil
                         end
  }
end

l3 = {
  "evidence_id" => "GATE-L3-DOMAINS", "generated_at" => now,
  "related_requirement" => "§8.2 Domain Acceptance Gate / §16.3 independent domain acceptance",
  "uter_commit" => matrix["uter_commit"], "aes_commit" => aes_commit,
  "domain_count" => domains.length,
  "aes_domain_count" => domains.count { |d| d["classification"] == "AES_UNIVERSAL_DOMAIN" },
  "uter_project_domain_count" => domains.count { |d| d["classification"] == "UTER_PROJECT_SPECIFIC_EXTENSION" },
  "pass_count" => domains.count { |d| d["status"] == "PASS" },
  "status" => domains.all? { |d| d["status"] == "PASS" } ? "PASS" : "BLOCKED",
  "aes_governance_layer_note" => "All 13 AES governance-layer L3 gates remain execution=NOT_RUN per AES .aes/registry/gates.yaml. UTER-P13 is a Uter Layer B extension and has no AES gate. Uter-side evaluations above do not rewrite the AES gate status.",
  "manual_acceptance_evidence" => {
    "trusted" => MANUAL_TRUSTED,
    "run_id" => MANUAL_EXECUTION && MANUAL_EXECUTION["run_id"],
    "integrity_status" => MANUAL_INTEGRITY && MANUAL_INTEGRITY["status"],
    "run_state" => MANUAL_RUN_STATE && MANUAL_RUN_STATE["state"],
    "execution_summary" => MANUAL_EXECUTION && MANUAL_EXECUTION["summary"],
    "category_summary" => MANUAL_INVENTORY && MANUAL_INVENTORY["category_summary"],
    "acceptance_authority_recorded" => ACCEPTANCE_RECORDED,
    "acceptance_decision" => MANUAL_INVENTORY && MANUAL_INVENTORY.dig("acceptance_decision", "status"),
    "verified_item_count" => MANUAL_TRUSTED ? MANUAL_INVENTORY["items"].count { |i| i["acceptance_status"] == "VERIFIED" } : 0,
    "note" => "Execution evidence is recorded per item (§14.3) but does NOT constitute human acceptance. Only an explicit per-item sign-off from the recorded acceptance authority can set VERIFIED."
  },
  "domains" => domains
}
dump("l3-domain-gates.json", l3)

# --------------------------------------------------------------------------
# L4_GLOBAL_CONFORMANCE_GATE — §16.4 mandatory global assessment conditions
# --------------------------------------------------------------------------
runtime_all_pass = RUNTIME.values.all? { |v| v == "PASS" }
separation_pass = separation && separation["overall"] == "PASS"
boundary_pass = boundary && boundary["overall"] == "PASS"
independent_done = independent && independent["independent_assessment_completed"] == true

ma_summary = (MANUAL_EXECUTION && MANUAL_EXECUTION["summary"]) || {}
ma_gaps = []
ma_gaps << "MA FAIL=#{ma_summary['FAIL']}" if ma_summary["FAIL"].to_i > 0
ma_gaps << "MA NOT_RUN=#{ma_summary['NOT_RUN']}" if ma_summary["NOT_RUN"].to_i > 0
ma_gaps << "MA TIMEOUT=#{ma_summary['TIMEOUT']}" if ma_summary["TIMEOUT"].to_i > 0
ma_gaps << "integrity=#{MANUAL_INTEGRITY && MANUAL_INTEGRITY['status'] || 'MISSING'}"
ma_gaps << "verified_items=#{l3.dig('manual_acceptance_evidence', 'verified_item_count')}/42"

# §16.4 L4-11 / L4-12 used to be literal `false`, which made them impossible
# to satisfy even after the real evidence arrived. That is a gate defect, not
# an honest status: a condition that can never flip cannot decide anything.
# Both are now derived from evidence and remain NOT_MET today — the point of
# the change is that they are *decidable*, not that they pass.
#
# L4-11 requires a human risk-owner acceptance. A structured APPROVED_EXCEPTION
# row (authority + review date, §13.4) or an explicit owner decision to ACCEPT
# residual risk counts. The owner's actual 2026-11-08 decision O-11 was "补齐"
# (remediate), NOT "接受残留风险" (accept), so this stays NOT_MET.
EXCEPTION_ROW = /^\|\s*EXC-[A-Z0-9-]+\s*\|.*APPROVED_EXCEPTION/.freeze
approved_exceptions = Dir.glob(File.join(REPORTS, "D28-*.md")).flat_map do |p|
  File.readlines(p).grep(EXCEPTION_ROW)
end
owner_decision_o11 = ACCEPTANCE_AUTHORITY.is_a?(Hash) ?
  (ACCEPTANCE_AUTHORITY.dig("owner_decisions_2026_11_08", "O-11") || "") : ""
risk_owner_accepted = owner_decision_o11.include?("接受残留风险")
open_findings_reviewed = report?("D10") && report?("D11") && report?("D28")
l4_11_met = open_findings_reviewed &&
  (approved_exceptions.any? || risk_owner_accepted) &&
  # Even with an exception, an unresolved finding cannot be reviewed-away.
  Array(independent && independent["open_findings"]).empty?

# L4-12 asks for control *effectiveness* (§16.1 dimension 4), a different
# question from "did the control run" (dimensions 1-3). It can only be MET
# when the independent assessment records an effectiveness re-evaluation that
# explicitly distinguishes the two; today's assessment does not, so NOT_MET.
effectiveness = independent.is_a?(Hash) ? independent["control_effectiveness"] : nil
l4_12_met = effectiveness.is_a?(Hash) &&
  effectiveness["status"] == "PASS" &&
  effectiveness["distinguishes_operation_from_effectiveness"] == true &&
  effectiveness.dig("dimension_4_effectiveness", "total").to_i > 0 &&
  effectiveness.dig("dimension_4_effectiveness", "passed") == effectiveness.dig("dimension_4_effectiveness", "total")
effectiveness_note = if effectiveness.is_a?(Hash)
  probes = effectiveness.dig("dimension_4_effectiveness", "passed")
  total = effectiveness.dig("dimension_4_effectiveness", "total")
  "control_effectiveness=#{effectiveness['status']} (#{probes}/#{total} assessor-executed fault-injection probes); " \
    "scope=#{effectiveness['scope']}; scope_limited=#{effectiveness['scope_limited']}; " \
    "human/third-party/external-environment controls are explicitly OUT OF SCOPE and remain NOT_MET"
else
  "control operation vs effectiveness not independently evaluated (control_effectiveness=ABSENT)"
end

evidence_sufficiency = MANUAL_TRUSTED && l3["pass_count"] == 14 &&
  ma_summary["FAIL"].to_i.zero? && ma_summary["NOT_RUN"].to_i.zero? &&
  ma_summary["TIMEOUT"].to_i.zero? &&
  l3.dig("manual_acceptance_evidence", "verified_item_count") == 42

authority_note = if ACCEPTANCE_RECORDED
  "authority recorded = #{ACCEPTANCE_AUTHORITY['authority_name']} (#{ACCEPTANCE_AUTHORITY['source']}); " \
    "acceptance decision = #{MANUAL_INVENTORY && MANUAL_INVENTORY.dig('acceptance_decision', 'status') || 'NOT_RECORDED'}; " \
    "no item-level sign-off and no global conformity claim (§18)"
else
  "no authorized human acceptance decision exists; WorkBuddy must not override required human approvals (§18)"
end

conditions = [
  ["L4-01", "AES approved baseline pinned and re-verified (§18 step 1)",
   evidence_status(by_id, "L1-04") == "PASS" && evidence_status(by_id, "U-01") == "PASS",
   "aes-pin-check.sh + validate-registry.mjs", "integration status is MIGRATION_PENDING, not conformance"],
  ["L4-02", "external standards applicability register + standards baseline (D01/D02, §2.1/§2.2)",
   report?("D01") && report?("D02"), "D01 / D02", "25-item §2.1 catalogue applicability decisions required per standard"],
  ["L4-03", "assessed system boundary declared + two-repository separation verified (§16.4 / §1.3)",
   report?("D03") && report?("D04") && separation_pass, "D03 / D04 / governance-separation.json", "separation gate must inspect both real repositories"],
  ["L4-04", "all 14 applicable domains independently assessed (§16.3)",
   l3["domain_count"] == 14 && l3["aes_domain_count"] == 13 && l3["uter_project_domain_count"] == 1,
   "l3-domain-gates.json", "assessment != acceptance"],
  ["L4-05", "14 L3_DOMAIN_ACCEPTANCE_GATE results all PASS (§8.2/§8.3)",
   l3["status"] == "PASS", "l3-domain-gates.json", "#{l3['pass_count']}/14 PASS; NOT_RUN never counted as PASS"],
  ["L4-06", "L1_CHANGE_GATE PASS", l1_status == "PASS",
   "test-matrix.json L1 rows", "#{l1_fail.length} L1 failure(s)"],
  ["L4-07", "L2_INTEGRATION_GATE PASS", l2_status == "PASS",
   "test-matrix.json L2 rows", "#{l2_fail.length} L2 failure(s)"],
  ["L4-08", "P09 proves / P10 defines boundary verified (§1.3/§3)",
   boundary_pass, "p09-p10-boundary.json", "neither domain may substitute for the other"],
  ["L4-09", "WorkBuddy runtime behaviour validated incl. over-privilege denial (§18 step 14)",
   runtime_all_pass && selftest["passed"] == selftest["total_cases"],
   "agent-runtime-*.json", "preflight/selftest/verify/workspace all required"],
  ["L4-10", "all applicable requirements evaluated (D05/D08/D09, §16.4)",
   report?("D05") && report?("D08") && report?("D09") && l3["pass_count"] == 14,
   "D05 / D08 / D09", "material applicable requirements remain unassessed"],
  ["L4-11", "approved exclusions, open findings and residual risks reviewed (D10/D11/D28, §16.4)",
   l4_11_met, "D10 / D11 / D28 / acceptance-authority.json",
   "no human risk-owner acceptance: owner decision O-11 = 补齐 (remediate), not 接受残留风险; approved_exceptions=#{approved_exceptions.length}; open_findings=#{Array(independent && independent['open_findings']).length}"],
  ["L4-12", "control effectiveness verified (§16.1 dimension 4)",
   l4_12_met, "§16.1 / Phase 6 / independent-assessment.json",
   effectiveness_note],
  ["L4-13", "evidence sufficiency confirmed (D25 / §14.1-14.4)",
   evidence_sufficiency, "D25 / manual-acceptance/execution.json / inventory.json / integrity.json",
   "open evidence gaps: #{ma_gaps.join(', ')}; MA-12 axe is now a real executed audit (not a toolchain probe); keyboard / three-database / human sign-off remain OPEN"],
  ["L4-14", "independent assessment completed (D26 / Phase 7 / §12)",
   independent_done, "independent-assessment.json / D26", "Phase 7 report must re-evaluate controls, evidence integrity and conformance claims"],
  ["L4-15", "acceptance authority recorded (§16.4)",
   ACCEPTANCE_RECORDED, "acceptance-authority.json / D27 acceptance record", authority_note],
  ["L4-16", "final conformity status honestly reported (D27 / §16.2 / §18 step 20)",
   report?("D27") && report?("D28"), "D27 / D28",
   "must distinguish implemented / verified / accepted / not applicable / blocked; no certification claim (§16.5)"]
].map do |id, desc, met, ev, note|
  { "id" => id, "description" => desc, "status" => met ? "MET" : "NOT_MET",
    "evidence" => ev, "note" => note }
end

l4 = {
  "evidence_id" => "GATE-L4-GLOBAL-CONFORMANCE", "generated_at" => now,
  "related_requirement" => "§8.2 Global Conformance Gate / §16.4 Global acceptance",
  "source_system" => "scripts/quality/aes-governance-gates.rb",
  "repository_revision" => { "uter_head" => matrix["uter_commit"], "aes_head" => aes_commit },
  "uter_commit" => matrix["uter_commit"], "aes_commit" => aes_commit,
  "aes_version" => pin["registry_version"], "aes_status" => pin["registry_status"],
  "aes_global_gate" => aes_gates.dig("global_gate", "execution"),
  "mandatory_conditions" => conditions.length,
  "met" => conditions.count { |c| c["status"] == "MET" },
  "not_met" => conditions.count { |c| c["status"] == "NOT_MET" },
  "status" => conditions.all? { |c| c["status"] == "MET" } ? "PASS" : "BLOCKED",
  "conditions" => conditions,
  "acceptance" => {
    "authority_recorded" => ACCEPTANCE_RECORDED,
    "authority" => ACCEPTANCE_RECORDED ? ACCEPTANCE_AUTHORITY["authority_name"] : nil,
    "authority_source" => ACCEPTANCE_RECORDED ? ACCEPTANCE_AUTHORITY["source"] : nil,
    "decision" => MANUAL_INVENTORY && MANUAL_INVENTORY.dig("acceptance_decision", "status"),
    "signoff_granted" => MANUAL_TRUSTED && MANUAL_GRANTED && MANUAL_VERIFIED.positive?,
    "verified_item_count" => l3.dig("manual_acceptance_evidence", "verified_item_count"),
    "note" => "L4-15 MET means ONLY that an authorized human acceptance authority has been recorded. It does NOT mean acceptance was granted: all 42 manual acceptance items remain NOT_VERIFIED pending the user's item-by-item review (§16.4 / §18)."
  },
  "rule" => "§16.4: a global conformity claim shall not be made while material applicable requirements remain unassessed or unsupported by evidence. A single unmet mandatory condition blocks L4; 14 L3 PASS alone does not satisfy it."
}
dump("l4-global-gate.json", l4)

# Emit the SEPARATE internal acceptance channel. This gate reads real AES
# AI-Native evidence and recomputes hashes; it never rewrites L1-L4 evidence.
ai_native_gate = AiNativeInternalGate.run(root: ROOT, aes_repo: AES_REPO, evidence_dir: EVIDENCE, out_dir: OUT)

# Markdown summary for humans.
md = +"# Gate evaluation summary (UTER-AES-GOV-001 §8.2 / §16)\n\n"
md << "- Generated: #{now}\n- Uter commit: `#{matrix['uter_commit']}`\n- AES commit: `#{aes_commit}` (#{pin['registry_version']} / #{pin['registry_status']})\n"
md << "- Conformance status vocabulary (§16.2): CONFORMANT / PARTIALLY CONFORMANT / NON-CONFORMANT / NOT ASSESSED / NOT APPLICABLE / BLOCKED\n\n"
md << "| Gate | Status | Detail |\n|---|---|---|\n"
md << "| L1_CHANGE_GATE | #{l1_status} | #{l1_rows.length} checks, #{l1_fail.length} failed |\n"
md << "| L2_INTEGRATION_GATE | #{l2_status} | #{l2_rows.length} checks, #{l2_fail.length} failed |\n"
md << "| L3_DOMAIN_ACCEPTANCE_GATE (14 domains) | #{l3['status']} | #{l3['pass_count']}/14 PASS |\n"
md << "| L4_GLOBAL_CONFORMANCE_GATE | #{l4['status']} | #{l4['met']}/#{conditions.length} mandatory conditions MET |\n"
md << "| AI_NATIVE_INTERNAL_ACCEPTANCE_GATE (separate channel) | #{ai_native_gate['verdict']} | internal governance acceptance only; L3/L4 evidence unchanged |\n\n"
md << "| Domain | Classification | Status | AES gate | Blocking reason |\n|---|---|---|---|---|\n"
domains.each do |d|
  md << "| #{d['id']} #{d['name']} | #{d['classification']} | #{d['status']} | #{d['aes_gate_execution']} | #{(d['blocking_reason'] || '-').to_s.gsub('|', '/')} |\n"
end
md << "\n## L4 mandatory conditions (§16.4)\n\n| ID | Status | Note |\n|---|---|---|\n"
conditions.each { |c| md << "| #{c['id']} | #{c['status']} | #{c['note'].to_s.gsub('|', '/')} |\n" }
File.write(File.join(OUT, "GATES-SUMMARY.md"), md)

puts "L1=#{l1_status} (#{l1_rows.length - l1_fail.length}/#{l1_rows.length})  L2=#{l2_status} (#{l2_rows.length - l2_fail.length}/#{l2_rows.length})"
puts "L3=#{l3['status']} (#{l3['pass_count']}/14 PASS; 13 AES + 1 UTER-P13)"
domains.each { |d| puts format("  %-9s %-8s %s", d["id"], d["status"], d["blocking_reason"] || "all acceptance items verified") }
puts "L4=#{l4['status']} (#{l4['met']}/#{conditions.length} MET)"
puts "AI_NATIVE_INTERNAL=#{ai_native_gate['verdict']} (#{ai_native_gate['check_summary']['pass']}/#{ai_native_gate['check_summary']['total']} checks; separate channel)"
puts "gates written to #{OUT}"

# Non-zero exit is an honest assessment result, not a harness crash. Callers
# must record the exit code as evidence rather than suppressing it.
exit(l4["status"] == "PASS" ? 0 : 1)
