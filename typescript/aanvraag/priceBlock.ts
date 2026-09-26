import {CalcField} from "./calcField";
import {EntangledFields} from "./entangledFields";
import {ExpandedCompactPr, getBtwTarifsCachedInSession, uploadBtwTarifs} from "../aanvragen/requests";
import {emmet} from "../../libs/Emmeter";
import {formatPrice, gringo} from "../globals";
import {PriceData} from "./priceData";

export class PriceBlock {
    brutoCalcField: CalcField;
    nettoCalcField: CalcField;
    entangledFields: EntangledFields<PriceData>;

    constructor(btw: number | null, container: HTMLElement, pr: ExpandedCompactPr | null, index: number) {
        this.entangledFields = new EntangledFields<PriceData>(new PriceData(btw, pr ? pr.items[index] : null));

        container.classList.add("flexRow");

        this.nettoCalcField = new CalcField(container, "Netto", pr ? createTarifDiv(pr, index, this.entangledFields) : "--", ["gringo"], (field) => {
            if (!field.result)
                return;
            this.entangledFields.context.netto = field.result.result;
            this.entangledFields.updateOtherFields();
        });

        this.brutoCalcField = new CalcField(container, "Bruto", "", [], (field) => {
            if (!field.result)
                return;
            this.entangledFields.context.bruto = field.result.result;
            this.entangledFields.updateOtherFields();
        });

        this.entangledFields.add(this.nettoCalcField.input, (ctx: PriceData) => {
            this.nettoCalcField.input.value = formatPrice(ctx.netto, "", "").trim();
            this.nettoCalcField.reParse();
        });

        this.entangledFields.add(this.brutoCalcField.input, (ctx: PriceData) => {
            this.brutoCalcField.input.value = formatPrice(ctx.bruto, "", "").trim();
            this.brutoCalcField.reParse();
        });
    }

    linkField(field: HTMLElement | null, updateCallback: (ctx: PriceData) => void) {
        if (field)
            this.entangledFields.add(field, updateCallback);
    }

    setTarif(tarif: number | null) {
        this.entangledFields.context.btw = tarif;
        this.entangledFields.updateOtherFields();
    }

    setNetto(netto: number) {
        this.entangledFields.context.netto = netto;
    }

    setCurrentSource(field: HTMLInputElement | null) {
        this.entangledFields.setCurrentSource(field);
    }

    updateOtherFields() {
        this.entangledFields.updateOtherFields();
    }

    setReadOnly() {
        this.brutoCalcField.setReadOnly();
        this.nettoCalcField.setReadOnly();
    }
}


function createTarifDiv(pr: ExpandedCompactPr, index: number, entangledFields: EntangledFields<PriceData>) {
    let div = emmet.createElement(`div.tarifContainer`);
    fillTarifDiv(div, pr, index, entangledFields);
    return div;
}

function updateTarifDiv(container: HTMLElement, pr: ExpandedCompactPr, index: number, entangledFields: EntangledFields<PriceData>) {
    container.innerHTML = "";
    fillTarifDiv(container, pr, index, entangledFields);
}

const TXT_NO_TARIF = "--";
function fillTarifDiv(container: HTMLElement, pr: ExpandedCompactPr, index: number, entangledFields: EntangledFields<PriceData>) {
    if(pr.items[index].tarif) {
        emmet.appendChild(container, `div>label{${pr.items[index].tarif.tarif.toString()}%}`);
    }
    else {
        emmet.indent.appendChild(container, `
        div.flexRow
            select
                option[value="${TXT_NO_TARIF}"]{${TXT_NO_TARIF}%}
                option[value="0"]{0%}
                option[value="6"]{6%}
                option[value="12"]{12%}
                option[value="21"]{21%}
            button.btwSave.m1.naked[style="margin-inline-start: .2ch;"]
                i.far.fa-floppy-disk[style="font-size:1.5em;"]
    `);
        let select = container.querySelector('select') as HTMLSelectElement;
        select.value = TXT_NO_TARIF;
        select.onchange = () => {
            entangledFields.context.btw = parseInt(select.value);
            entangledFields.triggerRecalc();
            gringo("btw changed");
        };
        let button = container.querySelector("button.btwSave") as HTMLButtonElement;
        button.onclick = async (ev) => {
            await onClickCreateTarif(container, select, pr, index, entangledFields);
        };
    }
}


async function onClickCreateTarif(container: HTMLElement, select: HTMLSelectElement, pr: ExpandedCompactPr, index: number, entangledFields: EntangledFields<PriceData>) {
    let txtNewValue = select.value;
    if (txtNewValue == TXT_NO_TARIF)
        return;
    let commodity = pr.items[index].item.commodityCode;
    if (commodity == "") {
        alert("Er is geen 'Commodity-code' (zie sectie Overig) voor dit artikel.");
        return;
    }
    let tarifs = await getBtwTarifsCachedInSession();
    tarifs.set(commodity, {
        commodityCode: commodity,
        description: "",
        tarif: parseInt(txtNewValue)
    });
    pr.items[index].tarif = tarifs.get(commodity)!; //! just set.
    await uploadBtwTarifs(tarifs);
    updateTarifDiv(container, pr, index, entangledFields);
    entangledFields.triggerRecalc();
}