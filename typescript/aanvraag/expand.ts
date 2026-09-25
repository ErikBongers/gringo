import {PurchaseRequisition} from "../sap/SapPrInfo";
import {
    Btw,
    CompactRequisition,
    ExpandedCompactPr,
    ExpandedCompactPrItem,
    ExpandedPr,
    ExpandedPrItem,
    getBtwTarifsCachedInSession,
    getPrItemAsset,
    getPrItemCommodity,
    getPrItemGrant,
    getPrItemLedger
} from "../aanvragen/requests";
import {LedgerToBudgetCode} from "../aanvragen/budgetCodes";
import {getBudgetCode} from "../aanvragen/aggregate";

export async function createExpandedPr(pr: PurchaseRequisition) {
    let items: ExpandedPrItem[] = [];
    if (pr.lineItems != null) {
        for (let item of pr.lineItems) {
            let tarif: Btw | null = null;
            let tarifs = await getBtwTarifsCachedInSession();
            let commodity = getPrItemCommodity(item);
            let grant = getPrItemGrant(item);
            let ledger = getPrItemLedger(item);
            if (!ledger)
                ledger = getPrItemAsset(item);
            let budget: LedgerToBudgetCode | null = null;
            if (ledger)
                budget = getBudgetCode(ledger.code);
            tarif = tarifs.get(commodity?.code ?? '') ?? null;
            items.push({pr, item, tarif, ledger, budget, grant} satisfies ExpandedPrItem);
        }
    }
    return {pr, items} satisfies ExpandedPr;
}

export async function createExpandedCompactPr(pr: CompactRequisition) {
    let items: ExpandedCompactPrItem[] = [];
    for (let item of pr.items) {
        let tarif: Btw | null = null;
        let tarifs = await getBtwTarifsCachedInSession();
        tarif = tarifs.get(item.commodityCode) ?? null;
        items.push({item, tarif} satisfies ExpandedCompactPrItem);
    }
    return {pr, items} satisfies ExpandedCompactPr as ExpandedCompactPr;
}