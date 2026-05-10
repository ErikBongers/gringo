import {PartialUrlObserver} from "../pageObserver";
import {emmet} from "../../libs/Emmeter/html";
import {cloud} from "../cloud";

class AanvragenObserver extends PartialUrlObserver {
    constructor() {
        super( "request-info-list/requisition", onMutation, false, onPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return true;
    }
}

export default new AanvragenObserver();

function onPageRefreshed() {
    gringo("page Aanvragen refreshed xxx.");
    decoratePage();
}

function onMutation(mutation: MutationRecord) {
    let pagination = document.querySelector("fd-pagination") as HTMLElement | null;
    // if(pagination)
    //     gotoNextPage(pagination);
    if(document.querySelector("fd-pagination")) {
        decoratePage();
        return true;
    }
    return false;
}

let globalPrs: RequestBasicInfo[] = [];

function gotoNextPage(pagination: HTMLElement) {
    let activeButton = pagination.querySelector("button.is-active") as HTMLButtonElement | null;
    gringo("At page " + activeButton?.textContent.trim());
    let nextButton = pagination.querySelector("button[glyph='navigation-right-arrow']") as HTMLButtonElement | null;
    if(!nextButton)
        return;
    globalPrs.push(...scrapePRs());
    if(nextButton.classList.contains("is-disabled")) {
        gringo("THIE END");
        gringo(globalPrs);
    }
    else
        nextButton.click();
}
function gringo(...args: any[]) {
    console.log("gringo", ...args);
}

function decoratePage() {
    let main = document.querySelector("main");
    if(!main)
        return;
    main.classList.toggle("hideOnBehalfOf", true);
    main.classList.toggle("hideTeam", true);

    let requests  = scrapePRs();
    requests.forEach(decoratePr);
    if(!document.body.dataset.hasGringoDialog) {
        document.body.dataset.hasGringoDialog = "true";
        let popover = emmet.appendChild(document.body, `
            div#gringo-tags-popover[popover=""]> (
                (div.flexRow>button.closePopup.naked{x})+
                div.popoverContainer{Container...}
            )        
        `).first as HTMLDivElement;
        let button = popover.querySelector("button.closePopup") as HTMLButtonElement;
        addButtonClickNoPropagation(button as HTMLButtonElement, (ev) => {
            let popover = document.getElementById("gringo-tags-popover") as HTMLElement;
            if(!popover)
                return;
            // @ts-ignore
            popover.togglePopover({source:button});
        });
    }

    // let requestInfoListPanel = document.querySelector(".request-info-list-panel") as HTMLElement | null;
    // if(requestInfoListPanel) {
    //     if (!requestInfoListPanel.dataset.hasOverlay) {
    //         requestInfoListPanel.dataset.hasOverlay = "true";
    //         emmet.appendChild(requestInfoListPanel, `
    //         div.gringoOverlay
    //     `);
    //     }
    // }
}

function scrapePRs() {
    let requestsDivs = document.querySelectorAll("request-info-item");
    return [...requestsDivs].map(scrapeInfoItem);
}

export type RequestBasicInfo = {
    id: string,
    div: HTMLDivElement,
    orderAnchors: HTMLAnchorElement[],

}

function scrapeInfoItem(requestDiv: HTMLDivElement): RequestBasicInfo {
    let id = requestDiv.id.substring("request-".length);
    let divOrders = requestDiv.querySelector(".item-orders");
    let orderAnchors: HTMLAnchorElement[] = [];
    if(divOrders) {
         orderAnchors = [...divOrders.querySelectorAll(".request-po-list-container ul > li a") as NodeListOf<HTMLAnchorElement>];
    }
    return {id, div: requestDiv, orderAnchors};
}

interface PrMeta {
    tags: string[],
}

function addOrderCopyButton(request: RequestBasicInfo) {
    request.orderAnchors.forEach(a => {
        let button = emmet.insertAfter(a, `
            button.copyAnchorText.naked
                >li.far.fa-copy 
            `).first as HTMLButtonElement;
        addButtonClickNoPropagation(button, async (ev) => {
            await navigator.clipboard.writeText(a.innerText);
        });
    });
}

function addButtonClickNoPropagation(button: HTMLButtonElement, onClick: (ev: any) => any) {
    button.onmousedown = async (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
    };
    button.onmouseup = (ev) => {
        onClick(ev);
        ev.stopPropagation();
        ev.preventDefault();
    };
    button.onclick = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
    };
}

function stripSections(request: RequestBasicInfo) {
    let divWho = request.div.querySelector("div.item-obo");
    if(divWho) {
        // strip "aangemaakt namens Team X"

    }
}

async function decoratePr(request: RequestBasicInfo) {
    if(request.div.dataset.gringo == "decorated")
        return;
    request.div.dataset.gringo = "decorated";
    addOrderCopyButton(request);
    stripSections(request);
    let meta = await fetchMetaCached(request.id);
    addMeta(request, meta);
}

interface TagDef  {
    name: string,
    description: string,
    color: string,
    bkgColor: string,
}
const defaultTags: TagDef[] = [
    { name: "BB>", description: "Bestelbon verzonden", color: "", bkgColor: "orange"},
    { name: "✔", description: "Bestelling ontvangen", color: "green", bkgColor: ""},
    { name: "brol", description: "", color: "", bkgColor: ""},
    { name: "Zever", description: "", color: "blue", bkgColor: ""},
];
const defaultTagsMap: Map<string, TagDef> = new Map(defaultTags.map(t => [t.name, t]));

function addMeta(request: RequestBasicInfo, meta: PrMeta) {
    let divStatusContainer = request.div.querySelector("div.item-status-container") as HTMLDivElement | null;
    if(!divStatusContainer)
        return;
    divStatusContainer = divStatusContainer.parentElement as HTMLDivElement;
    let button = emmet.appendChild(divStatusContainer, `
        button.naked.tagButton
            >li.far.fa-circle-down
    `).first as HTMLButtonElement;

    addButtonClickNoPropagation(button, (ev) => {
        let popover = document.getElementById("gringo-tags-popover") as HTMLElement;
        if(!popover)
            return;
        // @ts-ignore
        popover.togglePopover({source:button});
        let container = popover.querySelector(".popoverContainer") as HTMLUListElement;
        container.classList.add("tagList");
        container.innerHTML = "";
        defaultTags.forEach(tagDef => {
            let tagButton = emmet.appendChild(container, `
                button.naked.tag{${tagDef.name}}
            `).first as HTMLDivElement;
            tagButton.style.color = tagDef.color != "" ? tagDef.color : "inherit";
            tagButton.style.backgroundColor = tagDef.bkgColor != "" ? tagDef.bkgColor : "inherit";
            tagButton.title = tagDef.description;
            tagButton.classList.toggle("selected", meta.tags.includes(tagDef.name));
        });
    });
}


async function fetchMetaCached(prId: string) {
    //todo: this assumes that localStorage is synced with cloud.
    let jsonMeta = localStorage.getItem("gringo."+prId); //todo: eventually replace with indexedDb
    if(jsonMeta)
        return JSON.parse(jsonMeta) as PrMeta;
    let meta: PrMeta =  {tags: []};
    try {
        meta = await cloud.json.fetch("gringo/pr/meta/" + prId);
    } catch {
        await cloud.json.upload("gringo/pr/meta/" + prId, meta);
    }
    localStorage.setItem("gringo."+prId, JSON.stringify(meta));
    return meta;
}