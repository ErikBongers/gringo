import {PartialUrlObserver} from "../pageObserver";
import {getAndSetDecorated, gringo} from "../globals";
import {PurchaseRequisition, SapField, SapLineItem} from "../sap/SapPrInfo";
import {fetchPr} from "../sap/api";
import {emmet} from "../../libs/Emmeter/html";
import {AccountingField, Btw, ExpandedPr, getBtwTarifsCachedInSession, getPrItemAsset, getPrItemCommodity, getPrItemLedger, uploadBtwTarifs} from "../aanvragen/requests";

class AanvraagObserver extends PartialUrlObserver {
    constructor() {
        super( "viewRequisition", onMutation, false, onPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return isPageProbablyLoaded();
    }
}

export default new AanvraagObserver();

function onPageRefreshed() {
    gringo("page Aanvraag refreshed.");
    decoratePage();
}

function isPageProbablyLoaded(): boolean {
    return true; //todo
}

function onMutation(mutation: MutationRecord) {
    decoratePage().then(() => {});
    return false;
}

let pr: PurchaseRequisition | null = null;

async function decoratePage() {
    let sectionMain = document.querySelector(`section[role="main"]`) as HTMLElement | null;
    if(!sectionMain)
        return;

    if(getAndSetDecorated(sectionMain))
        return;
    gringo("Decorating aanvraag page...");

    let prId = location.pathname.replace("/gb/viewRequisition/", "");
    pr = await fetchPr(prId);
    if(!pr)
        return;

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


    let expandedPr = await createExpandedPr(pr);
    await updatePr(expandedPr);
}

export function calcPrTotal(pr: ExpandedPr) {
    let total: number = 0;
    let currencySymbel = "€";
    let currency = "EUR";
    for (let item of pr.items) {
        if (!item.tarif) {
            total = 0;
            break;
        }
        if (item.item.price.value.currency != currency) {
            currency = item.item.price.value.currency + "?";
            currencySymbel = "?";
            total = 0;
            break;
        }
        total += calcBrutoLinePrice(item.item, item.tarif.tarif);
    }
    return {total, currencySymbel, currency};
}

async function updatePr(pr: ExpandedPr) {
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
}

export function calcBrutoLinePrice(item: SapLineItem, tarif: number) {
    let bruto: number | null = null;
    let price = item.price.value;
    let quantity = item.quantity.value;
    bruto = price.amount * quantity * (100 + tarif);
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
            let ledger = getPrItemLedger(item);
            if (!ledger)
                ledger = getPrItemAsset(item);
            tarif = tarifs.get(commodity?.code ?? '') ?? null;
            items.push({pr, item, tarif, ledger} satisfies ExpandedPrItem);
        }
    }
    return {pr, items} satisfies ExpandedPr;
}

async function decoratePrItem(pr: ExpandedPr, lineEl: HTMLElement, index: number) {
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
    updatePrItem(pr, lineEl, index);
}

function updatePrItemBrutoField(item: SapLineItem, tarif: number, lineEl: HTMLElement, index: number) {
    let divBruto = lineEl.querySelector("div.newBruto div.bruto") as HTMLDivElement;
    if (isNaN(tarif)) {
        divBruto.textContent = `€---,-- EUR`;
        return;
    }
    let bruto = calcBrutoLinePrice(item, tarif)
    let brutoStr = priceFormatter.format(bruto);
    let price = item.price.value;
    divBruto.textContent = `${price.currencySymbol}${brutoStr}  ${price.currency}`;
}

function updatePrItem(pr: ExpandedPr, lineEl: HTMLElement, index: number) {
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

function onBtwSelectChange(pr: ExpandedPr, index: number, lineEl: HTMLElement, tarif: number) {
    updatePrItemBrutoField(pr.items[index].item, tarif, lineEl, index);
}

async function btnCreateTarifClick(select: HTMLSelectElement, txtSelecteer: string, pr: ExpandedPr, index: number, lineEl: HTMLElement) {
    let selected = select.value;
    if (selected == txtSelecteer)
        return;
    let commodity = getPrItemCommodity(pr.items[index].item);
    if(!commodity) {
        alert("Er is geen 'Commodity-code' (zie sectie Overig) voor dit artikel.");
        return;
    }
    let tarifs = await getBtwTarifsCachedInSession();
    tarifs.set(commodity.code, {
        commodityCode: commodity.code,
        description: commodity.dscr,
        tarif: parseInt(selected)
    });
    await uploadBtwTarifs(tarifs);
    pr = await createExpandedPr(pr.pr);
    updatePrItem(pr, lineEl, index);
}

