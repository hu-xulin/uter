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
require "timeout"
require "tmpdir"

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
#
# Pin schema 3.0.0 identifies the governed content by fingerprint, not by HEAD.
# The previous version of this check compared `git rev-parse HEAD` to
# source_commit, which is the defect that forced four manual re-pins during this
# governance run: every commit that governed nothing -- a report, a verifier fix
# -- expired the pin. An independent assessor reproducing that comparison would
# report FAIL for a baseline whose rules never changed, which is a false finding
# in exactly the control that is supposed to be trustworthy evidence.
#
# Two further defects were live here: the version and status literals were
# pinned to 1.9.0 / APPROVED, so the check had been asserting a baseline three
# releases old and could not pass at all. Both are now read from the pin and
# verified against the UAES registry rather than hard-coded.
uaes_head = Open3.capture3("git", "-C", UAES_ROOT, "rev-parse", "HEAD")[0].strip
blob_out, _blob_err, blob_st = Open3.capture3("git", "-C", UAES_ROOT, "hash-object", ".uaes/STANDARD-REGISTRY.yaml")
computed_blob = blob_st.success? ? blob_out.strip : nil

uaes_registry_version = uaes_registry.dig("registry", "version").to_s
uaes_registry_status  = uaes_registry.dig("registry", "status").to_s

# Independently recompute the governed fingerprint from the UAES bytes. The
# algorithm is NOT reimplemented here: a second implementation of "what counts
# as governed" would drift from the first and the drift would be unreviewable.
fp_out, fp_err, fp_st = Open3.capture3(
  "node", File.join(UAES_ROOT, "quality/scripts/uaes/governed-fingerprint.mjs"),
  "--require-intact", "--fingerprint-only"
)
live_fp = fp_st.success? ? fp_out.strip : nil
seal_intact = fp_st.exitstatus == 0
pinned_fp = pin["governed_fingerprint"].to_s

fingerprint_ok = !pinned_fp.empty? && live_fp == pinned_fp && seal_intact
# source_commit is provenance only: it names the tree the fingerprint came from.
# A differing HEAD with an identical fingerprint means no rule changed, and must
# not fail an independent assessment.
provenance_note =
  if uaes_head == pin["source_commit"]
    "source_commit matches HEAD"
  else
    "source_commit names a different tree, but the governed fingerprint is identical, so no governed rule changed"
  end

pin_ok = fingerprint_ok &&
         computed_blob == pin["registry_blob_sha"] &&
         pin["registry_version"] == uaes_registry_version &&
         pin["registry_status"] == uaes_registry_status

add_observation.call("IA-01", "pinned UAES approved baseline re-derived", pin_ok ? "PASS" : "FAIL",
                     { "pinned_fingerprint" => pinned_fp.empty? ? "(none)" : pinned_fp[0, 16],
                       "live_fingerprint" => live_fp ? live_fp[0, 16] : "(recompute failed: #{fp_err.to_s.strip[0, 120]})",
                       "seal_intact" => seal_intact,
                       "pinned_blob" => pin["registry_blob_sha"], "computed_blob" => computed_blob,
                       "version" => pin["registry_version"], "registry_version" => uaes_registry_version,
                       "status" => pin["registry_status"], "registry_status" => uaes_registry_status,
                       "pinned_commit" => pin["source_commit"], "actual_commit" => uaes_head,
                       "provenance" => provenance_note,
                       "method" => "governed-content fingerprint recomputed from UAES bytes (pin schema 3.0.0)" })
add_finding.call("FIND-IA-01", "Critical", "UAES baseline pin does not match the repository",
                 "Independent recomputation of the governed fingerprint / registry blob / version / status disagrees with .uaes/uaes-pin.json",
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

# The control's real subject is "no delegated / self-promoted sign-off", NOT
# "no sign-off at all". The old clause `ma_signed == 0` was a deadlock: the
# gate evaluator's L4-05/10/13 require all 42 items to be VERIFIED, so a
# genuinely completed item-by-item acceptance would make this independent
# control FAIL. Both states must be admissible, with different requirements:
#   * 0 signed  -> the authority must NOT claim a grant (today's state);
#   * 42 signed -> GRANTED decision, signed_item_ids exactly matches the
#                  VERIFIED set, and every item carries a named signer + time.
# A DELEGATED / blanket sign-off is rejected in BOTH states. This is a logic
# correction, not a relaxation: it still refuses any auto-promotion, and it
# adds checks the old clause did not have.
authority_h = authority.is_a?(Hash) ? authority : {}
ma_items = ma_inv.is_a?(Hash) ? Array(ma_inv["items"]) : []
verified_rows = ma_items.select { |i| i["acceptance_status"] == "VERIFIED" }
signed_ids = Array(authority_h["signed_item_ids"])
no_delegated_signoff =
  authority_h["decision"] != "DELEGATED_BLANKET_SIGNOFF" &&
  authority_h["signoff_basis"] != "DELEGATION" &&
  ma_items.none? { |i| i["signoff_nature"] == "DELEGATED" }
grant_consistent = if verified_rows.empty?
  authority_h["signoff_granted"] == false && signed_ids.empty?
else
  authority_h["signoff_granted"] == true &&
    authority_h["decision"] == "GRANTED" &&
    signed_ids.sort == verified_rows.map { |i| i["id"] }.sort &&
    verified_rows.all? { |i| !i["verified_by"].to_s.empty? &&
                              i["verified_by"] == authority_h["authority_name"] &&
                              !i["verified_at"].to_s.empty? }
end

authority_ok = authority.is_a?(Hash) &&
  authority["source"] == "USER_EXPLICIT_DESIGNATION" &&
  !authority["authority_name"].to_s.empty? &&
  no_delegated_signoff && grant_consistent &&
  ma_exec.is_a?(Hash) && ma_integrity.is_a?(Hash) && ma_state.is_a?(Hash) && ma_inv.is_a?(Hash) &&
  ma_integrity["status"] == "PASS" && ma_state["state"] == "COMPLETED" &&
  ma_state["run_id"] == ma_exec["run_id"] && ma_inv["run_id"] == ma_exec["run_id"] &&
  ma_hash_bad.empty? && ma_signed == verified_rows.length &&
  l4.dig("acceptance", "authority_recorded") == true &&
  l4.dig("acceptance", "signoff_granted") == verified_rows.any?
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

# ---- 6b. Control effectiveness (§16.1 dimension 4) ----------------------
# Dimensions 1-3 of §16.1 ask "did the control run?" — matrix exit codes,
# re-derived hashes, re-checked deny decisions. Dimension 4 asks a DIFFERENT
# question: "would the control actually catch a violation?" A green matrix
# cannot answer that. The assessor therefore executes fault-injection probes
# itself and records real exit codes; it never consumes a WorkBuddy-authored
# PASS declaration as effectiveness evidence.
#
# CE-05 is a direct injection performed by THIS assessor (not delegated to a
# test script): the same corpus must yield zero findings before the injected
# secret and at least one after it. That proves the gitleaks allowlist did not
# silently widen into a blanket suppression.
effectiveness_probes = [
  { "id" => "CE-01", "control" => "registry DRAFT/ACTIVE live derivation",
    "cwd" => ROOT, "cmd" => ["ruby", "scripts/quality/test-registry-draft-state.rb"],
    "marker" => /0 failures, 0 errors/, "negative_case" => "hard-coded 304 / stale registry fixture" },
  { "id" => "CE-02", "control" => "manual-acceptance evidence fail-closed",
    "cwd" => ROOT, "cmd" => ["ruby", "scripts/quality/test-uaes-manual-acceptance-boundary.rb"],
    "marker" => /0 failures, 0 errors/, "negative_case" => "auto-promoted VERIFIED item / broken integrity chain" },
  { "id" => "CE-03", "control" => "two-repository governance boundary deny paths",
    "cwd" => ROOT, "cmd" => ["ruby", "scripts/quality/test-uter-governance-boundaries.rb"],
    "marker" => /0 failures, 0 errors/, "negative_case" => "governance rules duplicated into product repo" },
  { "id" => "CE-04", "control" => "gitleaks allowlist narrowness regression",
    "cwd" => ROOT, "cmd" => ["bash", "scripts/quality/gitleaks-allowlist.test.sh"],
    "marker" => /injected real-form secret still detected/, "negative_case" => "real-form secret injected into an exempted-pattern file" },
  { "id" => "CE-06", "control" => "requirement resolver two-level coverage",
    "cwd" => UAES_ROOT, "cmd" => ["node", "quality/scripts/uaes/standards-for.test.mjs"],
    "marker" => /regression probe bites/, "negative_case" => "rule-only mapping resolves fewer requirements" },
]

effectiveness_rows = effectiveness_probes.map do |probe|
  t0 = Process.clock_gettime(Process::CLOCK_MONOTONIC)
  output, stderr, exit_code = "", "", nil
  begin
    Timeout.timeout(300) do
      output, stderr, st = Open3.capture3(*probe["cmd"], chdir: probe["cwd"])
      exit_code = st.exitstatus
    end
  rescue Timeout::Error, StandardError => e
    stderr = "#{e.class}: #{e.message}"
  end
  combined = "#{output}#{stderr}"
  marker_found = combined.match?(probe["marker"])
  { "id" => probe["id"], "control" => probe["control"],
    "method" => "assessor executes the control's negative case and checks its real exit code + assertion marker",
    "command" => probe["cmd"].join(" "), "cwd" => probe["cwd"],
    "negative_case" => probe["negative_case"],
    "exit_code" => exit_code, "marker_found" => marker_found,
    "duration_seconds" => (Process.clock_gettime(Process::CLOCK_MONOTONIC) - t0).round(3),
    "output_tail" => combined.strip.lines.last(4).join.strip.slice(0, 300),
    "status" => exit_code == 0 && marker_found ? "PASS" : "FAIL" }
end

# CE-05: assessor's own fault injection against the live gitleaks config.
ce05 = { "id" => "CE-05", "control" => "secret-scan allowlist does not mask a real leak",
         "method" => "assessor writes a corpus, scans it, injects a real-form secret, scans again" }
Dir.mktmpdir("uter-ia-ce-") do |dir|
  corpus = File.join(dir, "corpus.md")
  config = File.join(ROOT, ".quality/gitleaks.toml")
  report = File.join(dir, "report.json")
  File.write(corpus, "threat modeling, identity/access, application/API security, data protection.\n")
  scan = lambda do
    File.delete(report) if File.file?(report)
    _o, _e, st = Open3.capture3("gitleaks", "dir", corpus, "--no-banner", "--config", config,
                                 "--report-format", "json", "--report-path", report)
    found = File.file?(report) ? (JSON.parse(File.read(report)) rescue []) : []
    { "exit" => st.exitstatus, "findings" => found.length,
      "rules" => found.map { |f| f["RuleID"] }.uniq }
  end
  clean = scan.call
  # Assemble the probe token at runtime: a literal credential-shaped string in
  # this source file would itself be a (correctly detected) MA-06 finding once
  # committed. The two fragments are not a matchable token on their own.
  probe_token = "glpat-" + "1234567890abcdefghij"
  File.open(corpus, "a") { |f| f.puts "PROBE gitlab_token = \"#{probe_token}\"" }
  injected = scan.call
  ok = clean["exit"] == 0 && clean["findings"] == 0 &&
       injected["exit"] != 0 && injected["findings"] >= 1 &&
       injected["rules"].include?("gitlab-pat")
  ce05.merge!("clean_scan" => clean, "injected_scan" => injected,
              "status" => ok ? "PASS" : "FAIL")
end
effectiveness_rows << ce05

effectiveness_rows.sort_by! { |r| r["id"] }
effectiveness_ok = effectiveness_rows.all? { |r| r["status"] == "PASS" }
out_of_scope_controls = [
  "42 item-by-item human acceptance sign-offs (§14.3 / §18)",
  "independent third-party review conclusions for M00-02/M01-01/M06-01/M08-01/M08-02/M13-05",
  "human risk-owner residual-risk acceptance or APPROVED_EXCEPTION (§13.4)",
  "three-database / multi-instance / production-like DR drills",
  "CI/CD green run at the exact committed head (§11)",
]
control_effectiveness = {
  "status" => effectiveness_ok ? "PASS" : "FAIL",
  "distinguishes_operation_from_effectiveness" => true,
  "dimension_1_to_3_operation" => {
    "question" => "did the control run?",
    "evidence" => "test-matrix.json raw exit codes (IA-03), evidence hashes (§6), re-derived DENY decisions (IA-04)",
    "matrix_passed" => matrix["passed"], "matrix_failed" => matrix["failed"],
  },
  "dimension_4_effectiveness" => {
    "question" => "would the control catch a violation?",
    "method" => "assessor-executed fault injection / negative-case suites with real exit codes",
    "probes" => effectiveness_rows,
    "passed" => effectiveness_rows.count { |r| r["status"] == "PASS" },
    "total" => effectiveness_rows.length,
  },
  "scope" => "machine-executable controls in the Uter + pinned UAES repositories",
  "scope_limited" => true,
  "out_of_scope_controls" => out_of_scope_controls,
  "note" => "PASS here means the executed controls demonstrably reject injected violations. It does NOT mean human sign-off, third-party review, external-environment drills or risk-owner acceptance were performed; those remain NOT_MET in L4-05/10/11/13.",
}
add_observation.call("IA-08", "control effectiveness re-evaluated by fault injection", effectiveness_ok ? "PASS" : "FAIL",
                     { "probes" => effectiveness_rows.length,
                       "passed" => effectiveness_rows.count { |r| r["status"] == "PASS" },
                       "failed" => effectiveness_rows.reject { |r| r["status"] == "PASS" }.map { |r| r["id"] },
                       "distinguishes_operation_from_effectiveness" => true,
                       "scope" => control_effectiveness["scope"] })
add_finding.call("FIND-IA-12", "High", "control effectiveness fault-injection probe failed",
                 "An assessor-executed negative case did not behave as required: #{effectiveness_rows.reject { |r| r['status'] == 'PASS' }.map { |r| r['id'] }.join(', ')}",
                 "§16.1 dimension 4") unless effectiveness_ok

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

assessment_ok = pin_ok && scope_ok && matrix_ok && runtime_ok && l3_ok && authority_ok &&
               effectiveness_ok && !unsupported_claim

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
    "system_boundary" => "Uter repository (Layer B) + pinned UAES #{uaes_registry_version} #{uaes_registry_status} baseline (Layer A, read-only) + WorkBuddy/CI assurance (Layer C)",
    "standards_baseline" => "UTER-UAES-GOV-001 + UAES #{uaes_registry_version} #{uaes_registry_status} + §2.1 external standards catalogue",
    "domains" => 14,
    "baseline_source" => "read live from UAES/.uaes/STANDARD-REGISTRY.yaml; never hard-coded",
  },
  "independent_assessment_completed" => true,
  "independent_re_evaluation" => observations,
  "control_effectiveness" => control_effectiveness,
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
    "reason" => "The independent re-evaluation (including machine-executable control-effectiveness fault injection) completed, but 14 domain acceptances, 42 item-level human sign-offs, independent third-party review conclusions, evidence sufficiency, risk-owner acceptance and L4_GLOBAL_CONFORMANCE_GATE remain open. A completed assessment report is NOT an approval.",
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
md << "## Control effectiveness (§16.1 dimension 4)\n\n"
md << "**Operation (dimensions 1-3):** did the control run? Verified via raw exit codes, hashes and re-derived DENY decisions above. "
md << "**Effectiveness (dimension 4):** would it catch a violation? Verified by assessor-executed fault injection — these are different questions.\n\n"
md << "| Probe | Control | Negative case | Exit | Marker | Status |\n|---|---|---|---|---|---|\n"
effectiveness_rows.each do |r|
  md << "| #{r['id']} | #{r['control']} | #{r['negative_case']} | #{r['exit_code'].inspect} | #{r['marker_found'].inspect} | #{r['status']} |\n"
end
md << "\n- Result: **#{control_effectiveness['status']}** (#{control_effectiveness.dig('dimension_4_effectiveness', 'passed')}/#{control_effectiveness.dig('dimension_4_effectiveness', 'total')} probes), distinguishes operation from effectiveness = **true**.\n"
md << "- Scope: #{control_effectiveness['scope']}. **This PASS is scope-limited** and does not certify human sign-off, third-party review, external-environment drills or risk-owner acceptance.\n"
md << "- Out of scope (remain NOT_MET): #{out_of_scope_controls.join('; ')}.\n\n"
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
