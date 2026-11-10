#!/usr/bin/env ruby
# frozen_string_literal: true

# UTER-AES-GOV-001 §8.3 / §14.3 / §16.3 / §16.4 / §18
#
# Positive and NEGATIVE fixtures for the manual-acceptance evidence chain:
#   * scripts/quality/aes-governance-gates.rb     consumes the evidence
#   * scripts/quality/aes-manual-acceptance.py    --verify-only integrity
#
# A gate that only ever passes is not a gate. Every negative case works on a
# throwaway mirror of the evidence tree (Dir.mktmpdir + FileUtils.cp_r); the
# user's real working tree and real evidence are never modified.
#
# Fail-closed invariants asserted here:
#   1. Local execution evidence never auto-promotes an acceptance item.
#   2. A missing/failing integrity record makes the whole manual evidence set
#      untrusted and every one of the 42 items stays NOT_VERIFIED.
#   3. Removing the user-designated acceptance authority makes L4-15 NOT_MET.
#   4. A tampered authority record alone cannot sign an item.
#   5. A tampered inventory item alone cannot sign an item.
#   6. A tampered raw log is detected by the collector's own --verify-only.
#
# Usage: ruby scripts/quality/test-aes-manual-acceptance-boundary.rb
# Exit:  0 = every fixture behaved as specified; 1 = a gate failed to detect an
#        injected violation or the unmodified baseline was rejected.

require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "json"
require "open3"

REAL_ROOT = File.expand_path("../..", __dir__)
REAL_AES = File.expand_path(ENV.fetch("AES_REPO", File.join(REAL_ROOT, "..", "aes")))
REAL_EVIDENCE = File.join(REAL_ROOT, "reports/compliance/aes-full-migration-2026-11-06/evidence")
REAL_REPORTS = File.dirname(REAL_EVIDENCE)
GATES = File.join(REAL_ROOT, "scripts/quality/aes-governance-gates.rb")
COLLECTOR = File.join(REAL_ROOT, "scripts/quality/aes-manual-acceptance.py")

class ManualAcceptanceBoundaryFixtures < Minitest::Test
  def setup
    @tmp = Dir.mktmpdir("aes-ma-fixture-")
    @evidence = File.join(@tmp, "evidence")
    FileUtils.cp_r(REAL_EVIDENCE, @evidence)
    @ma = File.join(@evidence, "manual-acceptance")
    skip "manual-acceptance evidence not collected yet" unless File.file?(File.join(@ma, "execution.json"))
  end

  def teardown
    FileUtils.remove_entry(@tmp) if @tmp && File.directory?(@tmp)
  end

  def run_gates
    env = {
      "AES_EVIDENCE_DIR" => @evidence,
      "AES_REPORTS_DIR" => REAL_REPORTS,
      "AES_REPO" => REAL_AES,
    }
    _out, _err, _st = Open3.capture3(env, "ruby", GATES, chdir: REAL_ROOT)
    l3 = JSON.parse(File.read(File.join(@evidence, "gates/l3-domain-gates.json")))
    l4 = JSON.parse(File.read(File.join(@evidence, "gates/l4-global-gate.json")))
    [l3, l4]
  end

  def rewrite(name)
    path = File.join(@ma, name)
    payload = JSON.parse(File.read(path))
    yield payload
    File.write(path, JSON.pretty_generate(payload) + "\n")
  end

  def condition(l4, id)
    l4["conditions"].find { |c| c["id"] == id }
  end

  def open_items(l3)
    l3["domains"].sum { |d| d["open_manual_acceptance"].length }
  end

  # ---------------------------------------------------------------- baseline
  def test_baseline_is_trusted_but_no_item_is_signed
    l3, l4 = run_gates
    assert_equal true, l3["manual_acceptance_evidence"]["trusted"],
                 "integrity-verified evidence must be trusted"
    assert_equal 0, l3["manual_acceptance_evidence"]["verified_item_count"]
    assert_equal 42, open_items(l3)
    assert_equal "BLOCKED", l3["status"]
    assert_equal "BLOCKED", l4["status"], "L4 must stay BLOCKED without human acceptance"
    assert_equal false, l4["acceptance"]["signoff_granted"]
    assert_equal "MET", condition(l4, "L4-15")["status"],
                 "L4-15 records the authority, NOT an acceptance decision"
  end

  # ------------------------------------------------- positive (not permablocked)
  def test_explicit_signed_decision_is_honoured
    rewrite("acceptance-authority.json") do |j|
      j["decision"] = "GRANTED"
      j["signoff_granted"] = true
      j["signed_item_ids"] = ["M05-01"]
    end
    rewrite("inventory.json") do |j|
      j["acceptance_decision"]["status"] = "GRANTED"
      j["acceptance_decision"]["signed_item_count"] = 1
      row = j["items"].find { |i| i["id"] == "M05-01" }
      row["acceptance_status"] = "VERIFIED"
      row["verified_by"] = "fixture authority"
      row["verified_at"] = "2026-11-06T00:00:00Z"
    end
    l3, l4 = run_gates
    assert_equal true, l3["manual_acceptance_evidence"]["trusted"]
    assert_equal 1, l3["manual_acceptance_evidence"]["verified_item_count"]
    assert_equal 41, open_items(l3), "only the explicitly signed item may be accepted"
    assert_equal true, l4["acceptance"]["signoff_granted"]
    assert_equal "BLOCKED", l4["status"], "one signature must not unblock the other conditions"
  end

  # ---------------------------------------------------------------- negatives
  def test_failed_integrity_makes_entire_manual_evidence_untrusted
    rewrite("integrity.json") { |j| j["status"] = "FAIL"; j["problems"] << "fixture injection" }
    l3, l4 = run_gates
    assert_equal false, l3["manual_acceptance_evidence"]["trusted"]
    assert_equal 42, open_items(l3)
    assert_equal "BLOCKED", l4["status"]
    cats = l3["domains"].flat_map { |d| d["open_manual_acceptance"].map { |m| m["evidence_category"] } }
    assert_equal ["EVIDENCE_NOT_TRUSTED"], cats.uniq
    assert_equal "NOT_MET", condition(l4, "L4-13")["status"]
  end

  def test_interrupted_run_marker_invalidates_evidence
    rewrite("run-state.json") { |j| j["state"] = "RUNNING" }
    l3, l4 = run_gates
    assert_equal false, l3["manual_acceptance_evidence"]["trusted"]
    assert_equal 42, open_items(l3)
    assert_equal "BLOCKED", l4["status"]
  end

  def test_missing_acceptance_authority_makes_l4_15_not_met
    FileUtils.rm_f(File.join(@ma, "acceptance-authority.json"))
    _l3, l4 = run_gates
    assert_equal "NOT_MET", condition(l4, "L4-15")["status"]
    assert_equal false, l4["acceptance"]["authority_recorded"]
  end

  def test_tampered_authority_record_cannot_sign_an_item
    rewrite("acceptance-authority.json") do |j|
      j["decision"] = "GRANTED"
      j["signoff_granted"] = true
      j["signed_item_ids"] = ["M05-01"]
    end
    l3, l4 = run_gates
    assert_equal 0, l3["manual_acceptance_evidence"]["verified_item_count"],
                 "authority file alone must not sign an item; inventory is authoritative"
    assert_equal 42, open_items(l3)
    assert_equal false, l4["acceptance"]["signoff_granted"]
    assert_equal "BLOCKED", l4["status"]
  end

  def test_tampered_inventory_cannot_sign_an_item
    rewrite("inventory.json") do |j|
      row = j["items"].find { |i| i["id"] == "M05-01" }
      row["acceptance_status"] = "VERIFIED"
    end
    l3, l4 = run_gates
    assert_equal false, l3["manual_acceptance_evidence"]["trusted"],
                 "a VERIFIED row without an explicit GRANTED decision invalidates the set"
    assert_equal 0, l3["manual_acceptance_evidence"]["verified_item_count"]
    assert_equal 42, open_items(l3)
    assert_equal "BLOCKED", l4["status"]
  end

  def test_tampered_raw_log_is_detected_by_collector_verify_only
    log = File.join(@ma, "MA-01.log")
    File.open(log, "ab") { |f| f.write("fixture injection\n") }
    env = {
      "AES_EVIDENCE_DIR" => @evidence,
      "AES_REPORTS_DIR" => REAL_REPORTS,
      "AES_MANUAL_EVIDENCE_DIR" => @ma,
    }
    out, _err, st = Open3.capture3(env, "python3", COLLECTOR, "--verify-only", chdir: REAL_ROOT)
    assert_equal 3, st.exitstatus, "--verify-only must fail closed on a hash mismatch"
    assert_includes out, "MA-01: log_sha256 mismatch"
  end

  def test_help_never_executes_checks
    env = { "AES_MANUAL_EVIDENCE_DIR" => @ma }
    out, _err, st = Open3.capture3(env, "python3", COLLECTOR, "--help", chdir: REAL_ROOT)
    assert_equal 0, st.exitstatus
    assert_includes out, "--verify-only"
    refute_includes out, "[MA-01]"
  end
end
