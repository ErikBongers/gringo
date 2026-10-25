import {emmet} from "../../libs/Emmeter";

export function createSearchField(id: string, onSearchInput: (text: string) => any, value: string) {
    let input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.classList.add("tableFilter");
    input.oninput = (event) => onSearchInput((event.target as HTMLInputElement).value);
    input.value = value;
    input.placeholder = "filter";
    let span = document.createElement("span");
    span.classList.add("searchButton");
    span.appendChild(input);
    let {first: clearButton} = emmet.appendChild(span, `button>img[src="${chrome.runtime.getURL("images/circle-xmark-regular.svg")}"`);
    (clearButton as HTMLElement).onclick = () => {
        input.value = "";
        // @ts-ignore
        onSearchInput("");
        input.focus();
    };
    return span;
}

let listIdCounter = 0;
export function createEditListField(onTextConfirmed: (text: string) => any, value: string, options: string[]) {
    listIdCounter++;
    let listId = `editList${listIdCounter}`;
    let div = emmet.indent.createElement(`
        div.editListField.flexRow
            input[type="text" list="${listId}"]
            datalist[id="${listId}"]
            button.naked.blueBlock.squircle.op05
                i.fa.fa-floppy-disk[style="font-size:1.4em;"]
    `) as HTMLDivElement;
    let input = div.querySelector("input")!;
    input.value = value;
    let dataList = div.querySelector("datalist")!;
    for (let option of options) {
        let optionElement = dataList.appendChild(document.createElement("option"));
        optionElement.value = option;
    }
    let button = div.querySelector("button") as HTMLButtonElement;
    button.onclick = () => {
        onTextConfirmed(input.value);
    };
    return div;
}