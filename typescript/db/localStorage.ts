export interface BudgetGrouping {
    groupingType: "tag" | "project";
    name: string;
}

function getBudgetSubGroupings() {
    let groupings =  localStorage.getItem("budgetSubGroupings");
    if(!groupings)
        return [];
    return JSON.parse(groupings) as BudgetGrouping[];
}

function saveBudgetSubGroupings(groupings: BudgetGrouping[]) {
    localStorage.setItem("budgetSubGroupings", JSON.stringify(groupings));
}

export default {
    local: {
        getBudgetSubGroupings,
        saveBudgetSubGroupings,
    }
};
