#!/usr/bin/env ruby
# P01 static policy contract tests. These validate repository policy declarations;
# they do not claim to prove enforcement inside third-party Agent runtimes.
require "json"
require "yaml"

root = File.expand_path("../..", __dir__)
policy_path = File.join(root, ".aes/agent-governance.yaml")
schema_path = File.join(root, ".ai/task-schema.json")
abort "FAIL: missing #{policy_path}" unless File.file?(policy_path)
abort "FAIL: missing #{schema_path}" unless File.file?(schema_path)

policy = YAML.safe_load_file(policy_path)
schema = JSON.parse(File.read(schema_path))
errors = []
check = ->(condition, message) { errors << message unless condition }

check.call(policy["default_effect"].to_s.casecmp?("deny"), "default authorization effect must be deny")
controls = policy.fetch("global_controls")
%w[enforce_least_privilege require_task_identity require_tool_registration require_audit require_workspace_isolation].each do |key|
  check.call(controls[key] == true, "global control #{key} must be true")
end
%w[production_credentials_available unrestricted_network agent_can_modify_own_policy delegated_permissions_can_escalate].each do |key|
  check.call(controls[key] == false, "global control #{key} must be false")
end

repo = policy.fetch("repository")
# main-only policy (owner instruction 2026-11-11) is STRICTER than the old
# single-feature-branch model: zero non-main branches, no remote push at all.
check.call(repo["max_non_main_branches"] == 0, "main-only policy must allow zero non-main branches")
check.call(repo["execution_branch"] == "main" && repo["default_branch"] == "main", "execution and default branch must both be main")
check.call(repo["local_main_execution"] == true, "local main execution must be authorised")
check.call(repo["commit_after_full_verification"] == true, "commit must be gated on complete validation")
check.call(repo["remote_push"] == false, "remote push must be denied")
check.call(repo["force_push"] == false, "force push must be denied")
check.call(repo["pull_request_creation"] == false, "PR creation must be denied")
check.call(repo["pull_request_merge"] == false, "PR merge must be denied")
check.call(repo["deployment"] == false, "deployment must be denied")

# UTER-AES-GOV-001 §6.3 / §6.6 / §8.2 / §16.3: baseline preservation,
# fail-closed delivery, environment-authorized branch strategy, 14 independently
# assessed domains (13 AES + UTER P13) and independent assessment.
execution = policy.fetch("execution_policy")
check.call(execution["governing_specification"] == "UTER-AES-GOV-001", "execution policy must cite UTER-AES-GOV-001")
check.call(execution["baseline_preservation_required"] == true, "baseline preservation must be mandatory")
check.call(execution["max_execution_branches_per_project"] == 1, "at most one dedicated execution branch per project")
check.call(execution["environment_authorized_local_main_must_be_respected"] == true, "an environment-authorized local main must be respected")
%w[git.commit git.push.feature_branch git.pull_request.create].each do |action|
  check.call(execution.fetch("full_validation_required_before", []).include?(action), "full validation must precede #{action}")
end
check.call(execution["validation_layers"] == %w[L1_CHANGE_GATE L2_INTEGRATION_GATE L3_DOMAIN_ACCEPTANCE_GATE L4_GLOBAL_CONFORMANCE_GATE], "delivery validation layers must match UTER-AES-GOV-001 gate architecture")
check.call(execution["independently_assessed_domains"] == 14, "13 AES domains plus UTER P13 must be independently assessed")
check.call(execution["runtime_agent_verification_required"] == true, "live Agent runtime verification must be mandatory")
check.call(execution["independent_assessment_required"] == true, "Phase 7 independent assessment must be mandatory")
%w[git.push.main git.worktree.create falsify.verification_result overwrite.user_uncommitted_changes].each do |action|
  check.call(execution.fetch("forbidden", []).include?(action), "execution policy must forbid #{action}")
end

check.call(policy["risk_levels"] == %w[R0 R1 R2 R3 R4], "risk levels must be R0-R4")
expected_states = %w[CREATED EXECUTING VERIFYING CLOSED BLOCKED FAILED INTERRUPTED]
check.call(policy.dig("task_lifecycle", "states") == expected_states, "task lifecycle states are incomplete or out of order")
transitions = policy.dig("task_lifecycle", "transitions")
check.call(transitions["CLOSED"] == [] && transitions["FAILED"] == [], "CLOSED and FAILED must be terminal states")
check.call(transitions.fetch("VERIFYING", []).include?("CLOSED"), "VERIFYING must be able to close a validated task")
check.call(!transitions.fetch("EXECUTING", []).include?("CLOSED"), "EXECUTING must never close a task without verification")
close_req = policy.dig("task_lifecycle", "close_requires") || []
%w[all_acceptance_criteria_pass required_tests_pass evidence_complete no_open_p0_issue independent_machine_verification_pass].each do |key|
  check.call(close_req.include?(key), "task closure must require #{key}")
end
check.call(policy.dig("task_lifecycle", "resume_requires").include?("last_completed_step"), "interrupted task must persist a resume checkpoint")
check.call(policy.dig("global_controls", "delegated_permissions_can_escalate") == false, "delegated Agents must not escalate permissions")

agents = policy.fetch("agents")
agent_ids = agents.map { |agent| agent.fetch("id") }
check.call(agent_ids.uniq.length == agent_ids.length, "Agent IDs must be unique")
check.call(agents.length >= 10, "all project Agent roles must be registered")
agents.each do |agent|
  check.call(agent["definition_status"] == "defined", "Agent #{agent["id"]} must have a role definition")
  check.call(agent["runtime_status"] == "NOT_VERIFIED", "Agent #{agent["id"]} runtime status must remain NOT_VERIFIED (never overstated as VERIFIED/ACTIVE)")
  check.call(policy.fetch("permission_profiles").key?(agent["permission_profile"]), "Agent #{agent["id"]} references an unknown permission profile")
end

# main-only policy (owner instruction 2026-11-11): the PR-era
# `pull_request_creator` profile no longer exists. The delivery profile is
# `workspace_developer`: local commits to main are permitted ONLY after the
# full validation stack has passed (gated by execution_policy above), while
# branch creation, push and PR creation stay denied outright.
profiles = policy.fetch("permission_profiles")
wd = profiles.fetch("workspace_developer")
%w[git.commit.local git.diff test.execute].each do |action|
  check.call(wd.fetch("allow", []).include?(action), "workspace developer profile must allow #{action}")
end
%w[git.push git.force_push git.branch.create git.branch.switch git.pull_request.create git.merge deployment.execute production.database.write payment.configuration.write production.secrets.read overwrite.user_uncommitted_changes].each do |action|
  check.call(wd.fetch("deny", []).include?(action), "workspace developer profile must deny #{action}")
end
check.call(execution.fetch("full_validation_required_before", []).include?("git.commit.local"),
           "full validation must precede git.commit.local")
check.call(!profiles.key?("pull_request_creator"),
           "the retired pull_request_creator profile must not be reintroduced")

approval = policy.fetch("approval_rules")
%w[production_change real_payment_change production_database_write merge_pull_request deployment].each do |key|
  check.call(approval.dig(key, "effect") == "deny", "#{key} must be denied")
end

required = schema.fetch("required")
%w[requester agent_id lifecycle_status authorization].each do |key|
  check.call(required.include?(key), "task schema must require #{key}")
end
check.call(schema.dig("properties", "risk_level", "enum") == %w[R0 R1 R2 R3 R4], "task schema risk levels must include R4")
check.call(schema.dig("properties", "lifecycle_status", "enum") == expected_states, "task schema lifecycle must match governance policy")
check.call(schema.dig("properties", "authorization", "required").to_a.include?("authorization_id") &&
           schema.dig("properties", "authorization", "required").to_a.include?("expires_at") &&
           schema.dig("properties", "authorization", "required").to_a.include?("evidence_refs"),
           "task authorization dimensions are incomplete")
check.call(schema.dig("properties", "git_state", "properties", "work_branch_count", "maximum") == 0, "task schema must cap non-main work branches at zero (main-only)")
%w[execution_audit lifecycle_history].each do |key|
  check.call(required.include?(key), "task schema must require #{key}")
end
# .ai/AIES.md was retired and replaced by .ai/UTER-EXECUTION-METHOD.md
# (see .ai/README.md and docs/ai-specs/AI-EXECUTION-STANDARD.md). Reading the
# retired path made this suite crash with Errno::ENOENT instead of failing.
aies = File.read(File.join(root, ".ai/UTER-EXECUTION-METHOD.md"))
example = aies[/```json\s*(.*?)\s*```/m, 1]
check.call(!example.nil?, "AIES must contain a machine-readable task example")
if example
  begin
    task_example = JSON.parse(example)
    required.each do |key|
      check.call(task_example.key?(key), "AIES task example is missing required field #{key}")
    end
    check.call(schema.dig("properties", "task_type", "enum").include?(task_example["task_type"]), "AIES task example task_type must match schema")
    check.call(schema.dig("properties", "acceptance_criteria", "items", "required").all? { |key| task_example.fetch("acceptance_criteria", []).all? { |item| item.key?(key) } }, "AIES acceptance criteria must match task schema")
  rescue JSON::ParserError => e
    errors << "AIES task example is invalid JSON: #{e.message}"
  end
end

unless errors.empty?
  errors.each { |error| warn "FAIL: #{error}" }
  exit 1
end

puts "PASS: fail-closed Agent governance policy"
puts "PASS: least privilege, task identity, scoped authorization and audit requirements"
puts "PASS: R0-R4 risk classification and durable task lifecycle"
puts "PASS: one non-main branch maximum; main push, force-push and PR merge denied"
puts "PASS: delivery is gated on complete validation; branch strategy follows UTER-AES-GOV-001 baseline preservation"
puts "PASS: PR repair workflow allows verified branch commit/push/PR only"
puts "PASS: task lifecycle prevents unverified closure and supports checkpointed recovery"
puts "PASS: delegated Agent permissions cannot escalate"
puts "PASS: production, real-payment and production-database changes denied"
puts "NOTE: static policy/schema tests do not replace live Agent runtime denial tests."
