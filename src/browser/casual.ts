import type {
  ApplicationPanelContext,
  PluginNavigate,
  PluginNavigationDestination,
  PluginProject,
  PluginRuntimeContext,
  PluginSelectedSession,
  PluginSelectionService,
} from "@jmfederico/pi-web/plugin-api";
import { bootstrapCasual, casualChatUrl, reloadToCasualChat, reloadToCasualPanel } from "./bootstrap.js";
import { clickCasualTab, clickStartSession, waitFor } from "./dom.js";
import { patchRecord, readRecord, type CasualRecord, type ProjectChatPoint } from "./store.js";
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

export interface CasualStatus {
  readonly kind: CasualStatusKind;
  readonly message?: string;
  readonly detail?: string;
  readonly projects?: readonly PluginProject[];
  readonly canRetry?: boolean;
}

const statuses = new Map<string, CasualStatus>();
const openTasks = new Map<string, Promise<void>>();
const newTasks = new Map<string, Promise<void>>();
const chooserMachines = new Set<string>();
let selectionService: PluginSelectionService | undefined;
let latestPanelContext: OpenContext | undefined;
/**
 * Set when an explicit control (\u2042, Open chat, the palette action) asked for
 * the chat but only the panel mount can act on it. Clicking the Casual tab never
 * sets this: the tab is Casual's own view and stays on the card.
 */
let openIntentAt = 0;
/** Set when \u2042 is clicked before the panel has mounted, so the mount can perform the return. */
let returnIntentAt = 0;
/** Window name of the separate Casual tab, so later \u2042 presses focus it instead of stacking tabs. */
const CASUAL_WINDOW_NAME = "pi-web-casual-chat";

export function setSelectionService(service: PluginSelectionService | undefined): void {
  selectionService = service;
}

export function setLatestPanelContext(context: OpenContext): void {
  latestPanelContext = context;
}

export function getLatestPanelContext(): OpenContext | undefined {
  return latestPanelContext;
}

export function getStatus(machineId: string): CasualStatus {
  return statuses.get(machineId) ?? { kind: "idle" };
}

/**
 * Whether this mount should leave the card and open the chat. Only an explicit
 * request does that; the Casual tab itself always renders the card and stays
 * there, so the tab behaves like its own view instead of a redirect into the
 * project chat.
 */
export function takeOpenIntent(): boolean {
  const requested = Date.now() - openIntentAt < 5000;
  openIntentAt = 0;
  return requested;
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
  patchRecord(context.machineId, {
    workspaceId: undefined,
    workspacePath: undefined,
    sessionId: undefined,
    sessionName: undefined,
  });
  return openCasual(context);
}

/** Forget the project as well, so the panel offers the project chooser again. */
export function changeCasualHome(context: OpenContext): Promise<void> {
  patchRecord(context.machineId, {
    projectId: undefined,
    projectPath: undefined,
    workspaceId: undefined,
    workspacePath: undefined,
    sessionId: undefined,
    sessionName: undefined,
  });
  chooserMachines.add(context.machineId);
  return openCasual(context);
}

/** Which side of the \u2042 toggle the current selection represents. */
export type CasualSide = "casual" | "project" | "unknown";

function isCasualProject(
  project: { readonly id: string; readonly path: string } | undefined,
  record: CasualRecord,
): boolean {
  if (project === undefined) return false;
  if (record.projectId !== undefined && record.projectId === project.id) return true;
  return basename(project.path).toLowerCase() === ".casual-pi-web";
}

export function casualSide(): CasualSide {
  const snapshot = selectionService?.getSnapshot();
  const machineId = snapshot?.selectedMachine?.id ?? latestPanelContext?.machineId;
  const project = snapshot?.selectedProject;
  if (project === undefined || machineId === undefined) return "unknown";
  return isCasualProject(project, readRecord(machineId)) ? "casual" : "project";
}

/** Labels for the injected \u2042 button, which toggles as well as opens. */
export function casualButtonLabels(): { title: string; aria: string } {
  return casualSide() === "casual"
    ? { title: "Back to your project chat", aria: "Back to your project chat" }
    : { title: "Open Casual chat (\u2042)", aria: "Open Casual chat" };
}

/**
 * Remember the project chat the toggle should return to. Called when the Casual
 * card renders (the tab is visited before anything navigates, so the selection
 * is still the project chat) and again while Casual is opening, before
 * navigation replaces the selection. Skipped when the current selection is
 * Casual itself so the point is never self-referential.
 */
export function captureProjectChatPoint(context: OpenContext): void {
  const snapshot = selectionService?.getSnapshot();
  const record = readRecord(context.machineId);
  const project = snapshot?.selectedProject;
  if (project === undefined || isCasualProject(project, record)) return;

  const workspace = snapshot?.selectedWorkspace;
  const session = snapshot?.selectedSession;
  const point: ProjectChatPoint = {
    projectId: project.id,
    projectPath: project.path,
    ...(workspace === undefined
      ? {}
      : {
          ...(workspace.id === "" ? {} : { workspaceId: workspace.id }),
          ...(workspace.path === "" ? {} : { workspacePath: workspace.path }),
        }),
    ...(session === undefined
      ? {}
      : {
          sessionId: session.id,
          ...(session.name === undefined ? {} : { sessionName: session.name }),
        }),
  };
  patchRecord(context.machineId, { projectChat: point });
}

/**
 * Resolve where the project side of the toggle should land. The catalog is used
 * when available so an archived session or removed project does not produce a
 * broken route; without it the remembered ids are used as-is.
 */
async function projectChatDestination(
  context: OpenContext,
  point: ProjectChatPoint | undefined,
): Promise<PluginNavigationDestination | undefined> {
  const projectId = point?.projectId;
  if (projectId === undefined) return undefined;

  const base = { machineId: context.machineId, projectId, view: "chat" as const };
  if (context.catalog === undefined) {
    return {
      ...base,
      ...(point?.workspaceId === undefined ? {} : { workspaceId: point.workspaceId }),
      ...(point?.sessionId === undefined ? {} : { sessionId: point.sessionId }),
    };
  }

  try {
    const workspaces = await context.catalog.workspaces.list(projectId);
    if (workspaces.length === 0) {
      // The project is gone; forget the point rather than retrying it forever.
      patchRecord(context.machineId, { projectChat: undefined });
      return undefined;
    }
    const workspace =
      workspaces.find((candidate) => candidate.id === point?.workspaceId) ??
      workspaces.find((candidate) => candidate.isMain) ??
      workspaces[0];
    if (workspace === undefined) return undefined;
    const sessions = await context.catalog.sessions.list({
      projectId,
      workspaceId: workspace.id,
    });
    const live = sessions.filter((session) => !session.archived);
    const session = live.find((candidate) => candidate.id === point?.sessionId) ?? live[0];
    return {
      ...base,
      workspaceId: workspace.id,
      ...(session === undefined ? {} : { sessionId: session.id }),
    };
  } catch (error) {
    console.warn("[pi-web-casual] could not verify the project chat", error);
    return {
      ...base,
      ...(point?.workspaceId === undefined ? {} : { workspaceId: point.workspaceId }),
      ...(point?.sessionId === undefined ? {} : { sessionId: point.sessionId }),
    };
  }
}

/** Leave Casual for the remembered project chat, or the project list when there is none. */
export async function backToProjectChat(context: OpenContext): Promise<void> {
  const destination = await projectChatDestination(
    context,
    readRecord(context.machineId).projectChat,
  );
  await context.navigate(
    destination ?? { machineId: context.machineId, view: "navigation" },
    { history: "replace" },
  );
  setStatus(context, { kind: "idle" });
}

/** The \u2042 button: open Casual from a project, or return to the project chat from Casual. */
export function openCasualFromButton(context: OpenContext | undefined): void {
  const selectedMachine = selectionService?.getSnapshot().selectedMachine?.id;
  const current =
    context !== undefined && (selectedMachine === undefined || context.machineId === selectedMachine)
      ? context
      : undefined;

  if (casualSide() === "casual") {
    // In the separate window we opened, leaving means closing it: the browser
    // returns focus to the tab that opened it, which is the project chat.
    const ownWindow = inOwnCasualWindow() && current !== undefined;
    if (ownWindow) {
      window.close();
      window.setTimeout(() => {
        if (!window.closed) void backToProjectChat(current);
      }, 0);
      return;
    }
    if (current !== undefined) {
      void backToProjectChat(current);
      return;
    }
    // The panel has not rendered in this page load, so there is no navigate yet.
    // Mount the tab and let doOpenCasual perform the return once it has one.
    returnIntentAt = Date.now();
    if (!clickCasualTab()) {
      returnIntentAt = 0;
      console.warn("[pi-web-casual] the Casual tab is not available yet");
    }
    return;
  }

  if (current === undefined) {
    // \u2042 was clicked before the panel ever rendered, so there is no navigate
    // yet. Ask the mount to open the chat once it has one.
    openIntentAt = Date.now();
    if (!clickCasualTab()) {
      openIntentAt = 0;
      console.warn("[pi-web-casual] the Casual tab is not available yet");
    }
    return;
  }
  const status = getStatus(current.machineId);
  if (status.kind === "setup" || status.kind === "error") {
    // Show the card so the user can act on the problem instead of retrying blind.
    if (!clickCasualTab()) void openCasual(current);
    return;
  }
  // Leave the project chat exactly where it is and put Casual beside it.
  void openCasualInOwnTab(current);
}

/** True when this document runs inside the separate window Casual opened. */
function inOwnCasualWindow(): boolean {
  try {
    return window.name === CASUAL_WINDOW_NAME;
  } catch {
    return false;
  }
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
  };
}

/** Route URL for the remembered casual chat, used by the panel's embedded surface. */
export function casualChatSrc(context: OpenContext): string | undefined {
  const record = readRecord(context.machineId);
  if (record.projectId === undefined || record.sessionId === undefined) return undefined;
  return casualChatUrl(context.machineId, record.projectId, record.workspaceId, record.sessionId);
}

const pointerRefreshes = new Map<string, string>();

/**
 * Keep the remembered pointer in step with the newest live casual session
 * without navigating, so the embedded chat opens the same conversation that
 * Open chat would. The key guard stops a patch/render loop.
 */
export async function refreshCasualPointer(context: OpenContext): Promise<void> {
  const record = readRecord(context.machineId);
  if (record.sessionId === undefined) return;
  const key = `${record.projectId ?? ""}\u0000${record.workspaceId ?? ""}\u0000${record.sessionId}`;
  if (pointerRefreshes.get(context.machineId) === key) return;
  pointerRefreshes.set(context.machineId, key);

  const target = await resolveCasualTarget(context);
  if (target?.session === undefined) return;
  const latest = readRecord(context.machineId);
  const unchanged =
    latest.projectId === target.project.id &&
    latest.workspaceId === target.workspace?.id &&
    latest.sessionId === target.session.id;
  if (unchanged) return;
  rememberLocation(context, target.project, target.workspace);
  rememberSession(context, target.session);
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
  if (Date.now() - returnIntentAt < 5000) {
    returnIntentAt = 0;
    await backToProjectChat(context);
    return;
  }
  captureProjectChatPoint(context);
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
  captureProjectChatPoint(context);
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
