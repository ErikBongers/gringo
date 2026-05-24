import {PartialUrlObserver} from "../pageObserver";
import {getAndSetDecorated, gringo} from "../globals";
import {PurchaseRequisition, SapField} from "../sap/SapPrInfo";
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
    gringo("Decorating aanvraag page...");

    let sectionMain = document.querySelector(`section[role="main"]`) as HTMLElement | null;
    if(!sectionMain)
        return;

    if(getAndSetDecorated(sectionMain))
        return;
    let prId = location.pathname.replace("/gb/viewRequisition/", "");
    gringo(prId);
    pr = await fetchPr(prId);
    if(!pr)
        return;
    gringo(pr);

    let nonDecoratedItems = [...document.querySelectorAll(`line-item-new:not([data-gringo-decorated="true"])`)] as HTMLElement[];
    for (let index = 0; index < nonDecoratedItems.length; index++) {
        let item = nonDecoratedItems[index];
        await decoratePrItem(pr, item, index);
    }
    gringo(`Items to decorate: ${nonDecoratedItems.length}`);
}

let priceFormatter = new Intl.NumberFormat("nl-BE", {maximumFractionDigits: 2, minimumFractionDigits: 2});

async function decoratePrItem(pr: PurchaseRequisition, lineEl: HTMLElement, index: number) {
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

    let newBruto = brutoRow.querySelector("div.newBruto") as HTMLDivElement | null;
    newBruto?.remove();
    emmet.appendChild(brutoRow, `
        div.newBruto.flexRow.w100>(
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

    let btwDif = brutoRow.querySelector("div.btw") as HTMLDivElement;
    let tarifs = await getBtwTarifsCachedInSession();
    let commodityCodeField = pr.lineItems[index].advanced.fields?.find(f => f.id.endsWith("pAtHCommonCommodityCode")) as SapField<string>;
    gringo(commodityCodeField);
    if(!commodityCodeField)
        return;
    let commodityCode = commodityCodeField.uniqueName;
    if (!commodityCode)
        return;
    let commodityDscr = commodityCodeField.value;

    let tarif = tarifs.get(commodityCode);
    if(tarif) {
        btwDif.textContent = tarif.tarif + "%";
        let divBruto = brutoRow.querySelector("div.bruto") as HTMLDivElement;
        let price = pr.lineItems[index].price.value;
        let quantity =  pr.lineItems[index].quantity.value;
        let theNumber = price.amount*quantity*(100+tarif.tarif);
        theNumber = Math.round(theNumber)/100;
        let theNumberStr = priceFormatter.format(theNumber);
        divBruto.textContent = `${price.currencySymbol}${theNumberStr}  ${price.currency}`;
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
            let selected = select.value;
            if(selected == txtSelecteer)
                return;
            tarifs.set(commodityCode, {
                commodityCode,
                tarif: parseInt(selected),
                description: commodityDscr
            });
            await uploadBtwTarifs(tarifs);
            await decoratePrItem(pr, lineEl, index);
        };
    }
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