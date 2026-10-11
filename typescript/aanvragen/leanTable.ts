import {fetchMetaCached, getPrDataList} from "./requests";
import {emmet} from "../../libs/Emmeter";
import {acronym, formatDate, formatPrice} from "../globals";
import {addDepartmentBlock, addTagsBlock} from "./metaBlock";
import {applyFiltersForAribaTable, RequestBasicInfo} from "./observer";
import {filterTable, RowFilter} from "../filterTable";
import {getTagsFilters, matchTags, TagsFilter} from "./searchPanel";

export async function createLeanListTable(divLeanListPanel: HTMLDivElement) {
    let list = await getPrDataList();
    let table = emmet.indent.appendChild(divLeanListPanel, `
        table.leanPrList.bruto
            thead
                tr
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
                    th{ID/BB}
                    th{Omschrijving}
                    th{Door}
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
    for (let pr of list) {
        let poAnchorList = pr.request.gbPurchaseOrderList
            ?.map(po => `a.op07[href="${createPoUrl(po.uniqueName)}"]{ ${po.orderId} }`);
        let tr = emmet.indent.appendChild(tbody, `
            tr
                td
                    a.prId.op07[href="${createPrUrl(pr.prListData.prId)}"]{${pr.prListData.prId}}
                    ${poAnchorList?.join("+")}
                td
                    a{${pr.request.reqTitle ?? ""}}
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
        await addTagsBlock(tr.querySelector("td.tagsBlock")!, pr.meta);
        await addDepartmentBlock(tr.querySelector("td.departmentBlock")!, pr.meta);
    }
    return table;
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

export async function applyFiltersForLeanTable() {
    let table = document.querySelector("table.leanPrList") as HTMLTableElement;
    //todo: next 3 lines are duplicate with ariba filter function.
    let filters = getTagsFilters();
    let selectedTags = filters.filter(t => t.filterType == "==");
    let excludedTags = filters.filter(t => t.filterType == "!=");
    let rowFilter: RowFilter = {
        context: {},
        rowFilter: (tr: HTMLTableRowElement)=>
            leanRowFilter(tr, selectedTags, excludedTags)
    }
    await filterTable(table, rowFilter);
}

async function leanRowFilter(tr: HTMLTableRowElement, selectedTags: TagsFilter[], excludedTags: TagsFilter[]) {
    let prId = tr.dataset.prId!; //! must be set
    return matchTags(prId, selectedTags, excludedTags)
}