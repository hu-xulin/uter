#!/usr/bin/env ruby
# frozen_string_literal: true

# UTER-AES-GOV-001 §1.3 / §8.2 / §9 / §10 / §16.3 / §18 steps 1-2,7
#
# Positive and NEGATIVE fixtures for the two user-emphasised governance gates:
#   * scripts/quality/uter-governance-separation-check.rb (two repositories)
#   * scripts/quality/uter-p09-p10-boundary-check.rb      (P09 proves / P10 defines)
#
# A gate that only ever passes is not a gate. Every negative case builds a fresh
# throwaway mirror of BOTH repositories, injects one specific violation, and
# asserts that the real gate exits non-zero with the expected FAIL check. The
# user's working tree is never modified: mirrors live in Dir.mktmpdir and all
# evidence is redirected via AES_EVIDENCE_DIR.
#
# Usage: ruby scripts/quality/test-uter-governance-boundaries.rb
# Exit:  0 = all fixtures behaved as specified; 1 = a gate failed to detect an
#        injected violation or rejected an unmodified baseline.

require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "json"
require "open3"

REAL_ROOT = File.expand_path("../..", __dir__)
REAL_AES = File.expand_path(ENV.fetch("AES_REPO", File.join(REAL_ROOT, "..", "aes")))
SEPARATION_GATE = "uter-governance-separation-check.rb"
BOUNDARY_GATE = "uter-p09-p10-boundary-check.rb"

GOV_SPEC = "uaes/standards/UTER-AES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md"
PROJECT_REGISTRY = ".aes/uter-governance-registry.yaml"

UTER_MIRROR_FILES = [
  GOV_SPEC,
  PROJECT_REGISTRY,
  ".aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md",
  ".aes/AI-GOVERNANCE-ENTRY.md",
  ".aes/INTEGRATION.md",
  ".aes/TRACEABILITY.md",
  "AGENTS.md",
  "scripts/quality/aes-governance-gates.rb",
  "scripts/quality/#{SEPARATION_GATE}",
  "scripts/quality/#{BOUNDARY_GATE}"
].freeze

AES_MIRROR_DIRS = %w[standards .aes reports].freeze

class GovernanceBoundaryFixtures < Minitest::Test
  def setup
    @tmp = Dir.mktmpdir("uter-gov-fixture-")
    @root = File.join(@tmp, "uter")
    @aes = File.join(@tmp, "aes")
    @evidence = File.join(@tmp, "evidence")
    FileUtils.mkdir_p(File.join(@root, "scripts", "quality"))
    FileUtils.mkdir_p(@evidence)

    UTER_MIRROR_FILES.each do |rel|
      src = File.join(REAL_ROOT, rel)
      raise "fixture source missing: #{src}" unless File.file?(src)
      dst = File.join(@root, rel)
      FileUtils.mkdir_p(File.dirname(dst))
      FileUtils.cp(src, dst)
    end

    # separation-check requires a .git directory in the pinned AES checkout.
    FileUtils.mkdir_p(File.join(@aes, ".git"))
    AES_MIRROR_DIRS.each do |rel|
      src = File.join(REAL_AES, rel)
      raise "AES fixture source missing: #{src}" unless File.directory?(src)
      FileUtils.cp_r(src, File.join(@aes, rel))
    end
  end

  def teardown
    FileUtils.remove_entry(@tmp) if @tmp && File.directory?(@tmp)
  end

  def run_gate(script)
    env = { "AES_REPO" => @aes, "AES_EVIDENCE_DIR" => @evidence }
    out, err, status = Open3.capture3(
      env, "ruby", File.join(@root, "scripts", "quality", script), chdir: @root
    )
    [out, err, status.exitstatus]
  end

  def failed_checks(evidence_file)
    path = File.join(@evidence, evidence_file)
    return [] unless File.file?(path)
    payload = JSON.parse(File.read(path))
    (payload["checks"] || []).select { |c| c["status"] == "FAIL" }.map { |c| c["check"] }
  rescue JSON::ParserError
    ["<unparsable evidence>"]
  end

  def assert_gate_rejects(script, evidence_file, expected_check, message)
    out, err, code = run_gate(script)
    assert_operator code, :>, 0,
                    "#{message}: gate must exit non-zero (stdout=#{out.inspect} stderr=#{err.inspect})"
    checks = failed_checks(evidence_file)
    assert_includes checks, expected_check,
                    "#{message}: expected #{expected_check} to FAIL; actual FAIL checks=#{checks.inspect}"
  end

  def rewrite(rel)
    path = File.join(@root, rel)
    File.write(path, yield(File.read(path)))
  end

  # ------------------------------------------------------------------ positive
  def test_unmodified_mirror_passes_both_gates
    out1, _e1, c1 = run_gate(SEPARATION_GATE)
    assert_equal 0, c1, "unmodified mirror must pass separation gate: #{out1}"
    out2, _e2, c2 = run_gate(BOUNDARY_GATE)
    assert_equal 0, c2, "unmodified mirror must pass P09/P10 boundary gate: #{out2}"
  end

  # -------------------------------------- negative: two-repository separation
  def test_separation_rejects_p13_standard_directory_in_aes
    dir = File.join(@aes, "standards", "13-uter-p13")
    FileUtils.mkdir_p(dir)
    File.write(File.join(dir, "BUSINESS.md"), "# UTER P13 business domain rules\n")
    assert_gate_rejects(SEPARATION_GATE, "governance-separation.json", "S07",
                        "AES must not gain a 13- (UTER P13) domain directory")
  end

  def test_separation_rejects_uter_business_rule_in_aes_standard
    target = Dir.glob(File.join(@aes, "standards", "**", "*.md")).first
    refute_nil target, "AES mirror must contain standards"
    File.open(target, "a") { |f| f.puts("\nUter-specific payment flow uses toPayAmount().\n") }
    assert_gate_rejects(SEPARATION_GATE, "governance-separation.json", "S08",
                        "Uter business rules must not enter AES normative standards")
  end

  def test_separation_rejects_uter_p13_artifact_anywhere_in_aes
    File.write(File.join(@aes, "reports", "UTER-P13-INJECTED.md"), "project extension copy\n")
    assert_gate_rejects(SEPARATION_GATE, "governance-separation.json", "S09",
                        "no UTER-P13 artifact may exist anywhere in the AES repository")
  end

  def test_separation_rejects_p13_gate_in_aes_registry
    gates = File.join(@aes, ".aes", "registry", "gates.yaml")
    File.open(gates, "a") do |f|
      f.puts("  - id: AES-13-GATE-001")
      f.puts("    name: UTER-P13-BUSINESS-DOMAIN")
      f.puts("    execution: NOT_RUN")
    end
    assert_gate_rejects(SEPARATION_GATE, "governance-separation.json", "S06",
                        "AES gate registry must contain exactly 13 universal gates")
  end

  def test_separation_fails_closed_when_pinned_aes_repository_is_missing
    FileUtils.remove_entry(File.join(@aes, ".git"))
    assert_gate_rejects(SEPARATION_GATE, "governance-separation.json", "S00",
                        "missing/unreadable AES repository must fail closed")
  end

  def test_separation_rejects_p13_registered_in_aes_registry
    rewrite(PROJECT_REGISTRY) do |body|
      body.sub('registered_in: "UTER-PROJECT-GOVERNANCE-REGISTRY"',
               'registered_in: "AES-GLOBAL-REGISTRY"')
    end
    assert_gate_rejects(SEPARATION_GATE, "governance-separation.json", "S03",
                        "UTER P13 must be registered ONLY in the Uter project registry")
  end

  def test_separation_rejects_competing_aes_standards_copy_in_uter
    FileUtils.mkdir_p(File.join(@root, "standards"))
    File.write(File.join(@root, "standards", "COPY.md"), "copied AES standard\n")
    assert_gate_rejects(SEPARATION_GATE, "governance-separation.json", "S10",
                        "Uter must inherit AES by pin, not by copying normative standards")
  end

  # ------------------------------------------- negative: P09 proves / P10 defines
  def test_boundary_rejects_collapsed_prove_define_roles
    rewrite(PROJECT_REGISTRY) { |body| body.sub('role: "PROVE"', 'role: "DEFINE"') }
    assert_gate_rejects(BOUNDARY_GATE, "p09-p10-boundary.json", "B06",
                        "P09 must keep its distinct PROVE role")
  end

  def test_boundary_rejects_removed_conflicting_management_system_ban
    rewrite(PROJECT_REGISTRY) do |body|
      body.sub(/^\s*- "Duplicating a conflicting management system between P09 and P10"\n/, "")
    end
    assert_gate_rejects(BOUNDARY_GATE, "p09-p10-boundary.json", "B07",
                        "the duplicate/conflicting management system must stay explicitly forbidden")
  end

  def test_boundary_rejects_v2_p10_business_domain_mislabel
    rewrite("scripts/quality/aes-governance-gates.rb") do |body|
      body.sub('"id" => "P10", "name" => "Security & Reliability"',
               '"id" => "P10", "name" => "Business Domain Engineering"')
    end
    assert_gate_rejects(BOUNDARY_GATE, "p09-p10-boundary.json", "B09",
                        "V2 regression: P10 must not own the UTER P13 business domain")
  end

  def test_boundary_rejects_missing_division_in_governance_entrypoint
    rewrite("AGENTS.md") { |body| body.gsub("P09 proves", "P09 quality") }
    assert_gate_rejects(BOUNDARY_GATE, "p09-p10-boundary.json", "B10",
                        "every governance entrypoint must state the P09/P10 division")
  end

  def test_boundary_rejects_swapped_aes_baseline_domain_names
    registry = File.join(@aes, ".aes", "STANDARD-REGISTRY.yaml")
    File.write(registry, File.read(registry).sub(/name: "Quality Engineering"/, 'name: "Security & Reliability"'))
    assert_gate_rejects(BOUNDARY_GATE, "p09-p10-boundary.json", "B08",
                        "pinned AES baseline must keep P09=Quality / P10=Security")
  end
end
