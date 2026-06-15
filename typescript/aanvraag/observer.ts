import {PartialUrlObserver} from "../pageObserver";
import {getAndSetDecorated, gringo} from "../globals";
import {PurchaseRequisition, SapLineItem} from "../sap/SapPrInfo";
import {fetchPr, fetchReqContext, fetchShoppingCart} from "../sap/api";
import {emmet} from "../../libs/Emmeter/html";
import {AccountingField, Btw, ExpandedCompactPr, ExpandedPr, getBtwTarifsCachedInSession, getPrItemAsset, getPrItemCommodity, getPrItemGrant, getPrItemLedger, uploadBtwTarifs} from "../aanvragen/requests";
import {getBudgetCode} from "../aanvragen/aggregate";
import {LedgerToBudgetCode} from "../aanvragen/budgetCodes";
import {RequisitionItem} from "../sap/ShoppingCart";

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

async function decorateViewReqPage() {
    let sectionMain = document.querySelector(`section[role="main"]`) as HTMLElement | null;
    if(!sectionMain)
        return;

    if(getAndSetDecorated(sectionMain))
        return;
    gringo("Decorating view aanvraag page...");

    let pageName = location.pathname.includes("viewRequisition") ? "viewRequisition" : "requisition";
    let prId = location.pathname.replace(`/gb/${pageName}/`, "");
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

export function createCompactPr(pr: PurchaseRequisition) {
    return {
        prId: pr.reqId,
        items: pr.lineItems.map(item => {
            return createCompactReqItem(item);
        })
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

    let reqContext = await fetchReqContext();
    let prId = reqContext.requisitionId;

    let cart = await fetchShoppingCart();
    let compactPr: CompactRequisition;
    gringo("Cart length:");
    gringo(cart.length);
    if(cart.length == 0) { //we're opening an existing pr
        pr = await fetchPr(prId);
        if(!pr)
            return;
        compactPr = createCompactPr(pr);
    } else {
        compactPr = {
            prId,
            items: cart.map(item => {
                return createCompactReqItemFromCartItem(item);
            })
        };
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

async function updatePr(pr: ExpandedCompactPr) {
    let newTotal = document.querySelector("div.newTotalBruto")!; //! should be present
    let {total, currencySymbel, currency} = calcPrTotal(pr);

    newTotal.textContent = `${currencySymbel}${priceFormatter.format(total)}  ${currency}`;

    let nonDecoratedItems = [...document.querySelectorAll(`line-item-new:not([data-gringo-decorated="true"])`)] as HTMLElement[];
    for (let index = 0; index < nonDecoratedItems.length; index++) {
        let itemEl = nonDecoratedItems[index];
        await decoratePrItem(pr, itemEl, index);
    }
}

let priceFormatter = new Intl.NumberFormat("nl-BE", {maximumFractionDigits: 2, minimumFractionDigits: 2});

export interface ExpandedPrItem {
    pr: PurchaseRequisition;
    item: SapLineItem;
    tarif: Btw | null;
    ledger: AccountingField | null;
    budget: LedgerToBudgetCode | null;
    grant: AccountingField | null;
}

export interface ExpandedCompactPrItem {
    item: CompactReqItem;
    tarif: Btw | null;
}

export function calcBrutoLinePrice(item: CompactReqItem, tarif: number) {
    let bruto: number | null = null;
    let price = item.price;
    let quantity = item.quantity;
    bruto = price * quantity * (100 + tarif);
    bruto = Math.round(bruto) / 100;
    return bruto;
}

export interface CompactReqItem {
    commodityCode: string,
    price: number;
    quantity: number,
    currency: string,
    currencySymbol: string,
}
export interface CompactRequisition {
    prId: string,
    items: CompactReqItem[],
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
    let nettoRow = rows[0];
    let brutoRow = rows[1] as HTMLElement;
    let brutoRowChildren = [...brutoRow.children] as HTMLElement[];
    brutoRowChildren.forEach(c => c.style.display = "none");
    let brutoDiv = brutoRowChildren.pop() as HTMLDivElement;
    brutoDiv.style.display = "none";

    let newBrutoContainer = brutoRow.querySelector("div.newBruto") as HTMLDivElement | null;
    newBrutoContainer?.remove();
    emmet.appendChild(brutoRow, `
        div.gringo.newBruto.flexRow.w100.blueBlock>(
            (
                div.gringo.tarif.col-xs-8>(
                    label{BTW}+
                    div.btw{21%}
                )
            )+
            (
                div.gringo.col-xs-4.pull-end>(
                    label{Bruto bedrag}+
                    div.bruto{€---,-- EUR}
                )
            )
        )
    `);
    let fieldQuantity = lineEl.querySelector("div.field-quantity") as HTMLDivElement;
    fieldQuantity.classList.add("hidePlusMinButtons");

    updatePrItem(pr, lineEl, index);
}

function updatePrItemBrutoField(item: CompactReqItem, tarif: number, lineEl: HTMLElement, index: number) {
    let divBruto = lineEl.querySelector("div.newBruto div.bruto") as HTMLDivElement;
    if (isNaN(tarif)) {
        divBruto.textContent = `€---,-- EUR`;
        return;
    }
    let bruto = calcBrutoLinePrice(item, tarif)
    let brutoStr = priceFormatter.format(bruto);
    let price = item.price;
    divBruto.textContent = `${item.currencySymbol}${brutoStr}  ${item.currency}`;
}

function updatePrItem(pr: ExpandedCompactPr, lineEl: HTMLElement, index: number) {
    let btwDif = lineEl.querySelector("div.newBruto div.btw") as HTMLDivElement;
    if (pr.items[index].tarif) {
        btwDif.textContent = pr.items[index].tarif.tarif + "%";
        updatePrItemBrutoField(pr.items[index].item, pr.items[index].tarif.tarif, lineEl, index);
    } else {
        btwDif.textContent = "";
        let txtSelecteer = "--selecteer--";
        emmet.appendChild(btwDif, `
            (
                select>(
                    option[value="${txtSelecteer}"]{${txtSelecteer}}+
                    option[value="0"]{0%}+
                    option[value="6"]{6%}+
                    option[value="12"]{12%}+
                    option[value="21"]{21%}
                )
            )+
            button.btwSave.m1{Bewaar voor dit artikel}
        `);
        let select = btwDif.querySelector('select') as HTMLSelectElement;
        select.onchange = (ev) => { onBtwSelectChange(pr, index, lineEl, parseInt(select.value));}
        let button = btwDif.querySelector("button.btwSave") as HTMLButtonElement;
        button.onclick = async (ev) => {
            await btnCreateTarifClick(select, txtSelecteer, pr, index, lineEl);
        };
    }
}

function onBtwSelectChange(pr: ExpandedCompactPr, index: number, lineEl: HTMLElement, tarif: number) {
    updatePrItemBrutoField(pr.items[index].item, tarif, lineEl, index);
}

async function btnCreateTarifClick(select: HTMLSelectElement, txtSelecteer: string, pr: ExpandedCompactPr, index: number, lineEl: HTMLElement) {
    let selected = select.value;
    if (selected == txtSelecteer)
        return;
    let commodity = pr.items[index].item.commodityCode;
    if(commodity == "") {
        alert("Er is geen 'Commodity-code' (zie sectie Overig) voor dit artikel.");
        return;
    }
    let tarifs = await getBtwTarifsCachedInSession();
    tarifs.set(commodity, {
        commodityCode: commodity,
        description: "",
        tarif: parseInt(selected)
    });
    await uploadBtwTarifs(tarifs);
    pr = await createExpandedCompactPr(pr.pr);
    updatePrItem(pr, lineEl, index);
}

