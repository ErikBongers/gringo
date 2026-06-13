import {emmet} from "../libs/Emmeter/html";
import {Btw} from "./aanvragen/requests";
import {formatPrice} from "./globals";

function calcNettoPrice(value: string, tarif: Btw | null) {
    let btw = tarif?.tarif ?? 0;
    let bruto = parseFloat(value);
    return bruto / (1 + btw / 100);
}

export function fillBrutoContainer(container: HTMLElement, fieldQuantityInput: HTMLInputElement, tarif: Btw | null) {
    emmet.appendChild(container, `
        div>
            div.input-wrap>
                div.form-group>(
                    label.editable-field-label{Bruto}+
                    div.field-wrapper>
                        input.form-control[type="text"]                                                    
                )
    `);
    let brutoInput = container.querySelector("input")!;
    brutoInput.addEventListener("keyup", (ev) => {
        let netto = calcNettoPrice(brutoInput.value, tarif);
        fieldQuantityInput.value = formatPrice(netto, "", "").trim();
        triggerFieldChanged(fieldQuantityInput);
    });
}

export function triggerFieldChanged(input: HTMLInputElement) {
    input.dispatchEvent(new Event('change')); //todo: reduce these events (the last 2 are probably needed).
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    input.dispatchEvent(new Event('keyup'));
    input.dispatchEvent(new Event('mouseout'));
}
