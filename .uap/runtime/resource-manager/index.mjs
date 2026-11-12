import { FILES } from '../_lib/paths.mjs';
import { readJSON, writeJSON, nowISO } from '../_lib/util.mjs';

export const component = 'resource-manager';
export const version = '1.0.0';
export const MAX_CONCURRENCY = 4;

function readLocks() {
  return readJSON(FILES.taskLocks, { locks: {} });
}

function writeLocks(data) {
  writeJSON(FILES.taskLocks, data);
}

export class ResourceConflictError extends Error {
  constructor(message, conflicts) {
    super(message);
    this.name = 'ResourceConflictError';
    this.conflicts = conflicts;
  }
}

/** Detect overlapping write sets between tasks that could run concurrently. */
export function detectFileConflicts(tasks) {
  const conflicts = [];
  const seen = new Map();
  for (const task of tasks) {
    for (const file of task.files || []) {
      if (seen.has(file) && seen.get(file) !== task.task_id) {
        conflicts.push({ file, task_a: seen.get(file), task_b: task.task_id });
      } else {
        seen.set(file, task.task_id);
      }
    }
  }
  return conflicts;
}

export function acquire(taskId, { files = [], resource = 'cpu', ttlMs = 300000 } = {}) {
  const data = readLocks();
  const now = Date.now();
  // Expire stale locks left behind by an interrupted process.
  for (const [key, lock] of Object.entries(data.locks)) {
    if (lock.expires_at && lock.expires_at < now) delete data.locks[key];
  }
  const active = Object.values(data.locks).filter((l) => l.task_id !== taskId);
  if (active.length >= MAX_CONCURRENCY) {
    throw new ResourceConflictError(`concurrency limit ${MAX_CONCURRENCY} reached`, active.map((l) => l.task_id));
  }
  for (const lock of active) {
    const overlap = (lock.files || []).filter((f) => files.includes(f));
    if (overlap.length) {
      throw new ResourceConflictError(`file conflict with ${lock.task_id}: ${overlap.join(', ')}`, overlap);
    }
  }
  data.locks[taskId] = { task_id: taskId, resource, files, acquired_at: nowISO(), expires_at: now + ttlMs, pid: process.pid };
  writeLocks(data);
  return data.locks[taskId];
}

export function release(taskId) {
  const data = readLocks();
  const existed = Boolean(data.locks[taskId]);
  delete data.locks[taskId];
  writeLocks(data);
  return existed;
}

export function releaseAll() {
  writeLocks({ locks: {} });
}

export function activeLocks() {
  return Object.values(readLocks().locks);
}

export function health() {
  const id = `health-probe-${process.pid}`;
  let acquired = false;
  let conflictDetected = false;
  let released = false;
  try {
    releaseAll();
    acquire(id, { files: ['.uap/state/__health_probe__'] });
    acquired = true;
    try {
      acquire(`${id}-2`, { files: ['.uap/state/__health_probe__'] });
    } catch (error) {
      conflictDetected = error instanceof ResourceConflictError;
    }
    released = release(id);
  } finally {
    releaseAll();
  }
  const detected = detectFileConflicts([
    { task_id: 'A', files: ['x.go'] },
    { task_id: 'B', files: ['x.go', 'y.go'] },
  ]);
  return {
    component,
    version,
    ok: acquired && conflictDetected && released && detected.length === 1,
    checks: { acquire: acquired, conflict_rejected: conflictDetected, release: released, conflict_detector: detected.length === 1, max_concurrency: MAX_CONCURRENCY },
    checked_at: nowISO(),
  };
}

export async function execute(task) {
  const conflicts = detectFileConflicts(task?.inputs?.tasks || []);
  return { status: conflicts.length ? 'FAILED' : 'SUCCEEDED', summary: `${conflicts.length} file conflicts`, outputs: { conflicts } };
}
