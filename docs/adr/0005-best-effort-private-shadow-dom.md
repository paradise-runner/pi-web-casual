# Best-effort private shadow-DOM integration

> The header-button part of this decision was removed in [ADR 0009](0009-the-tab-replaces-the-header-button.md). The hidden project row and the embedded frame's chrome trimming still apply.

Casual needs two surfaces PI WEB does not expose: a hidden `Casual` project row and a chat-only layout for the embedded frame. Neither has a public contribution point, so both are done against PI WEB's private shadow DOM, isolated in `src/browser/dom.ts`, guarded so nothing is injected twice, and treated as optional.

## Revision: the row is hidden by stylesheet, not by a poll

The row used to be hidden by script on a 500 ms timer. Every render of the project list — expanding the **Projects** section, a machine switch, a later Lit update — paints the row before that timer can act, so the hidden project was briefly visible. The plugin now injects a stylesheet into the project-list shadow root (marked `data-pi-web-casual-project-style`) and re-runs its pass from a `MutationObserver`, whose callbacks land before the browser paints. The 1 second interval that remains only picks up shadow roots created while nothing was observing their parent.

One gap is structural: on a cold page load the sidebar can paint before the plugin module has been fetched, so the row is visible for the moment between that first paint and activation. Nothing in the package runs earlier. The count and the collapsed-heading summary still need script, because CSS cannot subtract a row from a number or blank a summary.

## Consequences

- The advertised one-click entry point and the clean sidebar both depend on host markup that can change without notice. A PI WEB update can drop them.
- The supported fallbacks are the **Casual** tab and the palette actions, which use public contracts and keep working when the selectors break.
- Selector fixes stay confined to one file, and the manual checklist covers both the oldest supported host and the latest release.
- Injected nodes are marked (`data-pi-web-casual-project-style`, `data-pi-web-casual-hidden`, `data-pi-web-casual-embed`) and removed on plugin deactivation so a reload or disable leaves the page clean.
- The row is hidden from its first paint on every render after activation, but a cold page load can show it until the plugin module loads.
