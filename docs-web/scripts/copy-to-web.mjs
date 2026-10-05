#!/usr/bin/env node
/**
 * Post-build script: copy the Next.js static export from `out/` into
 * `../web/dist/docs-content/` so the Go backend can serve it through the
 * existing `//go:embed web/dist` mount.
 *
 * `next.config.mjs` sets `output: 'export'` and `basePath: '/docs-content'`.
 * With `output: 'export'` the page tree is still emitted at the root of the
 * export directory — i.e. `out/docs/<lang>/...`, `out/about/<lang>/...`,
 * `out/_next/...`, `out/search-index.json` — and `basePath` only rewrites the
 * asset references *inside* those files to be prefixed with `/docs-content`
 * (so `/docs-content/_next/...`, `/docs-content/docs/...`, …). The export
 * does NOT create an `out/docs-content/` subdirectory.
 *
 * The Go router mounts `web/dist/docs-content` at `/docs-content`
 * (see `router/web-router.go`), so copying the whole `out/` tree into
 * `web/dist/docs-content/` makes every asset URL resolve:
 *   `/docs-content/docs/<lang>/...`  -> web/dist/docs-content/docs/<lang>/...
 *   `/docs-content/about/<lang>/...` -> web/dist/docs-content/about/<lang>/...
 *   `/docs-content/_next/...`        -> web/dist/docs-content/_next/...
 *
 * Run automatically after `next build` via the `postbuild` npm hook.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// The static export is emitted to `out/` at the root; `basePath` only affects
// the asset URLs written inside those files, not the directory layout.
const source = path.resolve(here, '..', 'out');
const target = path.resolve(here, '..', '..', 'web', 'dist', 'docs-content');

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