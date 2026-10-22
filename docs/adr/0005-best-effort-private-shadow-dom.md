# Best-effort private shadow-DOM integration

> The header-button part of this decision was removed in [ADR 0009](0009-the-tab-replaces-the-header-button.md). The hidden project row and the embedded frame's chrome trimming still apply.

Casual needs two surfaces PI WEB does not expose: a **⁂** button beside **Actions** and a hidden `Casual` project row. Neither has a public contribution point, so both are done against PI WEB's private shadow DOM, isolated in `src/browser/dom.ts`, guarded so nothing is injected twice, and treated as optional.

## Consequences

- The advertised one-click entry point and the clean sidebar both depend on host markup that can change without notice. A PI WEB update can drop them.
- The supported fallbacks are the **Casual** tab and the palette actions, which use public contracts and keep working when the selectors break.
- Selector fixes stay confined to one file, and the manual checklist covers both the oldest supported host and the latest release.
- Injected nodes are marked (`data-pi-web-casual-button`, `data-pi-web-casual-hidden`) and removed on plugin deactivation so a reload or disable leaves the page clean.
