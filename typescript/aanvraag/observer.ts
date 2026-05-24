import {PartialUrlObserver} from "../pageObserver";
import {getAndSetDecorated, gringo, StartsWithUppercase} from "../globals";
import {PurchaseRequisition} from "../sap/SapPrInfo";
import {fetchPr} from "../sap/api";

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
    return true;
}

let pr: PurchaseRequisition | null = null;

function takesCapitalized<T extends string>(
    value: StartsWithUppercase<T>
) {
    return value;
}

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
    }

    let nonDecoratedItems = [...document.querySelectorAll(`line-item-new:not([data-gringo-decorated="true"])`)];
    gringo(`Items to decorate: ${nonDecoratedItems.length}`);
}