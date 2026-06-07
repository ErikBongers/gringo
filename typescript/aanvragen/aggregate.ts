import {calcBrutoLinePrice, createExpandedPr, ExpandedPrItem} from "../aanvraag/observer";
import {ExpandedPr, fetchMetaCached, fetchRequestListAndDetails} from "./requests";
import {createHtmlTable, InfoBlock} from "../globals";

export interface LedgerToBudgetCode {
    ledger10: string,
    budget: string,
}

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

export let budgetDscrs = [
    ["60320000", "Niet-maximumfactuur"],
    ["60320000", "Aankopen lln niet maximumfactuur voor doorverkoop"],
    ["60330000", "Doorverkoop: voeding en drank"],
    ["61000000", "Huur onroerende goederen"],
    ["61030000", "Onderhoud en herstel van onroerende goederen"],
    ["61200000", "Verzekeringen"],
    ["61300000", "Auteursrechten, bijdragen en lidgelden"],
    ["61310000", "Erelonen zonder inhouding BV"],
    ["61314000", "Wijkwerkcheques"],
    ["61410000", "Kosten ivm roerende goederen"],
    ["61411000", "Gereedschappen en materialen"],
    ["61450000", "Schoonmaak en WC-papier, handdoeken"],
    ["61460000", "Communicatiekosten"],
    ["61490000", "Klein kantoormateriaal"],
    ["61510000", "Evenementen"],
    ["61520001", "WS Vlaanderen Nascholingsgelden"],
    ["61530000", "Personeel- en leerlingenkosten allerlei"],
    ["61560000", "Veiligheid personeel en leerlingen"],
    ["61580000", "Dienstverplaatsingen"],
    ["61611000", "Kosten uitstappen niet doorgerekend"],
    ["61612000", "Didactische kosten"],
    ["61613000", "Projecten"],
    ["64300000", "Andere werkingskosten"],
    ["65700000", "Andere financiële kosten"],
    ["23020000", "Uitrusting en inrichting"],
    ["24020000", "Computers en ICT"],
    ["24000000", "Meubilair"],
    ["24200000", "Muziekinstrumenten"],

];

let ledgerToBudgetCodes: LedgerToBudgetCode[] = [
    { ledger10: "2110000000", budget: "21100000"},
    { ledger10: "2231000000", budget: "22310000"},
    { ledger10: "2300000000", budget: "23000000"},
    { ledger10: "2301000000", budget: "23010000"},
    { ledger10: "2302000000", budget: "23020000"},
    { ledger10: "2400000000", budget: "24000000"},
    { ledger10: "2402000000", budget: "24020000"},
    { ledger10: "2406000000", budget: "24060000"},
    { ledger10: "2410000000", budget: "24100000"},
    { ledger10: "2420000000", budget: "24200000"},
    { ledger10: "2510000000", budget: "25100000"},
    { ledger10: "6030000100", budget: "60310100"},
    { ledger10: "6030000150", budget: "60310150"},
    { ledger10: "6030000200", budget: "60320000"},
    { ledger10: "6030000300", budget: "60330000"},
    { ledger10: "6100000100", budget: "61000000"},
    { ledger10: "6103000900", budget: "61030000"},
    { ledger10: "6103000300", budget: "61030000"},
    { ledger10: "6103000400", budget: "61030004"},
    { ledger10: "6103000500", budget: "61030005"},
    { ledger10: "6103000600", budget: "61030006"},
    { ledger10: "6103000700", budget: "61030007"},
    { ledger10: "6103001000", budget: "61030009"},
    { ledger10: "6112000000", budget: "61120000"},
    { ledger10: "6120000300", budget: "61200000"},
    { ledger10: "6120000200", budget: "61200000"},
    { ledger10: "6120009000", budget: "61200000"},
    { ledger10: "6120000100", budget: "61200000"},
    { ledger10: "6130001000", budget: "61300000"},
    { ledger10: "6130000600", budget: "61310000"},
    { ledger10: "6130000400", budget: "61310000"},
    { ledger10: "6130009000", budget: "61310000"},
    { ledger10: "6130000100", budget: "61310000"},
    { ledger10: "6130000200", budget: "61310000"},
    { ledger10: "6130000800", budget: "61310000"},
    { ledger10: "6131000600", budget: "61310000"},
    { ledger10: "6130000500", budget: "61310000"},
    { ledger10: "6130000900", budget: "61310000"},
    { ledger10: "6130001400", budget: "61314000"},
    { ledger10: "6141000100", budget: "61410000"},
    { ledger10: "6141100300", budget: "61410000"},
    { ledger10: "6141100400", budget: "61410000"},
    { ledger10: "6144000200", budget: "61410000"},
    { ledger10: "6144000400", budget: "61410000"},
    { ledger10: "6147000100", budget: "61410000"},
    { ledger10: "6141100100", budget: "61411000"},
    { ledger10: "6142100200", budget: "61420002"},
    { ledger10: "6142100300", budget: "61420003"},
    { ledger10: "6142100400", budget: "61420004"},
    { ledger10: "6142000100", budget: "61420100"},
    { ledger10: "6142000200", budget: "61420200"},
    { ledger10: "6145000100", budget: "61450000"},
    { ledger10: "6145000200", budget: "61450000"},
    { ledger10: "6146000400", budget: "61460000"},
    { ledger10: "6146000700", budget: "61460000"},
    { ledger10: "6146000100", budget: "61460000"},
    { ledger10: "6146000500", budget: "61460000"},
    { ledger10: "6146000300", budget: "61460000"},
    { ledger10: "6146000200", budget: "61460000"},
    { ledger10: "6146000900", budget: "61490000"},
    { ledger10: "6151000400", budget: "61510000"},
    { ledger10: "6152000100", budget: "61520001"},
    { ledger10: "6152100100", budget: "61520001"},
    { ledger10: "6152000200", budget: "61520002"},
    { ledger10: "6152000300", budget: "61530000"},
    { ledger10: "6152000600", budget: "61560000"},
    { ledger10: "6152001200", budget: "61560000"},
    { ledger10: "6152001300", budget: "61560000"},
    { ledger10: "6152000800", budget: "61580000"},
    { ledger10: "6161000100", budget: "61611000"},
    { ledger10: "6161000200", budget: "61612000"},
    { ledger10: "6161000300", budget: "61613000"},
    { ledger10: "6170000000", budget: "61700000"},
    { ledger10: "6230000100", budget: "62300000"},
    { ledger10: "6400009000", budget: "64000000"},
    { ledger10: "6400000600", budget: "64000000"},
    { ledger10: "6400000400", budget: "64000000"},
    { ledger10: "6400000500", budget: "64000000"},
    { ledger10: "6430000700", budget: "64300000"},
    { ledger10: "6430000200", budget: "64300000"},
    { ledger10: "6430000800", budget: "64300000"},
    { ledger10: "4991000100", budget: "0"},
    { ledger10: "4160100100", budget: "0"},
    { ledger10: "4891000100", budget: "0"},
];

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

export type GroupFunc = (item: JsonPrItem) => string;

export function getRequestsPerGroup(expenses: JsonPrItem[], groupFunc: GroupFunc, groups: string[]) {
    let groupMap = new Map<string, JsonPrItem[]>();
    for (let group of groups) {
        groupMap.set(group, []);
    }
    for (let item of expenses) {
        let group = groupFunc(item);
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
        let row: string[] = [];
        row.push(item.prId);
        row.push(item.status);
        row.push(item.itemNo);
        row.push(item.bruto.toString());
        row.push(item.tarif);
        row.push(item.project);
        row.push(item.tags);
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
    project: string;
    tags: string;
    title: string;
    budget: string;
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
            jsonPrData.items.push({
                prId,
                status,
                itemNo,
                bruto,
                tarif,
                project,
                tags,
                title,
                budget
            });
        }
    }
    return jsonPrData;
}