<p align="center">
  <img src="https://raw.githubusercontent.com/paradise-runner/pi-web-casual/main/docs/assets/banner.png" alt="⁂ Casual — one long-running, project-free conversation for PI WEB" width="100%">
</p>

<h1 align="center">⁂ Casual</h1>

<p align="center">
  <strong>One long-running, project-free conversation for PI WEB.</strong><br>
  Click the Asterism. Talk about anything.
</p>

<p align="center">
  <a href="https://github.com/paradise-runner/pi-web-casual/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/paradise-runner/pi-web-casual/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/paradise-runner/pi-web-casual/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/paradise-runner/pi-web-casual?display_name=tag"></a>
  <img alt="PI WEB 1.202610.3+" src="https://img.shields.io/badge/PI_WEB-1.202610.3%2B-58a6ff">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/paradise-runner/pi-web-casual"></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/paradise-runner/pi-web-casual/main/docs/assets/desktop.png" alt="Casual on desktop: a ⁂ button beside Actions, a Casual tab, a native chat, and a sidebar with the Casual project hidden" width="92%">
</p>

Casual is a browser-only **PI WEB** plugin that adds a single, persistent conversation for everything that is not a project. It opens in PI WEB's native chat, stays out of your repository list, and is always one **⁂** click away.

## Why Casual?

PI WEB organizes conversations around projects and workspaces. That is the right shape for code, but it is a bad fit for the rest of the day: *What should I cook tonight? Help me name this playlist. Explain this article. Plan a weekend.*

Casual gives those conversations a home that is not a repo:

- **One conversation, not a new chat every time.** Reopen the same session from any project.
- **Project-free in the UI.** The scratch workspace is created automatically and hidden from the Projects list.
- **Native PI WEB chat.** Streaming, Markdown, tools, images, model selection, and context compaction all work normally.
- **No server component.** The plugin is browser-only and needs no session-daemon restart.

## Features

- **⁂ beside Actions** on desktop and mobile, plus a **Casual** tab.
- **Automatic first run:** creates and trusts `~/.casual-pi-web`, starts the first conversation, and opens it.
- **One ongoing session** in PI WEB's native chat view.
- **Hidden plumbing:** the Casual project row, its project count, and its collapsed-heading summary are hidden from the Projects view.
- **New chat**, **Reset link**, and **Change home** controls.
- **Palette actions:** *Open Casual Chat*, *New Casual Chat*, *Set Up Casual Chat*.
- **Works with PI WEB `1.202610.3+`**, including the newer catalog API when available.

## Install

### From GitHub (available now)

1. Open PI WEB → **Settings → Pi packages**.
2. Install `https://github.com/paradise-runner/pi-web-casual`.
3. Enable **Casual** in **Settings → PI WEB plugins** if it is not already enabled.
4. Reload the browser page.

This is a browser-only plugin. You do **not** need to restart the session daemon.

### From a release tarball

Download `pi-web-casual-0.1.0.tgz` from [Releases](https://github.com/paradise-runner/pi-web-casual/releases), install that file through **Settings → Pi packages**, enable **Casual**, and reload the browser.

### From npm

The package is prepared for npm as `pi-web-casual`, but the first npm release is not published yet. Until it is, use the GitHub or tarball install. See [Publishing](#publishing) if you are the maintainer.

### Local development

```sh
git clone https://github.com/paradise-runner/pi-web-casual.git
cd pi-web-casual
npm install --ignore-scripts
npm run build

mkdir -p ~/.pi-web/plugins
ln -sfn "$PWD" ~/.pi-web/plugins/pi-web-casual
```

Reload the browser. If `PI_WEB_DATA_DIR` is set, use `$PI_WEB_DATA_DIR/plugins` instead. `--ignore-scripts` skips building the native dependencies of the PI WEB host package; this plugin only consumes its TypeScript declarations.

## First run

1. Click **⁂** (or open the **Casual** tab).
2. Casual creates `~/.casual-pi-web`, adds it as a trusted PI WEB project, starts the first session, and reloads once into the chat.
3. Type in the normal PI WEB composer.

There is no **Add Project** step. If automatic setup cannot reach the host API, the panel falls back to a project chooser where you can add `~/.casual-pi-web` manually or pick an existing project.

<p align="center">
  <img src="https://raw.githubusercontent.com/paradise-runner/pi-web-casual/main/docs/assets/mobile.png" alt="Casual on mobile: the ⁂ button next to the lightning Actions button, the Casual tab, and a native chat" width="340">
</p>

## Use

- **⁂ beside Actions** or the **Casual tab** reopens the remembered conversation from anywhere.
- **New chat** starts a fresh conversation and makes it the remembered one. The previous conversation stays in **Sessions**.
- **Reset link** forgets a missing or stale session but keeps the casual project.
- **Change home** clears the project and shows the chooser again.
- The **Casual** actions in the palette mirror these controls.
- The Casual project is hidden from the sidebar. It still exists for the host and appears in the **Change home** chooser.

## How it works

- Browser API **v4**, so it runs on PI WEB `1.202610.3` and `1.202610.6+`.
- The conversation is PI WEB's **native chat**; Casual does not implement an agent client.
- First run uses PI WEB's own same-origin project/session endpoints to create and trust `~/.casual-pi-web`, create one session, and reload once into it. The public plugin API cannot register a project, which is why this bootstrap uses those endpoints.
- On `1.202610.6+`, the plugin uses the public **catalog** exposed to application panels to find the workspace and latest live session. On `1.202610.3`, it uses the selection service and the host's **+** button when a session has to be created later.
- The remembered project/workspace/session is stored per machine in `localStorage` under `pi-web-casual:store:v2`.
- The **⁂** button and the hidden project row use PI WEB's private shadow DOM. They are best-effort UI integrations, isolated in [`src/browser/dom.ts`](src/browser/dom.ts).
- There is no server entry, no Pi extension, no analytics, and no third-party service.

## Compatibility

| Area | Support |
| --- | --- |
| PI WEB | `1.202610.3` and newer |
| Plugin API | Browser API v4 |
| Platforms | Desktop and mobile web layouts |
| Browsers | Follows PI WEB's supported browsers |
| Server daemon restart | Not required |

PI WEB `1.202610.6+` logs a deprecation warning in the browser console for every API-v4 plugin, including its own bundled plugins. Moving Casual to API v5 would drop `1.202610.3` compatibility.

## FAQ and troubleshooting

### The ⁂ button or Casual tab is missing

Confirm the plugin is installed and enabled in **Settings → PI WEB plugins**, then reload. Check that the manifest lists it:

```sh
curl -s http://localhost:8504/pi-web-plugins/manifest.json | grep pi-web-casual
```

### The setup card appears instead of the chat

The automatic bootstrap could not reach PI WEB's project API. Add `~/.casual-pi-web` through **Add Project**, or choose an existing project from the card, then retry.

### The Casual project reappears in the Projects list

PI WEB changed its sidebar markup. The plugin still works through ⁂ and the Casual tab; update the selectors in [`src/browser/dom.ts`](src/browser/dom.ts) to hide the row again.

### The first click reloads the page once

That is the one-time bootstrap that adds the new project. After that, opening Casual is an in-app navigation.

### The old conversation disappeared

Use **Reset link** to reconnect to the latest live casual session, or **New chat** to start a fresh one.

### Is my conversation private?

It is a normal PI WEB session stored on the machine that hosts it. Messages go to your configured model provider exactly like any other PI WEB chat. Casual adds no analytics or third-party calls.

## Development

```sh
npm install --ignore-scripts
npm run typecheck
npm run build
```

Source layout:

| Path | Purpose |
| --- | --- |
| `src/browser/index.ts` | Activation, tab, actions, Casual-tab click intent |
| `src/browser/casual.ts` | Project/workspace/session resolution, open/new flows, auto-open guard |
| `src/browser/bootstrap.ts` | First-run project creation, trust, session creation, one-time reload |
| `src/browser/panel.ts` | Casual panel UI and mount probe |
| `src/browser/dom.ts` | Host shadow-DOM bridge, button injection, hidden project row |
| `src/browser/store.ts` | Per-machine remembered state |
| `src/browser/types.ts` | Optional catalog contract used on newer hosts |

The generated `dist/browser` files are committed because PI WEB serves them directly from the installed package. CI verifies that the committed output matches source.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the manual test checklist and pull-request expectations.

### Publishing

The package name `pi-web-casual` is available on npm at the time of writing. The repository includes a manual **Publish to npm** workflow:

1. Add an `NPM_TOKEN` repository secret with npm publish rights.
2. Run **Actions → Publish to npm**. It defaults to a dry run.
3. Select the publish input to publish `pi-web-casual` with provenance.

## Related

- [PI WEB](https://pi-web.dev/) — the web UI that hosts Casual.
- [PI WEB plugin documentation](https://pi-web.dev/plugins) — supported contracts, installation, and reload rules.
- [Pi coding agent](https://pi.dev/) — the agent that powers PI WEB conversations.

## Contributing

Issues and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and follow the [Code of Conduct](CODE_OF_CONDUCT.md). For security reports, use the process in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 Edward Champion.
