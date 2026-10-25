import {FetchChain} from "../utils/fetchChain";
import {UserInfo} from "../sap/SapUserInfo";
import {RequestListItem, RequestListResponse} from "../sap/RequestListResponse";
import {fetchPr} from "../sap/api";
import {KEY_ALL_PRS_FILENAME_NOEXT} from "../def";
import {cloud} from "../cloud";
import {PurchaseRequisition, SapField, SapLineItem} from "../sap/SapPrInfo";
import {getGlobalSettingsCached} from "../plugin_options/options";
import {LedgerToBudgetCode} from "./budgetCodes";
import {createCompactReqItem} from "../aanvraag/observer";
import {ProcurementForm} from "../sap/ProcurementForm";
import {getLocalCache} from "../db/idb/localDb";
import {getInfoBlock, getInfoBlockForCurrentPage, InfoBlock} from "../infoBlock/infoBlock";
import {getMetaCache} from "../db/metaCache";
import {firestore} from "../db/fireStore";
import {getSessionCache, SessionCache} from "../sessionCache";

export interface BaseLineItem {
    tarif: TarifDef | null;
    quantity: number;
    price: number;
    commodityCode: string;
}

export interface ExpandedPrItem extends BaseLineItem {
    pr: PurchaseRequisition;
    item: SapLineItem;
    ledger: AccountingField | null;
    budget: LedgerToBudgetCode | null;
    grant: AccountingField | null;
}

export interface ExpandedProcurementForm extends BaseLineItem {
    pf: ProcurementForm;
}

export interface ExpandedCompactPrItem  extends BaseLineItem {
    item: CompactReqItem;
}

export interface CompactReqItem {
    commodityCode: string,
    price: number;
    quantity: number,
    currency: string,
    currencySymbol: string,
}
export interface CompactRequisition {
    prId: string,
    items: CompactReqItem[],
}

export interface FetchListContext {
    counter: number;
    infoBlock: InfoBlock;
}

export interface PrMeta {
    version: number;
    prId: string,
    tags: string[],
    changed_date?: string;
    department?: string;
    projects?: string;
}

export interface ExpandedPr {
    pr: PurchaseRequisition,
    items: ExpandedPrItem[];
}

export interface PoData {
    orderId: string; //for display
    uniqueName: string; //for url
}

export interface PrListPrData {
    prId: string;
    title: string;
    preparer: string;
    status: string;
    changed_date: string;
    items: PrListItemData[];
    poData: PoData[];
}

export interface PrListItemData {
    index: number;
    supplier: string;
    commodityCode: string;
    grantCode: string;
    ledgerCode: string;
    netto: number;
    bruto: number;
    currency: string;
}

export interface ExpandedCompactPr {
    pr: CompactRequisition,
    items: ExpandedCompactPrItem[];
}

export interface ChangedFile<T> {
    name: string;
    data: T,
    changed: string
}

export interface TarifDefs {
    tarifs: TarifDef[];
}

export interface AccountingField {
    code: string;
    dscr: string;
}

export interface TarifDef {
    commodityCode: string;
    description: string;
    tarif: number;
}

export interface TagDef {
    name: string,
    description: string,
    color: string,
    bkgColor: string,
    order: number
}

async function fetchRequestListChunk(chain: FetchChain, userInfo: UserInfo, zSince?: string) {
    if(!zSince) {
        let now = new Date();
        zSince = now.toISOString().replaceAll("T", " ").split(".")[0] + " GMT";
    }
    //todo: is browserrequestid needed? or can I use a custom one?
    await chain.post(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo.hashedUser}/requisition/getYourRequestsWithTabSupport?yourRequestsTab=requisition&yourRequestType=all&browserRequestId=newYourRequests1779060906435`,
        {
            "searchFilters": {
                "LastUpdatedFromDate": "2026-02-17 23:00:00 GMT",
                "LastUpdatedToDate": zSince,
            },
            "requestTypeFilter": "all",
            "orderByField": "daterequested",
            "ascendingOrder": false
        }
    );
    let requestList: RequestListResponse = await chain.getJson();
    return requestList;
}

async function updateRequestsInFirestore(requestList: RequestListItem[]) {
    let last_changed = await firestore.fetchKeyValue("last_changed");
    if (last_changed == null) {
        last_changed = "0";
    }
    let newChangeDate = (new Date()).toISOString();
    let sessionCache = await getSessionCache();

    let changedReqs = requestList
        .filter(request => request.lastModifiedDate > last_changed);
    let infoBlock = getInfoBlockForCurrentPage();
    infoBlock.progressBar.start(changedReqs.length);
    for (const request of changedReqs) {
        let pr = await fetchPr(request.reqUniqueName);
        let prData: PrListPrData = convertPrToListData(request, pr, sessionCache);
        await firestore.savePrData(prData);
        infoBlock.progressBar.next();
    }
    infoBlock.progressBar.stop();

    await firestore.saveKeyValue("last_changed", newChangeDate);
}

export async function fetchRequestList() {
    let chain = new FetchChain();
    await chain.fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false"); //todo: replace with getUserInfo()
    let userInfo = chain.getJson() as UserInfo | null;
    if (userInfo == null) {
        throw new Error("gringo: could not get userInfo.");
    }

    let requestList = await fetchRequestListChunk(chain, userInfo);
    if(requestList.requestList.length > 0) {
        while (true) {
            let requestList2 = await fetchRequestListChunk(chain, userInfo, requestList.requestList[requestList.requestList.length - 1].lastModifiedDate + " 00:00:00 GMT");
            if (requestList2.requestList.length == 0)
                break;
            requestList.requestList.push(...requestList2.requestList);
        }
    }
    //Keep the order:
    let uniqueRequests: RequestListItem[] = []
    for(let pr of requestList.requestList) {
        if(!uniqueRequests.some(p => p.reqUniqueName == pr.reqUniqueName)) {
            uniqueRequests.push(pr);
        }
    }
    requestList.requestList = uniqueRequests;
    await updateRequestsInFirestore(requestList.requestList); //todo: do this in background? Service worker?
    return requestList
}

export async function fetchFullRequest(prId: string, ctx: FetchListContext) {
    let pr = await fetchPr(prId);
    ctx.infoBlock.infoBar.setInfoLine(`PR details ophalen...(${ctx.counter++})`);
    if(pr.title == null)
        return null; //todo : report this error somehow.
    return pr;
}

export async function fetchRequestListAndDetails(infoBlock: InfoBlock) {
    infoBlock.infoBar.setInfoLine("PR lijst ophalen...");
    let requestList = await fetchRequestList();
    infoBlock.infoBar.setInfoLine("PR details ophalen...");
    let ctx: FetchListContext = {
        counter: 0,
        infoBlock
    }
    let promises = requestList.requestList.map(r => {
        let requestId = r.reqUniqueName;
        return fetchFullRequest(requestId, ctx);
    })

    let detailsList = await Promise.all(promises);
    let jsonList = detailsList
        .filter(r => r != null)
        .map(r => {
            if(r.lineItems == null)
                return [];
            return r.lineItems.map(item => {
                let {currency, currencySymbol, ...compactItem} = createCompactReqItem(item);
                return {
                    prId: r.reqId,
                    status: r.status,
                    title: r.title.value,
                    lineNumber: item.lineNumber,
                    ...compactItem
                }
            }
            );
    }).flat();
    await cloud.json.upload(KEY_ALL_PRS_FILENAME_NOEXT+"_2026.json", jsonList);
    return detailsList;
}

export async function saveMeta(meta: PrMeta) {
    await firestore.savePrMeta(meta);
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

export function getPrItemGrant(prItem: SapLineItem) {
    return getAccountingField(prItem, "cus_Grant");
}

let globalTagsMap: Map<string, TagDef> | null = null;

export async function getGlobalTags() {
    if(!globalTagsMap) {
        let globalSettings = await getGlobalSettingsCached();
        globalTagsMap = new Map<string, TagDef>(globalSettings.tagDefs.map(t => [t.name, t]));
    }
    return globalTagsMap;
}

export function calcBrutoLinePrice(item: BaseLineItem) {
    let bruto: number | null = null;
    let price = item.price;
    let quantity = item.quantity;
    bruto = price * quantity * (100 + (item.tarif?.tarif??0));
    bruto = Math.round(bruto) / 100;
    return bruto;
}

export function calcPrTotal(pr: ExpandedCompactPr) {
    let currencySymbel = "€";
    let currency = "EUR";
    let total = pr.items
        .reduce((total, item) =>
            total + calcBrutoLinePrice(item),
            0);
    return {total, currencySymbel, currency};
}

function convertToBaseLineItem(item: SapLineItem, sessionCache: SessionCache): BaseLineItem {
    let commodityCode = getPrItemCommodity(item)?.code??"";
    let tarif = sessionCache.getTarifDef(commodityCode);
    return {
        commodityCode,
        price: item.price.value.amount,
        quantity: item.quantity.value,
        tarif: tarif
    };
}

function convertPrListItemData(item: SapLineItem, sessionCache: SessionCache): PrListItemData {
    let commodityCode = getPrItemCommodity(item)?.code??"";
    let grantCode = getPrItemGrant(item)?.code??"";
    let ledgerCode = getPrItemLedger(item)?.code;
    if (!ledgerCode)
        ledgerCode = getPrItemAsset(item)?.code??"";

    return {
        index: parseInt(item.lineNumber),
        netto: item.quantity.value,
        bruto: calcBrutoLinePrice(convertToBaseLineItem(item, sessionCache)),
        commodityCode,
        currency: item.price.currency??"",
        supplier: item.supplier.value??"",
        grantCode,
        ledgerCode
    };
}

function convertPrToListData(request: RequestListItem, pr: PurchaseRequisition, sessionCache: SessionCache): PrListPrData {
    let listItemDatas: PrListItemData[] = [];
    for(let item of pr.lineItems??[]){
        listItemDatas.push(convertPrListItemData(item, sessionCache));
    }
    let poData: PoData[] = request.gbPurchaseOrderList
        ?.map(po => { return { uniqueName: po.uniqueName, orderId: po.orderId} })??[];
    return {
        prId: pr.reqId,
        title: request.reqTitle??"",
        preparer: request.preparer,
        status: request.status,
        items: listItemDatas,
        changed_date: request.timeUpdated,
        poData
    };
}

function getPoListData(request: RequestListItem): PoData[] {
    return request.gbPurchaseOrderList
        ?.map(po => {
            return {uniqueName: po.uniqueName, orderId: po.orderId}
        })??[];
}

export async function getPrDataList(){
    let infoBlock = getInfoBlockForCurrentPage();
    let requests = await fetchRequestList(); //todo: fetch first 200 only?
    let prListDatas: PrListPrData[] = [];
    let cache = await getLocalCache();
    infoBlock.infoBar.setInfoLine("Ophalen gewijzigde PR's...");
    infoBlock.progressBar.start(requests.requestList.length);
    let sessionCache = await getSessionCache();
    for(let request of requests.requestList){
        let prListData: PrListPrData | undefined = await cache.PrListData.get(request.reqUniqueName);

        if(prListData && isPrDataUpToDate(request, prListData)) {
            prListDatas.push(prListData);
            continue;
        }
        let pr = await fetchPr(request.reqUniqueName);
        let prData = convertPrToListData(request, pr, sessionCache);
        await cache.PrListData.put(prData);
        prListDatas.push(prData);
        infoBlock.progressBar.next();
    }
    infoBlock.infoBar.setInfoLine("");
    infoBlock.progressBar.stop();
    return mergeRequestsAndData(prListDatas, requests);
}

function isPrDataUpToDate(request: RequestListItem, prListData: PrListPrData) {
    if(prListData.changed_date != request.timeUpdated)
        return false;
    return getPoListData(request).join() == prListData.poData.join();
}

export interface ExpandedPrListData {
    prListData: PrListPrData;
    meta: PrMeta;
    netto: number;
    bruto: number;
}

async function mergeRequestsAndData(prListDatas: PrListPrData[], requests: RequestListResponse) {
    let metaCache = await getMetaCache();
    let dataSet = new Map<string, PrListPrData>();
    for(let prListData of prListDatas){
        dataSet.set(prListData.prId, prListData);
    }
    let expandedPrListData: ExpandedPrListData[] = [];
    for(let request of requests.requestList){
        let prListData = dataSet.get(request.reqUniqueName);
        if(!prListData){
            console.error(`Could not find prListData for request ${request.reqUniqueName}`);
            continue;
        }
        let meta = await metaCache.get(prListData.prId);
        if(!meta){
            console.error(`Could not find meta for pr ${prListData.prId}`);
            continue;
        }
        let netto = prListData.items.reduce((acc, item) => acc + item.netto, 0);
        let bruto = prListData.items.reduce((acc, item) => acc + item.bruto, 0);
        expandedPrListData.push({ prListData, meta, netto, bruto });
    }
    return expandedPrListData
        .filter(item => item !== undefined) as ExpandedPrListData[];
}

export async function getSuppliers(prId: string): Promise<string[]> {
    let pr = await fetchPr(prId);
    if(pr.lineItems)
        return pr.lineItems.map(item => item.supplier.value);
    return [];
}