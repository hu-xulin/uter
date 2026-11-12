import { nowISO } from '../_lib/util.mjs';
import { MAX_CONCURRENCY, detectFileConflicts, acquire, release } from '../resource-manager/index.mjs';

export const component = 'scheduler';
export const version = '1.0.0';

/** Kahn topological sort grouped into parallel execution levels. */
export function topologicalLevels(tasks) {
  const byId = new Map(tasks.map((t) => [t.task_id, t]));
  const indegree = new Map(tasks.map((t) => [t.task_id, 0]));
  const children = new Map(tasks.map((t) => [t.task_id, []]));
  for (const task of tasks) {
    for (const dep of task.dependencies || []) {
      if (!byId.has(dep)) throw new Error(`unknown dependency ${dep} referenced by ${task.task_id}`);
      indegree.set(task.task_id, indegree.get(task.task_id) + 1);
      children.get(dep).push(task.task_id);
    }
  }
  const levels = [];
  let frontier = tasks.filter((t) => indegree.get(t.task_id) === 0).map((t) => t.task_id);
  while (frontier.length) {
    levels.push([...frontier]);
    const next = [];
    for (const id of frontier) {
      for (const child of children.get(id)) {
        indegree.set(child, indegree.get(child) - 1);
        if (indegree.get(child) === 0) next.push(child);
      }
    }
    frontier = next;
  }
  const visited = levels.flat().length;
  if (visited !== tasks.length) {
    const stuck = tasks.filter((t) => !levels.flat().includes(t.task_id)).map((t) => t.task_id);
    throw new Error(`dependency cycle detected involving: ${stuck.join(', ')}`);
  }
  return levels;
}

export function detectCycle(tasks) {
  try {
    topologicalLevels(tasks);
    return null;
  } catch (error) {
    return error.message;
  }
}

/**
 * Execute a DAG. Within one level, tasks with overlapping write sets are
 * serialised; independent tasks run concurrently up to MAX_CONCURRENCY.
 */
export async function runGraph(tasks, execute, { concurrency = MAX_CONCURRENCY } = {}) {
  const levels = topologicalLevels(tasks);
  const byId = new Map(tasks.map((t) => [t.task_id, t]));
  const results = {};
  const conflictsFound = [];
  for (const level of levels) {
    const pending = [...level];
    while (pending.length) {
      const wave = [];
      for (const id of pending) {
        const candidate = byId.get(id);
        const overlap = detectFileConflicts([...wave.map((w) => byId.get(w)), candidate]);
        if (!overlap.length && wave.length < concurrency) wave.push(id);
        else if (overlap.length) conflictsFound.push(...overlap);
      }
      if (!wave.length) wave.push(pending[0]);
      const executed = await Promise.all(wave.map(async (id) => {
        const task = byId.get(id);
        acquire(id, { files: task.files || [] });
        try {
          const out = await execute(task);
          results[id] = out;
          return { id, out };
        } finally {
          release(id);
        }
      }));
      for (const { id } of executed) pending.splice(pending.indexOf(id), 1);
    }
  }
  return { levels, results, conflicts_found: conflictsFound, executed_at: nowISO() };
}

export function health() {
  const sample = [
    { task_id: 'A', dependencies: [], files: ['a.go'] },
    { task_id: 'B', dependencies: ['A'], files: ['b.go'] },
    { task_id: 'C', dependencies: ['A'], files: ['c.go'] },
    { task_id: 'D', dependencies: ['B', 'C'], files: ['d.go'] },
  ];
  let levels = [];
  let dagOk = false;
  try {
    levels = topologicalLevels(sample);
    dagOk = JSON.stringify(levels) === JSON.stringify([['A'], ['B', 'C'], ['D']]);
  } catch { dagOk = false; }
  const cycle = detectCycle([
    { task_id: 'X', dependencies: ['Y'], files: [] },
    { task_id: 'Y', dependencies: ['X'], files: [] },
  ]);
  const conflict = detectFileConflicts([
    { task_id: 'P', files: ['same.go'] },
    { task_id: 'Q', files: ['same.go'] },
  ]);
  return {
    component,
    version,
    ok: dagOk && Boolean(cycle) && conflict.length === 1,
    checks: {
      topological_levels: dagOk,
      parallel_level: dagOk && levels[1].length === 2,
      cycle_detected: Boolean(cycle),
      file_conflict_detected: conflict.length === 1,
      concurrency_limit_defined: MAX_CONCURRENCY > 0,
    },
    checked_at: nowISO(),
  };
}

export async function execute(task) {
  const levels = topologicalLevels(task?.inputs?.tasks || []);
  return { status: 'SUCCEEDED', summary: `${levels.length} execution levels`, outputs: { levels } };
}
