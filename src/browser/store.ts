const STORAGE_KEY = "pi-web-casual:store:v2";

/** The project chat the \u2042 toggle returns to; captured when Casual opens. */
export interface ProjectChatPoint {
  projectId?: string;
  projectPath?: string;
  workspaceId?: string;
  workspacePath?: string;
  sessionId?: string;
  sessionName?: string;
}

export interface CasualRecord {
  projectPath?: string;
  projectId?: string;
  workspaceId?: string;
  workspacePath?: string;
  sessionId?: string;
  sessionName?: string;
  /** Kept separate from the casual fields so each side survives the other. */
  projectChat?: ProjectChatPoint;
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
  return { ...(readStore().machines[machineId] ?? {}) };
}

export function patchRecord(machineId: string, patch: Partial<CasualRecord>): CasualRecord {
  const store = readStore();
  const next: CasualRecord = { ...(store.machines[machineId] ?? {}), ...patch };
  store.machines[machineId] = next;
  writeStore(store);
  return next;
}
