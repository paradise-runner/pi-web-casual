# Using Casual

Casual is one ongoing PI WEB conversation that is not tied to a repository. This page covers first run, every control, and what to do when a conversation goes missing. Vocabulary is defined in [GLOSSARY.md](../GLOSSARY.md); installation is in the [README](../README.md#install).

## First run

1. Open the **Casual** tab, or **Actions → Casual → Open Casual Chat**. On a fresh install the tab shows a small setup card; **Open chat** starts the one-time setup.
2. Casual creates and trusts `~/.casual-pi-web`, starts the first session, and reloads the page once into that chat.
3. Type in the normal composer. Streaming, Markdown, tools, images, model selection, and compaction all work as usual.

There is no **Add Project** step and no workspace to choose: the home project and its workspace are created and remembered for you.

The reload is one-time. PI WEB has no plugin API for registering a project, so first run uses the host's own same-origin endpoints; the host needs a reload to show the new project. After that, opening Casual is an in-app navigation.

If those endpoints are unreachable, the panel shows a setup card instead. Add `~/.casual-pi-web` through **Add Project** or pick an already-registered project as the home, then retry.

## Entry points

| Where | Control | Result |
| --- | --- | --- |
| Tab bar | **Casual** tab | Embeds the casual chat, or shows the card when something needs attention |
| Anywhere | **Actions → Casual → Open Casual Chat** | Opens the conversation as a full view in the current tab |
| Anywhere | **Actions → Casual → Open Casual Chat in Its Own Tab** | Opens or focuses the separate window |
| Anywhere | **Actions → Casual → New Casual Chat** | Starts a fresh conversation |
| Anywhere | **Actions → Casual → Reset Casual Link**, **Change Casual Home**, **Set Up Casual Chat** | Recovery and setup |

## The Casual tab

The Casual tab is a chat surface of its own. Once a conversation is remembered it embeds the real PI WEB chat in a same-origin frame, with that frame's navigation, header, and workspace columns hidden, so the chat fills the tab and your project chat in the main column keeps working beside it.

The tab's **⁂** also reports what the conversation is doing, using the same colors as the sidebar's dots: green while the agent is working, accent while a finished reply is waiting for you, and untinted when nothing is in flight. The tooltip and screen-reader name say the same thing, so the state does not depend on seeing the color.

There is no toolbar, header, or card around it: the chat is the tab. The frame's chrome trimming is verified as it loads, and if the chat does not come out usable the frame falls back to a full app rather than an empty box — in that case use **Actions → Casual → Open Casual Chat** for a full view.

Setup, opening, and error states replace the frame with their card, because those need controls rather than a transcript. Everything else you might reach for is a palette action:
**Open Casual Chat** (full view in this tab), **Open Casual Chat in Its Own Tab**, **New Casual Chat**, **Reset Casual Link**, and **Change Casual Home**.

## Its own window

The frame is a chat; the separate window is the full experience. **Actions → Casual → Open Casual Chat in Its Own Tab** opens the conversation in a dedicated browser tab and leaves whatever you are doing untouched:

- The window has a stable name, so opening it again focuses the same window instead of stacking tabs.
- It is an ordinary tab: close it when you are done.
- If a popup blocker stops the window, or the home has no session yet, Casual opens in the current tab instead and the one-time setup proceeds normally.

## The card

The card appears when the tab has something to report rather than a conversation to show: nothing remembered yet, setup needing input, an error, or a chat that cannot be embedded. It never redirects you anywhere on its own.

| Card state | Contents |
| --- | --- |
| **Ready when you are** | **Open chat**, **Open in its own tab**, **Open Actions** — no conversation remembered on this machine yet |
| **Setup** | **Retry**, **Open Actions**, and a chooser of registered projects |
| **Error** | **Retry**, **Open Actions**, **Reset link**, **Change home** |
| **Embedded chat** | The chat alone, filling the tab |

## Controls

- **Open chat** — resolve the home and open the remembered session in this tab as a full view.
- **Open in its own tab** — open or focus the separate window, leaving this tab alone (card states only).
- **New chat** — create another session in the home and make it the remembered one. Nothing is deleted; the previous conversation stays in **Sessions**.
- **Reset link** — clear the remembered workspace and session, keep the home, and reopen so the newest live casual session is chosen. Use it when the pointer is stale and reopening keeps failing.
- **Change home** — clear the remembered project as well and show the project chooser, including the hidden `Casual` project if you want to come back.
- **Retry** — run the open flow again with the same state.

The palette carries the everyday actions — **Open Casual Chat**, **Open Casual Chat in Its Own Tab**, **New Casual Chat**, **Reset Casual Link**, **Change Casual Home**, **Set Up Casual Chat** — and works the same on desktop and mobile.

## Starting a new conversation

1. Open **Actions** (⚡ on mobile).
2. Choose **Casual → New Casual Chat**.

Either way the new session becomes the one the tab embeds, and the previous conversation remains in **Sessions** under the `Casual` project.

## History and storage

- The conversation is a normal PI WEB session in the project `Casual` at `~/.casual-pi-web`.
- That project's row and count are filtered out of the **Projects** sidebar, and the row does not appear when the section is expanded or the sidebar is redrawn. The project still exists: it appears in the **Change home** chooser, and its sessions appear in **Sessions** while it is selected.
- The plugin remembers the project, workspace, and session in `localStorage` under `pi-web-casual:store:v2`, per machine. Conversation content is never stored by the plugin.
- A second machine has its own pointer and finds or creates its own casual session.

## Recovery

| Situation | What to do |
| --- | --- |
| Casual never appears after install | PI WEB is older than `1.202610.3`. The browser console shows `PI WEB Casual requires PI WEB 1.202610.3 or newer`; update PI WEB, then reload the browser. |
| The conversation seems gone | Open Casual again. It prefers the remembered session and otherwise takes the newest non-archived session in the home. |
| The remembered session was archived or deleted | Same: opening Casual replaces the stale pointer with the newest live session. |
| The card keeps showing an error | **Retry** once, then **Reset link**, then reopen. |
| The card keeps showing setup | Add `~/.casual-pi-web` through **Add Project**, or choose an existing project as the home. |
| You want a clean start | **New Casual Chat**. Previous conversations stay in **Sessions**. |
| Casual should live elsewhere | **Change home** and pick a folder or project. |
| The Casual project row reappeared in the sidebar | A PI WEB update changed its private markup, or the page is still loading and the plugin has not run yet. If it stays visible, the Casual tab and palette still work; see [issue tracker](https://github.com/paradise-runner/pi-web-casual/issues). |
| The Casual tab never changes color | PI WEB changed the status endpoint or flags the tab reads, or the page is a host without them. Casual keeps working; the tab simply stays untinted. |

## Privacy

A casual conversation is an ordinary PI WEB session stored on the host machine. Messages go to the model provider configured for PI WEB, exactly as in any other chat. Casual adds no analytics, no telemetry, no third-party requests, and no server process.
