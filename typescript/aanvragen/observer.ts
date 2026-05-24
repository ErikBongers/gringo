import {PartialUrlObserver} from "../pageObserver";
import {emmet} from "../../libs/Emmeter/html";
import {cloud} from "../cloud";
import {KEY_CLOUD_METAS_FOLDER, KEY_LAST_FETCHED_METAS} from "../def";
import {gringo} from "../globals";
import {FetchChain} from "../fetchChain";
import {clearMetasLocal, getMetaLocal, saveMetaLocal, saveMetasLocal} from "../db/gringoDb";
import {getGlobalSettingsCached} from "../plugin_options/options";
import {UserInfo} from "../sap/SapUserInfo";
import { RequestListResponse } from "../sap/RequestListResponse";
import {fetchFullRequest} from "../sap/api";

class AanvragenObserver extends PartialUrlObserver {
    constructor() {
        super( "request-info-list/requisition", onMutation, false, onPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return isPageProbablyLoaded();
    }
}

export default new AanvragenObserver();

function onPageRefreshed() {
    gringo("page Aanvragen refreshed xxx.");
    checkDecorations();
}

function isPageProbablyLoaded(): boolean {
    return !! getPagination();
}

function onMutation(mutation: MutationRecord) {
    checkDecorations();
    return false;
}

function checkAndSetListPageDecorated(el: HTMLElement) {
    let input = el as HTMLInputElement;
    let isDecorated = el.dataset.gringoCurrentPage == input.value;
    el.dataset.gringoCurrentPage = input.value;
    return isDecorated;
}

function checkDecorations() {
    checkAndSetDecoration("filters", document.querySelector(".request-search-panel"), decorateSearchPanel);
    checkAndSetDecoration("listPage", getListTabDecoratedElement(), decorateRequestList, checkAndSetListPageDecorated);
}

function getPagination(): Pagination | null {
    let paginationElement = document.querySelector("fd-pagination") as HTMLElement | null;
    if (!paginationElement)
        return null;
    let currentPageElement = paginationElement.querySelector('input')!;
    let currentPage = parseInt(currentPageElement.value);
    let nextButton = paginationElement.querySelector("button[glyph='navigation-right-arrow']") as HTMLButtonElement | null;
    if(!nextButton)
        return null;
    let hasNext = nextButton.classList.contains("is-disabled");
    return {
        currentPage: currentPage,
        currentPageElement,
        hasNext: hasNext,
    }
}

interface Pagination {
    currentPage: number;
    currentPageElement: HTMLElement;
    hasNext: boolean;
}

type DecorationKeys = "filters" | "listPage";

function getListTabDecoratedElement() {
    let tabContainer = document.querySelector("request-info-requisitions") as HTMLElement | null;
    if(!tabContainer)
        return null;
    return getPagination()?.currentPageElement??null;
}

function checkAndSetDecoration(key: DecorationKeys, el: HTMLElement | null, decorator: () => void, customCheckAndSet?: (el: HTMLElement) => boolean) {
    if(!el)
        return;
    if(customCheckAndSet) {
        if(!customCheckAndSet(el)) {
            decorator();
        }
        return;
    }

    if(el.dataset.gringoDecorated != "true") {
        el.dataset.gringoDecorated = "true";
        decorator();
    }
}

let globalPrs: RequestBasicInfo[] = [];

function gotoNextPage(pagination: HTMLElement) {
    let activeButton = pagination.querySelector("button.is-active") as HTMLButtonElement | null;
    gringo("At page " + activeButton?.textContent.trim());
    let nextButton = pagination.querySelector("button[glyph='navigation-right-arrow']") as HTMLButtonElement | null;
    if(!nextButton)
        return;
    scrapePRs();
    if(nextButton.classList.contains("is-disabled")) {
        gringo("THE END");
        gringo(globalPrs);
    }
    else
        nextButton.click();
}

async function applyFilters(requests: RequestBasicInfo[]) {
    gringo("Applying filters...");
    let filters = getTagsFilters();
    let selectedTags = filters.filter(t => t.filterType == "==");
    let excludedTags = filters.filter(t => t.filterType == "!=");
    for(let request of requests) {
        let reqDiv = document.getElementById("request-" + request.id);
        if(!reqDiv)
            continue;
        let meta = await fetchMetaCached(request.id);
        let hasAllSelectedTags = selectedTags.every(t => meta.tags.includes(t.name));
        let hasNoExcludedTags = excludedTags.every(t => !meta.tags.includes(t.name));
        reqDiv.classList.toggle("hidden", !(hasAllSelectedTags && hasNoExcludedTags));
    }
}

function decorateRequestList() {
    let main = document.querySelector("main");
    if(!main)
        return;
    main.classList.toggle("hideOnBehalfOf", true);
    main.classList.toggle("hideTeam", true);

    let requests  = scrapePRs();

    fetchChangedMetas().then(async (changedFiles) => {
        gringo(changedFiles);
        gringo("Todo: update local cache and UI");
        await saveMetasLocal(changedFiles.map(f => f.data));
        requests.forEach(decoratePr);
        await applyFilters(requests);
    });

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

function updateTagsFilters(filters: TagsFilter[]) {
    let table = document.getElementById("tagsFilterTable") as HTMLTableElement;
    for(let tr of table.tBodies[0].rows) {
        let tagName = tr.dataset.tagName!;
        let filter = filters.find(f => f.name == tagName);
        let btnFilter = tr.querySelector("button.filter") as HTMLButtonElement;
        if(!filter) {
            btnFilter.classList.toggle("equal", false);
            btnFilter.classList.toggle("notEqual", false);
            btnFilter.classList.toggle("empty", true);
            continue;
        }
        btnFilter.classList.toggle("empty", false);
        btnFilter.classList.toggle("equal", filter.filterType=="==");
        btnFilter.classList.toggle("notEqual", filter.filterType=="!=");
    }
}

function createTagFilterRow(tbody: HTMLTableSectionElement, tagDef: TagDef) {
    let tr = emmet.appendChild(tbody, `tr`).first as HTMLTableRowElement;
    tr.dataset.tagName = tagDef.name;
    emmet.appendChild(tr, `
                (td>span.naked.gringoTag{${tagDef.name}})+
                (td>button.naked.filter>(
                    span.equal{✔}+
                    span.notEqual{❌}+
                    span.empty{▢}
                    )
                )
            `);
    let tagSpan = tr.querySelector("span")!;
    paintTag(tagSpan, tagDef, true);
    let filterButton = tr.querySelector("button.filter") as HTMLButtonElement;
    filterButton.onclick = async (ev) => {
        let filters = getTagsFilters();
        let filter = filters.find(t => t.name == tagDef.name);
        if (!filter) {
            let filter: TagsFilter = {
                name: tagDef.name,
                filterType: "=="
            }
            filters.push(filter);
        } else {
            if (filter.filterType == "==")
                filter.filterType = "!=";
            else
                filters = filters.filter(f => f.name != tagDef.name);
        }
        saveTagsFilters(filters);
        updateTagsFilters(filters);
        await applyFilters(globalPrs);
    };
}

function decorateSearchPanel() {
    let requestSearchPanel = document.querySelector(".request-search-panel") as HTMLDivElement;
    let divSearchPanel = document.querySelector(`div.gringoSearchPanel`) as HTMLDivElement | null;
    if(!divSearchPanel)
        divSearchPanel = emmet.insertAfter(requestSearchPanel, `div.gringoSearchPanel`).first as HTMLDivElement;
    divSearchPanel.innerHTML = "";
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
            createTagFilterRow(tbody, tagDef);
        });
    updateTagsFilters(getTagsFilters());
    let btnTestFetch = emmet.appendChild(tagsCollapse,`div>button#btnTestFetch{TEST Fetch last clicked}`).last as HTMLButtonElement;
    btnTestFetch.onclick = async (ev) => {
        if(globalLastRequestTagsClicked)
            await fetchFullRequestx(globalLastRequestTagsClicked.id);
    };
    let btnTestRequestList = emmet.appendChild(tagsCollapse,`div>button#btnTestRequestList{TEST Fetch all}`).last as HTMLButtonElement;
    btnTestRequestList.onclick = async (ev) => {
        await fetchRequestList();
    };
    let btnTestRequestListAndDetails = emmet.appendChild(tagsCollapse,`div>button#btnTestRequestListAndDetails{TEST Fetch all with details}`).last as HTMLButtonElement;
    btnTestRequestListAndDetails.onclick = async (ev) => {
        await fetchRequestListAndDetails();
    };

    function onAribaFilterButton() {
        let inputCurrentPage = getListTabDecoratedElement();
        if(!inputCurrentPage)
            return;
        inputCurrentPage.dataset.gringoCurrentPage = "";
    }
    [...requestSearchPanel.querySelectorAll(".search-button-container button")]
        .forEach((button: HTMLButtonElement) => {
            button.addEventListener("click", onAribaFilterButton);
        });
}

function scrapePRs() {
    gringo("Scraping...");
    let requestsDivs = document.querySelectorAll("request-info-item");
    let infos = [...requestsDivs].map(scrapeInfoItem);
    gringo(`Found ${infos.length} items.`);
    if(infos.length > 0)
        document.body.dataset.gringoPageScraped = "true";
    globalPrs = infos;
    return globalPrs;
}

export type RequestBasicInfo = {
    id: string,
    orderAnchors: HTMLAnchorElement[],

}

function scrapeInfoItem(requestDiv: HTMLDivElement): RequestBasicInfo {
    let id = requestDiv.id.substring("request-".length);
    let divOrders = requestDiv.querySelector(".item-orders");
    let orderAnchors: HTMLAnchorElement[] = [];
    if(divOrders) {
         orderAnchors = [...divOrders.querySelectorAll(".request-po-list-container ul > li a") as NodeListOf<HTMLAnchorElement>];
    }
    return {id, orderAnchors};
}

export interface PrMeta {
    prId: string,
    tags: string[],
    project?: string,
}

type FilterType = "==" | "!=";

interface TagsFilter {
    name: string,
    filterType: FilterType,
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
}

async function decoratePr(request: RequestBasicInfo) {
    let reqDiv = document.getElementById("request-" + request.id);
    if(!reqDiv)
        return;
    if(reqDiv.dataset.gringo == "decorated")
        return;
    reqDiv.dataset.gringo = "decorated";
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
    { name: "BK", description: "", color: "", bkgColor: "", order: 301},
    { name: "brol", description: "", color: "", bkgColor: "", order: 330},
    { name: "Zever", description: "", color: "blue", bkgColor: "", order: 390},
    { name: "En", description: "", color: "blue", bkgColor: "", order: 400},
    { name: "Nog", description: "", color: "blue", bkgColor: "", order: 500},
    { name: "Veel", description: "", color: "blue", bkgColor: "", order: 600},
    { name: "Langerx", description: "", color: "blue", bkgColor: "", order: 700},
];
const defaultTagsMap: Map<string, TagDef> = new Map(defaultTags.map(t => [t.name, t]));

function getTagsFilters() {
    let json = localStorage.getItem('gringo.tagsFilters');
    if(!json)
        return [];
    return JSON.parse(json) as TagsFilter[];
}

function saveTagsFilters(tagsFilters: TagsFilter[]) {
    localStorage.setItem('gringo.tagsFilters', JSON.stringify(tagsFilters));
}

function updatePrLine(request: RequestBasicInfo, meta: PrMeta) {
    let reqDiv = document.getElementById("request-" + request.id);
    if(!reqDiv)
        return;
    let tagsContainer = reqDiv.querySelector(".tagsContainer") as HTMLButtonElement | null;
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
    let orphans = meta.tags.filter(tag => !defaultTags.find(tagDef => tagDef.name == tag));
    if(orphans.length > 0) {
        emmet.appendChild(tagsContainer, orphans.map(tag => `span.gringoTag{${tag}}`).join("+"));
    }
    let select = reqDiv.querySelector("div.projectWrapper select")! as HTMLSelectElement;
    if(meta.project)
        select.value = meta.project;
}

function paintTag(tagElement: HTMLElement, tagDef: TagDef, selected: boolean) {
    tagElement.innerText = tagDef.name;
    tagElement.classList.add("gringoTag");
    tagElement.style.color = tagDef.color != "" ? tagDef.color : "inherit";
    tagElement.style.backgroundColor = tagDef.bkgColor != "" ? tagDef.bkgColor : "inherit";
    tagElement.title = tagDef.description;
    tagElement.classList.toggle("selected", selected);
}

async function fetchRequestList() {
    let chain = new FetchChain();
    await chain.fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false"); //todo: load once.
    let userInfo  = chain.getJson() as UserInfo | null;
    if(!userInfo) {
        console.error("gringo: could not get userInfo.");
    }

    //todo: is browserrequestid needed? or can I use a custom one?
    await chain.post(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/getYourRequestsWithTabSupport?yourRequestsTab=requisition&yourRequestType=all&browserRequestId=newYourRequests1779060906435`,
        {
            "searchFilters": {
                "LastUpdatedFromDate": "2026-02-17 23:00:00 GMT",
                "LastUpdatedToDate": "2026-05-18 21:59:59 GMT"
            },
            "requestTypeFilter": "all",
            "orderByField": "daterequested",
            "ascendingOrder": false
        }
        );
    let requestList: RequestListResponse = await chain.getJson();
    gringo(requestList);
    return requestList
}

async function fetchRequestListAndDetails() {
    let requestList = await fetchRequestList();
    let promises = requestList.requestList.map(r => {
        let requestId = r.id!;
        debugger;
        return fetchFullRequestx(requestId)
    })

    let detailsList = await Promise.all(promises);
    debugger;
    return detailsList;
}

let globalLastRequestTagsClicked: RequestBasicInfo | null;

export async function fetchFullRequestx(prId: string) {
    let pr = await fetchFullRequest(prId);
    let prTitle = pr.title.value;
    let prStatus = pr.status;
    gringo(pr);
    for(let lineItem of pr.lineItems) {
        let accounting = lineItem.accounting;
        let rekening = "";
        if(accounting.fields) {
            for (let field of accounting.fields) {
                if (field.name == "GeneralLedger")
                    rekening = field.value as string;
            }
        }
        let price = lineItem.quantity.value;//note that we are using the quantity field to store the price!
        let orderId = lineItem.orderID??"-";
        gringo(`${pr.reqId}/${orderId} : ${prTitle} : ${prStatus} : [${rekening}] : ${price}`);
    }
    return pr;
}

async function addMeta(request: RequestBasicInfo, meta: PrMeta) {
    let reqDiv = document.getElementById("request-" + request.id);
    if(!reqDiv)
        return;
    let divStatusContainer = reqDiv.querySelector("div.item-status-container") as HTMLDivElement | null;
    if(!divStatusContainer)
        return;
    divStatusContainer = divStatusContainer.parentElement as HTMLDivElement;
    let metaWrapper = emmet.appendChild(divStatusContainer, `
        div.metaWrapper> (
            div.tagsWrapper.flexRow>(
                (button.naked.tagButton
                    >li.far.fa-circle-down)+
                div.tagsContainer
            )
        )
    `).first as HTMLDivElement;

    let button = metaWrapper.querySelector("button.tagButton") as HTMLButtonElement;

    button.onclick = (ev) => {
        onTagButtonClick(request, meta, button);
    };

    let projectWrapper = emmet.appendChild(metaWrapper, `
        div.projectWrapper.flexRow>(
            select
        )    
    `).first as HTMLDivElement;
    let select = divStatusContainer.querySelector("select")!;
    let options = [ "--selecteer--", ...(await getGlobalSettingsCached()).projects];
    for (let option of options) {
        let optionEl = document.createElement("option");
        optionEl.textContent = option;
        optionEl.value = option;
        select.appendChild(optionEl);
    }

    select.onchange = async (ev) => {
        await onSelectProjectClick(request, meta, select);
    }

    metaWrapper.onmousedown = (ev) => {
        ev.stopPropagation();
        // ev.preventDefault();
    };
    metaWrapper.onmouseup = (ev) => {
        ev.stopPropagation();
        // ev.preventDefault();
    };
    metaWrapper.onclick = (ev) => {
        ev.stopPropagation();
        // ev.preventDefault();
    };

}

async function onSelectProjectClick(request: RequestBasicInfo, meta: PrMeta, select: HTMLSelectElement) {
    meta.project = select.value;
    await saveMeta(meta.prId, meta, "localStorage and cloud");
}

function onTagButtonClick(request: RequestBasicInfo, meta: PrMeta, button: HTMLButtonElement) {
    let popover = document.getElementById("gringo-tags-popover") as HTMLElement;
    if(!popover)
        return;
    gringo("popover");
    // @ts-ignore
    popover.togglePopover({source:button});
    let container = popover.querySelector(".popoverContainer") as HTMLUListElement;
    container.classList.add("tagList");
    container.innerHTML = "";
    globalLastRequestTagsClicked = request;
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
                await saveMeta(request.id, meta, "localStorage and cloud");
                updatePrLine(request, meta);
            };
        });

}

async function saveMeta(prId: string, meta: PrMeta, what: "localStorage" | "localStorage and cloud") {
    if(what == "localStorage and cloud")
        await cloud.json.upload(KEY_CLOUD_METAS_FOLDER + prId, meta);
    await saveMetaLocal(meta);
}

async function fetchMetaCached(prId: string) {
    let localMeta = await getMetaLocal(prId);
    if(localMeta)
        return localMeta

    let meta: PrMeta =  {prId, tags: []};
    try {
        meta = await cloud.json.fetch(KEY_CLOUD_METAS_FOLDER + prId);
    } catch {
        await cloud.json.upload(KEY_CLOUD_METAS_FOLDER + prId, meta);
    }
    await saveMetaLocal(meta);
    return meta;
}

interface ChangedFile<T> {
    name: string;
    data: T,
    changed: string
}

async function fetchChangedMetas() {
    let changedMetas: ChangedFile<PrMeta>[];
    let zSince = localStorage.getItem(KEY_LAST_FETCHED_METAS);
    if(!zSince) {
        await clearMetasLocal(); //clear, since we have no idea if they are up-to-date.
        changedMetas = [];
    } else {
     changedMetas = await cloud.json.fetchSince(KEY_CLOUD_METAS_FOLDER, zSince);
    }
    let fetchedDate = new Date();
    fetchedDate = new Date(fetchedDate.getTime() - 5 * 60 * 1000);
    let zFetchedDate = fetchedDate.toISOString();
    localStorage.setItem(KEY_LAST_FETCHED_METAS, zFetchedDate);
    return changedMetas;
}
