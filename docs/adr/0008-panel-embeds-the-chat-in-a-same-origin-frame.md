# The Casual panel embeds the chat in a same-origin frame

The Casual tab is a third-column application panel. Nothing in the plugin API renders a transcript, so the only way to show a chat *inside* that panel is to embed one. Casual loads the ordinary chat route in a same-origin iframe (`name="pi-web-casual-embed"`), then trims that frame's chrome: the context bar, navigation panel, workspace column, and mobile tabs are hidden, and unrelated sibling branches above `chat-view` are hidden too. The plugin's own host bridge stays quiet inside the frame so no second ⁂ button or sidebar filter appears there.

## Consequences

- The Casual tab now presents a usable chat surface in place, which is what the panel was asked to be. A project chat in the main column is untouched, so both are visible at once without a second browser window.
- The frame is a full PI WEB client: it opens its own connection to the session daemon and loads the whole bundle a second time. That is the cost of embedding, and why **Open in its own tab** and **Open chat** still exist for lighter paths.
- Trimming depends on host internals (`chat-view`, `prompt-editor`, `status-bar`, and the column element names already used by the shadow-DOM bridge). It is supervised rather than applied once: the frame boots its own SPA, so the first `load` fires before `chat-view` exists. A persistent stylesheet hides the known chrome, a 300 ms pass hides the sibling branches above the chat, and the chat's own ancestors are never hidden.
- The trimmed frame hides the embedded app's own navigation, so a user cannot change project inside it. That is intentional: the frame is a chat, not an app.
- The tab carries no toolbar. A chat surface with plugin buttons above and below it was the complaint that produced this ADR, so **New**, **Reset**, **Change home**, **Open**, and **Open in Its Own Tab** moved into the palette, which was already the plugin's control surface.
- The remembered pointer is refreshed without navigating (`refreshCasualPointer`) so the frame follows the newest live casual session. A stale pointer would otherwise embed a route the host rejects.
- Inside the frame `window.name` is the marker, the same mechanism the separate window uses for closing. Two window names, two meanings: `pi-web-casual-embed` (quiet plugin) and `pi-web-casual-chat` (standalone).
- If the panel is ever restored as the active tab inside the embedded app, it renders the card instead of nesting another frame.
