import {emmet} from "../libs/Emmeter/html";
import {Parser, ParseResult} from "./calculator/parser";
import {formatPrice} from "./globals";

export interface CalcField {
    input: HTMLInputElement;
    resultDiv: HTMLDivElement;
    resultLabel: HTMLElement;
    resultErrorImage: HTMLElement;
    result: ParseResult | null;
}

export function createCalcField(container: HTMLElement, label: string, onRecalc: (field: CalcField) => void): CalcField {
    let fieldDiv = emmet.appendChild(container, `
        div>
            div.input-wrap>
                div.form-group>(
                    label.editable-field-label{${label}}+
                    div.field-wrapper>(
                        input.form-control[type="text"]+
                        div.flexRow.calcResult>(
                            label+
                            i.fa.fa-triangle-exclamation
                        )
                    )                                                    
                )
    `).first as HTMLDivElement;
    let input = container.querySelector("input")!;
    let calcResultDiv = fieldDiv.querySelector("div.calcResult") as HTMLDivElement;
    let calcResultLabel = calcResultDiv.querySelector("label") as HTMLElement;
    let calcResultErrorImage = fieldDiv.querySelector("i.fa") as HTMLElement;
    let calcFieldContainer: CalcField = {
        input,
        resultDiv: calcResultDiv,
        resultLabel: calcResultLabel,
        resultErrorImage: calcResultErrorImage,
        result: null
    };
    input.addEventListener("keyup", (ev) => {
        reCalc(calcFieldContainer);
        onRecalc(calcFieldContainer);
    });
    return calcFieldContainer;
}

function reCalc(sourceField: CalcField) {
    if(sourceField.input.value == "") {
        sourceField.result = null;
        sourceField.resultLabel.textContent = "";
        sourceField.resultDiv.classList.toggle("error", false);
        return;
    }
    let parser = new Parser(sourceField.input.value);
    sourceField.result = parser.parse();
    sourceField.resultLabel.textContent = formatPrice(sourceField.result.result);
    sourceField.resultDiv.classList.toggle("error", sourceField.result.errors.length > 0);
    sourceField.resultErrorImage.title = sourceField.result.errors.map(e => e.message).join("\n");
}
