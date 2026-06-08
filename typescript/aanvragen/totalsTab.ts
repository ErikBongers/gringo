import {emmet} from "../../libs/Emmeter/html";
import {createInfoBlock, formatPrice} from "../globals";
import {createJsonPrData, getBudgetDscr, getRequestsPerGroup, JsonPrData, JsonPrItem} from "./aggregate";
import {displayMetaFields, displayTags, hideFloatingHelp, updateMetaFields} from "./observer";
import {Tabs} from "../tabs";
import {getGlobalSettingsCached} from "../plugin_options/options";
import {getMetaLocal} from "../db/gringoDb";
import {fetchMetaCached, PrMeta} from "./requests";
import {cloud} from "../cloud";
import {KEY_CLOUD_GRINGO_FOLDER} from "../def";

async function onRefreshClicked(ev: PointerEvent) {
    sessionStorage.removeItem("jsonPrData");
    await fillTotalsTab();
}

export async function fillTotalsTab() {
    hideFloatingHelp();
    let totalsTab = document.querySelector("div.gringo.totalsTab") as HTMLElement;
    totalsTab.innerHTML = "";
    emmet.appendChild(totalsTab, `
        (button.naked.refresh>i.fa.fa-repeat)+
        div.infoContainer+
        div.tabsContainer
    `);
    let button = totalsTab.querySelector("button.refresh") as HTMLButtonElement;
    button.onclick = (ev) => onRefreshClicked(ev);
    let infoContainer = totalsTab.querySelector("div.infoContainer") as HTMLElement;
    let tabsContainer = totalsTab.querySelector("div.tabsContainer") as HTMLElement;
    let infoBlock = createInfoBlock(infoContainer);
    infoBlock.title.textContent = "Totalen";
    infoBlock.info.textContent = "Ophalen van gegevens....";
    emmet.appendChild(tabsContainer, `
        div.perProjectTab+div.perBudgetTab
    `);
    let tabs = new Tabs(tabsContainer, [
        { btnId: "btnTabPerProject", tabId: "tabPerProject", btnContent: "Per project"},
        { btnId: "btnTabPerBudget", tabId: "tabPerBudget", btnContent: "Per budget"},
    ]);
    emmet.appendChild(tabsContainer, `
        div#tabPerProject+
        div#tabPerBudget
    `);
    let tabPerProject = tabsContainer.querySelector("div#tabPerProject") as HTMLElement;
    let tabPerBudget = tabsContainer.querySelector("div#tabPerBudget") as HTMLElement;
    tabs.switch(0);
    //create a block "Uitgaven" for the 6xx ledgers.
    //On top have a Grand total
    //Below for the first digit, and so on.
    //Every level expandable
    //Expansion is saved.
    //Every row is a flexRow, with the last column (price) at a fixed distance (not influenced by indent).

    //Do aggregation per level.
    // 6 : descr : price
    // 61 : descr : price
    // 611 : descr : price
    //this is a tree structure.
    //for every item, drill down the tree and insert it at the deepest level.
    let jsonPrData: JsonPrData;
    let jsonPrDataStr = sessionStorage.getItem("jsonPrData");
    if(jsonPrDataStr) {
        jsonPrData = JSON.parse(jsonPrDataStr) as JsonPrData;
    } else {
        jsonPrData = await createJsonPrData(infoBlock);
        sessionStorage.setItem("jsonPrData", JSON.stringify(jsonPrData));
    }
    let expenses = jsonPrData.items
        .filter(item => !["In aanmaak", "Afgewezen"].includes(item.status))
        .filter(item => {
            return item.budget != ""
                && ( item.budget.startsWith("6")
                    || item.budget.startsWith("2")
                );
        });
    expenses.sort((a, b) => a.budget.localeCompare(b.budget));

    infoBlock.info.innerHTML = "";
    let perProject = await getRequestsPerGroup(expenses, async (item) => {
        let meta = await fetchMetaCached(item.prId);
        return meta.project??"";
    }, (await getGlobalSettingsCached()).projects);

    let projectItemGroups: PrItemGroup[] = [...perProject.entries()].map((mappedItem) => {
        let groupId = mappedItem[0];
        let items = mappedItem[1];
        let dscr = groupId;
        let total = items
            .map(i => i.bruto)
            .reduce((a, b) => a + b, 0);
        return {
            groupId,
            items,
            dscr: groupId == "" ? "--nog geen project--" : dscr,
            total,
        }
    });

    await displayPerProject(tabPerProject, projectItemGroups);
    let perBudget = await getRequestsPerGroup(expenses, async (item) => {
        return item.budget;
    }, []);
    let cloudBudgets = {
        timestamp: (new Date()).toISOString(),
        perBudget,
    };
    await cloud.json.upload(KEY_CLOUD_GRINGO_FOLDER + "expenses/Academie_Berchem_2026_expenses.json", cloudBudgets);
    let budgetItemGroups: PrItemGroup[] = [...perBudget.entries()].map((mappedItem) => {
        let groupId = mappedItem[0];
        let  items = mappedItem[1];
        let dscr = groupId + " " + (getBudgetDscr(groupId)?? "--geen omschrijving--");
        let total = items
            .map(i => i.bruto)
            .reduce((a, b) => a + b, 0);
        return {
            groupId,
            items,
            dscr: groupId == "" ? "--nog geen budget--" : dscr,
            total,
        }
    });
    await displayPerBudget(tabPerBudget, budgetItemGroups);
    let popoversContainer = emmet.appendChild(totalsTab, "div.popoversContainer").first as HTMLDivElement;
    await createPopovers(popoversContainer, expenses);
}

async function createPopovers(popoversContainer: HTMLDivElement, expenses: JsonPrItem[]) {
    for(let item of expenses) {
        let meta = await fetchMetaCached(item.prId);
        let itemId = item.prId + "_" + item.itemNo;
        let popover = emmet.appendChild(popoversContainer, `
            div#popover${itemId}.gringoPopover[popover="" style="position-anchor: --anchor${itemId};"]>(
                div.content>(
                    button.naked.goto{${item.prId}}+
                    div{budget:${item.budget}}+
                    div.tagsContainer+
                    div.metaFieldsContainer
                )
            )
        `).first as HTMLDivElement;
        let button = popover.querySelector("button.goto") as HTMLButtonElement;
        button.onclick = () => {
            window.open(`https://s1-eu.ariba.com/gb/viewRequisition/${item.prId}`, '_blank')!.focus();
        };
        let metaFieldsContainer = popover.querySelector(".metaFieldsContainer") as HTMLDivElement;
        await displayMetaFields(metaFieldsContainer, meta, async (meta) => {
            await updateRelatedItemPopover(item.prId, meta);
        });
        await updateMetaFields(popover, meta);
    }
}

async function displayPerProject(wrapper: HTMLElement, perProject: PrItemGroup[]) {
    emmet.appendChild(wrapper, `h2{Per project}`)
    let container = emmet.appendChild(wrapper, "div.perProject").first as HTMLDivElement;
    for(let project of perProject) {
        await displayGroupedBlock(project, container);
    }
}

export interface PrItemGroup {
    groupId: string,
    dscr: string,
    total: number,
    items: JsonPrItem[]
}

async function displayPerBudget(wrapper: HTMLElement, perBudget:  PrItemGroup[]) {
    emmet.appendChild(wrapper, `h2{Per Budget}`)
    let container = emmet.appendChild(wrapper, "div.perProject").first as HTMLDivElement; //todo: rename css class?
    for(let itemGroup of perBudget) {
        await displayGroupedBlock(itemGroup, container);
    }
}

async function displayGroupedBlock(itemGroup: PrItemGroup, container: HTMLDivElement) {
    let details = emmet.appendChild(container, `
            div.details.midBlue>
                div.summary>
                    div.group.flexInline>(
                        (
                            span>(
                                span.dscr{${itemGroup.dscr}}
                            )
                        )+
                        span.price{${formatPrice(itemGroup.total)}}
                    )
        `).first as HTMLDetailsElement;
    itemGroup.items.sort((a,b) => a.prId.localeCompare(b.prId));
    for (let item of itemGroup.items) {
        await displayItem(details, item);
    }

    let summaries = container.querySelectorAll(".summary") as NodeListOf<HTMLElement>;
    summaries.forEach(s => {
        s.onclick = () => {
            s.parentElement!.classList.toggle("open");
        };
    })
}

async function displayItem(details: HTMLDetailsElement, item: JsonPrItem) {
    let itemId = item.prId + "_" + item.itemNo;
    let meta = await fetchMetaCached(item.prId);
    let row = emmet.appendChild(details, `
        div.item.flexRow.w100>(
            (
                span>(
                    (
                        button.naked.midBlueText[popovertarget="popover${itemId}" style="anchor-name: --anchor${itemId};"]{${item.prId}}
                    )+
                    span.descr{${item.title}}
                )
            )+
            span.price{${formatPrice(item.bruto)}}
        )
    `).first as HTMLDivElement;
}

async function updatePopover(popover: any, meta: PrMeta) {
    let tagsContainer = popover.querySelector(".tagsContainer") as HTMLDivElement;
    await displayTags(tagsContainer, meta);
}

async function updateRelatedItemPopover(prId: string, meta: PrMeta) {
    let popovers = document.querySelectorAll("div.totalsTab div.item div.gringoPopover") as NodeListOf<HTMLDivElement>;
    for (let popover of [...popovers].filter(p => p.id.includes("popover" + prId))) {
        await updatePopover(popover, meta);
    }
}