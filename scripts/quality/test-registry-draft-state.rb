#!/usr/bin/env ruby
# frozen_string_literal: true

# UTER-UAES-GOV-001 §8.3 / §14.3 / §16.1 — evidence must not carry frozen facts.
#
# Regression test for a real defect found on 2026-11-08:
#
#   Three scripts hard-coded the string "304 registry entries remain DRAFT".
#   That number was correct at UAES registry 1.9.0. The registry later moved to
#   1.12.1 and the real DRAFT count became 130, but the literal stayed at 304.
#   An evidence generator that asserts a stale count produces WRONG evidence,
#   and wrong evidence is worse than missing evidence: it looks verified.
#
# The fix derives the count from the pinned UAES registry on every run. This
# test locks that behaviour in so it cannot silently regress to a literal.
#
# Invariants asserted:
#   1. Neither generator embeds a bare DRAFT-total number in its open_reason or
#      manual-item wording.
#   2. Both generators report the SAME live count for the SAME registry.
#   3. The reported count matches an independent recount of the YAML.
#   4. Pointing UAES_REPO at a registry with a different DRAFT count changes the
#      reported number. A hard-coded value would fail this.
#   5. An unreadable registry yields an explicit UNKNOWN, never a stale number
#      and never a silent zero.
#
# Usage: ruby scripts/quality/test-registry-draft-state.rb
# Exit:  0 = all invariants hold; 1 = a regression was detected.

require "minitest/autorun"
require "tmpdir"
require "fileutils"
require "json"
require "open3"

ROOT = File.expand_path("../..", __dir__)
UAES_DEFAULT = File.expand_path(ENV.fetch("UAES_REPO", File.join(ROOT, "..", "uaes")))
PY_GEN = File.join(ROOT, "scripts/quality/uaes-manual-acceptance.py")
RB_GEN = File.join(ROOT, "scripts/quality/uaes-governance-gates.rb")

class RegistryDraftStateTest < Minitest::Test
  # Independent recount, deliberately NOT reusing the generator's parser: read
  # the YAML and count status fields per section. If the generator's own parser
  # were wrong, this would disagree with it.
  def recount(path)
    require "yaml"
    doc = YAML.safe_load(File.read(path))
    draft = 0
    active = 0
    walk = lambda do |node|
      case node
      when Hash
        node.each_value do |v|
          if v.is_a?(String)
            draft += 1 if v == "DRAFT"
            active += 1 if v == "ACTIVE"
          else
            walk.call(v)
          end
        end
      when Array
        node.each { |v| walk.call(v) }
      end
    end
    walk.call(doc)
    { draft: draft, active: active }
  end

  def py_state(uaes_repo)
    script = <<~PY
      import importlib.util, json
      spec = importlib.util.spec_from_file_location("ma", #{PY_GEN.inspect})
      m = importlib.util.module_from_spec(spec)
      spec.loader.exec_module(m)
      s = m.registry_draft_state()
      print(json.dumps({k: s[k] for k in ("available", "draft_total", "active_total", "note")}))
    PY
    out, err, st = Open3.capture3(
      { "UAES_REPO" => uaes_repo }, "python3", "-c", script, chdir: ROOT
    )
    assert st.success?, "python generator failed: #{err}"
    JSON.parse(out.lines.last)
  end

  def rb_state(uaes_repo)
    script = <<~RB
      require "json"
      require #{File.join(ROOT, "scripts/quality/lib/registry_draft_state").inspect}
      s = RegistryDraftState.read(#{uaes_repo.inspect})
      puts JSON.generate({ "available" => s["available"], "draft_total" => s["draft_total"],
                           "active_total" => s["active_total"], "note" => s["note"] })
    RB
    out, err, st = Open3.capture3(
      { "UAES_REPO" => uaes_repo }, "ruby", "-e", script, chdir: ROOT
    )
    assert st.success?, "ruby reader failed: #{err}"
    JSON.parse(out.lines.last)
  end

  # --- 1. no bare DRAFT-total literal left in the call sites ---------------
  def test_wording_is_generated_not_literal
    # The two generators must obtain their wording from the live reader. A bare
    # "NNN ... remain DRAFT" string inside them would be a frozen fact.
    [PY_GEN, RB_GEN].each do |path|
      src = File.read(path)
      code = src.lines.reject { |l| l.strip.start_with?("#") }.join
      offenders = code.scan(/\b\d{2,4}\s+(?:UAES\s+)?registry entries remain DRAFT/i)
      assert_empty offenders,
                   "#{File.basename(path)} interpolates a literal DRAFT count: #{offenders.inspect}"
    end
    assert_includes File.read(RB_GEN), "RegistryDraftState.read",
                    "ruby evaluator must read the live registry state"
    assert_includes File.read(PY_GEN), "registry_draft_state",
                    "python collector must read the live registry state"
  end

  # --- 2. both generators agree on the same registry ------------------------
  def test_generators_agree_on_live_count
    py = py_state(UAES_DEFAULT)
    rb = rb_state(UAES_DEFAULT)
    assert py["available"], "python could not read the pinned registry"
    assert rb["available"], "ruby could not read the pinned registry"
    assert_equal rb["draft_total"], py["draft_total"],
                 "python and ruby disagree on the DRAFT count for the same registry"
  end

  # --- 3. the live count matches an independent recount --------------------
  def test_live_count_matches_independent_recount
    registry = File.join(UAES_DEFAULT, ".uaes/STANDARD-REGISTRY.yaml")
    skip "pinned UAES registry not present" unless File.file?(registry)
    expected = recount(registry)
    py = py_state(UAES_DEFAULT)
    assert_equal expected[:draft], py["draft_total"],
                 "generator DRAFT count disagrees with an independent YAML recount"
    assert_equal expected[:active], py["active_total"],
                 "generator ACTIVE count disagrees with an independent YAML recount"
  end

  # --- 4. a different registry must produce a different number -------------
  def test_count_follows_the_registry_not_a_constant
    Dir.mktmpdir("uaes-registry-fixture-") do |tmp|
      fixture_uaes = File.join(tmp, "uaes")
      FileUtils.mkdir_p(File.join(fixture_uaes, ".uaes"))
      # 3 DRAFT, 2 ACTIVE — deliberately unlike any real total.
      File.write(File.join(fixture_uaes, ".uaes/STANDARD-REGISTRY.yaml"), <<~YAML)
        registry:
          version: 9.9.9
          status: DRAFT
        phases:
          P00:
            status: DRAFT
          P01:
            status: ACTIVE
        schemas:
          S1:
            status: DRAFT
          S2:
            status: ACTIVE
        gates:
          G1:
            status: DRAFT
      YAML

      py = py_state(fixture_uaes)
      rb = rb_state(fixture_uaes)
      assert_equal 4, py["draft_total"],
                   "DRAFT count did not follow the fixture registry (expected 4: version + 3 entries)"
      assert_equal 4, rb["draft_total"],
                   "ruby DRAFT count did not follow the fixture registry"
      assert_equal 2, py["active_total"], "ACTIVE count did not follow the fixture registry"
      assert_equal 2, rb["active_total"], "ruby ACTIVE count did not follow the fixture registry"
    end
  end

  # --- 5. unreadable registry → UNKNOWN, never a stale number --------------
  def test_unreadable_registry_reports_unknown
    Dir.mktmpdir("uaes-missing-fixture-") do |tmp|
      missing = File.join(tmp, "no-such-uaes")
      FileUtils.mkdir_p(missing)

      py = py_state(missing)
      assert_equal false, py["available"], "python claimed availability without a registry"
      assert_nil py["draft_total"], "python invented a DRAFT total for an unreadable registry"
      assert_match(/UNKNOWN/, py["note"], "python note must say UNKNOWN, got: #{py['note']}")

      rb = rb_state(missing)
      assert_equal false, rb["available"], "ruby claimed availability without a registry"
      assert_nil rb["draft_total"], "ruby invented a DRAFT total for an unreadable registry"
      assert_match(/UNKNOWN/, rb["note"], "ruby note must say UNKNOWN, got: #{rb['note']}")
    end
  end

  # --- 6. the wording a signoff page reads is generated, not literal -------
  def test_draft_state_note_is_self_describing
    py = py_state(UAES_DEFAULT)
    skip "pinned UAES registry not present" unless py["available"]
    note = py["note"]
    assert_match(/\d+ UAES registry entries remain DRAFT/, note)
    assert_match(/ACTIVE/, note, "note must also state the ACTIVE side, not only DRAFT")
    assert_match(/phases=\d+/, note, "note must break the count down by section")
  end
end