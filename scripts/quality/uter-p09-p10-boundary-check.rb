#!/usr/bin/env ruby
# frozen_string_literal: true

# UTER-AES-GOV-001 §1.3 / §3 P09 / §3 P10 / §8.2 / §9 / §10 / §15 / §16.3
#
# P09 / P10 division-of-responsibility gate (user emphasis #2):
#   * P09 Quality Engineering PROVES whether engineering quality meets the
#     defined requirements (test strategy, execution, defect closure, metrics,
#     quality gates, quality acceptance).
#   * P10 Security & Reliability DEFINES what security and reliability
#     requirements the system must meet (threat model, controls, reliability
#     objectives, backup/DR, incident management).
#   * Security testing is REQUIRED by P10 and EXECUTED/RECORDED by the P09
#     test engineering system. Neither domain may substitute for the other.
#
# This gate also catches the concrete regression found in the V2 gate evaluator,
# which mislabelled P09 as "Security & Reliability" and P10 as
# "Business Domain Engineering" (the latter belongs to UTER P13, domain 14).
#
# Exit codes: 0 = boundary verified, 1 = violation/blocked.

require "json"
require "yaml"
require "time"
require "digest"
require "open3"
require "fileutils"

ROOT = File.expand_path("../..", __dir__)
AES_ROOT = File.expand_path(ENV.fetch("AES_REPO", File.join(ROOT, "..", "aes")))
EVIDENCE_DIR = ENV.fetch(
  "AES_EVIDENCE_DIR",
  File.join(ROOT, "reports/compliance/aes-full-migration-2026-11-06/evidence")
)
SPEC = File.join(ROOT, "uaes/standards/UTER-AES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md")
REGISTRY = File.join(ROOT, ".aes/uter-governance-registry.yaml")
GATE_EVALUATOR = File.join(ROOT, "scripts/quality/aes-governance-gates.rb")
EVIDENCE_ID = "D07-P09-P10-BOUNDARY"

P09_PROOF_HEADINGS = [
  "P09.1 Quality management", "P09.2 Code review and verification",
  "P09.3 Testing engineering", "P09.4 Defect management",
  "P09.5 Automated repair", "P09.6 Quality measurement", "P09.7 Quality acceptance"
].freeze
P10_DEFINE_HEADINGS = [
  "P10.1 Security governance", "P10.2 Threat modeling",
  "P10.3 Identity and access security", "P10.4 Application and API security",
  "P10.5 Data protection and privacy", "P10.6 Infrastructure and supply chain security",
  "P10.7 Security testing", "P10.8 Reliability engineering", "P10.9 Observability",
  "P10.10 Backup and disaster recovery", "P10.11 Incident management"
].freeze

def now = Time.now.utc.iso8601

def git_head(repo)
  out, _err, st = Open3.capture3("git", "-C", repo, "rev-parse", "HEAD")
  st.success? ? out.strip : "UNKNOWN"
end

def sha256(path) = (File.file?(path) ? Digest::SHA256.file(path).hexdigest : nil)

def section(text, start_heading, end_heading)
  a = text.index(start_heading)
  b = text.index(end_heading, a ? a + 1 : 0)
  return "" unless a
  text[a...(b || text.length)]
end

spec_text = File.file?(SPEC) ? File.read(SPEC) : ""
p09 = section(spec_text, "## P09 — Quality Engineering", "## P10 — Security & Reliability")
p10 = section(spec_text, "## P10 — Security & Reliability", "## P11 — DevOps & Delivery")
registry = File.file?(REGISTRY) ? (YAML.safe_load_file(REGISTRY) rescue nil) : nil
ownership = registry.is_a?(Hash) ? (registry["domain_ownership"] || {}) : {}
gates_rb = File.file?(GATE_EVALUATOR) ? File.read(GATE_EVALUATOR) : ""

checks = []
add = lambda do |id, name, ok, observation, requirement|
  checks << { "check" => id, "name" => name, "requirement" => requirement,
              "status" => ok ? "PASS" : "FAIL", "observation" => observation }
end

missing_p09 = P09_PROOF_HEADINGS.reject { |h| p09.include?("### #{h}") }
add.call("B01", "P09 owns the PROOF system (7 quality-engineering clauses)",
         !p09.empty? && missing_p09.empty?,
         { "p09_bytes" => p09.bytesize, "missing_headings" => missing_p09,
           "expected_headings" => P09_PROOF_HEADINGS },
         "§3 P09 / §9")

missing_p10 = P10_DEFINE_HEADINGS.reject { |h| p10.include?("### #{h}") }
add.call("B02", "P10 owns the REQUIREMENT baseline (11 security/reliability clauses)",
         !p10.empty? && missing_p10.empty?,
         { "p10_bytes" => p10.bytesize, "missing_headings" => missing_p10,
           "expected_headings" => P10_DEFINE_HEADINGS },
         "§3 P10 / §10")

proof_tokens = ["Test strategy", "Test execution", "Defect", "Quality measurement", "Test and review evidence"]
define_tokens = ["Threat modeling", "Reliability", "Backup and disaster recovery", "Incident management", "Security testing"]
add.call("B03", "P09 text describes proving; P10 text describes defining",
         proof_tokens.all? { |t| p09.include?(t) } && define_tokens.all? { |t| p10.include?(t) },
         { "p09_missing_tokens" => proof_tokens.reject { |t| p09.include?(t) },
           "p10_missing_tokens" => define_tokens.reject { |t| p10.include?(t) } },
         "§3 P09 / §3 P10")

crossed = []
crossed << "P09 defines threat modeling" if p09.include?("### P10.2 Threat modeling") || p09.include?("### Threat modeling")
crossed << "P09 defines backup/DR" if p09.include?("### Backup and disaster recovery")
crossed << "P10 owns test strategy" if p10.include?("### Test strategy")
crossed << "P10 owns quality measurement" if p10.include?("### Quality measurement")
add.call("B04", "no clause crosses the P09/P10 responsibility boundary",
         crossed.empty?, { "crossings" => crossed }, "§1.3 / §8.2")

shared = ownership["shared_gate"] || {}
add.call("B05", "security testing is required by P10 and executed/recorded by P09",
         shared["description"].to_s.include?("REQUIRED by P10") &&
           shared["description"].to_s.include?("EXECUTED/RECORDED by the P09"),
         { "shared_gate_description" => shared["description"] }, "§3 P10.7 / §9 / user directive")

p09_role = (ownership["P09"] || {})["role"]
p10_role = (ownership["P10"] || {})["role"]
add.call("B06", "Uter registry assigns PROVE to P09 and DEFINE to P10",
         p09_role == "PROVE" && p10_role == "DEFINE" &&
           shared["rule"].to_s.include?("neither may substitute"),
         { "P09" => { "name" => (ownership["P09"] || {})["name"], "role" => p09_role },
           "P10" => { "name" => (ownership["P10"] || {})["name"], "role" => p10_role },
           "shared_rule" => shared["rule"] },
         "§1.3 / §8.2")

forbidden_dup = shared["forbidden"] || []
add.call("B07", "duplicate/conflicting management system is explicitly forbidden",
         forbidden_dup.any? { |f| f.include?("conflicting management system") },
         { "forbidden" => forbidden_dup }, "§8.2 / user directive")

aes_registry_path = File.join(AES_ROOT, ".aes/STANDARD-REGISTRY.yaml")
aes_gates_path = File.join(AES_ROOT, ".aes/registry/gates.yaml")
aes_registry = File.file?(aes_registry_path) ? (YAML.safe_load_file(aes_registry_path) rescue nil) : nil
aes_gates = File.file?(aes_gates_path) ? (YAML.safe_load_file(aes_gates_path) rescue nil) : nil
phases = aes_registry.is_a?(Hash) ? (aes_registry["phases"] || {}) : {}
gates_by_id = aes_gates.is_a?(Hash) ? (aes_gates["gates"] || []).to_h { |g| [g["id"], g] } : {}
add.call("B08", "pinned AES baseline itself keeps P09=Quality / P10=Security",
         phases.dig("P09", "name").to_s.include?("Quality") &&
           phases.dig("P10", "name").to_s.include?("Security") &&
           gates_by_id.dig("AES-09-GATE-001", "name").to_s.include?("QUALITY-ENGINEERING") &&
           gates_by_id.dig("AES-10-GATE-001", "name").to_s.include?("SECURITY-RELIABILITY"),
         { "aes_P09" => phases.dig("P09", "name"), "aes_P10" => phases.dig("P10", "name"),
           "aes_gate_09" => gates_by_id.dig("AES-09-GATE-001", "name"),
           "aes_gate_10" => gates_by_id.dig("AES-10-GATE-001", "name") },
         "§1.3 / §16.3 / AES #{aes_registry.is_a?(Hash) ? aes_registry.dig('registry', 'version') : 'UNKNOWN'} registry (version read live, not hard-coded)")

add.call("B09", "local 14-domain gate evaluator labels P09/P10/P13 correctly",
         gates_rb.include?('"id" => "P09", "name" => "Quality Engineering"') &&
           gates_rb.include?('"id" => "P10", "name" => "Security & Reliability"') &&
           gates_rb.include?('"id" => "UTER-P13", "name" => "Business Domain Engineering"') &&
           !gates_rb.include?('"id" => "P10", "name" => "Business Domain Engineering"') &&
           !gates_rb.include?('"id" => "P09", "name" => "Security & Reliability"'),
         { "evaluator" => GATE_EVALUATOR.sub("#{ROOT}/", ""),
           "note" => "V2 evaluator mislabelled P09/P10 and put business rules in P10; UTER-AES-GOV-001 assigns them to P09/P10/UTER-P13." },
         "§8.2 / §16.3")

docs = {
  "AGENTS.md" => "P09 proves",
  ".aes/INTEGRATION.md" => "P09 / P10 division",
  ".aes/AI-GOVERNANCE-ENTRY.md" => "P09 proves",
  ".aes/TRACEABILITY.md" => "P09 / P10 division",
  ".aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md" => "P09 / P10 分工"
}
doc_missing = docs.reject { |p, phrase| File.file?(File.join(ROOT, p)) && File.read(File.join(ROOT, p)).include?(phrase) }.keys
add.call("B10", "all governance entrypoints state the same P09/P10 division",
         doc_missing.empty?, { "checked" => docs, "missing" => doc_missing }, "§1.3 / §6.4")

add.call("B11", "D14 and D15 are separate quality / security assessments",
         spec_text.include?("| D14 | Quality Engineering Assessment |") &&
           spec_text.include?("| D15 | Security Assessment |") &&
           spec_text.include?("| D16 | Reliability Assessment |"),
         { "deliverables" => %w[D14 D15 D16] }, "§15 / §16.1")

failed = checks.reject { |c| c["status"] == "PASS" }
payload = {
  "evidence_id" => EVIDENCE_ID, "generated_at" => now,
  "related_requirement" => "UTER-AES-GOV-001 §1.3 / §3 P09 / §3 P10 / §8.2 / §16.3",
  "related_finding" => failed.empty? ? nil : failed.map { |c| c["check"] },
  "source_system" => "scripts/quality/uter-p09-p10-boundary-check.rb",
  "execution_environment" => { "ruby" => RUBY_VERSION, "uter_root" => ROOT, "aes_root" => AES_ROOT },
  "repository_revision" => { "uter_head" => git_head(ROOT), "aes_head" => git_head(AES_ROOT) },
  "collector" => "WorkBuddy (Tencent Hunyuan Hy)", "collection_time" => now,
  "integrity" => {
    "governing_spec_sha256" => sha256(SPEC), "uter_registry_sha256" => sha256(REGISTRY),
    "aes_registry_sha256" => sha256(aes_registry_path),
    "note" => "Hashes support evidence integrity only; they do not prove correctness of the underlying activity (§14.4)."
  },
  "storage_reference" => EVIDENCE_DIR,
  "access_restrictions" => "local repository evidence; no credentials or production data",
  "division_of_responsibility" => {
    "P09" => "PROVE — quality engineering: test strategy, execution, defect closure, metrics, quality gates",
    "P10" => "DEFINE — security and reliability requirements: threat modeling, controls, reliability, backup/DR, incident"
  },
  "overall" => failed.empty? ? "PASS" : "FAIL",
  "failed_checks" => failed.map { |c| c["check"] }, "checks" => checks
}

FileUtils.mkdir_p(EVIDENCE_DIR)
path = File.join(EVIDENCE_DIR, "p09-p10-boundary.json")
File.write(path, JSON.pretty_generate(payload) + "\n")
checks.each { |c| puts format("%-4s %-4s %s", c["status"], c["check"], c["name"]) }
puts "overall=#{payload['overall']} checks=#{checks.length} failed=#{failed.length}"
puts "evidence: #{path}"
exit(failed.empty? ? 0 : 1)
