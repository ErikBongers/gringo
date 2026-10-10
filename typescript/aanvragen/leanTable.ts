import {getPrDataList} from "./requests";
import {emmet} from "../../libs/Emmeter";
import {acronym, formatDate, formatPrice} from "../globals";

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
        emmet.indent.appendChild(tbody, `
            tr
                td{${pr.prListData.prId} ${pr.request.purchaseOrders?.join(", ") ?? ""}}
                td{${pr.request.reqTitle ?? ""}}
                td{${acronym(pr.request.preparer)}}
                td{${formatDate(pr.prListData.changed_date)}}
                td{${pr.request.status}}
                td.netto{${formatPrice(pr.netto)}}
                td.bruto{${formatPrice(pr.bruto)}}
                td{${pr.meta.project ?? ""}}
                td{${pr.meta.tags.join(", ")}}
                td{reserved for project(s))}
        `);
    }
    return table;
}