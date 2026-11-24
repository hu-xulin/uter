#!/usr/bin/env ruby
# frozen_string_literal: true

# Regression guard for the Go //go:embed precondition in scripts/verify-all.sh.
#
# Bug fixed 2026-11-07: the local full gate ran `go vet ./...` before any
# frontend artifact existed. main.go embeds web/dist and web/dist/index.html,
# so every local Go vet run failed with "no matching files found" even when
# the Go code was clean. CI already solves this with a "Create frontend embed
# placeholder" step; the local harness had drifted from CI.
#
# Updated 2026-11-11 for the native-docs convergence: the retired Next.js
# static export is gone, so main.go no longer has an
# `all:web/dist/docs-content/_next` pattern. The helper must NOT recreate that
# skeleton — doing so would let a binary without docs assets look compilable.
#
# Invariants asserted here:
#   1. The embed-precondition step executes BEFORE the Go vet step (real order,
#      read from the production script, not a reimplementation).
#   2. Full mode still runs Go vet as a real `step` — never `skip`, never a
#      hardcoded PASS. Strictness is NOT relaxed.
#   3. Both scripts pass `bash -n`.
#   4. The precondition is idempotent and NON-DESTRUCTIVE: a real
#      web/dist/index.html is left byte-for-byte untouched.
#   5. When the artifact is absent, the embed pattern becomes resolvable.
#   6. Retired docs-content skeletons are never created, and a stale
#      docs-content tree fails closed instead of being silently accepted.
#   7. The release-chain verifier still checks all 7 search indexes and
#      both themes of the user-guide screenshots.
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
DOCS_VERIFY = File.join(REAL_ROOT, "scripts/verify-docs-artifacts.sh")

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

  def test_release_verifier_requires_all_native_docs_assets
    body = File.read(DOCS_VERIFY)
    assert_includes body, "for lang in en fr ja ru vi zh zh-TW; do",
                    "the verifier must iterate all seven docs locales"
    assert_includes body, 'index="$DIST/docs-search/$lang.json"',
                    "each locale must resolve to its own search index"
    assert_includes body, "user-guide/$loc/auth/$theme/02-email-code.webp",
                    "the verifier must check light/dark screenshot pairs"
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

  def test_real_frontend_artifact_is_never_overwritten
    with_fixture_repo do |tmp, helper|
      index = File.join(tmp, "web/dist/index.html")
      FileUtils.mkdir_p(File.dirname(index))
      File.write(index, "<!doctype html><title>REAL SPA</title>\n")

      out, code = run_helper(helper)
      assert_equal 0, code, "helper failed: #{out}"
      assert_equal "<!doctype html><title>REAL SPA</title>\n", File.read(index),
                   "a real SPA build must never be truncated by the precondition"
      refute_includes out, "created build-time embed skeleton",
                      "no placeholder may be created when a real artifact exists"
    end
  end

  def test_missing_artifact_is_created_and_helper_is_idempotent
    with_fixture_repo do |tmp, helper|
      out1, code1 = run_helper(helper)
      assert_equal 0, code1, "first run failed: #{out1}"
      assert_includes out1, "created build-time embed skeleton"
      assert_includes out1, "embed precondition OK"

      index = File.join(tmp, "web/dist/index.html")
      assert File.file?(index), "//go:embed web/dist/index.html needs a file"
      assert_equal "", File.read(index)

      # A second run must not truncate / duplicate anything.
      out2, code2 = run_helper(helper)
      assert_equal 0, code2, "second run failed: #{out2}"
      assert_includes out2, "no placeholder created"
      assert File.file?(index)
    end
  end

  def test_retired_docs_content_skeleton_is_never_created
    with_fixture_repo do |tmp, helper|
      _out, code = run_helper(helper)
      assert_equal 0, code
      refute File.exist?(File.join(tmp, "web/dist/docs-content")),
             "docs-web is retired: the helper must not create a docs-content skeleton"
    end
  end

  def test_stale_docs_content_tree_fails_closed
    with_fixture_repo do |tmp, helper|
      stale = File.join(tmp, "web/dist/docs-content/_next/static/chunks/old.css")
      FileUtils.mkdir_p(File.dirname(stale))
      File.write(stale, "/* STALE EXPORT */\n")

      out, code = run_helper(helper)
      refute_equal 0, code,
                   "a stale docs-content tree must fail closed, not be silently accepted"
      assert_includes out, "retired docs-content tree still present"
    end
  end
end
