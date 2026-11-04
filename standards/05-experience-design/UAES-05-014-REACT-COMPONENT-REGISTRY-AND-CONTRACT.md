# UAES P4-IV — React Component Registry & Contract Engineering

- **Standard:** UAES-05-006 / UAES-05-007 / UAES-05-009 / UAES-05-012
- **Implementation branch:** `uaes/p4-design-token-engine`
- **Status:** DRAFT — static registry and structural scanner implemented; behavior evidence pending.

## 1. Canonical implementation boundary

`web/src/components/ui/` remains the only canonical implementation root for shared primitive UI components. `web/src/design-system/` may contain tokens, foundations, typography semantics and patterns, but must not introduce duplicate Button, Input, Dialog, Select, Table or equivalent primitives.

The registry lives at `web/src/design-system/component-registry.json`. It describes existing implementation files; it is not a second component library.

## 2. Registry coverage

The initial inventory is generated from the fixed implementation baseline and includes every eligible `.tsx` file directly under `src/components/ui/`, excluding tests. Component categories:

- Action: button and button group.
- Input / Form: value-entry controls and form composition.
- Navigation / Disclosure: tabs, menus, breadcrumb, pagination and expandable patterns.
- Overlay: dialogs, drawers, popovers, menus and tooltips.
- Feedback: alerts, progress, spinner, skeleton and empty states.
- Layout / Data display / Content / Utility: non-actionable composition and display primitives.

The scanner compares the registry with the actual filesystem. New files without registry entries and stale registry paths fail CI.

## 3. Contract model

Each component records:
- Stable ID, public name, implementation path, category and lifecycle status.
- Applicable states. Do not impose interactive states on static content components.
- Accessible name, keyboard behavior, focus-visible and state exposure requirements.
- Overlay focus management requirements when applicable.
- Narrow viewport, overflow and touch target expectations.
- Semantic Token usage requirements.
- Unit, browser and manual verification evidence.

The initial registry marks evidence `NOT_VERIFIED` unless an existing directly relevant test file is linked. A linked test file is evidence that a test exists, not proof that every contract requirement passes. Browser behavior and manual review remain separately recorded.

## 4. Commands

```bash
cd web
bun run components:registry:check
# strict mode is intentionally not a default CI gate until behavior evidence is complete
bun run components:registry:strict
```

The normal check validates IDs, required contract sections, referenced files and complete filesystem registration. Strict mode additionally requires every component to have VERIFIED evidence and is therefore a later acceptance gate.

## 5. Required component contract checklist

For interactive components:
- Accessible name and labeling relationship are defined.
- Keyboard interaction follows native HTML or the wrapped primitive's documented behavior.
- Focus-visible is visible and consistent with the design-system focus token.
- Disabled, selected, expanded, pressed and loading states are exposed when applicable.
- Pointer and keyboard interactions have equivalent outcomes.
- Touch target meets WCAG 2.2 AA 2.5.8 or has a documented exception.

For overlays:
- Open/close behavior is defined.
- Escape and outside interaction behavior are defined.
- Focus entry, containment where required, and restoration are browser-tested.
- Nested overlay stacking and portal container behavior are tested.

For non-interactive components:
- Do not add fake keyboard or disabled states.
- Define semantic HTML, content structure, responsive overflow and token use.
- Interactive descendants must satisfy their own contracts.

## 6. H5 input typography finding

The audit finding remains open: Input, Textarea and Select currently use 14px styles in the shared component source. Do not blindly change all shared controls to 16px because PC Web and H5 have different typography requirements. P4-IV should introduce an explicit platform-aware strategy or a documented mobile viewport rule, then verify it at browser widths and on iOS Safari/Android Chrome. Until that is implemented and tested, this item remains a P4 acceptance failure.

## 7. CI policy

The normal structural registry check is blocking:
- missing or duplicate IDs;
- missing component source;
- unregistered or stale files;
- missing contract sections;
- missing linked test files.

Evidence completion is a separate acceptance gate. CI must not report behavior as verified merely because the registry JSON parses or the referenced test file exists.

## 8. Current limitations

The registry captures the initial source inventory and contract metadata. It does not yet:
- infer all exported symbols or prove every export is consumed through the registry;
- prove runtime ARIA correctness;
- test keyboard/focus behavior;
- run component stories across Light/Dark themes;
- prove responsive rendering or touch target geometry.

These require targeted Testing Library and Playwright coverage and are not represented as PASS by this deliverable.
