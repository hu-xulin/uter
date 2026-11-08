#!/usr/bin/env ruby
require "fileutils"
require "minitest/autorun"
require "open3"
require "rbconfig"
require "tmpdir"

class UaesIntegrationCheckTest < Minitest::Test
  REPO_ROOT = File.expand_path("../..", __dir__)
  CHECKER = File.join(REPO_ROOT, "scripts/quality/uaes-integration-check.sh")
  PHASES = (0..12).map { |number| "P%02d" % number }.freeze
  COMMIT = "ff7cf878d43061f263e301cad09ff19d03e906c4"
  BLOB = "5090c84f6b71d520ca0181f9da4e77be69ebcbf5"

  def fixture
    root = Dir.mktmpdir("uter-uaes-integration-")
    paths = {
      ".uaes/agent-governance.yaml" => <<~YAML,
        repository:
          max_non_main_branches: 1
        permission_profiles:
          pull_request_creator:
            deny:
              - git.merge
              - production.database.write
              - payment.configuration.write
              - overwrite.user_uncommitted_changes
      YAML
      ".ai/task-schema.json" => "{\n  \"version\": \"1.0.0\"\n}",
      ".uaes/uaes-pin.json" => <<~JSON,
        {
          "schema_version": "1.0.0",
          "repository": "https://github.com/hu-xulin/uaes",
          "default_branch": "main",
          "source_commit": "#{COMMIT}",
          "registry_path": ".uaes/STANDARD-REGISTRY.yaml",
          "registry_blob_sha": "#{BLOB}",
          "registry_version": "1.9.0",
          "registry_status": "APPROVED",
          "integration_status": "MIGRATION_PENDING",
          "approval_state": "APPROVED",
          "pinned_at": "2026-11-06T02:50:38Z"
        }
      JSON
      "docs/ai-specs/UTER-UAES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md" => <<~MD,
        # UTER-UAES-GOV-001
        Conformance status: CONFORMANT / PARTIALLY CONFORMANT / NON-CONFORMANT
        | D28 | Residual Risk and Exception Register |
      MD
      ".uaes/uter-governance-registry.yaml" => <<~YAML,
        project_extensions:
          - id: "UTER-P13"
            registered_in: "UTER-PROJECT-GOVERNANCE-REGISTRY"
            forbidden_registration_locations:
              - "uaes/standards/"
        domain_ownership:
          P09:
            role: "PROVE"
          P10:
            role: "DEFINE"
        gate_architecture:
          independently_assessed_domains: 14
      YAML
      ".uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md" => <<~MD,
        # UTER P13 — Business Domain Engineering
        Project-specific extension, registered only in the Uter project registry.
      MD
      ".uaes/INTEGRATION.md" => <<~MD,
        # UAES Integration Contract
        Governing specification: UTER-UAES-GOV-001
        UTER P13 is a project-specific extension.
        P09 / P10 division: P09 proves, P10 defines.
        Status: MIGRATION_PENDING
        UAES source commit: #{COMMIT}
        Registry blob: #{BLOB}
        | Registry version | `1.9.0` |
        | Registry status | `APPROVED` |
        Approval record: UAES-APPROVAL-2026-11-06-001
        - payment, recharge, refund, balance
        - Token usage, pricing, quota
        - SQLite/MySQL/PostgreSQL
        - UTER Design System 3.0
        Do not change this status to VERIFIED
      MD
      ".uaes/AI-GOVERNANCE-ENTRY.md" => <<~MD,
        # Uter AI Governance Entry Point
        Governing specification: UTER-UAES-GOV-001
        Machine-readable pin: .uaes/uaes-pin.json
        Registry: .uaes/STANDARD-REGISTRY.yaml
        Project registry: .uaes/uter-governance-registry.yaml
        Project extension: .uaes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md
        Pinned commit: #{COMMIT}
        Project overlays: docs/ai-specs/ and UTER-DESIGN-SYSTEM-3.0.md
        Status: MIGRATION_PENDING
      MD
      ".uaes/TRACEABILITY.md" => "No phase in this matrix is currently marked VERIFIED\nUTER-P13 is an independent domain\n" + PHASES.map { |phase| "| #{phase} Foundation | PARTIAL |" }.join("\n"),
      "AGENTS.md" => [
        "UTER-UAES-GOV-001",
        "uter-governance-registry.yaml",
        "P09 proves engineering quality",
        "P10 defines security requirements",
        "docs/design-system/UTER-DESIGN-SYSTEM-3.0.md",
        "docs/ai-specs/engineering-quality/",
        "Billing safety invariants",
        "Authentication Security (OWASP Mandatory)"
      ].join("\n"),
      "CLAUDE.md" => [
        "Read AGENTS.md with the Read tool",
        "web/AGENTS.md",
        ".agents/rules/billing.md"
      ].join("\n"),
      ".agents/skills/uaes-integration/SKILL.md" => "---\nname: uaes-integration\ndescription: canonical\n---\nRead skills/uaes-uter-integration/SKILL.md\nNever claim UAES integration is VERIFIED",
      ".claude/skills/uaes-integration/SKILL.md" => "---\nname: uaes-integration\ndescription: adapter\n---\nRead .agents/skills/uaes-integration/SKILL.md\nRead skills/uaes-uter-integration/SKILL.md\nNever claim UAES integration is VERIFIED",
      ".agents/skills/i18n-translate/SKILL.md" => "---\nname: i18n-translate\ndescription: canonical\n---",
      ".claude/skills/i18n-translate/SKILL.md" => "---\nname: i18n-translate\ndescription: adapter\n---\nRead .agents/skills/i18n-translate/SKILL.md"
    }
    paths.each do |relative, body|
      path = File.join(root, relative)
      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, body)
    end
    root
  end

  def run_checker(root)
    Open3.capture3({ "UAES_INTEGRATION_ROOT" => root }, "bash", CHECKER)
  end

  def assert_rejected(root, pattern)
    _out, err, status = run_checker(root)
    refute status.success?, "checker unexpectedly passed"
    assert_match(pattern, err)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_accepts_complete_static_integration_fixture
    root = fixture
    out, err, status = run_checker(root)
    assert status.success?, "#{err}\n#{out}"
    assert_match(/P00-P12 traceability plus independent UTER-P13 domain are registered/, out)
    assert_match(/three-layer \/ two-repository architecture and P09\/P10 ownership are registered/, out)
    assert_match(/governance entry point is a thin, pinned pointer/, out)
    assert_match(/Uter payment, billing, auth, database, and Design System overlays remain protected/, out)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_fails_when_project_overlay_is_removed
    root = fixture
    path = File.join(root, ".uaes/INTEGRATION.md")
    File.write(path, File.read(path).sub("- payment, recharge, refund, balance\n", ""))
    assert_rejected(root, /payment, recharge, refund, balance/)
  end

  def test_fails_when_traceability_phase_is_missing
    root = fixture
    path = File.join(root, ".uaes/TRACEABILITY.md")
    File.write(path, File.read(path).sub("| P08 Foundation | PARTIAL |\n", ""))
    assert_rejected(root, /missing P08/)
  end

  def test_fails_when_canonical_skill_adapter_is_missing
    root = fixture
    FileUtils.rm(File.join(root, ".claude/skills/i18n-translate/SKILL.md"))
    assert_rejected(root, /missing or empty/)
  end

  def test_fails_when_skill_adapter_name_does_not_match_directory
    root = fixture
    path = File.join(root, ".claude/skills/i18n-translate/SKILL.md")
    File.write(path, File.read(path).sub("name: i18n-translate", "name: wrong-skill"))
    assert_rejected(root, /name: i18n-translate/)
  end

  def test_fails_when_registry_version_pin_is_removed
    root = fixture
    path = File.join(root, ".uaes/INTEGRATION.md")
    File.write(path, File.read(path).sub("| Registry version | `1.9.0` |\n", ""))
    assert_rejected(root, /Registry version/)
  end

  def test_fails_when_registry_status_pin_is_removed
    root = fixture
    path = File.join(root, ".uaes/INTEGRATION.md")
    File.write(path, File.read(path).sub("| Registry status | `APPROVED` |\n", ""))
    assert_rejected(root, /Registry status/)
  end

  def test_fails_when_approval_record_is_missing_from_contract
    root = fixture
    path = File.join(root, ".uaes/INTEGRATION.md")
    File.write(path, File.read(path).sub("Approval record: UAES-APPROVAL-2026-11-06-001\n", ""))
    assert_rejected(root, /UAES-APPROVAL-2026-11-06-001/)
  end

  def test_fails_when_approved_pin_lacks_approval_state
    root = fixture
    path = File.join(root, ".uaes/uaes-pin.json")
    File.write(path, File.read(path).sub('"approval_state": "APPROVED"', '"approval_state": "NOT_APPROVED"'))
    assert_rejected(root, /APPROVED registry pin must carry approval_state=APPROVED/)
  end

  def test_fails_when_governance_entry_point_is_missing
    root = fixture
    FileUtils.rm(File.join(root, ".uaes/AI-GOVERNANCE-ENTRY.md"))
    assert_rejected(root, /missing or empty/)
  end

  def test_fails_when_governance_entry_point_loses_pinned_commit
    root = fixture
    path = File.join(root, ".uaes/AI-GOVERNANCE-ENTRY.md")
    File.write(path, File.read(path).sub(COMMIT, "0" * 40))
    assert_rejected(root, /#{COMMIT}/)
  end

  def test_fails_when_integration_adapter_does_not_delegate_to_canonical
    root = fixture
    path = File.join(root, ".claude/skills/uaes-integration/SKILL.md")
    File.write(path, File.read(path).sub("Read .agents/skills/uaes-integration/SKILL.md\n", ""))
    assert_rejected(root, /\.agents\/skills\/uaes-integration\/SKILL\.md/)
  end

  def test_fails_when_uter_p13_is_not_registered_in_uter_project_registry
    root = fixture
    path = File.join(root, ".uaes/uter-governance-registry.yaml")
    File.write(path, File.read(path).sub('registered_in: "UTER-PROJECT-GOVERNANCE-REGISTRY"',
                                        'registered_in: "UAES-GLOBAL-REGISTRY"'))
    assert_rejected(root, /UTER-PROJECT-GOVERNANCE-REGISTRY/)
  end

  def test_fails_when_p09_p10_ownership_is_collapsed
    root = fixture
    path = File.join(root, ".uaes/uter-governance-registry.yaml")
    File.write(path, File.read(path).sub('role: "DEFINE"', 'role: "PROVE"'))
    assert_rejected(root, /role: "DEFINE"/)
  end

  def test_fails_when_independent_domain_count_is_not_fourteen
    root = fixture
    path = File.join(root, ".uaes/uter-governance-registry.yaml")
    File.write(path, File.read(path).sub("independently_assessed_domains: 14", "independently_assessed_domains: 13"))
    assert_rejected(root, /independently_assessed_domains: 14/)
  end

  def test_fails_when_governing_specification_is_missing
    root = fixture
    FileUtils.rm(File.join(root, "docs/ai-specs/UTER-UAES-GOVERNANCE-ARCHITECTURE-WORKBUDDY-EXECUTION-SPECIFICATION.md"))
    assert_rejected(root, /missing or empty/)
  end

  def test_fails_when_uter_p13_traceability_row_is_missing
    root = fixture
    path = File.join(root, ".uaes/TRACEABILITY.md")
    File.write(path, File.read(path).sub("UTER-P13 is an independent domain\n", ""))
    assert_rejected(root, /missing the independent UTER-P13 domain/)
  end
end
