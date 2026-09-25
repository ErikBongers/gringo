import {CalcField} from "./calcField";
import {EntangledFields} from "./entangledFields";
import {
    ExpandedCompactPr,
    ExpandedCompactPrItem,
    getBtwTarifsCachedInSession,
    uploadBtwTarifs
} from "../aanvragen/requests";
import {emmet} from "../../libs/Emmeter";
import {formatPrice, gringo} from "../globals";

export class PriceData {
    get btw(): number {
        return this._btw;
    }

    set btw(value: number) {
        this._btw = value;
    }

    get netto(): number | null {
        return this._netto;
    }

    set netto(value: number | null) {
        this._netto = value;
        if (this.expandedPrItem)
            this.expandedPrItem.item.quantity = this._netto!;
        if (this._netto)
            this._bruto = this._netto * (1 + this._btw / 100);
    }

    get bruto(): number | null {
        return this._bruto;
    }

    set bruto(value: number | null) {
        this._bruto = value;
        if (this._bruto)
            this._netto = this._bruto / (1 + this._btw / 100);
        if (this.expandedPrItem)
            this.expandedPrItem.item.quantity = this._netto!;
    }

    private _bruto: number | null = null;
    private _netto: number | null = null;
    private _btw: number;
    private readonly expandedPrItem: ExpandedCompactPrItem | null;

    constructor(btw: number, expandedPrItem: ExpandedCompactPrItem | null) {
        this._btw = btw;
        this.expandedPrItem = expandedPrItem;
    }
}

export class PriceBlock {
    brutoCalcField: CalcField;
    nettoCalcField: CalcField;
    entangledFields: EntangledFields<PriceData>;

    constructor(btw: number, container: HTMLElement, pr: ExpandedCompactPr | null, index: number) {
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
            if (!ctx.netto)
                return;
            this.nettoCalcField.input.value = formatPrice(ctx.netto, "", "").trim();
            this.nettoCalcField.reParse();
        });

        this.entangledFields.add(this.brutoCalcField.input, (ctx: PriceData) => {
            if (!ctx.bruto)
                return;
            this.brutoCalcField.input.value = formatPrice(ctx.bruto, "", "").trim();
            this.brutoCalcField.reParse();
        });
    }

    linkField(field: HTMLElement | null, updateCallback: (ctx: PriceData) => void) {
        if (field)
            this.entangledFields.add(field, updateCallback);
    }

    setTarif(tarif: number) {
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

function createTarifDiv(pr: ExpandedCompactPr, index: number, entangledFields: EntangledFields<PriceData>) {
    let txtSelecteer = "--selecteer--";
    let btwDif = emmet.indent.createElement(`
        div
            label{--%}
            select
                option[value="${txtSelecteer}"]{${txtSelecteer}}
                option[value="0"]{0%}
                option[value="6"]{6%}
                option[value="12"]{12%}
                option[value="21"]{21%}
            button.btwSave.m1{Bewaar voor dit artikel}
    `);
    let select = btwDif.querySelector('select') as HTMLSelectElement;
    select.value = pr.items[index].tarif ? pr.items[index].tarif.tarif.toString() : txtSelecteer;
    select.onchange = () => {
        entangledFields.context.btw = parseInt(select.value);
        entangledFields.triggerRecalc();
        gringo("btw changed");
    };
    let button = btwDif.querySelector("button.btwSave") as HTMLButtonElement;
    button.onclick = async (ev) => {
        await btnCreateTarifClick(select, txtSelecteer, pr, index);
    };
    return btwDif;
}


async function btnCreateTarifClick(select: HTMLSelectElement, txtSelecteer: string, pr: ExpandedCompactPr, index: number) {
    let selected = select.value;
    if (selected == txtSelecteer)
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
        tarif: parseInt(selected)
    });
    await uploadBtwTarifs(tarifs);
}