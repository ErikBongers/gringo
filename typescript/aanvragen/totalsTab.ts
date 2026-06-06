import {emmet} from "../../libs/Emmeter/html";
import {createInfoBlock, formatPrice} from "../globals";
import {createJsonPrData, getBudgetDscr, getRequestsPerGroup, JsonPrData, JsonPrItem} from "./aggregate";
import {hideFloatingHelp} from "./observer";
import {Tabs} from "../tabs";
import {getGlobalSettingsCached} from "../plugin_options/options";

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
        .filter(item => item.budget != "" && item.budget.startsWith("6"));
    expenses.sort((a, b) => a.budget.localeCompare(b.budget));

    infoBlock.info.innerHTML = "";
    await displayPerProject(tabPerProject, expenses);
    displayPerBudget(tabPerBudget, expenses);
}

async function displayPerProject(wrapper: HTMLElement, expenses: JsonPrItem[]) {
    emmet.appendChild(wrapper, `h2{Per project}`)
    let perProject = getRequestsPerGroup(expenses, (item) => item.project, (await getGlobalSettingsCached()).projects);
    let container = emmet.appendChild(wrapper, "div.perProject").first as HTMLDivElement;
    for(let [project, requests] of perProject) {
        displayGroupedBlock(requests, container, project == "" ? "--nog geen project--" : project);
    }
}

function displayPerBudget(wrapper: HTMLElement, expenses: JsonPrItem[]) {
    emmet.appendChild(wrapper, `h2{Per Budget}`)
    let perBudget = getRequestsPerGroup(expenses, (item) => item.budget, []);
    let container = emmet.appendChild(wrapper, "div.perProject").first as HTMLDivElement; //todo: rename css class?
    for(let [budget, requests] of perBudget) {
        let budgetDscr = budget + " " + (getBudgetDscr(budget)?? "--geen omschrijving--");
        displayGroupedBlock(requests, container, budget == "" ? "--nog geen budget--" : budgetDscr);
    }
}

function displayGroupedBlock(requests: JsonPrItem[], container: HTMLDivElement, groupTitle: string) {
    let total = requests
        .map(i => i.bruto)
        .reduce((a, b) => a + b, 0);
    let details = emmet.appendChild(container, `
            div.details.midBlue>
                div.summary>
                    div.group.flexInline>(
                        (
                            span>(
                                span.dscr{${groupTitle}}
                            )
                        )+
                        span.price{${formatPrice(total)}}
                    )
        `).first as HTMLDetailsElement;
    for (let item of requests) {
        let row = emmet.appendChild(details, `
                div.item.flexRow.w100>(
                    (
                        span>(
                            span.lvl{${item.budget}}+
                            (button.goto.naked>i.fa.fa-home)+
                            span.descr{${item.title}}
                        )
                    )+
                    span.price{${formatPrice(item.bruto)}}
                )
            `).first as HTMLDivElement;
        let button = row.querySelector("button.goto") as HTMLButtonElement;
        button.title = item.prId + "\n" + item.tags;
        button.onclick = () => {
            window.open(`https://s1-eu.ariba.com/gb/viewRequisition/${item.prId}`, '_blank')!.focus();
        }
    }

    let summaries = container.querySelectorAll(".summary") as NodeListOf<HTMLElement>;
    summaries.forEach(s => {
        s.onclick = () => {
            s.parentElement!.classList.toggle("open");
        };
    })
}
