import {emmet} from "../../libs/Emmeter";
import {getGlobalTags, TagDef} from "./requests";
import {paintTag} from "../globals";
import {LocalDb} from "../db/idb/localDb";
import {Repository} from "../db/idb/repository";
import {createSearchField} from "../utils/searchField";

export type FilterType = "==" | "!=";

export interface TagsFilter {
    name: string,
    filterType: FilterType,
}

export async function createSearchPanel(divSearchPanel: HTMLDivElement, applyFilters: () => Promise<void>) {
    divSearchPanel.innerHTML = "";
    let tagsCollapse = emmet.indent.appendChild(divSearchPanel, `
        details
            summary
                div.flexRow
                    span{Filter}
                    div.flexRight.searchTextWrapper
            table#tagsFilterTable
                tbody
    `).first as HTMLDetailsElement;
    let tbody = tagsCollapse.querySelector("tbody") as HTMLTableSectionElement
    let globalTags = await getGlobalTags();
    [...globalTags.values()]
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            createTagFilterRow(tbody, tagDef, applyFilters);
        });
    let searchField = createSearchField("searchText", text => {
        let solo = soloButton.classList.contains("active");
        saveTextFilter({text, solo});
        applyFilters();
    }, getTextFilter().text);
    let searchWrapper = divSearchPanel.querySelector(".searchTextWrapper") as HTMLDivElement;
    searchWrapper.appendChild(searchField);
    let soloButton = emmet.indent.appendChild(searchWrapper, `
        button.w2ch.naked.greenBkg.white.solo.toggle{S}[title="Solo"]
    `).first as HTMLButtonElement;
    soloButton.addEventListener("click", () => {
        soloButton.classList.toggle("active");
        let solo = soloButton.classList.contains("active");
        saveTextFilter({text: getTextFilter().text, solo});
        applyFilters();
    });

    updateFilters();
    return tagsCollapse;
}

function updateFilters() {
    updateTagsFilters(getTagsFilters());
    saveTextFilter(getTextFilter());
}

export function updateTagsFilters(filters: TagsFilter[]) {
    let table = document.getElementById("tagsFilterTable") as HTMLTableElement;
    for (let tr of table.tBodies[0].rows) {
        let tagName = tr.dataset.tagName!;
        let filter = filters.find(f => f.name == tagName);
        let btnFilter = tr.querySelector("button.filter") as HTMLButtonElement;
        if (!filter) {
            btnFilter.classList.toggle("equal", false);
            btnFilter.classList.toggle("notEqual", false);
            btnFilter.classList.toggle("empty", true);
            continue;
        }
        btnFilter.classList.toggle("empty", false);
        btnFilter.classList.toggle("equal", filter.filterType == "==");
        btnFilter.classList.toggle("notEqual", filter.filterType == "!=");
    }
}

function createTagFilterRow(tbody: HTMLTableSectionElement, tagDef: TagDef, applyFilters: () => Promise<void>) {
    let tr = emmet.appendChild(tbody, `tr`).first as HTMLTableRowElement;
    tr.dataset.tagName = tagDef.name;
    emmet.appendChild(tr, `
                (td>span.naked.gringoTag{${tagDef.name}})+
                (td>button.naked.filter>(
                    span.equal{✔}+
                    span.notEqual{❌}+
                    span.empty{▢}
                    )
                )
            `);
    let tagSpan = tr.querySelector("span")!;
    paintTag(tagSpan, tagDef, true);
    let filterButton = tr.querySelector("button.filter") as HTMLButtonElement;
    filterButton.onclick = async () => {
        let filters = getTagsFilters();
        let filter = filters.find(t => t.name == tagDef.name);
        if (!filter) {
            let filter: TagsFilter = {
                name: tagDef.name,
                filterType: "=="
            }
            filters.push(filter);
        } else {
            if (filter.filterType == "==")
                filter.filterType = "!=";
            else
                filters = filters.filter(f => f.name != tagDef.name);
        }
        saveTagsFilters(filters);
        updateTagsFilters(filters);
        await applyFilters();
    };
}

//todo: combine all filters in one json.
export function getTagsFilters() {
    let json = localStorage.getItem('gringo.tagsFilters');
    if (!json)
        return [];
    return JSON.parse(json) as TagsFilter[];
}

export function getTextFilter() {
    let text = localStorage.getItem('gringo.textFilter')??"";
    let solo = localStorage.getItem('gringo.textFilterSolo') == "true";
    if (!text)
        return {text, solo};
    return {text, solo};
}

function saveTagsFilters(tagsFilters: TagsFilter[]) {
    localStorage.setItem('gringo.tagsFilters', JSON.stringify(tagsFilters));
}

function saveTextFilter(textFilter: {text: string, solo: boolean}) {
    localStorage.setItem('gringo.textFilter', textFilter.text);
    localStorage.setItem('gringo.textFilterSolo', textFilter.solo ? "true" : "false");
}

export function matchTags(selectedTags: string[], excludedTags: string[], tagString: string) {
    let hasAllSelectedTags = selectedTags.every(t => tagString.includes(t));
    if (!hasAllSelectedTags)
        return false;
    return excludedTags.every(t => !tagString.includes(t));
}

export type FilterDef = {
    textFilter: { text: string, solo: boolean },
    selectedTags: string[],
    excludedTags: string[]
}

export function rowFilter(text: string, filterDef: FilterDef, prMetas: Repository<LocalDb, "PrMetas">, tagsString: string) {
    let matchingText = matchText(text, filterDef.textFilter.text);
    if (!matchingText)
        return false;
    if (filterDef.textFilter.solo || !filterDef.textFilter.text)
        return matchingText;
    return matchTags(filterDef.selectedTags, filterDef.excludedTags, tagsString);
}

export function matchText(text: string, textFilter: string) {
    if (!textFilter)
        return true;
    return text.includes(textFilter);
}

export function getPrFilterStrings(): FilterDef {
    let tagsFilters = getTagsFilters();
    let textFilter = getTextFilter();
    let selectedTags = tagsFilters
        .filter(t => t.filterType == "==")
        .map(t => ";" + t.name + ";")
    ;
    let excludedTags = tagsFilters
        .filter(t => t.filterType == "!=")
        .map(t => ";" + t.name + ";")
    ;
    return {textFilter, selectedTags, excludedTags};
}