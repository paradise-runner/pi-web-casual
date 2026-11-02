const STORAGE_KEY = "pi-web-casual:store:v2";
function emptyStore() {
    return { version: 1, machines: {} };
}
function readStore() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null)
            return emptyStore();
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" &&
            parsed !== null &&
            parsed.version === 1 &&
            typeof parsed.machines === "object" &&
            parsed.machines !== null) {
            return parsed;
        }
    }
    catch (error) {
        console.warn("[pi-web-casual] could not read plugin storage", error);
    }
    return emptyStore();
}
function writeStore(store) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }
    catch (error) {
        console.warn("[pi-web-casual] could not write plugin storage", error);
    }
}
export function readRecord(machineId) {
    return normalizeRecord(readStore().machines[machineId]);
}
/**
 * `tabs` arrived after the first release, so a record written before it has only
 * the single remembered session. Normalizing on every read keeps both shapes
 * working without a migration step or a second storage key.
 */
function normalizeRecord(record) {
    const tabs = [];
    const seen = new Set();
    for (const entry of Array.isArray(record?.tabs) ? record.tabs : []) {
        if (typeof entry !== "object" || entry === null)
            continue;
        const sessionId = typeof entry.sessionId === "string" ? entry.sessionId : "";
        if (sessionId === "" || seen.has(sessionId))
            continue;
        seen.add(sessionId);
        tabs.push({
            sessionId,
            ...(typeof entry.sessionName === "string" ? { sessionName: entry.sessionName } : {}),
        });
    }
    const next = { ...(record ?? {}), tabs };
    if (next.sessionId !== undefined && !seen.has(next.sessionId)) {
        tabs.push({
            sessionId: next.sessionId,
            ...(next.sessionName === undefined ? {} : { sessionName: next.sessionName }),
        });
    }
    return next;
}
/** Every machine this browser has a pointer for, keyed by machine id. */
export function readRecords() {
    const records = {};
    for (const [machineId, record] of Object.entries(readStore().machines)) {
        records[machineId] = normalizeRecord(record);
    }
    return records;
}
export function patchRecord(machineId, patch) {
    const store = readStore();
    // Normalize what is already stored first, so a record written before `tabs`
    // existed materializes its tab list instead of losing it the first time the
    // active conversation changes.
    const current = normalizeRecord(store.machines[machineId]);
    const next = { ...current, ...patch };
    store.machines[machineId] = next;
    writeStore(store);
    return normalizeRecord(next);
}
