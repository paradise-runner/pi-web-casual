# How Casual works

This page is for contributors, maintainers, and anyone debugging Casual. For day-to-day usage, see [Using Casual](using-casual.md); for vocabulary, [GLOSSARY.md](../GLOSSARY.md); for the reasoning behind the shape of the plugin, [docs/adr/](adr/).

## Design in one paragraph

Casual is a browser-only PI WEB plugin that adds a single long-running conversation outside any repository. It does not implement an agent client: the chat you see is PI WEB's native chat, which is why streaming, tools, images, model selection, and compaction behave exactly like everywhere else. The plugin's job is small and specific — create and hide a home project, remember which session to show, and present that conversation in the Casual tab.

## What the plugin contributes

| Contribution | Where | Source |
| --- | --- | --- |
| **Casual** application panel (tab) | PI WEB tab bar, desktop and mobile | [`src/browser/index.ts`](../src/browser/index.ts), [`panel.ts`](../src/browser/panel.ts) |
| Palette actions — *Open Casual Chat*, *New Casual Chat*, *Reset Casual Link*, *Change Casual Home*, *Set Up Casual Chat* | Actions palette, group "Casual" | [`src/browser/index.ts`](../src/browser/index.ts) |
| Shared strip | `~/.casual-pi-web/.pi-web/casual/state.json` on the host | [`src/browser/shared.ts`](../src/browser/shared.ts) |
| Hidden project row | Sidebar **Projects** list | [`src/browser/dom.ts`](../src/browser/dom.ts) |
| Tab status color | **Casual** tab icon, desktop and mobile | [`src/browser/activity.ts`](../src/browser/activity.ts), [`dom.ts`](../src/browser/dom.ts) |
| Unread acknowledgement | Host session routes, when the reply has been read in the tab | [`src/browser/activity.ts`](../src/browser/activity.ts), [`panel.ts`](../src/browser/panel.ts) |
| Embedded chat | Casual tab, same-origin frame | [`src/browser/panel.ts`](../src/browser/panel.ts) |
| Conversation strip | Top of the Casual tab: numbered tabs, **+**, **×** | [`src/browser/panel.ts`](../src/browser/panel.ts), [`casual.ts`](../src/browser/casual.ts) |
| In-place conversation switch | The frame's own history routing | [`src/browser/dom.ts`](../src/browser/dom.ts) |

Everything else is navigation into PI WEB's own screens.

## Tab status

The **Casual** tab's **⁂** carries the same agent signal a project row would have carried before it was hidden: green (`--pi-success`) while a session in the home is working, accent (`--pi-accent`) while a finished reply is unread, and no tint when nothing is in flight.

- The state comes from the host's machine status snapshot, read from `api/machines/<machineId>/status` for every machine that has a pointer, every four seconds while the page is visible. That endpoint is internal, on the same footing as first-run project creation; the public catalog cannot express "unread" and does not exist on `1.202610.3` ([ADR 0010](adr/0010-the-tab-reports-agent-activity.md)).
- `core:working` and `core:unread` are read from the casual project's node. A project missing from the snapshot has nothing in flight. Any machine working wins over any machine unread.
- The accent is cleared when the reply has been read, not left on the tab. PI WEB clears an unread completion by itself only for chats whose own document has focus, and the conversation here lives in the panel's embedded frame, so the panel acknowledges the completion through `api/machines/<machineId>/sessions/unread` and `.../unread/acknowledge` when the tab is the surface on screen in a focused page. The acknowledgement echoes the catalog epoch and the completion order it saw, and a host without those routes simply keeps the older coloring.
- The color reaches the plugin's own icon markup as a custom property (`--pi-web-casual-tab-color`) set on the document root, so no host-owned style or class is rewritten. The tab's `title` and `aria-label` are set for the same states and restored from the host's values, so the signal is not color-only.
- A snapshot that cannot be read leaves the last state painted; a hidden document does not poll and refreshes on `visibilitychange`, and the window regaining focus runs a pass too.
- The embedded frame returns early, so it costs no extra requests.

## First run

The public plugin API cannot register a project, so first run uses the host's own same-origin endpoints (`api/machines/<machineId>/...`) to:

1. create and trust the project at `~/.casual-pi-web` (created with `create: true`, expanded by the host),
2. create the first workspace session,
3. write the remembered pointer and publish the strip,
4. reload the page once into the Casual tab (`tool=pi-web-casual:casual&view=workspace`), which then embeds that conversation.

If those requests fail, the panel falls back to a setup card where you can add `~/.casual-pi-web` yourself or choose an existing project as the home. Code: [`src/browser/bootstrap.ts`](../src/browser/bootstrap.ts).

The folder lives on the machine that hosts PI WEB, which is why the strip is stored per machine — but no longer per browser (see [The shared strip](#the-shared-strip)).

## The conversation strip

Above the frame the panel renders a thin strip of numbered conversations ([`panel.ts`](../src/browser/panel.ts)): `role="tablist"`, one `role="tab"` button per conversation, the active tab's **×**, and a **+** pinned right.

- Numbers are positions in the stored strip, oldest first. **+** appends and activates; **×** archives and activates the neighbour.
- The **+** does not navigate the host page and does not depend on the sidebar. It starts a session through the same session route first run uses ([`bootstrap.ts`](../src/browser/bootstrap.ts)), then records it as the active tab, so the panel only re-renders. **New Casual Chat** in the palette runs the same code and then brings the Casual tab forward, so a conversation started from anywhere lands in the tab that holds the strip.
- Starting a session is the host's own `POST api/machines/<machineId>/sessions` with the home's workspace path. The older selection-service path (select the workspace, click the sidebar's **+**, wait for the snapshot) is gone: it needed the host page to move to the home first, which is exactly what "everything in the tab" rules out.
- The **×** calls the host's session lifecycle route, `api/machines/<machineId>/plugin-sessions/projects/<projectId>/workspaces/<workspaceId>/sessions/<sessionId>/archive`. That is the route behind PI WEB's own archive action, so the conversation moves to the host's **Archived** sessions and stays restorable; the plugin still has no delete of its own. A conversation that was started and never written to disk has no session file to archive, so its tab is dropped and nothing is reported. A host without the route leaves the conversation alone, and the strip says so.
- Archiving puts an **Undo** in the strip for the rest of the visit, which calls the same route's `.../restore` and inserts the tab back at its old index. That matters because the home project row is hidden: the host's **Archived** list is not reachable from Casual without uncovering the project.
- The strip's state lives in the pointer, not in the DOM. Every write normalizes the record, so making a conversation active also persists its tab; before that, a tab could be drawn from the in-memory record and never reach storage, which left the strip and the pointer disagreeing and made tab clicks look dead.
- Every write is also published to the shared copy (see below), so the strip exists in one place and every browser on the machine reads the same list.
- A conversation that this page load started is remembered until reload (`startedHere`), because the catalog and the host's session list only know a session once it has written a file. Without it, a refresh pass could prune the tab of a conversation that had just been started and pull the user back to an older one mid-typing.
- Failures inside the strip are reported in the strip (`role="status"`), not in the card: a failed tab action must never replace the chat on screen.
- The keyboard follows the tablist pattern: ←/→/Home/End move the selection and open the tab they land on, and only the active tab is in the tab order.

## Switching conversations without reloading

`switchEmbeddedChat` ([`dom.ts`](../src/browser/dom.ts)) points the mounted frame at another conversation instead of recreating it:

1. `frame.contentWindow.history.pushState` to the conversation's route, then a synthetic `popstate` — the same events the host's own router consumes. Measured: the frame's document survives and its selection changes, so there is no SPA boot, no second daemon connection, and the transcript scroll position belongs to the conversation you return to.
2. The result is verified through the host's own selected-session marker (`[data-session-id].selected` in the frame's session list), which changes as soon as the route does — unlike the transcript, which takes as long as it takes to load.
3. If the host did not act on the event, the frame's `src` is set instead, so the tab still switches after one page load.

This is private host behavior on the same footing as the chrome trimming (ADR 0005). A host that stops routing on `popstate` costs a reload per switch, not a broken tab.

Because the template keeps the `src` the frame was mounted with, a host re-render never reloads the embedded chat; the panel reads the frame's own URL to decide whether a switch is needed.

## Finding the conversation

Two discovery paths, in order of preference ([`src/browser/casual.ts`](../src/browser/casual.ts)):

- **The public catalog**, when the host hands one to the plugin. API-v4 plugins do not get it (`PluginDiscoveryContext` is a v5 addition), so in practice this path is dormant: the plugin keeps it because it is the supported route if the plugin moves to v5.
- **The host's own routes** — `GET api/machines/<machineId>/projects` for the home, `GET .../projects/<projectId>/workspaces` for its workspace, and `GET .../sessions?cwd=<home>` for live sessions, which is also where names come from. Since discovery is authoritative about which conversations still exist, a stale tab is dropped on the next sync.

If a new session can't be created at all, the panel shows an error card explaining how to open the casual workspace and press **+** next to **Sessions** manually.

## The shared strip

The strip and the active conversation are stored with the home, in `~/.casual-pi-web/.pi-web/casual/state.json`, so every browser that points at the same machine shows the same conversations ([ADR 0012](adr/0012-the-strip-is-shared-through-the-home.md)). PI WEB has no plugin key/value store, so the plugin uses the host's workspace file route, the same family of routes first run uses:

| Step | Request |
| --- | --- |
| Read | `GET api/machines/<machineId>/projects/<projectId>/workspaces/<workspaceId>/file?path=.pi-web/casual/state.json` |
| Write | `PUT` the same URL with `content-type: text/plain`, `createDirs=true`, `overwrite=true` |

`sharedStateOf` in [`src/browser/shared.ts`](../src/browser/shared.ts) is the file:

```json
{ "version": 1, "updatedAt": 1793718461543, "tabs": [{ "sessionId": "…", "addedAt": 1793716593344 }], "sessionId": "…" }
```

- **Sync points.** Every panel render (throttled to 2.5 s), window focus, `visibilitychange`, and every palette flow. [`syncCasualHome`](../src/browser/casual.ts) resolves the home, reads the file, and settles locally; the panel re-renders only when something actually changed.
- **Which copy wins.** A record carries `updatedAt`. If the file's stamp is newer than the local one, the browser adopts the file — that is how a conversation picked on the phone becomes the one the computer shows. Otherwise the browser keeps its own copy and publishes it when the shared content differs. A write that only refreshes a name or resolves a folder passes `touch: false`, so it never claims to be the newer strip and two open devices settle instead of echoing.
- **One write at a time.** The shared read is a round trip, so a tab click can land while it is in flight. `applySync` re-reads the record before writing and gives way (up to three times) instead of undoing the click with an older snapshot.
- **The host is the truth about existence.** `reconcile` drops tabs the host's live list no longer has, repoints an active conversation that is gone, and refreshes names from the host. A tab added elsewhere is protected for ten minutes by `addedAt`, because a session has no file until its first message. Sessions that are live but not in the strip are never appended: **Reset link** has to stay a reset.
- **Seeding.** An empty strip is never published as the first copy, so a browser with no Casual history cannot overwrite the strip another device already knows. The file appears with the first conversation, or with the first browser that already had a strip.
- **Failure is soft.** A host without the route answers `404`; a home with no file answers `400 "Path does not exist"`, which is remembered as missing for the rest of the page load so it costs one request. Either way the plugin keeps working on its `localStorage` copy, which is also what paints the tab before the first read completes.

## Remembered state

The local **pointer** lives in `localStorage` under `pi-web-casual:store:v2` ([`src/browser/store.ts`](../src/browser/store.ts)) and holds the project, workspace, the conversation strip, the active conversation, and the stamp of the last local change. It is the fast copy and the fallback; the strip in it is published to the shared file above.

| Control | Fields cleared |
| --- | --- |
| **Reset link** | workspace, session, strip |
| **Change home** | project, workspace, session, strip (plus the project chooser is shown) |
| **New chat** | nothing — appends the new session and makes it active |
| **×** | that one tab (the conversation is archived, not deleted; **Undo** restores it) |

`tabs` arrived after the first release, so a record written before the strip existed holds only the remembered session; reads normalize it into a one-tab strip. The active session is always one of the tabs, and the strip is read back through `readCasualTabs`, where a tab's number is its index.

Conversation content is never stored by the plugin; it belongs to PI WEB.

## Opening, from the palette or the card

`openCasual` never navigates the host page. It resolves the home, creates the first conversation if the home has none, and brings the Casual tab forward; the panel then embeds whatever conversation the pointer names.

- A **palette action** has a runtime context, which cannot render anything. It asks the host to select the plugin's tool (`selectWorkspaceTool`, the public call behind clicking a tool tab), so the project, workspace, and session in the URL are untouched and the project chat in the main column keeps its place.
- A palette flow runs *after* that render, so the panel cannot be repainted by the context that started it. `keepFlowStatusFresh` in [`panel.ts`](../src/browser/panel.ts) asks the panel's own host for a render every 350 ms while a flow reports it is working, and stops as soon as it is not. A flow in progress does not replace the chat on screen: the strip reports it, and the chat stays usable.
- Inside the panel the same calls are no-ops for navigation, and the panel's own `host.requestRender()` does the repainting.

## The embedded chat

The Casual tab is an application panel, and PI WEB exposes no transcript component, so the panel embeds one: an iframe pointed at `casualChatUrl(...)` with `name="pi-web-casual-embed"` ([`panel.ts`](../src/browser/panel.ts)).

- `superviseEmbeddedChat` runs on a 300 ms pass for the life of the frame, plus once per `load`. One pass is not enough: the frame is its own SPA, so `chat-view` only exists after it boots, and Lit can recreate shell nodes after that.
- Each pass injects a persistent stylesheet into the frame's `pi-web-app` shadow root hiding `app-context-bar`, `app-mobile-main-tabs`, `app-navigation-panel`, `workspace-panel`, `status-bar`, and `navigation`, collapsing the shell grid to the one chat column so no empty tracks remain, then hides the sibling branches above `chat-view` with inline styles. Persistent CSS handles chrome that is always present; the inline pass handles the plain header and any wrapper that only exists in some layouts.
- The inline pass never trims a branch that is showing an open native dialog or popover. PI WEB renders its pickers beside the chat rather than inside it, so the thinking-level and model pickers, the command dialog, the session tree, and the auth sheet are all siblings of the conversation layout: trimming their branch closed them the moment they opened. Detection walks the branch across shadow roots, and a branch hidden before its dialog opened is given back on the next pass.
- The frame fills the panel's flex area (`height: 100%`) instead of subtracting a viewport offset, so the embedded composer sits on the panel's bottom edge at any window height.
- Inside the frame the app is pinned to the frame's own viewport (`position: fixed; inset: 0`) with no safe-area padding of its own. As a top-level page the app measures itself against the browser window — `100dvh`, plus the home-indicator inset in an installed app — and both are already applied by the page around the frame. Left to itself the embedded copy padded the composer a second time for the home indicator, so on a phone the chat sat above the panel's bottom edge with a dead strip under it; the pin also keeps the composer in place when a frame's `dvh` is stale during an address-bar or keyboard change.
- The walk starts at the lowest common ancestor of `chat-view` and `prompt-editor`, and only siblings of that branch are hidden. The transcript's own ancestors are never touched, so this code cannot hide the chat — which is why there is no rollback path. A sibling that is currently showing a dialog or popover is skipped, because that sibling is a surface the user opened rather than chrome.
- Supervision stops when the frame is disconnected or after five minutes, whichever comes first.
- `syncCasualHome` resolves the home and the shared strip without navigating, so the frame follows the active conversation another device chose and a stale pointer cannot embed a route the host rejects.
- The frame runs a second PI WEB client. `startCasualHostBridge` and `startCasualActivityBridge` both return early when `window.name` is the embed name, so the embedded app gets no sidebar filtering and no status requests of its own.
- If the panel ever renders inside the embedded app, `isEmbeddedFrame()` makes it show the card instead of nesting another frame.

## One surface

There is no separate window ([ADR 0013](adr/0013-everything-happens-in-the-casual-tab.md)): the strip's **+**, the palette's **New Casual Chat**, and the card's **New chat** all start a conversation in the same home and make it the active tab, and every entry point ends in the Casual tab.

## Shadow-DOM integrations

PI WEB exposes no contribution point for hiding a project row, for a status color on an application tab, or for a chat-only layout, so all three are best-effort work on PI WEB's private shadow DOM, deliberately isolated in [`src/browser/dom.ts`](../src/browser/dom.ts):

- Host tags consulted: `app-context-bar`, `app-navigation-panel`, `workspace-panel`, `app-mobile-main-tabs`, `status-bar`, `navigation`, `chat-view`, `prompt-editor`.
- The Casual project row is hidden by a stylesheet injected into the project-list shadow root (marked `data-pi-web-casual-project-style`), so it is hidden from its first paint on every render after activation. The pass that keeps it that way runs from a `MutationObserver` on the host's shadow roots, whose callbacks land before the browser paints, plus a one-second interval as a safety net for newly created shadow roots. A cold page load can still paint the row for the moment between the sidebar's first render and plugin activation, because nothing in the package runs earlier.
- The `.section-count` text and the collapsed-heading summary are rewritten from script, since CSS cannot subtract a row from a number or blank a summary. The count is formatted with the document's language so the corrected text does not oscillate against the host's own formatting.
- The **Casual** tab's status tint is the same custom property set on the document root that ADR 0010 describes; the tab's `title` and `aria-label` are the only host-owned attributes the plugin writes, and they are recorded before the first write and restored when nothing is in flight.
- The embedded frame's chrome is hidden by a supervised pass, described above.
- If a PI WEB update changes markup, the **Casual** tab and the palette actions keep working. Update the selectors to restore the hidden row, the frame trimming, or the tint.

## Compatibility

Browser API **v4**, so Casual runs on PI WEB `1.202610.3` and `1.202610.6+`. PI WEB `1.202610.6+` logs a deprecation warning for every API-v4 plugin, including its own bundled plugins; moving to API v5 would drop `1.202610.3` support. There is no server entry, no Pi extension, no analytics, and no third-party service.

The plugin talks to host routes it does not own: `api/machines/<machineId>/projects` (and workspaces, trust, sessions) on first run ([ADR 0003](adr/0003-browser-only-bootstrap-through-host-endpoints.md)), the workspace file route for the shared strip ([ADR 0012](adr/0012-the-strip-is-shared-through-the-home.md)), `api/machines/<machineId>/status` for the tab's tint, and the unread catalog with its acknowledgement when a finished reply has been read ([ADR 0010](adr/0010-the-tab-reports-agent-activity.md)). All are same-origin and all fail soft: first run falls back to the setup card, the tint keeps its last state, and an unread completion stays unread. The status flags (`core:working`, `core:unread`) have existed at project level since PI WEB `1.202608.1`, which is older than the plugin's floor.

The floor is enforced at activation, not at install: PI WEB's manifest has no host-version field, so it is the earliest point the plugin runs. `activate` throws when the host does not expose the browser selection service, which also catches `1.202610.1` — that release accepts `apiVersion: 4` but has no application panels, selection service, or project discovery, so the tab could never render. The host reports the throw as `Failed to register PI WEB plugin pi-web-casual during activate`, and none of the palette actions are registered.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/browser/index.ts` | Activation, tab, actions |
| `src/browser/casual.ts` | Project/workspace/session resolution, the shared-strip sync, open/new flows, embedded-chat source |
| `src/browser/shared.ts` | The strip as every browser on the machine sees it: read, write, and the shape of the host file |
| `src/browser/bootstrap.ts` | First-run project creation, trust, session creation, one-time reload |
| `src/browser/panel.ts` | Casual panel UI and card |
| `src/browser/activity.ts` | Agent state for the Casual tab, read from the host status snapshot, plus the unread acknowledgement |
| `src/browser/dom.ts` | Host shadow-DOM bridge, hidden project row, tab status, embedded-frame supervision |
| `src/browser/store.ts` | Per-browser copy of the remembered state |
| `src/browser/types.ts` | Optional catalog contract (unused on API v4), plus the status fields the tab reads |

Generated `dist/browser` files are committed because PI WEB serves them directly from the installed package. CI verifies that the committed output matches source.

Bootstrap, project registration, and the shadow-DOM surface each have a recorded decision: [ADR 0003](adr/0003-browser-only-bootstrap-through-host-endpoints.md), [ADR 0005](adr/0005-best-effort-private-shadow-dom.md). The chat surface and scope are covered by [ADR 0001](adr/0001-one-long-running-conversation.md) and [ADR 0002](adr/0002-native-chat-not-an-agent-client.md); version support by [ADR 0004](adr/0004-stay-on-browser-plugin-api-v4.md); the shared strip by [ADR 0012](adr/0012-the-strip-is-shared-through-the-home.md) and one-surface Casual by [ADR 0013](adr/0013-everything-happens-in-the-casual-tab.md) (which supersedes [ADR 0007](adr/0007-casual-opens-in-its-own-window.md)); the embedded chat by [ADR 0008](adr/0008-panel-embeds-the-chat-in-a-same-origin-frame.md); the removal of the header button by [ADR 0009](adr/0009-the-tab-replaces-the-header-button.md); the tab's status color by [ADR 0010](adr/0010-the-tab-reports-agent-activity.md).

## Releasing

Maintainers publish manually through the **Publish to npm** workflow:

1. Add an `NPM_TOKEN` repository secret with npm publish rights.
2. Run **Actions → Publish to npm**. It defaults to a dry run.
3. Select the publish input to publish `pi-web-casual` with provenance.

The repository also runs CI (typecheck, build, committed-output check). See [CONTRIBUTING.md](../CONTRIBUTING.md) for the manual test checklist and pull-request expectations.
