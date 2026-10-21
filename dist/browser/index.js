import { getLatestPanelContext, markCasualTabIntent, newCasualChat, openCasual, openCasualFromButton, runtimeOpenContext, setSelectionService, } from "./casual.js";
import { startCasualHostBridge } from "./dom.js";
import { renderPanel } from "./panel.js";
const plugin = {
    apiVersion: 4,
    name: "PI WEB Casual",
    activate: (context) => {
        setSelectionService(context.selection);
        startCasualHostBridge(() => openCasualFromButton(getLatestPanelContext()), context.lifetimeSignal);
        const onDocumentClick = (event) => {
            if (isCasualTabClick(event))
                markCasualTabIntent();
        };
        window.addEventListener("click", onDocumentClick, true);
        context.lifetimeSignal.addEventListener("abort", () => window.removeEventListener("click", onDocumentClick, true), { once: true });
        const actions = [
            {
                id: "open",
                title: "Open Casual Chat",
                description: "Jump to your one ongoing conversation outside your projects",
                group: "Casual",
                run: (runtime) => openCasual(runtimeOpenContext(runtime)),
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
function isCasualTabClick(event) {
    for (const node of event.composedPath()) {
        if (!(node instanceof HTMLButtonElement))
            continue;
        if (node.hasAttribute("data-pi-web-casual-button"))
            continue;
        if (node.closest(".tabs, .mobile-tabs") === null)
            continue;
        const labelElement = node.querySelector(".tab-label");
        const label = (labelElement?.textContent ?? node.getAttribute("aria-label") ?? node.title ?? "").trim();
        if (label === "Casual" || label.startsWith("Casual,"))
            return true;
    }
    return false;
}
export default plugin;
