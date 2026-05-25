import {emmet} from "../../libs/Emmeter/html";

export function fillTotalsTab() {
    let container = document.querySelector("div.gringo.totalsTab") as HTMLElement;
    container.innerHTML = "";
    let infoBlock = createInfoBlock(container);
    infoBlock.title.textContent = "Totals";
    infoBlock.errors.textContent = "No errors."
    infoBlock.info.textContent = "Filling totals....";
    infoBlock.extra.textContent = "Extra info...";
}

function createInfoBlock(el: HTMLElement) {
    emmet.appendChild(el, `
        div.infoBlock>(
            h2.title{Title line}+
            div.errors{errors...}+
            div.info{info...}+
            div.extra{extra...}
        )
    `);
    let title = el.querySelector("h2.title") as HTMLElement;
    let errors = el.querySelector("div.errors") as HTMLElement;
    let info = el.querySelector("div.info") as HTMLElement;
    let extra = el.querySelector("div.extra") as HTMLElement;
    return {title, errors, info, extra} satisfies InfoBlock as InfoBlock;
}

interface InfoBlock {
    title: HTMLElement;
    errors: HTMLElement;
    info: HTMLElement;
    extra: HTMLElement;
}