const STORAGE_KEY = "pi-web-casual:store:v2";

/** One numbered conversation in the Casual strip, in strip order. */
export interface CasualTabRecord {
  sessionId: string;
  sessionName?: string;
}

export interface CasualRecord {
  projectPath?: string;
  projectId?: string;
  workspaceId?: string;
  workspacePath?: string;
  /** The active conversation, which is always one of `tabs`. */
  sessionId?: string;
  sessionName?: string;
  /** The strip, oldest first: position in this array is the tab's number. */
  tabs?: CasualTabRecord[];
}

interface StoreShape {
  version: 1;
  machines: Record<string, CasualRecord>;
}

function emptyStore(): StoreShape {
  return { version: 1, machines: {} };
}

function readStore(): StoreShape {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { version?: unknown }).version === 1 &&
      typeof (parsed as { machines?: unknown }).machines === "object" &&
      (parsed as { machines?: unknown }).machines !== null
    ) {
      return parsed as StoreShape;
    }
  } catch (error) {
    console.warn("[pi-web-casual] could not read plugin storage", error);
  }
  return emptyStore();
}

function writeStore(store: StoreShape): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn("[pi-web-casual] could not write plugin storage", error);
  }
}

export function readRecord(machineId: string): CasualRecord {
  return normalizeRecord(readStore().machines[machineId]);
}

/**
 * `tabs` arrived after the first release, so a record written before it has only
 * the single remembered session. Normalizing on every read keeps both shapes
 * working without a migration step or a second storage key.
 */
function normalizeRecord(record: CasualRecord | undefined): CasualRecord {
  const tabs: CasualTabRecord[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(record?.tabs) ? record.tabs : []) {
    if (typeof entry !== "object" || entry === null) continue;
    const sessionId = typeof entry.sessionId === "string" ? entry.sessionId : "";
    if (sessionId === "" || seen.has(sessionId)) continue;
    seen.add(sessionId);
    tabs.push({
      sessionId,
      ...(typeof entry.sessionName === "string" ? { sessionName: entry.sessionName } : {}),
    });
  }
  const next: CasualRecord = { ...(record ?? {}), tabs };
  if (next.sessionId !== undefined && !seen.has(next.sessionId)) {
    tabs.push({
      sessionId: next.sessionId,
      ...(next.sessionName === undefined ? {} : { sessionName: next.sessionName }),
    });
  }
  return next;
}

/** Every machine this browser has a pointer for, keyed by machine id. */
export function readRecords(): Readonly<Record<string, CasualRecord>> {
  const records: Record<string, CasualRecord> = {};
  for (const [machineId, record] of Object.entries(readStore().machines)) {
    records[machineId] = normalizeRecord(record);
  }
  return records;
}

export function patchRecord(machineId: string, patch: Partial<CasualRecord>): CasualRecord {
  const store = readStore();
  // Normalize what is already stored first, so a record written before `tabs`
  // existed materializes its tab list instead of losing it the first time the
  // active conversation changes.
  const current = normalizeRecord(store.machines[machineId]);
  const next: CasualRecord = { ...current, ...patch };
  store.machines[machineId] = next;
  writeStore(store);
  return normalizeRecord(next);
}
