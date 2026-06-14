import {CalcField} from "./calcField";

interface FieldDef<Ctx> {
    field: HTMLElement;
    callback: (ctx: Ctx) => void;
}

//Really, it's just an observed data object, that tries to avoid deadlooping updates.
export class EntangledFields<Ctx> {
    fields: FieldDef<Ctx>[];
    currentSourceField: HTMLElement | null;
    isTransfering: boolean;
    context: Ctx;

    constructor(context: Ctx) {
        this.fields = [];
        this.context = context;
        this.currentSourceField = null;
        this.isTransfering = false;
    }

    add(field: HTMLElement, updateCallback1: (ctx: Ctx) => void) {
        this.fields.push({field, callback: updateCallback1});
        field.addEventListener("focus", () => {
            if(!this.isTransfering)
                this.currentSourceField = field;
        });
    }

    setCurrentSource(field: HTMLElement) {
        this.currentSourceField = field;
    }

    updateOtherFields() {
        if(this.isTransfering)
            return;
        this.isTransfering = true;
        this.fields
            .filter(f => f.field != this.currentSourceField)
            .forEach(f => f.callback(this.context))
        this.isTransfering = false;
    }

}

