import {InfoBar} from "./infoBar";
import {ProgressBar} from "./progressBar";
import {emmet} from "../libs/Emmeter";

export interface InfoBlock {
    infoBar: InfoBar,
    progressBar: ProgressBar
}

export function getInfoBlock(parent: HTMLElement): InfoBlock {
    let infoBar = new InfoBar(parent);
    let progressBar = new ProgressBar(parent);
    return {infoBar, progressBar};
}


export function getInfoBlockForCurrentPage(): InfoBlock {
    let infoContainer = document.querySelector("div.infoContainer") as HTMLElement;
    if(!infoContainer)
        infoContainer = emmet.indent.insertAfter(document.getElementById("navigation")!, "div").first as HTMLElement;
    return getInfoBlock(infoContainer);
}