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
    return { ...(readStore().machines[machineId] ?? {}) };
}
export function patchRecord(machineId, patch) {
    const store = readStore();
    const next = { ...(store.machines[machineId] ?? {}), ...patch };
    store.machines[machineId] = next;
    writeStore(store);
    return next;
}
