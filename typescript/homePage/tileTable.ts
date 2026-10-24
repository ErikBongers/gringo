import {emmet} from "../../libs/Emmeter";
import {AribaLandingPage} from "../sap/LandingPage";
import {FetchChain} from "../utils/fetchChain";
import {getLocalCache} from "../db/idb/localDb";
import {getBaseUrlWithTenantAndUser} from "../globals";

export interface Tile {
    id: string;
    label: string;
    uniqueName: string;
    commodityCode?: string;
    leaf: boolean;
}

export function createTilesTable(tiles: Tile[]) {
    let tilesTableContainer = document.querySelector("#tilesTableContainer") as HTMLDivElement;
    let tBody = emmet.indent.appendChild(tilesTableContainer, `
        table#tilesTable
            tbody
    `).last as HTMLDivElement;
    for (let tile of tiles) {
        let indent = "   ".repeat(tile.id.length);
        let titleClass = tile.leaf ? "" : ".bold";
        emmet.indent.appendChild(tBody, `
            tr[datatile-id="${tile.id}" data-tile-unique-name="${tile.uniqueName}"]
                td
                    span.pre${titleClass}{${indent + tile.label}}
        `);
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
        let tile: Tile = {id: parentId + "." + index, label: resource.title!, uniqueName: resource.uniqueName, leaf};
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