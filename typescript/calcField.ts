import {emmet} from "../libs/Emmeter/html";
import {Parser, ParseResult} from "./calculator/parser";
import {formatPrice} from "./globals";

export class CalcField {
    input: HTMLInputElement;
    resultDiv: HTMLDivElement;
    resultLabel: HTMLElement;
    resultErrorImage: HTMLElement;
    result: ParseResult | null = null;

    constructor(container: HTMLElement, label: string, postFieldLabel: string, postFieldLabelClass: string[], onRecalculated: (field: CalcField) => void) {
        let postFieldEmmet = "";
        if(postFieldLabel != "") {
            postFieldEmmet = `+
                div.postFieldLabel>
                    div${postFieldLabelClass.join(".")}{${postFieldLabel}}
            `;
        }
        let fieldDiv = emmet.appendChild(container, `
            div>
                div.input-wrap>
                    div.form-group>(
                        label.editable-field-label{${label}}+
                        div.field-wrapper>(
                                (
                                div.flexRow>(
                                    input.form-control[type="text"]
                                    ${postFieldEmmet}
                                )
                            )+
                            div.flexRow.calcResult>(
                                label+
                                i.fa.fa-triangle-exclamation
                            )
                        )                                                    
                    )
        `).first as HTMLDivElement;
        this.input = fieldDiv.querySelector("input")!;
        this.resultDiv = fieldDiv.querySelector("div.calcResult") as HTMLDivElement;
        this.resultLabel = this.resultDiv.querySelector("label") as HTMLElement;
        this.resultErrorImage = fieldDiv.querySelector("i.fa") as HTMLElement;
        this.input.addEventListener("keyup", (ev) => {
            this.reCalc();
            onRecalculated(this);
        });
    }

    reCalc() {
        if (this.input.value == "") {
            this.result = null;
            this.resultLabel.textContent = "";
            this.resultDiv.classList.toggle("error", false);
            return;
        }
        let parser = new Parser(this.input.value);
        this.result = parser.parse();
        this.resultLabel.textContent = formatPrice(this.result.result);
        this.resultDiv.classList.toggle("error", this.result.errors.length > 0);
        this.resultErrorImage.title = this.result.errors.map(e => e.message).join("\n");
    }
}