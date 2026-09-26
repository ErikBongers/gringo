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

}

const TXT_NO_TARIF = "--";
function createTarifDiv(pr: ExpandedCompactPr, index: number, entangledFields: EntangledFields<PriceData>) {
    let btwDif = emmet.indent.createElement(`
        div
            label{--%}
            select
                option[value="${TXT_NO_TARIF}"]{${TXT_NO_TARIF}%}
                option[value="0"]{0%}
                option[value="6"]{6%}
                option[value="12"]{12%}
                option[value="21"]{21%}
            button.btwSave.m1{Bewaar voor dit artikel}
    `);
    let select = btwDif.querySelector('select') as HTMLSelectElement;
    select.value = pr.items[index].tarif ? pr.items[index].tarif.tarif.toString() : TXT_NO_TARIF;
    select.onchange = () => {
        entangledFields.context.btw = parseInt(select.value);
        entangledFields.triggerRecalc();
        gringo("btw changed");
    };
    let button = btwDif.querySelector("button.btwSave") as HTMLButtonElement;
    button.onclick = async (ev) => {
        await btnCreateTarifClick(select, pr, index);
    };
    return btwDif;
}


async function btnCreateTarifClick(select: HTMLSelectElement, pr: ExpandedCompactPr, index: number) {
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
    await uploadBtwTarifs(tarifs);
}