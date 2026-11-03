const STORAGE_KEY = "pi-web-casual:store:v2";

/** One numbered conversation in the Casual strip, in strip order. */
export interface CasualTabRecord {
  sessionId: string;
  sessionName?: string;
  /**
   * When this conversation joined the strip. Another device uses it to tell a
   * conversation that is still being written from one that was archived there;
   * a tab written before this field existed has no stamp and is never that new.
   */
  addedAt?: number;
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
  /**
   * When this browser last changed the record. The shared copy of the strip
   * carries the same stamp, so two devices agree on which write is newer.
   */
  updatedAt?: number;
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
      ...(typeof entry.addedAt === "number" ? { addedAt: entry.addedAt } : {}),
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

/**
 * Write one record. `touch` bumps the shared clock, which is what another device
 * compares against; a local-only change (a refreshed name, a resolved folder)
 * passes `touch: false` so it does not look like a newer strip.
 */
export function patchRecord(
  machineId: string,
  patch: Partial<CasualRecord>,
  options: { readonly touch?: boolean } = {},
): CasualRecord {
  const store = readStore();
  // Normalize what is already stored first, so a record written before `tabs`
  // existed materializes its tab list instead of losing it the first time the
  // active conversation changes.
  const current = normalizeRecord(store.machines[machineId]);
  const updatedAt = options.touch === false ? current.updatedAt : Date.now();
  // Normalize again after the patch: making a conversation active also puts it in
  // the strip, and that has to reach storage, not just the object returned here.
  const next = normalizeRecord({
    ...current,
    ...patch,
    ...(updatedAt === undefined ? {} : { updatedAt }),
  });
  store.machines[machineId] = next;
  writeStore(store);
  return next;
}

/**
 * Replace the record with what the shared copy says, keeping the stamp it was
 * written with so this browser does not look like the newer writer and echo the
 * same strip back to the host.
 */
export function adoptRecord(machineId: string, record: CasualRecord): CasualRecord {
  const store = readStore();
  const next = normalizeRecord(record);
  store.machines[machineId] = next;
  writeStore(store);
  return next;
}
