# Changelog

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
