#!/usr/bin/env node
/**
 * Post-build script: write `out/sitemap.xml` from the exported page tree.
 *
 * Every page in the docs export is a directory holding an `index.html`, so the
 * sitemap is a walk of `out/` rather than a hand-maintained list — adding
 * `content/legal/<locale>/<doc>.md` and a `nav.json` section is enough to get
 * the page listed, with no second place to update.
 *
 * The sitemap is written into `out/` *before* `copy-to-web.mjs` runs, so it
 * travels into `web/dist/docs/` with everything else and is served at
 * `/sitemap.xml` by the Go gateway (the docs export is mounted at the URL
 * root).
 *
 * Run automatically after `next build`, ahead of the copy step.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', 'out');

/**
 * Origin the sitemap's absolute URLs point at. A sitemap requires absolute
 * URLs, but a static export has no request to read the host from, so the
 * production origin is the default and `DOCS_SITE_URL` overrides it for a
 * deployment that lives elsewhere.
 */
const siteUrl = (process.env.DOCS_SITE_URL ?? 'https://uter.ai').replace(/\/+$/, '');

/** Directories that hold no indexable page. */
const EXCLUDED_DIRECTORIES = new Set(['_next', '_not-found', '404']);

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Collect the URL path of every `index.html` in the export. */
async function collectPagePaths(dir, prefix = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const pages = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const childPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (prefix === '' && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      pages.push(...(await collectPagePaths(childPath, `${prefix}/${entry.name}`)));
      continue;
    }
    if (entry.name === 'index.html') pages.push(`${prefix}/`);
  }

  return pages;
}

function renderSitemap(paths) {
  const urls = paths
    .sort()
    .map((pagePath) => `  <url>\n    <loc>${siteUrl}${pagePath}</loc>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function main() {
  if (!(await exists(outDir))) {
    console.error(`[sitemap] export directory not found: ${outDir}`);
    process.exit(1);
  }

  const pages = await collectPagePaths(outDir);
  if (pages.length === 0) {
    console.error('[sitemap] no exported pages found; refusing to write an empty sitemap');
    process.exit(1);
  }

  const target = path.join(outDir, 'sitemap.xml');
  await fs.writeFile(target, renderSitemap(pages), 'utf8');
  console.log(`[sitemap] wrote ${pages.length} URLs to ${target}`);
}

main().catch((err) => {
  console.error('[sitemap] failed:', err);
  process.exit(1);
});
