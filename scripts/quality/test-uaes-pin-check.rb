#!/usr/bin/env ruby
# Positive and negative fixtures for the UAES spec-version pin gate.
require "fileutils"
require "json"
require "minitest/autorun"
require "open3"
require "tmpdir"

class UaesPinCheckTest < Minitest::Test
  REPO_ROOT = File.expand_path("../..", __dir__)
  CHECKER = File.join(REPO_ROOT, "scripts/quality/uaes-pin-check.sh")
  COMMIT = "9b1f5f19e480817c7717fff203aa6b4287602aeb"
  BLOB = "a73447a7206321976bcfcdcc2b58e70157703e5a"

  def pin
    {
      "schema_version" => "1.0.0",
      "repository" => "https://github.com/hu-xulin/uaes",
      "default_branch" => "main",
      "source_commit" => COMMIT,
      "registry_path" => ".uaes/STANDARD-REGISTRY.yaml",
      "registry_blob_sha" => BLOB,
      "registry_version" => "1.7.0",
      "registry_status" => "DRAFT",
      "integration_status" => "MIGRATION_PENDING",
      "approval_state" => "NOT_APPROVED",
      "pinned_at" => "2026-11-05T15:05:04Z"
    }
  end

  def contract
    <<~MD
      # UAES Integration Contract — Uter

      **Status:** MIGRATION_PENDING

      | UAES source commit | `#{COMMIT}` |
      | Registry blob SHA at audit baseline | `#{BLOB}` |
      | Registry version | `1.7.0` |
      | Registry status | `DRAFT` |

      Do not change this status to VERIFIED without approval and evidence.
    MD
  end

  def fixture(pin_overrides: {}, contract_body: nil)
    root = Dir.mktmpdir("uter-uaes-pin-")
    FileUtils.mkdir_p(File.join(root, ".uaes"))
    data = pin.merge(pin_overrides)
    data.each { |key, value| data.delete(key) if value == :delete }
    File.write(File.join(root, ".uaes/uaes-pin.json"), JSON.pretty_generate(data))
    File.write(File.join(root, ".uaes/INTEGRATION.md"), contract_body || contract)
    root
  end

  def run_checker(root)
    Open3.capture3({ "UAES_PIN_ROOT" => root }, "bash", CHECKER)
  end

  def assert_rejected(root, pattern)
    out, err, status = run_checker(root)
    refute status.success?, "checker unexpectedly passed:\n#{out}"
    assert_match(pattern, "#{err}#{out}")
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_accepts_consistent_pinned_baseline
    root = fixture
    out, err, status = run_checker(root)
    assert status.success?, "#{err}\n#{out}"
    assert_match(/pin contains all 11 required fields/, out)
    assert_match(/INTEGRATION.md agrees with the pinned commit/, out)
    assert_match(/uaes-pin-check: PASS/, out)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_rejects_missing_required_field
    root = fixture(pin_overrides: { "registry_blob_sha" => :delete })
    assert_rejected(root, /missing required field: registry_blob_sha/)
  end

  def test_rejects_malformed_commit_id
    root = fixture(pin_overrides: { "source_commit" => "not-a-sha" })
    assert_rejected(root, /source_commit must be a 40-character/)
  end

  def test_rejects_malformed_registry_blob_id
    root = fixture(pin_overrides: { "registry_blob_sha" => "ABC" })
    assert_rejected(root, /registry_blob_sha must be a 40-character/)
  end

  def test_rejects_commit_drift_between_pin_and_contract
    root = fixture(contract_body: contract.sub(COMMIT, "0" * 40))
    assert_rejected(root, /missing pinned value: #{COMMIT}/)
  end

  def test_rejects_registry_blob_drift
    root = fixture(contract_body: contract.sub(BLOB, "1" * 40))
    assert_rejected(root, /missing pinned value: #{BLOB}/)
  end

  def test_rejects_unapproved_status_upgrade
    root = fixture(pin_overrides: { "registry_status" => "APPROVED" })
    assert_rejected(root, /APPROVED registry requires approval_state=APPROVED/)
  end

  def test_rejects_draft_declared_verified
    root = fixture(pin_overrides: { "integration_status" => "VERIFIED" })
    assert_rejected(root, /DRAFT registry must keep integration_status=MIGRATION_PENDING/)
  end

  def test_rejects_contract_claiming_verified
    root = fixture(contract_body: contract.sub("**Status:** MIGRATION_PENDING", "**Status:** VERIFIED"))
    assert_rejected(root, /contract claims VERIFIED/)
  end

  def test_rejects_unparseable_pin
    root = fixture
    File.write(File.join(root, ".uaes/uaes-pin.json"), "{ not json")
    assert_rejected(root, /not parseable JSON|missing required field/)
  end
end
