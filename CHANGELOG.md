# Changelog

## [0.5.1](https://github.com/paradise-runner/pi-web-casual/compare/v0.5.0...v0.5.1) (2026-11-09)


### Bug Fixes

* keep the embedded chat's pickers on screen ([#13](https://github.com/paradise-runner/pi-web-casual/issues/13)) ([eed6d08](https://github.com/paradise-runner/pi-web-casual/commit/eed6d085662bfe3fee9d1c15b1ca7fc1015095cb))

## [0.5.0](https://github.com/paradise-runner/pi-web-casual/compare/v0.4.0...v0.5.0) (2026-11-03)


### Features

* sync the strip across devices and keep everything in the Casual tab ([cc8f2e3](https://github.com/paradise-runner/pi-web-casual/commit/cc8f2e382f577788fcfbccb7489bee3ad3e0a30c))

## [0.4.0](https://github.com/paradise-runner/pi-web-casual/compare/v0.3.0...v0.4.0) (2026-11-03)


### Features

* casual conversations in a numbered strip ([f8e9abf](https://github.com/paradise-runner/pi-web-casual/commit/f8e9abfd3e5d58808f74e34a76f8f3c9b36f6353))


### Bug Fixes

* keep the strip in step with storage, and let an archive be undone ([69410d3](https://github.com/paradise-runner/pi-web-casual/commit/69410d38599d32e2252505763ab5f7d1101722b1))

## [0.3.0](https://github.com/paradise-runner/pi-web-casual/compare/v0.2.1...v0.3.0) (2026-10-25)


### Features

* show agent activity on the Casual tab and hide the home row instantly ([04f351e](https://github.com/paradise-runner/pi-web-casual/commit/04f351e8805d4f277183ef194dfb3266331cb42c))

## [0.2.1](https://github.com/paradise-runner/pi-web-casual/compare/v0.2.0...v0.2.1) (2026-10-23)


### Bug Fixes

* pin the embedded composer and let the chat use the frame width ([c31cd0a](https://github.com/paradise-runner/pi-web-casual/commit/c31cd0ade7790ff9f0726e8fc09e99592e38690f))
* refuse hosts below PI WEB 1.202610.3 and refresh screenshots ([d8b0661](https://github.com/paradise-runner/pi-web-casual/commit/d8b066111746a2d60b181214f3a82fdf27e7522a))

## [0.2.0](https://github.com/paradise-runner/pi-web-casual/compare/v0.1.0...v0.2.0) (2026-10-22)


### Features

* remove the header ⁂ button now that the tab carries the chat ([3bdb35b](https://github.com/paradise-runner/pi-web-casual/commit/3bdb35be7fb85ddee038e80e0284b9243d011cdc))
* separate the casual chat from project chats ([7518621](https://github.com/paradise-runner/pi-web-casual/commit/751862188d84f8913176961966a5100ec55abc10))

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
