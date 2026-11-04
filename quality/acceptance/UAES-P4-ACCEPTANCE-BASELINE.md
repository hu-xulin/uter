# UAES P4 — Experience & Design Engineering Acceptance Baseline

- **Status:** DRAFT / NOT ACCEPTED
- **Repository baseline:** `77dab9bf56fff59d6bed0d11cb88fa0901253c4a`
- **Implementation branch:** `uaes/p4-design-token-engine`
- **CI validation branch:** `audit/uaes-p4-design-token-engine`
- **Gate:** `UAES-05-GATE-001`

## 1. Acceptance rules

- `PASS`: verified by executable evidence.
- `FAIL`: executed and failed.
- `BLOCKED`: environment or prerequisite prevented execution.
- `NOT_RUN`: not executed.
- `NOT_APPLICABLE`: not applicable with a reason.

A document, implementation plan or source-code inspection is not runtime verification. A pending CI run is not a pass.

## 2. Current acceptance matrix

| ID | Area | Current result | Evidence / gap |
|---|---|---|---|
| P4-A01 | Repository and design asset inventory | PASS | Fixed-SHA inventory recorded in `docs/design-system/audit/UAES-P4-IMPLEMENTATION-AUDIT.md` |
| P4-A02 | UTER Design System 3.0 review | PASS | Existing official spec compared with theme, Token and component source |
| P4-A03 | React component inventory | PASS | `components/ui/` inventory and key control source review completed |
| P4-A04 | Full component contract coverage | BLOCKED | Machine-readable component registry and contract scanner not yet implemented |
| P4-A05 | Brand Token structured source | PASS (implementation) | JSON source and schema committed; runtime validation still pending |
| P4-A06 | CSS generation tool | NOT_RUN | Generator committed; local execution unavailable in remote repository session |
| P4-A07 | Generated CSS synchronization | NOT_RUN | CI command added; workflow result pending |
| P4-A08 | Brand contrast matrix | NOT_RUN | Values calculated during review; script and CI execution pending |
| P4-A09 | Strict design-token scan | NOT_RUN | Existing script retained; current branch execution pending |
| P4-A10 | Frontend unit/component tests | NOT_RUN | Existing tests plus new token-source test; CI execution pending |
| P4-A11 | Typecheck and production build | NOT_RUN | CI execution pending |
| P4-A12 | Full Light/Dark page visual regression | NOT_RUN | Requires browser execution and complete page coverage |
| P4-A13 | WCAG / axe browser audit | NOT_RUN | Requires browser execution, stable fixtures and authenticated test session |
| P4-A14 | H5 input typography | FAIL | Input, Textarea and Select currently use 14px `text-sm`; Design System 3.0 requires at least 16px for H5 input text |
| P4-A15 | Design Quality Gate integration | PASS (configuration) | Token sync and contrast checks added to frontend CI; actual workflow result pending |
| P4-A16 | React component registry and filesystem parity | NOT_RUN | 65 component contracts registered; structural scanner added to CI; workflow result pending |
| P4-A17 | Per-component behavioral and accessibility evidence | BLOCKED | Existing test files linked where relevant; full contract-level Testing Library / Playwright evidence not yet complete |

## 3. Brand contrast calculations

The values below are deterministic calculations from the structured brand source, not a claim that the CI script has executed:

| Pair | Calculated ratio | Threshold | Calculation |
|---|---:|---:|---|
| Light white text / primary `#5B5EE6` | 5.01:1 | 4.5:1 | PASS |
| Light white text / hover `#4F52D1` | 6.07:1 | 4.5:1 | PASS |
| Light white text / active `#4A4DC5` | 6.65:1 | 4.5:1 | PASS |
| Light soft foreground `#5558D8` / soft `#F0F0FF` | 4.93:1 | 4.5:1 | PASS |
| Dark foreground `#020617` / primary `#A1A3F7` | 8.74:1 | 4.5:1 | PASS |
| Dark soft foreground `#B1B3FF` / soft `#25264A` | 7.40:1 | 4.5:1 | PASS |

These calculations cover only the listed pairs. They do not establish full semantic color, theme preset, component or rendered-page compliance.

## 4. Outstanding P4 work

1. Extend structured Token source to typography, spacing, radius, elevation, motion and other semantic color families.
2. Create a complete component registry and typed contracts for the formal `components/ui/` implementation.
3. Add component contract checks to CI.
4. Correct H5 input text sizing and add mobile viewport regression tests.
5. Expand contrast coverage to all required semantic foreground/background/state pairs.
6. Run visual regression and axe against public and authenticated routes.
7. Complete keyboard-only verification for dialogs, menus, popovers, tabs and form controls.
8. Review theme preset behavior to ensure derived brand states remain coherent when `data-theme-preset` overrides `--primary`.

## 5. Acceptance decision

**Current decision: BLOCKED — do not mark P4 accepted.**

Reasons:
- CI execution evidence is pending.
- Full component contracts are not yet implemented.
- H5 input typography has a known mismatch.
- Full browser visual and accessibility coverage has not been executed.

P4 can be accepted only when all mandatory checks have evidence, no unresolved P0/P1 issue remains, the H5 input mismatch is fixed, and all BLOCKED / NOT_RUN items have been resolved or formally excepted.
