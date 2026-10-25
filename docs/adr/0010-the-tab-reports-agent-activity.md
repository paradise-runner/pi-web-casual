# The Casual tab reports agent activity

Casual hides its home from the **Projects** sidebar (ADR 0005), so the signal every other project row carries — a green dot while a session works, an accent mark for an unread completion — had no Casual surface at all. The **Casual** tab is that surface now: its **⁂** takes the same colors, and the tab's tooltip and accessible name say what the color means.

The state comes from PI WEB's own machine status snapshot, not from the panel. The public plugin API exposes no status reads: the v5 **catalog** reports a session's `runtime` as `busy` or `idle` only, it cannot say "finished and unread", and it does not exist on `1.202610.3` (ADR 0004). The snapshot behind the sidebar's dots has both flags at project level and predates the plugin's oldest supported host, so the plugin reads `api/machines/<machineId>/status` — the same same-origin, best-effort footing as first-run project creation (ADR 0003) — and polls it every four seconds while the page is visible.

## Consequences

- Working is green (`--pi-success`), an unread completion is accent (`--pi-accent`), and nothing in flight leaves the glyph untinted, so the tab reads at rest exactly as it did before.
- The tab is right even when the panel has never rendered, because the plugin polls rather than asking the panel what it last saw.
- Status can be up to four seconds stale, and a hidden document does not poll at all; `visibilitychange` refreshes immediately. Color alone would be an accessibility gap, so the tab's `title` and `aria-label` (`Casual, agent working`, `Casual, reply unread`) carry the same state and are restored from the host's own values when nothing is in flight.
- `working` is a project roll-up: any session in the home that is busy lights the tab, including a sibling started by **New chat**. That matches what the hidden project row would have shown.
- If the endpoint is unreachable or the snapshot has no `projects` field, the tab keeps the last state it painted instead of guessing. A PI WEB release that moves the endpoint leaves the plugin working, only without the color.
- The state is one color for the plugin, not one per machine: a browser with pointers on two machines shows the strongest state across them, since both tabs share the `Casual` label.
- The color travels as a custom property set on the document root, which reaches the plugin's own icon markup through the host's shadow boundary without rewriting attributes the host owns.
