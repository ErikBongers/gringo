import {FetchChain} from "../fetchChain";
import {UserInfo} from "../sap/SapUserInfo";
import {RequestListResponse} from "../sap/RequestListResponse";
import {fetchPr} from "../sap/api";
import {gringo} from "../globals";
import {KEY_CLOUD_METAS_FOLDER, KEY_LAST_FETCHED_METAS} from "../def";
import {clearMetasLocal, getMetaLocal, saveMetaLocal} from "../db/gringoDb";
import {cloud} from "../cloud";

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
    let prTitle = pr.title.value;
    let prStatus = pr.status;
    gringo(pr);
    for (let lineItem of pr.lineItems) {
        let accounting = lineItem.accounting;
        let rekening = "";
        if (accounting.fields) {
            for (let field of accounting.fields) {
                if (field.name == "GeneralLedger")
                    rekening = field.value as string;
            }
        }
        let price = lineItem.quantity.value;//note that we are using the quantity field to store the price!
        let orderId = lineItem.orderID ?? "-";
        gringo(`${pr.reqId}/${orderId} : ${prTitle} : ${prStatus} : [${rekening}] : ${price}`);
    }
    return pr;
}

export async function fetchRequestListAndDetails() {
    let requestList = await fetchRequestList();
    let promises = requestList.requestList.map(r => {
        let requestId = r.id!;
        debugger;
        return fetchFullRequest(requestId)
    })

    let detailsList = await Promise.all(promises);
    debugger;
    return detailsList;
}

export interface PrMeta {
    prId: string,
    tags: string[],
    project?: string,
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