import { archiveCasualSession, bootstrapCasual, CASUAL_PANEL_TOOL, casualChatUrl, listHomeSessions, listProjectWorkspaces, reloadToCasualPanel, restoreCasualSession, startCasualSession, } from "./bootstrap.js";
import { queueSharedState, readSharedState, sameSharedContent, sharedStateOf, } from "./shared.js";
import { adoptRecord, patchRecord, readRecord, } from "./store.js";
const statuses = new Map();
/**
 * A short-lived line for the strip when a strip action could not complete. The
 * card is for the conversation as a whole; a failed tab action must not replace
 * the chat that is on screen.
 */
const stripNotices = new Map();
const stripNoticeTimers = new Map();
/**
 * Conversations this page load started. The catalog and the host's session list
 * only know a session once it has a file, which a session gets with its first
 * message, so a brand-new conversation is invisible to discovery for a moment.
 * Without this, a refresh pass would treat it as deleted: it would prune its tab
 * and pull the user back to an older conversation while they were still typing.
 */
const startedHere = new Set();
const openTasks = new Map();
const newTasks = new Map();
const chooserMachines = new Set();
/**
 * How long a conversation a browser has not seen yet is allowed to be missing
 * from the host's session list before its tab is pruned. Another device can add
 * a conversation and write the strip before the host has a file for it, and this
 * browser must not undo that.
 */
const FRESH_TAB_GRACE_MS = 10 * 60_000;
/** One shared-state read per panel render is enough; renders come in bursts. */
const SYNC_INTERVAL_MS = 2500;
const syncRuns = new Map();
export function getStatus(machineId) {
    return statuses.get(machineId) ?? { kind: "idle" };
}
/** The strip for one machine, numbered by position, with the active one marked. */
export function readCasualTabs(machineId) {
    const record = readRecord(machineId);
    return (record.tabs ?? []).map((tab, index) => ({
        sessionId: tab.sessionId,
        number: index + 1,
        ...(tab.sessionName === undefined ? {} : { name: tab.sessionName }),
        active: tab.sessionId === record.sessionId,
    }));
}
/** The line the strip shows when a tab action could not complete. */
export function casualStripNotice(machineId) {
    return stripNotices.get(machineId);
}
function setStripNotice(context, message) {
    const pending = stripNoticeTimers.get(context.machineId);
    if (pending !== undefined)
        window.clearTimeout(pending);
    stripNoticeTimers.delete(context.machineId);
    if (message === undefined) {
        stripNotices.delete(context.machineId);
    }
    else {
        stripNotices.set(context.machineId, message);
        stripNoticeTimers.set(context.machineId, window.setTimeout(() => {
            stripNoticeTimers.delete(context.machineId);
            stripNotices.delete(context.machineId);
            context.requestRender?.();
        }, 6000));
    }
    context.requestRender?.();
}
/** Show an existing conversation in the panel without navigating anywhere. */
export function activateCasualTab(context, sessionId) {
    const record = readRecord(context.machineId);
    if (record.sessionId === sessionId)
        return;
    const tab = (record.tabs ?? []).find((candidate) => candidate.sessionId === sessionId);
    // The strip is drawn from the record, so a tab that is on screen but missing
    // from the record is a bug in the record: adopt the tab rather than ignore the
    // click, which would make the tab look dead.
    setStripNotice(context, undefined);
    archiveUndos.delete(context.machineId);
    patchCasual(context, {
        sessionId,
        ...(tab?.sessionName === undefined ? {} : { sessionName: tab.sessionName }),
        ...(tab === undefined
            ? { tabs: [...(record.tabs ?? []), { sessionId, addedAt: Date.now() }] }
            : {}),
    });
    context.requestRender?.();
}
/**
 * The strip's **+**: start another conversation in the same home and make it the
 * active tab. This deliberately does not navigate the host page. The session is
 * created through the same route first run uses, so it works on every supported
 * host instead of depending on the sidebar's **+** button.
 *
 * The palette's **New Casual Chat** runs the same code and then brings the Casual
 * tab forward, so every conversation starts inside the tab that shows the strip.
 */
export async function newCasualTab(context) {
    const home = await resolveHome(context);
    const record = readRecord(context.machineId);
    const cwd = home?.workspace?.path ??
        home?.project.path ??
        record.workspacePath ??
        record.projectPath;
    if (cwd === undefined)
        return false;
    const created = await startCasualSession(context.machineId, cwd);
    if (created === undefined) {
        setStripNotice(context, "Could not start a new conversation.");
        return false;
    }
    startedHere.add(created.id);
    archiveUndos.delete(context.machineId);
    patchCasual(context, {
        // Append explicitly as well as making it active: the strip's order is the
        // user's, and a new conversation belongs at the end of it.
        tabs: [
            ...(record.tabs ?? []),
            {
                sessionId: created.id,
                ...(created.name === undefined ? {} : { sessionName: created.name }),
                addedAt: Date.now(),
            },
        ],
        sessionId: created.id,
        ...(created.name === undefined ? {} : { sessionName: created.name }),
    });
    setStripNotice(context, undefined);
    context.requestRender?.();
    return true;
}
const archiveUndos = new Map();
/** The strip's Undo, if the last action there archived something. */
export function casualArchiveUndo(machineId) {
    return archiveUndos.get(machineId);
}
/**
 * Put back the conversation the last **×** archived. Casual's home row is hidden
 * from **Projects**, so the host's **Archived** list is awkward to reach from
 * here; without this, a misclick would look permanent.
 */
export async function undoCasualArchive(context) {
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
        addedAt: Date.now(),
    });
    patchCasual(context, {
        tabs,
        sessionId: undo.sessionId,
        ...(undo.sessionName === undefined ? {} : { sessionName: undo.sessionName }),
    });
    archiveUndos.delete(context.machineId);
    setStripNotice(context, undefined);
    context.requestRender?.();
}
/**
 * The strip's **×**: archive the conversation and drop its tab. Archiving is the
 * host's own session action, so the conversation keeps its place in PI WEB's
 * **Archived** sessions and can be restored there. The last tab stays: Casual is
 * never left without a conversation to show.
 */
export async function archiveCasualTab(context, sessionId) {
    const record = readRecord(context.machineId);
    const tabs = record.tabs ?? [];
    const index = tabs.findIndex((tab) => tab.sessionId === sessionId);
    if (index < 0)
        return;
    if (tabs.length <= 1) {
        setStripNotice(context, "Casual keeps one conversation.");
        return;
    }
    if (record.projectId === undefined || record.workspaceId === undefined)
        return;
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
    patchCasual(context, {
        tabs: remaining,
        ...(record.sessionId !== sessionId || neighbour === undefined
            ? {}
            : { sessionId: neighbour.sessionId, sessionName: neighbour.sessionName }),
    });
    if (result === "unsupported") {
        archiveUndos.delete(context.machineId);
        setStripNotice(context, "Archiving needs a newer PI WEB; the conversation stays in Sessions.");
    }
    else {
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
    // The public way for a palette action to land on the plugin's own tab without
    // moving the project chat that is open in the main column. A runtime context
    // has no renderer of its own; selecting the tool is what draws the panel the
    // first time, and the panel repaints itself while a flow is in flight.
    const selectPanel = () => context.selectWorkspaceTool(CASUAL_PANEL_TOOL);
    return {
        machineId: context.state.selectedMachine?.id ?? "local",
        navigate: context.navigate,
        ...(context.projects === undefined ? {} : { projects: context.projects }),
        ...(catalog === undefined ? {} : { catalog }),
        selectPanel,
        requestRender: selectPanel,
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
    patchCasual(context, {
        projectId: project.id,
        projectPath: project.path,
        workspaceId: undefined,
        workspacePath: undefined,
        sessionId: undefined,
        sessionName: undefined,
        tabs: [],
    });
    return openCasual(context);
}
/** Forget the remembered conversation but keep the casual project. */
export function resetCasualLink(context) {
    archiveUndos.delete(context.machineId);
    patchCasual(context, {
        workspaceId: undefined,
        workspacePath: undefined,
        sessionId: undefined,
        sessionName: undefined,
        tabs: [],
    });
    return openCasual(context);
}
/** Forget the project as well, so the panel offers the project chooser again. */
export function changeCasualHome(context) {
    archiveUndos.delete(context.machineId);
    patchCasual(context, {
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
/**
 * Write the strip locally and to the copy the other devices read. A record with
 * no home yet (first run, after **Change home**) has nowhere to publish to, so it
 * stays local until a home is resolved.
 */
function patchCasual(context, patch) {
    const record = patchRecord(context.machineId, patch);
    shareRecord(context.machineId, record);
    return record;
}
function shareRecord(machineId, record) {
    if (record.projectId === undefined || record.workspaceId === undefined)
        return;
    queueSharedState(machineId, record.projectId, record.workspaceId, sharedStateOf(record));
}
/** Route URL for the remembered casual chat, used by the panel's embedded surface. */
export function casualChatSrc(context) {
    const record = readRecord(context.machineId);
    if (record.projectId === undefined || record.sessionId === undefined)
        return undefined;
    return casualChatUrl(context.machineId, record.projectId, record.workspaceId, record.sessionId);
}
async function resolveHome(context) {
    const project = await resolveProject(context);
    if (project === undefined)
        return undefined;
    const record = readRecord(context.machineId);
    const discovered = await discover(context, project, record);
    const workspace = discovered.workspace ??
        workspaceFromRecord(project, record) ??
        (await hostWorkspace(context, project.id));
    const live = discovered.sessions ??
        (await homeSessions(context, workspace?.path ?? record.workspacePath ?? project.path));
    return {
        project,
        ...(workspace === undefined ? {} : { workspace }),
        ...(live === undefined ? {} : { live }),
    };
}
/** Live conversations for the home from the host's list route, for hosts without a catalog. */
async function homeSessions(context, cwd) {
    if (cwd === undefined)
        return undefined;
    const sessions = await listHomeSessions(context.machineId, cwd);
    if (sessions === undefined)
        return undefined;
    return sessions
        .filter((session) => !session.archived)
        .map((session) => ({
        id: session.id,
        cwd,
        ...(session.name === undefined ? {} : { name: session.name }),
        archived: false,
        runtime: "not-hosted",
    }));
}
/**
 * Read the home, the shared strip, and the host's own session list, then settle
 * on one strip: a newer shared write from another device wins, conversations the
 * host no longer has are dropped, names come from the host, and a missing active
 * conversation falls back to a live one.
 *
 * Runs on every panel render (throttled), so a conversation picked on a phone is
 * the one this browser shows on its next render, without a reload.
 */
export async function syncCasualHome(context, options = {}) {
    const run = syncRuns.get(context.machineId);
    if (run?.running === true)
        return;
    const now = Date.now();
    if (options.force !== true && run !== undefined && now - run.at < SYNC_INTERVAL_MS)
        return;
    syncRuns.set(context.machineId, { at: now, running: true });
    try {
        const home = options.home ?? (await resolveHome(context));
        if (home !== undefined)
            await applySync(context, home);
    }
    catch (error) {
        console.warn("[pi-web-casual] could not refresh the casual home", error);
    }
    finally {
        const latest = syncRuns.get(context.machineId);
        if (latest !== undefined)
            latest.running = false;
    }
}
function isFreshTab(tab, now) {
    return tab?.addedAt !== undefined && now - tab.addedAt < FRESH_TAB_GRACE_MS;
}
/**
 * Settle a strip against the host's own list: conversations the host no longer
 * has are dropped, a conversation another device just added is kept for a while
 * even though the host has no file for it yet, names are refreshed, and an
 * active conversation that is gone falls back to a live one.
 */
function reconcile(record, live) {
    const tabs = record.tabs ?? [];
    const activeId = record.sessionId;
    if (live === undefined) {
        return {
            tabs: [...tabs],
            ...(activeId === undefined ? {} : { sessionId: activeId }),
            ...(record.sessionName === undefined ? {} : { sessionName: record.sessionName }),
        };
    }
    const now = Date.now();
    const byId = new Map(live.map((session) => [session.id, session]));
    const kept = tabs
        .filter((tab) => byId.has(tab.sessionId) || startedHere.has(tab.sessionId) || isFreshTab(tab, now))
        .map((tab) => {
        const name = byId.get(tab.sessionId)?.name;
        return name === undefined || name === tab.sessionName ? tab : { ...tab, sessionName: name };
    });
    const activeTab = tabs.find((tab) => tab.sessionId === activeId);
    const activeStays = activeId !== undefined &&
        (byId.has(activeId) || startedHere.has(activeId) || isFreshTab(activeTab, now));
    if (!activeStays) {
        // The active conversation was archived or deleted elsewhere, or never
        // existed: fall back to the first conversation the host still has.
        const fallback = kept.find((tab) => byId.has(tab.sessionId));
        if (fallback === undefined)
            return { tabs: [] };
        return {
            tabs: kept,
            sessionId: fallback.sessionId,
            ...(fallback.sessionName === undefined ? {} : { sessionName: fallback.sessionName }),
        };
    }
    const active = kept.find((tab) => tab.sessionId === activeId);
    return {
        tabs: kept,
        sessionId: activeId,
        ...(active?.sessionName === undefined ? {} : { sessionName: active.sessionName }),
    };
}
function sameTabs(left, right) {
    return (left.length === right.length &&
        left.every((tab, index) => tab.sessionId === right[index]?.sessionId &&
            tab.sessionName === right[index]?.sessionName &&
            tab.addedAt === right[index]?.addedAt));
}
/**
 * Settle the strip against the shared copy. The read is a round trip, and a tab
 * action can land while it is in flight, so the record is re-read before
 * anything is written: a sync that started with an older snapshot gives way
 * instead of undoing the click that happened meanwhile.
 */
async function applySync(context, home) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const before = readRecord(context.machineId);
        const read = await readSharedFor(context, home);
        const local = readRecord(context.machineId);
        if (local.updatedAt !== before.updatedAt)
            continue;
        await applyShared(context, home, local, read);
        return;
    }
}
async function applyShared(context, home, local, read) {
    const shared = read.kind === "state" ? read.state : undefined;
    // The newer write wins. That is the whole of the cross-device rule: whichever
    // browser last changed the strip, its strip is the one every browser shows.
    let record = local;
    if (shared !== undefined && shared.updatedAt > (local.updatedAt ?? 0)) {
        record = adoptRecord(context.machineId, {
            ...local,
            tabs: [...shared.tabs],
            sessionId: shared.sessionId,
            sessionName: undefined,
            updatedAt: shared.updatedAt,
        });
    }
    const next = reconcile(record, home.live);
    const workspace = home.workspace;
    const locationChanged = record.projectId !== home.project.id ||
        record.projectPath !== home.project.path ||
        (workspace !== undefined && workspace.id !== "" && record.workspaceId !== workspace.id);
    const stripChanged = !sameTabs(record.tabs ?? [], next.tabs) ||
        record.sessionId !== next.sessionId ||
        record.sessionName !== next.sessionName;
    const seeding = shared === undefined;
    const sharedChanged = seeding || !sameSharedContent({ tabs: next.tabs, sessionId: next.sessionId }, shared);
    // An empty strip is never published as the first copy: a browser that has no
    // Casual history yet must not overwrite the strip another device already
    // knows, so the file appears with the first conversation instead.
    const shouldShare = sharedChanged && (!seeding || next.tabs.length > 0);
    // Only the strip and the active conversation are shared; a refreshed name or a
    // resolved folder is local knowledge and must not make this browser look like
    // the last writer. Creating the first copy does have to carry a real stamp,
    // otherwise every device keeps its own strip forever.
    const touch = shouldShare && (stripChanged || seeding);
    // Nothing to say to this browser or to the host: leave both alone, so an idle
    // render never becomes a write.
    if (!locationChanged && !stripChanged && !touch)
        return;
    let patched = record;
    if (locationChanged || stripChanged || touch) {
        patched = patchRecord(context.machineId, {
            ...(locationChanged
                ? {
                    projectId: home.project.id,
                    projectPath: home.project.path,
                    ...(workspace === undefined
                        ? {}
                        : {
                            workspaceId: workspace.id,
                            ...(workspace.path === "" ? {} : { workspacePath: workspace.path }),
                        }),
                }
                : {}),
            ...(stripChanged
                ? {
                    tabs: next.tabs,
                    sessionId: next.sessionId,
                    sessionName: next.sessionName,
                }
                : {}),
        }, { touch });
        // The embedded chat is addressed by the project, workspace, and conversation
        // in the record, so a newly resolved home changes what the panel shows even
        // when the strip itself did not move.
        if (stripChanged || locationChanged)
            context.requestRender?.();
    }
    if (shouldShare)
        shareRecord(context.machineId, patched);
}
/** The shared read {@link applySync} needs; a home without a workspace has none. */
function readSharedFor(context, home) {
    const workspace = home.workspace;
    if (workspace === undefined || workspace.id === "") {
        return Promise.resolve({ kind: "unavailable" });
    }
    return readSharedState(context.machineId, home.project.id, workspace.id);
}
/**
 * Bring the plugin's own application tab forward without moving the project chat
 * in the main column. A runtime context can do that; inside the panel there is
 * nothing to select, so this is a no-op there.
 */
async function selectCasualPanel(context) {
    try {
        await context.selectPanel?.();
    }
    catch (error) {
        console.warn("[pi-web-casual] could not open the Casual tab", error);
    }
}
async function doOpenCasual(context) {
    setStatus(context, { kind: "opening", message: "Finding your casual conversation\u2026" });
    try {
        const home = await ensureHome(context);
        if (home === undefined)
            return;
        await syncCasualHome(context, { force: true, home });
        let record = readRecord(context.machineId);
        if (record.sessionId === undefined) {
            const cwd = home.workspace?.path ?? home.project.path;
            const created = await startCasualSession(context.machineId, cwd);
            if (created === undefined) {
                setStatus(context, {
                    kind: "error",
                    message: "Could not start the casual conversation.",
                    detail: "Open the casual workspace, press + next to Sessions, then open \u2042 again.",
                    canRetry: true,
                });
                return;
            }
            startedHere.add(created.id);
            record = patchCasual(context, {
                ...(home.workspace === undefined
                    ? {}
                    : { workspaceId: home.workspace.id, workspacePath: home.workspace.path }),
                tabs: [
                    {
                        sessionId: created.id,
                        ...(created.name === undefined ? {} : { sessionName: created.name }),
                        addedAt: Date.now(),
                    },
                ],
                sessionId: created.id,
                ...(created.name === undefined ? {} : { sessionName: created.name }),
            });
        }
        await selectCasualPanel(context);
        setStatus(context, {
            kind: "ready",
            message: "Casual chat is open.",
            detail: record.sessionName ?? "Your ongoing conversation",
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
        const home = await ensureHome(context);
        if (home === undefined)
            return;
        await syncCasualHome(context, { force: true, home });
        if (!(await newCasualTab(context))) {
            setStatus(context, {
                kind: "error",
                message: "Could not start a new casual chat.",
                detail: "Open the casual workspace, press + next to Sessions, then try again.",
                canRetry: true,
            });
            return;
        }
        await selectCasualPanel(context);
        setStatus(context, {
            kind: "ready",
            message: "New casual chat started.",
            detail: "The previous conversation stays in the strip and in Sessions.",
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
/**
 * The home, or nothing when the flow already ended in a reload or a setup card.
 * Bootstrap reloads once, because registering a project has no API.
 */
async function ensureHome(context) {
    if (chooserMachines.delete(context.machineId)) {
        await showSetup(context, "choose");
        return undefined;
    }
    const home = await resolveHome(context);
    if (home !== undefined)
        return home;
    if (await bootstrapAndReload(context))
        return undefined;
    await showSetup(context, "failed");
    return undefined;
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
    patchCasual(context, {
        projectId: result.project.id,
        projectPath: result.project.path,
        workspaceId: result.workspaceId,
        workspacePath: result.workspacePath,
        sessionId: result.sessionId,
        sessionName: undefined,
        tabs: [],
    });
    // Let the panel paint the "Creating..." state before the one-time reload.
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    reloadToCasualPanel(context.machineId, result.project.id, result.workspaceId);
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
        return {};
    try {
        const workspaces = await context.catalog.workspaces.list(project.id);
        const workspace = workspaces.find((candidate) => candidate.id === record.workspaceId) ??
            workspaces.find((candidate) => candidate.isMain) ??
            workspaces[0];
        if (workspace === undefined)
            return {};
        const sessions = await context.catalog.sessions.list({
            projectId: project.id,
            workspaceId: workspace.id,
        });
        return { workspace, sessions: sessions.filter((session) => !session.archived) };
    }
    catch (error) {
        console.warn("[pi-web-casual] catalog discovery failed", error);
        return {};
    }
}
/**
 * The home workspace from the host's own route, used when the record has none
 * yet — a browser that has never opened Casual, on its first visit.
 */
async function hostWorkspace(context, projectId) {
    const workspaces = await listProjectWorkspaces(context.machineId, projectId);
    if (workspaces === undefined)
        return undefined;
    const workspace = workspaces.find((candidate) => candidate.isMain) ?? workspaces[0];
    if (workspace === undefined)
        return undefined;
    return {
        id: workspace.id,
        projectId,
        path: workspace.path,
        label: "",
        isMain: workspace.isMain,
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
