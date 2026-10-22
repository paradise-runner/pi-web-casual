# Using Casual

Casual is one ongoing PI WEB conversation that is not tied to a repository. This page covers first run, every control, and what to do when a conversation goes missing. Vocabulary is defined in [GLOSSARY.md](../GLOSSARY.md); installation is in the [README](../README.md#install).

## First run

1. Click **⁂**, **Open chat** on the Casual card, or **Actions → Casual → Open Casual Chat**. With nothing selected, **⁂** opens the Projects list instead; use the card or the palette action on a fresh install.
2. Casual creates and trusts `~/.casual-pi-web`, starts the first session, and reloads the page once into that chat.
3. Type in the normal composer. Streaming, Markdown, tools, images, model selection, and compaction all work as usual.

There is no **Add Project** step and no workspace to choose: the home project and its workspace are created and remembered for you.

The reload is one-time. PI WEB has no plugin API for registering a project, so first run uses the host's own same-origin endpoints; the host needs a reload to show the new project. After that, opening Casual is an in-app navigation.

If those endpoints are unreachable, the panel shows a setup card instead. Add `~/.casual-pi-web` through **Add Project** or pick an already-registered project as the home, then retry.

## Entry points

| Where | Control | Result |
| --- | --- | --- |
| Desktop header | **⁂** beside **Actions** | Opens Casual in its own tab, or focuses the one already open; in that window it closes Casual and returns to your project chat |
| Desktop tab bar | **Casual** tab | Embeds the casual chat, or shows the card when something needs attention |
| Mobile context bar | **⁂** beside the ⚡ **Actions** button | Same as the desktop header button |
| Mobile tab bar | **Casual** tab | Embeds the casual chat, or shows the card when something needs attention |
| Anywhere | **Actions → Casual → Open Casual Chat** | Opens Casual in the current tab |
| Anywhere | **Actions → Casual → Open Casual Chat in Its Own Tab** | Opens or focuses the separate window |

## The Casual tab

The Casual tab is a chat surface of its own. Once a conversation is remembered it embeds the real PI WEB chat in a same-origin frame, with that frame's navigation, header, and workspace columns hidden, so the chat fills the tab and your project chat in the main column keeps working beside it.

There is no toolbar, header, or card around it: the chat is the tab. The frame's chrome trimming is verified as it loads, and if the chat does not come out usable the frame falls back to a full app rather than an empty box — in that case use **Actions → Casual → Open Casual Chat** for a full view.

Setup, opening, and error states replace the frame with their card, because those need controls rather than a transcript. Everything else you might reach for is a palette action:
**Open Casual Chat** (full view in this tab), **Open Casual Chat in Its Own Tab**, **New Casual Chat**, **Reset Casual Link**, and **Change Casual Home**.

## Its own window

The frame is a chat; the separate window is the full experience. **⁂** from a project chat opens Casual in a dedicated browser tab and leaves your project chat untouched:

- The window has a stable name, so pressing **⁂** again focuses the same window instead of stacking tabs.
- Inside it, **⁂** reads **Back to your project chat** and closes the window, which returns you to the tab that opened it. If the browser refuses to close it, the button falls back to navigating that window back to your project chat.
- **Open Casual Chat in Its Own Tab** in the palette does the same from anywhere, including the Casual tab.
- If a popup blocker stops the window, or the home has no session yet, Casual opens in the current tab instead and the one-time setup proceeds normally.

## The toggle

**⁂** is two-sided. In a project chat it opens Casual in its own window. In Casual it reads **Back to your project chat** and returns you to the project, workspace, and session you were in when Casual last opened — not to the project list, and not to the newest session of that project.

- The return point is refreshed every time Casual opens, so it reflects whichever project chat you were last in.
- Returning does not clear it, so **⁂** keeps working in both directions as often as you like.
- If the remembered session was archived or deleted, the toggle takes you to the newest live session in the same workspace.
- If that project no longer exists, the toggle opens the Projects list and forgets the return point.
- Before you have ever opened Casual from a project chat, the toggle opens the Projects list, because there is nothing to return to.
- Neither the **Casual** tab nor **Open Casual Chat** toggles back. The tab embeds the chat; **Open Casual Chat** opens it as a full view.

Every button state also changes its tooltip and accessible label, so `Open Casual chat` and `Back to your project chat` describe what the next click does.

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
- **Open in its own tab** — open or focus the separate window, leaving this tab alone.
- **New chat** — create another session in the home and make it the remembered one. Nothing is deleted; the previous conversation stays in **Sessions**.
- **Reset link** — clear the remembered workspace and session, keep the home, and reopen so the newest live casual session is chosen. Use it when the pointer is stale and reopening keeps failing.
- **Change home** — clear the remembered project as well and show the project chooser, including the hidden `Casual` project if you want to come back.
- **Retry** — run the open flow again with the same state.
- **⁂** — toggle, as described above.

The palette mirrors the everyday actions — **Open Casual Chat**, **Open Casual Chat in Its Own Tab**, **New Casual Chat**, **Set Up Casual Chat** — and works the same on desktop and mobile.

## Starting a new conversation

1. Open **Actions** (⚡ on mobile).
2. Choose **Casual → New Casual Chat**.

Either way the new session becomes the one the tab embeds and the one ⁂ reopens, and the previous conversation remains in **Sessions** under the `Casual` project.

## History and storage

- The conversation is a normal PI WEB session in the project `Casual` at `~/.casual-pi-web`.
- That project's row and count are filtered out of the **Projects** sidebar. The project still exists: it appears in the **Change home** chooser, and its sessions appear in **Sessions** while it is selected.
- The plugin remembers the project, workspace, and session in `localStorage` under `pi-web-casual:store:v2`, per machine, plus the project-side return point used by the toggle. Conversation content is never stored by the plugin.
- A second machine has its own pointer and finds or creates its own casual session.

## Recovery

| Situation | What to do |
| --- | --- |
| The conversation seems gone | Open Casual again. It prefers the remembered session and otherwise takes the newest non-archived session in the home. |
| The toggle opened the Projects list | There was no project chat to return to, or it was removed. Open a project once and the toggle works from then on. |
| The toggle returned to a different session than you left | The remembered project session had been archived or deleted; the toggle chose the newest live session in that workspace. |
| The remembered session was archived or deleted | Same: opening Casual replaces the stale pointer with the newest live session. |
| The card keeps showing an error | **Retry** once, then **Reset link**, then reopen. |
| The card keeps showing setup | Add `~/.casual-pi-web` through **Add Project**, or choose an existing project as the home. |
| You want a clean start | **New Casual Chat**. Previous conversations stay in **Sessions**. |
| Casual should live elsewhere | **Change home** and pick a folder or project. |
| The ⁂ button or hidden row disappeared | A PI WEB update changed its private markup. The Casual tab and palette still work; see [issue tracker](https://github.com/paradise-runner/pi-web-casual/issues). |

## Privacy

A casual conversation is an ordinary PI WEB session stored on the host machine. Messages go to the model provider configured for PI WEB, exactly as in any other chat. Casual adds no analytics, no telemetry, no third-party requests, and no server process.
