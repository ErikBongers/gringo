import {calcBrutoLinePrice, createExpandedPr, ExpandedPrItem} from "../aanvraag/observer";
import {ExpandedPr, fetchMetaCached, fetchRequestListAndDetails} from "./requests";
import {createHtmlTable, InfoBlock} from "../globals";
import {budgetDscrs, LedgerToBudgetCode, ledgerToBudgetCodes} from "./budgetCodes";

let _budgetMap: Map<string, LedgerToBudgetCode> | null = null;
export function getBudgetCode(ledger: string) {
    if(!_budgetMap) {
        _budgetMap = new Map<string, LedgerToBudgetCode>();
        ledgerToBudgetCodes.forEach(budget => {
            _budgetMap!.set(budget.ledger10, budget); //! just created map.
        })
    }

    return _budgetMap.get(ledger.substring(0, 10))??null;
}

let _budgetDscrMap: Map<string, string> | null = null;
export function getBudgetDscr(budget: string) {
    if(!_budgetDscrMap) {
        _budgetDscrMap = new Map<string, string>();
        budgetDscrs.forEach(budget => {
            _budgetDscrMap!.set(budget[0], budget[1]); //! just created map.
        })
    }

    return _budgetDscrMap.get(budget)??null;
}

export async function getExtendedRequests(infoBlock: InfoBlock) {
    let reqs = (await fetchRequestListAndDetails(infoBlock))
        .filter(pr => pr != null)
        .filter(pr => pr.status != "sdfsdf");

    let extendedReqs: ExpandedPr[] = [];
    for (const pr of reqs) {
        extendedReqs.push(await createExpandedPr(pr));
    }
    return extendedReqs;
}

export type GroupFunc = (item: JsonPrItem) => Promise<string>;

export async function getRequestsPerGroup(expenses: JsonPrItem[], groupFunc: GroupFunc, groups: string[]) {
    let groupMap = new Map<string, JsonPrItem[]>();
    for (let group of groups) {
        groupMap.set(group, []);
    }
    for (let item of expenses) {
        let group = await groupFunc(item);
        if (!groupMap.has(group)) {
            groupMap.set(group, []);
        }
        groupMap.get(group)!.push(item); //! just created group in map if it was missing.
    }
    return groupMap;
}

export async function getRequestsPerBudget(infoBlock: InfoBlock) {
    let extendedReqs = await getExtendedRequests(infoBlock);

    let legerPrMap = new Map<string, ExpandedPrItem[]>();
    for (const ledger of ledgerToBudgetCodes) {
        legerPrMap.set(ledger.ledger10, []);
    }
    for (const extendedPr of extendedReqs) {
        for(let item of extendedPr.items) {
            if(!item.ledger) {
                continue; //todo: report this somehow.
            }
            if (!legerPrMap.has(item.ledger.code)) {
                legerPrMap.set(item.ledger.code, []);
            }
            legerPrMap.get(item.ledger.code)!.push(item); //! just created in map if it was missing.
        }
    }
    return legerPrMap;
}

export async function exportPrItemsToExcel(infoBlock: InfoBlock){
    let jsonPrData = await createJsonPrData(infoBlock);

    let headers = ["prId", "status", "itemNo", "bruto", "tarif", "project", "tags", "title", "budget"];
    let rows: string[][] = [];
    for (let item of jsonPrData.items) {
        let meta = await fetchMetaCached(item.prId);
        let row: string[] = [];
        row.push(item.prId);
        row.push(item.status);
        row.push(item.itemNo);
        row.push(item.bruto.toString());
        row.push(item.tarif);
        row.push(meta.project??"");
        row.push(meta.tags.join(","));
        row.push(item.title);
        row.push(item.budget);
        rows.push(row);
    }
    let table = createHtmlTable(headers, rows);
    sessionStorage.setItem("PrItemTable", table.outerHTML);
    await navigator.clipboard.writeText(table.outerHTML);
    console.log("CIOPIED.");
}

export interface JsonPrItem {
    prId: string;
    status: string;
    itemNo: string;
    bruto: number;
    tarif: string;
    title: string;
    budget: string;
    grant: string;
}

export interface JsonPrData {
    items: JsonPrItem[];
}

export async function createJsonPrData(infoBlock: InfoBlock) {
    let prs = await getExtendedRequests(infoBlock);
    let jsonPrData: JsonPrData = {
        items: []
    };
    for(let pr of prs) {
        for (const item of pr.items) {
            const index = pr.items.indexOf(item);
            let prId = pr.pr.reqId;
            let status = pr.pr.status;
            let itemNo = index.toString();
            let bruto = 0;
            if(item.tarif)
                bruto = calcBrutoLinePrice(item.item, item.tarif.tarif);
            else
                bruto = calcBrutoLinePrice(item.item, 0); //use netto pri;
            let tarif = item.tarif?.tarif ? item.tarif?.tarif.toString() : "";
            let meta = await fetchMetaCached(pr.pr.reqId);
            let project = meta.project??"";
            let tags = meta.tags.join(",");
            let title = pr.pr.title.value;
            let budget = item.budget?.budget??"";
            let grant = item.grant?.code??"";
            jsonPrData.items.push({
                prId,
                status,
                itemNo,
                bruto,
                tarif,
                title,
                budget,
                grant,
            });
        }
    }
    return jsonPrData;
}