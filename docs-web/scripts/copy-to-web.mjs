#!/usr/bin/env node
/**
 * Post-build script: copy the Next.js static export from `out/` into
 * `../web/dist/docs/` so the Go backend can serve it through the
 * existing `//go:embed web/dist` mount.
 *
 * `next.config.mjs` is configured with `output: 'export'` so the build
 * artifact is a fully static directory tree at `out/`. The Go router
 * mounts `web/dist/docs/` at the URL root (with fallthrough to the
 * React SPA), so every URL inside `out/` maps directly to a served
 * path — there's no `basePath` rewrite to worry about.
 *
 * With the `/docs/<lang>/` URL scheme, the Next.js App Router directory
 * structure is `docs/[lang]/...`, which exports to
 * `out/docs/<lang>/...` — matching the served URLs directly.
 *
 * Run automatically after `next build` via the `postbuild` npm hook.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '..', 'out');
const target = path.resolve(here, '..', '..', 'web', 'dist', 'docs');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(source))) {
    console.error(`[copy-to-web] source directory not found: ${source}`);
    process.exit(1);
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rm(target, { recursive: true, force: true });
  await fs.cp(source, target, { recursive: true });
  console.log(`[copy-to-web] ${source} -> ${target}`);
}

main().catch((err) => {
  console.error('[copy-to-web] failed:', err);
  process.exit(1);
});