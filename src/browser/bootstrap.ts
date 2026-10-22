import type { PluginProject } from "@jmfederico/pi-web/plugin-api";

/** Created and trusted automatically on the machine hosting the plugin. */
export const CASUAL_HOME_PATH = "~/.casual-pi-web";
export const CASUAL_PROJECT_NAME = "Casual";
export const CASUAL_PANEL_TOOL = "pi-web-casual:casual";

export interface BootstrapResult {
  readonly project: PluginProject;
  readonly workspaceId?: string;
  readonly workspacePath: string;
  readonly sessionId?: string;
}

type JsonRecord = Record<string, unknown>;

async function requestJson(url: string, init?: RequestInit): Promise<unknown | undefined> {
  try {
    const response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(`[pi-web-casual] ${init?.method ?? "GET"} ${url} failed: ${response.status}`, body);
      return undefined;
    }
    if (response.status === 204) return {};
    return await response.json();
  } catch (error) {
    console.warn(`[pi-web-casual] ${init?.method ?? "GET"} ${url} failed`, error);
    return undefined;
  }
}

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function stringField(record: JsonRecord | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function records(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  const output: JsonRecord[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (record !== undefined) output.push(record);
  }
  return output;
}

/**
 * First-run bootstrap. The public plugin API cannot register a project, so this
 * uses the host's own same-origin project/session endpoints. The folder is
 * expanded and created by the host, which also means `~` resolves on the
 * machine that owns the conversation.
 */
export async function bootstrapCasual(machineId: string): Promise<BootstrapResult | undefined> {
  const base = `api/machines/${encodeURIComponent(machineId)}`;
  const projectRaw = await requestJson(`${base}/projects`, {
    method: "POST",
    body: JSON.stringify({
      path: CASUAL_HOME_PATH,
      name: CASUAL_PROJECT_NAME,
      create: true,
    }),
  });
  const projectRecord = asRecord(projectRaw);
  const projectId = stringField(projectRecord, "id");
  const projectPath = stringField(projectRecord, "path");
  if (projectId === undefined || projectPath === undefined) return undefined;
  const project: PluginProject = {
    id: projectId,
    name: stringField(projectRecord, "name") ?? CASUAL_PROJECT_NAME,
    path: projectPath,
  };

  const resolution = asRecord(
    await requestJson(`${base}/projects/${encodeURIComponent(projectId)}/workspaces`),
  );
  const workspaces = records(resolution?.["workspaces"]);
  const workspace =
    workspaces.find((candidate) => candidate["isMain"] === true) ?? workspaces[0];
  const workspaceId = stringField(workspace, "id");
  const workspacePath = stringField(workspace, "path") ?? projectPath;

  if (workspaceId !== undefined) {
    // The casual folder is a user-owned scratch space; trust it so Pi does not
    // ask about it and can load any settings the user later places there.
    await requestJson(
      `${base}/projects/${encodeURIComponent(projectId)}/workspaces/${encodeURIComponent(workspaceId)}/trust`,
      { method: "PUT", body: JSON.stringify({ trusted: true }) },
    );
  }

  const sessionRaw = await requestJson(`${base}/sessions`, {
    method: "POST",
    body: JSON.stringify({ cwd: workspacePath }),
  });
  const sessionId = stringField(asRecord(sessionRaw), "id");

  return {
    project,
    ...(workspaceId === undefined ? {} : { workspaceId }),
    workspacePath,
    ...(sessionId === undefined ? {} : { sessionId }),
  };
}

/** Reload straight into the native chat for the bootstrapped conversation. */
export function reloadToCasualChat(
  machineId: string,
  projectId: string,
  workspaceId: string | undefined,
  sessionId: string,
): void {
  window.location.assign(casualChatUrl(machineId, projectId, workspaceId, sessionId));
}

/** Route URL for the casual chat; used both for the one-time reload and for its own window. */
export function casualChatUrl(
  machineId: string,
  projectId: string,
  workspaceId: string | undefined,
  sessionId: string,
): string {
  const params = routeParams(machineId, projectId, workspaceId);
  params.set("session", sessionId);
  params.set("view", "chat");
  return `${window.location.pathname}?${params.toString()}`;
}

/** Reload into the Casual panel so its normal flow can create the session. */
export function reloadToCasualPanel(
  machineId: string,
  projectId: string,
  workspaceId: string | undefined,
): void {
  const params = routeParams(machineId, projectId, workspaceId);
  params.set("tool", CASUAL_PANEL_TOOL);
  params.set("view", "workspace");
  window.location.assign(`${window.location.pathname}?${params.toString()}`);
}

function routeParams(
  machineId: string,
  projectId: string,
  workspaceId: string | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  if (machineId !== "local") params.set("machine", machineId);
  params.set("project", projectId);
  if (workspaceId !== undefined && workspaceId !== "") params.set("workspace", workspaceId);
  return params;
}
