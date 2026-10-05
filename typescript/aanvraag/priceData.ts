import {BaseLineItem} from "../aanvragen/requests";
import {unreachable} from "../unreachable";

export type RecalcSource = "bruto" | "netto";

//Centralizes price calculations to keep values consistent.
//Values are only recalculated if sources are not null.
//If there's a null value, the PriceData object is in a indeterminate state.
// > Should we have a flag for that?
export class PriceData {
    private _bruto: number | null = null;
    private _netto: number | null = null;
    private _tarif: number | null = null;
    private _unitPrice: number;
    private _quantity: number;
    private readonly expandedPrItem: BaseLineItem | null;
    private isGenericProduct: boolean; //to disambiguate between unitPrice being actually 1 and irrelevant.

    constructor(quantity: number, unitPriceOrGeneric: number | null, btw: number | null, expandedPrItem: BaseLineItem | null) {
        this._tarif = btw;
        this.expandedPrItem = expandedPrItem;
        this._quantity = quantity;
        this.isGenericProduct = unitPriceOrGeneric == null;
        this._unitPrice = unitPriceOrGeneric ?? 1;
    }

    get tarif(): number | null {
        return this._tarif;
    }

    set tarif(value: number | null) {
        this._tarif = value;
        //todo: assuming currentSource/lastChanged = "netto"
        if(this._tarif != null && this._netto != null && this._unitPrice != null && this._quantity != null) {
            this._bruto = this._netto * (1 + this._tarif / 100);
        }
    }

    get netto(): number | null {
        return this._netto;
    }

    set netto(value: number | null) {
        this._netto = value;
        if (this._netto != null) {
            this._quantity = this._netto / this._unitPrice; //todo: or unitPrice = netto / quantity, based on lastUpdated, isGenericProduct or locked fields
            this._bruto = this._tarif != null ? this._netto * (1 + this._tarif / 100) : null;
        }
        this.updatePrItem();
    }

    get bruto(): number | null {
        return this._bruto;
    }

    set bruto(value: number | null) {
        this._bruto = value;
        if (this._bruto != null) {
            this._netto = this._tarif != null ? this._bruto / (1 + this._tarif / 100) : null;
            if(this._netto != null)
                this._quantity = this._netto / this._unitPrice; //todo: or unitPrice = netto / quantity, based on lastUpdated, isGenericProduct or locked fields
        }
        this.updatePrItem();
    }

    get unitPrice(): number | null {
        return this._unitPrice;
    }

    setUnitPrice(value: number | null, recalcFrom: "netto" | "bruto") {
        this.isGenericProduct = value == null;
        this._unitPrice = value ?? 1;
        switch (recalcFrom) {
            case "netto":
                this.netto = this._netto;
                break;
            case "bruto":
                this.bruto = this._bruto;
                break;
            default:
                unreachable(recalcFrom);
        }
    }

    get quantity(): number {
        return this._quantity;
    }

    set quantity(value: number) {
        this._quantity = value;
        this.updatePrItem();
    }

    private updatePrItem() {
        if (!this.expandedPrItem)
            return;

        this.expandedPrItem.quantity = this._quantity;
    }

}