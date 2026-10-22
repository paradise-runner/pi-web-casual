# Casual

A PI WEB plugin that gives one long-running, project-free conversation a home outside the repository list.

## Language

### Objects

**Casual chat**:
The one PI WEB session Casual reopens by default. A normal session in the home project, with no special storage.
_Avoid_: channel, thread, assistant

**Home**:
The PI WEB project named `Casual` at `~/.casual-pi-web`, created and trusted on first run. Casual keeps the project; the user never picks a workspace.
_Avoid_: folder, workspace, scratch repo

**Pointer**:
The remembered project, workspace, and session in `localStorage` under `pi-web-casual:store:v2`, stored per machine.
_Avoid_: config, state, cache

**Card**:
The content of the Casual tab and its only view: it reports status and carries **Open chat**, **New chat**, **Reset link**, and **Change home**. The tab never redirects out of it.
_Avoid_: panel UI, widget, sidebar

**Entry point**:
One of the ways into the chat: the ⁂ button, **Open chat** on the card, the action palette. The Casual tab itself is not one.
_Avoid_: launcher, shortcut

**Project chat**:
The conversation on the other side of the toggle: whichever project, workspace, and session was selected when Casual last opened. Not a Casual concept the plugin stores beyond that point.
_Avoid_: normal chat, main chat

**Return point**:
The project, workspace, and session captured when Casual opens, stored per machine, used by the toggle in the current tab (and as a fallback inside the Casual window) to come back.
_Avoid_: bookmark, resume, last session

### Operations

**Open**:
Resolve the home, discover its workspaces and sessions, remember the chosen session, and navigate to it.
_Avoid_: launch, load, restore

**Toggle**:
The ⁂ button's two-sided action: open Casual in its own window from a project chat, or return to your project chat from Casual — by closing that window when Casual opened it, otherwise by navigating. **Open chat** and the palette action only ever open; the tab never navigates.
_Avoid_: switch, swap, flip

**Casual window**:
The separate browser tab Casual opens by name (`pi-web-casual-chat`) so a project chat stays visible. Later presses focus it instead of stacking tabs, and **⁂** inside it closes it.
_Avoid_: popup, side panel, split view

**Embedded chat**:
The chat the Casual tab shows in place: a same-origin frame pointed at the casual chat route, named `pi-web-casual-embed`, with that frame's own navigation and header hidden.
_Avoid_: preview, mini app, iframe view

**New chat**:
Create another session in the home and make it the remembered one. Previous sessions are untouched.
_Avoid_: reset, restart, clear

**Reset link**:
Clear the remembered workspace and session but keep the home, then open again so the newest live session is chosen.
_Avoid_: logout, sign out, wipe

**Change home**:
Clear the remembered project as well, then show the project chooser.
_Avoid_: switch workspace, disconnect

**Bootstrap**:
The first-run sequence that creates and trusts `~/.casual-pi-web`, starts a session, and reloads the page once.
_Avoid_: setup wizard, installer

### Surfaces

**Hidden project row**:
The `Casual` row filtered out of the **Projects** sidebar, including the project count. The project itself still exists for PI WEB.
_Avoid_: deleted project, orphan project

**Best-effort chrome**:
Plugin UI that relies on PI WEB's private shadow DOM rather than a public contribution point: the ⁂ button and the hidden row.
_Avoid_: hack, monkey patch

**Explicit-open intent**:
The short-lived flag set by an explicit control (⁂, **Open chat**, the palette) when the panel has not rendered yet, so the mount can open or return once it has a navigation context. A Casual tab click never sets it.
_Avoid_: auto-open, redirect, hijack check
