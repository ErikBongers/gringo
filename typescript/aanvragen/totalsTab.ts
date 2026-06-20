import {emmet} from "../../libs/Emmeter/html";
import {createInfoBlock, formatPrice} from "../globals";
import {getBudgetDscr, getExpenses, getItemsPerGroup, JsonPrItem} from "./aggregate";
import {displayMetaFields, displayTags, hideFloatingHelp, paintTag, updateMetaFields} from "./observer";
import {Tabs} from "../tabs";
import {getGlobalSettingsCached} from "../plugin_options/options";
import {fetchMetaCached, getGlobalTags, PrMeta, TagDef} from "./requests";
import {cloud} from "../cloud";
import {KEY_CLOUD_GRINGO_FOLDER} from "../def";
import {BudgetGrouping} from "../db/localStorage";
import storage from "../db/localStorage";


async function onRefreshClicked(ev: PointerEvent) {
    sessionStorage.removeItem("jsonPrData");
    await fillTotalsTab();
}

async function createProjectItemGroups(expenses: JsonPrItem[]) {
    let perProject = await getItemsPerGroup(expenses, async (item) => {
        let meta = await fetchMetaCached(item.prId);
        return meta.project ?? "";
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
            children: [],
        }
    });
    return projectItemGroups;
}

async function createBudgetItemGroups(expenses: JsonPrItem[]) {
    let perBudget = await getItemsPerGroup(expenses, async (item) => {
        return item.budget;
    }, []);
    let budgetItemGroups: PrItemGroup[] = [...perBudget.entries()].map((mappedItem) => {
        let groupId = mappedItem[0];
        let items = mappedItem[1];
        let dscr = groupId + " " + (getBudgetDscr(groupId) ?? "--geen omschrijving--");
        let total = items
            .map(i => i.bruto)
            .reduce((a, b) => a + b, 0);
        return {
            groupId,
            items,
            dscr: groupId == "" ? "--nog geen budget--" : dscr,
            total,
            children: [],
        }
    });
    return budgetItemGroups;
}

export async function fillTotalsTab() {
    hideFloatingHelp();
    let totalsTab = document.querySelector("div.gringo.totalsTab") as HTMLElement;
    totalsTab.innerHTML = "";
    emmet.appendChild(totalsTab, `
        (button.naked.refresh>i.fa.fa-repeat)+
        div.infoContainer+
        div.tabsContainer+
        div.popoversContainer
    `);
    let popoversContainer = totalsTab.querySelector("div.popoversContainer") as HTMLDivElement;
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
    let expenses = await getExpenses(infoBlock);
    expenses.sort((a, b) => a.budget.localeCompare(b.budget)); //todo: is this sort needed?

    infoBlock.info.innerHTML = "";

    let projectItemGroups = await createProjectItemGroups(expenses);
    await displayPerProject(tabPerProject, projectItemGroups);

    let budgetItemGroups = await createBudgetItemGroups(expenses);
    await displayPerBudget(tabPerBudget, budgetItemGroups);

    await createPopovers(popoversContainer, expenses);
    let cloudBudgets: CloudBudgets = {
        timestamp: (new Date()).toISOString(),
        perBudget: budgetItemGroups.map(group => {
            return {
                budget: group.groupId,
                grant: "todo!!!", //todo.
                total: group.total
            }
        }),
    };
    await cloud.json.upload(KEY_CLOUD_GRINGO_FOLDER + "expenses/Academie_Berchem_2026_expenses.json", cloudBudgets);
}

export interface BudgetLine {
    budget: string,
    grant: string,
    total: number,
}

export interface CloudBudgets {
    timestamp: string,
    perBudget: BudgetLine[]
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
        displayGroupedBlock(project, container);
    }
}

export interface PrItemGroup {
    groupId: string,
    dscr: string,
    total: number,
    items: JsonPrItem[],
    children: PrItemGroup[],
}

async function getGlobalTagsAndAndere() {
    let globalTags = await getGlobalTags();
    let alltags = structuredClone(globalTags);
    let andereTag: TagDef = {
        name: "(andere)",
        description: "",
        bkgColor: "",
        color: "",
        order: 9999
    }
    alltags.set(andereTag.name, andereTag);
    return alltags;
}

async function displayPerBudget(wrapper: HTMLElement, perBudget:  PrItemGroup[]) {
    emmet.appendChild(wrapper, `h2{Per Budget}`)
    let subGroupsCollapse = emmet.appendChild(wrapper, `
        details.subGroups>
            summary{Ondergroeperingen}+
            div.subGroupsContainer
    `).first as HTMLDetailsElement;
    //add checkboxes for tags
    //also add a checkbox for "--rest--"
    let subGroupsContainer = subGroupsCollapse.querySelector(".subGroupsContainer") as HTMLDivElement;
    let tbody = emmet.appendChild(subGroupsContainer,'table.budgetGroupings>tbody').last as HTMLTableSectionElement;
    let tagDefs = await getGlobalTagsAndAndere();
    [...tagDefs.values()]
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            createTagFilterRow(tbody, tagDef);
        });
    updateGroupingsFilters(storage.local.getBudgetSubGroupings());

    let container = emmet.appendChild(wrapper, "div.perProject").first as HTMLDivElement; //todo: rename css class?
    for(let itemGroup of perBudget) {
        displayGroupedBlock(itemGroup, container);
    }
}

function createTagFilterRow(tbody: HTMLTableSectionElement, tagDef: TagDef) {
    let tr = emmet.appendChild(tbody, `tr`).first as HTMLTableRowElement;
    tr.dataset.groupName = tagDef.name;
    emmet.appendChild(tr, `
                (td>span.naked.gringoTag{${tagDef.name}})+
                (td>button.naked.filter>(
                    span.equal{✔}+
                    span.empty{▢}
                    )
                )
            `);
    let tagSpan = tr.querySelector("span")!;
    paintTag(tagSpan, tagDef, true);
    let filterButton = tr.querySelector("button.filter") as HTMLButtonElement;
    filterButton.onclick = async (ev) => {
        let groupings = storage.local.getBudgetSubGroupings();
        let grouping = groupings.find(g => g.name == tagDef.name);
        if(!grouping) {
            let grouping: BudgetGrouping = {
                groupingType: "tag",
                name: tagDef.name
            }
            groupings.push(grouping);
        } else {
            groupings = groupings.filter(g => g.name != tagDef.name);
        }
        storage.local.saveBudgetSubGroupings(groupings);
        updateGroupingsFilters(groupings);
        //todo: update list.
    };
}

function updateGroupingsFilters(groupings: BudgetGrouping[]) {
    let table = document.querySelector("table.budgetGroupings") as HTMLTableElement;
    for(let tr of table.tBodies[0].rows) {
        let groupName = tr.dataset.groupName!;
        let group = groupings.find(g => g.name == groupName);
        let btnGroup = tr.querySelector("button.filter") as HTMLButtonElement; //todo: rename class to checkBox?
        btnGroup.classList.toggle("equal", !!group);
        btnGroup.classList.toggle("empty", !group);
    }
}

function displayGroupedBlock(itemGroup: PrItemGroup, container: HTMLElement) {
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
        displayItem(details, item);
    }

    let summaries = details.querySelectorAll(":scope > .summary") as NodeListOf<HTMLElement>;
    summaries.forEach(s => {
        s.onclick = () => {
            s.parentElement!.classList.toggle("open");
        };
    });
    for (let child of itemGroup.children) {
        displayGroupedBlock(child, details);
    }
}

function displayItem(details: HTMLDetailsElement, item: JsonPrItem) {
    let itemId = item.prId + "_" + item.itemNo;
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

/*
function displayBudgetLevel(container: HTMLElement, budgetLvl: BudgetLevel) {
    emmet.appendChild(container, `
        div.group.flexRow.w100.indent${budgetLvl.key.length}>(
            (
                span>(
                    span.lvl{${budgetLvl.key}}+
                    span.descr{${budgetLvl.descr}}
                )
            )+
            span.price{ todo:total price }
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
            span.price{${item.bruto}}
        )
    `);
    }
    budgetLvl.children.forEach(b => displayBudgetLevel(container, b));
}

*/