#!/usr/bin/env ruby
# frozen_string_literal: true

# UTER-AES-GOV-001 §1.1 / §1.3 / §1.4 / §4.3 / §16.3 / §18 step 1-2,7
#
# Two-repository separation gate. This is a real cross-repository check, not a
# text-only assertion about a single file:
#   * AES repository: owns P00-P12 universal standards ONLY.
#   * Uter repository: owns governance entrypoints, AES inheritance config
#     and UTER P13, and holds no competing copy of AES normative standards.
#
# Fail-closed: a missing/unreadable AES repository, an unparsable registry or
# a missing Uter project registry produces FAIL, never a silent pass.
#
# Exit codes: 0 = all separation invariants verified, 1 = violation/blocked.

require "json"
require "yaml"
require "time"
require "digest"
require "open3"
require "fileutils"

UTER_ROOT = File.expand_path("../..", __dir__)
AES_ROOT = File.expand_path(ENV.fetch("AES_REPO", File.join(UTER_ROOT, "..", "aes")))
EVIDENCE_DIR = ENV.fetch(
  "AES_EVIDENCE_DIR",
  File.join(UTER_ROOT, "reports/compliance/aes-full-migration-2026-11-06/evidence")
)
EVIDENCE_ID = "D04-GOVERNANCE-SEPARATION"
AES_NORMATIVE_DIRS = %w[standards .aes/registry].freeze
AES_REGISTRY_FILE = ".aes/STANDARD-REGISTRY.yaml"
AES_GATES_FILE = ".aes/registry/gates.yaml"
# Unambiguous Uter business-domain markers. A bare "uter" or a Go module path
# is NOT a violation: AES legitimately records the Uter module path in its
# repository-integration inventory (`.aes/registry/modules.yaml`).
BUSINESS_MARKERS = [
  "UTER-P13", "UTER P13", "topup_alipay", "ACQ.TRADE_NOT_EXIST",
  "toPayAmount", "billing_expr", "dreamrouter_snapshot",
  "wallet/lib/payment.ts", "Uter-specific payment flow"
].freeze
EXPECTED_PHASES = (0..12).map { |n| format("P%02d", n) }.freeze

def now = Time.now.utc.iso8601

def git_head(repo)
  out, _err, st = Open3.capture3("git", "-C", repo, "rev-parse", "HEAD")
  st.success? ? out.strip : "UNKNOWN"
end

def sha256(path)
  File.file?(path) ? Digest::SHA256.file(path).hexdigest : nil
end

def scan_files(root, rel_dirs)
  rel_dirs.flat_map do |rel|
    base = File.join(root, rel)
    next [] unless File.directory?(base)
    Dir.glob(File.join(base, "**", "*"), File::FNM_DOTMATCH)
       .select { |p| File.file?(p) }
       .map { |p| [p, p.sub("#{root}/", "")] }
  end
end

checks = []
add = lambda do |id, name, ok, observation, requirement|
  checks << {
    "check" => id, "name" => name, "requirement" => requirement,
    "status" => ok ? "PASS" : "FAIL", "observation" => observation
  }
end

abort_explanation = nil
if !File.directory?(AES_ROOT) || !File.directory?(File.join(AES_ROOT, ".git"))
  abort_explanation = "AES repository not found at #{AES_ROOT}; set AES_REPO to the pinned AES checkout"
end

if abort_explanation
  checks << { "check" => "S00", "name" => "AES repository reachable", "requirement" => "§18 step 1",
              "status" => "FAIL", "observation" => { "reason" => abort_explanation } }
else
  add.call("S00", "AES repository reachable", true,
           { "aes_root" => AES_ROOT, "aes_head" => git_head(AES_ROOT) }, "§18 step 1")

  # ---------------------------------------------------------------- Layer B
  gov_spec = File.join(UTER_ROOT, "uaes/standards/UTER-AES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md")
  project_registry = File.join(UTER_ROOT, ".aes/uter-governance-registry.yaml")
  p13_spec = File.join(UTER_ROOT, ".aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md")
  entry = File.join(UTER_ROOT, ".aes/AI-GOVERNANCE-ENTRY.md")

  files_ok = [gov_spec, project_registry, p13_spec, entry].all? { |p| File.file?(p) && !File.zero?(p) }
  add.call("S01", "Uter Layer B governance assets present", files_ok,
           { "paths" => [gov_spec, project_registry, p13_spec, entry].map { |p| p.sub("#{UTER_ROOT}/", "") },
             "missing" => [gov_spec, project_registry, p13_spec, entry].reject { |p| File.file?(p) } },
           "§1.1 Layer B / §18 step 7")

  registry = File.file?(project_registry) ? (YAML.safe_load_file(project_registry) rescue nil) : nil
  scope = registry.is_a?(Hash) ? registry.fetch("registry", {}) : {}
  add.call("S02", "project registry declares separate repository scopes",
           scope["repository_scope"] == "uter" && scope["aes_repository_scope"] == "aes" &&
             scope["governing_specification"].is_a?(Hash) &&
             scope.dig("governing_specification", "document_id") == "UTER-AES-GOV-001",
           { "repository_scope" => scope["repository_scope"], "aes_repository_scope" => scope["aes_repository_scope"],
             "governing_document_id" => scope.dig("governing_specification", "document_id") },
           "§1.1 / §1.3")

  extensions = registry.is_a?(Hash) ? (registry["project_extensions"] || []) : []
  p13 = extensions.find { |e| e["id"] == "UTER-P13" } || {}
  add.call("S03", "UTER P13 registered ONLY in Uter project governance registry",
           extensions.length == 1 && p13["registered_in"] == "UTER-PROJECT-GOVERNANCE-REGISTRY" &&
             p13["classification"] == "PROJECT_SPECIFIC_GOVERNANCE_EXTENSION" &&
             p13["inherits"].to_s.include?("AES P00-P12"),
           { "extension_count" => extensions.length, "id" => p13["id"],
             "registered_in" => p13["registered_in"], "classification" => p13["classification"],
             "inherits" => p13["inherits"] },
           "§1.3 / §4.3 / §16.3")

  forbidden = p13["forbidden_registration_locations"] || []
  required_forbidden = ["aes/standards/", "aes/.aes/registry/", "aes/.aes/STANDARD-REGISTRY.yaml"]
  add.call("S04", "registry explicitly forbids AES registration locations",
           required_forbidden.all? { |f| forbidden.include?(f) },
           { "declared" => forbidden, "required" => required_forbidden },
           "§1.3 / §4.3")

  # ---------------------------------------------------------------- Layer A
  aes_registry_path = File.join(AES_ROOT, AES_REGISTRY_FILE)
  aes_gates_path = File.join(AES_ROOT, AES_GATES_FILE)
  aes_registry = File.file?(aes_registry_path) ? (YAML.safe_load_file(aes_registry_path) rescue nil) : nil
  aes_gates = File.file?(aes_gates_path) ? (YAML.safe_load_file(aes_gates_path) rescue nil) : nil

  phases = aes_registry.is_a?(Hash) ? (aes_registry["phases"] || {}).keys.sort : []
  add.call("S05", "AES registry contains exactly P00-P12 (no UTER P13 phase)",
           phases == EXPECTED_PHASES,
           { "phase_count" => phases.length, "phases" => phases, "expected" => EXPECTED_PHASES },
           "§1.1 Layer A / §16.3")

  gate_ids = aes_gates.is_a?(Hash) ? (aes_gates["gates"] || []).map { |g| g["id"] } : []
  add.call("S06", "AES domain gates are exactly 13 with no P13 gate",
           gate_ids.length == 13 && gate_ids.all? { |id| id.match?(/\AAES-\d{2}-GATE-\d{3}\z/) } &&
             gate_ids.none? { |id| id.include?("13-GATE") },
           { "gate_count" => gate_ids.length, "gate_ids" => gate_ids },
           "§1.1 Layer A / §16.3")

  domain_dirs = Dir.glob(File.join(AES_ROOT, "standards", "*"))
                   .select { |p| File.directory?(p) }.map { |p| File.basename(p) }.sort
  expected_dirs = (0..12).map { |n| format("%02d-", n) }
  add.call("S07", "AES standards/ has 13 universal domain directories only",
           domain_dirs.length == 13 && domain_dirs.each_with_index.all? { |d, i| d.start_with?(expected_dirs[i]) } &&
             domain_dirs.none? { |d| d.start_with?("13-") },
           { "domain_directories" => domain_dirs },
           "§1.1 Layer A / §4.3")

  normative_files = scan_files(AES_ROOT, AES_NORMATIVE_DIRS) +
                    (File.file?(aes_registry_path) ? [[aes_registry_path, AES_REGISTRY_FILE]] : [])
  marker_hits = normative_files.filter_map do |abs, rel|
    body = File.read(abs, encoding: "UTF-8", invalid: :replace)
    found = BUSINESS_MARKERS.select { |m| body.include?(m) }
    { "file" => rel, "markers" => found } unless found.empty?
  rescue StandardError
    nil
  end
  add.call("S08", "no Uter business rules or UTER P13 inside AES normative standards",
           marker_hits.empty?,
           { "scanned_files" => normative_files.length, "markers" => BUSINESS_MARKERS, "hits" => marker_hits },
           "§1.3 'No project-specific business rule shall be introduced into AES'")

  p13_in_aes = Dir.glob(File.join(AES_ROOT, "**", "*UTER-P13*"), File::FNM_DOTMATCH)
                   .select { |p| File.file?(p) }
  add.call("S09", "no UTER-P13 artifact exists anywhere in the AES repository",
           p13_in_aes.empty?,
           { "matches" => p13_in_aes.map { |p| p.sub("#{AES_ROOT}/", "") } },
           "§4.3 / user directive: UTER P13 must not be committed to AES")

  # ------------------------------------------------- Uter must not copy AES
  forbidden_copies = %w[standards .aes/STANDARD-REGISTRY.yaml .aes/registry/gates.yaml
                        .aes/APPROVAL-RECORD.md].select { |p| File.exist?(File.join(UTER_ROOT, p)) }
  add.call("S10", "Uter holds no competing copy of AES normative standards",
           forbidden_copies.empty?,
           { "unexpected_paths" => forbidden_copies,
             "note" => "Uter inherits AES through .aes/aes-pin.json + INTEGRATION.md, not by copying standards" },
           "§1.3 / §1.4 standards hierarchy")

  entry_text = File.file?(entry) ? File.read(entry) : ""
  add.call("S11", "Uter governance entry remains a thin pointer",
           entry_text.include?(".aes/aes-pin.json") && entry_text.bytesize < 16_000 &&
             !entry_text.include?("## P00 —") && !entry_text.include?("## P10 —"),
           { "bytes" => entry_text.bytesize, "pins_aes" => entry_text.include?(".aes/aes-pin.json") },
           "§1.4 / §6.4")

  # Historical AES-P13-* files are derived Repository-Integration evidence,
  # not standards. Their name is ambiguous; record as an explicit finding.
  historical = Dir.glob(File.join(AES_ROOT, "reports", "**", "AES-P13-*"))
                  .select { |p| File.file?(p) }.map { |p| p.sub("#{AES_ROOT}/", "") }
  historical_in_normative = historical.select { |p| p.start_with?(*AES_NORMATIVE_DIRS) }
  add.call("S12", "historical AES-P13-* files are confined to derived reports/",
           historical_in_normative.empty?,
           { "count" => historical.length, "paths" => historical,
             "finding" => historical.empty? ? nil : "FINDING-SEP-001 (Low / Naming ambiguity): 'AES-P13-*' denotes the Repository Integration phase, not a AES P13 domain. Keep outside standards/ and registry; consider renaming in a separately approved AES-repository change." },
           "§1.3 / §4.3 / §14.2")
end

failed = checks.reject { |c| c["status"] == "PASS" }
payload = {
  "evidence_id" => EVIDENCE_ID, "generated_at" => now,
  "related_requirement" => "UTER-AES-GOV-001 §1.1 / §1.3 / §1.4 / §4.3 / §16.3",
  "related_finding" => failed.empty? ? nil : failed.map { |c| c["check"] },
  "source_system" => "scripts/quality/uter-governance-separation-check.rb",
  "execution_environment" => { "ruby" => RUBY_VERSION, "uter_root" => UTER_ROOT, "aes_root" => AES_ROOT },
  "repository_revision" => { "uter_head" => git_head(UTER_ROOT), "aes_head" => git_head(AES_ROOT) },
  "collector" => "WorkBuddy (Tencent Hunyuan Hy)",
  "collection_time" => now,
  "integrity" => {
    "uter_registry_sha256" => sha256(File.join(UTER_ROOT, ".aes/uter-governance-registry.yaml")),
    "aes_registry_sha256" => sha256(File.join(AES_ROOT, AES_REGISTRY_FILE)),
    "aes_gates_sha256" => sha256(File.join(AES_ROOT, AES_GATES_FILE)),
    "note" => "Hashes support evidence integrity only; they do not prove the underlying activity was performed correctly (§14.4)."
  },
  "storage_reference" => EVIDENCE_DIR,
  "access_restrictions" => "local repository evidence; no credentials or production data",
  "overall" => failed.empty? ? "PASS" : "FAIL",
  "failed_checks" => failed.map { |c| c["check"] },
  "checks" => checks
}

FileUtils.mkdir_p(EVIDENCE_DIR)
path = File.join(EVIDENCE_DIR, "governance-separation.json")
File.write(path, JSON.pretty_generate(payload) + "\n")
checks.each { |c| puts format("%-4s %-4s %s", c["status"], c["check"], c["name"]) }
puts "overall=#{payload['overall']} checks=#{checks.length} failed=#{failed.length}"
puts "evidence: #{path}"
exit(failed.empty? ? 0 : 1)
