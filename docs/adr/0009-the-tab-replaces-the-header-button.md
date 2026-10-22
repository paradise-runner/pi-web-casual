# The Casual tab replaces the header button

The **⁂** button beside **Actions** existed to reach Casual before the tab carried a chat. Once the tab embedded the conversation, the button's value was mostly the toggle: open Casual in its own window from a project chat, or close it to return. That toggle required a per-machine return point, selection-based side detection, a popup-blocked fallback, and a close-refused fallback, and its second meaning was only discoverable through a tooltip. Two entry points that do different things (the tab opens the chat in place, the button opened a window) were more surface than the feature needed. The button and the whole return-point mechanism were removed; the Casual tab and the palette actions are the entry points.

## Consequences

- The plugin no longer injects anything into the header or context bar. The only remaining private-markup dependency is hiding the Casual project row (ADR 0005) and the embedded frame's chrome trimming (ADR 0008).
- Moving between a project chat and Casual is now: click the tab to see Casual beside the project, or open the palette for a full view or a separate window. There is no one-click toggle and no automatic return.
- `ProjectChatPoint`, `captureProjectChatPoint`, `projectChatDestination`, `backToProjectChat`, `casualSide`, and `casualButtonLabels` are gone, along with the stored `projectChat` field. The stored pointer is only the casual project, workspace, and session.
- Nothing silently navigates the tab: state is shown in place, and navigation happens only from an explicit control.
- Supersedes ADR 0006. Narrows ADR 0007: the separate window stays, but it is opened from the palette and behaves like any other tab.
- A future host may offer a header or chat contribution point that makes an in-app switch native; then this decision is worth revisiting, not before.
