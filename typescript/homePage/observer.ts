import {checkAndSetDecoration, PartialUrlObserver} from "../pageObserver";
import {gringo} from "../globals";

class HomePageObserver extends PartialUrlObserver {
    constructor() {
        super( "s1-eu.ariba.com/gb/?", onMutation, false, onPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return isPageProbablyLoaded();
    }
}

let homePageObserver=  new HomePageObserver();
export default homePageObserver;

function onPageRefreshed() {
    gringo("onPageRefreshed()");
    checkDecorations();
}

function isPageProbablyLoaded(): boolean {
    return true;
}

function onMutation() {
    checkDecorations();
    return false;
}

function checkDecorations() {
    checkAndSetDecoration(document.querySelector("body"), decorateBody);
}

function decorateBody() {
    gringo("homepage: decorateBody()");
}

