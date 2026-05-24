import {PartialUrlObserver} from "../pageObserver";
import {getAndSetDecorated, gringo, StartsWithUppercase} from "../globals";
import {PurchaseRequisition} from "../sap/SapPrInfo";
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
    gringo(pr);

    for(let item of pr.lineItems) {
        let commodityCodeField = item.advanced.fields?.find(f => f.id.endsWith("pAtHCommonCommodityCode"));
        gringo(commodityCodeField);
        if(!commodityCodeField)
            continue;
        let commodityCode = commodityCodeField.uniqueName;
        gringo(commodityCode);
    }

    let nonDecoratedItems = [...document.querySelectorAll(`line-item-new:not([data-gringo-decorated="true"])`)];
    nonDecoratedItems.forEach(decoratePrItem);
    gringo(`Items to decorate: ${nonDecoratedItems.length}`);
}

function decoratePrItem(lineEl: HTMLElement) {
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

    emmet.appendChild(brutoRow, `
        div.flexRow.w100>(
            (
                div.gringo.tarif.col-xs-4>(
                    label{BTW}+
                    div.btw{21%}
                )
            )+
            (
                div.gringo.col-xs-4.pull-end>(
                    label{Bruto bedrag}+
                    div.bruto{€1.234,56 EUR}
                )
            )
        )
    `);
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
    let tarifs = await cloud.json.fetch(BTW_TARIFS_FILENAME) as BtwTarifs;
    tarifs.tarifs.forEach(t => globalBtwTarifs!.set(t.commodityCode, t));
    return globalBtwTarifs;
}

async function uploadBtwTarifs(tarifs: BtwTarifs) {
    await cloud.json.upload(BTW_TARIFS_FILENAME, tarifs);
}