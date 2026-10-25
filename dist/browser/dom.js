const HIDDEN_PROJECT_ATTR = "data-pi-web-casual-hidden";
/** Stylesheet that hides the home project from the moment its row is rendered. */
const PROJECT_STYLE_ATTR = "data-pi-web-casual-project-style";
/** Custom property the Casual tab icon reads its color from. */
export const TAB_COLOR_VARIABLE = "--pi-web-casual-tab-color";
/** Reports the painted agent state on the document root and the Casual tab. */
const ACTIVITY_ATTR = "data-pi-web-casual-activity";
const CASUAL_TAB_LABEL = "Casual";
/** Safety net for shadow roots created while nothing was observing their parent. */
const BRIDGE_INTERVAL_MS = 1000;
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
function setProjectRowHidden(row, hidden) {
    if (!hidden) {
        if (row.hasAttribute(HIDDEN_PROJECT_ATTR))
            restoreProjectRow(row);
        return;
    }
    if (row.style.getPropertyValue("display") !== "none")
        row.style.display = "none";
    if (row.getAttribute("aria-hidden") !== "true")
        row.setAttribute("aria-hidden", "true");
    if (!row.hasAttribute("inert"))
        row.setAttribute("inert", "");
    if (row.getAttribute(HIDDEN_PROJECT_ATTR) !== "1")
        row.setAttribute(HIDDEN_PROJECT_ATTR, "1");
}
/** The shadow roots that hold project rows, discovered from the navigation panel. */
function projectListShadowRoots() {
    const app = appShadowRoot();
    if (app === undefined)
        return [];
    const roots = [];
    for (const panel of app.querySelectorAll("app-navigation-panel")) {
        if (panel.shadowRoot === null)
            continue;
        for (const list of panel.shadowRoot.querySelectorAll("project-list")) {
            if (list.shadowRoot !== null)
                roots.push(list.shadowRoot);
        }
    }
    return roots;
}
/**
 * Hiding a row with script only after it renders leaves it painted for a moment
 * on every render of the project list — expanding the Projects section, a
 * machine switch, or any later Lit update. A stylesheet in the component's own
 * shadow root wins the race: the row is born hidden, and script below only
 * handles what CSS cannot (the count and the collapsed-heading summary).
 */
const PROJECT_STYLE_CSS = `
  [data-project-id][title$=".casual-pi-web" i],
  [data-project-id][title$=".casual-pi-web/" i] { display: none !important; }
`;
function ensureProjectStyle(root) {
    if (root.querySelector(`style[${PROJECT_STYLE_ATTR}]`) !== null)
        return;
    const style = root.ownerDocument.createElement("style");
    style.setAttribute(PROJECT_STYLE_ATTR, "1");
    style.textContent = PROJECT_STYLE_CSS;
    root.append(style);
}
/** Format a count the way the host does, so the corrected text does not oscillate. */
function formatCount(value) {
    const language = document.documentElement.lang;
    try {
        return new Intl.NumberFormat(language === "" ? undefined : language).format(value);
    }
    catch {
        return String(value);
    }
}
/**
 * Hide the plugin-managed default project from the sidebar project list. It
 * stays a real project for the host, but is reachable only through the \u2042
 * tab. The host's project-list component exposes `projects` and `selected`, so
 * this also works while the section is collapsed and has no rendered rows.
 * Best-effort shadow-DOM work, done on every host render.
 */
function syncProjectList(root) {
    ensureProjectStyle(root);
    const host = root.host;
    const projects = Array.isArray(host.projects) ? host.projects : undefined;
    if (projects === undefined)
        return;
    const visibleProjects = projects.filter((project) => !CASUAL_PROJECT_PATH.test(project.path ?? ""));
    for (const row of root.querySelectorAll("[data-project-id]")) {
        setProjectRowHidden(row, isCasualProjectRow(row));
    }
    const count = root.querySelector(".section-count");
    if (count !== null) {
        const expected = formatCount(visibleProjects.length);
        if ((count.textContent ?? "").trim() !== expected)
            count.textContent = expected;
    }
    if (host.selected !== undefined && CASUAL_PROJECT_PATH.test(host.selected.path ?? "")) {
        const selected = root.querySelector(".section-selected");
        if (selected !== null && (selected.textContent ?? "") !== "")
            selected.textContent = "";
    }
}
/**
 * Agent state for the Casual tab, matching the host's own dots: green while the
 * agent works in the home, accent while a finished reply is still unread.
 */
const ACTIVITY_DETAIL = {
    idle: undefined,
    working: "agent working",
    done: "reply unread",
};
const ACTIVITY_COLOR = {
    idle: undefined,
    working: "var(--pi-success)",
    done: "var(--pi-accent)",
};
let hostActivity = "idle";
/** The activation that owns the bridge; a second machine registration reuses it. */
let bridgeSignal;
const tabOriginals = new WeakMap();
/**
 * Report the casual agent state on the tab. The icon reads its color from a
 * custom property set on the document root, which reaches it through the host's
 * shadow boundary without touching attributes the host owns; the tab's title
 * and accessible name carry the same state for anyone not reading color.
 */
export function setCasualHostActivity(activity) {
    hostActivity = activity;
    applyCasualActivity(activity);
}
function applyCasualActivity(activity) {
    const root = document.documentElement;
    const style = root.style;
    const color = ACTIVITY_COLOR[activity];
    if (color === undefined) {
        // Idle leaves no trace on the host document.
        if (style.getPropertyValue(TAB_COLOR_VARIABLE) !== "")
            style.removeProperty(TAB_COLOR_VARIABLE);
        if (root.hasAttribute(ACTIVITY_ATTR))
            root.removeAttribute(ACTIVITY_ATTR);
    }
    else {
        if (style.getPropertyValue(TAB_COLOR_VARIABLE) !== color)
            style.setProperty(TAB_COLOR_VARIABLE, color);
        if (root.getAttribute(ACTIVITY_ATTR) !== activity)
            root.setAttribute(ACTIVITY_ATTR, activity);
    }
    const detail = ACTIVITY_DETAIL[activity];
    for (const root of knownShadowRoots()) {
        for (const label of root.querySelectorAll(".tab-label")) {
            if ((label.textContent ?? "").trim() !== CASUAL_TAB_LABEL)
                continue;
            const button = label.closest("button");
            if (button !== null)
                decorateCasualTab(button, activity, detail);
        }
    }
}
function decorateCasualTab(button, activity, detail) {
    const original = tabOriginals.get(button);
    if (detail === undefined) {
        if (original === undefined)
            return;
        writeAttribute(button, "title", original.title);
        writeAttribute(button, "aria-label", original.ariaLabel);
        button.removeAttribute(ACTIVITY_ATTR);
        tabOriginals.delete(button);
        return;
    }
    if (original === undefined) {
        tabOriginals.set(button, {
            title: button.getAttribute("title"),
            ariaLabel: button.getAttribute("aria-label"),
        });
    }
    if (button.getAttribute(ACTIVITY_ATTR) !== activity)
        button.setAttribute(ACTIVITY_ATTR, activity);
    writeAttribute(button, "title", `${CASUAL_TAB_LABEL} \u2014 ${detail}`);
    writeAttribute(button, "aria-label", `${CASUAL_TAB_LABEL}, ${detail}`);
}
function writeAttribute(element, name, value) {
    if (value === null) {
        if (element.hasAttribute(name))
            element.removeAttribute(name);
        return;
    }
    if (element.getAttribute(name) !== value)
        element.setAttribute(name, value);
}
/**
 * Keep the plugin's best-effort chrome in step with the host: the hidden casual
 * project row and the Casual tab's agent state. PI WEB has no contribution point
 * for either, so this is deliberately best-effort and isolated here; a page
 * update may change the markup. The Casual tab and the palette actions are the
 * supported surfaces and keep working either way.
 *
 * Every pass is idempotent and cheap, and is driven by the host's own
 * mutations — a 500 ms poll was long enough for the hidden row to be visible
 * after the Projects section re-rendered. The interval that remains only picks
 * up shadow roots created while nothing was observing their parent.
 */
export function startCasualHostBridge(signal) {
    // Inside the panel's embedded frame the sidebar is hidden anyway, and
    // rewriting it there would fight the surface around it.
    if (isEmbeddedFrame())
        return;
    // One bridge per page: PI WEB registers a machine-specific package once per
    // machine that has it, and only one tab can carry the state anyway.
    if (bridgeSignal !== undefined)
        return;
    bridgeSignal = signal;
    let scheduled = false;
    const ensure = () => {
        if (signal.aborted)
            return;
        try {
            applyCasualActivity(hostActivity);
            for (const root of projectListShadowRoots())
                syncProjectList(root);
        }
        catch (error) {
            console.warn("[pi-web-casual] could not update the host chrome", error);
        }
    };
    // Every pass also picks up shadow roots that appeared since the last one, so
    // a panel created after activation is covered on the mutation that created
    // it rather than at the next interval.
    const pass = () => {
        ensure();
        observeKnownRoots();
    };
    // Mutation callbacks run before the browser paints, so the fix lands in the
    // same frame as the markup that needed it.
    const schedule = () => {
        if (scheduled)
            return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            pass();
        });
    };
    const observed = new Set();
    const observer = new MutationObserver(() => {
        schedule();
    });
    const observeKnownRoots = () => {
        for (const root of observed) {
            if (root.host.isConnected)
                continue;
            observed.delete(root);
        }
        for (const root of [...knownShadowRoots(), ...projectListShadowRoots()]) {
            if (observed.has(root))
                continue;
            observed.add(root);
            observer.observe(root, {
                childList: true,
                subtree: true,
                // The project count and the collapsed summary are text updates, which
                // no child-list event reports. Everywhere else, text changes are the
                // streaming chat and are not worth a pass.
                characterData: root.host.tagName === "PROJECT-LIST",
            });
        }
    };
    pass();
    const interval = window.setInterval(pass, BRIDGE_INTERVAL_MS);
    // The app element may not exist yet at activation; keep looking for its
    // shadow roots until the interval takes over.
    schedule();
    signal.addEventListener("abort", () => {
        window.clearInterval(interval);
        observer.disconnect();
        observed.clear();
        if (bridgeSignal === signal)
            bridgeSignal = undefined;
        setCasualHostActivity("idle");
        for (const root of projectListShadowRoots()) {
            for (const row of root.querySelectorAll(`[${HIDDEN_PROJECT_ATTR}]`)) {
                restoreProjectRow(row);
            }
            const rows = root.querySelectorAll("[data-project-id]");
            const count = root.querySelector(".section-count");
            if (rows.length > 0 && count !== null)
                count.textContent = formatCount(rows.length);
            root.querySelector(`style[${PROJECT_STYLE_ATTR}]`)?.remove();
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
  /* Hiding the side panels leaves their grid tracks behind, so the chat stays
     squeezed beside an empty navigation column. Collapse the shell to the main
     column so the transcript and composer use the whole frame width. These
     unlayered rules outrank the host's layered shell stylesheet. */
  .shell { grid-template-columns: minmax(0, 1fr); }
  main { grid-column: 1 / -1; }
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
