import { FILES } from '../_lib/paths.mjs';
import { loadAllConfigs, registryIntegrity, readVersion } from '../_lib/config.mjs';
import { nowISO, writeJSON, newId } from '../_lib/util.mjs';
import { record } from '../evidence-engine/index.mjs';
import { publish } from '../event-system/index.mjs';
import { createTask, runTask, getTask, listTasks, registerStepHandler } from '../task-engine/index.mjs';
import { topologicalLevels } from '../scheduler/index.mjs';

import * as stateMachine from '../state-machine/index.mjs';
import * as eventSystem from '../event-system/index.mjs';
import * as resourceManager from '../resource-manager/index.mjs';
import * as evidenceEngine from '../evidence-engine/index.mjs';
import * as policyEngine from '../policy-engine/index.mjs';
import * as taskEngine from '../task-engine/index.mjs';
import * as scheduler from '../scheduler/index.mjs';
import * as recoveryEngine from '../recovery-engine/index.mjs';
import * as agentRuntime from '../agent-runtime/index.mjs';

export const component = 'orchestrator';
export const version = '1.0.0';
export const executors = ['core.architecture'];

export const COMPONENTS = {
  'orchestrator': { module: null, required: true },
  'task-engine': { module: taskEngine, required: true },
  'state-machine': { module: stateMachine, required: true },
  'event-system': { module: eventSystem, required: true },
  'scheduler': { module: scheduler, required: true },
  'resource-manager': { module: resourceManager, required: true },
  'recovery-engine': { module: recoveryEngine, required: true },
  'agent-runtime': { module: agentRuntime, required: true },
  'evidence-engine': { module: evidenceEngine, required: true },
  'policy-engine': { module: policyEngine, required: true },
};

/** Runtime health check: every core component must run its own real probe. */
export async function health() {
  const configs = loadAllConfigs();
  const registry = registryIntegrity(configs);
  const componentResults = {};
  for (const [name, entry] of Object.entries(COMPONENTS)) {
    if (!entry.module) {
      componentResults[name] = { component: name, ok: true, checks: { self: true }, checked_at: nowISO(), note: 'orchestrator is the caller of this health check' };
      continue;
    }
    try {
      componentResults[name] = await Promise.resolve(entry.module.health());
    } catch (error) {
      componentResults[name] = { component: name, ok: false, error: error.message, checks: {}, checked_at: nowISO() };
    }
  }
  const componentsOk = Object.values(componentResults).every((r) => r.ok === true);
  const card = {
    platform: 'UAP',
    version: readVersion(),
    started: componentsOk,
    health_check_passed: componentsOk,
    checked_at: nowISO(),
    components: componentResults,
    registry: { ok: registry.ok, checks_passed: registry.checks.filter((c) => c.status === 'PASS').length, checks_total: registry.checks.length, findings: registry.findings.length },
    module_dependencies_resolved: true,
    no_unexplained_cycles: registry.checks.find((c) => c.id === 'registry.dependencies_acyclic')?.status === 'PASS',
  };
  writeJSON(FILES.baseline.replace('BASELINE.json', 'runtime-health.json'), card);
  return card;
}

export async function start() {
  const card = await health();
  const ev = record({
    kind: 'runtime_start',
    command: 'uap doctor',
    exit_code: card.health_check_passed ? 0 : 1,
    inputs: { components: Object.keys(COMPONENTS).length },
    summary: `runtime start: ${Object.values(card.components).filter((c) => c.ok).length}/${Object.keys(COMPONENTS).length} components healthy, registry ${card.registry.checks_passed}/${card.registry.checks_total}`,
  });
  publish('runtime.started', { health_check_passed: card.health_check_passed }, { severity: card.health_check_passed ? 'INFO' : 'ERROR' });
  return { ...card, evidence_ref: ev.evidence_id };
}

/**
 * Decompose a natural-language objective into a structured task DAG using the
 * registered workflow step list. Child tasks are created with real dependency
 * edges; the scheduler computes their execution levels.
 */
export function plan(objective, { workflow_id = 'uap-bootstrap', specification_ids = [], permissions = [], agent_id = 'uap-orchestrator' } = {}) {
  const workflows = loadAllConfigs()['workflow-registry'].workflows || [];
  const workflow = workflows.find((w) => w.id === workflow_id);
  if (!workflow) throw new Error(`unknown workflow: ${workflow_id}`);
  const plan_id = newId('UAP-PLAN');
  const children = [];
  (workflow.steps || []).forEach((step, index) => {
    const task = createTask({
      objective: `${objective} / step ${index + 1}: ${step}`,
      scope: `workflow:${workflow_id}:${step}`,
      specification_ids,
      constraints: ['no production actions', 'preserve user changes'],
      acceptance_criteria: [`${step} completed with evidence`, 'independent validator passed'],
      dependencies: index === 0 ? [] : [children[index - 1].task_id],
      permissions,
      agent_id,
      steps: [{ name: step, idempotent: true }],
      files: [`.uap/state/plan-${plan_id}-step-${index + 1}.json`],
    });
    children.push(task);
  });
  const levels = topologicalLevels(children.map((t) => ({ task_id: t.task_id, dependencies: t.dependencies })));
  const state = { plan_id, objective, workflow_id, created_at: nowISO(), child_task_ids: children.map((t) => t.task_id), levels, acceptance: workflow.acceptance };
  writeJSON(FILES.baseline.replace('BASELINE.json', `plan-${plan_id}.json`), state);
  publish('orchestrator.plan_created', { plan_id, workflow_id, tasks: children.length }, { severity: 'INFO' });
  return state;
}

export async function dispatch(taskId, options = {}) {
  return runTask(taskId, options);
}

export function aggregate(taskIds) {
  const tasks = taskIds.map((id) => getTask(id)).filter(Boolean);
  const missing = taskIds.filter((id) => !getTask(id));
  const changed = [...new Set(tasks.flatMap((t) => t.changed_files || []))];
  const evidence = [...new Set(tasks.flatMap((t) => t.evidence_refs || []))];
  const validations = tasks.flatMap((t) => t.validation_results || []);
  const blocked = tasks.flatMap((t) => t.blocked_reasons || []);
  const status = missing.length || blocked.length || tasks.some((t) => t.state !== 'SUCCEEDED')
    ? 'PARTIALLY_VERIFIED'
    : 'FULLY_VERIFIED';
  return {
    status,
    summary: `${tasks.length} tasks aggregated; ${tasks.filter((t) => t.state === 'SUCCEEDED').length} succeeded; ${missing.length} missing`,
    tasks: tasks.map((t) => ({ task_id: t.task_id, state: t.state, steps: t.steps.length, evidence_refs: t.evidence_refs.length })),
    changed_files: changed,
    evidence_refs: evidence,
    validation_results: validations,
    blocked_reasons: blocked,
    missing_task_ids: missing,
    aggregated_at: nowISO(),
  };
}

export async function execute(task) {
  const p = plan(task?.objective || 'unassigned objective', {
    workflow_id: task?.inputs?.workflow_id || 'uap-bootstrap',
    specification_ids: task?.specification_ids || [],
  });
  return { status: 'SUCCEEDED', summary: `plan ${p.plan_id} created with ${p.child_task_ids.length} tasks`, outputs: p };
}
