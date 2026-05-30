import {FetchChain} from "../fetchChain";
import {UserInfo} from "../sap/SapUserInfo";
import {RequestListResponse} from "../sap/RequestListResponse";
import {fetchPr} from "../sap/api";
import {getOptions, gringo} from "../globals";
import {BTW_TARIFS_FILENAME, KEY_CLOUD_METAS_FOLDER, KEY_LAST_FETCHED_METAS} from "../def";
import {clearMetasLocal, getMetaLocal, saveMetaLocal} from "../db/gringoDb";
import {cloud} from "../cloud";
import {ExpandedPrItem} from "../aanvraag/observer";
import {PurchaseRequisition, SapField, SapLineItem} from "../sap/SapPrInfo";
import {emmet} from "../../libs/Emmeter/html";
import {RequestBasicInfo} from "./observer";
import {getGlobalSettingsCached} from "../plugin_options/options";

export async function fetchRequestList() {
    let chain = new FetchChain();
    await chain.fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false"); //todo: load once.
    let userInfo = chain.getJson() as UserInfo | null;
    if (!userInfo) {
        console.error("gringo: could not get userInfo.");
    }

    //todo: is browserrequestid needed? or can I use a custom one?
    let now = new Date();
    let nowStr = now.toISOString().replaceAll("T", " ").split(".")[0] + " GMT";
    await chain.post(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/getYourRequestsWithTabSupport?yourRequestsTab=requisition&yourRequestType=all&browserRequestId=newYourRequests1779060906435`,
        {
            "searchFilters": {
                "LastUpdatedFromDate": "2026-02-17 23:00:00 GMT",
                "LastUpdatedToDate": nowStr,
            },
            "requestTypeFilter": "all",
            "orderByField": "daterequested",
            "ascendingOrder": false
        }
    );
    let requestList: RequestListResponse = await chain.getJson();
    return requestList
}

export async function fetchFullRequest(prId: string) {
    let pr = await fetchPr(prId);
    if(pr.title == null)
        return null; //todo : report this error somehow.
    return pr;
}

export async function fetchRequestListAndDetails() {
    let requestList = await fetchRequestList();
    gringo(requestList);
    let promises = requestList.requestList.map(r => {
        let requestId = r.reqUniqueName;
        return fetchFullRequest(requestId)
    })

    let detailsList = await Promise.all(promises);
    return detailsList;
}

export interface PrMeta {
    prId: string,
    tags: string[],
    project?: string,
}

export interface ExpandedPr {
    pr: PurchaseRequisition,
    items: ExpandedPrItem[];
}

export async function fetchChangedMetas() {
    let changedMetas: ChangedFile<PrMeta>[];
    let zSince = localStorage.getItem(KEY_LAST_FETCHED_METAS);
    if (!zSince) {
        await clearMetasLocal(); //clear, since we have no idea if they are up-to-date.
        changedMetas = [];
    } else {
        changedMetas = await cloud.json.fetchSince(KEY_CLOUD_METAS_FOLDER, zSince);
    }
    let fetchedDate = new Date();
    fetchedDate = new Date(fetchedDate.getTime() - 5 * 60 * 1000);
    let zFetchedDate = fetchedDate.toISOString();
    localStorage.setItem(KEY_LAST_FETCHED_METAS, zFetchedDate);
    return changedMetas;
}

export interface ChangedFile<T> {
    name: string;
    data: T,
    changed: string
}

export async function fetchMetaCached(prId: string) {
    let localMeta = await getMetaLocal(prId);
    if (localMeta)
        return localMeta

    let meta: PrMeta = {prId, tags: []};
    try {
        meta = await cloud.json.fetch(KEY_CLOUD_METAS_FOLDER + prId);
    } catch {
        await cloud.json.upload(KEY_CLOUD_METAS_FOLDER + prId, meta);
    }
    await saveMetaLocal(meta);
    return meta;
}

export async function saveMeta(prId: string, meta: PrMeta, what: "localStorage" | "localStorage and cloud") {
    if (what == "localStorage and cloud")
        await cloud.json.upload(KEY_CLOUD_METAS_FOLDER + prId, meta);
    await saveMetaLocal(meta);
}

export interface Btw {
    commodityCode: string;
    description: string;
    tarif: number;
}

export async function getBtwTarifsCachedInSession(): Promise<Map<string, Btw>> {
    if (globalBtwTarifs)
        return globalBtwTarifs;

    globalBtwTarifs = new Map<string, Btw>();
    let tarifs: BtwTarifs;
    try {
        tarifs = await cloud.json.fetch(BTW_TARIFS_FILENAME) as BtwTarifs;
    } catch {
        tarifs = {tarifs: []};
    }
    tarifs.tarifs.forEach(t => globalBtwTarifs!.set(t.commodityCode, t));
    return globalBtwTarifs;
}

export async function uploadBtwTarifs(tarifsMap: Map<string, Btw>) {
    let tarifs: BtwTarifs = {tarifs: [...tarifsMap.values()]};
    await cloud.json.upload(BTW_TARIFS_FILENAME, tarifs);
    globalBtwTarifs = tarifsMap;
}

export interface BtwTarifs {
    tarifs: Btw[];
}

let globalBtwTarifs: Map<string, Btw> | null = null;

export interface AccountingField {
    code: string;
    dscr: string;
}

function getAccountingField(prItem: SapLineItem, idIncludes: string) {
    let field = prItem.accounting.fields?.find(f => f.id.endsWith(idIncludes)) as SapField<string>;
    if (!field)
        return null;
    let code = field.uniqueName;
    let dscr = field.value;
    if (!code)
        return null;
    return {code, dscr} satisfies AccountingField as AccountingField;
}

function getAdvancedField(prItem: SapLineItem, idIncludes: string) {
    let field = prItem.advanced.fields?.find(f => f.id.endsWith(idIncludes)) as SapField<string>;
    if (!field)
        return null;
    let code = field.uniqueName;
    let dscr = field.value;
    if (!code)
        return null;
    return {code, dscr} satisfies AccountingField as AccountingField;
}

export function getPrItemCommodity(prItem: SapLineItem) {
    return getAdvancedField(prItem, "pAtHCommonCommodityCode");
}

export function getPrItemLedger(prItem: SapLineItem) {
    return getAccountingField(prItem, "pAtHGeneralLedger");
}

export function getPrItemAsset(prItem: SapLineItem) {
    return getAccountingField(prItem, "pAtHAsset");
}

export interface TagDef {
    name: string,
    description: string,
    color: string,
    bkgColor: string,
    order: number
}

let globalTagsMap: Map<string, TagDef> | null = null;

export async function getGlobalTags() {
    let globalSettings = await getGlobalSettingsCached();
    if(!globalTagsMap)
        globalTagsMap = new Map<string, TagDef>(globalSettings.tagDefs.map(t => [t.name, t]));
    return globalTagsMap;
}

