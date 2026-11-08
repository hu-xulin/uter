#!/usr/bin/env ruby
# frozen_string_literal: true

# Regression guard for the Go //go:embed precondition in scripts/verify-all.sh.
#
# Bug fixed 2026-11-07: the local full gate ran `go vet ./...` before any
# frontend artifact existed. main.go embeds web/dist/index.html AND
# all:web/dist/docs-content/_next, so every local Go vet run failed with
# "no matching files found" even when the Go code was clean. CI already solves
# this with a "Create frontend embed placeholder" step; the local harness had
# drifted from CI.
#
# Invariants asserted here:
#   1. The embed-precondition step executes BEFORE the Go vet step (real order,
#      read from the production script, not a reimplementation).
#   2. Full mode still runs Go vet as a real `step` — never `skip`, never a
#      hardcoded PASS. Strictness is NOT relaxed.
#   3. Both scripts pass `bash -n`.
#   4. The precondition is idempotent and NON-DESTRUCTIVE: a real
#      web/dist/index.html and real docs CSS are left byte-for-byte untouched.
#   5. When artifacts are absent, both embed patterns become resolvable.
#
# Usage: ruby scripts/quality/test-verify-all-embed-precondition.rb
# Exit:  0 = every invariant holds; 1 = regression or a guard failed.

require "minitest/autorun"
require "tmpdir"
require "open3"
require "fileutils"

REAL_ROOT = File.expand_path("../..", __dir__)
VERIFY = File.join(REAL_ROOT, "scripts/verify-all.sh")
ENSURE = File.join(REAL_ROOT, "scripts/quality/ensure-go-embed-artifacts.sh")

class VerifyAllEmbedPreconditionTest < Minitest::Test
  def source
    @source ||= File.read(VERIFY)
  end

  def test_precondition_step_precedes_go_vet
    lines = source.lines
    pre = lines.index { |l| l.include?("step ") && l.include?("Go embed") }
    vet = lines.index { |l| l.include?("step ") && l.include?("Go vet (all four modules)") }
    refute_nil pre, "verify-all.sh must have a Go embed precondition step"
    refute_nil vet, "verify-all.sh must still run go vet"
    assert_operator pre, :<, vet,
                    "embed artifacts must exist before go vet runs, otherwise go vet fails on //go:embed"
  end

  def test_full_mode_go_vet_is_a_real_step_not_a_skip
    vet_lines = source.lines.select { |l| l.include?("Go vet (all four modules)") }
    assert(vet_lines.any? { |l| l.lstrip.start_with?("step ") },
           "go vet must be executed as a real step in full mode")
    refute(vet_lines.any? { |l| l.lstrip.start_with?("skip ") },
           "go vet must never be skipped to make the gate green")
  end

  def test_precondition_calls_the_idempotent_helper
    assert_includes source, "scripts/quality/ensure-go-embed-artifacts.sh",
                    "the harness must use the shared, non-destructive helper"
  end

  def test_both_scripts_pass_shell_syntax_check
    [VERIFY, ENSURE].each do |path|
      _out, err, st = Open3.capture3("bash", "-n", path)
      assert_equal 0, st.exitstatus, "bash -n #{path}: #{err}"
    end
  end

  # Build a miniature repository so the helper resolves ROOT from its own path.
  def with_fixture_repo
    Dir.mktmpdir("embed-precondition-") do |tmp|
      dst = File.join(tmp, "scripts/quality")
      FileUtils.mkdir_p(dst)
      FileUtils.cp(ENSURE, dst)
      helper = File.join(dst, File.basename(ENSURE))
      FileUtils.chmod(0o755, helper)
      yield tmp, helper
    end
  end

  def run_helper(helper)
    out, err, st = Open3.capture3("bash", helper)
    [out + err, st.exitstatus]
  end

  def test_real_frontend_artifacts_are_never_overwritten
    with_fixture_repo do |tmp, helper|
      index = File.join(tmp, "web/dist/index.html")
      css = File.join(tmp, "web/dist/docs-content/_next/static/chunks/real.css")
      FileUtils.mkdir_p(File.dirname(index))
      FileUtils.mkdir_p(File.dirname(css))
      File.write(index, "<!doctype html><title>REAL SPA</title>\n")
      File.write(css, "/* REAL DOC CSS */\n")

      out, code = run_helper(helper)
      assert_equal 0, code, "helper failed: #{out}"
      assert_equal "<!doctype html><title>REAL SPA</title>\n", File.read(index),
                   "a real SPA build must never be truncated by the precondition"
      assert_equal "/* REAL DOC CSS */\n", File.read(css),
                   "real docs assets must never be touched"
      refute_includes out, "created build-time embed skeleton",
                      "no placeholder may be created when real artifacts exist"
      refute File.exist?(File.join(tmp, "web/dist/docs-content/_next/static/chunks/embed-placeholder.css"))
    end
  end

  def test_missing_artifacts_are_created_and_helper_is_idempotent
    with_fixture_repo do |tmp, helper|
      out1, code1 = run_helper(helper)
      assert_equal 0, code1, "first run failed: #{out1}"
      assert_includes out1, "created build-time embed skeleton"
      assert_includes out1, "embed precondition OK"

      index = File.join(tmp, "web/dist/index.html")
      css = File.join(tmp, "web/dist/docs-content/_next/static/chunks/embed-placeholder.css")
      assert File.file?(index), "//go:embed web/dist/index.html needs a file"
      assert File.file?(css), "//go:embed all:web/dist/docs-content/_next needs at least one file"
      assert_equal "", File.read(index)
      assert_equal "", File.read(css)

      # A second run must not truncate / duplicate anything.
      out2, code2 = run_helper(helper)
      assert_equal 0, code2, "second run failed: #{out2}"
      assert_includes out2, "no placeholder created"
      assert File.file?(index) && File.file?(css)
    end
  end

  def test_partial_state_preserves_real_index_but_fills_docs_skeleton
    with_fixture_repo do |tmp, helper|
      index = File.join(tmp, "web/dist/index.html")
      FileUtils.mkdir_p(File.dirname(index))
      File.write(index, "REAL\n")

      _out, code = run_helper(helper)
      assert_equal 0, code
      assert_equal "REAL\n", File.read(index)
      assert File.file?(File.join(tmp, "web/dist/docs-content/_next/static/chunks/embed-placeholder.css"))
    end
  end
end
