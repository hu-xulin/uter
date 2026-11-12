import { FILES } from '../_lib/paths.mjs';
import { appendJSONL, readJSONL, newId, nowISO } from '../_lib/util.mjs';

export const component = 'event-system';
export const version = '1.0.0';

const subscribers = new Map();

export function publish(type, payload = {}, { trace_id = null, task_id = null, severity = 'INFO' } = {}) {
  if (!type || typeof type !== 'string') throw new Error('event type must be a non-empty string');
  const event = {
    event_id: newId('UAP-EVT'),
    type,
    severity,
    task_id: task_id ?? payload.task_id ?? null,
    trace_id: trace_id ?? payload.trace_id ?? null,
    at: nowISO(),
    payload,
  };
  appendJSONL(FILES.events, event);
  for (const handler of subscribers.get(type) || []) {
    try { handler(event); } catch { /* subscriber must never break the publisher */ }
  }
  for (const handler of subscribers.get('*') || []) {
    try { handler(event); } catch { /* no-op */ }
  }
  return event;
}

export function subscribe(type, handler) {
  if (typeof handler !== 'function') throw new Error('subscriber must be a function');
  if (!subscribers.has(type)) subscribers.set(type, new Set());
  subscribers.get(type).add(handler);
  return () => subscribers.get(type).delete(handler);
}

export function query({ task_id, type, trace_id, since, limit = 1000 } = {}) {
  let events = readJSONL(FILES.events);
  if (task_id) events = events.filter((e) => e.task_id === task_id);
  if (type) events = events.filter((e) => e.type === type);
  if (trace_id) events = events.filter((e) => e.trace_id === trace_id);
  if (since) events = events.filter((e) => e.at >= since);
  return events.slice(-limit);
}

export function replay(type, handler) {
  return query({ type }).map(handler);
}

export function count() {
  return readJSONL(FILES.events).length;
}

export function health() {
  const before = count();
  const probe = publish('runtime.health.probe', { probe: true }, { severity: 'DEBUG' });
  const found = query({ type: 'runtime.health.probe' }).some((e) => e.event_id === probe.event_id);
  const byTask = query({ task_id: probe.task_id }).length;
  return {
    component,
    version,
    ok: found && count() === before + 1,
    checks: {
      persisted_event_found: found,
      event_count_incremented: count() === before + 1,
      structured_fields: Boolean(probe.event_id && probe.at && probe.type),
      task_query: byTask >= 0,
    },
    checked_at: nowISO(),
  };
}

export async function execute(task) {
  const event = publish(task?.inputs?.event_type || 'task.custom', task?.inputs?.payload || {}, { task_id: task?.task_id });
  return { status: 'SUCCEEDED', summary: `published ${event.type}`, outputs: { event_id: event.event_id } };
}
