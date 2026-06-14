import {emmet} from "../libs/Emmeter/html";
import {Btw} from "./aanvragen/requests";
import {formatPrice} from "./globals";
import {Parser} from "./calculator/parser";

interface CalcFieldContainer {
    input: HTMLInputElement;
    resultDiv: HTMLDivElement;
    resultLabel: HTMLElement;
    resultErrorImage: HTMLElement;
}

export function createBrutoField(container: HTMLElement, fieldQuantityInput: HTMLInputElement, tarif: Btw | null) {
    emmet.appendChild(container, `
        div>
            div.input-wrap>
                div.form-group>(
                    label.editable-field-label{Bruto}+
                    div.field-wrapper>(
                        input.form-control[type="text"]+
                        div.flexRow.calcResult>(
                            label+
                            i.fa.fa-triangle-exclamation
                        )
                    )                                                    
                )
    `);
    let input = container.querySelector("input")!;
    let calcResultDiv = container.querySelector("div.calcResult") as HTMLDivElement;
    let calcResultLabel = calcResultDiv.querySelector("label") as HTMLElement;
    let calcResultErrorImage = container.querySelector("i.fa") as HTMLElement;
    let calcFieldContainer: CalcFieldContainer = {
        input,
        resultDiv: calcResultDiv,
        resultLabel: calcResultLabel,
        resultErrorImage: calcResultErrorImage
    };
    input.addEventListener("keyup", (ev) => {
        updateFromNewBrutoValue(tarif, calcFieldContainer, fieldQuantityInput);
    });
    return calcFieldContainer;
}

export function triggerFieldChanged(input: HTMLInputElement) {
    input.dispatchEvent(new Event('change')); //todo: reduce these events (the last 2 are probably needed).
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    input.dispatchEvent(new Event('keyup'));
    input.dispatchEvent(new Event('mouseout'));
}

function updateFromNewBrutoValue(tarif: Btw | null, brutoField: CalcFieldContainer, fieldQuantityInput: HTMLInputElement) {
    if(brutoField.input.value == "") {
        brutoField.resultLabel.textContent = "";
        brutoField.resultDiv.classList.toggle("error", false);
        return;
    }
    let btw = tarif?.tarif ?? 0;
    let parser = new Parser(brutoField.input.value);
    let res = parser.parse();
    let netto = res.result / (1 + btw / 100);
    brutoField.resultLabel.textContent = formatPrice(res.result);
    brutoField.resultDiv.classList.toggle("error", res.errors.length > 0);
    brutoField.resultErrorImage.title = res.errors.map(e => e.message).join("\n");
    fieldQuantityInput.value = formatPrice(netto, "", "").trim();
    triggerFieldChanged(fieldQuantityInput);
}
