# How Casual works

This page is for contributors, maintainers, and anyone debugging Casual. For day-to-day usage, see [Using Casual](using-casual.md); for vocabulary, [GLOSSARY.md](../GLOSSARY.md); for the reasoning behind the shape of the plugin, [docs/adr/](adr/).

## Design in one paragraph

Casual is a browser-only PI WEB plugin that adds a single long-running conversation outside any repository. It does not implement an agent client: the chat you see is PI WEB's native chat, which is why streaming, tools, images, model selection, and compaction behave exactly like everywhere else. The plugin's job is small and specific — create and hide a home project, remember which session to show, and present that conversation in the Casual tab.

## What the plugin contributes

| Contribution | Where | Source |
| --- | --- | --- |
| **Casual** application panel (tab) | PI WEB tab bar, desktop and mobile | [`src/browser/index.ts`](../src/browser/index.ts), [`panel.ts`](../src/browser/panel.ts) |
| Palette actions — *Open Casual Chat*, *Open Casual Chat in Its Own Tab*, *New Casual Chat*, *Set Up Casual Chat* | Actions palette, group "Casual" | [`src/browser/index.ts`](../src/browser/index.ts) |
| Hidden project row | Sidebar **Projects** list | [`src/browser/dom.ts`](../src/browser/dom.ts) |
| Embedded chat | Casual tab, same-origin frame | [`src/browser/panel.ts`](../src/browser/panel.ts) |

Everything else is navigation into PI WEB's own screens.

## First run

The public plugin API cannot register a project, so first run uses the host's own same-origin endpoints (`api/machines/<machineId>/...`) to:

1. create and trust the project at `~/.casual-pi-web` (created with `create: true`, expanded by the host),
2. create the first workspace session,
3. write the remembered pointer,
4. reload the page once into the chat.

If those requests fail, the panel falls back to a setup card where you can add `~/.casual-pi-web` yourself or choose an existing project as the home. Code: [`src/browser/bootstrap.ts`](../src/browser/bootstrap.ts).

The folder lives on the machine that hosts PI WEB, which is why the pointer is stored per machine.

## Finding the conversation

Two discovery paths, chosen by host version ([`src/browser/casual.ts`](../src/browser/casual.ts)):

- **PI WEB `1.202610.6+`** — the public **catalog** exposed to application panels. Casual lists workspaces for the home project, prefers the remembered one, then the main one, then the first; it then lists sessions, prefers the remembered one, and otherwise takes the newest non-archived session. Because this is authoritative, a stale remembered session is replaced automatically.
- **PI WEB `1.202610.3`** — the selection service, plus the host's **+** button (`button.start-session-button`) when a new session has to be created later.

If a new session can't be created at all, the panel shows an error card explaining how to open the casual workspace and press **+** next to **Sessions** manually.

## Remembered state

The per-machine **pointer** lives in `localStorage` under `pi-web-casual:store:v2` ([`src/browser/store.ts`](../src/browser/store.ts)) and holds the project, workspace, and session.

| Control | Fields cleared |
| --- | --- |
| **Reset link** | workspace, session |
| **Change home** | project, workspace, session (plus the project chooser is shown) |
| **New chat** | nothing — replaces the session after creating a new one |

Conversation content is never stored by the plugin; it belongs to PI WEB.

## Explicit open only

The Casual tab is a view of its own: it always renders the card and never redirects you into the chat. Only an explicit control opens the conversation.

`takeOpenIntent` decides per mount. The \u2042 button sets an intent (open, or return) when the panel has never rendered in this page load, because navigation requires a panel context; the mount consumes it once within a 5 second window. A Casual tab click sets nothing, so the tab can be visited at any time — including while a project chat is open — without moving you.

## The embedded chat

The Casual tab is an application panel, and PI WEB exposes no transcript component, so the panel embeds one: an iframe pointed at `casualChatUrl(...)` with `name="pi-web-casual-embed"` ([`panel.ts`](../src/browser/panel.ts)).

- `superviseEmbeddedChat` runs on a 300 ms pass for the life of the frame, plus once per `load`. One pass is not enough: the frame is its own SPA, so `chat-view` only exists after it boots, and Lit can recreate shell nodes after that.
- Each pass injects a persistent stylesheet into the frame's `pi-web-app` shadow root hiding `app-context-bar`, `app-mobile-main-tabs`, `app-navigation-panel`, `workspace-panel`, `status-bar`, and `navigation`, then hides the sibling branches above `chat-view` with inline styles. Persistent CSS handles chrome that is always present; the inline pass handles the plain header and any wrapper that only exists in some layouts.
- The walk starts at the lowest common ancestor of `chat-view` and `prompt-editor`, and only siblings of that branch are hidden. The transcript's own ancestors are never touched, so this code cannot hide the chat — which is why there is no rollback path.
- Supervision stops when the frame is disconnected or after five minutes, whichever comes first.
- `refreshCasualPointer` resolves the home through the catalog and re-patches the casual fields without navigating, so the frame follows the newest live session and a stale pointer cannot embed a route the host rejects.
- The frame runs a second PI WEB client. `startCasualHostBridge` returns early when `window.name` is the embed name, so the embedded app gets no sidebar filtering of its own.
- If the panel ever renders inside the embedded app, `isEmbeddedFrame()` makes it show the card instead of nesting another frame.

## The separate window

`openCasualInOwnTab` backs the palette action of the same name.

- `window.open("", "pi-web-casual-chat")` runs synchronously, before any `await`, because popup blockers only admit a window created inside the click gesture. The stable name means a second invocation focuses the existing tab instead of stacking new ones.
- The target is resolved with the same `resolveProject`/`discover` path as opening in place, and the window is then pointed at `casualChatUrl(...)` — the same `project`/`workspace`/`session`/`view=chat` route the one-time bootstrap reload uses ([`bootstrap.ts`](../src/browser/bootstrap.ts)).
- When there is no project, no session yet, or the window is blocked, the helper closes the blank window and falls back to `openCasual` in the current tab, so first run and session creation behave exactly as before.
- It is an ordinary tab: no custom close behavior, because the header button no longer exists ([ADR 0009](adr/0009-the-tab-replaces-the-header-button.md)).

`clickCasualTab` is still the last resort when the panel has never rendered in this page load, because navigation requires a context. That path sets `openIntentAt` (open) or `returnIntentAt` (return), mounts the tab, and lets `doOpenCasual` act as soon as it has a context — no reload, and only within a 5 second window. When the last attempt ended in a setup or error card, \u2042 only mounts the tab so the card can report the problem instead of retrying invisibly.

## Shadow-DOM integrations

PI WEB exposes no contribution point for hiding a project row or for a chat-only layout, so both are best-effort work on PI WEB's private shadow DOM, deliberately isolated in [`src/browser/dom.ts`](../src/browser/dom.ts):

- Host tags consulted: `app-context-bar`, `app-navigation-panel`, `workspace-panel`, `app-mobile-main-tabs`, `status-bar`, `navigation`, `chat-view`, `prompt-editor`.
- The Casual project row is hidden via `projects`/`selected` on the project-list component, so it also works when the section is collapsed. The `.section-count` text is rewritten to the visible project count.
- The embedded frame's chrome is hidden by a supervised pass, described above.
- If a PI WEB update changes markup, the **Casual** tab and the palette actions keep working. Update the selectors to restore the hidden row or the frame trimming.

## Compatibility

Browser API **v4**, so Casual runs on PI WEB `1.202610.3` and `1.202610.6+`. PI WEB `1.202610.6+` logs a deprecation warning for every API-v4 plugin, including its own bundled plugins; moving to API v5 would drop `1.202610.3` support. There is no server entry, no Pi extension, no analytics, and no third-party service.

The floor is enforced at activation, not at install: PI WEB's manifest has no host-version field, so it is the earliest point the plugin runs. `activate` throws when the host does not expose the browser selection service, which also catches `1.202610.1` — that release accepts `apiVersion: 4` but has no application panels, selection service, or project discovery, so the tab could never render. The host reports the throw as `Failed to register PI WEB plugin pi-web-casual during activate`, and none of the palette actions are registered.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/browser/index.ts` | Activation, tab, actions |
| `src/browser/casual.ts` | Project/workspace/session resolution, open/new flows, separate window, embedded-chat source |
| `src/browser/bootstrap.ts` | First-run project creation, trust, session creation, one-time reload |
| `src/browser/panel.ts` | Casual panel UI and card |
| `src/browser/dom.ts` | Host shadow-DOM bridge, hidden project row, embedded-frame supervision |
| `src/browser/store.ts` | Per-machine remembered state |
| `src/browser/types.ts` | Optional catalog contract used on newer hosts |

Generated `dist/browser` files are committed because PI WEB serves them directly from the installed package. CI verifies that the committed output matches source.

Bootstrap, project registration, and the shadow-DOM surface each have a recorded decision: [ADR 0003](adr/0003-browser-only-bootstrap-through-host-endpoints.md), [ADR 0005](adr/0005-best-effort-private-shadow-dom.md). The chat surface and scope are covered by [ADR 0001](adr/0001-one-long-running-conversation.md) and [ADR 0002](adr/0002-native-chat-not-an-agent-client.md); version support by [ADR 0004](adr/0004-stay-on-browser-plugin-api-v4.md); the separate window by [ADR 0007](adr/0007-casual-opens-in-its-own-window.md); the embedded chat by [ADR 0008](adr/0008-panel-embeds-the-chat-in-a-same-origin-frame.md); the removal of the header button by [ADR 0009](adr/0009-the-tab-replaces-the-header-button.md).

## Releasing

Maintainers publish manually through the **Publish to npm** workflow:

1. Add an `NPM_TOKEN` repository secret with npm publish rights.
2. Run **Actions → Publish to npm**. It defaults to a dry run.
3. Select the publish input to publish `pi-web-casual` with provenance.

The repository also runs CI (typecheck, build, committed-output check). See [CONTRIBUTING.md](../CONTRIBUTING.md) for the manual test checklist and pull-request expectations.
