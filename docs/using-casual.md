# Using Casual

Casual is one ongoing PI WEB conversation that is not tied to a repository. This page covers first run, every control, and what to do when a conversation goes missing. Vocabulary is defined in [GLOSSARY.md](../GLOSSARY.md); installation is in the [README](../README.md#install).

## First run

1. Open the **Casual** tab, or **Actions → Casual → Open Casual Chat**. On a fresh install the tab shows a small setup card; **Open chat** starts the one-time setup.
2. Casual creates and trusts `~/.casual-pi-web`, starts the first session, and reloads the page once into the Casual tab, with that conversation already open in it.
3. Type in the normal composer. Streaming, Markdown, tools, images, model selection, and compaction all work as usual.

There is no **Add Project** step and no workspace to choose: the home project and its workspace are created and remembered for you.

The reload is one-time. PI WEB has no plugin API for registering a project, so first run uses the host's own same-origin endpoints; the host needs a reload to show the new project. After that, opening Casual is an in-app navigation.

If those endpoints are unreachable, the panel shows a setup card instead. Add `~/.casual-pi-web` through **Add Project** or pick an already-registered project as the home, then retry.

## Entry points

| Where | Control | Result |
| --- | --- | --- |
| Tab bar | **Casual** tab | Embeds the casual chat, or shows the card when something needs attention |
| Anywhere | **Actions → Casual → Open Casual Chat** | Brings the Casual tab forward, leaving the project chat beside it alone |
| Anywhere | **Actions → Casual → New Casual Chat** | Starts a fresh conversation in the strip and opens it in the Casual tab |
| Anywhere | **Actions → Casual → Reset Casual Link**, **Change Casual Home**, **Set Up Casual Chat** | Recovery and setup |

Nothing Casual does navigates the page away from what you are doing: the tab, the strip, and the palette all act inside the Casual tab.

## The Casual tab

The Casual tab is a chat surface of its own. Once a conversation is remembered it embeds the real PI WEB chat in a same-origin frame, with that frame's navigation, header, and workspace columns hidden, so the chat fills the tab and your project chat in the main column keeps working beside it.

## Conversations

Above the chat is a thin strip of numbered conversations, oldest first:

- **Click a number** to switch conversations. Switching is instant: the chat keeps running and only the conversation changes.
- **+** starts another conversation in the same home and opens it. It is appended on the right, so the numbers before it do not move.
- **×** on the active tab archives that conversation. PI WEB moves it to its own **Archived** sessions and the strip immediately offers **Undo**, which puts it back in the same place and reopens it; Casual never deletes history. The last remaining tab has no **×**, so Casual always has a conversation to show.
- Because Casual's home project is hidden from **Projects**, **Undo** is the practical way back from a misclick. The conversation is also in PI WEB's **Archived** sessions if you select the `Casual` project there, and in **Sessions** while it is live.
- Tab numbers follow position: close conversation 2 of 4 and the old 3 and 4 become 2 and 3.
- Each tab's tooltip and screen-reader name carry the conversation's name once the agent has given it one, so a number alone is never the only label.
- The strip is visible even with a single conversation, so **+** is always within reach.

The keyboard reaches the strip too: **Tab** to it, then **←**, **→**, **Home**, and **End** move between conversations and open the one you land on.

The tab's **⁂** also reports what the conversation is doing, using the same colors as the sidebar's dots: green while the agent is working, accent while a finished reply is waiting for you, and untinted when nothing is in flight. The tooltip and screen-reader name say the same thing, so the state does not depend on seeing the color.

Setup and error states replace the frame with their card, because those need controls rather than a transcript. A conversation being started keeps the chat on screen and reports itself in the strip. Everything else you might reach for is a palette action:
**Open Casual Chat**, **New Casual Chat**, **Reset Casual Link**, and **Change Casual Home**.

## The same conversations everywhere

The conversations live on the machine that hosts PI WEB, and so does the strip. Open Casual on your phone while your computer is on the same PI WEB and you get the same numbered conversations, with the same one open; switching a conversation on one device is what the other device shows the next time it renders or regains focus.

- The strip and the open conversation are saved in `~/.casual-pi-web/.pi-web/casual/state.json`, so any browser pointing at that machine reads and writes them.
- The last change wins. Two devices that change the strip at the same moment do not merge; whichever wrote last is what both show.
- Two different machines run two different homes, each with its own strip.

## The card

The card appears when the tab has something to report rather than a conversation to show: nothing remembered yet, setup needing input, an error, or a chat that cannot be embedded. It never redirects you anywhere on its own.

| Card state | Contents |
| --- | --- |
| **Ready when you are** | **Open chat**, **Open Actions** — no conversation remembered on this machine yet |
| **Setup** | **Retry**, **Open Actions**, and a chooser of registered projects |
| **Error** | **Retry**, **Open Actions**, **Reset link**, **Change home** |
| **Embedded chat** | The strip and the chat, filling the tab |

## Controls

- **Open chat** — resolve the home and open the remembered conversation in the Casual tab.
- **New chat** — create another session in the home, append it to the strip, and open it. Nothing is deleted; the previous conversations stay in the strip and in **Sessions**.
- **Reset link** — clear the remembered workspace, session, and strip, keep the home, and start again from a single fresh conversation. Use it when the pointer is stale and reopening keeps failing.
- **Change home** — clear the remembered project as well and show the project chooser, including the hidden `Casual` project if you want to come back.
- **Retry** — run the open flow again with the same state.

The palette carries the everyday actions — **Open Casual Chat**, **New Casual Chat**, **Reset Casual Link**, **Change Casual Home**, **Set Up Casual Chat** — and works the same on desktop and mobile.

## Starting a new conversation

1. Press **+** at the right end of the strip.
2. Or open **Actions** (⚡ on mobile) and choose **Casual → New Casual Chat**.

Either way the new conversation becomes the active tab and the tab embeds it; the previous conversations stay in the strip and in **Sessions** under the `Casual` project.

## History and storage

- The conversation is a normal PI WEB session in the project `Casual` at `~/.casual-pi-web`.
- That project's row and count are filtered out of the **Projects** sidebar, and the row does not appear when the section is expanded or the sidebar is redrawn. The project still exists: it appears in the **Change home** chooser, and its sessions appear in **Sessions** while it is selected.
- The plugin keeps a local copy of the project, workspace, strip, and active conversation in `localStorage` under `pi-web-casual:store:v2`, and a shared copy of the strip and the active conversation in `~/.casual-pi-web/.pi-web/casual/state.json`. Conversation content is never stored by the plugin.
- A second machine has its own home and its own strip; a second browser on the same machine sees the same list.

## Recovery

| Situation | What to do |
| --- | --- |
| Casual never appears after install | PI WEB is older than `1.202610.3`. The browser console shows `PI WEB Casual requires PI WEB 1.202610.3 or newer`; update PI WEB, then reload the browser. |
| The conversation seems gone | Open Casual again. It keeps the strip as it was, drops tabs whose conversation was archived elsewhere, and takes a live conversation if the active one is gone. |
| The remembered session was archived or deleted | Same: the next render replaces the stale pointer with a live conversation. |
| The phone and the computer disagree | Both must point at the same PI WEB machine, and the strip syncs on render, on focus, and after a palette action. The last change wins; reloading the other device settles it. |
| I closed a conversation and want it back | Click **Undo** in the strip. If the notice is gone, the conversation is still in PI WEB's **Archived** sessions — select the `Casual` project in **Projects** or **Change home** to reach them. |
| The card keeps showing an error | **Retry** once, then **Reset link**, then reopen. |
| The card keeps showing setup | Add `~/.casual-pi-web` through **Add Project**, or choose an existing project as the home. |
| You want a clean start | **New Casual Chat**. Previous conversations stay in **Sessions**. |
| Casual should live elsewhere | **Change home** and pick a folder or project. |
| The Casual project row reappeared in the sidebar | A PI WEB update changed its private markup, or the page is still loading and the plugin has not run yet. If it stays visible, the Casual tab and palette still work; see [issue tracker](https://github.com/paradise-runner/pi-web-casual/issues). |
| The Casual tab never changes color | PI WEB changed the status endpoint or flags the tab reads, or the page is a host without them. Casual keeps working; the tab simply stays untinted. |

## Privacy

A casual conversation is an ordinary PI WEB session stored on the host machine. Messages go to the model provider configured for PI WEB, exactly as in any other chat. Casual adds no analytics, no telemetry, no third-party requests, and no server process.
