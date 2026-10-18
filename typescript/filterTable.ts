import {ElementOrSelector, getElement} from "./globals";

export interface RowFilter<Context, SourceRow, RowType> {
    context: Context,
    rowConverter: (row: SourceRow) => RowType,
    rowFilter: (row: RowType, context: Context) => boolean
}

export async function filterTable<Context, RowType>(
    table: ElementOrSelector<HTMLTableElement>,
    rowFilter: RowFilter<Context, HTMLTableRowElement, RowType>,
) {
    table = getElement(table);
    for (let tr of table.tBodies[0].rows) {
        tr.classList.toggle("hidden", !rowFilter.rowFilter(rowFilter.rowConverter(tr), rowFilter.context));
    }
}