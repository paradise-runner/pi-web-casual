# Changelog

## Unreleased

### Added

- **Casual in its own browser tab.** **⁂** from a project chat now opens the casual conversation in a separate named window (`pi-web-casual-chat`), leaving the project chat exactly where it is; pressing **⁂** again focuses that window, and inside it the button closes the window to return. The card gained **Open in its own tab**, and the palette gained **Open Casual Chat in Its Own Tab**. If a popup blocker intervenes, or the home has no session yet, Casual falls back to opening in the current tab.
- **The Casual tab is the chat, with no toolbar.** The embedded frame fills the tab and nothing else renders around it; **New chat**, **Reset link**, and **Change home** no longer sit under the conversation. They are palette actions now, alongside **Open**, **Open in Its Own Tab**, and **Set Up**.
- **The Casual tab embeds the chat.** Once a conversation is remembered, the tab renders a same-origin frame on the casual chat route with that frame's navigation, header, and workspace column trimmed away, so the tab is a chat interface rather than a card. Trimming is measured and rolled back when the chat does not come out usable. **Open chat** and **Open in its own tab** stay as the full-view paths.
- **⁂ toggles between your project chat and Casual.** From a project chat it opens Casual; from Casual it returns to the exact project, workspace, and session you left, remembered per machine. With no return point — a fresh install, or a project that was removed — it opens the Projects list instead. The button's tooltip and accessible label follow the side you are on.
- `repo-docs` project skill at [`.agents/skills/repo-docs`](.agents/skills/repo-docs/SKILL.md): user-first README and docs standard, ADR and glossary contracts, a fill-in README skeleton, and a dependency-free link/anchor checker.

### Changed

- **Removed the header ⁂ button.** The Casual tab and the palette are the entry points now, so nothing is injected beside **Actions** on desktop or mobile. The button's toggle, the per-machine return point, and the close-on-⁂ behavior in the separate window are gone with it; the separate window stays as a palette action and behaves like any other tab.
- **The Casual tab is its own view.** Clicking it renders the Casual card and leaves you there; it no longer redirects into the chat. The conversation opens from **Open chat** on the card, **⁂**, or the palette, and the card now shows the remembered session's name and location instead of a generic greeting. Mount-time auto-open is gone (`shouldAutoOpenOnMount` and the tab-click intent listener are removed); only an explicit control sets a short-lived open intent.
- Documentation is now organized by reader: `README.md` for install, first run, task table, limits, and a decisions index; `docs/using-casual.md` for the user path; `docs/how-it-works.md` for internals; `GLOSSARY.md` and `docs/adr/` for vocabulary and decisions.

## 0.1.0 — 2026-10-21

Initial public release.

### Added

- **⁂** button beside the PI WEB **Actions** button on desktop and mobile.
- **Casual** application tab with the Asterism icon.
- One persistent conversation opened in PI WEB's native chat.
- Automatic first-run setup: creates and trusts `~/.casual-pi-web`, creates the first session, and opens it.
- The Casual project is hidden from the sidebar **Projects** list, including the project count and collapsed heading.
- **New chat**, **Reset link**, and **Change home** controls.
- Palette actions: **Open Casual Chat**, **New Casual Chat**, and **Set Up Casual Chat**.
- Optional discovery of the latest casual session through the PI WEB catalog on newer hosts.
- Browser API v4 compatibility, including PI WEB `1.202610.3`.
- Documentation, screenshots, CI, issue templates, and a manual npm publish workflow.

### Notes

- The extra button and hidden project row use PI WEB's private shadow DOM and are best-effort.
- The package is browser-only and needs no session-daemon restart.
