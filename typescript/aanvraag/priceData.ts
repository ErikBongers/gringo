import {ExpandedCompactPrItem} from "../aanvragen/requests";

export class PriceData {
    private _bruto: number | null = null;
    private _netto: number | null = null;
    private _btw: number | null = null;
    private readonly expandedPrItem: ExpandedCompactPrItem | null;

    constructor(btw: number | null, expandedPrItem: ExpandedCompactPrItem | null) {
        this._btw = btw;
        this.expandedPrItem = expandedPrItem;
    }

    get btw(): number | null {
        return this._btw;
    }

    set btw(value: number | null) {
        this._btw = value;
    }

    get netto(): number | null {
        return this._netto;
    }

    set netto(value: number | null) {
        this._netto = value;
        if (this._netto)
            this._bruto = this._btw ? this._netto * (1 + this._btw / 100) : null;
        if (this.expandedPrItem)
            this.expandedPrItem.item.quantity = this._netto!;
    }

    get bruto(): number | null {
        return this._bruto;
    }

    set bruto(value: number | null) {
        this._bruto = value;
        if (this._bruto)
            this._netto = this._btw ? this._bruto / (1 + this._btw / 100) : null;
        if (this.expandedPrItem)
            this.expandedPrItem.item.quantity = this._netto!;
    }

}