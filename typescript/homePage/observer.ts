import {checkAndSetDecoration, PartialUrlObserver} from "../pageObserver";
import {gringo} from "../globals";
import {emmet} from "../../libs/Emmeter";
import {createTilesTable, filterTiles, getTiles} from "./tileTable";
import {getInfoBlock} from "../infoBlock/infoBlock";
import {createSearchField} from "../utils/searchField";
import {KEY_TILE_TEXT_FILTER} from "../def";

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
    gringo("checking page loaded...");
    return document.querySelector("#popular") != null;
}

function onMutation() {
    checkDecorations();
    return false;
}

function checkDecorations() {
    checkAndSetDecoration(document.querySelector("#popular"), decorateBody);
}

function showTileTable(divContainer: HTMLDivElement, divOrgTiles: HTMLDivElement) {
    let showTilesTableSetting = localStorage.getItem("showTilesTable") == "true";
    let tilesTableWrapper = divContainer.querySelector("#tilesTableWrapper") as HTMLDivElement;
    tilesTableWrapper.classList.toggle("hide", !showTilesTableSetting);
    divOrgTiles.classList.toggle("hide", !tilesTableWrapper.classList.contains("hide"));
    let button = divContainer.querySelector("button") as HTMLButtonElement;
    button.innerText = showTilesTableSetting ? "Toon tegels" : "Toon volledige boomstructuur";
}

function decorateBody() {
    gringo("homepage: decorateBody()");
    let popularDiv = document.querySelector("#popular") as HTMLDivElement;
    let prodListDiv = popularDiv.querySelector(".product-list") as HTMLDivElement;
    let divOrgTiles = prodListDiv.closest(".row") as HTMLDivElement;
    let divContainer = emmet.indent.insertBefore(divOrgTiles, `
        div.gringo
            div.flexRow.center
                button.naked.blueBlock
            div#tileInfoBlock
            div#tilesTableWrapper.hide
                div#tileFilterBlock.flexRow
                div#tilesTableContainer
    `).first as HTMLDivElement;
    let button = divContainer.querySelector("button") as HTMLButtonElement;
    button.addEventListener("click", (ev) => {
        let showTilesTableSetting = localStorage.getItem("showTilesTable") == "true";
        showTilesTableSetting = !showTilesTableSetting;
        localStorage.setItem("showTilesTable", showTilesTableSetting.toString());
        showTileTable(divContainer, divOrgTiles);
        ev.stopPropagation();
        ev.preventDefault();
        ev.stopImmediatePropagation();
    });
    showTileTable(divContainer, divOrgTiles);
    let infoBlock = getInfoBlock(divContainer.querySelector("#tileInfoBlock") as HTMLDivElement);
    let filterBlock = divContainer.querySelector("#tileFilterBlock") as HTMLDivElement;
    let tileTextFilter = localStorage.getItem(KEY_TILE_TEXT_FILTER)??"";
    let textField = createSearchField("tileTextSearch", filterTiles, tileTextFilter);
    filterBlock.appendChild(textField);
    getTiles(infoBlock).then(async (tree) => {
        gringo(tree);
        createTilesTable(tree);
        filterTiles(tileTextFilter);
    });
}

