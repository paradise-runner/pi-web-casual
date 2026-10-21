# Security policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting:

1. Open the **Security** tab of this repository.
2. Choose **Report a vulnerability**.
3. Include the PI WEB version, browser, reproduction steps, and impact.

Do not open a public issue for a suspected vulnerability.

## Scope

Casual is a browser-only PI WEB plugin. It:

- runs in the PI WEB page with the page's permissions,
- uses PI WEB's same-origin project/session endpoints for first-run setup,
- creates and trusts `~/.casual-pi-web`,
- stores only project/workspace/session identifiers and paths in browser `localStorage`,
- does not send data to third-party services or add analytics,
- does not run a server entry or a Pi extension.

The extra ⁂ button and the hidden sidebar project row interact with PI WEB's private shadow DOM. Treat them as best-effort UI integrations, not security boundaries.

Only the latest release is supported with security fixes.
