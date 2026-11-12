/**
 * Real process-interruption probe used by the recovery engine.
 *
 * Spawned as a separate OS process. It creates a persisted task, completes
 * step 1 (which is written to .uap/state/tasks.json), then hard-exits with a
 * non-zero code while step 2 is running. The parent process must then recover
 * the task from disk. No in-memory state is shared between the two processes.
 *
 * Usage: node .uap/tools/interrupt-probe.mjs --mode=idempotent|non-idempotent
 * Stdout: TASK_ID=<id>
 * Exit:   7 (deliberate crash)
 */
import fs from 'node:fs';
import { createTask, registerStepHandler, runTask, listStepHandlers } from '../runtime/task-engine/index.mjs';
import { newId } from '../runtime/_lib/util.mjs';

const mode = (process.argv.find((a) => a.startsWith('--mode=')) || '--mode=idempotent').split('=')[1];
const nonIdempotent = mode === 'non-idempotent';

registerStepHandler('probe.step1', async () => ({ status: 'SUCCEEDED', summary: 'step1 done', outputs: { side_effect: 'step1-committed' } }));
registerStepHandler('probe.step2', async () => {
  // Hard crash. Everything before this point was persisted to disk by the
  // task engine; nothing after this point exists.
  fs.writeSync(1, 'CRASHED_IN_STEP2\n');
  process.exit(7);
});
registerStepHandler('probe.step3', async () => ({ status: 'SUCCEEDED', summary: 'step3 done', outputs: { side_effect: 'step3-committed' } }));

const task = createTask({
  task_id: newId('UAP-TASK-INTERRUPT'),
  objective: `recovery probe (${mode})`,
  scope: 'runtime/recovery-engine',
  specification_ids: ['UAP-03-004'],
  constraints: ['simulated process interruption', 'no external side effects'],
  acceptance_criteria: ['recovery from persisted state', 'no repeated non-idempotent side effect'],
  steps: [
    { name: 'probe.step1', idempotent: true },
    { name: 'probe.step2', idempotent: !nonIdempotent },
    { name: 'probe.step3', idempotent: true },
  ],
  health_probe: true,
});

fs.writeSync(1, `TASK_ID=${task.task_id}\nMODE=${mode}\nHANDLERS=${listStepHandlers().length}\n`);
await runTask(task.task_id);
process.exit(0);
