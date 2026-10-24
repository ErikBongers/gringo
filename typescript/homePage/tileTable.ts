import {emmet} from "../../libs/Emmeter";
import {AribaLandingPage} from "../sap/LandingPage";
import {FetchChain} from "../utils/fetchChain";
import {getLocalCache} from "../db/idb/localDb";
import {getBaseUrlWithTenantAndUser} from "../globals";
import {BASE_URL} from "../def";

export interface Tile {
    id: string;
    type: string;
    label: string;
    uniqueName: string;
    commodityCode?: string;
    leaf: boolean;
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
    let tBody = emmet.indent.appendChild(tilesTableContainer, `
        table#tilesTable
            thead
                th{Tiles}
            tbody
    `).last as HTMLDivElement;
    for (let tile of tiles) {
        let indent = "   ".repeat(tile.id.length);
        let titleClass = tile.leaf ? "" : ".bold";
        let buttonText = tile.leaf ? `button.naked.midBlueText.squircle>i.fa.fa-arrow-right` : "span";
        let tr = emmet.indent.appendChild(tBody, `
            tr[datatile-id="${tile.id}" data-tile-unique-name="${tile.uniqueName}"]
                td
                    span.pre${titleClass}{${indent + tile.label}}
                    ${buttonText}
        `).first as HTMLTableRowElement;
        if(tile.leaf) {
            let button = tr.querySelector("button") as HTMLButtonElement;
            button.addEventListener("click", () => {
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
            });
        }
    }
}

export async function getTiles(refresh: boolean = false) {
    let localCache = await getLocalCache();
    if (!refresh) {
        let tileTree = await localCache.Tiles.getAll();
        if (tileTree.length > 0)
            return tileTree;
    }
    let tileTree = await fetchTileTree();
    tileTree.splice(0, 1);
    await localCache.Tiles.clear();
    await localCache.Tiles.bulkPut(tileTree);
    return tileTree;
}

async function fetchTileTree() {
    let baseUrl = await getBaseUrlWithTenantAndUser();
    let popularPageUrl = `${baseUrl}/resource/wellknown/PopularPage`;
    let chain = new FetchChain();
    await chain.fetch(popularPageUrl);
    let rootPage: AribaLandingPage = chain.getJson() as AribaLandingPage;
    let flatList: Tile[] = [];
    await addResourcesToFlatList(flatList, rootPage, baseUrl, "");
    return flatList;
}

async function addResourcesToFlatList(flatList: Tile[], tilePage: AribaLandingPage, baseUrl: string, parentId: string) {
    for (let [index, resource] of tilePage.resources!.entries()) {
        if (resource.type == "GeneralCarousel")
            break; //skip the next sections.
        let leaf = resource.type != "Page";
        let indexStr = index.toString().padStart(2, '0');
        let tile: Tile = {id: parentId + "." + indexStr, label: resource.title!, uniqueName: resource.uniqueName, leaf, type: resource.type};
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
            let tilePage: AribaLandingPage = tilePageChain.getJson() as AribaLandingPage;
            await addResourcesToFlatList(flatList, tilePage, baseUrl, tile.id);
        }
    }
}