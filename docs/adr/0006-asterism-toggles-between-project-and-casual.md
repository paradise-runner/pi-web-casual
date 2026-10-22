# The Asterism toggles between the project chat and Casual

Casual is a real PI WEB project, so opening it necessarily replaces the project selection. Users lost their place in the project chat and had to find the project again before continuing, and the plugin offered no control that expressed "the other side". A second button or a segmented control would add another best-effort shadow-DOM surface with its own breakage. Instead the existing **⁂** button became a two-sided toggle: from a project chat it opens Casual, and from Casual it returns to the project, workspace, and session that were selected when Casual last opened. The project side is captured as a return point and stored per machine next to the casual pointer.

## Consequences

- Moving between the two sides is one click, in both directions, on desktop and mobile, with no new chrome.
- The button's meaning depends on the current selection, so its title and accessible label change with it. A user who never reads the tooltip discovers only the forward direction.
- The return point is per machine and is refreshed every time Casual opens, so it follows whichever project chat was last active rather than pinning one.
- A removed project, or an archived remembered session, cannot be restored verbatim. The catalog is consulted first: an archived session falls back to the newest live one in that workspace, and a project with no workspaces clears the point and opens the Projects list.
- With no return point, including a fresh install, the toggle opens the Projects list rather than inventing a destination.
- The decision assumes selection is readable at click time. Hosts that do not report a selected machine or project degrade to plain "open Casual".
