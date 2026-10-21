const BUTTON_ATTR = "data-pi-web-casual-button";
const HIDDEN_PROJECT_ATTR = "data-pi-web-casual-hidden";
const CASUAL_PROJECT_PATH = /[\\/]\.casual-pi-web$/i;
const HOST_TAGS = [
  "app-context-bar",
  "app-navigation-panel",
  "workspace-panel",
  "app-mobile-main-tabs",
] as const;

function appShadowRoot(): ShadowRoot | undefined {
  return document.querySelector("pi-web-app")?.shadowRoot ?? undefined;
}

/** Only the shadow roots that hold the header, context bar, tabs, and session list. */
export function knownShadowRoots(): ShadowRoot[] {
  const app = appShadowRoot();
  if (app === undefined) return [];
  const roots: ShadowRoot[] = [app];
  for (const tag of HOST_TAGS) {
    for (const element of app.querySelectorAll(tag)) {
      if (element.shadowRoot === null) continue;
      roots.push(element.shadowRoot);
      if (tag === "app-navigation-panel") {
        // The + start button lives in the nested session-list component, and
        // the project rows live in the nested project-list component.
        for (const child of element.shadowRoot.querySelectorAll("session-list, project-list")) {
          if (child.shadowRoot !== null) roots.push(child.shadowRoot);
        }
      }
    }
  }
  return roots;
}

function makeButton(kind: "mobile" | "header", onOpen: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute(BUTTON_ATTR, kind);
  button.title = "Casual chat (\u2042)";
  button.setAttribute("aria-label", "Open Casual chat");
  button.textContent = "\u2042";
  if (kind === "mobile") {
    // Reuse the context-bar button rules from the host shadow root.
    button.className = "context-action-button";
    button.style.fontSize = "17px";
    button.style.lineHeight = "1";
    button.style.fontWeight = "600";
  } else {
    button.style.cssText = [
      "font: inherit",
      "font-size: 18px",
      "line-height: 1",
      "padding: 4px 8px",
      "border: 1px solid var(--pi-border)",
      "border-radius: 7px",
      "background: var(--pi-surface)",
      "color: var(--pi-text)",
      "cursor: pointer",
    ].join(";");
  }
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onOpen();
  });
  return button;
}

interface ProjectSummary {
  readonly path?: string;
}

interface ProjectListHost extends HTMLElement {
  readonly projects?: readonly ProjectSummary[];
  readonly selected?: ProjectSummary;
}

function isCasualProjectRow(row: HTMLElement): boolean {
  const path = row.getAttribute("title") ?? "";
  return CASUAL_PROJECT_PATH.test(path);
}

function restoreProjectRow(row: HTMLElement): void {
  row.style.removeProperty("display");
  row.removeAttribute("aria-hidden");
  row.removeAttribute("inert");
  row.removeAttribute(HIDDEN_PROJECT_ATTR);
}

/**
 * Hide the plugin-managed default project from the sidebar project list. It
 * stays a real project for the host, but is reachable only through the \u2042
 * button/tab. The host's project-list component exposes `projects` and
 * `selected`, so this also works while the section is collapsed and has no
 * rendered rows. This is best-effort shadow-DOM work, like the extra button.
 */
function hideCasualProjectRows(root: ShadowRoot): void {
  const host = root.host as ProjectListHost;
  const projects = Array.isArray(host.projects) ? host.projects : undefined;
  if (projects === undefined) return;

  const visibleProjects = projects.filter(
    (project) => !CASUAL_PROJECT_PATH.test(project.path ?? ""),
  );
  for (const row of root.querySelectorAll<HTMLElement>("[data-project-id]")) {
    if (isCasualProjectRow(row)) {
      row.style.display = "none";
      row.setAttribute("aria-hidden", "true");
      row.setAttribute("inert", "");
      row.setAttribute(HIDDEN_PROJECT_ATTR, "1");
    } else if (row.hasAttribute(HIDDEN_PROJECT_ATTR)) {
      restoreProjectRow(row);
    }
  }

  const count = root.querySelector<HTMLElement>(".section-count");
  if (count !== null && (count.textContent ?? "").trim() !== String(visibleProjects.length)) {
    count.textContent = String(visibleProjects.length);
  }

  if (host.selected !== undefined && CASUAL_PROJECT_PATH.test(host.selected.path ?? "")) {
    const selected = root.querySelector<HTMLElement>(".section-selected");
    if (selected !== null && (selected.textContent ?? "") !== "") selected.textContent = "";
  }
}

/**
 * Add the \u2042 button next to the lightning Actions control in both the
 * desktop header and the mobile context bar, and hide the default Casual
 * project from the sidebar. PI WEB has no supported contribution points for
 * either surface, so this is deliberately best-effort and isolated here; a
 * page update may change the selectors.
 */
export function startCasualHostBridge(onOpen: () => void, signal: AbortSignal): void {
  const ensure = (): void => {
    if (signal.aborted) return;
    try {
      for (const root of knownShadowRoots()) {
        hideCasualProjectRows(root);
        for (const actions of root.querySelectorAll<HTMLElement>(".context-actions")) {
          if (actions.querySelector(`[${BUTTON_ATTR}]`) !== null) continue;
          const lightning = actions.querySelector<HTMLButtonElement>('button[aria-label="Show Actions"]');
          if (lightning === null) continue;
          actions.insertBefore(makeButton("mobile", onOpen), lightning);
        }
        for (const actions of root.querySelectorAll<HTMLElement>(".header-actions")) {
          if (actions.querySelector(`[${BUTTON_ATTR}]`) !== null) continue;
          const anchor = Array.from(actions.querySelectorAll<HTMLButtonElement>("button")).find(
            (button) => (button.textContent ?? "").trim() === "Actions",
          );
          if (anchor === undefined) continue;
          actions.insertBefore(makeButton("header", onOpen), anchor);
        }
      }
    } catch (error) {
      console.warn("[pi-web-casual] could not add the \u2042 button", error);
    }
  };

  ensure();
  const interval = window.setInterval(ensure, 500);
  signal.addEventListener(
    "abort",
    () => {
      window.clearInterval(interval);
      for (const root of knownShadowRoots()) {
        for (const element of root.querySelectorAll(`[${BUTTON_ATTR}]`)) element.remove();
        for (const row of root.querySelectorAll<HTMLElement>(`[${HIDDEN_PROJECT_ATTR}]`)) {
          restoreProjectRow(row);
        }
        const rows = root.querySelectorAll("[data-project-id]");
        const count = root.querySelector<HTMLElement>(".section-count");
        if (rows.length > 0 && count !== null) count.textContent = String(rows.length);
      }
    },
    { once: true },
  );
}

/** Select the plugin's application tab, which mounts the panel and auto-opens. */
export function clickCasualTab(): boolean {
  for (const root of knownShadowRoots()) {
    for (const label of root.querySelectorAll<HTMLElement>(".tab-label")) {
      if ((label.textContent ?? "").trim() !== "Casual") continue;
      const button = label.closest("button");
      if (button !== null) {
        button.click();
        return true;
      }
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>("button")) {
      const label = (button.getAttribute("aria-label") ?? button.title ?? "").trim();
      if (label === "Casual" || label.startsWith("Casual,")) {
        button.click();
        return true;
      }
    }
  }
  return false;
}

/** Click the host's "+" next to Sessions, the supported UI way to create a session. */
export function clickStartSession(): boolean {
  for (const root of knownShadowRoots()) {
    for (const button of root.querySelectorAll<HTMLButtonElement>("button.start-session-button")) {
      if (button.disabled) continue;
      button.click();
      return true;
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('button[aria-label^="Start a"]')) {
      if (button.disabled) continue;
      button.click();
      return true;
    }
  }
  return false;
}

/** Open the host Actions palette, where Add Project and the Casual actions live. */
export function clickActionsButton(): boolean {
  for (const root of knownShadowRoots()) {
    for (const button of root.querySelectorAll<HTMLButtonElement>('button[aria-label="Show Actions"]')) {
      button.click();
      return true;
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>("button")) {
      if ((button.textContent ?? "").trim() !== "Actions") continue;
      button.click();
      return true;
    }
  }
  return false;
}

export async function waitFor<T>(
  predicate: () => T | undefined | false,
  timeoutMs: number,
  intervalMs = 100,
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = predicate();
    if (value !== undefined && value !== false) return value;
    if (Date.now() >= deadline) return undefined;
    await new Promise<void>((resolve) => window.setTimeout(resolve, intervalMs));
  }
}
