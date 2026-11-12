import path from 'node:path';
import { STATE, ROOT } from '../_lib/paths.mjs';
import { loadConfig } from '../_lib/config.mjs';
import { appendJSONL, readJSONL, nowISO, redact } from '../_lib/util.mjs';
import { publish } from '../event-system/index.mjs';
import { isCommandAllowed } from '../_lib/proc.mjs';

export const component = 'policy-engine';
export const version = '1.0.0';
const AUDIT_FILE = path.join(STATE, 'policy-audit.jsonl');

export class PolicyDeniedError extends Error {
  constructor(permission, reason, agentId) {
    super(`permission denied: ${permission} for ${agentId || 'anonymous'} — ${reason}`);
    this.name = 'PolicyDeniedError';
    this.permission = permission;
    this.reason = reason;
    this.agentId = agentId;
  }
}

function audit(entry) {
  appendJSONL(AUDIT_FILE, { ...entry, at: nowISO() });
  publish('policy.decision', { decision: entry.decision, permission: entry.permission, agent_id: entry.agent_id || null }, { severity: entry.decision === 'DENY' ? 'WARN' : 'INFO' });
}

/**
 * Fail-closed policy decision. Unknown agents, undeclared permissions,
 * unknown permission groups and denied groups all end in DENY.
 */
export function check({ agent_id, permission, tool = null, command = null, action = 'unspecified' }) {
  const policy = loadConfig('permission-policy');
  const agents = loadConfig('agent-registry');
  const groups = policy.permission_groups || {};
  const registered = (agents.agents || []).find((a) => a.id === agent_id);
  const decide = (decision, reason) => {
    const entry = { decision, reason: redact(reason), permission, agent_id: agent_id || null, tool, command: command ? redact(command) : null, action };
    audit(entry);
    return { allowed: decision === 'ALLOW', decision, reason, agent_id, permission };
  };

  if (policy.default_effect !== 'deny') return decide('DENY', 'policy is not fail-closed');
  if (!registered && agents.defaults?.deny_unregistered_agents !== false) {
    return decide('DENY', 'agent is not registered');
  }
  if (registered) {
    const declared = registered.permissions || [];
    if (!declared.includes(permission)) return decide('DENY', 'permission not declared for this agent');
  }
  const group = groups[permission];
  if (!group) return decide('DENY', 'permission group is not declared in policy');
  if (group.effect !== 'allow') return decide('DENY', group.reason || `group effect is ${group.effect}`);
  if (registered && tool && agents.defaults?.deny_undeclared_tools && !(registered.tools || []).includes(tool)) {
    return decide('DENY', 'tool is not declared for this agent');
  }
  if (command && !isCommandAllowed(command)) return decide('DENY', 'command is not in the local command allowlist');
  return decide('ALLOW', 'permission granted');
}

export function assertAllowed(input) {
  const decision = check(input);
  if (!decision.allowed) throw new PolicyDeniedError(input.permission, decision.reason, input.agent_id);
  return decision;
}

export function deniedDecisions(limit = 100) {
  return readJSONL(AUDIT_FILE).filter((e) => e.decision === 'DENY').slice(-limit);
}

export function auditTrail(limit = 1000) {
  return readJSONL(AUDIT_FILE).slice(-limit);
}

export function health() {
  const agents = loadConfig('agent-registry');
  const first = (agents.agents || [])[0];
  const allowed = check({ agent_id: first.id, permission: 'project_read', action: 'health_probe' });
  const deniedMissingGroup = check({ agent_id: first.id, permission: 'production_write', action: 'health_probe' });
  const deniedUnregistered = check({ agent_id: 'not-a-real-agent', permission: 'project_read', action: 'health_probe' });
  const deniedUndeclared = check({ agent_id: first.id, permission: 'product_write', action: 'health_probe' });
  const deniedBadCommand = check({ agent_id: 'uap-development-agent', permission: 'local_command', command: 'curl', action: 'health_probe' });
  const policy = loadConfig('permission-policy');
  const mustDeny = ['production_write', 'production_deploy', 'real_payment', 'real_refund', 'secret_export', 'force_push', 'branch_creation', 'branch_switch', 'destructive_git', 'quality_gate_disable', 'test_deletion_to_force_pass'];
  const allDenied = mustDeny.every((p) => check({ agent_id: 'uap-development-agent', permission: p, action: 'health_probe' }).decision === 'DENY');
  return {
    component,
    version,
    ok: allowed.allowed && !deniedMissingGroup.allowed && !deniedUnregistered.allowed
      && !deniedUndeclared.allowed && !deniedBadCommand.allowed && allDenied
      && policy.default_effect === 'deny',
    checks: {
      policy_loaded: Boolean(policy.policy_id),
      default_deny: policy.default_effect === 'deny',
      allow_registered_permission: allowed.allowed,
      deny_production_write: !deniedMissingGroup.allowed,
      deny_unregistered_agent: !deniedUnregistered.allowed,
      deny_undeclared_permission: !deniedUndeclared.allowed,
      deny_unlisted_command: !deniedBadCommand.allowed,
      all_high_risk_denied: allDenied,
      audit_logged: deniedDecisions(500).length > 0,
    },
    checked_at: nowISO(),
  };
}

export async function execute(task) {
  const decision = check({
    agent_id: task?.inputs?.agent_id,
    permission: task?.inputs?.permission,
    action: task?.inputs?.action || 'task_execution',
  });
  return { status: decision.allowed ? 'SUCCEEDED' : 'BLOCKED', summary: decision.reason, outputs: decision };
}
