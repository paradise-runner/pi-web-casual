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
What the Casual tab shows when it has something to report instead of a chat: first run, setup, or an error. It carries **Open chat**, **Open Actions**, and the recovery controls.
_Avoid_: panel UI, widget, sidebar

**Entry point**:
One of the ways into the chat: the Casual tab, or a palette action.
_Avoid_: launcher, shortcut

### Operations

**Open**:
Resolve the home, discover its workspaces and sessions, remember the chosen session, and navigate to it.
_Avoid_: launch, load, restore

**Casual window**:
The separate browser tab opened from the palette by name (`pi-web-casual-chat`), so Casual can sit beside a project chat. Opening it again focuses that window instead of stacking tabs.
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
Plugin behavior that relies on PI WEB's private shadow DOM rather than a public contribution point: the hidden project row and the embedded frame's chrome trimming.
_Avoid_: hack, monkey patch
