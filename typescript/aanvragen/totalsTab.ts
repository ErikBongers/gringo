import {emmet} from "../../libs/Emmeter/html";
import {createInfoBlock, formatPrice} from "../globals";
import {createJsonPrData, getRequestsPerGroup, JsonPrData, JsonPrItem} from "./aggregate";
import {hideFloatingHelp} from "./observer";
import {Tabs} from "../tabs";

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
    let perProject = await getRequestsPerGroup(expenses, (item) => item.project);
    let container = emmet.appendChild(wrapper, "div.perProject").first as HTMLDivElement;
    for(let [project, requests] of perProject) {
        displayProjectBlock(requests, container, project);
    }
}

function displayProjectBlock(requests: JsonPrItem[], container: HTMLDivElement, project: string) {
    let total = requests
        .map(i => i.bruto)
        .reduce((a, b) => a + b, 0);
    if(project == "")
        project = "--nog geen project--";
    let details = emmet.appendChild(container, `
            div.details.midBlue>
                div.summary>
                    div.group.flexInline>(
                        (
                            span>(
                                span.dscr{${project}}
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

function calcBudgetTotals(budgetLevel: BudgetLevel) {
    budgetLevel.price = budgetLevel.items.map(i => i.bruto).reduce((sum, price) => sum + price, 0);
    budgetLevel.children.forEach(c => calcBudgetTotals(c));
    for(let child of budgetLevel.children.values()) {
        budgetLevel.price += child.price;
    }
}

function displayPerBudget(container: HTMLElement, expenses: JsonPrItem[]) {
    let expensesRoot: BudgetLevel = {key: "6", descr: "Uitgaven", price: 0, children: new Map<string, BudgetLevel>(), items: []};
    for (const item of expenses) {
        insertLevel(expensesRoot, item, 1);
    }
    calcBudgetTotals(expensesRoot);
    emmet.appendChild(container, `h2{Per Budgetpost}`);
    displayBudgetLevel(container, expensesRoot);
}

function displayBudgetLevel(container: HTMLElement, budgetLvl: BudgetLevel) {
    let total = budgetLvl.items.map(i => i.bruto).reduce((sum, price) => sum + price, 0);
    emmet.appendChild(container, `
        div.group.flexRow.w100.indent${budgetLvl.key.length}>(
            (
                span>(
                    span.lvl{${budgetLvl.key}}+
                    span.descr{${budgetLvl.descr}}
                )
            )+
            span.price{${formatPrice(budgetLvl.price)}}
        )
    `);
    for(let item of budgetLvl.items) {
        emmet.appendChild(container, `
        div.item.flexRow.w100>(
            (
                span>(
                    span.lvl{${item.budget}}+
                    span.descr{${item.title}}+
                    span.status{${item.tags}}
                )
            )+
            span.price{${formatPrice(item.bruto)}}
        )
    `);
    }
    budgetLvl.children.forEach(b => displayBudgetLevel(container, b));
}

interface BudgetLevel {
    key: string;
    descr: string;
    price: number;
    children: Map<string, BudgetLevel>;
    items: JsonPrItem[];
}

function insertLevel(parent: BudgetLevel, item: JsonPrItem, level: number) {
    if(!item.budget)
        return; //todo: handle this instead of ignoring.
    let key = item.budget.substring(0, level+1);
    let remainder = item.budget.substring(level+1).replaceAll("0", "");
    if(remainder.length == 0) {
        parent.items.push(item);
        return;
    }
    let newParent: BudgetLevel;
    if(parent.children.has(key)) {
        newParent = parent.children.get(key)!;
    } else {
        newParent = {key, descr: "todo...", price: 0, children: new Map<string, BudgetLevel>(), items: []};
        parent.children.set(key, newParent);
    }
    insertLevel(newParent, item, level+1);
}

