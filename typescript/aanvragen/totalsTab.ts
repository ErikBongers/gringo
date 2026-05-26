import {emmet} from "../../libs/Emmeter/html";
import { createInfoBlock } from "../globals";
import {ExpandedPrItem} from "../aanvraag/observer";
import {createJsonPrData, getExtendedRequests, JsonPrData, JsonPrItem} from "./aggregate";

export async function fillTotalsTab() {
    let container = document.querySelector("div.gringo.totalsTab") as HTMLElement;
    container.innerHTML = "";
    let infoBlock = createInfoBlock(container);
    infoBlock.title.textContent = "Totals";
    infoBlock.info.textContent = "Filling totals....";

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
        jsonPrData = await createJsonPrData();
        sessionStorage.setItem("jsonPrData", JSON.stringify(jsonPrData));
    }
    let expenses = jsonPrData.items
        .filter(item => !["In aanmaak", "Afgewezen"].includes(item.status))
        .filter(item => item.budget != "" && item.budget.startsWith("6"));
    expenses.sort((a, b) => a.budget.localeCompare(b.budget));

    // 666 = expenses:
    let expensesRoot: BudgetLevel = {key: "6", descr: "Uitgaven", price: 0, children: new Map<string, BudgetLevel>(), items: []};
    for (const item of expenses) {
        insertItem(expensesRoot, item, 1);
    }
    displayBudgetLevel(container, expensesRoot);
}

function displayBudgetLevel(container: HTMLElement, budgetLvl: BudgetLevel) {
    emmet.appendChild(container, `
        div.group.flexRow.w100>(
            span>(
                span.lvl{${budgetLvl.key}}+
                span.descr{${budgetLvl.descr}}
            )+
            span.price{ todo:total price }
        )
    `);
    for(let item of budgetLvl.items) {
        emmet.appendChild(container, `
        div.item.flexRow.w100>(
            span>(
                span.lvl{${item.budget}}+
                span.descr{${item.title}}+
                span.status{${item.tags}}
            )+
            span.price{${item.bruto}}
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

function insertItem(parent: BudgetLevel, item: JsonPrItem, level: number) {
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
        newParent = {key, descr: remainder, price: 0, children: new Map<string, BudgetLevel>(), items: []};
        parent.children.set(key, newParent);
    }
    insertItem(newParent, item, level+1);
}
