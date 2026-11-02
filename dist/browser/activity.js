import { casualChatOnScreen, getCasualHostActivity, isCasualPanelOnScreen, isEmbeddedFrame, setCasualHostActivity, } from "./dom.js";
import { readRecords } from "./store.js";
/**
 * The flags PI WEB publishes for a project (see `shared/machineStatus` in the
 * host). Both have existed since before the oldest host this plugin supports.
 */
const WORKING_FLAG = "core:working";
const UNREAD_FLAG = "core:unread";
/**
 * The host streams this snapshot over its own socket, which a plugin cannot
 * subscribe to. One cheap request per machine is the only same-origin source for
 * the same flags the sidebar dots use.
 */
const POLL_INTERVAL_MS = 4000;
/** The activation that owns the poller; a second machine registration reuses it. */
let pollingSignal;
/** Poll the host status now, so an acknowledgement can repaint without a wait. */
let refreshNow;
/**
 * Paint the agent state of the casual home on the Casual tab, so a chat that is
 * running or waiting for a reply is visible without opening it.
 *
 * The state comes from the host's own status snapshot rather than the panel,
 * because the tab has to be right while the panel has never rendered. Absent
 * flags mean "nothing in flight"; an unreachable snapshot keeps the last painted
 * state instead of guessing.
 */
export function startCasualActivityBridge(signal) {
    // The embedded frame has its own chrome hidden and its own copies of these
    // requests would only add load.
    if (isEmbeddedFrame())
        return;
    // One poller per page: it already rolls up every machine Casual has a
    // pointer for, and PI WEB registers a machine-specific package per machine.
    if (pollingSignal !== undefined)
        return;
    pollingSignal = signal;
    let painted = "idle";
    let inFlight = false;
    let warned = false;
    const poll = async () => {
        if (signal.aborted || inFlight)
            return;
        inFlight = true;
        try {
            const activity = await resolveActivity(signal);
            warned = false;
            if (signal.aborted || activity === undefined || activity === painted)
                return;
            painted = activity;
            setCasualHostActivity(activity);
        }
        catch (error) {
            if (!warned) {
                warned = true;
                console.warn("[pi-web-casual] could not read the casual chat status", error);
            }
        }
        finally {
            inFlight = false;
            // Re-read on every pass, not only on a change: the reply can already be on
            // screen while the tab is catching up, and a window that regains focus
            // runs this too.
            if (!signal.aborted)
                acknowledgeCasualUnread();
        }
    };
    const tick = () => {
        if (document.hidden)
            return;
        void poll();
    };
    refreshNow = () => {
        if (!signal.aborted)
            void poll();
    };
    void poll();
    const interval = window.setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    signal.addEventListener("abort", () => {
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", tick);
        window.removeEventListener("focus", tick);
        if (pollingSignal === signal)
            pollingSignal = undefined;
        refreshNow = undefined;
        setCasualHostActivity("idle");
    }, { once: true });
}
/** Roll every machine's casual home into one state: any work wins over any unread. */
async function resolveActivity(signal) {
    const homes = Object.entries(readRecords()).flatMap(([machineId, record]) => record.projectId === undefined ? [] : [{ machineId, projectId: record.projectId }]);
    if (homes.length === 0)
        return "idle";
    const states = await Promise.all(homes.map(async (home) => {
        const flags = await projectFlags(home.machineId, home.projectId, signal);
        if (flags === undefined)
            return undefined;
        if (flags[WORKING_FLAG] === true)
            return "working";
        if (flags[UNREAD_FLAG] === true)
            return "done";
        return "idle";
    }));
    if (states.includes("working"))
        return "working";
    if (states.includes("done"))
        return "done";
    return states.every((state) => state === "idle") ? "idle" : undefined;
}
async function projectFlags(machineId, projectId, signal) {
    // The public plugin API exposes no status reads, so this is the host's own
    // same-origin endpoint, like first-run project creation in `bootstrap.ts`.
    const response = await fetch(`api/machines/${encodeURIComponent(machineId)}/status`, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json" },
        signal,
    });
    if (!response.ok)
        return undefined;
    const snapshot = parseMachineStatusSnapshot(await response.json());
    if (snapshot === undefined)
        return undefined;
    return snapshot.projects[projectId] ?? {};
}
/** Keep only the fields this plugin reads; anything else means "unknown". */
function parseMachineStatusSnapshot(value) {
    const projects = asRecord(asRecord(value)?.["projects"]);
    if (projects === undefined)
        return undefined;
    const parsed = {};
    for (const [projectId, raw] of Object.entries(projects)) {
        const node = asRecord(raw);
        if (node === undefined)
            continue;
        const flags = {};
        for (const [flagId, isSet] of Object.entries(node)) {
            if (isSet === true)
                flags[flagId] = true;
        }
        parsed[projectId] = flags;
    }
    return { projects: parsed };
}
function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
/**
 * A bounded retry, so a re-rendered panel cannot post the same acknowledgement:
 * the host re-renders on every state change, including the one the
 * acknowledgement itself causes.
 */
const ACKNOWLEDGE_RETRY_MS = 3000;
/** The completion already acknowledged per conversation, so re-renders stay cheap. */
const acknowledgedCompletions = new Map();
const acknowledging = new Set();
const acknowledgeNotBefore = new Map();
/** Set once a host answers that it predates the unread catalog; stop asking. */
let acknowledgeUnsupported = false;
let acknowledgeWarned = false;
/**
 * Clear the unread completion once its reply has been read.
 *
 * PI WEB clears a completion itself when the chat it belongs to is on screen in a
 * focused page (`isSessionSeen` in the host). Casual's conversation renders
 * inside the panel's embedded frame, and that frame's document is not the one the
 * window focuses while the user works in the host's chrome, so the host never
 * sees its own chat as viewed and the accent would stay on the tab after the
 * reply is read. The plugin reports the same condition from the outside instead.
 *
 * The acknowledgement is the host's own route, and it carries the catalog epoch
 * plus the completion order this plugin observed, so a stale acknowledgement can
 * never clear newer work. Everything here fails soft: an older host without the
 * route leaves the tab as it was before.
 *
 * `conversation` lets the panel report the visit while it renders, before its
 * embedded frame has committed to the DOM; without it the displayed frame is the
 * proof. Either way something the host has covered or collapsed does not count.
 */
export function acknowledgeCasualUnread(conversation) {
    const signal = pollingSignal;
    if (signal === undefined || signal.aborted || acknowledgeUnsupported)
        return;
    // Only an unread completion is worth a round trip, and the conversation it
    // belongs to has to be on screen in a page the user is looking at.
    if (getCasualHostActivity() !== "done" || !pageIsBeingLookedAt())
        return;
    const target = conversation ?? casualChatOnScreen();
    if (target === undefined)
        return;
    if (conversation !== undefined && !isCasualPanelOnScreen())
        return;
    const key = conversationKey(target);
    if (acknowledging.has(key))
        return;
    const now = Date.now();
    if ((acknowledgeNotBefore.get(key) ?? 0) > now)
        return;
    acknowledgeNotBefore.set(key, now + ACKNOWLEDGE_RETRY_MS);
    acknowledging.add(key);
    void acknowledgeCompletion(target, signal).finally(() => acknowledging.delete(key));
}
/** Machine and session, the pair an unread completion is identified by. */
function conversationKey(target) {
    return `${target.machineId}\u0000${target.sessionId}`;
}
/** The host's own "seen" condition, measured from outside the embedded frame. */
function pageIsBeingLookedAt() {
    if (document.visibilityState !== "visible")
        return false;
    return typeof document.hasFocus === "function" ? document.hasFocus() : true;
}
async function acknowledgeCompletion(target, signal) {
    try {
        const catalog = await readUnreadCatalog(target.machineId, signal);
        if (signal.aborted || catalog === undefined)
            return;
        const completion = catalog.completions.find((entry) => entry.sessionId === target.sessionId);
        if (completion === undefined)
            return;
        const key = conversationKey(target);
        const acknowledged = acknowledgedCompletions.get(key);
        if (acknowledged !== undefined &&
            acknowledged.catalogId === catalog.catalogId &&
            acknowledged.completionOrder >= completion.completionOrder) {
            return;
        }
        const response = await fetch(`api/machines/${encodeURIComponent(target.machineId)}/sessions/${encodeURIComponent(target.sessionId)}/unread/acknowledge`, {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify({
                cwd: completion.cwd,
                catalogId: catalog.catalogId,
                throughCompletionOrder: completion.completionOrder,
            }),
            signal,
        });
        if (!response.ok)
            throw new Error(`HTTP ${String(response.status)}`);
        // Only a cleared completion is recorded, so a failed request is retried
        // instead of leaving the accent on the tab.
        acknowledgedCompletions.set(key, {
            catalogId: catalog.catalogId,
            completionOrder: completion.completionOrder,
        });
        // The host owns the color, so repaint from it instead of waiting for a poll.
        refreshNow?.();
    }
    catch (error) {
        if (!acknowledgeWarned && !signal.aborted) {
            acknowledgeWarned = true;
            console.warn("[pi-web-casual] could not clear the unread casual completion", error);
        }
    }
}
async function readUnreadCatalog(machineId, signal) {
    const response = await fetch(`api/machines/${encodeURIComponent(machineId)}/sessions/unread`, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json" },
        signal,
    });
    // A host that predates the catalog cannot clear a completion; stop asking.
    if (response.status === 404 || response.status === 405) {
        acknowledgeUnsupported = true;
        return undefined;
    }
    if (!response.ok)
        throw new Error(`HTTP ${String(response.status)}`);
    return parseUnreadCatalog(await response.json());
}
function parseUnreadCatalog(value) {
    const root = asRecord(value);
    const catalogId = root?.["catalogId"];
    const sessions = root?.["sessions"];
    if (typeof catalogId !== "string" || catalogId === "" || !Array.isArray(sessions)) {
        return undefined;
    }
    const completions = [];
    for (const raw of sessions) {
        const entry = asRecord(raw);
        const sessionId = entry?.["sessionId"];
        const cwd = entry?.["cwd"];
        const completionOrder = entry?.["completionOrder"];
        if (typeof sessionId !== "string" || sessionId === "")
            continue;
        if (typeof cwd !== "string" || cwd === "")
            continue;
        if (typeof completionOrder !== "number" ||
            !Number.isSafeInteger(completionOrder) ||
            completionOrder <= 0) {
            continue;
        }
        completions.push({ sessionId, cwd, completionOrder });
    }
    return { catalogId, completions };
}
