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

function gringo(...args) {
    console.log("gringo", ...args);
}

function decorateAllPRs() {
    let requests = document.querySelectorAll("request-info-item");
    let ids = Array.from(requests).map(e => e.id);
    gringo("ids: ", ids);
}