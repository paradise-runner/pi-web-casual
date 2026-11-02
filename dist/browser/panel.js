import { acknowledgeCasualUnread } from "./activity.js";
import { activateCasualTab, archiveCasualTab, casualArchiveUndo, casualChatSrc, casualStripNotice, changeCasualHome, chooseProject, getStatus, newCasualChat, newCasualTab, openCasual, openCasualInOwnTab, panelOpenContext, readCasualTabs, refreshCasualPointer, resetCasualLink, undoCasualArchive, } from "./casual.js";
import { clickActionsButton, EMBED_FRAME_NAME, embeddedChatSession, findCasualFrame, isEmbeddedFrame, superviseEmbeddedChat, switchEmbeddedChat, } from "./dom.js";
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
// The host renders the panel inside a full-height column flex area, so the
// frame has to claim that space instead of guessing a viewport offset: a fixed
// `calc(100vh - Npx)` left dead space under the composer and made the embedded
// chat look like it was floating.
const frameStyle = [
    "box-sizing:border-box",
    "width:100%",
    "height:100%",
    "min-height:0",
    "flex:1 1 auto",
    "border:0",
    "background:var(--pi-bg)",
    "display:block",
].join(";");
// The chat state is a column: the conversation strip, then the frame. The frame
// keeps `flex: 1 1 auto` and no fixed height, so it takes whatever the strip
// leaves and the composer stays on the panel's bottom edge.
const shellStyle = [
    "box-sizing:border-box",
    "display:flex",
    "flex-direction:column",
    "width:100%",
    "height:100%",
    "min-height:0",
    "flex:1 1 auto",
].join(";");
const stripStyle = [
    "box-sizing:border-box",
    "flex:0 0 auto",
    "display:flex",
    "align-items:center",
    "gap:6px",
    "min-width:0",
    "padding:3px 6px",
    "border-bottom:1px solid var(--pi-border)",
    "background:var(--pi-bg)",
    "color:var(--pi-text)",
].join(";");
const tabListStyle = [
    "display:flex",
    "align-items:center",
    "gap:4px",
    "flex:1 1 auto",
    "min-width:0",
    "padding:1px 0",
    "overflow-x:auto",
    "overflow-y:hidden",
    "scrollbar-width:thin",
].join(";");
const tabStyle = [
    "box-sizing:border-box",
    "flex:0 0 auto",
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "min-width:26px",
    "height:26px",
    "padding:0 8px",
    "border:1px solid transparent",
    "border-radius:7px",
    "background:transparent",
    "color:var(--pi-muted)",
    "font:600 11px/1 var(--pi-font,system-ui,sans-serif)",
    "cursor:pointer",
].join(";");
const activeTabStyle = `${tabStyle};border-color:var(--pi-accent-border);background:var(--pi-selection-bg);color:var(--pi-text)`;
const closeTabStyle = [
    "box-sizing:border-box",
    "flex:0 0 auto",
    "width:20px",
    "height:26px",
    "margin-left:-3px",
    "padding:0",
    "border:0",
    "border-radius:7px",
    "background:transparent",
    "color:var(--pi-muted)",
    "font:600 14px/1 var(--pi-font,system-ui,sans-serif)",
    "cursor:pointer",
].join(";");
const newTabStyle = [
    "box-sizing:border-box",
    "flex:0 0 auto",
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "min-width:26px",
    "height:26px",
    "padding:0 7px",
    "border:1px solid var(--pi-border)",
    "border-radius:7px",
    "background:var(--pi-surface)",
    "color:var(--pi-text)",
    "font:600 14px/1 var(--pi-font,system-ui,sans-serif)",
    "cursor:pointer",
].join(";");
const undoStyle = [
    "box-sizing:border-box",
    "flex:0 0 auto",
    "height:24px",
    "padding:0 7px",
    "border:1px solid var(--pi-accent-border)",
    "border-radius:6px",
    "background:var(--pi-selection-bg)",
    "color:var(--pi-text)",
    "font:600 11px/1 var(--pi-font,system-ui,sans-serif)",
    "cursor:pointer",
].join(";");
const noticeStyle = [
    "flex:0 1 auto",
    "min-width:0",
    "max-width:45%",
    "overflow:hidden",
    "text-overflow:ellipsis",
    "white-space:nowrap",
    "color:var(--pi-muted)",
    "font:11px/1.2 system-ui,sans-serif",
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
        // The reply is on screen here, so an unread completion for this conversation
        // can be cleared. The embedded frame cannot report that itself: PI WEB only
        // counts a chat as read once its own document has focus, and the host chrome
        // holds the focus this panel is reached from. The render reports the visit
        // before the frame exists, and the frame's load covers the rest.
        if (record.sessionId !== undefined) {
            acknowledgeCasualUnread({ machineId: context.machine.id, sessionId: record.sessionId });
        }
        // Switching tabs never recreates the frame: the mounted frame keeps the
        // `src` it was born with, and the conversation is swapped through the host's
        // own history routing (dom.ts). Re-renders therefore never reload the chat.
        const frame = findCasualFrame();
        const mounted = frame !== null && frame.isConnected;
        if (mounted &&
            record.sessionId !== undefined &&
            embeddedChatSession(frame) !== record.sessionId) {
            switchEmbeddedChat(frame, src);
        }
        const frameSrc = mounted ? (frame.getAttribute("src") ?? src) : src;
        return html `
      <div style=${shellStyle}>
        ${renderStrip(html, open, readCasualTabs(context.machine.id), casualStripNotice(context.machine.id), casualArchiveUndo(context.machine.id))}
        <iframe
          name=${EMBED_FRAME_NAME}
          src=${frameSrc}
          title="Casual chat"
          style=${frameStyle}
          @load=${(event) => {
            if (!(event.target instanceof HTMLIFrameElement))
                return;
            superviseEmbeddedChat(event.target);
            acknowledgeCasualUnread();
        }}
        ></iframe>
      </div>
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
/**
 * The conversation strip. Numbering is positional: the tab's number is its index
 * in the strip, so a new conversation is appended and the numbers before it do
 * not move. The **+** starts another conversation in the same home, and the
 * active tab carries the **×** that archives it; the last tab keeps no **×**,
 * because Casual always has one conversation to show.
 */
function renderStrip(html, open, tabs, notice, undo) {
    const lastOne = tabs.length <= 1;
    return html `
    <div style=${stripStyle}>
      <div
        style=${tabListStyle}
        role="tablist"
        aria-label="Casual conversations"
        @keydown=${(event) => moveTabFocus(event, open)}
      >
        ${tabs.map((tab) => html `
            <span style="display:inline-flex;align-items:center;flex:0 0 auto">
              <button
                type="button"
                role="tab"
                data-casual-tab=${tab.sessionId}
                aria-selected=${tab.active ? "true" : "false"}
                aria-label=${tabLabel(tab)}
                title=${tabLabel(tab)}
                tabindex=${tab.active ? "0" : "-1"}
                style=${tab.active ? activeTabStyle : tabStyle}
                @click=${() => activateCasualTab(open, tab.sessionId)}
              >
                ${tab.number}
              </button>
              ${tab.active && !lastOne
        ? html `<button
                    type="button"
                    style=${closeTabStyle}
                    title="Archive this conversation"
                    aria-label=${`Archive conversation ${tab.number}`}
                    @click=${() => {
            void archiveCasualTab(open, tab.sessionId);
        }}
                  >
                    \u00d7
                  </button>`
        : null}
            </span>
          `)}
      </div>
      ${undo === undefined
        ? notice === undefined
            ? null
            : html `<span style=${noticeStyle} role="status">${notice}</span>`
        : html `
            <span style=${noticeStyle} role="status">${undo.message}</span>
            <button
              type="button"
              style=${undoStyle}
              title="Put the archived conversation back"
              @click=${() => {
            void undoCasualArchive(open);
        }}
            >
              Undo
            </button>
          `}
      <button
        type="button"
        style=${newTabStyle}
        title="New casual conversation"
        aria-label="New casual conversation"
        @click=${() => {
        void newCasualTab(open);
    }}
      >
        +
      </button>
    </div>
  `;
}
function tabLabel(tab) {
    return tab.name === undefined
        ? `Conversation ${tab.number}`
        : `Conversation ${tab.number}: ${tab.name}`;
}
/** Left/Right/Home/End move through the strip and open the tab they land on. */
function moveTabFocus(event, open) {
    const keys = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);
    if (!keys.has(event.key))
        return;
    const list = event.currentTarget;
    if (!(list instanceof HTMLElement))
        return;
    const buttons = Array.from(list.querySelectorAll("button[data-casual-tab]"));
    if (buttons.length === 0)
        return;
    const focused = buttons.findIndex((button) => button === list.ownerDocument.activeElement);
    const from = focused < 0 ? 0 : focused;
    const next = event.key === "Home"
        ? 0
        : event.key === "End"
            ? buttons.length - 1
            : event.key === "ArrowLeft"
                ? (from - 1 + buttons.length) % buttons.length
                : (from + 1) % buttons.length;
    const target = buttons[next];
    if (target === undefined)
        return;
    event.preventDefault();
    target.focus();
    const sessionId = target.dataset.casualTab;
    if (sessionId !== undefined)
        activateCasualTab(open, sessionId);
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
