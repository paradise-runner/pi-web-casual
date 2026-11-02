import type {
  ApplicationPanelContext,
  PluginNavigate,
  PluginNavigationDestination,
  PluginProject,
  PluginRuntimeContext,
  PluginSelectedSession,
  PluginSelectionService,
} from "@jmfederico/pi-web/plugin-api";
import { bootstrapCasual, casualChatUrl, listHomeSessions, reloadToCasualChat, reloadToCasualPanel, startCasualSession, archiveCasualSession, restoreCasualSession } from "./bootstrap.js";
import { clickCasualTab, clickStartSession, waitFor } from "./dom.js";
import { patchRecord, readRecord, type CasualRecord, type CasualTabRecord } from "./store.js";
import type { CatalogSession, CatalogWorkspace, PluginCatalog } from "./types.js";

export interface CasualSession {
  readonly id: string;
  readonly name?: string;
  readonly cwd: string;
  readonly archived: boolean;
  readonly runtime: "not-hosted" | "idle" | "busy";
}

export interface OpenContext {
  readonly machineId: string;
  readonly navigate: PluginNavigate;
  readonly projects?: { listProjects(): Promise<readonly PluginProject[]> };
  readonly catalog?: PluginCatalog;
  readonly startSession?: () => void | Promise<void>;
  readonly requestRender?: () => void;
}

export type CasualStatusKind = "idle" | "opening" | "ready" | "setup" | "error";

/** One numbered conversation in the Casual strip. */
export interface CasualTab {
  readonly sessionId: string;
  /** 1-based position in the strip, the number the tab shows. */
  readonly number: number;
  readonly name?: string;
  readonly active: boolean;
}

export interface CasualStatus {
  readonly kind: CasualStatusKind;
  readonly message?: string;
  readonly detail?: string;
  readonly projects?: readonly PluginProject[];
  readonly canRetry?: boolean;
}

const statuses = new Map<string, CasualStatus>();
/**
 * A short-lived line for the strip when a strip action could not complete. The
 * card is for the conversation as a whole; a failed tab action must not replace
 * the chat that is on screen.
 */
const stripNotices = new Map<string, string>();
const stripNoticeTimers = new Map<string, number>();
/**
 * Conversations this page load started. The catalog and the host's session list
 * only know a session once it has a file, which a session gets with its first
 * message, so a brand-new conversation is invisible to discovery for a moment.
 * Without this, a refresh pass would treat it as deleted: it would prune its tab
 * and pull the user back to an older conversation while they were still typing.
 */
const startedHere = new Set<string>();
const openTasks = new Map<string, Promise<void>>();
const newTasks = new Map<string, Promise<void>>();
const chooserMachines = new Set<string>();
let selectionService: PluginSelectionService | undefined;
/** Window name of the separate Casual tab, so later opens focus it instead of stacking tabs. */
const CASUAL_WINDOW_NAME = "pi-web-casual-chat";

export function setSelectionService(service: PluginSelectionService | undefined): void {
  selectionService = service;
}

export function getStatus(machineId: string): CasualStatus {
  return statuses.get(machineId) ?? { kind: "idle" };
}

/** The strip for one machine, numbered by position, with the active one marked. */
export function readCasualTabs(machineId: string): readonly CasualTab[] {
  const record = readRecord(machineId);
  return (record.tabs ?? []).map((tab, index) => ({
    sessionId: tab.sessionId,
    number: index + 1,
    ...(tab.sessionName === undefined ? {} : { name: tab.sessionName }),
    active: tab.sessionId === record.sessionId,
  }));
}

/** The line the strip shows when a tab action could not complete. */
export function casualStripNotice(machineId: string): string | undefined {
  return stripNotices.get(machineId);
}

function setStripNotice(context: OpenContext, message: string | undefined): void {
  const pending = stripNoticeTimers.get(context.machineId);
  if (pending !== undefined) window.clearTimeout(pending);
  stripNoticeTimers.delete(context.machineId);
  if (message === undefined) {
    stripNotices.delete(context.machineId);
  } else {
    stripNotices.set(context.machineId, message);
    stripNoticeTimers.set(
      context.machineId,
      window.setTimeout(() => {
        stripNoticeTimers.delete(context.machineId);
        stripNotices.delete(context.machineId);
        context.requestRender?.();
      }, 6000),
    );
  }
  context.requestRender?.();
}

/** Show an existing conversation in the panel without navigating anywhere. */
export function activateCasualTab(context: OpenContext, sessionId: string): void {
  const record = readRecord(context.machineId);
  if (record.sessionId === sessionId) return;
  const tab = (record.tabs ?? []).find((candidate) => candidate.sessionId === sessionId);
  // The strip is drawn from the record, so a tab that is on screen but missing
  // from the record is a bug in the record: adopt the tab rather than ignore the
  // click, which would make the tab look dead.
  if (tab === undefined) {
    setStripNotice(context, undefined);
    patchRecord(context.machineId, { sessionId });
    context.requestRender?.();
    return;
  }
  setStripNotice(context, undefined);
  patchRecord(context.machineId, { sessionId: tab.sessionId, sessionName: tab.sessionName });
  archiveUndos.delete(context.machineId);
  context.requestRender?.();
}

/**
 * The strip's **+**: start another conversation in the same home and make it the
 * active tab. This deliberately does not navigate the host page. The session is
 * created through the same route first run uses, so it works on every supported
 * host instead of depending on the sidebar's **+** button.
 */
export async function newCasualTab(context: OpenContext): Promise<void> {
  const record = readRecord(context.machineId);
  const cwd = record.workspacePath ?? record.projectPath;
  if (cwd === undefined) return;
  const created = await startCasualSession(context.machineId, cwd);
  if (created === undefined) {
    setStripNotice(context, "Could not start a new conversation.");
    return;
  }
  startedHere.add(created.id);
  archiveUndos.delete(context.machineId);
  patchRecord(context.machineId, {
    // Append explicitly as well as making it active: the strip's order is the
    // user's, and a new conversation belongs at the end of it.
    tabs: [...(record.tabs ?? []), { sessionId: created.id, ...(created.name === undefined ? {} : { sessionName: created.name }) }],
    sessionId: created.id,
    ...(created.name === undefined ? {} : { sessionName: created.name }),
  });
  setStripNotice(context, undefined);
  context.requestRender?.();
}

/**
 * The strip's **×**: archive the conversation and drop its tab. Archiving is the
 * host's own session action, so the conversation keeps its place in PI WEB's
 * **Archived** sessions and can be restored there. The last tab stays: Casual is
 * never left without a conversation to show.
 */
/**
 * What the strip can put back after an **×**: the conversation, its place in the
 * strip, and the notice that offers the restore.
 */
export interface CasualArchiveUndo {
  readonly message: string;
  readonly sessionId: string;
  readonly sessionName?: string;
  readonly index: number;
}

const archiveUndos = new Map<string, CasualArchiveUndo>();

/** The strip's Undo, if the last action there archived something. */
export function casualArchiveUndo(machineId: string): CasualArchiveUndo | undefined {
  return archiveUndos.get(machineId);
}

/**
 * Put back the conversation the last **×** archived. Casual's home row is hidden
 * from **Projects**, so the host's **Archived** list is awkward to reach from
 * here; without this, a misclick would look permanent.
 */
export async function undoCasualArchive(context: OpenContext): Promise<void> {
  const undo = archiveUndos.get(context.machineId);
  const record = readRecord(context.machineId);
  if (undo === undefined || record.projectId === undefined || record.workspaceId === undefined) {
    return;
  }
  const restored = await restoreCasualSession(context.machineId, {
    projectId: record.projectId,
    workspaceId: record.workspaceId,
    sessionId: undo.sessionId,
  });
  if (!restored) {
    setStripNotice(context, "Could not restore that conversation.");
    archiveUndos.delete(context.machineId);
    return;
  }

  const tabs = [...(record.tabs ?? [])];
  const at = Math.min(Math.max(undo.index, 0), tabs.length);
  tabs.splice(at, 0, {
    sessionId: undo.sessionId,
    ...(undo.sessionName === undefined ? {} : { sessionName: undo.sessionName }),
  });
  patchRecord(context.machineId, {
    tabs,
    sessionId: undo.sessionId,
    ...(undo.sessionName === undefined ? {} : { sessionName: undo.sessionName }),
  });
  archiveUndos.delete(context.machineId);
  setStripNotice(context, undefined);
  context.requestRender?.();
}

export async function archiveCasualTab(context: OpenContext, sessionId: string): Promise<void> {
  const record = readRecord(context.machineId);
  const tabs = record.tabs ?? [];
  const index = tabs.findIndex((tab) => tab.sessionId === sessionId);
  if (index < 0) return;
  if (tabs.length <= 1) {
    setStripNotice(context, "Casual keeps one conversation.");
    return;
  }
  if (record.projectId === undefined || record.workspaceId === undefined) return;
  const archive = {
    projectId: record.projectId,
    workspaceId: record.workspaceId,
    sessionId,
  };
  const name = tabs[index]?.sessionName;

  const result = await archiveCasualSession(context.machineId, archive);
  if (result === "failed") {
    // A conversation the host's own list does not know was never persisted, so
    // there is nothing to keep and nothing worth reporting.
    const cwd = record.workspacePath ?? record.projectPath;
    const known = cwd === undefined ? undefined : await listHomeSessions(context.machineId, cwd);
    if (known === undefined || known.some((session) => session.id === sessionId)) {
      setStripNotice(context, "Could not archive that conversation.");
      return;
    }
  }

  const remaining = tabs.filter((tab) => tab.sessionId !== sessionId);
  const neighbour = remaining[Math.min(index, remaining.length - 1)];
  patchRecord(context.machineId, {
    tabs: remaining,
    ...(record.sessionId !== sessionId || neighbour === undefined
      ? {}
      : { sessionId: neighbour.sessionId, sessionName: neighbour.sessionName }),
  });
  if (result === "unsupported") {
    archiveUndos.delete(context.machineId);
    setStripNotice(context, "Archiving needs a newer PI WEB; the conversation stays in Sessions.");
  } else {
    archiveUndos.set(context.machineId, {
      message: `Archived conversation ${index + 1}.`,
      sessionId,
      ...(name === undefined ? {} : { sessionName: name }),
      index,
    });
    setStripNotice(context, undefined);
  }
  context.requestRender?.();
}

function setStatus(context: OpenContext, status: CasualStatus): void {
  statuses.set(context.machineId, status);
  try {
    context.requestRender?.();
  } catch (error) {
    console.warn("[pi-web-casual] could not refresh the panel", error);
  }
}

export function panelOpenContext(context: ApplicationPanelContext): OpenContext {
  const catalog = catalogOf(context);
  return {
    machineId: context.machine.id,
    navigate: context.navigate,
    ...(context.projects === undefined ? {} : { projects: context.projects }),
    ...(catalog === undefined ? {} : { catalog }),
    requestRender: () => context.host.requestRender(),
  };
}

export function runtimeOpenContext(context: PluginRuntimeContext): OpenContext {
  const catalog = catalogOf(context);
  return {
    machineId: context.state.selectedMachine?.id ?? "local",
    navigate: context.navigate,
    ...(context.projects === undefined ? {} : { projects: context.projects }),
    ...(catalog === undefined ? {} : { catalog }),
  };
}

export function openCasual(context: OpenContext): Promise<void> {
  const existing = openTasks.get(context.machineId);
  if (existing !== undefined) return existing;
  let task: Promise<void>;
  task = doOpenCasual(context).finally(() => {
    if (openTasks.get(context.machineId) === task) openTasks.delete(context.machineId);
  });
  openTasks.set(context.machineId, task);
  return task;
}

export function newCasualChat(context: OpenContext): Promise<void> {
  const existing = newTasks.get(context.machineId);
  if (existing !== undefined) return existing;
  let task: Promise<void>;
  task = doNewCasualChat(context).finally(() => {
    if (newTasks.get(context.machineId) === task) newTasks.delete(context.machineId);
  });
  newTasks.set(context.machineId, task);
  return task;
}

export function chooseProject(context: OpenContext, project: PluginProject): Promise<void> {
  patchRecord(context.machineId, {
    projectId: project.id,
    projectPath: project.path,
    workspaceId: undefined,
    workspacePath: undefined,
    sessionId: undefined,
    sessionName: undefined,
  });
  return openCasual(context);
}

/** Forget the remembered conversation but keep the casual project. */
export function resetCasualLink(context: OpenContext): Promise<void> {
  archiveUndos.delete(context.machineId);
  patchRecord(context.machineId, {
    workspaceId: undefined,
    workspacePath: undefined,
    sessionId: undefined,
    sessionName: undefined,
    tabs: [],
  });
  return openCasual(context);
}

/** Forget the project as well, so the panel offers the project chooser again. */
export function changeCasualHome(context: OpenContext): Promise<void> {
  archiveUndos.delete(context.machineId);
  patchRecord(context.machineId, {
    projectId: undefined,
    projectPath: undefined,
    workspaceId: undefined,
    workspacePath: undefined,
    sessionId: undefined,
    sessionName: undefined,
    tabs: [],
  });
  chooserMachines.add(context.machineId);
  return openCasual(context);
}

function openCasualWindow(): Window | null {
  try {
    return window.open("", CASUAL_WINDOW_NAME);
  } catch (error) {
    console.warn("[pi-web-casual] could not open a separate window", error);
    return null;
  }
}

interface CasualTarget {
  readonly project: PluginProject;
  readonly workspace?: CatalogWorkspace;
  readonly session?: CasualSession;
  /** Live sessions in the home, newest first; absent when no catalog answered. */
  readonly sessions?: readonly CasualSession[];
}

async function resolveCasualTarget(context: OpenContext): Promise<CasualTarget | undefined> {
  const project = await resolveProject(context);
  if (project === undefined) return undefined;
  const record = readRecord(context.machineId);
  const discovered = await discover(context, project, record);
  const workspace = discovered.workspace ?? workspaceFromRecord(project, record);
  const session =
    discovered.session ?? (discovered.authoritative ? undefined : sessionFromRecord(record));
  return {
    project,
    ...(workspace === undefined ? {} : { workspace }),
    ...(session === undefined ? {} : { session }),
    ...(discovered.sessions === undefined ? {} : { sessions: discovered.sessions }),
  };
}

/** Route URL for the remembered casual chat, used by the panel's embedded surface. */
export function casualChatSrc(context: OpenContext): string | undefined {
  const record = readRecord(context.machineId);
  if (record.projectId === undefined || record.sessionId === undefined) return undefined;
  return casualChatUrl(context.machineId, record.projectId, record.workspaceId, record.sessionId);
}

const pointerRefreshes = new Map<string, string>();

/** Live sessions for the home from the host's list route, for hosts without a catalog. */
async function homeSessions(
  context: OpenContext,
  record: CasualRecord,
): Promise<readonly CatalogSession[] | undefined> {
  const cwd = record.workspacePath ?? record.projectPath;
  if (cwd === undefined) return undefined;
  const sessions = await listHomeSessions(context.machineId, cwd);
  if (sessions === undefined) return undefined;
  return sessions
    .filter((session) => !session.archived)
    .map((session) => ({
      id: session.id,
      cwd,
      ...(session.name === undefined ? {} : { name: session.name }),
      archived: false,
      runtime: "not-hosted" as const,
    }));
}

/**
 * Keep the pointer and the strip in step with the home without navigating: drop
 * tabs whose conversation was archived or deleted elsewhere, name the ones the
 * catalog knows, and repoint when the active conversation is gone. The key guard
 * stops a patch/render loop.
 */
export async function refreshCasualPointer(context: OpenContext): Promise<void> {
  const record = readRecord(context.machineId);
  if (record.sessionId === undefined) return;
  const key = [
    record.projectId ?? "",
    record.workspaceId ?? "",
    record.sessionId,
    (record.tabs ?? []).map((tab) => tab.sessionId).join(","),
  ].join("\u0000");
  if (pointerRefreshes.get(context.machineId) === key) return;
  pointerRefreshes.set(context.machineId, key);

  const target = await resolveCasualTarget(context);
  if (target === undefined) return;
  const latest = readRecord(context.machineId);
  // The catalog answers on newer hosts; the host's own session list answers for
  // naming and pruning on older ones. Both are the host's own view of what is
  // live, so either may decide that the active conversation was archived.
  const live = target.sessions ?? (await homeSessions(context, latest));
  const tabs = latest.tabs ?? [];
  // A conversation that is on screen or just created is kept even when discovery
  // cannot see it yet: pruning those is what made a new tab look dead and pulled
  // the user back to an older conversation mid-typing.
  const keep = (id: string): boolean =>
    id === latest.sessionId || startedHere.has(id);
  const nextTabs =
    live === undefined
      ? tabs
      : tabs
          .filter((tab) => keep(tab.sessionId) || live.some((session) => session.id === tab.sessionId))
          .map((tab) => {
            const match = live.find((session) => session.id === tab.sessionId);
            return match?.name === undefined || match.name === tab.sessionName
              ? tab
              : { sessionId: tab.sessionId, sessionName: match.name };
          });
  const session = target.session;
  // Discovery prefers the remembered conversation when it is still live, so a
  // different id means the active one was archived or deleted elsewhere — unless
  // it was started here and has simply not been written to disk yet.
  const activeId = latest.sessionId;
  const activeMissing =
    live !== undefined &&
    activeId !== undefined &&
    !startedHere.has(activeId) &&
    !live.some((candidate) => candidate.id === activeId);
  const nextSession =
    activeMissing && session !== undefined && session.id !== activeId ? session : undefined;

  // Nothing live left to fall back to: clear the pointer so the tab shows the card
  // instead of embedding a route the host can no longer open.
  if (activeMissing && nextSession === undefined) {
    patchRecord(context.machineId, { sessionId: undefined, sessionName: undefined, tabs: [] });
    context.requestRender?.();
    return;
  }
  const tabsChanged =
    nextTabs.length !== tabs.length ||
    nextTabs.some(
      (tab, index) =>
        tab.sessionId !== tabs[index]?.sessionId || tab.sessionName !== tabs[index]?.sessionName,
    );
  const locationChanged =
    latest.projectId !== target.project.id || latest.workspaceId !== target.workspace?.id;
  if (!tabsChanged && nextSession === undefined && !locationChanged) return;

  if (locationChanged) rememberLocation(context, target.project, target.workspace);
  patchRecord(context.machineId, {
    ...(tabsChanged ? { tabs: nextTabs } : {}),
    ...(nextSession === undefined
      ? {}
      : { sessionId: nextSession.id, sessionName: nextSession.name }),
  });
  context.requestRender?.();
}

/**
 * Open Casual in its own browser tab, or focus the one already open, so the
 * project chat in this tab stays untouched. The window is created synchronously
 * before any await because a popup blocker only allows it inside the gesture.
 */
export async function openCasualInOwnTab(context: OpenContext): Promise<void> {
  const handle = openCasualWindow();
  const target = await resolveCasualTarget(context);
  const session = target?.session;
  if (handle === null || target === undefined || session === undefined) {
    // Nothing to point a separate window at yet (first run, or no session in
    // the home): let the normal flow create it here instead.
    if (handle !== null) handle.close();
    await openCasual(context);
    return;
  }
  handle.location.replace(
    casualChatUrl(context.machineId, target.project.id, target.workspace?.id, session.id),
  );
  handle.focus();
}

async function doOpenCasual(context: OpenContext): Promise<void> {
  setStatus(context, { kind: "opening", message: "Finding your casual conversation\u2026" });
  try {
    if (chooserMachines.delete(context.machineId)) {
      await showSetup(context, "choose");
      return;
    }

    const project = await resolveProject(context);
    if (project === undefined) {
      if (await bootstrapAndReload(context)) return;
      await showSetup(context, "failed");
      return;
    }

    const record = readRecord(context.machineId);
    const discovered = await discover(context, project, record);
    const workspace = discovered.workspace ?? workspaceFromRecord(project, record);
    rememberLocation(context, project, workspace);

    const recordedSession = discovered.authoritative ? undefined : sessionFromRecord(record);
    const session = discovered.session ?? recordedSession;
    if (session !== undefined) {
      rememberSession(context, session);
      await navigateToCasual(context, project, workspace, session);
      setStatus(context, {
        kind: "ready",
        message: "Casual chat is open.",
        detail: session.name ?? "Your ongoing conversation",
      });
      return;
    }

    await context.navigate(destination(context, project, workspace), { history: "replace" });
    const created = await createCasualSession(context, project, workspace, false);
    if (created === undefined) {
      setStatus(context, {
        kind: "error",
        message: "Could not start the casual conversation.",
        detail: "Open the casual workspace, press + next to Sessions, then open \u2042 again.",
        canRetry: true,
      });
      return;
    }

    rememberLocation(context, project, created.workspace);
    rememberSession(context, created.session);
    await navigateToCasual(context, project, created.workspace, created.session);
    setStatus(context, {
      kind: "ready",
      message: "Casual chat is ready.",
      detail: created.session.name ?? "Your ongoing conversation",
    });
  } catch (error) {
    console.warn("[pi-web-casual] open failed", error);
    setStatus(context, {
      kind: "error",
      message: "Something went wrong opening Casual.",
      detail: errorMessage(error),
      canRetry: true,
    });
  }
}

async function doNewCasualChat(context: OpenContext): Promise<void> {
  setStatus(context, { kind: "opening", message: "Starting a fresh casual chat\u2026" });
  try {
    if (chooserMachines.delete(context.machineId)) {
      await showSetup(context, "choose");
      return;
    }

    const project = await resolveProject(context);
    if (project === undefined) {
      if (await bootstrapAndReload(context)) return;
      await showSetup(context, "failed");
      return;
    }

    const record = readRecord(context.machineId);
    const discovered = await discover(context, project, record);
    const workspace = discovered.workspace ?? workspaceFromRecord(project, record);
    rememberLocation(context, project, workspace);

    await context.navigate(destination(context, project, workspace), { history: "replace" });
    const created = await createCasualSession(context, project, workspace, true);
    if (created === undefined) {
      setStatus(context, {
        kind: "error",
        message: "Could not start a new casual chat.",
        detail: "Open the casual workspace, press + next to Sessions, then try again.",
        canRetry: true,
      });
      return;
    }

    rememberLocation(context, project, created.workspace);
    rememberSession(context, created.session);
    await navigateToCasual(context, project, created.workspace, created.session);
    setStatus(context, {
      kind: "ready",
      message: "New casual chat started.",
      detail: "The previous conversation stays in Sessions.",
    });
  } catch (error) {
    console.warn("[pi-web-casual] new chat failed", error);
    setStatus(context, {
      kind: "error",
      message: "Something went wrong starting a new chat.",
      detail: errorMessage(error),
      canRetry: true,
    });
  }
}

async function showSetup(context: OpenContext, reason: "choose" | "failed" = "failed"): Promise<void> {
  setStatus(context, {
    kind: "setup",
    message: reason === "choose" ? "Choose a home for Casual." : "Casual could not create its home folder.",
    detail:
      reason === "choose"
        ? "Select an existing project, or add ~/.casual-pi-web as a PI WEB project."
        : "Add ~/.casual-pi-web as a PI WEB project, or choose an existing project below.",
    projects: await listProjects(context),
    canRetry: true,
  });
}

async function bootstrapAndReload(context: OpenContext): Promise<boolean> {
  setStatus(context, { kind: "opening", message: "Creating your casual space\u2026" });
  const result = await bootstrapCasual(context.machineId);
  if (result === undefined) return false;

  patchRecord(context.machineId, {
    projectId: result.project.id,
    projectPath: result.project.path,
    workspaceId: result.workspaceId,
    workspacePath: result.workspacePath,
    sessionId: result.sessionId,
    sessionName: undefined,
    tabs: [],
  });

  // Let the panel paint the "Creating..." state before the one-time reload.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
  if (result.sessionId !== undefined) {
    reloadToCasualChat(context.machineId, result.project.id, result.workspaceId, result.sessionId);
  } else {
    reloadToCasualPanel(context.machineId, result.project.id, result.workspaceId);
  }
  return true;
}

async function resolveProject(context: OpenContext): Promise<PluginProject | undefined> {
  const projects = await listProjects(context);
  const record = readRecord(context.machineId);
  if (record.projectPath !== undefined) {
    const wanted = normalizePath(record.projectPath);
    const exact = projects.find((project) => normalizePath(project.path) === wanted);
    if (exact !== undefined) return exact;
    const insensitive = projects.find(
      (project) => normalizePath(project.path).toLowerCase() === wanted.toLowerCase(),
    );
    if (insensitive !== undefined) return insensitive;
  }
  if (record.projectId !== undefined) {
    const match = projects.find((project) => project.id === record.projectId);
    if (match !== undefined) return match;
  }
  return projects.find(
    (project) => basename(project.path).toLowerCase() === ".casual-pi-web",
  );
}

async function listProjects(context: OpenContext): Promise<readonly PluginProject[]> {
  if (context.projects === undefined) return [];
  try {
    return await context.projects.listProjects();
  } catch (error) {
    console.warn("[pi-web-casual] could not list projects", error);
    return [];
  }
}

interface Discovered {
  readonly workspace?: CatalogWorkspace;
  readonly session?: CatalogSession;
  /** Every live session in the home, newest first; absent when no catalog answered. */
  readonly sessions?: readonly CatalogSession[];
  /** True when the catalog was read successfully, even if it found nothing. */
  readonly authoritative: boolean;
}

async function discover(
  context: OpenContext,
  project: PluginProject,
  record: CasualRecord,
): Promise<Discovered> {
  if (context.catalog === undefined) return { authoritative: false };
  try {
    const workspaces = await context.catalog.workspaces.list(project.id);
    const workspace =
      workspaces.find((candidate) => candidate.id === record.workspaceId) ??
      workspaces.find((candidate) => candidate.isMain) ??
      workspaces[0];
    if (workspace === undefined) return { authoritative: true };
    const sessions = await context.catalog.sessions.list({
      projectId: project.id,
      workspaceId: workspace.id,
    });
    const live = sessions.filter((session) => !session.archived);
    const session = live.find((candidate) => candidate.id === record.sessionId) ?? live[0];
    return {
      workspace,
      ...(session === undefined ? {} : { session }),
      sessions: live,
      authoritative: true,
    };
  } catch (error) {
    console.warn("[pi-web-casual] catalog discovery failed", error);
    return { authoritative: false };
  }
}

interface CreatedCasual {
  readonly session: CasualSession;
  readonly workspace: CatalogWorkspace;
}

async function createCasualSession(
  context: OpenContext,
  project: PluginProject,
  workspace: CatalogWorkspace | undefined,
  forceNew: boolean,
): Promise<CreatedCasual | undefined> {
  const service = selectionService;
  if (service === undefined) {
    console.warn("[pi-web-casual] the host selection service is unavailable");
    return undefined;
  }

  const selectedWorkspace = await waitFor(() => {
    const snapshot = service.getSnapshot();
    const selected = snapshot.selectedWorkspace;
    if (selected === undefined || selected.projectId !== project.id) return undefined;
    if (workspace !== undefined && workspace.id !== "" && selected.id !== workspace.id) return undefined;
    return selected;
  }, 8000);

  if (selectedWorkspace === undefined) return undefined;
  const resolvedWorkspace: CatalogWorkspace = {
    id: selectedWorkspace.id,
    projectId: selectedWorkspace.projectId,
    path: selectedWorkspace.path,
    label: selectedWorkspace.label,
    isMain: selectedWorkspace.isMain,
  };
  const before = service.getSnapshot().selectedSession;

  if (!forceNew) {
    const existing = await waitFor(() => {
      const snapshot = service.getSnapshot();
      const session = snapshot.selectedSession;
      if (session === undefined || session.pending || session.archived) return undefined;
      if (snapshot.selectedWorkspace?.id !== selectedWorkspace.id) return undefined;
      return session;
    }, 1500);
    if (existing !== undefined) {
      return { session: toCasualSession(existing), workspace: resolvedWorkspace };
    }
  }

  if (context.startSession !== undefined) {
    try {
      await context.startSession();
    } catch (error) {
      console.warn("[pi-web-casual] could not start a session", error);
      return undefined;
    }
  } else {
    const clicked = await waitFor(() => clickStartSession(), 8000, 150);
    if (clicked !== true) return undefined;
  }

  const created = await waitFor(() => {
    const snapshot = service.getSnapshot();
    const session = snapshot.selectedSession;
    if (session === undefined || session.pending || session.archived) return undefined;
    if (session.id === before?.id) return undefined;
    if (snapshot.selectedWorkspace?.id !== selectedWorkspace.id) return undefined;
    return session;
  }, 25000);

  return created === undefined
    ? undefined
    : { session: toCasualSession(created), workspace: resolvedWorkspace };
}

function toCasualSession(session: PluginSelectedSession): CasualSession {
  return {
    id: session.id,
    ...(session.name === undefined ? {} : { name: session.name }),
    cwd: session.cwd,
    archived: session.archived,
    runtime: "idle",
  };
}

function sessionFromRecord(record: CasualRecord): CasualSession | undefined {
  if (record.sessionId === undefined) return undefined;
  return {
    id: record.sessionId,
    ...(record.sessionName === undefined ? {} : { name: record.sessionName }),
    cwd: record.workspacePath ?? "",
    archived: false,
    runtime: "not-hosted",
  };
}

function workspaceFromRecord(
  project: PluginProject,
  record: CasualRecord,
): CatalogWorkspace | undefined {
  if (record.workspaceId === undefined) return undefined;
  return {
    id: record.workspaceId,
    projectId: project.id,
    path: record.workspacePath ?? "",
    label: "",
    isMain: false,
  };
}

function rememberLocation(
  context: OpenContext,
  project: PluginProject,
  workspace: CatalogWorkspace | undefined,
): void {
  patchRecord(context.machineId, {
    projectId: project.id,
    projectPath: project.path,
    ...(workspace === undefined
      ? {}
      : {
          workspaceId: workspace.id,
          ...(workspace.path === "" ? {} : { workspacePath: workspace.path }),
        }),
  });
}

function rememberSession(context: OpenContext, session: CasualSession): void {
  patchRecord(context.machineId, {
    sessionId: session.id,
    sessionName: session.name,
    ...(session.cwd === "" ? {} : { workspacePath: session.cwd }),
  });
}

function destination(
  context: OpenContext,
  project: PluginProject,
  workspace: CatalogWorkspace | undefined,
  session?: { readonly id: string },
): PluginNavigationDestination {
  return {
    machineId: context.machineId,
    projectId: project.id,
    ...(workspace === undefined || workspace.id === "" ? {} : { workspaceId: workspace.id }),
    ...(session === undefined ? {} : { sessionId: session.id }),
    view: "chat",
  };
}

async function navigateToCasual(
  context: OpenContext,
  project: PluginProject,
  workspace: CatalogWorkspace | undefined,
  session: { readonly id: string },
): Promise<void> {
  await context.navigate(destination(context, project, workspace, session), { history: "replace" });
}

function catalogOf(value: object): PluginCatalog | undefined {
  const candidate = (value as { catalog?: unknown }).catalog;
  if (typeof candidate !== "object" || candidate === null) return undefined;
  const catalog = candidate as Partial<PluginCatalog>;
  if (catalog.version !== 1) return undefined;
  if (typeof catalog.workspaces?.list !== "function") return undefined;
  if (typeof catalog.sessions?.list !== "function") return undefined;
  return catalog as PluginCatalog;
}

function normalizePath(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

function basename(path: string): string {
  const parts = normalizePath(path).split(/[\\/]/);
  return parts[parts.length - 1] ?? "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
