import {emmet} from "../libs/Emmeter/html";

export function fillBrutoContainer(container: HTMLElement, fieldQuantityInput: HTMLInputElement) {
    emmet.appendChild(container, `
        div>
            div.input-wrap>
                div.form-group>(
                    label.editable-field-label{Bruto}+
                    div.field-wrapper>
                        input.form-control[type="text"]                                                    
                )
    `);
    let brutoInput = container.querySelector("input")!;
    brutoInput.addEventListener("keyup", (ev) => {
        fieldQuantityInput.value = brutoInput.value;
        triggerFieldChanged(fieldQuantityInput);
    });
}

export function triggerFieldChanged(input: HTMLInputElement) {
    input.dispatchEvent(new Event('change')); //todo: reduce these events (the last 2 are probably needed).
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    input.dispatchEvent(new Event('keyup'));
    input.dispatchEvent(new Event('mouseout'));
}
