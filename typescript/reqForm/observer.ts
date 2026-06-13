import {checkAndSetDecoration, PartialUrlObserver} from "../pageObserver";
import {gringo} from "../globals";
import {emmet} from "../../libs/Emmeter/html";
import {getUserInfo} from "../sap/SapUserInfo";
import {ProcurementForm} from "../sap/ProcurementForm";
import {getBtwTarif, getBtwTarifsCachedInSession} from "../aanvragen/requests";

class ReqFormObserver extends PartialUrlObserver {
    constructor() {
        super( "reqform", onMutation, false, onPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return isPageProbablyLoaded();
    }
}

export default new ReqFormObserver();

function onPageRefreshed() {
    gringo("Reqform page refreshed!");
    checkDecorations();
}

function isPageProbablyLoaded(): boolean {
    return true; //todo
}

function onMutation(mutation: MutationRecord) {
    checkDecorations();
    return false;
}

function checkDecorations() {
    checkAndSetDecoration(document.querySelector("div.req-form-panel"), decoratePanel);
}

async function decoratePanel(el: HTMLElement) {
    let ul = el.querySelector("div.adhoc-item-detail-section div.input-wrap-container") as HTMLDivElement;
    let li = emmet.appendChild(ul, `
    li.adhoc-form-input-section.gringo.blueBlock>
        div>
            div.input-wrap>
                div.form-group>(
                    label.editable-field-label{Bruto}+
                    div.field-wrapper>
                        input.form-control[type="text"]                                                    
                )
    `).first as HTMLLIElement;
    let brutoInput = li.querySelector("input")!;
    let fieldQuantity = el.querySelector("div.field-quantity") as HTMLDivElement;
    let fieldQuantityInput = fieldQuantity.querySelector("input") as HTMLInputElement;
    decorateFieldQuantity(fieldQuantity, brutoInput);
    let fieldMoney = el.querySelector("div.field-money input") as HTMLInputElement;
    fieldMoney.value = "1";
    triggerFieldChanged(fieldMoney);
    brutoInput.addEventListener("keyup", (ev) => {
        gringo("keyup new value:" + brutoInput.value);
        fieldQuantityInput.value = brutoInput.value;
        triggerFieldChanged(fieldQuantityInput);
    });

    let userInfo = await getUserInfo();
    let userId = userInfo.hashedUser;
    let tenant = userInfo.tenant;
    let params = new URLSearchParams(location.search);
    let resourceId = params.get("fromresourceid");
    let formId = location.pathname.split("/").pop();
    let daUrl =  `https://s1-eu.ariba.com/gb/tenant/${tenant}/user/${userId}/resource/formwithresourceoverride/${formId}?resourceId=${resourceId}`;
    let res = await fetch(daUrl);
    let prForm = await res.json() as ProcurementForm;
    let tarif =  await getBtwTarif(prForm.commodityCode);
    let fieldQuantityInputGroup = fieldQuantity.querySelector(":scope > div.input-group") as HTMLDivElement;
    emmet.appendChild(fieldQuantityInputGroup, `
        span.percentSpan>div.gringo.blueBlock{${tarif?.tarif}%}
    `);

}

function triggerFieldChanged(input: HTMLInputElement) {
    input.dispatchEvent(new Event('change')); //todo: reduce these events (the last 2 are probably needed).
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    input.dispatchEvent(new Event('keyup'));
    input.dispatchEvent(new Event('mouseout'));
}

function decorateFieldQuantity(fieldQuantity: HTMLElement, brutoField: HTMLInputElement) {
    let input = fieldQuantity.querySelector("input") as HTMLInputElement;
    fieldQuantity.classList.add("hidePlusMinButtons");
}
