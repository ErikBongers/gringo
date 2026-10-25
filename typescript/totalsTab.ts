import {emmet} from "../libs/Emmeter";
import {fillTotalsTab} from "./aanvragen/totalsTab";

document.addEventListener("DOMContentLoaded", main);

async function main() {
    emmet.indent.appendChild(document.querySelector("main")!, `
        div.gringo.totalsTab
    `);
    await fillTotalsTab();
}
