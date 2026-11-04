# UAES P4-IV — React Component Registry Validation Record

- Repository: `hu-xulin/uter`
- Implementation branch: `uaes/p4-design-token-engine`
- CI branch: `audit/uaes-p4-design-token-engine`
- Baseline commit: `77dab9bf56fff59d6bed0d11cb88fa0901253c4a`
- Status: **PENDING CI**

## 1. Static source inventory

The Git tree inventory at the implementation baseline contains 65 eligible React UI implementation files under `web/src/components/ui/`, excluding test files and the `__tests__` directory.

## 2. Registry integrity

The committed registry was parsed and checked for:
- 65 entries;
- 65 unique component IDs;
- 65 unique implementation paths;
- all required contract sections present;
- 9 components with directly linked existing test files, marked `PARTIAL`;
- 56 components marked `NOT_VERIFIED`.

This is a static data-integrity check. It is not a claim that the JSON Schema validator, Node scanner, Vitest or browser tests have executed.

## 3. Previous CI test findings and corrections

The preceding P4 token implementation CI run failed 3 frontend test files (280 passed / 283 total):
- `sidebar-active-guard.test.ts`: assertions still expected hard-coded legacy primary values after the CSS was changed to generated Token aliases.
- `status-badge-contrast.test.ts`: assertion expected a hard-coded Dark soft foreground instead of reading the structured Token source.
- `token-source.test.ts`: `new URL(..., import.meta.url)` was transformed by the Vitest environment into a non-file URL.

The assertions were updated to consume the structured Token source and generated CSS mapping; filesystem reads in the token-source test now use `process.cwd()` paths. A new CI run is required to confirm these fixes.

## 4. Outstanding runtime checks

- `bun run components:registry:check`
- `bun run design:tokens:check`
- `bun run verify:contrast`
- `bun run test`
- `bun run typecheck`
- `bun run lint`
- `bun run build:check`

Browser tests, keyboard review, axe and visual regression remain separate P4 acceptance requirements.

## 5. Acceptance

Do not mark P4-IV or P4 as accepted until the current branch CI completes successfully and the remaining component-level behavioral evidence is added.
