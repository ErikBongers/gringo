import {checkAndSetDecoration, PartialUrlObserver} from "../pageObserver";
import {gringo} from "../globals";
import {emmet} from "../../libs/Emmeter/html";
import {getUserInfo, UserInfo} from "../sap/SapUserInfo";
import {ProcurementForm} from "../sap/ProcurementForm";
import {getBtwTarif} from "../aanvragen/requests";
import {fillBrutoContainer, triggerFieldChanged} from "../brutoNettoFields";

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

function scanAndSelectPerEenheid(ulUnitOfMeasure: HTMLElement) {
    let anchors = ulUnitOfMeasure.querySelectorAll("a") as NodeListOf<HTMLAnchorElement>;
    let anchorPerEenheid = [...anchors].find(a => a.innerText.includes("Per eenheid"));
    if(anchorPerEenheid) {
        anchorPerEenheid.dispatchEvent(new Event("mousedown", {
            bubbles: true
        }));
        anchorPerEenheid.dispatchEvent(new Event("click", {
            bubbles: true
        }));
        anchorPerEenheid.dispatchEvent(new Event("mouseup", {
            bubbles: true
        }));
        ulUnitOfMeasure.style.display = "";
        return;
    }
    setTimeout(() => scanAndSelectPerEenheid(ulUnitOfMeasure), 100);
}

async function decoratePanel(el: HTMLElement) {
    let ul = el.querySelector("div.adhoc-item-detail-section div.input-wrap-container") as HTMLDivElement;
    let li = emmet.appendChild(ul, `
        li.adhoc-form-input-section.gringo.blueBlock
    `).first as HTMLLIElement;
    let fieldQuantity = el.querySelector("div.field-quantity") as HTMLDivElement;
    let fieldQuantityInput = fieldQuantity.querySelector("input") as HTMLInputElement;
    fieldQuantityInput.value = "1";

    let prForm = await fetchReqFormInfo();
    let tarif =  await getBtwTarif(prForm.commodityCode);
    let fieldQuantityInputGroup = fieldQuantity.querySelector(":scope > div.input-group") as HTMLDivElement;
    emmet.appendChild(fieldQuantityInputGroup, `
        span.percentSpan>div.gringo.blueBlock{${tarif?.tarif}%}
    `);

    let fieldUnitOfMeasure = el.querySelector(`field[ng-model="unitOfMeasureObject2"]`) as HTMLElement;
    let btnUnitOfMeasure = fieldUnitOfMeasure.querySelector(`button[ng-class="{'field-button': showEmbargoedField}"]`) as HTMLButtonElement;
    let ulUnitOfMeasure = fieldUnitOfMeasure.querySelector("ul") as HTMLUListElement;
    ulUnitOfMeasure.style.display = "none";
    btnUnitOfMeasure.dispatchEvent(new Event('click'));
    scanAndSelectPerEenheid(ulUnitOfMeasure);

    let radioButtons = el.querySelectorAll(`af-radio-button-group input[type="radio"]`) as NodeListOf<HTMLInputElement>;
    if(radioButtons.length == 3) {
        radioButtons[0].dispatchEvent(new Event("mousedown", {bubbles: true}));
        radioButtons[0].dispatchEvent(new Event("click", {bubbles: true}));
        radioButtons[0].dispatchEvent(new Event("change", {bubbles: true}));
        radioButtons[0].dispatchEvent(new Event("mouseup", {bubbles: true}));
        radioButtons[2].dispatchEvent(new Event("mousedown", {bubbles: true}));
        radioButtons[2].dispatchEvent(new Event("click", {bubbles: true}));
        radioButtons[2].dispatchEvent(new Event("change", {bubbles: true}));
        radioButtons[2].dispatchEvent(new Event("mouseup", {bubbles: true}));
    }

    fillBrutoContainer(li, fieldQuantityInput, tarif);
    decorateFieldQuantity(fieldQuantity);
    let fieldMoney = el.querySelector("div.field-money input") as HTMLInputElement;
    fieldMoney.value = "1";
    triggerFieldChanged(fieldMoney);

}

function decorateFieldQuantity(fieldQuantity: HTMLElement) {
    let input = fieldQuantity.querySelector("input") as HTMLInputElement;
    fieldQuantity.classList.add("hidePlusMinButtons");
}

async function fetchReqFormInfo() {
    let userInfo = await getUserInfo();
    let userId = userInfo.hashedUser;
    let tenant = userInfo.tenant;
    let params = new URLSearchParams(location.search);
    let resourceId = params.get("fromresourceid");
    let formId = location.pathname.split("/").pop();
    let daUrl = `https://s1-eu.ariba.com/gb/tenant/${tenant}/user/${userId}/resource/formwithresourceoverride/${formId}?resourceId=${resourceId}`;
    let res = await fetch(daUrl);
    return await res.json() as ProcurementForm;
}
