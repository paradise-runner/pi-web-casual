import { captureProjectChatPoint, casualChatSrc, changeCasualHome, chooseProject, getStatus, newCasualChat, openCasual, openCasualInOwnTab, panelOpenContext, refreshCasualPointer, resetCasualLink, setLatestPanelContext, takeOpenIntent, } from "./casual.js";
import { clickActionsButton, EMBED_FRAME_NAME, isEmbeddedFrame, superviseEmbeddedChat } from "./dom.js";
import { readRecord } from "./store.js";
const NO_CONVERSATION = "No conversation yet";
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
const frameStyle = [
    "box-sizing:border-box",
    "width:100%",
    "height:max(420px,calc(100vh - 170px))",
    "border:0",
    "background:var(--pi-bg)",
    "display:block",
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
export function renderPanel(html, context) {
    const open = panelOpenContext(context);
    setLatestPanelContext(open);
    // Visiting the tab is the last moment the project chat is still selected, so
    // the toggle's return point is refreshed here, not only during open.
    captureProjectChatPoint(open);
    // An explicit request (⁂ with no panel yet) opens the chat; the tab itself
    // always renders the card so Casual stays a view of its own.
    if (takeOpenIntent())
        queueMicrotask(() => void openCasual(open));
    const status = getStatus(context.machine.id);
    const record = readRecord(context.machine.id);
    const sessionLabel = record.sessionName ??
        (record.sessionId === undefined ? NO_CONVERSATION : `Session ${record.sessionId.slice(0, 8)}`);
    const location = record.workspacePath ?? record.projectPath ?? "";
    const src = casualChatSrc(open);
    // Keep the embedded chat pointed at the newest live session, without
    // navigating the tab the user is looking at.
    if (src !== undefined && !isEmbeddedFrame())
        void refreshCasualPointer(open);
    // A remembered conversation makes the tab a chat and nothing else: no card,
    // no toolbar. Everything else lives in the palette, where the other Casual
    // actions already are.
    if (src !== undefined && !isEmbeddedFrame() && (status.kind === "idle" || status.kind === "ready")) {
        return html `
      <iframe
        name=${EMBED_FRAME_NAME}
        src=${src}
        title="Casual chat"
        style=${frameStyle}
        @load=${(event) => {
            if (event.target instanceof HTMLIFrameElement)
                superviseEmbeddedChat(event.target);
        }}
      ></iframe>
    `;
    }
    const retry = () => void openCasual(open);
    const openActions = () => {
        if (!clickActionsButton())
            console.warn("[pi-web-casual] could not open Actions");
    };
    const newChat = () => void newCasualChat(open);
    const ownTab = () => void openCasualInOwnTab(open);
    return html `
    <div style=${cardStyle}>
      <div style=${headerStyle}>
        <span aria-hidden="true" style=${glyphStyle}>\u2042</span>
        <div style="display:grid;gap:2px;min-width:0">
          <strong style=${titleStyle}>Casual</strong>
          <span style=${mutedStyle}>One ongoing conversation outside your projects</span>
        </div>
      </div>
      ${renderBody(html, open, status, sessionLabel, location, retry, newChat, ownTab, openActions)}
    </div>
  `;
}
function renderBody(html, open, status, sessionLabel, location, retry, newChat, ownTab, openActions) {
    if (status.kind === "idle") {
        return html `
      ${sessionLabel === NO_CONVERSATION
            ? html `<p style=${paragraphStyle}>Ready when you are.</p>`
            : html `
            <div style="display:grid;gap:3px;min-width:0">
              <strong style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                >${sessionLabel}</strong
              >
              ${location === "" ? null : html `<span style=${mutedStyle}>${location}</span>`}
            </div>
          `}
      <div style=${rowStyle}>
        ${button(html, "Open chat", retry, true)}${button(html, "Open in its own tab", ownTab)}
        ${button(html, "Open Actions", openActions)}
      </div>
    `;
    }
    if (status.kind === "opening") {
        return html `<p style=${paragraphStyle}>${status.message ?? "Opening your casual chat\u2026"}</p>`;
    }
    if (status.kind === "setup") {
        return html `
      <p style=${paragraphStyle}>${status.message ?? "Casual needs a home folder."}</p>
      ${status.detail === undefined ? null : html `<p style=${mutedParagraphStyle}>${status.detail}</p>`}
      <div style=${rowStyle}>${button(html, "Retry", retry, true)}${button(html, "Open Actions", openActions)}</div>
      ${status.projects === undefined || status.projects.length === 0
            ? null
            : html `
            <div style="display:grid;gap:6px">
              <div style=${mutedStyle}>Use an existing registered project as the casual home:</div>
              ${status.projects
                .slice(0, 10)
                .map((project) => projectButton(html, project, () => {
                void chooseProject(open, project);
            }))}
            </div>
          `}
    `;
    }
    if (status.kind === "error") {
        return html `
      <p style=${paragraphStyle}>${status.message ?? "Could not open Casual."}</p>
      ${status.detail === undefined ? null : html `<p style=${mutedParagraphStyle}>${status.detail}</p>`}
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
    return html `
    <div style="display:grid;gap:3px;min-width:0">
      <strong style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sessionLabel}</strong>
      ${location === "" ? null : html `<span style=${mutedStyle}>${location}</span>`}
    </div>
    ${status.message === undefined ? null : html `<p style=${mutedParagraphStyle}>${status.message}</p>`}
    <div style=${rowStyle}>
      ${button(html, "Open chat", retry, true)}
      ${button(html, "Open in its own tab", ownTab)}
      ${button(html, "New chat", newChat)}
      ${button(html, "Open Actions", openActions)}
    </div>
    <p style=${mutedParagraphStyle}>
      Open chat uses this tab. Open in its own tab keeps your project chat open beside Casual. \u2042 opens Casual beside the
      project chat, or closes the separate window to return. Starting a new chat leaves the previous one in Sessions.
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
function button(html, label, onClick, primary = false) {
    return html `<button type="button" style=${primary ? primaryButtonStyle : buttonStyle} @click=${onClick}>
    ${label}
  </button>`;
}
function smallButton(html, label, onClick) {
    return html `<button type="button" style=${smallButtonStyle} @click=${onClick}>${label}</button>`;
}
function projectButton(html, project, onClick) {
    return html `
    <button type="button" style=${projectButtonStyle} @click=${onClick}>
      <span style="font-weight:600">${project.name}</span>
      <span style=${mutedStyle}>${project.path}</span>
    </button>
  `;
}
