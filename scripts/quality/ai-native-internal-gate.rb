#!/usr/bin/env ruby
# frozen_string_literal: true

# AES-native Uter internal governance acceptance gate.
# Scope is internal governance integration only; it is NOT a product
# conformance certificate, legal authorization, or third-party attestation.

require "json"
require "yaml"
require "digest"
require "open3"
require "fileutils"
require "time"

UTER_ROOT = File.expand_path("../..", __dir__)
AES_ROOT = ENV.fetch("AES_ROOT") { ENV.fetch("AES_REPO") { File.expand_path("../../aes", UTER_ROOT) } }
REPORT = File.join(UTER_ROOT, ".aes/reports/ai-native-internal-gate.json")
PIN = File.join(UTER_ROOT, ".aes/aes-pin.json")
REGISTRY = File.join(UTER_ROOT, ".aes/uter-governance-registry.yaml")
INTEGRATION = File.join(UTER_ROOT, ".aes/INTEGRATION.md")
TRACEABILITY = File.join(UTER_ROOT, ".aes/TRACEABILITY.md")
P13 = File.join(UTER_ROOT, ".aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md")
PRESERVED = File.join(AES_ROOT, "governance/autonomous/config/preserved-evidence.json")
FINGERPRINT = File.join(AES_ROOT, "quality/scripts/aes/governed-fingerprint.mjs")
CORE_FILES = [
  "governance/ai-native/AI-NATIVE-AUTONOMOUS-GOVERNANCE-STANDARD.md",
  "governance/ai-native/config/acceptance-rules-ai-native.json",
  "governance/ai-native/config/independent-review-rules.json",
  "governance/ai-native/engine/acceptance-engine.mjs",
  "governance/ai-native/engine/independent-review.mjs"
].freeze

def sha256(path)
  Digest::SHA256.file(path).hexdigest
end

def git_head(root)
  out, _err, status = Open3.capture3("git", "-C", root, "rev-parse", "HEAD")
  status.success? ? out.strip : nil
end

def write_json(path, value)
  FileUtils.mkdir_p(File.dirname(path))
  tmp = "#{path}.tmp-#{$$}"
  File.write(tmp, JSON.pretty_generate(value) + "\n")
  File.rename(tmp, path)
end

def check(id, description)
  detail = yield
  { id: id, ran: true, status: detail[:ok] ? "PASS" : "FAIL",
    detail: detail[:detail], evidence: detail[:evidence] || [] }
rescue StandardError => e
  { id: id, ran: true, status: "FAIL", detail: "#{description}: #{e.class}: #{e.message}", evidence: [] }
end

def load_yaml(path)
  YAML.safe_load_file(path, permitted_classes: [Date, Time], aliases: true) || {}
end

def machine_fingerprint
  out, err, status = Open3.capture3("node", FINGERPRINT, "--json", chdir: AES_ROOT)
  raise "governed fingerprint command failed: #{err}" unless status.success?
  JSON.parse(out)
end

def sync_pin_if_seal_intact(fp)
  return false unless fp["seal_intact"] == true
  components = fp.fetch("components")
  pin = JSON.parse(File.read(PIN))
  head = git_head(AES_ROOT)
  pin["governed_fingerprint"] = fp.fetch("fingerprint")
  pin["governed_components"] = components
  pin["source_commit"] = head if head
  pin["registry_blob_sha"] = components["registry_blob_sha"]
  pin["registry_version"] = components["registry_version"]
  pin["registry_status"] = components["registry_status"]
  pin["specification_id"] = components["specification_id"]
  pin["specification_version"] = components["specification_version"]
  pin["specification_status"] = components["specification_status"]
  pin["specification_integrity_digest"] = components["specification_integrity_digest"]
  pin["requirement_count"] = components["requirement_count"]
  pin["pinned_at"] = Time.now.utc.iso8601
  # Deliberately do not promote integration_status or conformance_status.
  write_json(PIN, pin)

  if File.file?(REGISTRY)
    text = File.read(REGISTRY)
    text = text.sub(/^  governed_fingerprint:.*$/, "  governed_fingerprint: \"#{fp.fetch('fingerprint')}\"")
    text = text.sub(/^  source_commit:.*$/, "  source_commit: \"#{head}\"") if head
    File.write(REGISTRY, text)
  end
  true
end

def main
  checks = []
  fp = nil

  checks << check("UTER-AES-01", "AES governed fingerprint and seal") do
    fp = machine_fingerprint
    ok = fp["seal_intact"] == true && fp["fingerprint"].to_s.match?(/\A[a-f0-9]{64}\z/)
    { ok: ok, detail: "seal_intact=#{fp['seal_intact']} fingerprint=#{fp['fingerprint']}", evidence: [FINGERPRINT, ".aes/spec-registry/SPECIFICATION-REGISTRY.yaml"] }
  end

  checks << check("UTER-AES-02", "Uter pin matches the recomputed AES fingerprint") do
    raise "AES fingerprint unavailable or seal invalid" unless fp && fp["seal_intact"] == true
    sync_pin_if_seal_intact(fp)
    pin = JSON.parse(File.read(PIN))
    ok = pin["governed_fingerprint"] == fp["fingerprint"] &&
      pin.dig("governed_components", "registry_version").to_s == fp.dig("components", "registry_version").to_s &&
      pin["integration_status"] == "MIGRATION_PENDING"
    { ok: ok, detail: "pin_matches=#{pin['governed_fingerprint'] == fp['fingerprint']} integration_status=#{pin['integration_status']} (not auto-promoted)", evidence: [".aes/aes-pin.json"] }
  end

  checks << check("UTER-AES-03", "AES is the sole universal registry") do
    reg = YAML.safe_load_file(REGISTRY, aliases: true)
    duplicate = File.file?(File.join(UTER_ROOT, ".aes/STANDARD-REGISTRY.yaml"))
    ok = File.file?(REGISTRY) && File.file?(INTEGRATION) && !duplicate &&
      reg.dig("aes_inheritance", "source_repository").to_s.include?("hu-xulin/aes")
    { ok: ok, detail: "project_registry=#{File.file?(REGISTRY)} integration_contract=#{File.file?(INTEGRATION)} duplicate_universal_registry=#{duplicate}", evidence: [".aes/uter-governance-registry.yaml", ".aes/INTEGRATION.md"] }
  end

  checks << check("UTER-AES-04", "P00-P12 inheritance and UTER P13 registration") do
    reg = YAML.safe_load_file(REGISTRY, aliases: true)
    inherited = Array(reg.dig("aes_inheritance", "inherited_domains")).map(&:to_s).sort
    expected = (0..12).map { |n| format("P%02d", n) }.sort
    ext = Array(reg["project_extensions"]).find { |x| x["id"] == "UTER-P13" }
    ok = inherited == expected && ext && ext["specification_path"] == ".aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md" &&
      File.file?(P13) && ext["domain_count"].to_i == 10
    { ok: !!ok, detail: "inherited_domains=#{inherited.length}/13 P13_registered=#{!ext.nil?} P13_domains=#{ext && ext['domain_count']}", evidence: [".aes/uter-governance-registry.yaml", ".aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md"] }
  end

  checks << check("UTER-AES-05", "Agent bootstrap loads the canonical AES governance engine") do
    files = %w[AGENTS.md CLAUDE.md]
    results = files.map do |name|
      path = File.join(UTER_ROOT, name)
      text = File.file?(path) ? File.read(path) : ""
      [name, text.include?("AI_NATIVE_GOVERNANCE") && text.include?("ZERO_HUMAN_DEPENDENCY") && text.include?("governance/ai-native/engine/cli.mjs")]
    end
    ok = results.all?(&:last)
    { ok: ok, detail: results.map { |name, pass| "#{name}=#{pass}" }.join(" "), evidence: files }
  end

  checks << check("UTER-AES-06", "Legacy .uaes governance directory is retired") do
    legacy = File.directory?(File.join(UTER_ROOT, ".uaes"))
    { ok: !legacy, detail: "legacy_.uaes_directory_present=#{legacy}", evidence: [".uaes/ (must be retired after migration)"] }
  end

  checks << check("UTER-AES-07", "No active manual or third-party approval dependency") do
    roots = [File.join(UTER_ROOT, ".aes"), File.join(UTER_ROOT, "scripts/quality"), File.join(UTER_ROOT, ".github/workflows")]
    patterns = [
      /human_approval_required\s*:\s*true/i,
      /manual_approval_required\s*:\s*true/i,
      /third_party_approval_required\s*:\s*true/i,
      /execution\s*:\s*MANUAL\b/i,
      /kind\s*:\s*manual-review\b/i
    ]
    hits = []
    roots.each do |root|
      next unless File.directory?(root)
      Dir.glob(File.join(root, "**", "*")).select { |p| File.file?(p) && p.match?(/\.(rb|mjs|js|json|ya?ml|md|sh)$/i) }.each do |path|
        text = File.read(path)
        patterns.each { |pattern| hits << "#{path.delete_prefix(UTER_ROOT + '/')}:#{pattern.source}" if text.match?(pattern) }
      end
    end
    { ok: hits.empty?, detail: "active_manual_gate_matches=#{hits.length}", evidence: hits.first(20) }
  end

  checks << check("UTER-AES-08", "P09/P10 responsibility boundary is executable") do
    script = File.join(UTER_ROOT, "scripts/quality/uter-p09-p10-boundary-check.rb")
    out, err, status = File.file?(script) ? Open3.capture3("ruby", script, chdir: UTER_ROOT) : ["", "missing", nil]
    { ok: status && status.success?, detail: "boundary_check_exit=#{status&.exitstatus} stdout=#{out.strip} stderr=#{err.strip}", evidence: ["scripts/quality/uter-p09-p10-boundary-check.rb"] }
  end

  checks << check("UTER-AES-09", "Product test and CI verification surfaces exist") do
    go_tests = Dir.glob(File.join(UTER_ROOT, "**", "*_test.go")).reject { |p| p.include?("/.git/") || p.include?("/node_modules/") }
    web_tests = Dir.glob(File.join(UTER_ROOT, "web/**/*")).select { |p| File.file?(p) && p.match?(/(?:\.test\.|\.spec\.)|__tests__/i) }
    workflows = Dir.glob(File.join(UTER_ROOT, ".github/workflows/*.{yml,yaml}"))
    ok = go_tests.any? && web_tests.any? && workflows.any?
    { ok: ok, detail: "go_tests=#{go_tests.length} web_tests=#{web_tests.length} workflows=#{workflows.length}", evidence: ["go.mod", "web/package.json", ".github/workflows/"] }
  end

  checks << check("UTER-AES-10", "UTER P13 business overlays are preserved and registered") do
    required = [
      ".aes/business/API-LEGACY-ENDPOINT-DEPRECATION-AUDIT-2026-11-05.md",
      ".aes/business/MIDJOURNEY-REFUND-TRANSACTION-DESIGN-2026-11-05.md"
    ]
    p13_text = File.read(P13)
    missing = required.reject { |rel| File.file?(File.join(UTER_ROOT, rel)) || p13_text.include?(rel) }
    { ok: missing.empty? && required.all? { |rel| p13_text.include?(rel) }, detail: "business_overlays=#{required.length - missing.length}/#{required.length} linked_from_P13=true", evidence: required }
  end

  checks << check("UTER-AES-11", "Historical evidence remains byte-identical") do
    manifest = JSON.parse(File.read(PRESERVED))
    mismatches = []
    manifest.fetch("entries").each do |entry|
      root = entry["project"].to_s.casecmp("uter").zero? ? UTER_ROOT : AES_ROOT
      path = File.join(root, entry.fetch("path"))
      unless File.file?(path) && sha256(path) == entry.fetch("sha256")
        mismatches << "#{entry['project']}:#{entry['path']}"
      end
    end
    { ok: mismatches.empty?, detail: "preserved_entries=#{manifest['entries'].length} mismatches=#{mismatches.length}", evidence: mismatches.first(20) }
  end

  # Five immutable AES governance core files are independently hashed by AES.
  evidence_manifest = CORE_FILES.map do |rel|
    abs = File.join(AES_ROOT, rel)
    { root: "aes", path: rel, role: "STABLE_CORE", present: File.file?(abs), sha256: File.file?(abs) ? sha256(abs) : nil }
  end
  stable_lines = evidence_manifest.sort_by { |e| e[:path] }.map { |e| "#{e[:path]}\t#{e[:sha256]}\n" }.join
  stable_digest = Digest::SHA256.hexdigest(stable_lines)
  head = git_head(AES_ROOT)

  # Preserve the prior L3/L4 record as historical evidence; this gate never edits it.
  legacy_l3 = "HISTORICAL_NOT_REWRITTEN"
  legacy_l4 = "HISTORICAL_NOT_REWRITTEN"
  legacy_path = File.join(UTER_ROOT, "reports/compliance/uaes-full-migration-2026-11-06/evidence/gates")
  if File.directory?(legacy_path)
    legacy_l3_file = File.join(legacy_path, "l3-domain-gates.json")
    legacy_l4_file = File.join(legacy_path, "l4-global-gate.json")
    legacy_l3 = JSON.parse(File.read(legacy_l3_file)).fetch("verdict", "UNKNOWN") if File.file?(legacy_l3_file)
    legacy_l4 = JSON.parse(File.read(legacy_l4_file)).fetch("verdict", "UNKNOWN") if File.file?(legacy_l4_file)
  end

  summary = {
    total: checks.length,
    pass: checks.count { |c| c[:status] == "PASS" },
    fail: checks.count { |c| c[:status] == "FAIL" },
    not_run: checks.count { |c| c[:ran] != true }
  }
  verdict = summary[:pass] == 11 ? "INTERNAL_ACCEPTED" : "NOT_ACCEPTED"
  document = {
    document_id: "UTER-AES-AUTONOMOUS-INTERNAL-ACCEPTANCE",
    generated_at: Time.now.utc.iso8601,
    generated_by: "Uter AES internal gate",
    scope: "INTERNAL_GOVERNANCE_ACCEPTANCE_ONLY",
    aes_git_sha: head,
    verdict: verdict,
    check_summary: summary,
    checks: checks,
    evidence_manifest: evidence_manifest,
    stable_core_digest: stable_digest,
    historical_evidence: { unmodified_during_gate: checks.last[:status] == "PASS", preserved_manifest: "governance/autonomous/config/preserved-evidence.json" },
    legacy_gate_state: { l3_status: legacy_l3, l4_status: legacy_l4, rewritten_by_this_gate: false },
    blocking_matrix: { external_attestation: "SEPARATE_NOT_CLAIMED_AS_PASSED" },
    product_conformance_status: "NOT_ASSESSED",
    NOT_RUN_never_pass: true,
    honesty_note: "Internal governance acceptance only. This report does not claim full product conformance, legal authorization, regulatory approval or third-party certification."
  }
  write_json(REPORT, document)
  failed_checks = checks.reject { |c| c[:status] == "PASS" }
  failed_checks.each { |c| warn "UTER_INTERNAL_GATE_FAIL #{c[:id]} #{c[:detail]} evidence=#{Array(c[:evidence]).join(',')}" }
  puts JSON.generate({ verdict: verdict, checks: summary, report: REPORT, product_conformance_status: "NOT_ASSESSED" })
  exit(verdict == "INTERNAL_ACCEPTED" ? 0 : 1)
end

main
