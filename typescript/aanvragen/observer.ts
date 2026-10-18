import {checkAndSetDecoration, PartialUrlObserver} from "../pageObserver";
import {emmet} from "../../libs/Emmeter";
import {addButtonClickNoPropagation, formatPrice, getOptions, gringo} from "../globals";
import {
    ExpandedPrListData,
    fetchChangedMetas,
    fetchFullRequest,
    FetchListContext,
    fetchMetaCached,
    fetchRequestList,
    fetchRequestListAndDetails,
    getGlobalTags,
    getPrDataList,
    PrMeta,
    TagDef
} from "./requests";
import {exportPrItemsToExcel} from "./aggregate";
import {fillTotalsTab} from "./totalsTab";
import {getLocalCache, LocalDb} from "../db/idb/localDb";
import {applyFiltersForLeanTable, createLeanListTable, decorateRowWithMeta} from "./leanTable";
import {displayMetaFields} from "./metaBlock";
import {createRowFilter, createSearchPanel, getPrFilterStrings,} from "./searchPanel";
import {RequestBasicInfo, scrapePRs} from "./scrape";
import {getGlobalSettingsCached, options} from "../plugin_options/options";
import {Repository} from "../db/idb/repository";
import {getInfoBlock, InfoBlock} from "../infoBlock/infoBlock";

class AanvragenObserver extends PartialUrlObserver {
    constructor() {
        super( "request-info-list/requisition", onMutation, false, onPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return isPageProbablyLoaded();
    }
}

export class RecentRequestsObserver extends PartialUrlObserver {
    constructor() {
        super( "request-info-list/recentrequests", onRecentRequestMutation, false, onRecentRequestPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return isPageProbablyLoaded();
    }
}

let requestObservers = {
    aanvragenObserver: new AanvragenObserver(),
    recentRequestsObsverver: new RecentRequestsObserver(),
}
export default requestObservers;

function onPageRefreshed() {
    gringo("onPageRefreshed()");
    checkDecorations();
}

function onRecentRequestPageRefreshed() {
    checkRecentRequestsDecorations();
}

function isPageProbablyLoaded(): boolean {
    return !! getPagination();
}

function onMutation(mutation: MutationRecord) {
    checkDecorations();
    return false;
}

function onRecentRequestMutation(mutation: MutationRecord) {
    checkRecentRequestsDecorations();
    return false;
}

function checkAndSetListPageDecorated(el: HTMLElement) {
    let input = el as HTMLInputElement;
    let isDecorated = el.dataset.gringoCurrentPage == input.value;
    el.dataset.gringoCurrentPage = input.value;
    return isDecorated;
}

function checkandGetTabsFilled() {
    let tabs= document.querySelector("nav.requests-nav div.tablist-element") as HTMLElement | null;
    if(tabs?.querySelectorAll("div").length == 0)
        return null;
    return tabs;
}

function checkDecorations() {
    checkAndSetDecoration(document.querySelector("body"), decorateBody);
    checkAndSetDecoration(document.querySelector("main"), decorateMain);
    checkAndSetDecoration(checkandGetTabsFilled(), decorateTabs);
    checkAndSetDecoration(document.querySelector(".request-search-panel"), decorateSearchPanel);
    checkAndSetDecoration(getListTabDecoratedElement(), (el) => decoratePagination(), checkAndSetListPageDecorated);
}

function decorateBody() {
}
function checkRecentRequestsDecorations() {
    checkAndSetDecoration(document.querySelector("body"), decorateBody);
    checkAndSetDecoration(document.querySelector("main"), decorateMain);
    checkAndSetDecoration(document.querySelector("nav.requests-nav div.tablist-element"), decorateTabs);
}

function getPagination(): Pagination | null {
    let paginationElement = document.querySelector("fd-pagination") as HTMLElement | null;
    if (!paginationElement)
        return null;
    let currentPageElement = paginationElement.querySelector('input')!;
    if(!currentPageElement) {
        return {
            currentPage: 1,
            currentPageElement: null,
            hasNext: false
        }
    }
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
    currentPageElement: HTMLElement | null;
    hasNext: boolean;
}

function getListTabDecoratedElement() {
    let tabContainer = document.querySelector("request-info-requisitions") as HTMLElement | null;
    if(!tabContainer)
        return null;
    return getPagination()?.currentPageElement??null;
}

// let globalPrs: RequestBasicInfo[] = [];

function gotoNextPage(pagination: HTMLElement) {
    let activeButton = pagination.querySelector("button.is-active") as HTMLButtonElement | null;
    gringo("At page " + activeButton?.textContent.trim());
    let nextButton = pagination.querySelector("button[glyph='navigation-right-arrow']") as HTMLButtonElement | null;
    if(!nextButton)
        return;
    scrapePRs();
    if (!nextButton.classList.contains("is-disabled")) {
        nextButton.click();
    }
}

async function decoratePagination() {
    let main = document.querySelector("main");
    if(!main)
        return;
    main.classList.toggle("hideOnBehalfOf", true);
    main.classList.toggle("hideTeam", true);

    let requests  = scrapePRs();

    gringo("LEAN: getPrDataList()");
    let prDataList = await getPrDataList();
    let changedFiles = await fetchChangedMetas();
    let options = await getOptions();
    if(options.showLeanRequests) {
        let divLeanListPanel = document.querySelector(`div.gringoLeanListPanel`) as HTMLDivElement | null;
        if (!divLeanListPanel) {
            let requestSearchPanel = document.querySelector(".request-search-panel") as HTMLDivElement;
            divLeanListPanel = emmet.insertAfter(requestSearchPanel, `div.gringoLeanListPanel`).first as HTMLDivElement;
        }
        await createLeanListTable(divLeanListPanel, prDataList);
    }

    gringo("Saving changed metas...");
    await (await getLocalCache()).PrMetas.bulkPut(changedFiles.map(f => f.data));
    let departments = (await getGlobalSettingsCached()).projects;
    let tagsMap = await getGlobalTags();
    let prMetas = (await getLocalCache()).PrMetas;

    gringo("Decorating requests...");
    let prDataMap: Map<string, ExpandedPrListData> = new Map();
    for(let pr of prDataList) {
        prDataMap.set(pr.prListData.prId, pr);
    }
    for (const r of requests) {
        await decoratePr(r, departments, tagsMap, prMetas, prDataMap.get(r.id));
    }

    await applyFilters(requests);

    gringo("Done.");
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

function addTestButtons(tagsCollapse: HTMLDetailsElement) {
    let infoBlock: InfoBlock = getInfoBlock(tagsCollapse);
    let btnTestFetch = emmet.appendChild(tagsCollapse, `div>button#btnTestFetch{TEST Fetch last clicked}`).last as HTMLButtonElement;
    let ctx: FetchListContext = {
        counter: 0,
        infoBlock
    }
    btnTestFetch.onclick = async (ev) => {
        if (globalLastRequestTagsClicked)
            await fetchFullRequest(globalLastRequestTagsClicked.id, ctx);
    };
    let btnTestRequestList = emmet.appendChild(tagsCollapse, `div>button#btnTestRequestList{TEST Fetch all}`).last as HTMLButtonElement;
    btnTestRequestList.onclick = async (ev) => {
        await fetchRequestList();
    };
    let btnTestListData = emmet.appendChild(tagsCollapse, `div>button#btnTestRequestList{TEST Fetch list data}`).last as HTMLButtonElement;
    btnTestListData.onclick = async (ev) => {
        let list = await getPrDataList();
        gringo("lizst");
        console.log(list);
    };
    let btnTestRequestListAndDetails = emmet.appendChild(tagsCollapse, `div>button#btnTestRequestListAndDetails{TEST Fetch all with details}`).last as HTMLButtonElement;
    btnTestRequestListAndDetails.onclick = async (ev) => {
        await fetchRequestListAndDetails(infoBlock);
    };
    let btnTestExportToExcel = emmet.appendChild(tagsCollapse, `div>button#btnTestExportToExcel{TEST Export to Excel}`).last as HTMLButtonElement;
    btnTestExportToExcel.onclick = async (ev) => {
        await exportPrItemsToExcel(infoBlock);
    };
}

async function decorateSearchPanel() {
    let requestSearchPanel = document.querySelector(".request-search-panel") as HTMLDivElement;
    let divSearchPanel = document.querySelector(`div.gringo.gringoSearchPanel`) as HTMLDivElement | null;
    if(!divSearchPanel) {
        let result = emmet.insertAfter(requestSearchPanel, `div.gringo.gringoSearchPanel+div.gringoLeanListPanel`);
        divSearchPanel = result.first as HTMLDivElement;
    }
    await createSearchPanel(divSearchPanel, applyFilters);
    // addTestButtons(tagsCollapse);

    function onAribaFilterButton() {
        let inputCurrentPage = getListTabDecoratedElement();
        if(!inputCurrentPage)
            return;
        inputCurrentPage.dataset.gringoCurrentPage = "";
    }
    [...requestSearchPanel.querySelectorAll(".search-button-container button")]
        .forEach((button: Element) => {
            button.addEventListener("click", onAribaFilterButton);
        });

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

async function decoratePr(request: RequestBasicInfo, departments: string[], tagsMap: Map<string, TagDef>, prMetas: Repository<LocalDb, "PrMetas">, prData: ExpandedPrListData | undefined) {
    let reqDiv = document.getElementById("request-" + request.id);
    if(!reqDiv)
        return;
    if(reqDiv.dataset.gringo == "decorated")
        return;
    reqDiv.dataset.gringo = "decorated";
    addOrderCopyButton(request);
    let meta = await fetchMetaCached(request.id, prMetas);
    decoratePrWithMeta(request, meta, departments, tagsMap);
    updatePrLine(request, meta, prData);
}

function updatePrLine(request: RequestBasicInfo, meta: PrMeta, prData: ExpandedPrListData | undefined) {
    let reqDiv = document.getElementById("request-" + request.id);
    if(!reqDiv)
        return;
    let metaWrapper = reqDiv.querySelector(".metaWrapper") as HTMLElement | null;
    if(!metaWrapper)
        return;
    let newTotal = reqDiv.querySelector("div.gringo.listRowTotal") as HTMLDivElement;

    newTotal.textContent = formatPrice(prData?.bruto??null);
    newTotal.style.display = "block";
    reqDiv.dataset.gringoTags = ";" + meta.tags.join(";") + ";";
}

let globalLastRequestTagsClicked: RequestBasicInfo | null = null;

function decoratePrWithMeta(request: RequestBasicInfo, meta: PrMeta, departments: string[], tagsMap: Map<string, TagDef>) {
    let reqDiv = document.getElementById("request-" + request.id);
    if(!reqDiv)
        return;
    let divStatusContainer = reqDiv.querySelector("div.item-status-container") as HTMLDivElement | null;
    if(!divStatusContainer)
        return;
    divStatusContainer = divStatusContainer.parentElement as HTMLDivElement;
    let metaWrapper = displayMetaFields(divStatusContainer, meta, departments, tagsMap, (meta) => decorateRowWithMeta(reqDiv, meta));

    metaWrapper.onmousedown = metaWrapper.onmouseup = metaWrapper.onclick = (ev: Event) => {
        ev.stopPropagation();
    };

    let reqItem =document.getElementById("requisition-item-"+request.id);
    if(!reqItem)
        return;
    let lastField = reqItem.querySelector(":scope > div.last-field") as HTMLDivElement;
    lastField.style.fontSize = ".6rem";
    let moneyAmount = lastField.querySelector("span.money-amount") as HTMLSpanElement;
    emmet.insertAfter(moneyAmount, `
        div.gringo.blueBlock.listRowTotal{€-.---,--}    
    `);
}

export function hideFloatingHelp() {
    let helpPopup = document.querySelector("div.helplinkContainer") as HTMLElement;
    helpPopup.style.display = "none";
}

export async function applyFilters(requests?: RequestBasicInfo[]) {
    gringo("Applying filters...");
    await applyFiltersForAribaTable(requests);
    if(options.showLeanRequests) {
        await applyFiltersForLeanTable();
    }
}

export async function applyFiltersForAribaTable(requests?: RequestBasicInfo[]) {
    if(!requests)
        requests = scrapePRs();
    let filterDef = getPrFilterStrings();
    let prMetas = (await getLocalCache()).PrMetas;
    let rowFilterDef = createRowFilter<HTMLDivElement>(filterDef, prMetas, (div) => {
        return {rowText: div.innerText, tagString: div.dataset.gringoTags!};
    });
    for (let request of requests) {
        let reqDiv = document.getElementById("request-" + request.id) as HTMLDivElement | null;
        if (!reqDiv)
            continue;
        let match = rowFilterDef.rowFilter(rowFilterDef.rowConverter(reqDiv), rowFilterDef.context);
        reqDiv.classList.toggle("hidden", !match);
    }
}
