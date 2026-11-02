# Conversations live in a numbered strip

ADR 0001 kept one remembered conversation and left every other casual session to **Sessions**, on the reasoning that a picker is a second navigation surface for something casual. In practice the home accumulates conversations (a trip, a recipe, a debugging detour), and the hidden project row means **Sessions** is not reachable without selecting a project first — so the other conversations were effectively lost. A thin strip of numbered conversations at the top of the Casual tab is the smallest surface that fixes that, and it is navigation, not a toolbar: **1..N**, **+**, and a **×** on the active tab.

## The strip

- **Numbers are positions.** Tab *n* is the *n*-th conversation in the strip, oldest first. A new conversation is appended, so the numbers before it never move; closing one renumbers what follows. The agent's session name rides in the tab's tooltip and accessible name, because a name is not readable at tab size on a phone.
- **The **+** starts a conversation in the same home** through the host's own session route (the one first run uses) and makes it the active tab. It does not navigate the page; the host's sidebar **+** would have required the workspace to be selected first.
- **The **×** archives the conversation** through PI WEB's session lifecycle route, which is the route behind the host's own session actions. Archived conversations keep their place in PI WEB's **Archived** sessions and can be restored there, so the strip never destroys history and the plugin still has no delete of its own. The last tab carries no **×**: Casual is never left with nothing to show. A conversation that was started and never used has no session file yet, so its tab is simply dropped.
- **The strip is always visible,** even with one conversation, so the **+** is discoverable. This is the one place where the strip departs from ADR 0009's "the tab is only a chat": the strip is the conversation switcher, and every other control stays in the palette.

## Switching does not reload

The panel keeps one frame for the life of the tab and swaps conversations through the frame's own history: `pushState` to the conversation's route, then a synthetic `popstate`, which is how PI WEB routes its own document. Measured, the frame's document survives and its selection changes, so switching is instant and no second client instance or daemon connection is created. This is private host behavior on the same footing as the chrome trimming (ADR 0005), so it is verified through the host's own selected-session marker; when the host did not act on the event, the frame is reloaded and the tab still switches, one conversation per page load.

## Consequences

- The pointer grows from one session to a strip plus an active session (`tabs` and `sessionId` under `pi-web-casual:store:v2`). It is normalized on read, so a record written before the strip existed opens as a one-tab strip with no migration step.
- **New chat** in the palette and the strip's **+** both append; **Reset link** and **Change home** clear the strip.
- Tabs whose conversation was archived or deleted elsewhere are dropped at discovery; names are refreshed from the catalog, or from the host's session list on hosts without one.
- The active tab stays authoritative when discovery runs, instead of the newest session winning: a tab switch must not be undone by the next render.
- Per-tab agent state (a dot per tab) is deliberately out of scope for now; the **⁂** on the Casual tab still reports the home's work and unread reply.
- Narrows ADR 0001 (one home, several conversations, still no topics or folders) and amends ADR 0009 (a conversation strip is navigation; there is still no toolbar).
- The archive action needs a host with the session lifecycle route; on an older host the **×** removes the tab and says so, and the conversation stays in **Sessions**.
