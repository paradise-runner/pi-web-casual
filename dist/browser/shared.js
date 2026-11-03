/**
 * Where the shared copy of the strip lives, relative to the casual home
 * workspace. It sits next to PI WEB's other plugin data (`.pi-web/relays`,
 * `.pi-web/uploads`) so the casual folder stays a scratch folder, not a project
 * of the user's own.
 */
export const SHARED_STATE_PATH = ".pi-web/casual/state.json";
const PARSE_LIMIT = 64 * 1024;
/** A host that does not serve the workspace file route is not asked again. */
const unsupported = new Set();
/** A home whose shared file is known to be missing is not re-read until it is written. */
const missing = new Set();
/** Writes are serialized per workspace so a burst of tab clicks lands in order. */
const chains = new Map();
function fileUrl(machineId, projectId, workspaceId) {
    const base = `api/machines/${encodeURIComponent(machineId)}`;
    return (`${base}/projects/${encodeURIComponent(projectId)}` +
        `/workspaces/${encodeURIComponent(workspaceId)}/file` +
        `?path=${encodeURIComponent(SHARED_STATE_PATH)}`);
}
function keyOf(machineId, projectId, workspaceId) {
    return `${machineId}\u0000${projectId}\u0000${workspaceId}`;
}
function asState(value) {
    if (typeof value !== "object" || value === null)
        return undefined;
    const candidate = value;
    if (candidate["version"] !== 1)
        return undefined;
    const updatedAt = candidate["updatedAt"];
    if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt))
        return undefined;
    if (!Array.isArray(candidate["tabs"]))
        return undefined;
    const tabs = [];
    const seen = new Set();
    for (const entry of candidate["tabs"]) {
        if (typeof entry !== "object" || entry === null)
            continue;
        const record = entry;
        const sessionId = record["sessionId"];
        if (typeof sessionId !== "string" || sessionId === "" || seen.has(sessionId))
            continue;
        seen.add(sessionId);
        const addedAt = record["addedAt"];
        const added = typeof addedAt === "number" && Number.isFinite(addedAt) ? { addedAt } : {};
        tabs.push({ sessionId, ...added });
    }
    const sessionId = candidate["sessionId"];
    return {
        version: 1,
        updatedAt,
        tabs,
        ...(typeof sessionId === "string" && sessionId !== "" ? { sessionId } : {}),
    };
}
export async function readSharedState(machineId, projectId, workspaceId) {
    const key = keyOf(machineId, projectId, workspaceId);
    if (unsupported.has(key))
        return { kind: "unavailable" };
    if (missing.has(key))
        return { kind: "absent" };
    try {
        const response = await fetch(fileUrl(machineId, projectId, workspaceId), {
            credentials: "same-origin",
            headers: { accept: "application/json" },
        });
        // A home with no shared state yet answers 404, or a 400 "Path does not
        // exist" from the workspace file route; a host without the route answers 404
        // from the app shell. None of those is an error: the strip seeds the file.
        if (response.status === 404 || response.status === 405) {
            missing.add(key);
            return { kind: "absent" };
        }
        if (response.status === 400) {
            missing.add(key);
            const body = await response.text().catch(() => "");
            if (!/does not exist|ENOENT|not found/iu.test(body)) {
                console.warn("[pi-web-casual] the shared casual state could not be read", body);
            }
            return { kind: "absent" };
        }
        if (!response.ok)
            return { kind: "unavailable" };
        const body = await response.json();
        if (typeof body !== "object" || body === null)
            return { kind: "unavailable" };
        const content = body["content"];
        if (typeof content !== "string" || content.length > PARSE_LIMIT)
            return { kind: "absent" };
        let parsed;
        try {
            parsed = JSON.parse(content);
        }
        catch {
            // A corrupt file is not worth keeping: treat it as missing and rewrite it.
            console.warn("[pi-web-casual] the shared casual state could not be parsed");
            return { kind: "absent" };
        }
        const state = asState(parsed);
        return state === undefined ? { kind: "absent" } : { kind: "state", state };
    }
    catch (error) {
        console.warn("[pi-web-casual] could not read the shared casual state", error);
        return { kind: "unavailable" };
    }
}
export async function writeSharedState(machineId, projectId, workspaceId, state) {
    const key = keyOf(machineId, projectId, workspaceId);
    if (unsupported.has(key))
        return false;
    missing.delete(key);
    const url = `${fileUrl(machineId, projectId, workspaceId)}&createDirs=true&overwrite=true`;
    try {
        const response = await fetch(url, {
            method: "PUT",
            credentials: "same-origin",
            headers: { "content-type": "text/plain" },
            body: JSON.stringify(state),
        });
        if (response.ok)
            return true;
        if (response.status === 404 || response.status === 405) {
            unsupported.add(key);
            return false;
        }
        console.warn(`[pi-web-casual] could not write the shared casual state: ${response.status}`);
        return false;
    }
    catch (error) {
        console.warn("[pi-web-casual] could not write the shared casual state", error);
        return false;
    }
}
/**
 * Write without making the caller wait: tab actions must not block on a round
 * trip, and a host without the route must cost one failed request, not one per
 * click. Writes for the same workspace run in order, so the last state queued is
 * the last state on disk.
 */
export function queueSharedState(machineId, projectId, workspaceId, state) {
    const key = keyOf(machineId, projectId, workspaceId);
    const previous = chains.get(key) ?? Promise.resolve();
    const next = previous
        .then(() => writeSharedState(machineId, projectId, workspaceId, state))
        .then(() => undefined);
    chains.set(key, next);
    void next.then(() => {
        if (chains.get(key) === next)
            chains.delete(key);
    });
}
export function sharedStateOf(record) {
    return {
        version: 1,
        updatedAt: record.updatedAt ?? 0,
        tabs: record.tabs ?? [],
        ...(record.sessionId === undefined ? {} : { sessionId: record.sessionId }),
    };
}
/** True when two states carry the same strip and active conversation. */
export function sameSharedContent(left, right) {
    if (left.sessionId !== right.sessionId)
        return false;
    if (left.tabs.length !== right.tabs.length)
        return false;
    return left.tabs.every((tab, index) => {
        const other = right.tabs[index];
        return tab.sessionId === other?.sessionId && tab.addedAt === other?.addedAt;
    });
}
