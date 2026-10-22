const HIDDEN_PROJECT_ATTR = "data-pi-web-casual-hidden";
const EMBED_STYLE_ATTR = "data-pi-web-casual-embed";
/** Window name of the frame the Casual panel embeds, so the plugin stays quiet inside it. */
export const EMBED_FRAME_NAME = "pi-web-casual-embed";
const EMBED_CHROME = [
    "app-context-bar",
    "app-navigation-panel",
    "workspace-panel",
    "app-mobile-main-tabs",
];
/** True when this document is the embedded frame the Casual panel renders. */
export function isEmbeddedFrame() {
    return window.name === EMBED_FRAME_NAME;
}
const CASUAL_PROJECT_PATH = /[\\/]\.casual-pi-web$/i;
const HOST_TAGS = [
    "app-context-bar",
    "app-navigation-panel",
    "workspace-panel",
    "app-mobile-main-tabs",
];
function appShadowRoot() {
    return document.querySelector("pi-web-app")?.shadowRoot ?? undefined;
}
/** Only the shadow roots that hold the header, context bar, tabs, and session list. */
export function knownShadowRoots() {
    const app = appShadowRoot();
    if (app === undefined)
        return [];
    const roots = [app];
    for (const tag of HOST_TAGS) {
        for (const element of app.querySelectorAll(tag)) {
            if (element.shadowRoot === null)
                continue;
            roots.push(element.shadowRoot);
            if (tag === "app-navigation-panel") {
                // The + start button lives in the nested session-list component, and
                // the project rows live in the nested project-list component.
                for (const child of element.shadowRoot.querySelectorAll("session-list, project-list")) {
                    if (child.shadowRoot !== null)
                        roots.push(child.shadowRoot);
                }
            }
        }
    }
    return roots;
}
function isCasualProjectRow(row) {
    const path = row.getAttribute("title") ?? "";
    return CASUAL_PROJECT_PATH.test(path);
}
function restoreProjectRow(row) {
    row.style.removeProperty("display");
    row.removeAttribute("aria-hidden");
    row.removeAttribute("inert");
    row.removeAttribute(HIDDEN_PROJECT_ATTR);
}
/**
 * Hide the plugin-managed default project from the sidebar project list. It
 * stays a real project for the host, but is reachable only through the \u2042
 * button/tab. The host's project-list component exposes `projects` and
 * `selected`, so this also works while the section is collapsed and has no
 * rendered rows. This is best-effort shadow-DOM work, like the extra button.
 */
function hideCasualProjectRows(root) {
    const host = root.host;
    const projects = Array.isArray(host.projects) ? host.projects : undefined;
    if (projects === undefined)
        return;
    const visibleProjects = projects.filter((project) => !CASUAL_PROJECT_PATH.test(project.path ?? ""));
    for (const row of root.querySelectorAll("[data-project-id]")) {
        if (isCasualProjectRow(row)) {
            row.style.display = "none";
            row.setAttribute("aria-hidden", "true");
            row.setAttribute("inert", "");
            row.setAttribute(HIDDEN_PROJECT_ATTR, "1");
        }
        else if (row.hasAttribute(HIDDEN_PROJECT_ATTR)) {
            restoreProjectRow(row);
        }
    }
    const count = root.querySelector(".section-count");
    if (count !== null && (count.textContent ?? "").trim() !== String(visibleProjects.length)) {
        count.textContent = String(visibleProjects.length);
    }
    if (host.selected !== undefined && CASUAL_PROJECT_PATH.test(host.selected.path ?? "")) {
        const selected = root.querySelector(".section-selected");
        if (selected !== null && (selected.textContent ?? "") !== "")
            selected.textContent = "";
    }
}
/**
 * Hide the default Casual project from the sidebar so Casual stays out of the
 * project list. PI WEB has no contribution point for this, so it is
 * deliberately best-effort and isolated here; a page update may change the
 * markup. The Casual tab and the palette actions are the supported surfaces and
 * keep working either way.
 */
export function startCasualHostBridge(signal) {
    // Inside the panel's embedded frame the sidebar is hidden anyway, and
    // rewriting it there would fight the surface around it.
    if (isEmbeddedFrame())
        return;
    const ensure = () => {
        if (signal.aborted)
            return;
        try {
            for (const root of knownShadowRoots())
                hideCasualProjectRows(root);
        }
        catch (error) {
            console.warn("[pi-web-casual] could not hide the casual project row", error);
        }
    };
    ensure();
    const interval = window.setInterval(ensure, 500);
    signal.addEventListener("abort", () => {
        window.clearInterval(interval);
        for (const root of knownShadowRoots()) {
            for (const row of root.querySelectorAll(`[${HIDDEN_PROJECT_ATTR}]`)) {
                restoreProjectRow(row);
            }
            const rows = root.querySelectorAll("[data-project-id]");
            const count = root.querySelector(".section-count");
            if (rows.length > 0 && count !== null)
                count.textContent = String(rows.length);
        }
    }, { once: true });
}
/**
 * Turn a same-origin PI WEB frame into a chat-only surface and keep it that way.
 *
 * The frame is a full SPA: `chat-view` appears only after it boots, and Lit may
 * recreate shell nodes later, so a single pass at `load` is not enough. Each
 * pass injects a persistent stylesheet for the known chrome, hides the sibling
 * branches above the chat, and leaves the chat's own ancestors alone — the
 * transcript can never be hidden by this code.
 */
const EMBED_STYLE_CSS = `
  app-context-bar, app-mobile-main-tabs, app-navigation-panel, workspace-panel,
  status-bar, navigation { display: none !important; }
  :host { background: var(--pi-bg); }
  chat-view { min-height: 0; }
`;
function embedFrameRoot(frame) {
    let doc = null;
    try {
        doc = frame.contentDocument;
    }
    catch {
        return null; // cross-origin frame
    }
    if (doc === null)
        return null;
    return doc.querySelector("pi-web-app")?.shadowRoot ?? null;
}
function hideSiblingsAbove(keep) {
    let node = keep;
    while (node !== null && node.parentElement !== null) {
        const parent = node.parentElement;
        for (const sibling of Array.from(parent.children)) {
            if (sibling === node)
                continue;
            const tag = sibling.tagName;
            if (tag === "STYLE" || tag === "SCRIPT" || tag === "LINK")
                continue;
            const style = sibling.style;
            if (style.getPropertyValue("display") !== "none") {
                style.setProperty("display", "none", "important");
            }
        }
        node = parent;
    }
}
/** One enforcement pass. Returns false until the frame has a chat to keep. */
function enforceEmbeddedChat(frame) {
    const root = embedFrameRoot(frame);
    if (root === null)
        return false;
    if (root.querySelector(`style[${EMBED_STYLE_ATTR}]`) === null) {
        const doc = frame.contentDocument;
        if (doc === null)
            return false;
        const style = doc.createElement("style");
        style.setAttribute(EMBED_STYLE_ATTR, "1");
        style.textContent = EMBED_STYLE_CSS;
        root.append(style);
    }
    const chat = root.querySelector("chat-view");
    if (chat === null)
        return false;
    // Keep the composer: start at the lowest ancestor that contains both the
    // transcript and the prompt editor, then hide everything beside that branch.
    const composer = root.querySelector("prompt-editor");
    let surface = chat;
    if (composer !== null) {
        let candidate = chat;
        while (candidate !== null && !candidate.contains(composer))
            candidate = candidate.parentElement;
        if (candidate !== null)
            surface = candidate;
    }
    hideSiblingsAbove(surface);
    return true;
}
const supervised = new WeakMap();
/** Start (or refresh) supervision of an embedded frame. Safe to call repeatedly. */
export function superviseEmbeddedChat(frame) {
    const existing = supervised.get(frame);
    if (existing !== undefined) {
        enforceEmbeddedChat(frame);
        return;
    }
    const started = Date.now();
    const tick = () => {
        if (!frame.isConnected || Date.now() - started > 300_000) {
            window.clearInterval(timer);
            supervised.delete(frame);
            return;
        }
        enforceEmbeddedChat(frame);
    };
    const timer = window.setInterval(tick, 300);
    supervised.set(frame, timer);
    frame.addEventListener("load", () => enforceEmbeddedChat(frame));
    enforceEmbeddedChat(frame);
}
/** Select the plugin's application tab. The tab only shows the Casual card; callers that
 * need the chat set an open/return intent first. */
export function clickCasualTab() {
    for (const root of knownShadowRoots()) {
        for (const label of root.querySelectorAll(".tab-label")) {
            if ((label.textContent ?? "").trim() !== "Casual")
                continue;
            const button = label.closest("button");
            if (button !== null) {
                button.click();
                return true;
            }
        }
        for (const button of root.querySelectorAll("button")) {
            const label = (button.getAttribute("aria-label") ?? button.title ?? "").trim();
            if (label === "Casual" || label.startsWith("Casual,")) {
                button.click();
                return true;
            }
        }
    }
    return false;
}
/** Click the host's "+" next to Sessions, the supported UI way to create a session. */
export function clickStartSession() {
    for (const root of knownShadowRoots()) {
        for (const button of root.querySelectorAll("button.start-session-button")) {
            if (button.disabled)
                continue;
            button.click();
            return true;
        }
        for (const button of root.querySelectorAll('button[aria-label^="Start a"]')) {
            if (button.disabled)
                continue;
            button.click();
            return true;
        }
    }
    return false;
}
/** Open the host Actions palette, where Add Project and the Casual actions live. */
export function clickActionsButton() {
    for (const root of knownShadowRoots()) {
        for (const button of root.querySelectorAll('button[aria-label="Show Actions"]')) {
            button.click();
            return true;
        }
        for (const button of root.querySelectorAll("button")) {
            if ((button.textContent ?? "").trim() !== "Actions")
                continue;
            button.click();
            return true;
        }
    }
    return false;
}
export async function waitFor(predicate, timeoutMs, intervalMs = 100) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const value = predicate();
        if (value !== undefined && value !== false)
            return value;
        if (Date.now() >= deadline)
            return undefined;
        await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
}
