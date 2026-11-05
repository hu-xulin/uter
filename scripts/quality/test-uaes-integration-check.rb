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

  def fixture
    root = Dir.mktmpdir("uter-uaes-integration-")
    paths = {
      ".uaes/INTEGRATION.md" => <<~MD,
        # UAES Integration Contract
        Status: MIGRATION_PENDING
        UAES source commit: 84416f7f55c1166e3f5adfa0575c1ea713ff20d2
        Registry blob: 1c74e918b84b8cc18d2806a936721852b823ca75
        | Registry version | `1.7.0` |
        | Registry status | `DRAFT` |
        - payment, recharge, refund, balance
        - Token usage, pricing, quota
        - SQLite/MySQL/PostgreSQL
        - UTER Design System 3.0
        Do not change this status to VERIFIED
      MD
      ".uaes/TRACEABILITY.md" => "No phase in this matrix is currently marked VERIFIED\n" + PHASES.map { |phase| "| #{phase} Foundation | PARTIAL |" }.join("\n"),
      "AGENTS.md" => [
        "UAES Integration Contract",
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
      ".agents/skills/uaes-integration/SKILL.md" => "Read skills/uaes-uter-integration/SKILL.md\nNever claim UAES integration is VERIFIED",
      ".claude/skills/uaes-integration/SKILL.md" => "Read skills/uaes-uter-integration/SKILL.md\nNever claim UAES integration is VERIFIED",
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

  def test_accepts_complete_static_integration_fixture
    root = fixture
    out, err, status = run_checker(root)
    assert status.success?, "#{err}\n#{out}"
    assert_match(/P00-P12 traceability is complete/, out)
    assert_match(/Uter payment, billing, auth, database, and Design System overlays remain protected/, out)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_fails_when_project_overlay_is_removed
    root = fixture
    path = File.join(root, ".uaes/INTEGRATION.md")
    File.write(path, File.read(path).sub("- payment, recharge, refund, balance\n", ""))
    _out, err, status = run_checker(root)
    refute status.success?
    assert_match(/payment, recharge, refund, balance/, err)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_fails_when_traceability_phase_is_missing
    root = fixture
    path = File.join(root, ".uaes/TRACEABILITY.md")
    File.write(path, File.read(path).sub("| P08 Foundation | PARTIAL |\n", ""))
    _out, err, status = run_checker(root)
    refute status.success?
    assert_match(/missing P08/, err)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end
  def test_fails_when_canonical_skill_adapter_is_missing
    root = fixture
    FileUtils.rm(File.join(root, ".claude/skills/i18n-translate/SKILL.md"))
    _out, err, status = run_checker(root)
    refute status.success?
    assert_match(/missing or empty/, err)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_fails_when_skill_adapter_name_does_not_match_directory
    root = fixture
    path = File.join(root, ".claude/skills/i18n-translate/SKILL.md")
    File.write(path, File.read(path).sub("name: i18n-translate", "name: wrong-skill"))
    _out, err, status = run_checker(root)
    refute status.success?
    assert_match(/name: i18n-translate/, err)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_fails_when_registry_version_pin_is_removed
    root = fixture
    path = File.join(root, ".uaes/INTEGRATION.md")
    File.write(path, File.read(path).sub("| Registry version | `1.7.0` |\n", ""))
    _out, err, status = run_checker(root)
    refute status.success?
    assert_match(/Registry version/, err)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_fails_when_registry_status_pin_is_removed
    root = fixture
    path = File.join(root, ".uaes/INTEGRATION.md")
    File.write(path, File.read(path).sub("| Registry status | `DRAFT` |\n", ""))
    _out, err, status = run_checker(root)
    refute status.success?
    assert_match(/Registry status/, err)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

end
