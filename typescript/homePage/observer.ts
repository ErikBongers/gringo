import {checkAndSetDecoration, PartialUrlObserver} from "../pageObserver";
import {gringo} from "../globals";
import {emmet} from "../../libs/Emmeter";
import {createTilesTable, getTiles} from "./tileTable";

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
    getTiles().then(async (tree) => {
        gringo(tree);
        let popularDiv = document.querySelector("#popular") as HTMLDivElement;
        emmet.indent.appendChild(popularDiv, `
            div#tilesTableContainer
        `);
        createTilesTable(tree);
    });
}

