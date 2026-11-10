#!/usr/bin/env ruby
# frozen_string_literal: true

# Standalone entry point for the AI-Native INTERNAL acceptance gate.
#
# Used by the AES AI-Native engine (`cli.mjs` step `uter_internal_gate`) so the
# Uter repository itself really executes and signs off its internal acceptance
# evidence — instead of AES writing an assertion into Uter on its behalf.
#
# Unlike `aes-governance-gates.rb`, this entry point does NOT regenerate the
# historical L1/L2/L3/L4 evidence files. Those remain byte-for-byte unchanged.
#
# Exit 0 => INTERNAL_ACCEPTED, exit 1 => NOT_ACCEPTED (honest, never suppressed).

require "json"
require_relative "lib/ai_native_internal_gate"

root = File.expand_path("../..", __dir__)
aes_repo = ENV.fetch("AES_REPO", File.expand_path("../aes", root))

doc = AiNativeInternalGate.run(root: root, aes_repo: aes_repo)

puts JSON.generate({
  "gate_id" => doc["gate_id"],
  "verdict" => doc["verdict"],
  "scope" => doc["scope"],
  "checks" => doc["check_summary"],
  "stable_core_digest" => doc["stable_core_digest"],
  "legacy_gate_state" => doc["legacy_gate_state"],
  "report" => "reports/compliance/aes-full-migration-2026-11-06/evidence/gates/#{AiNativeInternalGate::GATE_FILE}"
})

exit(doc["verdict"] == "INTERNAL_ACCEPTED" ? 0 : 1)
