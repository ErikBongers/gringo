import {PartialUrlObserver} from "../pageObserver";
import {emmet} from "../../libs/Emmeter/html";
import {cloud} from "../cloud";
import request = chrome.permissions.request;

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
    if(document.body.dataset.gringoPageDecorated)
        return;
    document.body.dataset.gringoPageDecorated = "true";
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

    let requestSearchPanel = main.querySelector(".request-search-panel") as HTMLDivElement;
    let divSearchPanel = emmet.insertAfter(requestSearchPanel, `div.gringoSearchPanel`).first as HTMLDivElement;
    fillSearchPanel(divSearchPanel);

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

function fillSearchPanel(divSearchPanel: HTMLDivElement) {
    let tagsCollapse = emmet.appendChild(divSearchPanel, `
        details>(
            summary{Tags}+
            table#tagsFilterTable>tbody
        )    
    `).first as HTMLDetailsElement;
    let tbody = tagsCollapse.querySelector("tbody") as HTMLTableSectionElement
    defaultTags
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            let tr = emmet.appendChild(tbody, "tr").first as HTMLTableRowElement;
            emmet.appendChild(tr, `
                (td>span.naked.gringoTag{${tagDef.name}})+
                (td>button.naked.filter{✔})+
                (td>button.naked.solo{solo})
            `);
            let tagSpan = tr.querySelector("span")!;
            paintTag(tagSpan, tagDef, true);
        });
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
    prId: string,
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
    updatePrLine(request, meta);
}

interface TagDef  {
    name: string,
    description: string,
    color: string,
    bkgColor: string,
    order: number
}
const defaultTags: TagDef[] = [
    { name: "BB>", description: "Bestelbon verzonden", color: "", bkgColor: "orange", order: 0},
    { name: "✔", description: "Bestelling ontvangen", color: "green", bkgColor: "", order: 100},
    { name: "MW", description: "", color: "", bkgColor: "", order: 300},
    { name: "brol", description: "", color: "", bkgColor: "", order: 330},
    { name: "Zever", description: "", color: "blue", bkgColor: "", order: 300},
    { name: "En", description: "", color: "blue", bkgColor: "", order: 400},
    { name: "Nog", description: "", color: "blue", bkgColor: "", order: 500},
    { name: "Veel", description: "", color: "blue", bkgColor: "", order: 600},
    { name: "Langer", description: "", color: "blue", bkgColor: "", order: 700},
];
const defaultTagsMap: Map<string, TagDef> = new Map(defaultTags.map(t => [t.name, t]));

function updatePrLine(request: RequestBasicInfo, meta: PrMeta) {
    let tagsContainer = request.div.querySelector(".tagsContainer") as HTMLButtonElement | null;
    if(!tagsContainer)
        return;
    tagsContainer.innerHTML = "";
    meta.tags
        .map(tag => {
            return defaultTagsMap.get(tag);
        })
        .filter(t  => !!t)
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            let tagSpan = emmet.appendChild(tagsContainer, `
                span    
            `).first as HTMLSpanElement;
                paintTag(tagSpan, tagDef, true);
        });
}

function paintTag(tagElement: HTMLElement, tagDef: TagDef, selected: boolean) {
    tagElement.innerText = tagDef.name;
    tagElement.classList.add("gringoTag");
    tagElement.style.color = tagDef.color != "" ? tagDef.color : "inherit";
    tagElement.style.backgroundColor = tagDef.bkgColor != "" ? tagDef.bkgColor : "inherit";
    tagElement.title = tagDef.description;
    tagElement.classList.toggle("selected", selected);
}

function addMeta(request: RequestBasicInfo, meta: PrMeta) {
    let divStatusContainer = request.div.querySelector("div.item-status-container") as HTMLDivElement | null;
    if(!divStatusContainer)
        return;
    divStatusContainer = divStatusContainer.parentElement as HTMLDivElement;
    let tagsWrapper = emmet.appendChild(divStatusContainer, `
        div.tagsWrapper.flexRow>(
            (button.naked.tagButton
                >li.far.fa-circle-down)+
            div.tagsContainer
        )
    `).first as HTMLDivElement;

    let button = tagsWrapper.querySelector("button.tagButton") as HTMLButtonElement;

    addButtonClickNoPropagation(button, (ev) => {
        let popover = document.getElementById("gringo-tags-popover") as HTMLElement;
        if(!popover)
            return;
        // @ts-ignore
        popover.togglePopover({source:button});
        let container = popover.querySelector(".popoverContainer") as HTMLUListElement;
        container.classList.add("tagList");
        container.innerHTML = "";
        defaultTags
            .sort((a, b) => a.order - b.order)
            .forEach(tagDef => {
                let tagButton = emmet.appendChild(container, `
                    button.naked.gringoTag{${tagDef.name}}
                `).first as HTMLButtonElement;
                paintTag(tagButton, tagDef, meta.tags.includes(tagDef.name));
                tagButton.onclick = async (ev) => {
                    tagButton.classList.toggle("selected");
                    let selected = tagButton.classList.contains("selected");
                    gringo(`clicked ${tagDef.name} for ${request.id}(meta:${meta.prId})`);
                    if(selected)
                        meta.tags.push(tagDef.name);
                    else
                        meta.tags = meta.tags.filter(t => t != tagDef.name);
                    meta.prId = request.id; //temp!
                    await saveMeta(request.id, meta);
                    updatePrLine(request, meta);
                };
            });
    });
}

async function saveMeta(prId: string, meta: PrMeta) {
    await cloud.json.upload("gringo/pr/meta/" + prId, meta);
    localStorage.setItem("gringo."+prId, JSON.stringify(meta));
}

async function fetchMetaCached(prId: string) {
    //todo: this assumes that localStorage is synced with cloud.
    let jsonMeta = localStorage.getItem("gringo."+prId); //todo: eventually replace with indexedDb
    if(jsonMeta)
        return JSON.parse(jsonMeta) as PrMeta;
    let meta: PrMeta =  {prId, tags: []};
    try {
        meta = await cloud.json.fetch("gringo/pr/meta/" + prId);
    } catch {
        await cloud.json.upload("gringo/pr/meta/" + prId, meta);
    }
    localStorage.setItem("gringo."+prId, JSON.stringify(meta));
    return meta;
}