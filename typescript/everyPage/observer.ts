import {checkAndSetDecoration, PartialUrlObserver} from "../pageObserver";
import {gringo} from "../globals";
import {emmet} from "../../libs/Emmeter";
import {DropDownMenu} from "../utils/dropDownMenus";
import {Actions, sendRequest, TabType} from "../messaging";

class EveryPageObserver extends PartialUrlObserver {
    constructor() {
        super( "s1-eu.ariba.com/gb/", onMutation, false, onPageRefreshed );
    }
    isPageReallyLoaded(): boolean {
        return isPageProbablyLoaded();
    }
}

let everyPageObserver=  new EveryPageObserver();
export default everyPageObserver;

function onPageRefreshed() {
    gringo("onPageRefreshed()");
    checkDecorations();
}

function isPageProbablyLoaded(): boolean {
    gringo("checking page loaded...");
    return document.querySelector("af-shellbar") != null;
}

function onMutation() {
    checkDecorations();
    return false;
}

function checkDecorations() {
    checkAndSetDecoration(document.querySelector("af-shellbar"), decorateTopBar);
}

export function decorateTopBar() {
    let shellbar_groups = document.querySelectorAll(".fd-shellbar__group") as NodeListOf<HTMLDivElement>;
    let first = shellbar_groups[0];
    let container = emmet.indent.appendChild(first, `
        div
            button.naked.topButton
                i.fa.fa-arrow-down
    `).first as HTMLButtonElement;
    let button = container.querySelector("button") as HTMLButtonElement;
    button.addEventListener("click", () => {
        let menu = new DropDownMenu(container, button, true, false);
        menu.addItem("Totalen", 0, async (ev) => {
            gringo("item 1 clicked");
            await sendRequest(Actions.OpenTotalsTab, TabType.Main, TabType.Undefined, undefined, "", "");
        });
        menu.addItem("item 2", 0, (ev) => {
            gringo("item 2 clicked");
        });
        menu.show();
    });
}
