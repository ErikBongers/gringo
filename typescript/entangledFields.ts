interface FieldDef {
    field: HTMLElement;
    callback: (source: HTMLElement) => void;
}

class EntangledFields {
    fields: FieldDef[]; //should only be 2.
    currentSourceField: number;
    isTransfering: boolean;

    constructor(field1: HTMLElement, field2: HTMLElement, updateCallback1: (source: HTMLElement) => void, updateCallback2: (source: HTMLElement) => void) {
        this.fields = [
            {field: field1, callback: updateCallback1},
            {field: field2, callback: updateCallback2}
        ];
        this.currentSourceField = -1;
        this.isTransfering = false;
        field1.addEventListener("focus", () => {
            if(!this.isTransfering)
                this.currentSourceField = 0;
        });
        field2.addEventListener("focus", () => {
            if(!this.isTransfering)
                this.currentSourceField = 1;
        });
    }

    setCurrentSource(field: HTMLElement) {
        this.currentSourceField = this.fields.indexOf(this.fields.find(fd => fd.field == field)!);
    }

    updateTarget() {
        if(this.isTransfering)
            return;
        let targetIndex = this.currentSourceField == 0 ? 1 : 0;
        this.isTransfering = true;
        this.fields[targetIndex].callback(this.fields[this.currentSourceField].field);
        this.isTransfering = false;
    }

}

