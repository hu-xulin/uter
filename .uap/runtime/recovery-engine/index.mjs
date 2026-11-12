import { spawnSync } from 'node:child_process';
import { ROOT, rootPath } from '../_lib/paths.mjs';
import { nowISO } from '../_lib/util.mjs';
import { getTask, resumeTask, registerStepHandler } from '../task-engine/index.mjs';
import { record } from '../evidence-engine/index.mjs';
import { publish } from '../event-system/index.mjs';

export const component = 'recovery-engine';
export const version = '1.0.0';

// The interruption probe registers these handlers inside the child process,
// which then dies. Handlers are process-local, so the recovering parent must
// register its own replay handlers or the persisted task can never finish.
// These are deliberately side-effect free: recovery only completes the work,
// it never repeats the crashed child's external effect.
for (const name of ['probe.step1', 'probe.step2', 'probe.step3']) {
  registerStepHandler(name, async ({ step }) => ({
    status: 'SUCCEEDED',
    summary: `${name} replayed in recovery process`,
    outputs: { recovered: true, idempotent: step.idempotent },
  }));
}

export function inspectRecovery(taskId) {
  const task = getTask(taskId);
  if (!task) return { resumable: false, reason: 'task_not_found' };
  const completed = task.steps.filter((s) => s.status === 'SUCCEEDED').map((s) => s.step_id);
  const ambiguous = task.side_effects.filter((s) => s.state === 'started');
  const committed = task.side_effects.filter((s) => s.state === 'committed');
  return {
    resumable: !['SUCCEEDED', 'CANCELLED'].includes(task.state),
    state: task.state,
    context_version: task.context_version,
    completed_steps: completed,
    pending_steps: task.steps.filter((s) => s.status !== 'SUCCEEDED').map((s) => s.step_id),
    ambiguous_side_effects: ambiguous,
    committed_side_effects: committed,
    trace_id: task.trace_id,
  };
}

/**
 * Recovery is only allowed when the persisted context still matches the
 * expected version. A mismatch is BLOCKED, never silently re-run.
 */
export function recover(taskId, { expected_context_version = null, validator = null } = {}) {
  const before = inspectRecovery(taskId);
  if (!before.resumable) {
    return { recovered: false, reason: `task state ${before.state} is not resumable`, before, task: getTask(taskId) };
  }
  if (expected_context_version && before.context_version !== expected_context_version) {
    publish('recovery.blocked', { task_id: taskId, reason: 'context version mismatch' }, { task_id: taskId, trace_id: before.trace_id, severity: 'WARN' });
    return { recovered: false, reason: 'context version mismatch', before, task: getTask(taskId) };
  }
  const ambiguous = before.ambiguous_side_effects.length;
  publish('recovery.started', { task_id: taskId, ambiguous_side_effects: ambiguous }, { task_id: taskId, trace_id: before.trace_id });
  const evidence = record({
    kind: 'recovery',
    task_id: taskId,
    command: `uap task resume ${taskId}`,
    exit_code: 0,
    inputs: before,
    summary: `recovery started: ${before.completed_steps.length} completed steps, ${ambiguous} ambiguous side effects`,
  });
  return resumeTask(taskId, validator ? { validator } : {}).then((out) => {
    const after = inspectRecovery(taskId);
    const repeated = before.completed_steps.filter((id) => out.task.steps.find((s) => s.step_id === id)?.attempts > 1);
    const ev = record({
      kind: 'recovery_result',
      task_id: taskId,
      command: `uap task resume ${taskId}`,
      exit_code: out.task.state === 'SUCCEEDED' ? 0 : 1,
      inputs: { before },
      summary: `recovery finished: state=${out.task.state}, repeated_completed_steps=${repeated.length}, ambiguous=${ambiguous}`,
    });
    publish('recovery.finished', { task_id: taskId, state: out.task.state }, { task_id: taskId, trace_id: before.trace_id });
    return {
      recovered: true,
      before,
      after,
      task: out.task,
      repeated_completed_steps: repeated,
      ambiguous_side_effects_refused: ambiguous > 0,
      evidence_refs: [evidence.evidence_id, ev.evidence_id],
    };
  });
}

/** Spawn a genuinely separate process and kill it mid-task. */
export function simulateInterruption(mode = 'idempotent') {
  if (!['idempotent', 'non-idempotent'].includes(mode)) throw new Error(`unknown interruption mode: ${mode}`);
  const probe = rootPath('.uap/tools/interrupt-probe.mjs');
  const result = spawnSync(process.execPath, [probe, `--mode=${mode}`], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  const stdout = result.stdout || '';
  const match = stdout.match(/TASK_ID=([^\s]+)/);
  if (!match) {
    return { ok: false, reason: 'probe did not report a task id', exit_code: result.status, stdout, stderr: result.stderr };
  }
  return {
    ok: result.status === 7,
    task_id: match[1],
    mode,
    child_exit_code: result.status,
    crashed_mid_step: stdout.includes('CRASHED_IN_STEP2'),
    stdout,
    stderr: result.stderr || '',
  };
}

export function health() {
  const sim = simulateInterruption('idempotent');
  if (!sim.ok) {
    return { component, version, ok: false, checks: { child_process_crashed: false }, error: sim.reason || `child exit ${sim.child_exit_code}`, checked_at: nowISO(), simulation: sim };
  }
  const before = inspectRecovery(sim.task_id);
  return Promise.resolve(recover(sim.task_id)).then((out) => buildHealth(sim, before, out));
}

function buildHealth(sim, before, out) {
  const checks = {
    child_process_crashed: sim.child_exit_code === 7 && sim.crashed_mid_step,
    state_persisted_before_crash: before.state === 'RUNNING' || before.state === 'WAITING_RECOVERY',
    step1_completed_before_crash: before.completed_steps.includes('step-1'),
    // Reaching FAILED/BLOCKED is not recovery. A real pass must finish the
    // persisted task successfully after the crash.
    recovery_reached_succeeded: out.task?.state === 'SUCCEEDED',
    completed_steps_not_repeated: (out.repeated_completed_steps || []).length === 0,
    recovery_evidence_written: (out.evidence_refs || []).length === 2,
  };
  return {
    component,
    version,
    ok: checks.child_process_crashed && checks.state_persisted_before_crash
      && checks.step1_completed_before_crash && checks.recovery_reached_succeeded
      && checks.completed_steps_not_repeated && checks.recovery_evidence_written,
    checks,
    probe_task_id: sim.task_id,
    final_state: out.task.state,
    checked_at: nowISO(),
  };
}

export async function execute(task) {
  const id = task?.inputs?.task_id;
  if (!id) return { status: 'BLOCKED', summary: 'missing inputs.task_id' };
  const out = await recover(id, { expected_context_version: task?.inputs?.expected_context_version || null });
  return { status: out.task.state === 'SUCCEEDED' ? 'SUCCEEDED' : 'BLOCKED', summary: `recovery finished: ${out.task.state}`, outputs: { task_id: id, state: out.task.state } };
}
