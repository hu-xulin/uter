import { uapPath, ensureDir } from '../runtime/_lib/paths.mjs';

/** Absolute directory holding the machine-readable UAP contracts. */
export const SCHEMA_DIR = ensureDir(uapPath('schemas'));

export const SCHEMA_NAMES = Object.freeze([
  'task.schema.json',
  'agent-result.schema.json',
  'executor-result.schema.json',
  'validator-result.schema.json',
  'evidence.schema.json',
  'defect.schema.json',
  'final-status.schema.json',
]);
