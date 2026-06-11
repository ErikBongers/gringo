import {checkAndSetDecoration, PartialUrlObserver} from "../pageObserver";
import {getAndSetDecorated, gringo} from "../globals";
import {emmet} from "../../libs/Emmeter/html";

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

function decoratePanel(el: HTMLElement) {
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
    let input = li.querySelector("input")!;
    let aantal = el.querySelector("div.field-quantity input") as HTMLInputElement;
    input.onkeyup = () => {
        aantal.value = input.value;
        aantal.dispatchEvent(new Event('change')); //todo: reduce these events (the last 2 are probably needed).
        aantal.dispatchEvent(new Event('input'));
        aantal.dispatchEvent(new Event('blur'));
        aantal.dispatchEvent(new Event('keyup'));
        aantal.dispatchEvent(new Event('mouseout'));
    };
}
