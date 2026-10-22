import { bootstrapCasual, casualChatUrl, reloadToCasualChat, reloadToCasualPanel } from "./bootstrap.js";
import { clickStartSession, waitFor } from "./dom.js";
import { patchRecord, readRecord } from "./store.js";
const statuses = new Map();
const openTasks = new Map();
const newTasks = new Map();
const chooserMachines = new Set();
let selectionService;
/** Window name of the separate Casual tab, so later opens focus it instead of stacking tabs. */
const CASUAL_WINDOW_NAME = "pi-web-casual-chat";
export function setSelectionService(service) {
    selectionService = service;
}
export function getStatus(machineId) {
    return statuses.get(machineId) ?? { kind: "idle" };
}
function setStatus(context, status) {
    statuses.set(context.machineId, status);
    try {
        context.requestRender?.();
    }
    catch (error) {
        console.warn("[pi-web-casual] could not refresh the panel", error);
    }
}
export function panelOpenContext(context) {
    const catalog = catalogOf(context);
    return {
        machineId: context.machine.id,
        navigate: context.navigate,
        ...(context.projects === undefined ? {} : { projects: context.projects }),
        ...(catalog === undefined ? {} : { catalog }),
        requestRender: () => context.host.requestRender(),
    };
}
export function runtimeOpenContext(context) {
    const catalog = catalogOf(context);
    return {
        machineId: context.state.selectedMachine?.id ?? "local",
        navigate: context.navigate,
        ...(context.projects === undefined ? {} : { projects: context.projects }),
        ...(catalog === undefined ? {} : { catalog }),
    };
}
export function openCasual(context) {
    const existing = openTasks.get(context.machineId);
    if (existing !== undefined)
        return existing;
    let task;
    task = doOpenCasual(context).finally(() => {
        if (openTasks.get(context.machineId) === task)
            openTasks.delete(context.machineId);
    });
    openTasks.set(context.machineId, task);
    return task;
}
export function newCasualChat(context) {
    const existing = newTasks.get(context.machineId);
    if (existing !== undefined)
        return existing;
    let task;
    task = doNewCasualChat(context).finally(() => {
        if (newTasks.get(context.machineId) === task)
            newTasks.delete(context.machineId);
    });
    newTasks.set(context.machineId, task);
    return task;
}
export function chooseProject(context, project) {
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
export function resetCasualLink(context) {
    patchRecord(context.machineId, {
        workspaceId: undefined,
        workspacePath: undefined,
        sessionId: undefined,
        sessionName: undefined,
    });
    return openCasual(context);
}
/** Forget the project as well, so the panel offers the project chooser again. */
export function changeCasualHome(context) {
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
function openCasualWindow() {
    try {
        return window.open("", CASUAL_WINDOW_NAME);
    }
    catch (error) {
        console.warn("[pi-web-casual] could not open a separate window", error);
        return null;
    }
}
async function resolveCasualTarget(context) {
    const project = await resolveProject(context);
    if (project === undefined)
        return undefined;
    const record = readRecord(context.machineId);
    const discovered = await discover(context, project, record);
    const workspace = discovered.workspace ?? workspaceFromRecord(project, record);
    const session = discovered.session ?? (discovered.authoritative ? undefined : sessionFromRecord(record));
    return {
        project,
        ...(workspace === undefined ? {} : { workspace }),
        ...(session === undefined ? {} : { session }),
    };
}
/** Route URL for the remembered casual chat, used by the panel's embedded surface. */
export function casualChatSrc(context) {
    const record = readRecord(context.machineId);
    if (record.projectId === undefined || record.sessionId === undefined)
        return undefined;
    return casualChatUrl(context.machineId, record.projectId, record.workspaceId, record.sessionId);
}
const pointerRefreshes = new Map();
/**
 * Keep the remembered pointer in step with the newest live casual session
 * without navigating, so the embedded chat opens the same conversation that
 * Open chat would. The key guard stops a patch/render loop.
 */
export async function refreshCasualPointer(context) {
    const record = readRecord(context.machineId);
    if (record.sessionId === undefined)
        return;
    const key = `${record.projectId ?? ""}\u0000${record.workspaceId ?? ""}\u0000${record.sessionId}`;
    if (pointerRefreshes.get(context.machineId) === key)
        return;
    pointerRefreshes.set(context.machineId, key);
    const target = await resolveCasualTarget(context);
    if (target?.session === undefined)
        return;
    const latest = readRecord(context.machineId);
    const unchanged = latest.projectId === target.project.id &&
        latest.workspaceId === target.workspace?.id &&
        latest.sessionId === target.session.id;
    if (unchanged)
        return;
    rememberLocation(context, target.project, target.workspace);
    rememberSession(context, target.session);
    context.requestRender?.();
}
/**
 * Open Casual in its own browser tab, or focus the one already open, so the
 * project chat in this tab stays untouched. The window is created synchronously
 * before any await because a popup blocker only allows it inside the gesture.
 */
export async function openCasualInOwnTab(context) {
    const handle = openCasualWindow();
    const target = await resolveCasualTarget(context);
    const session = target?.session;
    if (handle === null || target === undefined || session === undefined) {
        // Nothing to point a separate window at yet (first run, or no session in
        // the home): let the normal flow create it here instead.
        if (handle !== null)
            handle.close();
        await openCasual(context);
        return;
    }
    handle.location.replace(casualChatUrl(context.machineId, target.project.id, target.workspace?.id, session.id));
    handle.focus();
}
async function doOpenCasual(context) {
    setStatus(context, { kind: "opening", message: "Finding your casual conversation\u2026" });
    try {
        if (chooserMachines.delete(context.machineId)) {
            await showSetup(context, "choose");
            return;
        }
        const project = await resolveProject(context);
        if (project === undefined) {
            if (await bootstrapAndReload(context))
                return;
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
    }
    catch (error) {
        console.warn("[pi-web-casual] open failed", error);
        setStatus(context, {
            kind: "error",
            message: "Something went wrong opening Casual.",
            detail: errorMessage(error),
            canRetry: true,
        });
    }
}
async function doNewCasualChat(context) {
    setStatus(context, { kind: "opening", message: "Starting a fresh casual chat\u2026" });
    try {
        if (chooserMachines.delete(context.machineId)) {
            await showSetup(context, "choose");
            return;
        }
        const project = await resolveProject(context);
        if (project === undefined) {
            if (await bootstrapAndReload(context))
                return;
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
    }
    catch (error) {
        console.warn("[pi-web-casual] new chat failed", error);
        setStatus(context, {
            kind: "error",
            message: "Something went wrong starting a new chat.",
            detail: errorMessage(error),
            canRetry: true,
        });
    }
}
async function showSetup(context, reason = "failed") {
    setStatus(context, {
        kind: "setup",
        message: reason === "choose" ? "Choose a home for Casual." : "Casual could not create its home folder.",
        detail: reason === "choose"
            ? "Select an existing project, or add ~/.casual-pi-web as a PI WEB project."
            : "Add ~/.casual-pi-web as a PI WEB project, or choose an existing project below.",
        projects: await listProjects(context),
        canRetry: true,
    });
}
async function bootstrapAndReload(context) {
    setStatus(context, { kind: "opening", message: "Creating your casual space\u2026" });
    const result = await bootstrapCasual(context.machineId);
    if (result === undefined)
        return false;
    patchRecord(context.machineId, {
        projectId: result.project.id,
        projectPath: result.project.path,
        workspaceId: result.workspaceId,
        workspacePath: result.workspacePath,
        sessionId: result.sessionId,
        sessionName: undefined,
    });
    // Let the panel paint the "Creating..." state before the one-time reload.
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    if (result.sessionId !== undefined) {
        reloadToCasualChat(context.machineId, result.project.id, result.workspaceId, result.sessionId);
    }
    else {
        reloadToCasualPanel(context.machineId, result.project.id, result.workspaceId);
    }
    return true;
}
async function resolveProject(context) {
    const projects = await listProjects(context);
    const record = readRecord(context.machineId);
    if (record.projectPath !== undefined) {
        const wanted = normalizePath(record.projectPath);
        const exact = projects.find((project) => normalizePath(project.path) === wanted);
        if (exact !== undefined)
            return exact;
        const insensitive = projects.find((project) => normalizePath(project.path).toLowerCase() === wanted.toLowerCase());
        if (insensitive !== undefined)
            return insensitive;
    }
    if (record.projectId !== undefined) {
        const match = projects.find((project) => project.id === record.projectId);
        if (match !== undefined)
            return match;
    }
    return projects.find((project) => basename(project.path).toLowerCase() === ".casual-pi-web");
}
async function listProjects(context) {
    if (context.projects === undefined)
        return [];
    try {
        return await context.projects.listProjects();
    }
    catch (error) {
        console.warn("[pi-web-casual] could not list projects", error);
        return [];
    }
}
async function discover(context, project, record) {
    if (context.catalog === undefined)
        return { authoritative: false };
    try {
        const workspaces = await context.catalog.workspaces.list(project.id);
        const workspace = workspaces.find((candidate) => candidate.id === record.workspaceId) ??
            workspaces.find((candidate) => candidate.isMain) ??
            workspaces[0];
        if (workspace === undefined)
            return { authoritative: true };
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
    }
    catch (error) {
        console.warn("[pi-web-casual] catalog discovery failed", error);
        return { authoritative: false };
    }
}
async function createCasualSession(context, project, workspace, forceNew) {
    const service = selectionService;
    if (service === undefined) {
        console.warn("[pi-web-casual] the host selection service is unavailable");
        return undefined;
    }
    const selectedWorkspace = await waitFor(() => {
        const snapshot = service.getSnapshot();
        const selected = snapshot.selectedWorkspace;
        if (selected === undefined || selected.projectId !== project.id)
            return undefined;
        if (workspace !== undefined && workspace.id !== "" && selected.id !== workspace.id)
            return undefined;
        return selected;
    }, 8000);
    if (selectedWorkspace === undefined)
        return undefined;
    const resolvedWorkspace = {
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
            if (session === undefined || session.pending || session.archived)
                return undefined;
            if (snapshot.selectedWorkspace?.id !== selectedWorkspace.id)
                return undefined;
            return session;
        }, 1500);
        if (existing !== undefined) {
            return { session: toCasualSession(existing), workspace: resolvedWorkspace };
        }
    }
    if (context.startSession !== undefined) {
        try {
            await context.startSession();
        }
        catch (error) {
            console.warn("[pi-web-casual] could not start a session", error);
            return undefined;
        }
    }
    else {
        const clicked = await waitFor(() => clickStartSession(), 8000, 150);
        if (clicked !== true)
            return undefined;
    }
    const created = await waitFor(() => {
        const snapshot = service.getSnapshot();
        const session = snapshot.selectedSession;
        if (session === undefined || session.pending || session.archived)
            return undefined;
        if (session.id === before?.id)
            return undefined;
        if (snapshot.selectedWorkspace?.id !== selectedWorkspace.id)
            return undefined;
        return session;
    }, 25000);
    return created === undefined
        ? undefined
        : { session: toCasualSession(created), workspace: resolvedWorkspace };
}
function toCasualSession(session) {
    return {
        id: session.id,
        ...(session.name === undefined ? {} : { name: session.name }),
        cwd: session.cwd,
        archived: session.archived,
        runtime: "idle",
    };
}
function sessionFromRecord(record) {
    if (record.sessionId === undefined)
        return undefined;
    return {
        id: record.sessionId,
        ...(record.sessionName === undefined ? {} : { name: record.sessionName }),
        cwd: record.workspacePath ?? "",
        archived: false,
        runtime: "not-hosted",
    };
}
function workspaceFromRecord(project, record) {
    if (record.workspaceId === undefined)
        return undefined;
    return {
        id: record.workspaceId,
        projectId: project.id,
        path: record.workspacePath ?? "",
        label: "",
        isMain: false,
    };
}
function rememberLocation(context, project, workspace) {
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
function rememberSession(context, session) {
    patchRecord(context.machineId, {
        sessionId: session.id,
        sessionName: session.name,
        ...(session.cwd === "" ? {} : { workspacePath: session.cwd }),
    });
}
function destination(context, project, workspace, session) {
    return {
        machineId: context.machineId,
        projectId: project.id,
        ...(workspace === undefined || workspace.id === "" ? {} : { workspaceId: workspace.id }),
        ...(session === undefined ? {} : { sessionId: session.id }),
        view: "chat",
    };
}
async function navigateToCasual(context, project, workspace, session) {
    await context.navigate(destination(context, project, workspace, session), { history: "replace" });
}
function catalogOf(value) {
    const candidate = value.catalog;
    if (typeof candidate !== "object" || candidate === null)
        return undefined;
    const catalog = candidate;
    if (catalog.version !== 1)
        return undefined;
    if (typeof catalog.workspaces?.list !== "function")
        return undefined;
    if (typeof catalog.sessions?.list !== "function")
        return undefined;
    return catalog;
}
function normalizePath(path) {
    return path.replace(/[\\/]+$/, "");
}
function basename(path) {
    const parts = normalizePath(path).split(/[\\/]/);
    return parts[parts.length - 1] ?? "";
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
