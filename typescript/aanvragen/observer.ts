import {PartialUrlObserver} from "../pageObserver";
import {emmet} from "../../libs/Emmeter/html";
import {gringo, priceFormatter} from "../globals";
import {saveMetasLocal} from "../db/gringoDb";
import {getGlobalSettingsCached} from "../plugin_options/options";
import {fetchPr} from "../sap/api";
import {calcPrTotal, createExpandedPr} from "../aanvraag/observer";
import {fetchChangedMetas, fetchFullRequest, fetchMetaCached, fetchRequestList, fetchRequestListAndDetails, getGlobalTags, PrMeta, saveMeta, TagDef} from "./requests";
import {exportPrItemsToExcel} from "./aggregate";
import {fillTotalsTab} from "./totalsTab";

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
    checkAndSetDecoration(document.querySelector("main"), decorateMain);
    checkAndSetDecoration(document.querySelector("nav.requests-nav div.tablist-element"), decorateTabs);
    checkAndSetDecoration(document.querySelector(".request-search-panel"), decorateSearchPanel);
    checkAndSetDecoration(getListTabDecoratedElement(), decorateRequestList, checkAndSetListPageDecorated);
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

function getListTabDecoratedElement() {
    let tabContainer = document.querySelector("request-info-requisitions") as HTMLElement | null;
    if(!tabContainer)
        return null;
    return getPagination()?.currentPageElement??null;
}

function checkAndSetDecoration(el: HTMLElement | null, decorator: (el: HTMLElement) => void, customCheckAndSet?: (el: HTMLElement) => boolean) {
    if(!el)
        return;
    if(customCheckAndSet) {
        if(!customCheckAndSet(el)) {
            decorator(el);
        }
        return;
    }

    if(el.dataset.gringoDecorated != "true") {
        el.dataset.gringoDecorated = "true";
        decorator(el);
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

function decorateTabs(el: HTMLElement) {
    let tabs = [...el.querySelectorAll("div:not(.gringo).fd-tabs__item") as NodeListOf<HTMLDivElement>];
    tabs.forEach(tab => {
        tab.addEventListener("click", (ev) => {
            let main = document.querySelector("main")!;
            main.classList.remove("hide");
            let totalsContainer = document.querySelector("div.gringo.totalsTab")!;
            totalsContainer.classList.add("hide");
            let tabs2 = [...document.querySelectorAll("div.fd-tabs__item") as NodeListOf<HTMLDivElement>];
            tabs2.forEach(tab2 => {
                tab2.children[0].setAttribute("aria-selected", "false");
                tab2.children[0].classList.remove("is-selected");
            });
            (ev.currentTarget as HTMLElement).children[0].setAttribute("aria-selected", "true");
            (ev.currentTarget as HTMLElement).children[0].classList.add("is-selected");

        });
    });
    emmet.appendChild(el, `
        div.fd-tabs__item.totalsTab>
            button.noBkg.fd-tabs__link>
                span.fd-tabs__tag{Totalen}
    `);
    let button = el.querySelector("button") as HTMLButtonElement;
    button.onclick = () => { onTabButtonClick(el as HTMLDivElement); };
}

function decorateMain(el: HTMLElement) {
    emmet.insertAfter(el, `
        div.gringo.totalsTab.hide{Tadaaaa!}    
    `);
}

function onTabButtonClick(tabContainer: HTMLDivElement) {
    let tabs = [...tabContainer.querySelectorAll("div.fd-tabs__item") as NodeListOf<HTMLDivElement>];
    tabs.forEach(tab => {
        tab.children[0].setAttribute("aria-selected", "false");
        tab.children[0].classList.remove("is-selected");
    });
    let last = tabs.pop()!;
    last.children[0].setAttribute("aria-selected", "true");
    let totalsContainer = document.querySelector("div.gringo.totalsTab") as HTMLDivElement;
    totalsContainer.classList.remove("hide");
    let main = document.querySelector("main")!;
    main.classList.add("hide");
    fillTotalsTab();
}

async function decorateSearchPanel() {
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
    let globalTags = await getGlobalTags();
    [...globalTags.values()]
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            createTagFilterRow(tbody, tagDef);
        });
    updateTagsFilters(getTagsFilters());
    let btnTestFetch = emmet.appendChild(tagsCollapse,`div>button#btnTestFetch{TEST Fetch last clicked}`).last as HTMLButtonElement;
    btnTestFetch.onclick = async (ev) => {
        if(globalLastRequestTagsClicked)
            await fetchFullRequest(globalLastRequestTagsClicked.id);
    };
    let btnTestRequestList = emmet.appendChild(tagsCollapse,`div>button#btnTestRequestList{TEST Fetch all}`).last as HTMLButtonElement;
    btnTestRequestList.onclick = async (ev) => {
        await fetchRequestList();
    };
    let btnTestRequestListAndDetails = emmet.appendChild(tagsCollapse,`div>button#btnTestRequestListAndDetails{TEST Fetch all with details}`).last as HTMLButtonElement;
    btnTestRequestListAndDetails.onclick = async (ev) => {
        await fetchRequestListAndDetails();
    };
    let btnTestExportToExcel = emmet.appendChild(tagsCollapse,`div>button#btnTestExportToExcel{TEST Export to Excel}`).last as HTMLButtonElement;
    btnTestExportToExcel.onclick = async (ev) => {
        await exportPrItemsToExcel();
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

async function decoratePr(request: RequestBasicInfo) {
    let reqDiv = document.getElementById("request-" + request.id);
    if(!reqDiv)
        return;
    if(reqDiv.dataset.gringo == "decorated")
        return;
    reqDiv.dataset.gringo = "decorated";
    addOrderCopyButton(request);
    let meta = await fetchMetaCached(request.id);
    await decoratePrWithMeta(request, meta);
    await updatePrLine(request, meta);
}

function getTagsFilters() {
    let json = localStorage.getItem('gringo.tagsFilters');
    if(!json)
        return [];
    return JSON.parse(json) as TagsFilter[];
}

function saveTagsFilters(tagsFilters: TagsFilter[]) {
    localStorage.setItem('gringo.tagsFilters', JSON.stringify(tagsFilters));
}

async function updatePrLine(request: RequestBasicInfo, meta: PrMeta) {
    let reqDiv = document.getElementById("request-" + request.id);
    if(!reqDiv)
        return;
    let tagsContainer = reqDiv.querySelector(".tagsContainer") as HTMLButtonElement | null;
    if(!tagsContainer)
        return;
    tagsContainer.innerHTML = "";
    let globalTagsMap = await getGlobalTags();
    meta.tags
        .map(tag => {
            return globalTagsMap.get(tag);
        })
        .filter(t  => !!t)
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            let tagSpan = emmet.appendChild(tagsContainer, `
                span    
            `).first as HTMLSpanElement;
                paintTag(tagSpan, tagDef, true);
        });
    let orphans = meta.tags.filter(tag => ![...globalTagsMap.values()].find(tagDef => tagDef.name == tag));
    if(orphans.length > 0) {
        emmet.appendChild(tagsContainer, orphans.map(tag => `span.gringoTag{${tag}}`).join("+"));
    }
    let select = reqDiv.querySelector("div.projectWrapper select")! as HTMLSelectElement;
    if(meta.project)
        select.value = meta.project;
    let newTotal = reqDiv.querySelector("div.gringo.listRowTotal") as HTMLDivElement;
    let pr = await fetchPr(request.id);
    let expPr = await createExpandedPr(pr);
    let {total, currencySymbel} = calcPrTotal(expPr);

    if(total != 0) {
        newTotal.textContent = `${currencySymbel}${priceFormatter.format(total)}`; //todo: use formatprice()
        newTotal.style.display = "block";
    }
    else
        newTotal.style.display = "none";
}

function paintTag(tagElement: HTMLElement, tagDef: TagDef, selected: boolean) {
    tagElement.innerText = tagDef.name;
    tagElement.classList.add("gringoTag");
    tagElement.style.color = tagDef.color != "" ? tagDef.color : "inherit";
    tagElement.style.backgroundColor = tagDef.bkgColor != "" ? tagDef.bkgColor : "inherit";
    tagElement.title = tagDef.description;
    tagElement.classList.toggle("selected", selected);
}

let globalLastRequestTagsClicked: RequestBasicInfo | null;

async function decoratePrWithMeta(request: RequestBasicInfo, meta: PrMeta) {
    let reqDiv = document.getElementById("request-" + request.id);
    if(!reqDiv)
        return;
    let divStatusContainer = reqDiv.querySelector("div.item-status-container") as HTMLDivElement | null;
    if(!divStatusContainer)
        return;
    divStatusContainer = divStatusContainer.parentElement as HTMLDivElement;
    let metaWrapper = emmet.appendChild(divStatusContainer, `
        div.metaWrapper>(
            (
                div.tagsWrapper.flexRow>(
                    (button.naked.tagButton
                        >li.far.fa-circle-down)+
                    div.tagsContainer
                )
            )+
            (
                div.projectWrapper.flexRow>(
                    select
                )
            )    
        )
    `).first as HTMLDivElement;

    let button = metaWrapper.querySelector("button.tagButton") as HTMLButtonElement;

    button.onclick = (ev) => {
        onTagButtonClick(request, meta, button);
    };

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

    metaWrapper.onmousedown = metaWrapper.onmouseup = metaWrapper.onclick = (ev) => {
        ev.stopPropagation();
    };

    let reqItem =document.getElementById("requisition-item-"+request.id);
    if(!reqItem)
        return;
    let lastField = reqItem.querySelector(":scope > div.last-field") as HTMLDivElement;
    lastField.style.fontSize = ".6rem";
    let moneyAmount = lastField.querySelector("span.money-amount") as HTMLSpanElement;
    emmet.insertAfter(moneyAmount, `
        div.gringo.blueBlock.listRowTotal{€1.234,56}    
    `);
}

async function onSelectProjectClick(request: RequestBasicInfo, meta: PrMeta, select: HTMLSelectElement) {
    meta.project = select.value;
    await saveMeta(meta.prId, meta, "localStorage and cloud");
}

async function onTagButtonClick(request: RequestBasicInfo, meta: PrMeta, button: HTMLButtonElement) {
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
    let globalTags = await getGlobalTags();
    [...globalTags.values()]
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
                await updatePrLine(request, meta);
            };
        });

}
