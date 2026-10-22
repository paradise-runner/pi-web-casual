# Contributing to ⁂ Casual

Thanks for helping improve Casual. This is a small, browser-only PI WEB plugin.

## Requirements

- Node.js 22.19 or newer
- PI WEB 1.202610.3 or newer
- A browser (Chromium, Safari, or Firefox)

## Development setup

```sh
git clone https://github.com/paradise-runner/pi-web-casual.git
cd pi-web-casual
npm install --ignore-scripts
npm run typecheck
npm run build
```

`--ignore-scripts` skips building the native dependencies of the PI WEB host package; this project only consumes its TypeScript declarations.

Link the checkout into PI WEB's local plugin directory:

```sh
mkdir -p ~/.pi-web/plugins
ln -sfn "$PWD" ~/.pi-web/plugins/pi-web-casual
```

If `PI_WEB_DATA_DIR` is set, use `$PI_WEB_DATA_DIR/plugins` instead. Reload the browser and confirm **Casual** is enabled under **Settings → PI WEB plugins**.

After changing source:

```sh
npm run build
```

Then reload the browser. No session-daemon restart is needed for this plugin.

## Manual test checklist

- First run in a clean PI WEB data directory creates `~/.casual-pi-web`, trusts it, starts a session, and opens the chat.
- The sidebar hides the Casual project row and shows the adjusted project count, both expanded and collapsed.
- The ⁂ button works from another project and from the empty app state.
- The Casual tab embeds the chat once a session is remembered, with the frame's navigation and header hidden; the composer stays usable and sending a message round-trips.
- The embedded state renders the chat alone: no card, header, or toolbar above or below it, and every control is reachable from the palette.
- When the embedded frame cannot be trimmed into a usable chat, it falls back to a full app and **Open chat** still gives a full view.
- The ⁂ button toggles: from a project chat it opens Casual in a separate named window and leaves the project chat untouched; pressing it again focuses that window instead of opening another; inside the window it closes it and returns to the project chat.
- **Open in its own tab** on the card and **Open Casual Chat in Its Own Tab** in the palette do the same from anywhere, falling back to the current tab when a popup blocker intervenes or no casual session exists yet.
- Toggling with no captured return point opens the Projects list, and a removed project clears the point instead of repeating a broken route.
- The Casual tab opens the chat.
- **New chat** creates a new session and makes it the remembered one.
- **Reset link** and **Change home** recover from missing or changed sessions.
- Palette actions — **Open Casual Chat**, **New Casual Chat**, **Set Up Casual Chat** — work from the palette on both layouts.
- Desktop and mobile layouts both place the ⁂ button beside the lightning Actions control.
- No console errors.

## Documentation

User-facing docs are part of the deliverable:

- `README.md` describes what the plugin does and what it deliberately does not do. Keep the **Limits** section honest when behavior changes.
- `docs/using-casual.md` follows the user's path: first run, entry points, controls, recovery.
- `docs/how-it-works.md` holds internals. Anything version-dependent belongs there, not in the README.
- `GLOSSARY.md` defines the vocabulary. Use its terms in issues, docs, and tests, and avoid the listed synonyms.
- Record a decision in `docs/adr/` when you change a user-visible tradeoff, and add it to the README **Decisions** list.

These rules are packaged as a Pi skill at [`.agents/skills/repo-docs`](.agents/skills/repo-docs/SKILL.md), including a fill-in README skeleton and the `check-doc-links.mjs` verifier. Pi loads project skills from `.agents/skills/`, so the skill is available in this repository as-is; symlink the directory into `~/.agents/skills/repo-docs` to use it in other repositories. Run the link check before opening a pull request:

```sh
node .agents/skills/repo-docs/scripts/check-doc-links.mjs .
```

## Shadow-DOM work

The extra ⁂ button and the hidden project row live in PI WEB's private shadow DOM. Keep that code isolated in `src/browser/dom.ts`, make it fail gracefully, and test it against both the oldest supported PI WEB version and the latest release. If a PI WEB update changes selectors, the supported fallbacks are the **Casual** tab and the plugin's palette actions.

## Pull requests

- Run `npm run typecheck` and `npm run build`.
- Commit the generated `dist/browser` files; they are the installable browser artifact and CI verifies they match source.
- Update `CHANGELOG.md` for user-visible changes.
- Update the docs listed in [Documentation](#documentation) when behavior changes, including the README **Limits** section.
- Run the doc link check: `node .agents/skills/repo-docs/scripts/check-doc-links.mjs .`
- Include screenshots for UI changes.
- Keep the bootstrap and project-hiding behavior documented.

## Releases

Maintainers publish manually through the **Publish to npm** GitHub Actions workflow. It requires an `NPM_TOKEN` repository secret. The workflow defaults to a dry run; choose the publish input to publish for real. The package is public and uses npm provenance.
