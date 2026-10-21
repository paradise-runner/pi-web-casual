import type { TemplateResult } from "lit";
import type { ApplicationPanelContext, PluginProject } from "@jmfederico/pi-web/plugin-api";
import {
  changeCasualHome,
  chooseProject,
  getStatus,
  newCasualChat,
  openCasual,
  panelOpenContext,
  resetCasualLink,
  setLatestPanelContext,
  shouldAutoOpenOnMount,
  type CasualStatus,
  type OpenContext,
} from "./casual.js";
import { clickActionsButton } from "./dom.js";
import { readRecord } from "./store.js";

type HtmlTag = (strings: TemplateStringsArray, ...values: unknown[]) => TemplateResult;

let probeContext: OpenContext | undefined;

class CasualPanelProbe extends HTMLElement {
  private mounted = false;

  connectedCallback(): void {
    this.mounted = true;
    const context = probeContext;
    if (context === undefined) return;
    void shouldAutoOpenOnMount(context).then((shouldOpen) => {
      if (shouldOpen && this.mounted && context === probeContext) void openCasual(context);
    });
  }

  disconnectedCallback(): void {
    this.mounted = false;
  }
}

if (customElements.get("pi-web-casual-probe") === undefined) {
  customElements.define("pi-web-casual-probe", CasualPanelProbe);
}

const cardStyle = [
  "box-sizing:border-box",
  "width:min(100%,460px)",
  "margin:24px auto",
  "padding:20px",
  "display:grid",
  "gap:14px",
  "border:1px solid var(--pi-border)",
  "border-radius:14px",
  "background:var(--pi-surface)",
  "color:var(--pi-text)",
  "font:14px system-ui,sans-serif",
].join(";");

const headerStyle = "display:flex;align-items:center;gap:12px;min-width:0";
const glyphStyle = "font-size:30px;line-height:1;font-weight:600;color:var(--pi-accent)";
const titleStyle = "font-size:17px;line-height:1.2";
const mutedStyle = "color:var(--pi-muted);font-size:12px;line-height:1.4";
const paragraphStyle = "margin:0;line-height:1.45";
const mutedParagraphStyle = "margin:0;line-height:1.45;color:var(--pi-muted);font-size:12px";
const rowStyle = "display:flex;flex-wrap:wrap;gap:8px;align-items:center";
const buttonStyle = [
  "font:inherit",
  "padding:7px 11px",
  "border:1px solid var(--pi-border)",
  "border-radius:8px",
  "background:var(--pi-bg)",
  "color:var(--pi-text)",
  "cursor:pointer",
].join(";");
const primaryButtonStyle = `${buttonStyle};border-color:var(--pi-accent-border);background:var(--pi-selection-bg)`;
const smallButtonStyle = [
  "font:inherit",
  "font-size:11px",
  "padding:4px 7px",
  "border:1px solid transparent",
  "border-radius:6px",
  "background:transparent",
  "color:var(--pi-muted)",
  "cursor:pointer",
].join(";");
const projectButtonStyle = [
  "display:grid",
  "gap:2px",
  "width:100%",
  "font:inherit",
  "text-align:left",
  "padding:8px 10px",
  "border:1px solid var(--pi-border)",
  "border-radius:8px",
  "background:var(--pi-bg)",
  "color:var(--pi-text)",
  "cursor:pointer",
].join(";");

export function renderPanel(html: HtmlTag, context: ApplicationPanelContext): TemplateResult {
  const open = panelOpenContext(context);
  setLatestPanelContext(open);
  probeContext = open;
  const status = getStatus(context.machine.id);
  const record = readRecord(context.machine.id);
  const sessionLabel =
    record.sessionName ??
    (record.sessionId === undefined ? "No conversation yet" : `Session ${record.sessionId.slice(0, 8)}`);
  const location = record.workspacePath ?? record.projectPath ?? "";

  const retry = (): void => void openCasual(open);
  const openActions = (): void => {
    if (!clickActionsButton()) console.warn("[pi-web-casual] could not open Actions");
  };
  const newChat = (): void => void newCasualChat(open);

  return html`
    <pi-web-casual-probe style="display:none"></pi-web-casual-probe>
    <div style=${cardStyle}>
      <div style=${headerStyle}>
        <span aria-hidden="true" style=${glyphStyle}>\u2042</span>
        <div style="display:grid;gap:2px;min-width:0">
          <strong style=${titleStyle}>Casual</strong>
          <span style=${mutedStyle}>One ongoing conversation outside your projects</span>
        </div>
      </div>
      ${renderBody(html, open, status, sessionLabel, location, retry, newChat, openActions)}
    </div>
  `;
}

function renderBody(
  html: HtmlTag,
  open: OpenContext,
  status: CasualStatus,
  sessionLabel: string,
  location: string,
  retry: () => void,
  newChat: () => void,
  openActions: () => void,
): TemplateResult {
  if (status.kind === "idle") {
    return html`
      <p style=${paragraphStyle}>Ready when you are.</p>
      <div style=${rowStyle}>${button(html, "Open chat", retry, true)}${button(html, "Open Actions", openActions)}</div>
    `;
  }

  if (status.kind === "opening") {
    return html`<p style=${paragraphStyle}>${status.message ?? "Opening your casual chat\u2026"}</p>`;
  }

  if (status.kind === "setup") {
    return html`
      <p style=${paragraphStyle}>${status.message ?? "Casual needs a home folder."}</p>
      ${status.detail === undefined ? null : html`<p style=${mutedParagraphStyle}>${status.detail}</p>`}
      <div style=${rowStyle}>${button(html, "Retry", retry, true)}${button(html, "Open Actions", openActions)}</div>
      ${status.projects === undefined || status.projects.length === 0
        ? null
        : html`
            <div style="display:grid;gap:6px">
              <div style=${mutedStyle}>Use an existing registered project as the casual home:</div>
              ${status.projects
                .slice(0, 10)
                .map((project) =>
                  projectButton(html, project, () => {
                    void chooseProject(open, project);
                  }),
                )}
            </div>
          `}
    `;
  }

  if (status.kind === "error") {
    return html`
      <p style=${paragraphStyle}>${status.message ?? "Could not open Casual."}</p>
      ${status.detail === undefined ? null : html`<p style=${mutedParagraphStyle}>${status.detail}</p>`}
      <div style=${rowStyle}>${button(html, "Retry", retry, true)}${button(html, "Open Actions", openActions)}</div>
      <div style=${rowStyle}>
        ${smallButton(html, "Reset link", () => {
          void resetCasualLink(open);
        })}
        ${smallButton(html, "Change home", () => {
          void changeCasualHome(open);
        })}
      </div>
    `;
  }

  return html`
    <div style="display:grid;gap:3px;min-width:0">
      <strong style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sessionLabel}</strong>
      ${location === "" ? null : html`<span style=${mutedStyle}>${location}</span>`}
    </div>
    ${status.message === undefined ? null : html`<p style=${mutedParagraphStyle}>${status.message}</p>`}
    <div style=${rowStyle}>
      ${button(html, "Open chat", retry, true)}
      ${button(html, "New chat", newChat)}
      ${button(html, "Open Actions", openActions)}
    </div>
    <p style=${mutedParagraphStyle}>
      The \u2042 button and this tab reopen the same conversation. Starting a new chat leaves the previous one in Sessions.
    </p>
    <div style=${rowStyle}>
      ${smallButton(html, "Reset link", () => {
        void resetCasualLink(open);
      })}
      ${smallButton(html, "Change home", () => {
        void changeCasualHome(open);
      })}
    </div>
  `;
}

function button(html: HtmlTag, label: string, onClick: () => void, primary = false): TemplateResult {
  return html`<button type="button" style=${primary ? primaryButtonStyle : buttonStyle} @click=${onClick}>
    ${label}
  </button>`;
}

function smallButton(html: HtmlTag, label: string, onClick: () => void): TemplateResult {
  return html`<button type="button" style=${smallButtonStyle} @click=${onClick}>${label}</button>`;
}

function projectButton(
  html: HtmlTag,
  project: PluginProject,
  onClick: () => void,
): TemplateResult {
  return html`
    <button type="button" style=${projectButtonStyle} @click=${onClick}>
      <span style="font-weight:600">${project.name}</span>
      <span style=${mutedStyle}>${project.path}</span>
    </button>
  `;
}
