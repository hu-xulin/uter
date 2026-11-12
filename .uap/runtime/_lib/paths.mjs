import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const DEFAULT_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function findRepoRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, '.uap', 'VERSION'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export const ROOT = process.env.UAP_ROOT
  ? path.resolve(process.env.UAP_ROOT)
  : (findRepoRoot(process.cwd()) || DEFAULT_ROOT);

export const UAP = path.join(ROOT, '.uap');
export const CONFIG = path.join(UAP, 'config');
export const STATE = path.join(UAP, 'state');
export const EVIDENCE = path.join(UAP, 'evidence');
export const REPORTS = path.join(UAP, 'reports');
export const RUNTIME = path.join(UAP, 'runtime');
export const ENGINES = path.join(UAP, 'engines');
export const VALIDATORS = path.join(UAP, 'validators');
export const TESTS = path.join(UAP, 'tests');

export const FILES = {
  version: path.join(UAP, 'VERSION'),
  readme: path.join(UAP, 'README.md'),
  index: path.join(UAP, 'SPECIFICATION-INDEX.md'),
  baseline: path.join(STATE, 'BASELINE.json'),
  tasks: path.join(STATE, 'tasks.json'),
  events: path.join(STATE, 'events.jsonl'),
  runs: path.join(STATE, 'workflow-runs.json'),
  audit: path.join(STATE, 'audit.json'),
  taskLocks: path.join(STATE, 'locks.json'),
  defects: path.join(REPORTS, 'DEFECT-REGISTRY.json'),
  finalStatus: path.join(REPORTS, 'FINAL-STATUS.json'),
  evidenceIndex: path.join(REPORTS, 'EVIDENCE-INDEX.md'),
};

export function uapPath(...segments) {
  return path.join(UAP, ...segments);
}

export function rootPath(...segments) {
  return path.join(ROOT, ...segments);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function relToRoot(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}
