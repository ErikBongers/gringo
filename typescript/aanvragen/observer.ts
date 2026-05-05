import {PartialUrlObserver} from "../pageObserver";
import {emmet} from "../../libs/Emmeter/html";

class AanvragenObserver extends PartialUrlObserver {
    constructor() {
        super( "request-info-list/requisition", onMutation, false, onPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return true;
    }
}

export default new AanvragenObserver();

function onPageRefreshed() {
    gringo("page Aanvragen refreshed xxx.");
    decorateAllPRs();
}

function onMutation(mutation: MutationRecord) {
    if(document.querySelector("fd-pagination")) {
        decorateAllPRs();
        return true;
    }
    return false;
}

function gringo(...args: any[]) {
    console.log("gringo", ...args);
}

function decorateAllPRs() {
    let requestsDivs = document.querySelectorAll("request-info-item");
    let requests  = [...requestsDivs].map(scrapeInfoItem);
    requests.forEach(decoratePr);

}

export type RequestBasicInfo = {
    id: string,
    div: HTMLDivElement,
    orderAnchors: HTMLAnchorElement[],

}

function scrapeInfoItem(requestDiv: HTMLDivElement): RequestBasicInfo {
    let id = requestDiv.id.substring("request-".length);
    let divOrders = requestDiv.querySelector(".item-orders");
    let orderAnchors: HTMLAnchorElement[] = [];
    if(divOrders) {
         orderAnchors = [...divOrders.querySelectorAll(".request-po-list-container ul > li a") as NodeListOf<HTMLAnchorElement>];
    }
    return {id, div: requestDiv, orderAnchors};
}

function decoratePr(request: RequestBasicInfo) {
    if(request.div.dataset.gringo == "decorated")
        return;
    request.div.dataset.gringo = "decorated";
    request.orderAnchors.forEach(a => {
        let button = emmet.insertAfter(a, `
            button.copyAnchorText.naked
                >li.far.fa-copy 
            `).first as HTMLButtonElement;
        button.onmousedown = async (ev) => {
            await navigator.clipboard.writeText(a.innerText);
            ev.stopPropagation();
            ev.preventDefault();
        };
        button.onmouseup = (ev) => {ev.stopPropagation(); ev.preventDefault();};
        button.onclick = (ev) => {ev.stopPropagation(); ev.preventDefault();};
    });
}
