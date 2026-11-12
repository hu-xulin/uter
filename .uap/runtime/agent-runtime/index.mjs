import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../_lib/paths.mjs';
import { loadConfig } from '../_lib/config.mjs';
import { nowISO, redact } from '../_lib/util.mjs';
import { check } from '../policy-engine/index.mjs';
import { record } from '../evidence-engine/index.mjs';
import { publish } from '../event-system/index.mjs';

export const component = 'agent-runtime';
export const version = '1.0.0';
export const executors = ['agents.registry', 'agents.execution', 'agents.collaboration'];

export function listAgents() {
  return loadConfig('agent-registry').agents || [];
}

export function getAgent(id) {
  return listAgents().find((a) => a.id === id) || null;
}

export function implementationExists(agent) {
  return Boolean(agent.implementation) && fs.existsSync(path.join(ROOT, agent.implementation));
}

/** An Agent may only use declared tools; unknown tools are refused. */
export function assertTool(agentId, tool) {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`unknown agent: ${agentId}`);
  if (!(agent.tools || []).includes(tool)) throw new Error(`tool ${tool} is not declared for ${agentId}`);
  return true;
}

/**
 * Invoke a registered Agent. The agent's implementation module is imported
 * and actually executed; a missing implementation yields BLOCKED, not PASS.
 */
export async function invoke(agentId, task = {}, { action = 'agent.invoke', permission = null } = {}) {
  const agent = getAgent(agentId);
  if (!agent) return { status: 'BLOCKED', summary: `agent ${agentId} is not registered`, outputs: {}, evidence_refs: [] };
  const requiredPermission = permission || (agent.permissions || [])[0] || 'project_read';
  const decision = check({ agent_id: agentId, permission: requiredPermission, action });
  if (!decision.allowed) {
    publish('agent.denied', { agent_id: agentId, reason: decision.reason }, { severity: 'WARN', task_id: task.task_id || null });
    return { status: 'BLOCKED', summary: decision.reason, outputs: { decision }, evidence_refs: [] };
  }
  if (!implementationExists(agent)) {
    return { status: 'BLOCKED', summary: `implementation missing: ${agent.implementation}`, outputs: {}, evidence_refs: [] };
  }
  let module;
  try {
    module = await import(path.join(ROOT, agent.implementation) + `?t=${Date.now()}`);
  } catch (error) {
    return { status: 'FAILED', summary: `cannot import ${agent.implementation}: ${error.message}`, outputs: {}, evidence_refs: [] };
  }
  const fn = module.execute || module.run || null;
  if (typeof fn !== 'function') {
    return { status: 'BLOCKED', summary: `${agent.implementation} exports no execute()/run()`, outputs: {}, evidence_refs: [] };
  }
  const started = Date.now();
  let out;
  try {
    out = await fn({ ...task, agent_id: agentId, output_schema: agent.output_schema }, {});
  } catch (error) {
    out = { status: 'FAILED', summary: redact(error.message), outputs: { error: error.name } };
  }
  const result = {
    status: out?.status || 'FAILED',
    summary: out?.summary || '',
    changed_files: out?.changed_files || [],
    commands: out?.commands || [],
    outputs: out?.outputs || {},
    agent_id: agentId,
    role: agent.role,
  };
  const ev = record({
    kind: 'agent_invocation',
    task_id: task.task_id || null,
    command: `agent:${agentId}`,
    exit_code: result.status === 'SUCCEEDED' ? 0 : 1,
    duration_ms: Date.now() - started,
    inputs: { action, permission: requiredPermission, objective: task.objective || null },
    summary: result.summary,
    findings: result.status === 'SUCCEEDED' ? [] : [{ severity: 'BLOCKER', code: 'agent_failed', message: result.summary }],
  });
  result.evidence_refs = [ev.evidence_id];
  publish('agent.invoked', { agent_id: agentId, status: result.status }, { severity: result.status === 'SUCCEEDED' ? 'INFO' : 'ERROR', task_id: task.task_id || null });
  return result;
}

export function health() {
  const agents = listAgents();
  const checks = {
    agents_registered: agents.length === 11,
    unique_ids: new Set(agents.map((a) => a.id)).size === agents.length,
    all_declare_permissions: agents.every((a) => Array.isArray(a.permissions) && a.permissions.length > 0),
    all_declare_tools: agents.every((a) => Array.isArray(a.tools) && a.tools.length > 0),
    all_declare_output_schema: agents.every((a) => Boolean(a.output_schema)),
    all_implementations_exist: agents.every(implementationExists),
    tool_guard_rejects_unknown: (() => {
      try { assertTool(agents[0].id, '__not_a_declared_tool__'); return false; } catch { return true; }
    })(),
    policy_gate_active: check({ agent_id: agents[0].id, permission: 'production_write' }).allowed === false,
  };
  return {
    component,
    version,
    ok: Object.values(checks).every(Boolean),
    checks,
    checked_at: nowISO(),
  };
}

export async function execute(task) {
  const id = task?.inputs?.agent_id || 'uap-orchestrator';
  const out = await invoke(id, { objective: task?.objective || 'delegated task', scope: task?.scope || 'unspecified' }, { action: 'executor_call' });
  return { status: out.status, summary: out.summary, changed_files: out.changed_files, evidence_refs: out.evidence_refs, outputs: out.outputs };
}
