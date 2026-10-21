import type {
  ApplicationPanelContext,
  PluginNavigate,
  PluginNavigationDestination,
  PluginProject,
  PluginRuntimeContext,
  PluginSelectedSession,
  PluginSelectionService,
} from "@jmfederico/pi-web/plugin-api";
import { bootstrapCasual, reloadToCasualChat, reloadToCasualPanel } from "./bootstrap.js";
import { clickCasualTab, clickStartSession, waitFor } from "./dom.js";
import { patchRecord, readRecord, type CasualRecord } from "./store.js";
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
let casualIntentAt = 0;

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
 * Called from a capture-phase click listener when the host's Casual tab is
 * clicked. Marking intent lets the panel auto-open on mount; if the panel is
 * already mounted, the click still needs to open the chat directly.
 */
export function markCasualTabIntent(): void {
  casualIntentAt = Date.now();
  const context = latestPanelContext;
  const selectedMachine = selectionService?.getSnapshot().selectedMachine?.id;
  if (
    context === undefined ||
    (selectedMachine !== undefined && context.machineId !== selectedMachine)
  ) {
    return;
  }
  queueMicrotask(() => {
    if (context === latestPanelContext) void openCasual(context);
  });
}

/**
 * Auto-open only when the user just asked for the tab, when nothing is
 * selected, or when the selected project is already the casual project.
 * This prevents a default-selected tool tab from hijacking another project's
 * chat on page load.
 */
export async function shouldAutoOpenOnMount(context: OpenContext): Promise<boolean> {
  const recent = Date.now() - casualIntentAt < 2000;
  casualIntentAt = 0;
  if (recent) return true;

  const record = readRecord(context.machineId);
  const routeProject = new URLSearchParams(window.location.search).get("project");
  if (routeProject !== null && routeProject !== "" && routeProject !== record.projectId) {
    return false;
  }

  // Route restoration and the initial project load can finish after the panel
  // mounts. Give them a moment before treating "nothing selected" as a fresh
  // app, so a default-selected tool tab cannot steal another project's chat.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 500));

  const project = selectionService?.getSnapshot().selectedProject;
  if (project === undefined) return true;
  if (record.projectId !== undefined && record.projectId === project.id) return true;
  return basename(project.path).toLowerCase() === ".casual-pi-web";
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

/**
 * Entry point for the injected \u2042 button. If the panel has never rendered
 * in this page load, select its tab so the panel mounts and auto-opens. If we
 * already have a context but the last attempt needs user attention, show the
 * panel rather than retrying invisibly.
 */
export function openCasualFromButton(context: OpenContext | undefined): void {
  const selectedMachine = selectionService?.getSnapshot().selectedMachine?.id;
  const current =
    context !== undefined && (selectedMachine === undefined || context.machineId === selectedMachine)
      ? context
      : undefined;
  if (current === undefined) {
    if (!clickCasualTab()) console.warn("[pi-web-casual] the Casual tab is not available yet");
    return;
  }
  const status = getStatus(current.machineId);
  if (status.kind === "setup" || status.kind === "error") {
    if (!clickCasualTab()) void openCasual(current);
    return;
  }
  void openCasual(current);
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
