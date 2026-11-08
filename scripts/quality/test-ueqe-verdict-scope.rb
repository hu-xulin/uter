#!/usr/bin/env ruby
# frozen_string_literal: true

# Regression guard for scripts/quality/uter-quality.sh::compute_verdict.
#
# Bug fixed 2026-11-07: a single-stage run (e.g. `uter-quality.sh security`)
# scanned the .status files of ALL stages, including stale ones left by earlier
# runs. A stage whose own checks were 7/7 PASSED was still reported FAIL because
# unrelated historical FAILED/NOT_RUN entries were counted.
#
# Invariants asserted here against the REAL function body (extracted from the
# production script, not a reimplementation):
#   1. A single stage is judged only by its own .status files.
#   2. `full` still judges all six stages — strictness is NOT relaxed.
#   3. A FAILED / BLOCKED / NOT_RUN check in the current stage still blocks.
#   4. A stage with no verifiable checks is still FAIL (never a silent PASS).
#
# Usage: ruby scripts/quality/test-ueqe-verdict-scope.rb
# Exit:  0 = every invariant holds; 1 = regression or a guard failed.

require "minitest/autorun"
require "tmpdir"
require "open3"
require "json"

REAL_ROOT = File.expand_path("../..", __dir__)
SCRIPT = File.join(REAL_ROOT, "scripts/quality/uter-quality.sh")

# Extract the real compute_verdict() definition. Its closing brace is the next
# line consisting solely of `}`; ${...} expansions inside the body are not
# line-anchored, so a simple scan is unambiguous here.
def verdict_function
  lines = File.readlines(SCRIPT)
  start = lines.index { |l| l.start_with?("compute_verdict() {") }
  raise "compute_verdict() not found in #{SCRIPT}" unless start
  finish = ((start + 1)...lines.length).find { |i| lines[i] == "}\n" }
  raise "compute_verdict() closing brace not found" unless finish
  lines[start..finish].join
end

FUNCTION_BODY = verdict_function

class UeqeVerdictScopeTest < Minitest::Test
  def setup
    @tmp = Dir.mktmpdir("ueqe-verdict-")
    @state = File.join(@tmp, "state")
    Dir.mkdir(@state)
  end

  def teardown
    require "fileutils"
    FileUtils.remove_entry(@tmp) if @tmp && File.directory?(@tmp)
  end

  def put(name, status)
    File.write(File.join(@state, "#{name}.status"), "#{status}\n")
  end

  # Run the real function in an isolated shell with a fixture state tree.
  def verdict(stage)
    harness = +<<~SH
      #!/usr/bin/env bash
      set -u
      ROOT=#{@tmp.inspect}
      UEQE_STATE_DIR="state"
      STAGE=#{stage.inspect}
      #{FUNCTION_BODY}
      compute_verdict
    SH
    path = File.join(@tmp, "harness.sh")
    File.write(path, harness)
    out, err, st = Open3.capture3("bash", path)
    assert_equal 0, st.exitstatus, "harness failed: #{out} #{err}"
    File.read(File.join(@state, "verdict")).strip
  end

  def test_single_stage_ignores_other_stages_stale_failures
    put("security.govulncheck", "PASSED")
    put("security.gitleaks", "PASSED")
    put("security.forbidden-files", "PASSED")
    put("test.go-root", "FAILED")            # stale, unrelated stage
    put("regression.playwright", "NOT_RUN")  # permanently BLOCKED by policy
    assert_equal "PASS", verdict("security"),
                 "a single stage must not be polluted by other stages' history"
  end

  def test_full_still_fails_on_any_stage_failure
    put("security.govulncheck", "PASSED")
    put("test.go-root", "FAILED")
    assert_equal "FAIL", verdict("full"),
                 "full must keep judging every stage; strictness must not drop"
  end

  def test_full_still_fails_on_not_run
    put("security.govulncheck", "PASSED")
    put("regression.playwright", "NOT_RUN")
    assert_equal "FAIL", verdict("full"),
                 "NOT_RUN must never be counted as PASS in full mode"
  end

  def test_current_stage_failure_still_blocks
    put("security.govulncheck", "PASSED")
    put("security.gitleaks", "FAILED")
    assert_equal "FAIL", verdict("security")
  end

  def test_current_stage_blocked_still_blocks
    put("security.govulncheck", "PASSED")
    put("security.gitleaks", "BLOCKED")
    assert_equal "FAIL", verdict("security")
  end

  def test_current_stage_not_run_still_blocks
    put("security.govulncheck", "PASSED")
    put("security.gitleaks", "NOT_RUN")
    assert_equal "FAIL", verdict("security"),
                 "NOT_RUN is never PASS even within the current stage"
  end

  def test_stage_with_no_checks_is_fail_closed
    assert_equal "FAIL", verdict("security"),
                 "no verifiable checks must never produce a silent PASS"
    assert_equal "FAIL", verdict("full")
  end
end
