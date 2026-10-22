# Casual opens in its own browser tab

> Partially superseded by [ADR 0009](0009-the-tab-replaces-the-header-button.md): the separate window remains, but the palette opens it and it no longer responds to a header button.

Navigating in place means Casual and the project chat trade places: opening one hides the other, and the Casual card disappears as soon as the chat loads. That is what "still redirects to chat" meant in practice. PI WEB's plugin API exposes no chat component that a panel could embed, so a split view is not available to a plugin. A separate browser window is: the plugin opens `window.open("", "pi-web-casual-chat")` inside the click gesture, points it at the ordinary `project`/`workspace`/`session`/`view=chat` route, and leaves the current tab alone. The Casual tab therefore stays a card instead of a redirect, and **Open chat** remains available for people who prefer one tab.

## Consequences

- A project chat and the casual chat can be open at the same time, which is the only way to get "separate" with the current public API.
- The separate window is an ordinary PI WEB page: reloading it, deep-linking it, or losing it costs nothing but the conversation's scroll position.
- The stable window name means repeated presses focus one window instead of stacking tabs, but it also means only one casual window exists at a time.
- Popup blockers, or a home without a session yet, degrade to opening in the current tab. The plugin never fails closed.
- Inside that window **⁂** closes it; close is script-allowed because the plugin opened it. Where close is refused, the button falls back to navigating that window back to the project chat.
- Both tabs share the same per-machine pointer in `localStorage`, so "New chat" in one window changes what the other one opens.
- The layout is browser-tab parallelism, not an in-app split view. A true split view would need a hosted chat component in the plugin API.
