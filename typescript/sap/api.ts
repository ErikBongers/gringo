import {FetchChain} from "../fetchChain";
import {PurchaseRequisition} from "./SapPrInfo";
import {UserInfo} from "./SapUserInfo";
import {RequisitionContext} from "./RequisitionContext";

export async function fetchPr(prId: string) {
    let chain = new FetchChain();
    await chain.fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false"); //todo: load once.
    let userInfo = chain.getJson() as UserInfo | null;
    if (!userInfo) {
        console.error("gringo: could not get userInfo.");
    }

    await chain.fetch(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/${prId}`);
    return chain.getJson() as PurchaseRequisition;
}

export async function fetchReqContext() {
    let chain = new FetchChain();
    await chain.fetch("https://s1-eu.ariba.com/gb/usercontext?gbst=null&realm=null&isoauth=false"); //todo: load once.
    let userInfo = chain.getJson() as UserInfo | null;
    if (!userInfo) {
        console.error("gringo: could not get userInfo.");
    }

    await chain.fetch(`https://s1-eu.ariba.com/gb/tenant/744379882-C1/user/${userInfo?.hashedUser}/requisition/obo`);
    return chain.getJson() as RequisitionContext;
}
