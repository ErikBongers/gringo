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