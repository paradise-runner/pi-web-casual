# Everything happens in the Casual tab

> Supersedes [ADR 0007](0007-casual-opens-in-its-own-window.md): the separate browser window is gone.

ADR 0007 gave Casual a second home — a browser window opened by name — because a plugin could not render a chat beside a project chat and the Casual tab was still a card. Since then the tab embeds the chat (ADR 0008) and keeps its own numbered conversations (ADR 0011), so the window no longer buys anything the tab does not already have. It cost its own entry in the palette, a card button, a fallback path for popup blockers, and a second PI WEB client per open window.

Three surfaces were also inconsistent with each other: the strip's **+** started a conversation inside the tab, while the palette's **New Casual Chat** navigated the whole page into the host's chat view, and **Open Casual Chat** did the same. Two ways to start a conversation behaved differently, and one of them left the tab that holds the strip.

So Casual is one tab:

- **The conversations are the strip.** A sub-chat is a numbered tab in the Casual tab itself: **+** or **New Casual Chat** appends one and makes it active without navigating, and clicking a number swaps the conversation inside the running embedded chat.
- **The palette opens the tab, not the page.** **Open Casual Chat** brings the Casual tab forward through the host's own tool selection, so the project chat in the main column keeps its place. **New Casual Chat** does the same after starting a conversation, and reports progress in the tab's own card.
- **No second window.** `Open Casual Chat in Its Own Tab`, the card's **Open in its own tab** button, the named window, and its popup-blocker fallback are removed. A project chat and Casual still sit side by side, because both are in the same page.
- **First run lands in the tab.** The one-time bootstrap reload now opens the Casual tab instead of the host's chat route.

## Consequences

- One place holds every casual conversation, and the strip is the only conversation switcher.
- Opening Casual never changes the host's project, workspace, or session selection, so a project chat keeps running beside it.
- A palette action has no renderer of its own: the panel repaints itself while a flow reports it is working, and the chat on screen stays visible during the flow instead of being replaced by a card.
- Removing the window removes a second PI WEB client (and its daemon connection) per open casual window, and removes the popup-blocker branch from the docs and the code.
- "Open in a separate tab" is no longer a thing Casual offers; a user who wants one can open the page again and click the Casual tab.
