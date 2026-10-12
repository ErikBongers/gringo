import {gringo} from "../globals";

export function scrapePRs() {
    gringo("Scraping...");
    let requestsDivs = document.querySelectorAll("request-info-item") as NodeListOf<HTMLElement>;
    let infos = [...requestsDivs].map(scrapeInfoItem);
    gringo(`Found ${infos.length} items.`);
    if (infos.length > 0)
        document.body.dataset.gringoPageScraped = "true";
    // globalPrs = infos;
    return infos;
}

export type RequestBasicInfo = {
    id: string,
    orderAnchors: HTMLAnchorElement[],
}

function scrapeInfoItem(requestDiv: HTMLElement): RequestBasicInfo {
    let id = requestDiv.id.substring("request-".length);
    let divOrders = requestDiv.querySelector(".item-orders");
    let orderAnchors: HTMLAnchorElement[] = [];
    if (divOrders) {
        orderAnchors = [...divOrders.querySelectorAll(".request-po-list-container ul > li a") as NodeListOf<HTMLAnchorElement>];
    }
    return {id, orderAnchors};
}