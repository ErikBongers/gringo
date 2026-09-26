import {PartialUrlObserver} from "../pageObserver";
import {canBeDecoratedAndSet, formatPrice, priceFormatter} from "../globals";
import {PurchaseRequisition, SapLineItem} from "../sap/SapPrInfo";
import {fetchPr, fetchReqContext, fetchShoppingCart} from "../sap/api";
import {emmet} from "../../libs/Emmeter";
import {
    calcPrTotal,
    CompactReqItem,
    CompactRequisition,
    ExpandedCompactPr,
    getPrItemCommodity
} from "../aanvragen/requests";
import {RequisitionItem} from "../sap/ShoppingCart";
import {triggerFieldChanged} from "../reqForm/observer";
import {Parser} from "../calculator/parser";
import {PriceBlock} from "./priceBlock";
import {createExpandedCompactPr} from "./expand";
import {PriceData} from "./priceData";

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
    decorateReqPage(getCompactPrFromReq);
}

function onViewReqPageRefreshed() {
    decorateReqPage(getCompactPrFromViewReq);
}

function isPageProbablyLoaded(): boolean {
    return true; //todo
}

function onMutation(mutation: MutationRecord) {
    decorateReqPage(getCompactPrFromReq).then(() => {});
    return false;
}

function onViewMutation(mutation: MutationRecord) {
    decorateReqPage(getCompactPrFromViewReq).then(() => {});
    return false;
}

let pr: PurchaseRequisition | null = null;

function getUrlPrId() {
    return location.pathname.split("/").pop()!;
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

async function getCompactPrFromViewReq(prId: string) {
    pr = await fetchPr(prId);
    if(!pr)
        return null;
    let compactPr: CompactRequisition = {
        prId: pr.reqId,
        items: pr.lineItems.map(item => {
            let commodityCode = getPrItemCommodity(item)?.code ?? "";
            return {
                commodityCode,
                price: item.price.value.amount,
                quantity: item.quantity.value,
                currency: item.price.value.currency,
                currencySymbol: item.price.value.currencySymbol
            };
        })
    };
    return compactPr;
}

async function getCompactPrFromReq(prId: string) {
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
            return null;
        compactPr = createCompactPr(pr);
    }
    return compactPr;
}

async function decorateReqPage(getCompactPr: (prId: string) => Promise<CompactRequisition | null>) {
    if(!canBeDecoratedAndSet(document.querySelector(`section[role="main"]`)))
        return;

    let prId = getUrlPrId();

    let compactPr = await getCompactPr(prId);
    if(!compactPr)
        return;

    let totalPriceDiv = document.querySelector("div.block-heading.total-price") as HTMLElement;
    totalPriceDiv.style.display = "none";
    emmet.indent.insertAfter(totalPriceDiv, `
        div.newTotal.gringo
            div.newTotal.block-heading.total-price{Totale kosten}
            div.blueBlock.flexRow.w100.mbe-1ch
                label{Bruto bedrag}
                div.newTotalBruto.pull-end{€---,--- EUR}
    `);


    let expandedPr = await createExpandedCompactPr(compactPr);
    await updatePrView(expandedPr);
}

function updateTotalBrutoView(pr: ExpandedCompactPr) {
    let newTotal = document.querySelector("div.newTotalBruto")!; //! should be present
    let {total, currencySymbel, currency} = calcPrTotal(pr);

    newTotal.textContent = formatPrice(total, currencySymbel, currency, true);
}

async function updatePrView(pr: ExpandedCompactPr) {
    updateTotalBrutoView(pr);

    let nonDecoratedItems = [...document.querySelectorAll(`line-item-new:not([data-gringo-decorated="true"])`)] as HTMLElement[];
    for (let index = 0; index < nonDecoratedItems.length; index++) {
        let itemEl = nonDecoratedItems[index];
        await decoratePrItem(pr, itemEl, index);
    }
}

async function decoratePrItem(pr: ExpandedCompactPr, lineEl: HTMLElement, index: number) {
    let rows = lineEl.querySelectorAll("div.price-section div.row") as NodeListOf<HTMLDivElement>;
    if(rows.length < 2)
        return;
    let brutoRow = rows[1] as HTMLElement;
    [...brutoRow.children as HTMLCollectionOf<HTMLElement>]
        .forEach(c => c.style.display = "none");

    brutoRow.querySelector("div.newBruto")?.remove();
    let calcFieldsContainer = emmet.appendChild(brutoRow, `
        div.gringo.newBruto.flexRow.w100.blueBlock
    `).first as HTMLDivElement;

    let priceBlock = new PriceBlock(null, calcFieldsContainer, pr, index);
    priceBlock.linkField(document.querySelector("div.newTotalBruto"), (ctx: PriceData)=> {
        updateTotalBrutoView(pr);
    });
    priceBlock.setTarif(pr.items[index].tarif?.tarif??null);

    let quantity = "";
    let fieldQuantityInput = lineEl.querySelector("div.field-quantity input") as HTMLInputElement | null;
    if(fieldQuantityInput) {
        priceBlock.linkField(fieldQuantityInput, (ctx: PriceData) => {
            if (!ctx.netto)
                return;
            fieldQuantityInput.value = formatPrice(ctx.netto, "", "").trim();
            triggerFieldChanged(fieldQuantityInput);
        });
        fieldQuantityInput.parentElement!.classList.add("hidePlusMinButtons");
        quantity = fieldQuantityInput.value;
    }
    else {
        let span = lineEl.querySelector("span[ng-if='item.quantity.value']");
        quantity = span!.textContent!;
    }
    let parser = new Parser(quantity);
    priceBlock.setNetto(parser.parse().result);
    priceBlock.setCurrentSource(fieldQuantityInput);
    priceBlock.updateOtherFields();
}
