import {NavigatableList} from "./navigatableList";
import {emmet} from "../../libs/Emmeter";

/*
##  Construct menus as follows:
    div : container for menu
        >button : button to open/close menu
     >>> dropdown menu will be added below this button.

## Setup after call to setupMenu():
    div.dropDownContainer
        >button.dropDownButton.dropDownIgnoreHide
        >div.dropDownMenu
            button.dropDownItem
            div.dropDownItem
            ...
 */

export type CancelDropDown = (ev: MouseEvent) => boolean | Promise<boolean>;

export class DropDownMenu {
    readonly menu: HTMLElement;
    private readonly container: HTMLElement;
    private button: HTMLElement;
    public cancelDropDown: CancelDropDown | undefined;
    private list: NavigatableList;
    private readonly fullRefreshAfterClose: boolean;
    private readonly abortController: AbortController | undefined;

    //todo: merge button and showOnClick by making button nullable.
    constructor(container: HTMLElement, button: HTMLElement, showOnClick: boolean = true, fullRefreshAfterClose: boolean = false, abortController?: AbortController) {
        this.container = container;
        this.button = button;
        this.fullRefreshAfterClose = fullRefreshAfterClose;
        this.abortController = abortController;
        this.container.classList.add("dropDownContainer");
        this.button.classList.add("dropDownIgnoreHide", "dropDownButton");
        //remove previous drop down menus
        this.container.querySelectorAll("div.dropDownMenu").forEach(el => el.remove());
        let {first} = emmet.appendChild(this.container as HTMLElement, "div.dropDownMenu.popoverMenu");
        this.menu = first as HTMLElement;
        this.menu.setAttribute("popover", "");
        this.menu.addEventListener("toggle", async ev => {
            console.log("toggle", ev.newState);
            if (ev.newState != "open") {
                this.abortController?.abort()
            }
        });
        this.list = new NavigatableList(this.menu, this.abortController);
        if (showOnClick) {
            this.button.onclick = async ev => {
                ev.preventDefault();
                ev.stopPropagation();
                if (await this.cancelDropDown?.(ev))
                    return;
                this.show();
            }
        }
        this.list.addOnClickListener(index => this.hide());
    }

    addItem(title: string | HTMLElement, indentLevel: number, onClick: ((ev: MouseEvent) => void) | string) {
        return this.list.addItem(title, indentLevel, onClick);
    }

    addSeparator(title: string | HTMLElement, indentLevel: number) {
        this.list.addSeparator(title, indentLevel);
    }

    addInfo(info: HTMLElement | string, indentLevel: number) {
        this.list.addInfo(info, indentLevel);
    }

    setItemContent(index: number, title: string | HTMLElement) {
        this.list.setItemContent(index, title);
    }

    clickItem(itemIndex: number) {
        this.list.clickItem(itemIndex);
    }

    removeItem(index: number) {
        this.list.removeItem(index);
    }

    removeAllItems() {
        this.list.removeAllItems();
    }

    setPosition(position: "left" | "right") {
        if(position === "left")
            this.container.classList.add("shiftMenuLeft");
        else
            this.container.classList.remove("shiftMenuLeft");
    }

    show() {
        console.log("show");
        document.querySelectorAll(".activePopoverButton").forEach(p => p.classList.remove("activePopoverButton"));
        this.button.classList.add("activePopoverButton");
        this.menu.showPopover();
        setTimeout(() => {
            this.list.focus(); //todo: needed?
        });
    }

    hide() {
        this.menu.hidePopover();
    }

    async remove() {
        this.list.remove();
        this.menu.remove();
    }
}
