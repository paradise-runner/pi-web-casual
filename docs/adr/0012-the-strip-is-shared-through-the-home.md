# The strip is stored with the home, so every browser sees it

> Supersedes the "per-machine pointer" consequence of [ADR 0003](0003-browser-only-bootstrap-through-host-endpoints.md), and narrows [ADR 0011](0011-conversations-in-a-strip.md) to a strip shared by every browser that points at the machine.

The strip lived in `localStorage`, so it was per *browser*, not per home. The conversations themselves were always on the host — they are ordinary PI WEB sessions in `~/.casual-pi-web` — but each browser kept its own list and its own active conversation. Opening Casual from the phone found the home and created or picked a session there, while the computer kept showing a different list; the two devices never agreed on what the strip was.

PI WEB has no public storage for a browser plugin: no key/value store, no server entry (ADR 0003 keeps the plugin browser-only), and no way for a browser plugin to write session metadata (only a hosted Pi extension publishes that). The one durable, same-origin place the plugin can both read and write is the home's own workspace, through the host's workspace file route — the same family of routes first run already uses.

So the strip and the active conversation are saved in `~/.casual-pi-web/.pi-web/casual/state.json`, next to PI WEB's other plugin data (`.pi-web/relays`, `.pi-web/uploads`):

```json
{
  "version": 1,
  "updatedAt": 1793718461543,
  "tabs": [{ "sessionId": "…", "addedAt": 1793716593344, "sessionName": "…" }],
  "sessionId": "…"
}
```

- **Newest write wins.** Every change to the strip or the active conversation bumps `updatedAt` and rewrites the file. A browser whose local copy is older adopts the file's strip and active conversation; a browser whose copy is newer publishes it. A write that only refreshes a name or resolves a folder does not bump the clock, so two open devices settle instead of echoing each other.
- **The file is the strip; the host is the truth about existence.** On every sync, tabs whose conversation the host no longer has are dropped, the active one falls back to a live one, and names come from the host's session list. New conversations are never invented from the host list: a session that is not in the strip stays in **Sessions**, so **Reset link** really resets.
- **A conversation another device just added is protected.** `addedAt` gives a tab a ten-minute grace period, because a session has no file until its first message and the host's list cannot see it yet.
- **`localStorage` stays as the local copy.** It paints instantly, it is what the tab needs before the first read completes, and the plugin still works when the host's file route is unreachable — the strip then simply stays per browser, as it was. The shared copy is seeded from it on first run after the upgrade, so an existing strip migrates without a step.
- **Nothing sensitive is published.** The file holds session ids, their names, and the order. Conversation content stays in PI WEB's own session storage.
- **Sync points:** every panel render (throttled to 2.5 s), every window focus and visibility change, and every palette flow. Reading is a single small `GET`; the write is a single `PUT`.

## Consequences

- The phone and the computer show the same conversations, in the same order, with the same one open, when both talk to the same machine. That is the whole point of the change.
- The state now depends on the host's workspace file route (`api/machines/<machineId>/projects/<projectId>/workspaces/<workspaceId>/file`) rather than only on `localStorage`. When the route is missing or fails, the plugin keeps working per browser and says nothing: the strip is a nicety, not a load-bearing link.
- A home with no file yet answers `400` rather than `404` from that route, so a missing file is asked for once per page load and then remembered as missing until the plugin writes it.
- Seeding is one-way per home: the first browser to write the file decides the strip, and the others adopt it. Two devices that each had their own strip before the upgrade keep one of them; the conversations in the other are still in **Sessions**.
- Two devices editing at the same moment resolve by timestamp, last write wins. There is no merge and no conflict dialog: this is one person's casual chat list, not a shared document.
- `sessionName` rides along in the file for readability, but the host's list is authoritative on every sync.
- Browsers on *different* machines still keep separate strips, because each machine has its own home folder.
