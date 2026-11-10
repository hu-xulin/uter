#!/usr/bin/env ruby
# frozen_string_literal: true

# UTER-AES-GOV-001 §14.3 / §16.1 — live registry state reader (Ruby side).
#
# WHY THIS FILE EXISTS
#
# The gate evaluator used to state "304 registry entries remain DRAFT" as a
# literal. That was true at AES registry 1.9.0; by registry 1.12.1 the real
# count was 130. A frozen number inside an evidence generator makes the evidence
# wrong, and wrong evidence is more dangerous than missing evidence because it
# looks verified.
#
# The count must therefore be derived from the pinned AES checkout on every
# run, and must fail closed (report UNKNOWN) rather than fall back to a stale
# or invented value when the registry cannot be read.
#
# This module is deliberately dependency-free and side-effect-free so tests can
# require it without triggering the evaluator's main body.
#
# Counterpart: scripts/quality/lib/registry_draft_state.py (must agree).

module RegistryDraftState
  module_function

  # @param aes_repo [String] path to the pinned AES checkout
  # @return [Hash] { "available", "path", "draft_total", "active_total",
  #                  "by_section", "active_by_section", "note" }
  def read(aes_repo)
    path = File.join(aes_repo.to_s, ".aes/STANDARD-REGISTRY.yaml")

    unless File.file?(path) && File.readable?(path)
      return {
        "available" => false,
        "path" => path,
        "draft_total" => nil,
        "active_total" => nil,
        "by_section" => {},
        "active_by_section" => {},
        "note" => "AES registry not readable at #{path}; " \
                  "DRAFT/ACTIVE counts are UNKNOWN, not assumed."
      }
    end

    by_section = Hash.new(0)
    active_by_section = Hash.new(0)
    section = ""

    File.foreach(path) do |line|
      stripped = line.strip
      if !line.start_with?(" ") && !stripped.empty? && stripped.end_with?(":")
        section = stripped[0..-2]
      elsif ['status: DRAFT', 'status: "DRAFT"'].include?(stripped)
        by_section[section] += 1
      elsif ['status: ACTIVE', 'status: "ACTIVE"'].include?(stripped)
        active_by_section[section] += 1
      end
    end

    draft_total = by_section.values.sum
    active_total1 = active_by_section.values.sum
    detail = by_section.select { |_, v| v.positive? }
                       .sort.map { |k, v| "#{k}=#{v}" }.join(", ")

    {
      "available" => true,
      "path" => path,
      "draft_total" => draft_total,
      "active_total" => active_total1,
      "by_section" => by_section.select { |_, v| v.positive? },
      "active_by_section" => active_by_section.select { |_, v| v.positive? },
      "note" => "#{draft_total} AES registry entries remain DRAFT (#{detail}); " \
                "#{active_total1} entries are ACTIVE."
    }
  end

  # One-line wording that is always current, for open_reason strings.
  # @return [String]
  def note(aes_repo)
    state = read(aes_repo)
    return state["note"] if state["available"]

    "AES registry could not be read, so the DRAFT/ACTIVE split is UNKNOWN"
  end
end