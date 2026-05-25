import {calcBrutoLinePrice, createExpandedPr, ExpandedPrItem} from "../aanvraag/observer";
import {getGlobalSettingsCached} from "../plugin_options/options";
import {ExpandedPr, fetchMetaCached, fetchRequestListAndDetails, PrMeta} from "./requests";
import {createHtmlTable} from "../globals";

export interface LedgerToBudgetCode {
    ledger: string,
    budget: string,
}

let _budgetMap: Map<string, LedgerToBudgetCode> | null = null;
export function getBudgetCode(ledger: string) {
    if(!_budgetMap) {
        _budgetMap = new Map<string, LedgerToBudgetCode>();
        ledgerToBudgetCodes.forEach(budget => {
            _budgetMap!.set(budget.ledger, budget); //! just created map.
        })
    }

    return _budgetMap.get(ledger)??null;
}

let ledgerToBudgetCodes: LedgerToBudgetCode[] = [
    { ledger: "2110000000", budget: "21100000"},
    { ledger: "2231000000", budget: "22310000"},
    { ledger: "2300000000", budget: "23000000"},
    { ledger: "2301000000", budget: "23010000"},
    { ledger: "2302000000", budget: "23020000"},
    { ledger: "2400000000", budget: "24000000"},
    { ledger: "2402000000", budget: "24020000"},
    { ledger: "2406000000", budget: "24060000"},
    { ledger: "2410000000", budget: "24100000"},
    { ledger: "2420000000", budget: "24200000"},
    { ledger: "2510000000", budget: "25100000"},
    { ledger: "6030000100", budget: "60310100"},
    { ledger: "6030000150", budget: "60310150"},
    { ledger: "6030000200", budget: "60320000"},
    { ledger: "6030000300", budget: "60330000"},
    { ledger: "6100000100", budget: "61000000"},
    { ledger: "6103000900", budget: "61030000"},
    { ledger: "6103000300", budget: "61030000"},
    { ledger: "6103000400", budget: "61030004"},
    { ledger: "6103000500", budget: "61030005"},
    { ledger: "6103000600", budget: "61030006"},
    { ledger: "6103000700", budget: "61030007"},
    { ledger: "6103001000", budget: "61030009"},
    { ledger: "6112000000", budget: "61120000"},
    { ledger: "6120000300", budget: "61200000"},
    { ledger: "6120000200", budget: "61200000"},
    { ledger: "6120009000", budget: "61200000"},
    { ledger: "6120000100", budget: "61200000"},
    { ledger: "6130001000", budget: "61300000"},
    { ledger: "6130000600", budget: "61310000"},
    { ledger: "6130000400", budget: "61310000"},
    { ledger: "6130009000", budget: "61310000"},
    { ledger: "6130000100", budget: "61310000"},
    { ledger: "6130000200", budget: "61310000"},
    { ledger: "6130000800", budget: "61310000"},
    { ledger: "6131000600", budget: "61310000"},
    { ledger: "6130000500", budget: "61310000"},
    { ledger: "6130000900", budget: "61310000"},
    { ledger: "6130001400", budget: "61314000"},
    { ledger: "6141000100", budget: "61410000"},
    { ledger: "6141100300", budget: "61410000"},
    { ledger: "6141100400", budget: "61410000"},
    { ledger: "6144000200", budget: "61410000"},
    { ledger: "6144000400", budget: "61410000"},
    { ledger: "6147000100", budget: "61410000"},
    { ledger: "6141100100", budget: "61411000"},
    { ledger: "6142100200", budget: "61420002"},
    { ledger: "6142100300", budget: "61420003"},
    { ledger: "6142100400", budget: "61420004"},
    { ledger: "6142000100", budget: "61420100"},
    { ledger: "6142000200", budget: "61420200"},
    { ledger: "6145000100", budget: "61450000"},
    { ledger: "6145000200", budget: "61450000"},
    { ledger: "6146000400", budget: "61460000"},
    { ledger: "6146000700", budget: "61460000"},
    { ledger: "6146000100", budget: "61460000"},
    { ledger: "6146000500", budget: "61460000"},
    { ledger: "6146000300", budget: "61460000"},
    { ledger: "6146000200", budget: "61460000"},
    { ledger: "6146000900", budget: "61490000"},
    { ledger: "6151000400", budget: "61510000"},
    { ledger: "6152000100", budget: "61520001"},
    { ledger: "6152100100", budget: "61520001"},
    { ledger: "6152000200", budget: "61520002"},
    { ledger: "6152000300", budget: "61530000"},
    { ledger: "6152000600", budget: "61560000"},
    { ledger: "6152001200", budget: "61560000"},
    { ledger: "6152001300", budget: "61560000"},
    { ledger: "6152000800", budget: "61580000"},
    { ledger: "6161000100", budget: "61611000"},
    { ledger: "6161000200", budget: "61612000"},
    { ledger: "6161000300", budget: "61613000"},
    { ledger: "6170000000", budget: "61700000"},
    { ledger: "6230000100", budget: "62300000"},
    { ledger: "6400009000", budget: "64000000"},
    { ledger: "6400000600", budget: "64000000"},
    { ledger: "6400000400", budget: "64000000"},
    { ledger: "6400000500", budget: "64000000"},
    { ledger: "6430000700", budget: "64300000"},
    { ledger: "6430000200", budget: "64300000"},
    { ledger: "6430000800", budget: "64300000"},
    { ledger: "4991000100", budget: "0"},
    { ledger: "4160100100", budget: "0"},
    { ledger: "4891000100", budget: "0"},
];

async function getExtendedRequests() {
    let reqs = (await fetchRequestListAndDetails())
        .filter(pr => pr != null)
        .filter(pr => pr.status != "sdfsdf");

    let extendedReqs: ExpandedPr[] = [];
    for (const pr of reqs) {
        extendedReqs.push(await createExpandedPr(pr));
    }
    return extendedReqs;
}

export async function getRequestsPerProject() {
    let extendedReqs = await getExtendedRequests();
    let projects = (await getGlobalSettingsCached()).projects;
    let projectMap = new Map<string, ExpandedPr[]>();
    for (const project of projects) {
        projectMap.set(project, []);
    }
    for (const extendedPr of extendedReqs) {
        let meta: PrMeta = await fetchMetaCached(extendedPr.pr.reqId);
        if (meta.project) {
            if (!projectMap.has(meta.project)) {
                projectMap.set(meta.project, []);
            }
            projectMap.get(meta.project)!.push(extendedPr); //! just created in map if it was missing.
        }
    }
    return projectMap;
}

export async function getRequestsPerBudget() {
    let extendedReqs = await getExtendedRequests();

    let budgetMap = new Map<string, LedgerToBudgetCode>();
    for(let ledger of ledgerToBudgetCodes) {
        budgetMap.set(ledger.ledger, ledger);
    }

    let legerPrMap = new Map<string, ExpandedPrItem[]>();
    for (const ledger of ledgerToBudgetCodes) {
        legerPrMap.set(ledger.ledger, []);
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

export async function exportPrItemsToExcel(){
    let prs = await getExtendedRequests();

    let headers = ["prId", "itemNo", "bruto", "tarif", "project", "tags", "title", "budget"];
    let rows: string[][] = [];
    for(let pr of prs) {
        for (const item of pr.items) {
            const index = pr.items.indexOf(item);
            let row: string[] = [];
            row.push(pr.pr.reqId);
            row.push(index.toString());
            if(item.tarif)
                row.push(calcBrutoLinePrice(item.item, item.tarif.tarif).toString());
            else
                row.push(calcBrutoLinePrice(item.item, 0).toString()); //use netto price
            row.push(item.tarif?.tarif ? item.tarif?.tarif.toString() : "?");
            let meta = await fetchMetaCached(pr.pr.reqId);
            row.push(meta.project??"")
            row.push(meta.tags.join(","));
            row.push(pr.pr.title.value);
            row.push(item.budget?.budget??"");
            rows.push(row);
        }
    }
    let table = createHtmlTable(headers, rows);
    sessionStorage.setItem("PrItemTable", table.outerHTML);
    await navigator.clipboard.writeText(table.outerHTML);
    console.log("CIOPIED.");
}