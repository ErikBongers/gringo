import {PartialUrlObserver} from "../pageObserver";
import {formatPrice, getAndSetDecorated, gringo} from "../globals";
import {PurchaseRequisition, SapLineItem} from "../sap/SapPrInfo";
import {fetchPr, fetchReqContext, fetchShoppingCart} from "../sap/api";
import {emmet} from "../../libs/Emmeter/html";
import {
    Btw,
    CompactReqItem,
    CompactRequisition,
    ExpandedCompactPr,
    ExpandedCompactPrItem,
    ExpandedPr,
    ExpandedPrItem,
    getBtwTarifsCachedInSession,
    getPrItemAsset,
    getPrItemCommodity,
    getPrItemGrant,
    getPrItemLedger, uploadBtwTarifs
} from "../aanvragen/requests";
import {getBudgetCode} from "../aanvragen/aggregate";
import {LedgerToBudgetCode} from "../aanvragen/budgetCodes";
import {RequisitionItem} from "../sap/ShoppingCart";
import {addNettoAndBrutoFields, BrutoNettoCalcFields, PriceData, triggerFieldChanged} from "../reqForm/observer";
import {Parser} from "../calculator/parser";

class RequisitionObserver extends PartialUrlObserver {
    constructor() {
        super( "requisition", onMutation, false, onReqPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return isPageProbablyLoaded();
    }
}

class ViewReqObserver extends PartialUrlObserver {
    constructor() {
        super( "viewRequisition", onViewMutation, false, onViewReqPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return isPageProbablyLoaded();
    }
}

export default {viewReqObserver: new ViewReqObserver(), requisitionObserver: new RequisitionObserver()} as const;

function onReqPageRefreshed() {
    gringo("page Aanvraag refreshed.");
    decorateReqPage();
}

function onViewReqPageRefreshed() {
    gringo("page Aanvraag refreshed.");
    decorateViewReqPage();
}

function isPageProbablyLoaded(): boolean {
    return true; //todo
}

function onMutation(mutation: MutationRecord) {
    decorateReqPage().then(() => {});
    return false;
}

function onViewMutation(mutation: MutationRecord) {
    decorateViewReqPage().then(() => {});
    return false;
}

let pr: PurchaseRequisition | null = null;

function getUrlPrId() {
    return location.pathname.split("/").pop()!;
}

async function decorateViewReqPage() {
    let sectionMain = document.querySelector(`section[role="main"]`) as HTMLElement | null;
    if(!sectionMain)
        return;

    if(getAndSetDecorated(sectionMain))
        return;
    gringo("Decorating view aanvraag page...");

    let pageName = location.pathname.includes("viewRequisition") ? "viewRequisition" : "requisition";
    let prId = getUrlPrId();
    pr = await fetchPr(prId);
    if(!pr)
        return;

    let compactPr: CompactRequisition = { //todo: merge with code in decorateReqPage
        prId: pr.reqId,
        items: pr.lineItems.map(item => {
            let commodityCode = getPrItemCommodity(item)?.code??"";
            return {
                commodityCode,
                price: item.price.value.amount,
                quantity: item.quantity.value,
                currency: item.price.value.currency,
                currencySymbol: item.price.value.currencySymbol
            };
        })
    };

    let totalPriceDiv = document.querySelector("div.block-heading.total-price") as HTMLElement;
    totalPriceDiv.style.display = "none";
    emmet.insertAfter(totalPriceDiv, `
        div.newTotal.gringo>(
            div.newTotal.block-heading.total-price{Totale kosten}+
            div.blueBlock.flexRow.w100.mbe-1ch>(
                label{Bruto bedrag}+
                div.newTotalBruto.pull-end{€---,--- EUR}
            )
        )
    `);


    let expandedPr = await createExpandedCompactPr(compactPr);
    await updatePr(expandedPr);
}

export function createCompactReqItem(item: SapLineItem) {
    return {
        commodityCode: getPrItemCommodity(item)?.code ?? "",
        price: item.price.value.amount,
        quantity: item.quantity.value,
        currency: item.price.value.currency,
        currencySymbol: item.price.value.currencySymbol,
    };
}

export function createCompactPr(pr: PurchaseRequisition): CompactRequisition {
    let items:  CompactReqItem[] = [];
    if(pr.lineItems) { //e.g. "PR49386-V2": "Geannuleerd": all items have been removed.
        items = pr.lineItems.map(item => {
            return createCompactReqItem(item);
        });
    }
    return {
        prId: pr.reqId,
        items
    };
}

export function createCompactReqItemFromCartItem(item: RequisitionItem) {
    return {
        commodityCode: item.itemCommodityCode,
        price: item.unitPrice,
        quantity: item.quantity,
        currency: item.unitPriceMoney.currency,
        currencySymbol: item.unitPriceMoney.currencySymbol,
    };
}

async function decorateReqPage() {
    let sectionMain = document.querySelector(`section[role="main"]`) as HTMLElement | null;
    if(!sectionMain)
        return;

    if(getAndSetDecorated(sectionMain))
        return;
    gringo("Decorating aanvraag page...");

    let prId = getUrlPrId();
    let reqContext = await fetchReqContext();
    let contextPrId = reqContext.requisitionId;
    let cart = await fetchShoppingCart();
    let compactPr: CompactRequisition;
    if (prId == contextPrId && cart.length != 0) { //use shopping cart
        compactPr = {
            prId: contextPrId,
            items: cart.map(item => {
                return createCompactReqItemFromCartItem(item);
            })
        };
    } else {
        pr = await fetchPr(prId);
        if (!pr)
            return;
        compactPr = createCompactPr(pr);
    }

    let totalPriceDiv = document.querySelector("div.block-heading.total-price") as HTMLElement;
    totalPriceDiv.style.display = "none";
    emmet.insertAfter(totalPriceDiv, `
        div.newTotal.gringo>(
            div.newTotal.block-heading.total-price{Totale kosten}+
            div.blueBlock.flexRow.w100.mbe-1ch>(
                label{Bruto bedrag}+
                div.newTotalBruto.pull-end{€---,--- EUR}
            )
        )
    `);


    let expandedCompactPr = await createExpandedCompactPr(compactPr);
    await updatePr(expandedCompactPr);
}

export function calcPrTotal(pr: ExpandedCompactPr) {
    let total: number = 0;
    let currencySymbel = "€";
    let currency = "EUR";
    for (let item of pr.items) {
        if (!item.tarif) {
            total = 0;
            break;
        }
        total += calcBrutoLinePrice(item.item, item.tarif.tarif);
    }
    return {total, currencySymbel, currency};
}

function updateTotalBruto(pr: ExpandedCompactPr) {
    let newTotal = document.querySelector("div.newTotalBruto")!; //! should be present
    let {total, currencySymbel, currency} = calcPrTotal(pr);

    newTotal.textContent = `${currencySymbel}${priceFormatter.format(total)}  ${currency}`;
}

async function updatePr(pr: ExpandedCompactPr) {
    updateTotalBruto(pr);

    let nonDecoratedItems = [...document.querySelectorAll(`line-item-new:not([data-gringo-decorated="true"])`)] as HTMLElement[];
    for (let index = 0; index < nonDecoratedItems.length; index++) {
        let itemEl = nonDecoratedItems[index];
        await decoratePrItem(pr, itemEl, index);
    }
}

let priceFormatter = new Intl.NumberFormat("nl-BE", {maximumFractionDigits: 2, minimumFractionDigits: 2});

export function calcBrutoLinePrice(item: CompactReqItem, tarif: number) {
    let bruto: number | null = null;
    let price = item.price;
    let quantity = item.quantity;
    bruto = price * quantity * (100 + tarif);
    bruto = Math.round(bruto) / 100;
    return bruto;
}

export async function createExpandedPr(pr: PurchaseRequisition) {
    let items: ExpandedPrItem[] = [];
    if(pr.lineItems != null) {
        for (let item of pr.lineItems) {
            let tarif: Btw | null = null;
            let tarifs = await getBtwTarifsCachedInSession();
            let commodity = getPrItemCommodity(item);
            let grant = getPrItemGrant(item);
            let ledger = getPrItemLedger(item);
            if (!ledger)
                ledger = getPrItemAsset(item);
            let budget: LedgerToBudgetCode | null = null;
            if(ledger)
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

async function decoratePrItem(pr: ExpandedCompactPr, lineEl: HTMLElement, index: number) {
    let priceSection = lineEl.querySelector("div.price-section") as HTMLElement | null;
    if(!priceSection)
        return;
    let rows = priceSection.querySelectorAll("div.row");
    // nettoRow = rows[0]
    let brutoRow = rows[1] as HTMLElement;
    let brutoRowChildren = [...brutoRow.children] as HTMLElement[];
    brutoRowChildren.forEach(c => c.style.display = "none");
    let brutoDiv = brutoRowChildren.pop() as HTMLDivElement;
    brutoDiv.style.display = "none";

    let newBrutoContainer = brutoRow.querySelector("div.newBruto") as HTMLDivElement | null;
    newBrutoContainer?.remove();
    let calcFieldsContainer = emmet.appendChild(brutoRow, `
        div.gringo.newBruto.flexRow.w100.blueBlock
    `).first as HTMLDivElement;
    let calcFields = addNettoAndBrutoFields(45, calcFieldsContainer, pr, index);
    let fieldQuantity = lineEl.querySelector("div.field-quantity") as HTMLDivElement | null;
    let fieldQuantityInput: HTMLInputElement | null = null;
    if(fieldQuantity)
         fieldQuantityInput = fieldQuantity.querySelector("input") as HTMLInputElement | null;

    if(fieldQuantityInput) {
        calcFields.entangledFields.add(fieldQuantityInput, (ctx: PriceData) => {
            if (!ctx.netto)
                return;
            fieldQuantityInput.value = formatPrice(ctx.netto, "", "").trim();
            triggerFieldChanged(fieldQuantityInput);
        });
    }

    //add the general total field, so it gets automatically updated.
    let newTotalDiv = document.querySelector("div.newTotalBruto") as HTMLDivElement;
    calcFields.entangledFields.add(newTotalDiv, (ctx: PriceData)=> {
        updateTotalBruto(pr);
    });

    if(fieldQuantity)
        fieldQuantity.classList.add("hidePlusMinButtons");

    updatePrItem(pr, lineEl, index, calcFields); //todo: this sets btw tarif correctly. The name of the function is also ambiguous. What does it update?
    //initial fill of netto and bruto fields.
    let quantity = "";
    if(fieldQuantityInput)
        quantity = fieldQuantityInput.value;
    else {
        let span = lineEl.querySelector("span[ng-if='item.quantity.value']");
        quantity = span!.textContent!;
    }
    let parser = new Parser(quantity);
    calcFields.entangledFields.context.netto = parser.parse().result;
    if(fieldQuantityInput)
        calcFields.entangledFields.setCurrentSource(fieldQuantityInput);
    calcFields.entangledFields.updateOtherFields();
}

function updatePrItem(pr: ExpandedCompactPr, lineEl: HTMLElement, index: number, calcFields: BrutoNettoCalcFields) {
    if (pr.items[index].tarif) {
        calcFields.entangledFields.context.btw = pr.items[index].tarif.tarif;
    } else {
        calcFields.entangledFields.context.btw = 666;
    }
    calcFields.entangledFields.updateOtherFields();
}

function onBtwSelectChange(pr: ExpandedCompactPr, index: number, lineEl: HTMLElement, tarif: number) {
    //todo: update CalcFields ctx.btw
    console.log("onBtwSelectChange: todo: update CalcFields ctx.btw");
}

