#!/usr/bin/env ruby
# frozen_string_literal: true

# UTER-UAES-GOV-001 §12 Phase 7 / §16.1 / §16.4 / §14.3-14.4 / §15 D26
#
# Independent assessment. It does NOT trust the implementing Agent's own PASS
# declarations. It independently re-derives selected controls from source data:
#   * UAES pin (commit + registry blob SHA) computed with git hash-object.
#   * 14-domain count computed from the Uter registry and 13 UAES phases.
#   * every PASS in the test matrix matched to a real exit code in its raw log.
#   * every runtime DENY expectation matched to the recorded decision.
#   * no NOT_RUN / unexecuted item silently promoted to PASS in gate results.
#   * acceptance authority + manual-acceptance evidence re-hashed from raw logs.
#   * no unsupported global conformity claim while L4 is BLOCKED.
#
# It then reviews evidence integrity, open findings, exception approvals and
# conformance claims, and writes D26 + machine-readable evidence.
#
# Exit: 0 = assessment COMPLETED (findings may still be open; this is NOT approval)
#       1 = assessment BLOCKED because critical evidence is missing/unreadable.

require "json"
require "yaml"
require "time"
require "digest"
require "open3"
require "fileutils"

ROOT = File.expand_path("../..", __dir__)
UAES_ROOT = File.expand_path(ENV.fetch("UAES_REPO", File.join(ROOT, "..", "uaes")))
EVIDENCE = ENV.fetch("UAES_EVIDENCE_DIR", File.join(ROOT, "reports/compliance/uaes-full-migration-2026-11-06/evidence"))
REPORTS = ENV.fetch("UAES_REPORTS_DIR", File.dirname(EVIDENCE))
EVIDENCE_ID = "D26-INDEPENDENT-ASSESSMENT"

def now = Time.now.utc.iso8601

def load_json(name, required: true)
  path = File.join(EVIDENCE, name)
  unless File.file?(path)
    return nil unless required
    abort "BLOCKED: required evidence missing: #{path}"
  end
  JSON.parse(File.read(path))
rescue JSON::ParserError => e
  abort "BLOCKED: unreadable evidence #{path}: #{e.message}"
end

def git(*args)
  out, _err, st = Open3.capture3("git", "-C", ROOT, *args)
  [out.strip, st.exitstatus]
end

observations = []
findings = []
add_observation = lambda do |id, name, status, detail|
  observations << { "id" => id, "control" => name, "status" => status, "detail" => detail }
end
add_finding = lambda do |id, severity, title, detail, requirement|
  findings << { "finding_id" => id, "severity" => severity, "title" => title,
                "detail" => detail, "source_requirement" => requirement,
                "lifecycle_status" => "IDENTIFIED", "verification_status" => "NOT_VERIFIED" }
end

matrix = load_json("test-matrix.json")
l3 = load_json("gates/l3-domain-gates.json")
l4 = load_json("gates/l4-global-gate.json")
selftest = load_json("agent-runtime-selftest.json")
pin = JSON.parse(File.read(File.join(ROOT, ".uaes/uaes-pin.json")))
uter_registry = YAML.safe_load_file(File.join(ROOT, ".uaes/uter-governance-registry.yaml"))
uaes_registry = YAML.safe_load_file(File.join(UAES_ROOT, ".uaes/STANDARD-REGISTRY.yaml"))

# ---- 1. Re-derive the pinned UAES baseline (§18 step 1, §2.3) ------------
uaes_head = Open3.capture3("git", "-C", UAES_ROOT, "rev-parse", "HEAD")[0].strip
blob_out, _blob_err, blob_st = Open3.capture3("git", "-C", UAES_ROOT, "hash-object", ".uaes/STANDARD-REGISTRY.yaml")
computed_blob = blob_st.success? ? blob_out.strip : nil
pin_ok = uaes_head == pin["source_commit"] && computed_blob == pin["registry_blob_sha"] &&
         pin["registry_version"] == "1.9.0" && pin["registry_status"] == "APPROVED"
add_observation.call("IA-01", "pinned UAES approved baseline re-derived", pin_ok ? "PASS" : "FAIL",
                     { "pinned_commit" => pin["source_commit"], "actual_commit" => uaes_head,
                       "pinned_blob" => pin["registry_blob_sha"], "computed_blob" => computed_blob,
                       "version" => pin["registry_version"], "status" => pin["registry_status"] })
add_finding.call("FIND-IA-01", "Critical", "UAES baseline pin does not match the repository",
                 "Independent recomputation of commit / registry blob disagrees with .uaes/uaes-pin.json",
                 "§2.3 / §18 step 1") unless pin_ok

# ---- 2. Re-derive the 14-domain assessment scope (§16.3) ----------------
uter_domains = (uter_registry.dig("gate_architecture", "domain_ids") || []).map(&:to_s)
uaes_phases = (uaes_registry["phases"] || {}).keys
scope_ok = uaes_phases.length == 13 && uaes_phases.sort == (0..12).map { |n| format("P%02d", n) } &&
           uter_domains.length == 14 && uter_domains.count("UTER-P13") == 1 &&
           (uter_domains - uaes_phases) == ["UTER-P13"] &&
           (l3["domain_count"] == 14 rescue false)
add_observation.call("IA-02", "14 independently assessed domains re-derived from source", scope_ok ? "PASS" : "FAIL",
                     { "uaes_phases" => uaes_phases.length, "uter_registry_domains" => uter_domains.length,
                       "extra_domain" => (uter_domains - uaes_phases), "gate_evaluator_domain_count" => (l3["domain_count"] rescue nil) })
add_finding.call("FIND-IA-02", "High", "assessment scope is not 13 UAES + 1 UTER-P13",
                 "Independent recomputation disagrees with the declared 14-domain scope", "§16.3") unless scope_ok

# ---- 3. Re-derive every PASS from its raw exit code (§8.3 / §9.3) --------
bogus = []
matrix["results"].select { |r| r["status"] == "PASS" }.each do |r|
  log = File.join(ROOT, r["log"])
  body = File.file?(log) ? File.read(log) : ""
  bogus << r["id"] unless r["exit_code"] == 0 && body.include?("# exit_code: 0")
end
matrix_ok = bogus.empty?
add_observation.call("IA-03", "no PASS without a real exit code in its raw log", matrix_ok ? "PASS" : "FAIL",
                     { "pass_count" => matrix["passed"], "unverifiable_pass_rows" => bogus,
                       "explicit_skips" => matrix["skipped"],
                       "note" => "Skips are recorded explicitly and are never counted as PASS (§8.3)." })
add_finding.call("FIND-IA-03", "Critical", "a PASS row lacks real execution evidence",
                 "Rows #{bogus.join(', ')} claim PASS but their raw log/exit code does not support it", "§8.3 / §9.3") unless bogus.empty?

# ---- 4. Re-derive runtime fail-closed decisions (§6.6 / §18 step 14) ----
bad_denials = (selftest["cases"] || []).reject do |c|
  expected = c["expected"]
  actual = c["actual"].to_s
  (expected == "DENY" && actual.include?("DENY")) ||
    (expected == "ALLOW" && actual.include?("ALLOW")) ||
    expected.start_with?("overall=")
end
runtime_ok = selftest["overall"] == "PASS" && bad_denials.empty? &&
             selftest["passed"] == selftest["total_cases"]
add_observation.call("IA-04", "over-privilege DENY expectations re-checked", runtime_ok ? "PASS" : "FAIL",
                     { "cases" => selftest["total_cases"], "passed" => selftest["passed"],
                       "mismatches" => bad_denials.map { |c| c["case"] } })

# ---- 5. Re-derive gate honesty: NOT_RUN must never be PASS ---------------
promoted = (l3["domains"] || []).select do |d|
  d["status"] == "PASS" && (d["automated_evidence"] || []).any? { |a| a["status"] != "PASS" }
end
l3_ok = promoted.empty?
add_observation.call("IA-05", "no NOT_RUN/FAIL promoted to a PASS domain", l3_ok ? "PASS" : "FAIL",
                     { "domain_count" => l3["domain_count"], "pass_count" => l3["pass_count"],
                       "improperly_passed_domains" => promoted.map { |d| d["id"] } })
add_finding.call("FIND-IA-05", "Critical", "NOT_RUN reported as PASS",
                 "Domains #{promoted.map { |d| d['id'] }.join(', ')} are PASS despite incomplete automated evidence",
                 "§8.3 / §18 prohibitions") unless l3_ok

# ---- 5b. Independently re-derive acceptance authority + evidence trust -----
# The gate evaluator must not be the only place that asserts the authority was
# recorded. Re-read the user-authored record and the collector's raw logs here.
ma_dir = File.join(EVIDENCE, "manual-acceptance")
authority = begin
  p = File.join(ma_dir, "acceptance-authority.json")
  File.file?(p) ? JSON.parse(File.read(p)) : nil
rescue JSON::ParserError
  nil
end
ma_exec = begin
  p = File.join(ma_dir, "execution.json")
  File.file?(p) ? JSON.parse(File.read(p)) : nil
rescue JSON::ParserError
  nil
end
ma_integrity = begin
  p = File.join(ma_dir, "integrity.json")
  File.file?(p) ? JSON.parse(File.read(p)) : nil
rescue JSON::ParserError
  nil
end
ma_state = begin
  p = File.join(ma_dir, "run-state.json")
  File.file?(p) ? JSON.parse(File.read(p)) : nil
rescue JSON::ParserError
  nil
end
ma_inv = begin
  p = File.join(ma_dir, "inventory.json")
  File.file?(p) ? JSON.parse(File.read(p)) : nil
rescue JSON::ParserError
  nil
end

# Re-hash every recorded log ourselves instead of trusting integrity.json.
ma_hash_bad = []
if ma_exec
  ma_exec.fetch("cases", []).each do |c|
    log = File.join(ma_dir, "#{c['evidence_id']}.log")
    actual = File.file?(log) ? Digest::SHA256.file(log).hexdigest : nil
    ma_hash_bad << c["evidence_id"] if actual != c["log_sha256"]
  end
end
ma_signed = ma_inv ? ma_inv.fetch("items", []).count { |i| i["acceptance_status"] == "VERIFIED" } : nil
authority_ok = authority.is_a?(Hash) &&
  authority["source"] == "USER_EXPLICIT_DESIGNATION" &&
  !authority["authority_name"].to_s.empty? &&
  authority["signoff_granted"] == false &&
  Array(authority["signed_item_ids"]).empty? &&
  ma_exec.is_a?(Hash) && ma_integrity.is_a?(Hash) && ma_state.is_a?(Hash) && ma_inv.is_a?(Hash) &&
  ma_integrity["status"] == "PASS" && ma_state["state"] == "COMPLETED" &&
  ma_state["run_id"] == ma_exec["run_id"] && ma_inv["run_id"] == ma_exec["run_id"] &&
  ma_hash_bad.empty? && ma_signed == 0 &&
  l4.dig("acceptance", "authority_recorded") == true &&
  l4.dig("acceptance", "signoff_granted") == false
add_observation.call("IA-07", "acceptance authority + manual evidence independently re-derived", authority_ok ? "PASS" : "FAIL",
                     { "authority_source" => authority && authority["source"],
                       "run_state" => ma_state && ma_state["state"],
                       "collector_integrity" => ma_integrity && ma_integrity["status"],
                       "independent_hash_mismatches" => ma_hash_bad,
                       "verified_items" => ma_signed,
                       "l4_signoff_granted" => l4.dig("acceptance", "signoff_granted"),
                       "note" => "An authority record is NOT an acceptance decision; local execution evidence must not auto-promote any of the 42 items." })
add_finding.call("FIND-IA-11", "Critical", "acceptance authority or manual-acceptance evidence chain is not trustworthy",
                 "Independent re-derivation disagrees with the gate evaluator's acceptance record (§14.3 / §16.4 / §18)",
                 "§14.3 / §16.4 / §18") unless authority_ok

# ---- 6. Evidence integrity (§14.3 / §14.4) -------------------------------
required_fields = %w[evidence_id related_requirement source_system repository_revision collector collection_time integrity storage_reference access_restrictions]
evidence_files = %w[governance-separation.json p09-p10-boundary.json independent-assessment.json]
integrity_rows = evidence_files.map do |f|
  path = File.join(EVIDENCE, f)
  next { "file" => f, "present" => false, "sha256" => nil, "missing_fields" => required_fields } unless File.file?(path)
  j = JSON.parse(File.read(path)) rescue {}
  { "file" => f, "present" => true, "sha256" => Digest::SHA256.file(path).hexdigest,
    "generated_at" => j["generated_at"], "missing_fields" => required_fields.reject { |k| j.key?(k) } }
end
# This assessment file is written at the end of this run, so its own hash is
# computed after writing; record that explicitly instead of faking it.
integrity_note = "SHA-256 values support evidence integrity only; they do not prove the underlying activity was performed correctly (§14.4). The independent-assessment.json row is self-referential and is re-hashed by the next assessment run."

# ---- 7. Open findings / exceptions / conformance claims (§16.4) ----------
open_manual = (l3["domains"] || []).sum { |d| (d["open_manual_acceptance"] || []).length }
not_met = (l4["conditions"] || []).count { |c| c["status"] == "NOT_MET" }
matrix_fail = matrix["failed"]
# Only a STRUCTURED, granted exception record counts. Prose that merely mentions
# the term (e.g. "No `APPROVED_EXCEPTION` records exist." or the L4-11 note
# explaining §13.4 requirements) must NOT be mistaken for an approval: doing so
# silently drops FIND-IA-10 and overstates the accepted-risk position.
# A real row has the form: | EXC-<id> | ... | APPROVED_EXCEPTION | authority | date |
EXCEPTION_ROW = /^\|\s*EXC-[A-Z0-9-]+\s*\|.*APPROVED_EXCEPTION/.freeze
exceptions_found = Dir.glob(File.join(REPORTS, "D28-*.md")).flat_map do |p|
  File.readlines(p).grep(EXCEPTION_ROW)
end

claims = Dir.glob(File.join(REPORTS, "D27-*.md")).map do |p|
  body = File.read(p)
  { "file" => File.basename(p), "claims_conformant" => body.include?("**CONFORMANT**") || body.include?("status: CONFORMANT"),
    "disclaims_certification" => body.include?("§16.5") || body.include?("certification") }
end
unsupported_claim = l4["status"] != "PASS" && claims.any? { |c| c["claims_conformant"] }
add_observation.call("IA-06", "no unsupported global conformity claim while L4 is BLOCKED", !unsupported_claim ? "PASS" : "FAIL",
                     { "l4_status" => l4["status"], "not_met_conditions" => not_met, "d27_claims" => claims })
add_finding.call("FIND-IA-06", "Critical", "unsupported global conformity claim",
                 "D27 claims CONFORMANT while L4_GLOBAL_CONFORMANCE_GATE is #{l4['status']}", "§16.4 / §18") if unsupported_claim

# Aggregate unresolved findings, honestly.
add_finding.call("FIND-IA-07", "High", "#{open_manual} domain acceptance items remain unverified",
                 "14 domains have unresolved manual acceptance evidence (§16.3)", "§16.3 / §8.2") if open_manual.positive?
add_finding.call("FIND-IA-08", "High", "#{not_met} L4 global conditions remain NOT_MET",
                 "Global acceptance cannot be granted (§16.4)", "§16.4") if not_met.positive?
add_finding.call("FIND-IA-09", "Medium", "#{matrix_fail} test-matrix commands FAIL",
                 "Each failure is recorded with its raw log and exit code; no failure is masked or reinterpreted as a skip", "§8.2 / §9.3") if matrix_fail.positive?
add_finding.call("FIND-IA-10", "Low", "no APPROVED_EXCEPTION records granted",
                 "All unmet requirements remain open; no risk-owner acceptance exists (§13.4 / §16.4)", "§13.4") if exceptions_found.empty?

assessment_ok = pin_ok && scope_ok && matrix_ok && runtime_ok && l3_ok && authority_ok && !unsupported_claim

payload = {
  "evidence_id" => EVIDENCE_ID, "generated_at" => now,
  "related_requirement" => "§12 Phase 7 / §16.1 / §16.4 / §14.3-14.4 / §15 D26",
  "source_system" => "scripts/quality/uter-independent-assessment.rb",
  "execution_environment" => { "ruby" => RUBY_VERSION, "uter_root" => ROOT, "uaes_root" => UAES_ROOT },
  "repository_revision" => { "uter_head" => git("rev-parse", "HEAD")[0], "uaes_head" => uaes_head },
  "collector" => "WorkBuddy (Tencent Hunyuan Hy) — independent assessment pass, re-derived from source, not from remediation self-declarations",
  "collection_time" => now,
  "integrity" => { "evidence_hashes" => integrity_rows, "note" => integrity_note },
  "storage_reference" => EVIDENCE,
  "access_restrictions" => "local repository evidence; no credentials or production data",
  "assessment_scope" => {
    "system_boundary" => "Uter repository (Layer B) + pinned UAES 1.9.0 baseline (Layer A, read-only) + WorkBuddy/CI assurance (Layer C)",
    "standards_baseline" => "UTER-UAES-GOV-001 + UAES 1.9.0 APPROVED + §2.1 external standards catalogue",
    "domains" => 14
  },
  "independent_assessment_completed" => true,
  "independent_re_evaluation" => observations,
  "evidence_integrity_review" => integrity_rows,
  "open_findings" => findings,
  "exception_approvals" => { "count" => exceptions_found.length, "note" => "No risk-owner approval may be assumed (§13.4 / §18)." },
  "conformance_claim_review" => {
    "l4_status" => l4["status"], "unsupported_claim" => unsupported_claim,
    "certification_distinction" => "§16.5: this internal assessment is not ISO/IEC/IEEE/NIST/OWASP certification."
  },
  "verdict" => {
    "independent_assessment" => "COMPLETED",
    "conformance_claim_supported" => false,
    "reason" => "The independent re-evaluation completed, but 14 domain acceptances, control-effectiveness evaluation, evidence sufficiency, risk-owner acceptance and L4_GLOBAL_CONFORMANCE_GATE remain open. A completed assessment report is NOT an approval.",
    "recommended_conformance_status" => "PARTIALLY CONFORMANT (§16.2), with L4 BLOCKED"
  }
}

FileUtils.mkdir_p(EVIDENCE)
json_path = File.join(EVIDENCE, "independent-assessment.json")
File.write(json_path, JSON.pretty_generate(payload) + "\n")

md = +"# D26 — Independent Assessment Report\n\n"
md << "- Evidence ID: `#{EVIDENCE_ID}`\n- Generated: #{now}\n"
md << "- Collector: WorkBuddy independent assessment pass (re-derived from source, not from remediation self-declarations)\n"
md << "- Uter HEAD: `#{git('rev-parse', 'HEAD')[0]}`\n- UAES HEAD: `#{uaes_head}`\n\n"
md << "## Assessment scope (§16.4)\n\n"
md << "- System boundary: #{payload['assessment_scope']['system_boundary']}\n"
md << "- Standards baseline: #{payload['assessment_scope']['standards_baseline']}\n"
md << "- Domains independently assessed: 14 (P00–P12 + UTER-P13)\n\n"
md << "## Independent re-evaluation (not self-declarations)\n\n| ID | Control | Status | Detail |\n|---|---|---|---|\n"
observations.each { |o| md << "| #{o['id']} | #{o['control']} | #{o['status']} | #{o['detail'].to_s.gsub('|', '/').slice(0, 260)} |\n" }
md << "\n## Open findings (§13.1 / §13.2)\n\n| ID | Severity | Finding | Verification |\n|---|---|---|---|\n"
findings.each { |f| md << "| #{f['finding_id']} | #{f['severity']} | #{f['title']} | #{f['verification_status']} |\n" }
md << "\n## Evidence integrity (§14.4)\n\n"
integrity_rows.each { |r| md << "- `#{r['file']}` present=#{r['present']} sha256=`#{r['sha256'] || 'n/a'}` missing_fields=#{(r['missing_fields'] || []).join(',')}\n" }
md << "\n#{integrity_note}\n\n"
md << "## Conformance claim review\n\n"
md << "- L4_GLOBAL_CONFORMANCE_GATE: **#{l4['status']}** (#{l4['not_met']}/#{l4['mandatory_conditions']} NOT_MET)\n"
md << "- Unsupported CONFORMANT claim: **#{unsupported_claim}**\n"
md << "- Exception approvals: #{exceptions_found.length}\n"
md << "- §16.5: internal assessment is not external certification.\n\n"
md << "## Verdict\n\n"
md << "Independent assessment **COMPLETED**; conformance claim **NOT SUPPORTED**. "
md << "Recommended §16.2 status: **PARTIALLY CONFORMANT**, with L4 **BLOCKED**. "
md << "A completed assessment report is not an acceptance approval.\n"
File.write(File.join(REPORTS, "D26-INDEPENDENT-ASSESSMENT-REPORT.md"), md)

puts "independent assessment: COMPLETED re_evaluation=#{observations.count { |o| o['status'] == 'PASS' }}/#{observations.length}"
puts "open_findings=#{findings.length} l4=#{l4['status']} conformance_claim_supported=false"
puts "evidence: #{json_path}"
puts "report: #{File.join(REPORTS, 'D26-INDEPENDENT-ASSESSMENT-REPORT.md')}"
exit(assessment_ok ? 0 : 1)
