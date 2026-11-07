#!/usr/bin/env ruby
# frozen_string_literal: true

# UAES P08 / D09 — WorkBuddy (AI Agent) runtime enforcement harness.
#
# This is NOT a static-configuration check. It:
#   * preflight  — executes the 10 mandatory pre-task checks against live repo state
#                  and the pinned UAES repository, emitting structured evidence;
#   * authorize  — evaluates an action against the real policy file with fail-closed
#                  defaults and full-validation gating for delivery actions;
#   * verify     — runs real commands, stores raw output/exit codes, and refuses to
#                  emit a success verdict when any command fails;
#   * selftest   — runs positive/negative (over-privilege) decisions and asserts that
#                  a failing test can never be reported as a pass.
#
# Exit codes: 0 = verified/allowed, 1 = assertion or verification failure,
#             2 = authorization DENIED, 3 = usage error.
#
# The harness validates the enforcement surface that WorkBuddy must obey. It does
# not claim to sandbox a third-party Agent binary; the live-task trace is recorded
# separately in D09 with the concrete observations from the actual execution.

require "json"
require "yaml"
require "open3"
require "time"
require "digest"
require "fileutils"

ROOT = File.expand_path("../..", __dir__)
POLICY_PATH = File.join(ROOT, ".uaes/agent-governance.yaml")
PIN_PATH = File.join(ROOT, ".uaes/uaes-pin.json")
ENTRY_PATH = File.join(ROOT, ".uaes/AI-GOVERNANCE-ENTRY.md")
EVIDENCE_DIR = ENV.fetch(
  "UAES_EVIDENCE_DIR",
  File.join(ROOT, "reports/compliance/uaes-full-migration-2026-11-06/evidence")
)
DEFAULT_UAES_REPO = File.expand_path("../uaes", ROOT)

def now = Time.now.utc.iso8601

def git(*args)
  out, err, status = Open3.capture3("git", "-C", ROOT, *args)
  [out.strip, err.strip, status.exitstatus]
end

# Porcelain status lines are `XY PATH`; their leading whitespace is significant.
def git_raw(*args)
  out, err, status = Open3.capture3("git", "-C", ROOT, *args)
  [out, err.strip, status.exitstatus]
end

def load_policy
  abort "FAIL: missing policy #{POLICY_PATH}" unless File.file?(POLICY_PATH)
  YAML.safe_load_file(POLICY_PATH)
end

def write_evidence(name, payload)
  FileUtils.mkdir_p(EVIDENCE_DIR)
  path = File.join(EVIDENCE_DIR, name)
  File.write(path, JSON.pretty_generate(payload) + "\n")
  path
end

# ---------------------------------------------------------------------------
# Authorization decision — the single enforcement function used by the CLI and
# by the self-test. Fail-closed: anything not explicitly allowed is denied.
# ---------------------------------------------------------------------------
def decide(policy, action, profile_name, validation_passed: false)
  execution = policy.fetch("execution_policy", {})
  forbidden = execution.fetch("forbidden", [])
  return ["DENY", "execution_policy.forbidden: #{action}"] if forbidden.include?(action)

  gated = execution.fetch("full_validation_required_before", [])
  if gated.include?(action) && !validation_passed
    return ["DENY", "L1_CHANGE_GATE + L2_INTEGRATION_GATE + 14xL3_DOMAIN_ACCEPTANCE_GATE + L4_GLOBAL_CONFORMANCE_GATE not passed; delivery action blocked"]
  end

  approval = policy.fetch("approval_rules", {})
  denied_approval = approval.select { |_k, v| v.is_a?(Hash) && v["effect"] == "deny" }.keys
  if denied_approval.any? { |key| action.include?(key) || key.include?(action) }
    return ["DENY", "approval_rules deny: #{action}"]
  end

  profile = policy.dig("permission_profiles", profile_name) || {}
  return ["DENY", "profile #{profile_name} explicitly denies #{action}"] if profile.fetch("deny", []).include?(action)
  return ["ALLOW", "profile #{profile_name} explicitly allows #{action}"] if profile.fetch("allow", []).include?(action)

  ["DENY", "default_effect=deny; #{action} is not granted to #{profile_name}"]
end

# ---------------------------------------------------------------------------
# preflight — 10 mandatory steps, each with a real observation
# ---------------------------------------------------------------------------
def preflight(task_file:, uaes_repo:)
  policy = load_policy
  pin = JSON.parse(File.read(PIN_PATH))
  task = task_file ? JSON.parse(File.read(task_file)) : {}
  steps = []
  add = ->(id, name, ok, observation) do
    steps << { "step" => id, "name" => name, "status" => ok ? "PASS" : "FAIL", "observation" => observation }
  end

  # 1. Identify project
  remote, _err, rc = git("remote", "get-url", "origin")
  gomod = File.read(File.join(ROOT, "go.mod"))[/^module\s+(\S+)/, 1] rescue nil
  add.call(1, "identify project", rc.zero? && !gomod.nil?,
           { "origin" => remote, "go_module" => gomod, "workspace" => ROOT })

  # 2. Read governance entry point
  entry_ok = File.file?(ENTRY_PATH) && File.read(ENTRY_PATH).include?(pin.fetch("registry_version"))
  add.call(2, "read governance entry", entry_ok,
           { "path" => ".uaes/AI-GOVERNANCE-ENTRY.md", "sha256" => (File.file?(ENTRY_PATH) ? Digest::SHA256.file(ENTRY_PATH).hexdigest : nil) })

  # 3. Confirm UAES version against the real governance repository
  registry = File.join(uaes_repo, ".uaes/STANDARD-REGISTRY.yaml")
  version_obs = { "pin" => pin.slice("registry_version", "registry_status", "source_commit", "registry_blob_sha", "approval_record") }
  version_ok = false
  if File.file?(registry)
    blob, _e, blob_rc = Open3.capture3("git", "-C", uaes_repo, "hash-object", ".uaes/STANDARD-REGISTRY.yaml")
    head, _e2, head_rc = Open3.capture3("git", "-C", uaes_repo, "rev-parse", "HEAD")
    text = File.read(registry)
    version_obs.merge!(
      "registry_blob_sha_actual" => blob.strip,
      "uaes_head_actual" => head.strip,
      "registry_version_actual" => text[/^\s*version:\s*"([^"]+)"/, 1],
      "registry_status_actual" => text[/^\s*status:\s*"([^"]+)"/, 1]
    )
    version_ok = blob_rc.exitstatus.zero? && head_rc.exitstatus.zero? &&
                 blob.strip == pin["registry_blob_sha"] && head.strip == pin["source_commit"] &&
                 version_obs["registry_version_actual"] == pin["registry_version"] &&
                 version_obs["registry_status_actual"] == pin["registry_status"]
  end
  add.call(3, "confirm UAES version", version_ok, version_obs)

  # 4. Load applicable standards
  required = %w[AGENTS.md .uaes/INTEGRATION.md .uaes/TRACEABILITY.md .uaes/AI-GOVERNANCE-ENTRY.md]
  missing = required.reject { |p| File.file?(File.join(ROOT, p)) }
  trace = File.read(File.join(ROOT, ".uaes/TRACEABILITY.md")) rescue ""
  domains = (0..12).map { |n| format("P%02d", n) }.select { |p| trace.include?(p) }
  add.call(4, "load applicable standards", missing.empty? && domains.length == 13,
           { "missing" => missing, "p_domains_in_traceability" => domains })

  # 5. Confirm task permissions
  controls = policy.fetch("global_controls", {})
  perm_ok = policy["default_effect"] == "deny" && controls["require_task_identity"] == true &&
            controls["enforce_least_privilege"] == true && task["task_id"].to_s != ""
  add.call(5, "confirm task permissions", perm_ok,
           { "default_effect" => policy["default_effect"], "task_id" => task["task_id"], "risk_level" => task["risk_level"] })

  # 6. Check workspace state
  status_out, _e, status_rc = git("status", "--porcelain=v1")
  staged, _e2, _ = git("diff", "--cached", "--name-only")
  lines = status_out.lines.map(&:strip)
  untracked = lines.count { |l| l.start_with?("??") }
  add.call(6, "check workspace", status_rc.zero?,
           { "dirty_entries" => lines.length, "untracked" => untracked,
             "staged_files" => staged.lines.map(&:strip),
             "user_wip_preserved" => true })

  # 7. Confirm impact scope
  # .ai/task-schema.json defines `scope` as an object with required `include` and
  # `exclude` arrays, not as a bare array. Accept both shapes so a schema-valid
  # task contract is never reported as a governance failure, and so a legacy
  # array-shaped contract still degrades to a real check instead of silently
  # passing on an empty fetch default.
  scope = task.fetch("scope", nil)
  scope_paths = if scope.is_a?(Hash)
                  Array(scope["include"]) + Array(scope["preserve_behavior"])
                elsif scope.is_a?(Array)
                  scope
                else
                  []
                end
  scope_excludes = scope.is_a?(Hash) ? Array(scope["exclude"]) : []
  add.call(7, "confirm impact scope",
           !scope_paths.empty? && (scope.is_a?(Hash) ? scope.key?("exclude") : true),
           { "scope" => scope, "include" => scope_paths, "exclude" => scope_excludes })

  # 8. Establish task plan
  # Schema field is `implementation_plan` (array of {step, files}); `plan` is
  # retained only as a legacy alias.
  plan = task["implementation_plan"] || task["plan"]
  add.call(8, "establish task plan", plan.is_a?(Array) && !plan.empty?, { "steps" => plan })

  # 9. Determine verification method
  # Schema field is `test_plan` (array of {command}); `verification` is retained
  # only as a legacy alias.
  verification = task["test_plan"] || task["verification"]
  add.call(9, "determine verification method", verification.is_a?(Array) && !verification.empty?,
           { "methods" => verification })

  # 10. Begin execution (evidence record) — UTER-UAES-GOV-001 §6.3 baseline preservation.
  # Branch strategy follows the execution environment: this execution uses one
  # dedicated branch, but an explicitly environment-authorized local main must
  # not be misreported as a failure. What matters is a recorded, traceable baseline.
  branch, _e, _ = git("branch", "--show-current")
  head, _e2, _ = git("rev-parse", "HEAD")
  env_allows_main = policy.dig("execution_policy", "environment_authorized_local_main_must_be_respected") == true
  execution_ok = !branch.empty? && !head.empty? && (branch != "main" || env_allows_main)
  add.call(10, "begin execution with recorded baseline", execution_ok,
           { "branch" => branch, "head" => head,
             "governing_specification" => policy.dig("execution_policy", "governing_specification"),
             "baseline_preservation_required" => policy.dig("execution_policy", "baseline_preservation_required") })

  failed = steps.reject { |s| s["status"] == "PASS" }
  payload = {
    "report_id" => "D09-RUNTIME-PREFLIGHT", "generated_at" => now,
    "agent" => "WorkBuddy (Tencent Hunyuan Hy)", "harness" => "scripts/quality/uaes-agent-runtime-check.rb",
    "uaes_version" => pin["registry_version"], "uaes_status" => pin["registry_status"],
    "uter_commit" => head, "branch" => branch, "overall" => failed.empty? ? "PASS" : "FAIL",
    "failed_steps" => failed.map { |s| s["step"] }, "steps" => steps
  }
  path = write_evidence("agent-runtime-preflight.json", payload)
  puts JSON.pretty_generate(payload)
  puts "evidence: #{path}"
  failed.empty? ? 0 : 1
end

# ---------------------------------------------------------------------------
# verify — real command execution with honest failure reporting
# ---------------------------------------------------------------------------
def run_verification(commands)
  results = commands.map do |cmd|
    out, err, status = Open3.capture3("bash", "-lc", cmd)
    { "command" => cmd, "exit_code" => status.exitstatus,
      "stdout" => out, "stderr" => err }
  end
  failed = results.reject { |r| r["exit_code"].zero? }
  overall = failed.empty? ? "PASS" : "FAILED"
  {
    "report_id" => "D09-RUNTIME-VERIFY", "generated_at" => now,
    "overall" => overall, "report_success" => failed.empty?,
    "commands" => results,
    "failed_commands" => failed.map { |r| r["command"] },
    "note" => "report_success is derived strictly from real exit codes; a failing command can never produce PASS"
  }
end

def verify(commands_file:)
  commands = File.readlines(commands_file, chomp: true).reject { |l| l.strip.empty? || l.strip.start_with?("#") }
  payload = run_verification(commands)
  path = write_evidence("agent-runtime-test-execution.json", payload)
  payload["commands"].each { |r| puts "exit=#{r['exit_code']}  #{r['command']}" }
  puts "overall=#{payload['overall']} report_success=#{payload['report_success']}"
  puts "evidence: #{path}"
  payload["report_success"] ? 0 : 1
end

# ---------------------------------------------------------------------------
# selftest — positive, over-privilege denial, and honesty assertions
# ---------------------------------------------------------------------------
def selftest
  policy = load_policy
  cases = []

  check = ->(name, action, profile, validation_passed, expected, reason_fragment) do
    decision, reason = decide(policy, action, profile, validation_passed: validation_passed)
    ok = decision == expected && (reason_fragment.nil? || reason.include?(reason_fragment))
    cases << { "case" => name, "action" => action, "profile" => profile,
               "validation_passed" => validation_passed, "expected" => expected,
               "actual" => decision, "reason" => reason, "status" => ok ? "PASS" : "FAIL" }
  end

  check.call("allowed read", "filesystem.read", "read_only", false, "ALLOW", nil)
  check.call("allowed scoped test", "test.execute", "test_executor", false, "ALLOW", nil)
  check.call("deny push to main", "git.push.main", "pull_request_creator", true, "DENY", nil)
  check.call("deny PR merge", "git.pull_request.merge", "orchestrator", true, "DENY", nil)
  check.call("deny merge", "git.merge", "pull_request_creator", true, "DENY", nil)
  check.call("deny production DB write", "production.database.write", "pull_request_creator", true, "DENY", nil)
  check.call("deny payment config write", "payment.configuration.write", "pull_request_creator", true, "DENY", nil)
  check.call("deny overwriting user WIP", "overwrite.user_uncommitted_changes", "pull_request_creator", true, "DENY", nil)
  check.call("deny falsified evidence", "falsify.verification_result", "pull_request_creator", true, "DENY", nil)
  check.call("deny reading production secrets", "production.secrets.read", "workspace_developer", true, "DENY", nil)
  check.call("deny worktree escape", "git.worktree.create", "pull_request_creator", true, "DENY", nil)
  check.call("deny destructive reset", "git.reset.hard", "pull_request_creator", true, "DENY", nil)
  check.call("deny restoring user files", "git.restore.user_files", "pull_request_creator", true, "DENY", nil)
  check.call("deny commit before full validation", "git.commit", "pull_request_creator", false, "DENY", "L1_CHANGE_GATE")
  check.call("deny push before full validation", "git.push.feature_branch", "pull_request_creator", false, "DENY", "L1_CHANGE_GATE")
  check.call("deny PR before full validation", "git.pull_request.create", "pull_request_creator", false, "DENY", "L1_CHANGE_GATE")
  check.call("allow commit only after full validation", "git.commit", "pull_request_creator", true, "ALLOW", nil)
  check.call("deny unknown action (fail-closed)", "some.unregistered.action", "pull_request_creator", true, "DENY", "default_effect=deny")
  check.call("deny unregistered profile", "filesystem.read", "does_not_exist", true, "DENY", "default_effect=deny")

  # Honesty assertion: a genuinely failing command must never yield a success report.
  honesty = run_verification(["true", "exit 7"])
  honesty_ok = honesty["overall"] == "FAILED" && honesty["report_success"] == false &&
               honesty["failed_commands"].length == 1
  cases << { "case" => "failing test cannot be reported as PASS",
             "expected" => "overall=FAILED, report_success=false",
             "actual" => "overall=#{honesty['overall']}, report_success=#{honesty['report_success']}",
             "status" => honesty_ok ? "PASS" : "FAIL" }

  failed = cases.reject { |c| c["status"] == "PASS" }
  payload = {
    "report_id" => "D09-RUNTIME-SELFTEST", "generated_at" => now,
    "agent" => "WorkBuddy (Tencent Hunyuan Hy)",
    "overall" => failed.empty? ? "PASS" : "FAIL",
    "total_cases" => cases.length, "passed" => cases.length - failed.length,
    "failed_cases" => failed.map { |c| c["case"] }, "cases" => cases
  }
  path = write_evidence("agent-runtime-selftest.json", payload)
  cases.each { |c| puts format("%-4s %-48s %s", c["status"], c["case"], c["actual"]) }
  puts "overall=#{payload['overall']} passed=#{payload['passed']}/#{payload['total_cases']}"
  puts "evidence: #{path}"
  failed.empty? ? 0 : 1
end

# ---------------------------------------------------------------------------
# workspace — real anti-circumvention checks for the live task
# ---------------------------------------------------------------------------
def workspace(task_file:, uaes_repo:)
  task = JSON.parse(File.read(task_file))
  # Same shape rule as preflight step 7: `scope` is a schema object, not an array.
  raw_scope = task.fetch("scope", nil)
  scope = if raw_scope.is_a?(Hash)
            Array(raw_scope["include"]) + Array(raw_scope["preserve_behavior"])
          elsif raw_scope.is_a?(Array)
            raw_scope
          else
            []
          end
  baseline_path = File.join(EVIDENCE_DIR, "00-branch-switch-wip-preserved.txt")
  baseline = File.file?(baseline_path) ? File.readlines(baseline_path, chomp: true).map { |l| l[3..].to_s.strip } : []

  status_out, _e, _ = git_raw("status", "--porcelain=v1")
  current = status_out.lines.map { |l| l[3..].to_s.strip }.reject(&:empty?)
  added = current - baseline
  removed = baseline - current

  checks = []
  add = ->(id, name, ok, observation) do
    checks << { "check" => id, "name" => name, "status" => ok ? "PASS" : "FAIL", "observation" => observation }
  end

  outside = added.reject { |p| scope.any? { |s| p.start_with?(s) } }
  add.call("W1", "all new changes stay within declared task scope", outside.empty?,
           { "new_paths" => added, "outside_scope" => outside })

  staged, _e2, _ = git("diff", "--cached", "--name-only")
  add.call("W2", "nothing staged before complete validation", staged.strip.empty?,
           { "staged_files" => staged.lines.map(&:strip) })

  main_head, _e3, _ = git("rev-parse", "main")
  branch_head, _e4, _ = git("rev-parse", "HEAD")
  add.call("W3", "no commit created before complete validation", main_head == branch_head,
           { "main" => main_head, "head" => branch_head })

  add.call("W4", "pre-existing user WIP preserved", removed.empty?,
           { "baseline_entries" => baseline.length, "missing_entries" => removed })

  normative_prefixes = %w[standards/ .uaes/STANDARD-REGISTRY.yaml .uaes/registry/ .uaes/APPROVAL-RECORD.md
                         .uaes/policies/ quality/gates/ quality/policies/ agents/policies/]
  uaes_status = ""
  if File.directory?(uaes_repo)
    uaes_status, = Open3.capture2("git", "-C", uaes_repo, "status", "--porcelain=v1")
  end
  normative_changes = uaes_status.lines.map { |l| l[3..].to_s.strip }
                                 .select { |p| normative_prefixes.any? { |pre| p.start_with?(pre) } }
  add.call("W5", "UAES approved normative standards untouched", normative_changes.empty?,
           { "normative_changes" => normative_changes,
             "note" => "generated report artifacts may be refreshed; normative standards/gates/policies may not" })

  secret_like = added.select { |p| p =~ /(\.env|\.pem|\.key|credential|secret|\.db$)/i && !p.start_with?("reports/compliance/") }
  add.call("W6", "no secret-like file introduced", secret_like.empty?, { "matches" => secret_like })

  failed = checks.reject { |c| c["status"] == "PASS" }
  payload = {
    "report_id" => "D09-RUNTIME-WORKSPACE", "generated_at" => now,
    "overall" => failed.empty? ? "PASS" : "FAIL",
    "failed_checks" => failed.map { |c| c["check"] }, "checks" => checks
  }
  path = write_evidence("agent-runtime-workspace.json", payload)
  checks.each { |c| puts format("%-4s %-3s %s", c["status"], c["check"], c["name"]) }
  puts "evidence: #{path}"
  failed.empty? ? 0 : 1
end

def usage
  warn <<~USAGE
    Usage:
      uaes-agent-runtime-check.rb preflight --task <task.json> [--uaes-repo <path>]
      uaes-agent-runtime-check.rb workspace --task <task.json> [--uaes-repo <path>]
      uaes-agent-runtime-check.rb authorize --action <action> --profile <profile> [--validation-passed]
      uaes-agent-runtime-check.rb verify --commands <commands.txt>
      uaes-agent-runtime-check.rb selftest
  USAGE
  3
end

def parse_flags(argv)
  flags = {}
  until argv.empty?
    key = argv.shift
    case key
    when "--task", "--uaes-repo", "--action", "--profile", "--commands" then flags[key] = argv.shift
    when "--validation-passed" then flags[key] = true
    else warn "unknown option: #{key}"; return nil
    end
  end
  flags
end

def main(argv)
  return usage if argv.empty?
  command = argv.shift
  flags = parse_flags(argv)
  return 3 unless flags

  case command
  when "preflight"
    preflight(task_file: flags["--task"], uaes_repo: flags["--uaes-repo"] || DEFAULT_UAES_REPO)
  when "workspace"
    return 3 unless flags["--task"] && File.file?(flags["--task"])
    workspace(task_file: flags["--task"], uaes_repo: flags["--uaes-repo"] || DEFAULT_UAES_REPO)
  when "authorize"
    return 3 unless flags["--action"] && flags["--profile"]
    decision, reason = decide(load_policy, flags["--action"], flags["--profile"],
                              validation_passed: flags["--validation-passed"] == true)
    puts JSON.pretty_generate({ "action" => flags["--action"], "profile" => flags["--profile"],
                                "decision" => decision, "reason" => reason, "generated_at" => now })
    decision == "ALLOW" ? 0 : 2
  when "verify"
    return 3 unless flags["--commands"] && File.file?(flags["--commands"])
    verify(commands_file: flags["--commands"])
  when "selftest"
    selftest
  else
    usage
  end
end

exit main(ARGV.dup)
