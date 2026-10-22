# Browser-only, with first-run bootstrap through host endpoints

A session-daemon server entry would make Casual own filesystem work, but the things it needs are a project that exists and a session inside it — state PI WEB already manages. The public plugin API cannot register a project, so first run uses the host's own same-origin `api/machines/<machineId>/...` endpoints to create and trust `~/.casual-pi-web`, create the first session, and reload once. Everything else runs in the browser.

## Consequences

- Installation never restarts the session daemon; a page reload is the whole update path.
- Bootstrap depends on host endpoints rather than a published contract. When they are unreachable or changed, the panel falls back to a setup card where the user adds the folder or picks an existing project.
- The home folder lives on the machine that hosts PI WEB, which is why the pointer is per machine in `localStorage`.
- Publishing stays simple: one browser bundle under `dist/browser`, no server module, no Pi extension.
