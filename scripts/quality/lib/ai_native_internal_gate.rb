# frozen_string_literal: true

# UTER AI-NATIVE INTERNAL ACCEPTANCE GATE
#
# This is a SEPARATE gate channel. It answers exactly one question:
#   "Is the AES -> Uter *internal governance* acceptance backed by real,
#    machine-verifiable evidence produced by the of-record engine?"
#
# It deliberately does NOT answer, and must never be read as answering:
#   * historical L3/L4 GLOBAL CONFORMANCE (still governed by gates.rb, BLOCKED),
#   * the 42 historical per-item HUMAN sign-offs (still 0/42, preserved),
#   * third-party / regulatory / external attestation (separate, isolated).
#
# Nothing here writes to l1-l2-gates.json, l3-domain-gates.json,
# l4-global-gate.json, inventory.json or acceptance-authority.json. Their
# sha256 values are captured before and after this run and must be identical.
#
# Fail-closed: a missing file, an unparsable document, an unrun check, a hash
# mismatch or a failed of-record chain verification yields NOT_ACCEPTED.
# NOT_RUN / SKIPPED / UNKNOWN / BLOCKED are never promoted to a pass.

require "json"
require "digest"
require "time"
require "open3"
require "fileutils"

module AiNativeInternalGate
  GATE_FILE = "ai-native-internal-gate.json"

  # Byte-stable across repeated verification runs. The status engine re-hashes
  # exactly these files and compares against stable_core_digest, so a stale gate
  # cannot be reused after the underlying evidence changes.
  STABLE_CORE = [
    "governance/ai-native/registry/INTERNAL-ACCEPTANCE-LEDGER.json",
    "governance/ai-native/baselines/INTERNAL-HASH-BASELINE.json",
    "governance/ai-native/baselines/INTERNAL-BASELINE-APPROVAL.json",
    "governance/ai-native/trust/INTERNAL-TRUST-ROOT.json",
    "governance/ai-native/records/AI-NATIVE-APPROVAL-RECORDS.jsonl"
  ].freeze

  # Re-generated on every run (timestamps / append-only records). The gate
  # verifies their CONTENT at run time; the status engine independently
  # re-verifies the live content instead of trusting this manifest's hash.
  LIVE_RECHECKED = [
    "governance/ai-native/records/AI-NATIVE-VALIDATION-SUITES.jsonl",
    "governance/ai-native/reports/INDEPENDENT-AUTOMATED-REVIEW.json",
    "governance/ai-native/reports/EVIDENCE-INDEX.json",
    "governance/ai-native/reports/AUTONOMOUS-SECURITY-TEST-RUN.json",
    "governance/ai-native/registry/SIGNOFF-RECLASSIFICATION.json",
    "governance/ai-native/registry/A3-READJUDICATION.json",
    "governance/ai-native/registry/AES-UTER-DOWNSTREAM-BINDING.yaml",
    "governance/ai-native/EXTERNAL-ATTESTATION-SEPARATION-POLICY.md"
  ].freeze

  UTER_EVIDENCE = [
    ".aes/aes-pin.json",
    ".aes/autonomous/config/ai-native-downstream.json",
    ".aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md"
  ].freeze

  HISTORICAL_UTER = [
    "reports/compliance/aes-full-migration-2026-11-06/evidence/manual-acceptance/acceptance-authority.json",
    "reports/compliance/aes-full-migration-2026-11-06/evidence/manual-acceptance/inventory.json",
    "reports/compliance/aes-full-migration-2026-11-06/evidence/gates/l3-domain-gates.json",
    "reports/compliance/aes-full-migration-2026-11-06/evidence/gates/l4-global-gate.json"
  ].freeze

  HISTORICAL_AES = [
    "reports/quality/AES-P05-PRE-IMPORT-BASELINE.sha256"
  ].freeze

  def self.run(root:, aes_repo:, evidence_dir: nil, out_dir: nil)
    Runner.new(root: root, aes_repo: aes_repo, evidence_dir: evidence_dir, out_dir: out_dir).run
  end

  class Runner
    def initialize(root:, aes_repo:, evidence_dir:, out_dir:)
      @root = root
      @aes = aes_repo
      @evidence = evidence_dir || File.join(root, "reports/compliance/aes-full-migration-2026-11-06/evidence")
      @out = out_dir || File.join(@evidence, "gates")
      @checks = []
      @manifest = []
    end

    def run
      @historical_before = snapshot_historical
      run_checks
      @historical_after = snapshot_historical
      build_manifest

      unmodified = @historical_before == @historical_after &&
                   @historical_before.values.none? { |v| v.nil? || v.empty? }
      all_pass = @checks.length == expected_check_count &&
                 @checks.all? { |c| c["ran"] == true && c["status"] == "PASS" }

      doc = {
        "document_id" => "UTER-AI-NATIVE-INTERNAL-ACCEPTANCE-GATE",
        "gate_id" => "AI_NATIVE_INTERNAL_ACCEPTANCE_GATE",
        "version" => "1.0.0",
        "generated_at" => Time.now.utc.iso8601,
        "generated_by" => "uter/scripts/quality/lib/ai_native_internal_gate.rb",
        "execution" => "REAL_RUBY_GATE_EXECUTION",
        "scope" => "INTERNAL_GOVERNANCE_ACCEPTANCE_ONLY",
        "uter_head" => git_head(@root),
        "aes_head" => git_head(@aes),
        "aes_git_sha" => git_head(@aes),
        "checks" => @checks,
        "check_summary" => {
          "total" => @checks.length,
          "pass" => @checks.count { |c| c["status"] == "PASS" },
          "fail" => @checks.count { |c| c["status"] != "PASS" },
          "not_run" => @checks.count { |c| c["ran"] == false }
        },
        "verdict" => all_pass && unmodified ? "INTERNAL_ACCEPTED" : "NOT_ACCEPTED",
        "evidence_manifest" => @manifest,
        "stable_core_digest" => stable_core_digest,
        "historical_evidence" => {
          "sha256_before" => @historical_before,
          "sha256_after" => @historical_after,
          "unmodified_during_gate" => unmodified,
          "acceptance_authority_decision" => dig_json(@historical_before.keys.first, "decision"),
          "signed_item_count" => dig_json(@historical_before.keys.first, "signed_item_ids", [])&.length,
          "note" => "历史人工验收权威、inventory、L3/L4 门禁与 P05 基线在本门禁执行前后字节一致；不改写、不补签、不冒用具名权威。"
        },
        "legacy_gate_state" => legacy_gate_state,
        "blocking_matrix" => {
          "internal_delivery" => "NOT_BLOCKED_BY_LEGACY_L3_L4_FULL_CONFORMANCE_GATE",
          "external_attestation" => "SEPARATE_NOT_CLAIMED_AS_PASSED",
          "historical_human_signoff" => "PRESERVED_NOT_FABRICATED",
          "original_authority_signature" => "ISOLATED_NOT_RESEALED"
        },
        "explicitly_not" => [
          "HISTORICAL_L3_L4_GLOBAL_CONFORMANCE_PASS",
          "HUMAN_PER_ITEM_SIGNOFF_42_OF_42",
          "THIRD_PARTY_CERTIFICATION",
          "LEGAL_OR_REGULATORY_ATTESTATION",
          "ORIGINAL_AES_AUTHORITY_RESEAL",
          "PRODUCTION_DEPLOYMENT_AUTHORIZATION"
        ],
        "honesty_note" => "本门禁只判定内部治理验收是否有真实机器证据；历史全量符合性门禁保持原状且不阻塞内部交付。未执行、跳过、未知、阻断一律不记为通过。",
        "NOT_RUN_never_pass" => true
      }

      FileUtils.mkdir_p(@out)
      File.write(File.join(@out, GATE_FILE), JSON.pretty_generate(doc) + "\n")
      doc
    end

    private

    def expected_check_count = 11

    def aes(rel) = File.join(@aes, rel)
    def uter(rel) = File.join(@root, rel)

    def sha256_file(path)
      File.file?(path) ? Digest::SHA256.file(path).hexdigest : nil
    end

    def json(path)
      return nil unless File.file?(path)
      JSON.parse(File.read(path))
    rescue JSON::ParserError, Errno::ENOENT
      nil
    end

    def text(path)
      File.file?(path) ? File.read(path) : ""
    end

    def jsonl_last(path)
      return nil unless File.file?(path)
      line = File.readlines(path).map(&:strip).reject(&:empty?).last
      line ? JSON.parse(line) : nil
    rescue JSON::ParserError
      nil
    end

    def git_head(repo)
      out, _err, st = Open3.capture3("git", "-C", repo, "rev-parse", "HEAD")
      st.success? ? out.strip : nil
    end

    def snapshot_historical
      out = {}
      HISTORICAL_UTER.each { |rel| out["uter/#{rel}"] = sha256_file(uter(rel)) }
      HISTORICAL_AES.each { |rel| out["aes/#{rel}"] = sha256_file(aes(rel)) }
      out
    end

    def dig_json(key, field, default = nil)
      path = key.to_s.start_with?("uter/") ? uter(key.to_s.sub(%r{\Auter/}, "")) : aes(key.to_s.sub(%r{\Aaes/}, ""))
      (json(path) || {}).fetch(field, default)
    end

    def legacy_gate_state
      l3 = json(uter("reports/compliance/aes-full-migration-2026-11-06/evidence/gates/l3-domain-gates.json")) || {}
      l4 = json(uter("reports/compliance/aes-full-migration-2026-11-06/evidence/gates/l4-global-gate.json")) || {}
      {
        "l3_status" => l3["status"], "l3_pass_count" => l3["pass_count"],
        "l4_status" => l4["status"], "l4_met" => l4["met"], "l4_not_met" => l4["not_met"],
        "rewritten_by_this_gate" => false,
        "note" => "历史 L3/L4 全量符合性门禁结果如实记录，未被本内部验收门禁改写；其未满足项属外部/人工证据缺口，按架构分离原则不阻塞内部治理交付。"
      }
    end

    def check(id, description, sources = [])
      ok, detail, facts = yield
      @checks << {
        "id" => id, "description" => description, "ran" => true,
        "status" => ok ? "PASS" : "FAIL", "detail" => detail.to_s,
        "facts" => facts || {}, "sources" => sources
      }
    rescue StandardError => e
      @checks << {
        "id" => id, "description" => description, "ran" => false,
        "status" => "FAIL", "detail" => "check raised: #{e.class}: #{e.message}",
        "facts" => {}, "sources" => sources
      }
    end

    def run_checks
      ledger_path = aes(STABLE_CORE[0])

      check("G-01", "42 项内部验收台账真实存在、全部有机器决策且无人工/第三方签署", [STABLE_CORE[0]]) do
        l = json(ledger_path)
        rows = l.is_a?(Hash) ? Array(l["results"]) : []
        bad = rows.reject { |r|
          %w[INTERNAL_ACCEPTED_DIRECT INTERNAL_SUBSTITUTE_ACCEPTED].include?(r["decision"]) &&
            r["human_signoff_used"] == false && r["third_party_signoff_used"] == false &&
            r["NOT_RUN_counted_as_pass"] == false
        }
        ok = l.is_a?(Hash) && rows.length == 42 && l.dig("summary", "total") == 42 &&
             l.dig("summary", "internal_not_run") == 0 && l["FULL_INTERNAL_ACCEPTANCE_PASSED"] == true &&
             bad.empty?
        [ok, "rows=#{rows.length} internal_not_run=#{l.is_a?(Hash) ? l.dig('summary', 'internal_not_run') : 'MISSING'} bad_rows=#{bad.length}", { "bad_rows" => bad.map { |r| r["id"] }.first(10) }]
      end

      check("G-02", "AI-Native 验收套件最近一次真实执行为 ALL_PASS 且无 NOT_RUN", ["governance/ai-native/records/AI-NATIVE-VALIDATION-SUITES.jsonl"]) do
        s = jsonl_last(aes("governance/ai-native/records/AI-NATIVE-VALIDATION-SUITES.jsonl"))
        sm = s.is_a?(Hash) ? (s["summary"] || {}) : {}
        ok = s.is_a?(Hash) && s["verdict"] == "ALL_PASS" && sm["pass"].to_i >= 18 &&
             sm["fail"].to_i == 0 && sm["not_run"].to_i == 0
        [ok, "verdict=#{s.is_a?(Hash) ? s['verdict'] : 'MISSING'} pass=#{sm['pass']} fail=#{sm['fail']} not_run=#{sm['not_run']}", { "suite_id" => s.is_a?(Hash) ? s["suite_id"] : nil }]
      end

      check("G-03", "独立自动复核为独立进程 VERIFIED 且明确不是第三方认证", ["governance/ai-native/reports/INDEPENDENT-AUTOMATED-REVIEW.json"]) do
        r = json(aes("governance/ai-native/reports/INDEPENDENT-AUTOMATED-REVIEW.json"))
        sm = r.is_a?(Hash) ? (r["summary"] || {}) : {}
        ok = r.is_a?(Hash) && r["verdict"] == "VERIFIED" && r["is_third_party_certification"] == false &&
             r["separate_process"] == true && r["separate_environment"] == true &&
             sm["findings"].to_i == 0 && sm["not_run"].to_i == 0
        [ok, "verdict=#{r.is_a?(Hash) ? r['verdict'] : 'MISSING'} findings=#{sm['findings']} third_party=#{r.is_a?(Hash) ? r['is_third_party_certification'] : 'MISSING'}", {}]
      end

      check("G-04", "of-record 证据链真实重算通过且证据索引完整", ["governance/ai-native/records/EVIDENCE-CHAIN.jsonl", "governance/ai-native/reports/EVIDENCE-INDEX.json"]) do
        cli = aes("governance/ai-native/engine/cli.mjs")
        stdout, stderr, st = if File.file?(cli)
                               Open3.capture3("node", cli, "chain", chdir: @aes)
                             else
                               ["", "of-record CLI missing", nil]
                             end
        parsed = begin
          JSON.parse(stdout)
        rescue StandardError
          {}
        end
        chain_ok = st&.success? == true && parsed["ok"] == true && Array(parsed["errors"]).empty?
        idx = json(aes("governance/ai-native/reports/EVIDENCE-INDEX.json"))
        idx_ok = idx.is_a?(Hash) && idx["chain_verified"] == true && Array(idx["broken"]).empty? && idx["total"].to_i > 0
        [chain_ok && idx_ok, "chain_exit=#{st&.exitstatus} chain_ok=#{parsed['ok']} records=#{parsed['count']} index_total=#{idx.is_a?(Hash) ? idx['total'] : 'MISSING'} broken=#{idx.is_a?(Hash) ? Array(idx['broken']).length : 'MISSING'} #{stderr.to_s[0, 120]}", {}]
      end

      check("G-05", "内部哈希基线逐条复算真实文件 sha256，历史 P05 基线保持原样", ["governance/ai-native/baselines/INTERNAL-HASH-BASELINE.json"]) do
        b = json(aes(STABLE_CORE[1]))
        entries = b.is_a?(Hash) ? Array(b["entries"]) : []
        bad = entries.reject { |e| sha256_file(aes(e["path"])) == e["sha256"] }
        p05 = b.is_a?(Hash) ? Array(b["preserved_historical_baselines"])[0] : nil
        p05_ok = p05.is_a?(Hash) && p05["sha256"] == sha256_file(aes("reports/quality/AES-P05-PRE-IMPORT-BASELINE.sha256"))
        ok = b.is_a?(Hash) && entries.length >= 40 && bad.empty? && b["seal_status"] == "SEALED_INTERNAL" && p05_ok
        [ok, "entries=#{entries.length} mismatches=#{bad.length} seal=#{b.is_a?(Hash) ? b['seal_status'] : 'MISSING'} p05_preserved=#{p05_ok}", { "bad" => bad.map { |e| e["path"] }.first(10) }]
      end

      check("G-06", "内部信任根为无签名自治机器证据模型：零私钥、零签名身份、零人类/第三方签名依赖，且不冒充原 Authority", ["governance/ai-native/trust/INTERNAL-TRUST-ROOT.json"]) do
        path = aes(STABLE_CORE[3])
        t = json(path)
        raw = File.exist?(path) ? File.read(path) : ""
        nots = t.is_a?(Hash) ? Array(t["explicitly_not"]) : []
        deps = %w[signature_dependency human_signature_dependency third_party_signature_dependency private_key_dependency ci_secret_dependency]
        deps_ok = t.is_a?(Hash) && deps.all? { |k| t[k] == "NONE" }
        # AES-TRUST-MODEL-002 / v2.0.0: the of-record trust root declares a
        # DETERMINISTIC machine seal. There is no signing key, no signer roster
        # and no signature namespace. The retained historical PUBLIC KEY (never
        # a private key) is verification-only for legacy seals and must be
        # explicitly declared with that exact purpose.
        model_ok = t.is_a?(Hash) && t["version"] == "2.0.0" &&
                   t["trust_model"] == "AUTONOMOUS_MACHINE_EVIDENCE" &&
                   t["trust_model_id"] == "AES-TRUST-MODEL-002"
        seal_ok = t.is_a?(Hash) && t["signature_class"] == "AUTONOMOUS_MACHINE_EVIDENCE_SEAL" &&
                  t["algorithm"] == "SHA256_CANONICAL_SEAL" &&
                  t["seal_mode"] == "DETERMINISTIC_RECOMPUTATION_AND_HASH_CHAIN" &&
                  t["private_key_location"] == "NONE" && t["private_key_in_git"] == false &&
                  t.dig("original_authority_key", "signing_capability") == "NONE"
        # Any undeclared signature-era field, any private-key PEM, any signing
        # identity or any CI signing secret is a hard regression.
        banned_keys = %w[public_key_pem internal_signature signing_identity signature_namespace signer_roster allowed_signers]
        leaked_keys = t.is_a?(Hash) ? banned_keys.select { |k| t.key?(k) } : []
        no_private_material = !raw.include?("PRIVATE KEY") && !raw.include?("AES_INTERNAL_SIGNING_KEY")
        historical = t.is_a?(Hash) ? t["historical_public_key_pem"] : nil
        historical_ok = historical.nil? ||
          (historical.include?("BEGIN PUBLIC KEY") &&
           t["historical_public_key_purpose"] == "VERIFY_LEGACY_SEALS_ONLY_NO_SIGNING_CAPABILITY")
        ok = model_ok && seal_ok && deps_ok && leaked_keys.empty? && no_private_material && historical_ok &&
             t.dig("original_authority_key", "original_authority_key_present") == false &&
             t.dig("original_authority_key", "original_authority_key_used") == false &&
             t.dig("original_authority_key", "private_keys_deleted") == true &&
             t.dig("original_authority_key", "controlled_local_key_used") == false &&
             nots.include?("RG-14_RESEAL") && nots.include?("ORIGINAL_AES_AUTHORITY_SIGNATURE") &&
             nots.include?("PRIVATE_KEY_SIGNATURE")
        [ok, "model=#{t.is_a?(Hash) ? t['trust_model'] : 'MISSING'} version=#{t.is_a?(Hash) ? t['version'] : 'MISSING'} deps=#{deps_ok} seal=#{seal_ok} leaked_keys=#{leaked_keys.join(',')} private_material_absent=#{no_private_material} historical_public_key_verification_only=#{historical_ok} original_key_used=#{t.is_a?(Hash) ? t.dig('original_authority_key', 'original_authority_key_used') : 'MISSING'}",
         { "leaked_keys" => leaked_keys, "dependency_fields" => deps.map { |k| [k, t.is_a?(Hash) ? t[k] : nil] }.to_h }]
      end

      check("G-07", "内部基线由 of-record 引擎自动批准，无人工/第三方审批要求", ["governance/ai-native/baselines/INTERNAL-BASELINE-APPROVAL.json"]) do
        a = json(aes(STABLE_CORE[2]))
        rv = a.is_a?(Hash) ? (a["rule_validation"] || {}) : {}
        ok = a.is_a?(Hash) && a["decision"] == "AUTO_APPROVED" &&
             a["human_approval_required"] == false && a["third_party_approval_required"] == false &&
             rv["all_pass"] == true && rv["validation_verdict"] == "ALL_PASS" &&
             %w[AUTO_APPROVED AUTO_EXECUTED].include?(rv["legacy_decision"])
        [ok, "decision=#{a.is_a?(Hash) ? a['decision'] : 'MISSING'} legacy=#{rv['legacy_decision']} all_pass=#{rv['all_pass']}", {}]
      end

      check("G-08", "13 项安全测试矩阵真实执行、无失败且无虚报通过", ["governance/ai-native/reports/AUTONOMOUS-SECURITY-TEST-RUN.json"]) do
        s = json(aes("governance/ai-native/reports/AUTONOMOUS-SECURITY-TEST-RUN.json"))
        sm = s.is_a?(Hash) ? (s["summary"] || {}) : {}
        rows = s.is_a?(Hash) ? Array(s["results"]) : []
        ok = s.is_a?(Hash) && rows.length == 13 && sm["total"] == 13 && sm["false_pass"] == 0 &&
             sm["not_run"] == 0 && sm["fail"] == 0
        [ok, "rows=#{rows.length} false_pass=#{sm['false_pass']} not_run=#{sm['not_run']} fail=#{sm['fail']}", {}]
      end

      check("G-09", "AES 单一治理源、Uter pin 与下游绑定一致且无重复企业级规范", UTER_EVIDENCE) do
        pin = json(uter(".aes/aes-pin.json"))
        cfg = json(uter(".aes/autonomous/config/ai-native-downstream.json"))
        binding = text(aes("governance/ai-native/registry/AES-UTER-DOWNSTREAM-BINDING.yaml"))
        dup = File.exist?(uter(".aes/STANDARD-REGISTRY.yaml"))
        p13 = File.file?(uter(".aes/UTER-P13-BUSINESS-DOMAIN-ENGINEERING.md"))
        ok = pin.is_a?(Hash) && !pin["registry_version"].to_s.empty? && !dup && p13 &&
             binding.include?("SINGLE_SOURCE_OF_TRUTH") &&
             cfg.is_a?(Hash) && cfg.dig("blocking_matrix", "internal_acceptance") == "none" &&
             cfg.dig("blocking_matrix", "external_attestation") == "external_evidence_only"
        [ok, "pin=#{pin.is_a?(Hash) ? pin['registry_version'] : 'MISSING'} duplicate_registry=#{dup} p13=#{p13} single_source=#{binding.include?('SINGLE_SOURCE_OF_TRUTH')}", {}]
      end

      check("G-10", "历史人工验收权威与 42 项 inventory 未被补签或篡改", HISTORICAL_UTER) do
        auth = json(uter("reports/compliance/aes-full-migration-2026-11-06/evidence/manual-acceptance/acceptance-authority.json"))
        inv = json(uter("reports/compliance/aes-full-migration-2026-11-06/evidence/manual-acceptance/inventory.json"))
        ok = auth.is_a?(Hash) && auth["decision"] != "GRANTED" && auth["signoff_granted"] == false &&
             Array(auth["signed_item_ids"]).empty? && inv.is_a?(Hash) &&
             inv.dig("acceptance_decision", "status") != "GRANTED" &&
             Array(inv["items"]).length == 42
        [ok, "decision=#{auth.is_a?(Hash) ? auth['decision'] : 'MISSING'} signed=#{auth.is_a?(Hash) ? Array(auth['signed_item_ids']).length : 'MISSING'} items=#{inv.is_a?(Hash) ? Array(inv['items']).length : 'MISSING'}", {}]
      end

      check("G-11", "外部认证已从内部验收拆离，A6 项未被自动批准", ["governance/ai-native/registry/A3-READJUDICATION.json", "governance/ai-native/EXTERNAL-ATTESTATION-SEPARATION-POLICY.md"]) do
        a3 = json(aes("governance/ai-native/registry/A3-READJUDICATION.json"))
        a6 = a3.is_a?(Hash) ? Array(a3["items"]).select { |i| i["class"] == "A6" } : []
        sep = text(aes("governance/ai-native/EXTERNAL-ATTESTATION-SEPARATION-POLICY.md"))
        bad = a6.reject { |i| i["auto_approved"] == false && i["external_attestation_is_blocking_internal_delivery"] == false }
        ok = a6.length.positive? && bad.empty? && sep.include?("EXTERNAL") &&
             (sep.include?("SEPARATE") || sep.include?("分离"))
        [ok, "a6=#{a6.length} bad=#{bad.length} separation_policy_present=#{!sep.empty?}", {}]
      end
    end

    def build_manifest
      STABLE_CORE.each { |rel| @manifest << manifest_row("aes", rel, "STABLE_CORE", sha256_file(aes(rel))) }
      LIVE_RECHECKED.each { |rel| @manifest << manifest_row("aes", rel, "LIVE_RECHECKED", sha256_file(aes(rel))) }
      UTER_EVIDENCE.each { |rel| @manifest << manifest_row("uter", rel, "LIVE_RECHECKED", sha256_file(uter(rel))) }
      @manifest.sort_by! { |r| "#{r['root']}/#{r['path']}" }
    end

    def manifest_row(root, path, role, hash)
      { "root" => root, "path" => path, "role" => role, "sha256" => hash, "present" => !hash.nil? }
    end

    def stable_core_digest
      lines = @manifest.select { |r| r["role"] == "STABLE_CORE" && r["root"] == "aes" }
                       .sort_by { |r| r["path"] }
                       .map { |r| "#{r['path']}\t#{r['sha256']}\n" }
      Digest::SHA256.hexdigest(lines.join)
    end
  end
end
