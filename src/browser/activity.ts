import { isEmbeddedFrame, setCasualHostActivity } from "./dom.js";
import { readRecords } from "./store.js";
import type { CasualActivity, MachineStatusSnapshot } from "./types.js";

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

type JsonRecord = Record<string, unknown>;

/** The activation that owns the poller; a second machine registration reuses it. */
let pollingSignal: AbortSignal | undefined;

/**
 * Paint the agent state of the casual home on the Casual tab, so a chat that is
 * running or waiting for a reply is visible without opening it.
 *
 * The state comes from the host's own status snapshot rather than the panel,
 * because the tab has to be right while the panel has never rendered. Absent
 * flags mean "nothing in flight"; an unreachable snapshot keeps the last painted
 * state instead of guessing.
 */
export function startCasualActivityBridge(signal: AbortSignal): void {
  // The embedded frame has its own chrome hidden and its own copies of these
  // requests would only add load.
  if (isEmbeddedFrame()) return;
  // One poller per page: it already rolls up every machine Casual has a
  // pointer for, and PI WEB registers a machine-specific package per machine.
  if (pollingSignal !== undefined) return;
  pollingSignal = signal;

  let painted: CasualActivity = "idle";
  let inFlight = false;
  let warned = false;

  const poll = async (): Promise<void> => {
    if (signal.aborted || inFlight) return;
    inFlight = true;
    try {
      const activity = await resolveActivity(signal);
      warned = false;
      if (signal.aborted || activity === undefined || activity === painted) return;
      painted = activity;
      setCasualHostActivity(activity);
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn("[pi-web-casual] could not read the casual chat status", error);
      }
    } finally {
      inFlight = false;
    }
  };

  const tick = (): void => {
    if (document.hidden) return;
    void poll();
  };

  void poll();
  const interval = window.setInterval(tick, POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange", tick);
  signal.addEventListener(
    "abort",
    () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      if (pollingSignal === signal) pollingSignal = undefined;
      setCasualHostActivity("idle");
    },
    { once: true },
  );
}

/** Roll every machine's casual home into one state: any work wins over any unread. */
async function resolveActivity(signal: AbortSignal): Promise<CasualActivity | undefined> {
  const homes = Object.entries(readRecords()).flatMap(([machineId, record]) =>
    record.projectId === undefined ? [] : [{ machineId, projectId: record.projectId }],
  );
  if (homes.length === 0) return "idle";

  const states = await Promise.all(
    homes.map(async (home) => {
      const flags = await projectFlags(home.machineId, home.projectId, signal);
      if (flags === undefined) return undefined;
      if (flags[WORKING_FLAG] === true) return "working" as const;
      if (flags[UNREAD_FLAG] === true) return "done" as const;
      return "idle" as const;
    }),
  );

  if (states.includes("working")) return "working";
  if (states.includes("done")) return "done";
  return states.every((state) => state === "idle") ? "idle" : undefined;
}

async function projectFlags(
  machineId: string,
  projectId: string,
  signal: AbortSignal,
): Promise<Readonly<Record<string, boolean>> | undefined> {
  // The public plugin API exposes no status reads, so this is the host's own
  // same-origin endpoint, like first-run project creation in `bootstrap.ts`.
  const response = await fetch(`api/machines/${encodeURIComponent(machineId)}/status`, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) return undefined;
  const snapshot = parseMachineStatusSnapshot(await response.json());
  if (snapshot === undefined) return undefined;
  return snapshot.projects[projectId] ?? {};
}

/** Keep only the fields this plugin reads; anything else means "unknown". */
function parseMachineStatusSnapshot(value: unknown): MachineStatusSnapshot | undefined {
  const projects = asRecord(asRecord(value)?.["projects"]);
  if (projects === undefined) return undefined;
  const parsed: Record<string, Readonly<Record<string, boolean>>> = {};
  for (const [projectId, raw] of Object.entries(projects)) {
    const node = asRecord(raw);
    if (node === undefined) continue;
    const flags: Record<string, boolean> = {};
    for (const [flagId, isSet] of Object.entries(node)) {
      if (isSet === true) flags[flagId] = true;
    }
    parsed[projectId] = flags;
  }
  return { projects: parsed };
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}
