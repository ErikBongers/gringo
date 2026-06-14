import {emmet} from "../libs/Emmeter/html";
import {Btw} from "./aanvragen/requests";
import {formatPrice} from "./globals";
import {Parser} from "./calculator/parser";

export function fillBrutoContainer(container: HTMLElement, fieldQuantityInput: HTMLInputElement, tarif: Btw | null) {
    emmet.appendChild(container, `
        div>
            div.input-wrap>
                div.form-group>(
                    label.editable-field-label{Bruto}+
                    div.field-wrapper>(
                        input.form-control[type="text"]+
                        label.calcResult
                    )                                                    
                )
    `);
    let brutoInput = container.querySelector("input")!;
    let calcResultLabel = container.querySelector("label.calcResult") as HTMLElement;
    brutoInput.addEventListener("keyup", (ev) => {
        let btw = tarif?.tarif ?? 0;
        let parser = new Parser(brutoInput.value);
        let res = parser.parse();
        let netto = res.result / (1 + btw / 100);
        calcResultLabel.textContent = formatPrice(res.result);
        calcResultLabel.classList.toggle("error", res.errors.length > 0);
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
