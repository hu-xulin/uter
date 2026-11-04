# UAES-05-GATE-001 — Experience & Design Quality Gate

- **Domain:** UAES-05 Experience & Design
- **Status:** DRAFT
- **Applies to:** `web/` design tokens, themes, React UI components, page styles and visual assets
- **Primary workflow:** `.github/workflows/ci.yml` → frontend job
- **Rule source:** UTER Design System 3.0 + UAES-05 standards
- **Gate owner:** Uter Engineering

## 1. Purpose

This gate prevents design-system drift from entering the default branch. It combines structured token integrity, generated CSS synchronization, contrast verification, static style scanning, component tests, type checking and production build verification.

A passing Token check alone does not prove that every React component or page is visually and accessibly compliant. The gate therefore distinguishes automated checks from browser-level checks and coverage that is still pending.

## 2. Gate result

Only these result values are permitted:

- `PASS`: executed and passed with retained evidence.
- `FAIL`: executed and failed.
- `BLOCKED`: could not execute because a required environment, account, fixture or dependency was unavailable.
- `NOT_RUN`: not executed.
- `NOT_APPLICABLE`: not applicable, with a written reason.

`BLOCKED`, `NOT_RUN` and `NOT_APPLICABLE` must never be counted as `PASS`.

## 3. Mandatory CI checks

| ID | Check | Command | Blocking |
|---|---|---|---|
| DQG-01 | Token source → generated CSS sync | `bun run design:tokens:check` | Yes |
| DQG-02 | Brand contrast pairs | `bun run verify:contrast` | Yes |
| DQG-03 | Design-token code scan | `bun run lint:design:strict` | Yes |
| DQG-04 | Frontend unit/component tests | `bun run test` | Yes |
| DQG-05 | Type safety | `bun run typecheck` | Yes |
| DQG-06 | Copyright headers | `bun run copyright:check` | Yes |
| DQG-07 | Production build | `bun run build:check` | Yes |
| DQG-08 | React component registry and filesystem parity | `bun run components:registry:check` | Yes |

The checks above are integrated into the existing frontend CI job. Do not create a second independent lint or component implementation pipeline when the existing project tooling already provides the required behavior. The component registry check validates structural completeness and filesystem parity only; it does not claim browser behavior or accessibility evidence is verified.

## 4. Token source requirements

1. Structured token source is authoritative for each migrated token family. The current brand source uses DTCG token fields (`$type`, `$value`, `$description`) and a namespaced `$extensions` object for UAES provenance.
2. Generated CSS is committed and must exactly match generator output.
3. Generated files must contain a generated-file warning and must not be edited manually.
4. A source change without regenerated output is a failure.
5. Generated output without a source change is a failure unless explicitly explained.
6. Every token family must identify its theme coverage and provenance.
7. User-confirmed values, migrated legacy values and proposals must remain distinguishable.
8. Do not mark the entire design system as machine-generated while unmigrated token families remain CSS-authored.

Current migrated family:
- Brand palette: `web/src/design-system/source/brand.tokens.json`.

Still CSS-authored and not yet migrated:
- Typography, primitive values, semantic tokens, spacing/density, elevation/motion, chart/syntax/terminal colors, and user theme presets.

## 5. Contrast requirements

The contrast script must read the same structured source that generates the CSS. It must not maintain a second independent copy of brand colors.

Minimum thresholds:
- Normal text: 4.5:1.
- Large text: 3:1.
- Required non-text UI boundaries and focus indicators: 3:1 where WCAG 2.2 applies.

The current brand contrast script covers a defined subset of primary, hover, active, link, soft and focus/border pairs. This is not yet a full audit of every semantic color, every preset, every component state or every rendered background.

Alpha colors must be composited against their actual background before contrast evaluation. Do not lower thresholds to make a failing pair pass.

## 6. Component requirements

The formal implementation location for base UI components remains `web/src/components/ui/`.

For each registered component, its contract must define only applicable states and behaviors, such as:
- Default, hover, pressed, selected, expanded and disabled.
- Focus-visible and keyboard behavior.
- Loading and error, where applicable.
- Accessible name, role, description and labeling relationships.
- Light/Dark behavior.
- Responsive constraints and touch target behavior.
- The tests or browser evidence that verify the contract.

Do not require non-interactive components such as Card or Table to implement button-only states. Components wrapping Base UI primitives still require browser-level evidence for focus management, keyboard traversal, dismissal and focus restoration.

**Current limitation:** a complete machine-readable component registry and per-component contract scanner have not yet been implemented. Until P4-IV is complete, component contract coverage is `BLOCKED`, not `PASS`.

## 7. Visual and accessibility checks

Required browser checks:
- Light and Dark themes.
- Supported desktop and mobile viewports.
- Focus-visible, disabled, loading, error, empty and expanded states where applicable.
- Layout overflow, clipping, overlay stacking and responsive behavior.
- Keyboard-only navigation and dialog/popover focus restoration.
- axe-based automated accessibility checks plus manual keyboard review.

Existing Playwright visual regression assets are retained. Visual snapshot updates require review and must not be used to conceal regressions.

**Current limitation:** full authenticated-route visual/a11y coverage is not part of the newly added mandatory CI steps. Until valid test sessions and stable fixtures are provided, these checks must be recorded as `BLOCKED` or `NOT_RUN`.

## 8. Blocking conditions

The gate must fail when:
- Generated CSS is stale.
- Required source tokens are missing or malformed.
- A required contrast pair fails.
- Strict token scanning reports a new violation.
- A required frontend test, typecheck or production build fails.
- A P0/P1 design or accessibility defect remains unresolved.
- A generated file was manually edited without updating its source.
- A CI step is removed, skipped or weakened without an approved change record.

## 9. Evidence record

Every gate run must retain:
- Repository and commit SHA.
- Workflow run URL and job name.
- Exact command and exit code.
- Token source and generated-file hashes.
- Contrast output.
- Test summary.
- Static scan summary.
- Visual artifacts and axe output, when run.
- All BLOCKED / NOT_RUN checks with reason and owner.

## 10. Current implementation mapping

The existing frontend CI job now includes:
- `bun run design:tokens:check`
- `bun run verify:contrast`
- `bun run lint:design:strict`
- Existing full frontend Vitest, typecheck, copyright and build steps.

The gate remains DRAFT until the workflow completes successfully and P4-IV component contracts plus P4-VI browser validation have evidence.
