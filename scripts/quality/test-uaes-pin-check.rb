#!/usr/bin/env ruby
# Positive and negative fixtures for the UAES spec-version pin gate.
# Covers both lifecycle states: APPROVED (current pinned baseline, UAES 1.9.0)
# and DRAFT (the pre-approval baseline). An approved registry is a normative
# baseline, never a Uter compliance certificate; the gate rejects any fixture
# that uses approval to promote integration_status to VERIFIED.
require "fileutils"
require "json"
require "minitest/autorun"
require "open3"
require "tmpdir"

class UaesPinCheckTest < Minitest::Test
  REPO_ROOT = File.expand_path("../..", __dir__)
  CHECKER = File.join(REPO_ROOT, "scripts/quality/uaes-pin-check.sh")
  COMMIT = "ff7cf878d43061f263e301cad09ff19d03e906c4"
  BLOB = "5090c84f6b71d520ca0181f9da4e77be69ebcbf5"

  def pin
    {
      "schema_version" => "1.0.0",
      "repository" => "https://github.com/hu-xulin/uaes",
      "default_branch" => "main",
      "source_commit" => COMMIT,
      "registry_path" => ".uaes/STANDARD-REGISTRY.yaml",
      "registry_blob_sha" => BLOB,
      "registry_version" => "1.9.0",
      "registry_status" => "APPROVED",
      "integration_status" => "MIGRATION_PENDING",
      "approval_state" => "APPROVED",
      "pinned_at" => "2026-11-06T02:50:38Z"
    }
  end

  def contract
    <<~MD
      # UAES Integration Contract — Uter

      **Status:** MIGRATION_PENDING

      | UAES source commit | `#{COMMIT}` |
      | Registry blob SHA at audit baseline | `#{BLOB}` |
      | Registry version | `1.9.0` |
      | Registry status | `APPROVED` |

      Do not change this status to VERIFIED without approval and evidence.
    MD
  end

  # Contract text for the pre-approval DRAFT baseline; used to prove the gate
  # still accepts a correctly declared DRAFT pin after the APPROVED migration.
  def draft_contract
    contract
      .sub("| Registry version | `1.9.0` |", "| Registry version | `1.7.0` |")
      .sub("| Registry status | `APPROVED` |", "| Registry status | `DRAFT` |")
  end

  def draft_pin_overrides(extra = {})
    {
      "registry_version" => "1.7.0",
      "registry_status" => "DRAFT",
      "approval_state" => "NOT_APPROVED",
      "integration_status" => "MIGRATION_PENDING"
    }.merge(extra)
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
    # These fixtures exercise the lifecycle / contract rules on a schema 1.0.0
    # pin, which predates governed fingerprints. The checker refuses a sub-3.0
    # pin by default because dropping below 3.0.0 disables fingerprint
    # verification entirely; the opt-in below is the deliberate, documented
    # exception for historical fixtures. Do not remove it to make the suite
    # green -- the fingerprint gate has its own fixtures against the real 3.0.0
    # pin shape in uaes-pin-check.sh.
    Open3.capture3({ "UAES_PIN_ROOT" => root, "UAES_PIN_LEGACY_OK" => "1" }, "bash", CHECKER)
  end

  def assert_rejected(root, pattern)
    out, err, status = run_checker(root)
    refute status.success?, "checker unexpectedly passed:\n#{out}"
    assert_match(pattern, "#{err}#{out}")
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def assert_accepted(root)
    out, err, status = run_checker(root)
    assert status.success?, "#{err}\n#{out}"
    assert_match(/pin contains all 11 required fields/, out)
    assert_match(/INTEGRATION.md agrees with the pinned commit/, out)
    assert_match(/uaes-pin-check: PASS/, out)
  ensure
    FileUtils.remove_entry(root) if root && File.exist?(root)
  end

  def test_accepts_consistent_approved_pinned_baseline
    assert_accepted(fixture)
  end

  def test_accepts_consistent_draft_pinned_baseline
    assert_accepted(fixture(pin_overrides: draft_pin_overrides, contract_body: draft_contract))
  end

  def test_rejects_missing_required_field
    assert_rejected(fixture(pin_overrides: { "registry_blob_sha" => :delete }),
                    /missing required field: registry_blob_sha/)
  end

  def test_rejects_malformed_commit_id
    assert_rejected(fixture(pin_overrides: { "source_commit" => "not-a-sha" }),
                    /source_commit must be a 40-character/)
  end

  def test_rejects_malformed_registry_blob_id
    assert_rejected(fixture(pin_overrides: { "registry_blob_sha" => "ABC" }),
                    /registry_blob_sha must be a 40-character/)
  end

  def test_rejects_commit_drift_between_pin_and_contract
    assert_rejected(fixture(contract_body: contract.sub(COMMIT, "0" * 40)),
                    /missing pinned value: #{COMMIT}/)
  end

  def test_rejects_registry_blob_drift
    assert_rejected(fixture(contract_body: contract.sub(BLOB, "1" * 40)),
                    /missing pinned value: #{BLOB}/)
  end

  def test_rejects_registry_version_drift
    assert_rejected(fixture(contract_body: contract.sub("| Registry version | `1.9.0` |",
                                                       "| Registry version | `1.7.0` |")),
                    /Registry version/)
  end

  def test_rejects_registry_status_drift
    assert_rejected(fixture(contract_body: contract.sub("| Registry status | `APPROVED` |",
                                                       "| Registry status | `DRAFT` |")),
                    /Registry status/)
  end

  def test_rejects_approved_registry_without_approval_state
    assert_rejected(fixture(pin_overrides: { "approval_state" => "NOT_APPROVED" }),
                    /requires approval_state=APPROVED or ACTIVE/)
  end

  def test_rejects_approved_registry_declaring_integration_verified
    assert_rejected(fixture(pin_overrides: { "integration_status" => "VERIFIED" }),
                    /does not authorise integration_status=VERIFIED/)
  end

  def test_rejects_draft_declared_verified
    assert_rejected(fixture(pin_overrides: draft_pin_overrides("integration_status" => "VERIFIED"),
                            contract_body: draft_contract),
                    /DRAFT registry must keep integration_status=MIGRATION_PENDING/)
  end

  def test_rejects_contract_claiming_verified
    assert_rejected(fixture(contract_body: contract.sub("**Status:** MIGRATION_PENDING",
                                                       "**Status:** VERIFIED")),
                    /contract claims VERIFIED/)
  end

  def test_rejects_unparseable_pin
    root = fixture
    File.write(File.join(root, ".uaes/uaes-pin.json"), "{ not json")
    assert_rejected(root, /not parseable JSON|missing required field/)
  end
end
