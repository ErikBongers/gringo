import {emmet} from "../../libs/Emmeter";
import {Parser, ParseResult} from "../calculator/parser";
import {formatPrice, gringo} from "../globals";

export class CalcField {
    input: HTMLInputElement;
    resultDiv: HTMLDivElement;
    resultLabel: HTMLElement;
    resultErrorImage: HTMLElement;
    result: ParseResult | null = null;
    postFieldLabelDiv: HTMLDivElement | null = null;

    constructor(container: HTMLElement, label: string, postFieldLabel: string | HTMLElement, postFieldLabelClass: string[], onRecalculated: (field: CalcField) => void) {
        let postFieldEmmet = "";
        let postFieldLabelClassString = postFieldLabelClass.join(".");
        if(postFieldLabelClassString)
            postFieldLabelClassString = "." + postFieldLabelClassString;
        let fieldDiv = emmet.indent.appendChild(container, `
            div
                div.input-wrap
                    div.form-group
                        label.editable-field-label{${label}}
                        div.field-wrapper
                            div.flexRow
                                input.form-control[type="text"]
                                div.postFieldLabel${postFieldLabelClassString}
                            div.flexRow.calcResult
                                label
                                i.fa.fa-triangle-exclamation
        `).first as HTMLDivElement;
        let postFieldLabelDiv = fieldDiv.querySelector("div.postFieldLabel") as HTMLDivElement;
        if(typeof postFieldLabel == "string")
            postFieldLabelDiv.innerHTML = postFieldLabel;
        else
            postFieldLabelDiv.appendChild(postFieldLabel);
        this.input = fieldDiv.querySelector("input")!;
        this.resultDiv = fieldDiv.querySelector("div.calcResult") as HTMLDivElement;
        this.resultLabel = this.resultDiv.querySelector("label") as HTMLElement;
        this.resultErrorImage = fieldDiv.querySelector("i.fa") as HTMLElement;
        this.input.addEventListener("keyup", (ev) => {
            this.reParse();
            onRecalculated(this);
        });
        this.input.addEventListener("gringo.recalc", (ev) => {
            gringo("recalc");
            this.reParse();
            onRecalculated(this);
        });
        if(postFieldLabel != "") {
            this.postFieldLabelDiv = fieldDiv.querySelector("div.postFieldLabel") as HTMLDivElement;
        }
    }

    reParse() {
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