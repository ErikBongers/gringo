import {ElementOrSelector, getElement} from "./globals";

export interface RowFilter {
    context: any,
    rowFilter: (tr: HTMLTableRowElement, context: any) => Promise<boolean>
}

export async function filterTable(table: ElementOrSelector<HTMLTableElement>, rowFilter: RowFilter) {
    table = getElement(table);
    for (let tr of table.tBodies[0].rows) {
        tr.classList.toggle("hidden", !(await rowFilter.rowFilter(tr, rowFilter.context)));
    }
}