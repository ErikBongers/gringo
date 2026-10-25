import {emmet} from "../../libs/Emmeter";
import {AribaLandingPage} from "../sap/LandingPage";
import {FetchChain} from "../utils/fetchChain";
import {getLocalCache} from "../db/idb/localDb";
import {getBaseUrlWithTenantAndUser, gringo} from "../globals";
import {BASE_URL, KEY_TILE_FAVORITE_FILTER, KEY_TILE_TEXT_FILTER} from "../def";
import {InfoBlock} from "../infoBlock/infoBlock";

export interface Tile {
    id: string;
    type: string;
    label: string;
    uniqueName: string;
    commodityCode?: string;
    leaf: boolean;
    favorite: boolean;
}

export interface TilePage extends Tile {
    type: "Page";
}

export interface TileGBSearch extends Tile {
    type: "GBSearch";
    keyWords: string;
}

export interface TileAdHocItem extends Tile {
    type: "AdHocItem";
    adhocFormId: string;
}

export function isTilePage(tile: Tile): tile is TilePage {
    return tile.type === "Page";
}

export function isTileGBSearch(tile: Tile): tile is TileGBSearch {
    return tile.type === "GBSearch";
}

export function isTileAdHocItem(tile: Tile): tile is TileAdHocItem {
    return tile.type === "AdHocItem";
}

export function createTilesTable(tiles: Tile[]) {
    let tilesTableContainer = document.querySelector("#tilesTableContainer") as HTMLDivElement;
    tilesTableContainer.innerHTML = "";
    let tBody = emmet.indent.appendChild(tilesTableContainer, `
        table#tilesTable
            thead
                th
            tbody
    `).last as HTMLDivElement;
    for (let tile of tiles) {
        let indent = " ".repeat(tile.id.length-3); //subtract "_01"
        if(tile.id.length >= 6)
            indent = " ".repeat(tile.id.length-6);
        let titleClass = tile.leaf ? "" : ".bold";
        let rowClass = "";
        if(tile.id.length == 3)
            rowClass += ".mainTile";
        let gotoButtonText = tile.leaf ? `button.goto.naked.midBlueText.squircle>i.fa.fa-arrow-right` : "span";
        let tr = emmet.indent.appendChild(tBody, `
            tr#tile${tile.id}${rowClass}[data-tile-unique-name="${tile.uniqueName}"]
                td
                    span.pre${titleClass}{${indent + tile.label}}
                    button.naked.star
                        i.far.fa-star
                    ${gotoButtonText}
        `).first as HTMLTableRowElement;
        let starButton = tr.querySelector("button.star") as HTMLButtonElement;
        starButton.addEventListener("click", async () => {
            await onTileFavoriteClick(tile, starButton);
        });
        setFavoriteButton(starButton, tile.favorite);
        if(tile.leaf) {
            let gotoButton = tr.querySelector("button.goto") as HTMLButtonElement;
            gotoButton.addEventListener("click", () => {
                onTileGotoClick(tile);
            });
        }
    }
}

function onTileGotoClick(tile: Tile | TileAdHocItem | TileGBSearch) {
    if (isTileAdHocItem(tile)) {
        let url = BASE_URL + `/reqform/${tile.adhocFormId}`;
        window.open(url, '_blank');
    } else if (isTileGBSearch(tile)) {
        let keyWordsObject = JSON.parse(tile.keyWords);
        let url = BASE_URL + `/search/search-result/explore/${keyWordsObject.keyword}`; //todo url escape
        window.open(url, '_blank');
    }
    //gewoon artikel: reqform: type = "AdHocItem", adhocFormId: ...b6b:
    //  > https://s1-eu.ariba.com/gb/reqform/35dac74f-c190-40d9-a6b6-4ff6e5bf7b6b?realm=744379882-C1
    //raamovereenkomst: "type": "GBSearch", "keyWords": "{\"keyword\":\"\\\"SO2022_1329V ,\\\"\"}",
    // > https://s1-eu.ariba.com/gb/search/search-result/explore/%22SO2022_1329V%20,%22?realm=744379882-C1
    //      > %22 = double quote
    // >> lists
}

export function setFavoriteButton(starButton: HTMLButtonElement, favorite: boolean) {
    starButton.classList.toggle("selected", favorite);
    let i = starButton.querySelector("i") as HTMLButtonElement;
    i.classList.toggle("fa", favorite);
    i.classList.toggle("far", !favorite);
}

async function onTileFavoriteClick(tile: Tile, starButton: HTMLButtonElement) {
    tile.favorite = !tile.favorite;

    let cache = await getLocalCache();
    await cache.Tiles.put(tile);
    setFavoriteButton(starButton, tile.favorite);
}

export async function getTiles(infoBlock: InfoBlock, refresh: boolean = false) {
    let localCache = await getLocalCache();
    let tileTree = await localCache.Tiles.getAll();
    if (!refresh) {
        if (tileTree.length > 0)
            return tileTree;
    }
    let favoriteNames = getFavoriteUniqueNames(tileTree);
    tileTree = await fetchTileTree(infoBlock);
    tileTree.splice(0, 1);
    await setAndSaveFavorites(tileTree, favoriteNames);
    await localCache.Tiles.clear();
    await localCache.Tiles.bulkPut(tileTree);
    return tileTree;
}

function getFavoriteUniqueNames(tileTree: Tile[]) {
    let favoriteUniqueNames: string[] = [];
    tileTree.forEach(tile => {
        if(tile.favorite) {
            favoriteUniqueNames.push(tile.uniqueName);
        }
    });
    return favoriteUniqueNames;
}

async function setAndSaveFavorites(tileTree: Tile[], uniqueNames: string[]) {
    let localCache = await getLocalCache();
    tileTree.forEach(tile => {
        tile.favorite = uniqueNames.includes(tile.uniqueName);
    });
    await localCache.Tiles.bulkPut(tileTree.filter(tile => tile.favorite));
}

async function fetchTileTree(infoBlock: InfoBlock) {
    infoBlock.infoBar.setInfoLine("Ophalen alle tegels...")
    infoBlock.progressBar.start(500);//estimate
    let baseUrl = await getBaseUrlWithTenantAndUser();
    let popularPageUrl = `${baseUrl}/resource/wellknown/PopularPage`;
    let chain = new FetchChain();
    await chain.fetch(popularPageUrl);
    infoBlock.progressBar.next();
    let rootPage: AribaLandingPage = chain.getJson() as AribaLandingPage;
    let flatList: Tile[] = [];
    await addResourcesToFlatList(flatList, rootPage, baseUrl, "", infoBlock);
    infoBlock.progressBar.hide();
    infoBlock.infoBar.setInfoLine("");
    return flatList;
}

async function addResourcesToFlatList(flatList: Tile[], tilePage: AribaLandingPage, baseUrl: string, parentId: string, infoBlock: InfoBlock) {
    for (let [index, resource] of tilePage.resources!.entries()) {
        if (resource.type == "GeneralCarousel")
            break; //skip the next sections.
        let leaf = resource.type != "Page";
        let indexStr = index.toString().padStart(2, '0');
        let tile: Tile = {id: parentId + "_" + indexStr, label: resource.title!, uniqueName: resource.uniqueName, leaf, type: resource.type, favorite: false};
        if(isTileAdHocItem(tile)) {
            tile.adhocFormId = resource.adhocFormId as string;
        }
        if (isTileGBSearch(tile)) {
            tile.keyWords = resource.keyWords as string;
        }
        if (resource.commodityCode)
            tile.commodityCode = resource.commodityCode as string;
        flatList.push(tile);
        if (resource.type == "Page") {
            let tilePageUrl = `${baseUrl}/resource/container/${resource.id}?pu=PU_AG+Stedelijk+Onderwijs&puHierarchyPath=PU_AG+Stedelijk+Onderwijs,All`;
            let tilePageChain = new FetchChain();
            await tilePageChain.fetch(tilePageUrl);
            infoBlock.progressBar.next();
            let tilePage: AribaLandingPage = tilePageChain.getJson() as AribaLandingPage;
            await addResourcesToFlatList(flatList, tilePage, baseUrl, tile.id, infoBlock);
        }
    }
}

export function filterTiles() {
    let text = localStorage.getItem(KEY_TILE_TEXT_FILTER)??"";
    let favorite = localStorage.getItem(KEY_TILE_FAVORITE_FILTER) == "true";
    let tileFilter: TileFilter = {
        text: text,
        favorite: favorite
    };
    let table = document.querySelector("#tilesTableContainer table") as HTMLTableElement;
    let rows = table.querySelectorAll("tr");
    let matchingIds: string[] = [];
    for (let row of rows) {
        row.classList.add("hide");
        if (rowFilter(row, tileFilter)) {
            matchingIds.push(row.id);
        }
    }
    let parentIds: string[] = [];
    for (let id of matchingIds) {
        let splits = id.split("_");
        while(splits.pop())
            parentIds.push(splits.join("_"));
    }

    for(let id of matchingIds.concat(parentIds)) {
        document.getElementById(id)?.classList.remove("hide");
    }
    for(let hiddenRow of table.querySelectorAll("tr.hide")) {
        hiddenRow.classList.toggle("hide", !matchingIds.some(id => hiddenRow.id.startsWith(id))); //todo: more efficient match? because cartesian product.
    }
}

interface TileFilter {
    text: string;
    favorite: boolean;
}

function rowFilter(tr: HTMLTableRowElement, tileFilter: TileFilter) {
    let textContent = tr.textContent;
    if (tileFilter.text && !textContent.toLowerCase().includes(tileFilter.text.toLowerCase()))
        return false;
    let favorite = tr.querySelector("button.selected")?.classList.contains("selected") ?? false;
    // noinspection RedundantIfStatementJS
    if (tileFilter.favorite && !favorite)
        return false;
    return true;
}