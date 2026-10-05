import {BaseLineItem} from "../aanvragen/requests";

//keeps values always consistent
export class PriceData {
    private _bruto: number | null = null;
    private _netto: number | null = null;
    private _tarif: number | null = null; //todo: rename to tarif
    private readonly expandedPrItem: BaseLineItem | null;

    constructor(btw: number | null, expandedPrItem: BaseLineItem | null) {
        this._tarif = btw;
        this.expandedPrItem = expandedPrItem;
    }

    get tarif(): number | null {
        return this._tarif;
    }

    set tarif(value: number | null) {
        this._tarif = value;
    }

    get netto(): number | null {
        return this._netto;
    }

    set netto(value: number | null) {
        this._netto = value;
        if (this._netto != null)
            this._bruto = this._tarif != null ? this._netto * (1 + this._tarif / 100) : null;
        if (this.expandedPrItem)
            this.expandedPrItem.quantity = this._netto!;
    }

    get bruto(): number | null {
        return this._bruto;
    }

    set bruto(value: number | null) {
        this._bruto = value;
        if (this._bruto != null)
            this._netto = this._tarif != null ? this._bruto / (1 + this._tarif / 100) : null;
        if (this.expandedPrItem)
            this.expandedPrItem.quantity = this._netto!;
    }

}