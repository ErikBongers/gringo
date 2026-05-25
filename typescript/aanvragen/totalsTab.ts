import {emmet} from "../../libs/Emmeter/html";
import { createInfoBlock } from "../globals";
import {ExpandedPrItem} from "../aanvraag/observer";
import { getExtendedRequests } from "./aggregate";

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
    let expensesRoot: BudgetLevel = {key: "6", descr: "Uitgaven", price: 0, children: new Map<string, BudgetLevel>(), items: []};
    let prs = await getExtendedRequests();
    let expenses = prs
        .flatMap(p => p.items)
        .filter(item => item.budget != null && item.budget.budget.startsWith("6"));
    for (const item of expenses) {
        insertItem(expensesRoot, item, 1);
    }
}

interface BudgetLevel {
    key: string;
    descr: string;
    price: number;
    children: Map<string, BudgetLevel>;
    items: ExpandedPrItem[];
}

function insertItem(parent: BudgetLevel, item: ExpandedPrItem, level: number) {
    if(!item.budget)
        return; //todo: handle this instead of ignoring.
    let key = item.budget.budget.substring(0, level+1);
    let remainder = item.budget.budget.substring(level+1).replaceAll("0", "");
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
