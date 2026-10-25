import type {
  ApplicationPanelContext,
  PiWebPlugin,
  PluginAction,
  PluginActivationContext,
} from "@jmfederico/pi-web/plugin-api";
import { startCasualActivityBridge } from "./activity.js";
import {
  changeCasualHome,
  newCasualChat,
  openCasual,
  openCasualInOwnTab,
  resetCasualLink,
  runtimeOpenContext,
  setSelectionService,
} from "./casual.js";
import { startCasualHostBridge, TAB_COLOR_VARIABLE } from "./dom.js";
import { renderPanel } from "./panel.js";

/**
 * Oldest PI WEB with the browser v4 surface Casual is built on: application
 * panels, the selection service, and project discovery. `1.202610.1` also
 * accepts `apiVersion: 4`, but exposes none of them.
 */
const MINIMUM_PI_WEB_VERSION = "1.202610.3";

/**
 * PI WEB has no install-time host-version gate for browser plugins, so the
 * earliest loud failure is activation. Throwing here keeps an unsupported host
 * from registering a half-working plugin (no tab, dead palette actions) and
 * puts the reason in the host's "Failed to register PI WEB plugin ... during
 * activate" diagnostic instead of a silent no-op.
 */
function requireSupportedHost(context: PluginActivationContext): void {
  if (context.selection === undefined) {
    throw new Error(
      `PI WEB Casual requires PI WEB ${MINIMUM_PI_WEB_VERSION} or newer. ` +
        "This host predates the browser plugin selection service and application panels, " +
        "so Casual has nothing to render. Update PI WEB, then reload the browser.",
    );
  }
}

const plugin: PiWebPlugin = {
  apiVersion: 4,
  name: "PI WEB Casual",
  activate: (context: PluginActivationContext) => {
    requireSupportedHost(context);
    setSelectionService(context.selection);
    startCasualHostBridge(context.lifetimeSignal);
    startCasualActivityBridge(context.lifetimeSignal);

    const actions: PluginAction[] = [
      {
        id: "open",
        title: "Open Casual Chat",
        description: "Jump to your one ongoing conversation outside your projects",
        group: "Casual",
        run: (runtime) => openCasual(runtimeOpenContext(runtime)),
      },
      {
        id: "open-tab",
        title: "Open Casual Chat in Its Own Tab",
        description: "Open the casual conversation in a separate browser tab so a project chat stays open",
        group: "Casual",
        run: (runtime) => openCasualInOwnTab(runtimeOpenContext(runtime)),
      },
      {
        id: "new",
        title: "New Casual Chat",
        description: "Start a fresh conversation in the casual workspace",
        group: "Casual",
        run: (runtime) =>
          newCasualChat({
            ...runtimeOpenContext(runtime),
            startSession: () => runtime.startSession(),
          }),
      },
      {
        id: "reset",
        title: "Reset Casual Link",
        description: "Forget a stale casual session link and reconnect to the newest live one",
        group: "Casual",
        run: (runtime) => resetCasualLink(runtimeOpenContext(runtime)),
      },
      {
        id: "home",
        title: "Change Casual Home",
        description: "Pick a different folder or project as the casual home",
        group: "Casual",
        run: (runtime) => changeCasualHome(runtimeOpenContext(runtime)),
      },
      {
        id: "setup",
        title: "Set Up Casual Chat",
        description: "Add ~/.casual-pi-web manually if automatic setup could not run",
        group: "Casual",
        run: (runtime) => runtime.addProject(),
      },
    ];

    return {
      contributions: {
        applicationPanels: [
          {
            id: "casual",
            title: "Casual",
            // The glyph reads its color from a custom property the host bridge
            // keeps in step with the casual chat's agent state, so the tab
            // carries the same green working / accent unread signal as a
            // session row's dot.
            icon: context.html`<span aria-hidden="true" style="font-size:17px;line-height:1;font-weight:600;color:var(${TAB_COLOR_VARIABLE},currentColor)">\u2042</span>`,
            order: 0,
            render: (panel: ApplicationPanelContext) => renderPanel(context.html, panel),
          },
        ],
        actions,
      },
    };
  },
};

export default plugin;
