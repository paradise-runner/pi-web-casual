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
- The Casual tab opens the chat.
- **New chat** creates a new session and makes it the remembered one.
- **Reset link** and **Change home** recover from missing or changed sessions.
- Desktop and mobile layouts both place the ⁂ button beside the lightning Actions control.
- No console errors.

## Shadow-DOM work

The extra ⁂ button and the hidden project row live in PI WEB's private shadow DOM. Keep that code isolated in `src/browser/dom.ts`, make it fail gracefully, and test it against both the oldest supported PI WEB version and the latest release. If a PI WEB update changes selectors, the supported fallbacks are the **Casual** tab and the plugin's palette actions.

## Pull requests

- Run `npm run typecheck` and `npm run build`.
- Commit the generated `dist/browser` files; they are the installable browser artifact and CI verifies they match source.
- Update `CHANGELOG.md` for user-visible changes.
- Include screenshots for UI changes.
- Keep the bootstrap and project-hiding behavior documented.

## Releases

Maintainers publish manually through the **Publish to npm** GitHub Actions workflow. It requires an `NPM_TOKEN` repository secret. The workflow defaults to a dry run; choose the publish input to publish for real. The package is public and uses npm provenance.
