import { casualButtonLabels, changeCasualHome, getLatestPanelContext, newCasualChat, openCasual, openCasualFromButton, openCasualInOwnTab, resetCasualLink, runtimeOpenContext, setSelectionService, } from "./casual.js";
import { startCasualHostBridge } from "./dom.js";
import { renderPanel } from "./panel.js";
const plugin = {
    apiVersion: 4,
    name: "PI WEB Casual",
    activate: (context) => {
        setSelectionService(context.selection);
        startCasualHostBridge(() => openCasualFromButton(getLatestPanelContext()), context.lifetimeSignal, casualButtonLabels);
        const actions = [
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
                run: (runtime) => newCasualChat({
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
                        icon: context.html `
              <span aria-hidden="true" style="font-size:17px;line-height:1;font-weight:600">\u2042</span>
            `,
                        order: 0,
                        render: (panel) => renderPanel(context.html, panel),
                    },
                ],
                actions,
            },
        };
    },
};
export default plugin;
