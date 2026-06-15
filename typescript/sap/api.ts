import {FetchChain} from "../fetchChain";
import {PurchaseRequisition} from "./SapPrInfo";
import {UserInfo} from "./SapUserInfo";
import {RequisitionContext} from "./RequisitionContext";
import {RequisitionItem, RequisitionItems} from "./ShoppingCart";

let userInfo: UserInfo | null = null;

export async function fetchUserInfoCached() {
    if(userInfo)
        return userInfo;

    let res = await fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false");
    return await res.json() as UserInfo;
}

export async function fetchPr(prId: string) {
    let userInfo = await fetchUserInfoCached();
    let res = await fetch(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/${prId}`);
    return await res.json() as PurchaseRequisition;
}

export async function fetchReqContext() {
    let userInfo = await fetchUserInfoCached();
    let res = await fetch(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/obo`);
    return await res.json() as RequisitionContext;
}

export async function fetchShoppingCart() {
    let userInfo = await fetchUserInfoCached();
    let res = await fetch(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/shoppingCart`);
    return await res.json() as RequisitionItems;
}
