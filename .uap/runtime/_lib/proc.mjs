import { spawn } from 'node:child_process';
import { redact, nowISO } from './util.mjs';
import { ROOT } from './paths.mjs';

const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

/**
 * Execute a real local process. Never uses `eval`, never interpolates
 * untrusted task text into a shell. Commands come from the allow-listed
 * adapter definitions only.
 */
export function runCommand({ command, args = [], cwd = ROOT, timeoutMs = 120000, env = {}, shell = false }) {
  return new Promise((resolve) => {
    const startedAt = nowISO();
    const t0 = Date.now();
    const child = spawn(command, args, {
      cwd,
      shell,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let bytes = 0;
    const collect = (chunk, target) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) return;
      if (target === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };
    child.stdout.on('data', (c) => collect(c, 'stdout'));
    child.stderr.on('data', (c) => collect(c, 'stderr'));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        command: `${command} ${args.join(' ')}`.trim(),
        cwd,
        started_at: startedAt,
        duration_ms: Date.now() - t0,
        exit_code: null,
        signal: null,
        timed_out: false,
        spawn_error: redact(error.message),
        stdout: '',
        stderr: redact(error.message),
      });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        command: `${command} ${args.join(' ')}`.trim(),
        cwd,
        started_at: startedAt,
        duration_ms: Date.now() - t0,
        exit_code: timedOut ? null : code,
        signal,
        timed_out: timedOut,
        spawn_error: null,
        stdout: redact(stdout.slice(0, MAX_OUTPUT_BYTES)),
        stderr: redact(stderr.slice(0, MAX_OUTPUT_BYTES)),
      });
    });
  });
}

/** Commands that UAP is allowed to execute. Anything else is refused by policy. */
export const COMMAND_ALLOWLIST = new Set([
  'node',
  'bun',
  'go',
  'gofmt',
  'git',
  'bash',
  'python3',
  'make',
]);

export function isCommandAllowed(command) {
  return COMMAND_ALLOWLIST.has(command);
}
