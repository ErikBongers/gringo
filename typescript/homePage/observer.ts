import {checkAndSetDecoration, PartialUrlObserver} from "../pageObserver";
import {getBaseUrlWithTenantAndUser, gringo} from "../globals";
import {FetchChain} from "../utils/fetchChain";
import {AribaLandingPage, AribaLandingPageResource} from "../sap/LandingPage";
import {cloud} from "../cloud";
import {KEY_CLOUD_GRINGO_FOLDER, KEY_CLOUD_TILE_TREE_FILENAME} from "../def";

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
    fetchTileTree(true).then((tree) => {
        gringo(tree);
    });
}

export interface Tile {
    id: string;
    label: string;
    uniqueName: string;
    commodityCode?: string;
}

async function fetchTileTree(refresh: boolean) {
    if(!refresh) {
        let tileTree = await cloud.json.fetch(KEY_CLOUD_TILE_TREE_FILENAME) as Tile[];
        if(tileTree)
            return tileTree;
    }

    let baseUrl = await getBaseUrlWithTenantAndUser();
    let popularPageUrl = `${baseUrl}/resource/wellknown/PopularPage`;
    let chain = new FetchChain();
    await chain.fetch(popularPageUrl);
    let rootPage: AribaLandingPage = chain.getJson() as AribaLandingPage;
    let flatList: Tile[] = [];
    flatList.push({id: "", label: rootPage.title!, uniqueName: rootPage.uniqueName});
    await addResourcesToFlatList(flatList, rootPage, baseUrl, "");
    await cloud.json.upload(KEY_CLOUD_TILE_TREE_FILENAME, flatList);
    return flatList;
}

async function addResourcesToFlatList(flatList: Tile[], tilePage: AribaLandingPage, baseUrl: string, parentId: string) {
    for(let [index, resource] of tilePage.resources!.entries()) {
        if(resource.type == "GeneralCarousel")
            break; //skip the next sections.
        let tile: Tile = {id: parentId+"."+index, label: resource.title!, uniqueName: resource.uniqueName};
        if(resource.commodityCode)
            tile.commodityCode = resource.commodityCode as string;
        flatList.push(tile);
        if(resource.type == "Page") {
            let tilePageUrl = `${baseUrl}/resource/container/${resource.id}?pu=PU_AG+Stedelijk+Onderwijs&puHierarchyPath=PU_AG+Stedelijk+Onderwijs,All`;
            let tilePageChain = new FetchChain();
            await tilePageChain.fetch(tilePageUrl);
            let tilePage: AribaLandingPage = tilePageChain.getJson() as AribaLandingPage;
            await addResourcesToFlatList(flatList, tilePage, baseUrl, tile.id);
        }
    }
}
