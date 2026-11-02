# Casual

A PI WEB plugin that gives one long-running, project-free conversation a home outside the repository list.

## Language

### Objects

**Casual conversations**:
The hand­ful of PI WEB sessions Casual keeps in a numbered **strip**, one of them active at a time. All of them live in the home; none of them is a project.
_Avoid_: channel, thread, assistant, workspace

**Tab**:
One numbered entry in the **strip**. Its number is its position, and clicking it makes that conversation the active one.
_Avoid_: pin, slot, page

**Strip**:
The thin row at the top of the Casual tab holding the numbered tabs, the active tab's **×**, and the **+**.
_Avoid_: toolbar, header, tab bar

**Home**:
The PI WEB project named `Casual` at `~/.casual-pi-web`, created and trusted on first run. Casual keeps the project; the user never picks a workspace.
_Avoid_: folder, workspace, scratch repo

**Pointer**:
The remembered project, workspace, conversation strip, and active conversation in `localStorage` under `pi-web-casual:store:v2`, stored per machine.
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
Create another session in the home, append it to the strip, and make it the active tab. Previous conversations are untouched.
_Avoid_: reset, restart, clear

**Archive a conversation**:
What the **×** on the active tab does: PI WEB's own archive action, so the conversation moves to the host's **Archived** sessions and can be restored there. Casual never deletes.
_Avoid_: close, delete, remove

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

**Tab status**:
What the **Casual** tab's **⁂** reports in PI WEB's own colors: green while the agent is working in the home, accent while a finished reply is still unread, and untinted when nothing is in flight. The tab's tooltip and accessible name carry the same state.
_Avoid_: badge, counter, notification number

**Best-effort chrome**:
Plugin behavior that relies on PI WEB's private shadow DOM rather than a public contribution point: the hidden project row, the tab status, and the embedded frame's chrome trimming.
_Avoid_: hack, monkey patch
