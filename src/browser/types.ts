/** The small part of the newer PI WEB catalog contract this plugin uses. */
export interface CatalogWorkspace {
  readonly id: string;
  readonly projectId: string;
  readonly path: string;
  readonly label: string;
  readonly isMain: boolean;
}

export interface CatalogSession {
  readonly id: string;
  readonly cwd: string;
  readonly name?: string;
  readonly archived: boolean;
  readonly runtime: "not-hosted" | "idle" | "busy";
}

/**
 * What the Casual tab reports about its home, in the host's own terms: `working`
 * is PI WEB's green session dot, `done` its accent unread mark.
 */
export type CasualActivity = "idle" | "working" | "done";

/**
 * The part of PI WEB's machine status snapshot this plugin reads. Flags are
 * keyed by qualified id (`core:working`, `core:unread`, ...) and only set flags
 * are published; a project missing from the map has nothing in flight.
 */
export interface MachineStatusSnapshot {
  readonly projects: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
}

/**
 * Browser API v5 exposes this to every contribution on PI WEB 1.202610.6+.
 * The plugin is API v4 so it also runs on 1.202610.3, where this is absent.
 */
export interface PluginCatalog {
  readonly version: 1;
  readonly workspaces: {
    list(projectId: string, options?: { signal?: AbortSignal }): Promise<readonly CatalogWorkspace[]>;
  };
  readonly sessions: {
    list(
      selection: { projectId: string; workspaceId: string },
      options?: { signal?: AbortSignal },
    ): Promise<readonly CatalogSession[]>;
  };
}
