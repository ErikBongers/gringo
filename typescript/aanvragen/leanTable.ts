import {getGlobalTags, getPrDataList, PrMeta} from "./requests";
import {emmet} from "../../libs/Emmeter";
import {acronym, formatDate, formatPrice, gringo} from "../globals";
import {addDepartmentBlock, addTagsBlock} from "./metaBlock";
import {filterTable, RowFilter} from "../filterTable";
import {getTagsFilters, getTextFilter, matchTags, TagsFilter} from "./searchPanel";
import {Repository} from "../db/idb/repository";
import {getLocalCache, LocalDb} from "../db/idb/localDb";
import {getGlobalSettingsCached} from "../plugin_options/options";
import {DropDownMenu} from "../utils/dropDownMenus";

function sliceSupplierName(supplier: string) {
    let slices = supplier.split(/[()\[\]]/);
    if(slices.length > 1)
        return slices[1].trim();
    return supplier;
}

export async function createLeanListTable(divLeanListPanel: HTMLDivElement) {
    gringo("LEAN: getPrDataList()");
    let list = await getPrDataList();
    gringo("LEAN: build table");
    let table = emmet.indent.appendChild(divLeanListPanel, `
        table.leanPrList.bruto
            thead
                tr
                    th{}
                    th{}
                    th{}
                    th{}
                    th{}
                    th{}
                    th{}
                    th[colspan="2"]
                        button#inclExcl.naked{Incl.}
                    th{}
                    th{}
                    th{}
                tr
                    th[colspan="2"]{ID/BB}
                    th{Omschrijving}
                    th{Leverancier}
                    th{Wie}
                    th{Datum}
                    th{Status}
                    th.netto{Netto}
                    th.bruto{Bruto}
                    th{Afdeling}
                    th{Tags}
                    th{Projects}
            tbody
    `).first as HTMLTableElement;

    let tbody = table.querySelector("tbody")!; //! ok
    gringo("LEAN: get extra data...");
    let departments = (await getGlobalSettingsCached()).projects;
    let tagsMap = await getGlobalTags();
    gringo("LEAN: create rows...");
    for (let pr of list) {
        let poAnchorList = pr.request.gbPurchaseOrderList
            ?.map(po => `a.op07[href="${createPoUrl(po.uniqueName)}"]{ ${po.orderId} }`);
        let tr = emmet.indent.appendChild(tbody, `
            tr
                td
                    a.prId.op07[href="${createPrUrl(pr.prListData.prId)}"]{${pr.prListData.prId}}
                    ${poAnchorList?.join("+")}
                td
                    button.naked
                        i.far.fa-copy
                    div.menuContainer
                td
                    a{${pr.request.reqTitle ?? ""}}
                td{${pr.prListData.items.map(item => sliceSupplierName(item.supplier)).join(", ")}}
                td{${acronym(pr.request.preparer)}}
                td{${formatDate(pr.prListData.changed_date)}}
                td{${pr.request.status}}
                td.netto{${formatPrice(pr.netto)}}
                td.bruto{${formatPrice(pr.bruto)}}
                td.departmentBlock
                td.tagsBlock
                td{reserved for project(s))}
        `).first as HTMLTableRowElement;
        tr.dataset.prId = pr.prListData.prId;
        addTagsBlock(tr.querySelector("td.tagsBlock")!, pr.meta, tagsMap, (meta) => decorateRowWithMeta(tr, meta));
        addDepartmentBlock(tr.querySelector("td.departmentBlock")!, pr.meta, departments, (meta) => decorateRowWithMeta(tr, meta));
        let button = tr.querySelector("button");
        let container = tr.querySelector("div.menuContainer") as HTMLDivElement;
        button?.addEventListener("click", () => {
            showPrCopyMenu(container, button, pr.prListData.prId, pr.request.gbPurchaseOrderList?.map(po => po.orderId)??[]);
        });
    }
    return table;
}

export function decorateRowWithMeta(el: HTMLElement, meta: PrMeta) {
    el.dataset.gringoTags = ";" + meta.tags.join(";") + ";";
}

function showPrCopyMenu(container: HTMLElement, button: HTMLElement, prId: string, poIds: string[]) {
    let dropDownMenu = new DropDownMenu(container, button, true, false);
    dropDownMenu.addInfo("Copy:", 0);
    dropDownMenu.addItem(prId, 0, async () => {
        await navigator.clipboard.writeText(prId);
    });
    let poIdsString = poIds.join(", ");
    dropDownMenu.addItem(poIdsString, 0, async () => {
        await navigator.clipboard.writeText(poIdsString);
    });
    dropDownMenu.addItem(prId + "/" + poIdsString, 0, async () => {
        await navigator.clipboard.writeText(prId + "/" + poIdsString);
    });
    let poIdsStringPrefix = poIds.map(poId =>  "B603/" + poId).join(", ");
    dropDownMenu.addItem(poIdsStringPrefix, 0, async () => {
        await navigator.clipboard.writeText(poIdsStringPrefix);
    });
    dropDownMenu.show();
}

function createPrUrl(prId: string) {
    //https://s1-eu.ariba.com/gb/viewRequisition/PR79874?realm=744379882-C1,744379882-C1
    return `/gb/viewRequisition/${prId}`;
}

function createPoUrl(uniqueName: string) {
    //note this is not the poId (BB no).
    //https://s1-eu.ariba.com/gb/purchase-order/EP52156?realm=744379882-C1,744379882-C1
    return `/gb/purchase-order/${uniqueName}`;
}

export function getPrFilterStrings() {
    let tagsFilters = getTagsFilters();
    let textFilter = getTextFilter();
    let selectedTags = tagsFilters
        .filter(t => t.filterType == "==")
        .map(t => ";" + t.name + ";")
    ;
    let excludedTags = tagsFilters
        .filter(t => t.filterType == "!=")
        .map(t => ";" + t.name + ";")
    ;
    return {textFilter, selectedTags, excludedTags};
}

export async function applyFiltersForLeanTable() {
    let table = document.querySelector("table.leanPrList") as HTMLTableElement;
    //todo: next 3 lines are duplicate with ariba filter function.
    let {textFilter, selectedTags, excludedTags} = getPrFilterStrings();
    let prMetas = (await getLocalCache()).PrMetas;
    let rowFilter: RowFilter = {
        context: {},
        rowFilter: (tr: HTMLTableRowElement)=>
            leanRowFilter(tr, selectedTags, excludedTags, textFilter, prMetas)
    }
    await filterTable(table, rowFilter);
}

function leanRowFilter(tr: HTMLTableRowElement, selectedTags: string[], excludedTags: string[], textFilter: {text: string, solo: boolean}, prMetas: Repository<LocalDb, "PrMetas">) {
    let prId = tr.dataset.prId!; //! must be set
    let matchingText = matchText(tr, textFilter.text);
    if (!matchingText)
        return false;
    if(textFilter.solo)
        return matchingText;
    return matchTags(prId, selectedTags, excludedTags, tr.dataset.gringoTags!);
}

function matchText(tr: HTMLTableRowElement, textFilter: string) {
    if(!textFilter)
        return true;
    return tr.innerText.toLowerCase().includes(textFilter);
}
