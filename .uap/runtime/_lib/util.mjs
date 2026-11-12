import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir } from './paths.mjs';

export function nowISO() {
  return new Date().toISOString();
}

export function newId(prefix) {
  return `${prefix}-${nowISO().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomBytes(4).toString('hex')}`;
}

export function hash(content) {
  return crypto.createHash('sha256').update(String(content)).digest('hex');
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

const SECRET_PATTERNS = [
  /(AIza[0-9A-Za-z_-]{20,})/g,
  /(whsec_[0-9A-Za-z]{16,})/g,
  /(sk-[0-9A-Za-z]{20,})/g,
  /(ghp_[0-9A-Za-z]{30,})/g,
  /((?:password|passwd|secret|token|api_key|apikey|private_key)\s*[:=]\s*)(["']?)([^\s"',;}{]{6,})\2/gi,
];

export function redact(text) {
  let out = String(text ?? '');
  out = out.replace(SECRET_PATTERNS.slice(0, 4)[0], '[REDACTED]');
  for (let i = 1; i < 4; i += 1) out = out.replace(SECRET_PATTERNS[i], '[REDACTED]');
  out = out.replace(SECRET_PATTERNS[4], (_m, key, quote) => `${key}${quote}[REDACTED]${quote}`);
  return out;
}

export function readJSON(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`cannot read JSON ${file}: ${error.message}`);
  }
}

export function writeJSON(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
  return file;
}

/** Evidence is append-only: a given evidence ID is never overwritten. */
export function writeEvidence(file, value) {
  ensureDir(path.dirname(file));
  if (fs.existsSync(file)) {
    throw new Error(`evidence already exists and must not be overwritten: ${file}`);
  }
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

export function appendJSONL(file, record) {
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
}

export function readJSONL(file) {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

export function exists(file) {
  return fs.existsSync(file);
}

export function listFiles(dir, { recursive = true, filter = () => true } = {}) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (recursive && !['node_modules', '.git', 'dist', 'logs', '__pycache__'].includes(entry.name)) walk(abs);
      } else if (entry.isFile() && filter(abs)) {
        out.push(abs);
      }
    }
  };
  walk(dir);
  return out.sort();
}

export function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
