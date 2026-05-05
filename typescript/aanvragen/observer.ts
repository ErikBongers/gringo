import {PartialUrlObserver} from "../pageObserver";

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
    gringo("ids: ", requests);
}

export type RequestBasicInfo = {
    id: string,
    orderAnchors: HTMLAnchorElement[],

}

function scrapeInfoItem(requestDiv: HTMLDivElement): RequestBasicInfo {
    let id = requestDiv.id.substring("request-".length);
    let divOrders = requestDiv.querySelector(".item-orders");
    let orderAnchors: HTMLAnchorElement[] = [];
    if(divOrders) {
         orderAnchors = [...divOrders.querySelectorAll(".request-po-list-container ul > li a") as NodeListOf<HTMLAnchorElement>];
    }
    return {id, orderAnchors};
}