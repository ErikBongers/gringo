import {PurchaseRequisition} from "../sap/SapPrInfo";
import {
    TarifDef,
    CompactRequisition,
    ExpandedCompactPr,
    ExpandedCompactPrItem,
    ExpandedPr,
    ExpandedPrItem,
    getPrItemAsset,
    getPrItemCommodity,
    getPrItemGrant,
    getPrItemLedger, CompactReqItem
} from "../aanvragen/requests";
import {LedgerToBudgetCode} from "../aanvragen/budgetCodes";
import {getBudgetCode} from "../aanvragen/aggregate";
import {sessionCache} from "../sessionCache";

export async function createExpandedPr(pr: PurchaseRequisition) {
    let items: ExpandedPrItem[] = [];
    if (pr.lineItems != null) {
        for (let item of pr.lineItems) {
            let tarif: TarifDef | null = null;
            let commodity = getPrItemCommodity(item);
            let grant = getPrItemGrant(item);
            let ledger = getPrItemLedger(item);
            if (!ledger)
                ledger = getPrItemAsset(item);
            let budget: LedgerToBudgetCode | null = null;
            if (ledger)
                budget = getBudgetCode(ledger.code);
            tarif = await sessionCache.getTarifDef(commodity?.code ?? '');
            items.push({
                pr,
                item,
                tarif,
                ledger,
                budget,
                grant,
                quantity: item.quantity.value,
                commodityCode: commodity?.code??"",
                price: item.price.value.amount
            } satisfies ExpandedPrItem);
        }
    }
    return {pr, items} satisfies ExpandedPr;
}

export async function createExpandedCompactPr(pr: CompactRequisition) {
    let items: ExpandedCompactPrItem[] = [];
    for (let item of pr.items) {
        items.push(await createExpandedCompactPrItem(item));
    }
    return {pr, items} satisfies ExpandedCompactPr as ExpandedCompactPr;
}

export async function createExpandedCompactPrItem(item: CompactReqItem): Promise<ExpandedCompactPrItem> {
    let tarif: TarifDef | null = null;
    tarif = await sessionCache.getTarifDef(item.commodityCode);
    return {
        item,
        tarif,
        quantity: item.quantity,
        commodityCode: item.commodityCode ?? "",
        price: item.price
    };
}