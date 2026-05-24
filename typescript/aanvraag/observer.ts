import {PartialUrlObserver} from "../pageObserver";
import {getAndSetDecorated, gringo} from "../globals";
import {PurchaseRequisition, SapField, SapLineItem} from "../sap/SapPrInfo";
import {fetchPr} from "../sap/api";
import {cloud} from "../cloud";
import {BTW_TARIFS_FILENAME} from "../def";
import {emmet} from "../../libs/Emmeter/html";

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

async function updatePr(pr: ExpandedPr) {
    let newTotal = document.querySelector("div.newTotalBruto")!; //! should be present
    let total: number = 0;
    let currencySymbel = "€";
    let currency = "EUR";
    for(let item of pr.items) {
        if (!item.tarif) {
            total = 0;
            break;
        }
        if(item.item.price.value.currency != currency) {
            currency = item.item.price.value.currency+"?";
            currencySymbel = "?";
            total = 0;
            break;
        }
        total += item.bruto!;
    }

    newTotal.textContent = `${currencySymbel}${priceFormatter.format(total)}  ${currency}`;

    let nonDecoratedItems = [...document.querySelectorAll(`line-item-new:not([data-gringo-decorated="true"])`)] as HTMLElement[];
    for (let index = 0; index < nonDecoratedItems.length; index++) {
        let itemEl = nonDecoratedItems[index];
        await decoratePrItem(pr, itemEl, index);
    }
}

let priceFormatter = new Intl.NumberFormat("nl-BE", {maximumFractionDigits: 2, minimumFractionDigits: 2});

interface ExpandedPrItem {
    item: SapLineItem;
    tarif: Btw | null;
    bruto: number | null;
}

interface ExpandedPr {
    pr: PurchaseRequisition,
    items: ExpandedPrItem[];
}

function getPrItemCommodity(prItem: SapLineItem) {
    let commodityCodeField = prItem.advanced.fields?.find(f => f.id.endsWith("pAtHCommonCommodityCode")) as SapField<string>;
    if (!commodityCodeField)
        throw new Error("Gringo: Cannot find commodity code in PR.");
    let code = commodityCodeField.uniqueName;
    let dscr = commodityCodeField.value;
    if (!code)
        throw new Error("Gringo: Cannot find commodity code in PR.");
    return {code, dscr};
}

async function createExpandedPr(pr: PurchaseRequisition) {
    let items: ExpandedPrItem[] = [];
    for (let item of pr.lineItems) {
        let bruto: number | null = null;
        let tarif: Btw | null = null;
        let tarifs = await getBtwTarifsCachedInSession();
        let commodity = getPrItemCommodity(item);
        tarif = tarifs.get(commodity.code)??null;
        if(tarif) {
            let price = item.price.value;
            let quantity = item.quantity.value;
            bruto = price.amount * quantity * (100 + tarif.tarif);
            bruto = Math.round(bruto) / 100;
        }
        items.push({item, tarif, bruto});
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
    let meetEenheid = brutoRow.children[0] as HTMLElement;
    let brutoDiv = brutoRow.children[1] as HTMLElement;
    meetEenheid.style.display = "none";
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

function updatePrItem(pr: ExpandedPr, lineEl: HTMLElement, index: number) {
    let btwDif = lineEl.querySelector("div.newBruto div.btw") as HTMLDivElement;
    if (pr.items[index].tarif) {
        btwDif.textContent = pr.items[index].tarif.tarif + "%";
        let divBruto = lineEl.querySelector("div.newBruto div.bruto") as HTMLDivElement;
        let brutoStr = priceFormatter.format(pr.items[index].bruto!);
        let price = pr.items[index].item.price.value;
        divBruto.textContent = `${price.currencySymbol}${brutoStr}  ${price.currency}`;
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
        let button = btwDif.querySelector("button.btwSave") as HTMLButtonElement;
        let select = btwDif.querySelector('select') as HTMLSelectElement;
        button.onclick = async (ev) => {
            await btnCreateTarifClick(select, txtSelecteer, pr, index, lineEl);
        };
    }
}

async function btnCreateTarifClick(select: HTMLSelectElement, txtSelecteer: string, pr: ExpandedPr, index: number, lineEl: HTMLElement) {
    let selected = select.value;
    if (selected == txtSelecteer)
        return;
    let commodity = getPrItemCommodity(pr.items[index].item);
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

interface Btw {
    commodityCode: string;
    description: string;
    tarif: number;
}

interface BtwTarifs {
    tarifs: Btw[];
}

let globalBtwTarifs: Map<string, Btw> | null = null;

async function getBtwTarifsCachedInSession(): Promise<Map<string, Btw>> {
    if(globalBtwTarifs)
        return globalBtwTarifs;

    globalBtwTarifs = new Map<string, Btw>();
    let tarifs: BtwTarifs;
    try {
        tarifs = await cloud.json.fetch(BTW_TARIFS_FILENAME) as BtwTarifs;
    } catch {
        tarifs = {tarifs: []};
    }
    tarifs.tarifs.forEach(t => globalBtwTarifs!.set(t.commodityCode, t));
    return globalBtwTarifs;
}

async function uploadBtwTarifs(tarifsMap: Map<string, Btw>) {
    let tarifs: BtwTarifs = {tarifs: [...tarifsMap.values()]};
    await cloud.json.upload(BTW_TARIFS_FILENAME, tarifs);
    globalBtwTarifs = tarifsMap;
}