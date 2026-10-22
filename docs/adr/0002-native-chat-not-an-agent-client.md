# The chat is PI WEB's native chat

Casual could ship its own chat surface, but every capability that makes a chat usable — streaming, Markdown, tool rendering, images, model selection, compaction, reconnects — already exists in the host, and reimplementing it would produce a second, worse chat that diverges with each PI WEB release. Casual navigates into PI WEB's own session view instead and contributes no agent client.

## Consequences

- No dependency on agent or provider APIs; the plugin only resolves a project and a session and calls `navigate`.
- Feature parity with normal chats is automatic, and host fixes apply for free.
- Plugin code stays small enough to audit as browser-only.
- Casual cannot change chat behavior it might want to: no custom composer, no plugin-specific message rendering, no per-conversation defaults.
- The conversation is stored like any other PI WEB session, so it survives plugin updates and uninstalls.
