import {emmet} from "../../libs/Emmeter";
import {fetchMetaCached, getGlobalTags, TagDef} from "./requests";

import {paintTag} from "../globals";

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
                    span{Tags}
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
    let searchField = createSearchField("searchText", ev => {
        saveTextFilter((ev.currentTarget as HTMLInputElement).value);
        applyFilters();
    }, getTextFilter());
    divSearchPanel.querySelector(".searchTextWrapper")!.appendChild(searchField);
    updateFilters();
    return tagsCollapse;
}

export function createSearchField(id: string, onSearchInput: (ev: Event) => any, value: string) {
    let input = document.createElement("input");
    input.type = "text";
    input.id = id;
    input.classList.add("tableFilter");
    input.oninput = onSearchInput;
    input.value = value;
    input.placeholder = "filter";
    let span = document.createElement("span");
    span.classList.add("searchButton");
    span.appendChild(input);
    let { first: clearButton } = emmet.indent.appendChild(span, `
        button.w2ch.naked
            img[src="${chrome.runtime.getURL("images/circle-xmark-regular.svg")}"]
    `);
    (clearButton as HTMLElement).onclick = () => {
        input.value = "";
        input.dispatchEvent(new Event("input"));
        input.focus();
    };
    return span;
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
    let text = localStorage.getItem('gringo.textFilter');
    if (!text)
        return "";
    return text;
}

function saveTagsFilters(tagsFilters: TagsFilter[]) {
    localStorage.setItem('gringo.tagsFilters', JSON.stringify(tagsFilters));
}

function saveTextFilter(textFilter: string) {
    localStorage.setItem('gringo.textFilter', textFilter);
}

export async function matchTags(prId: string, selectedTags: TagsFilter[], excludedTags: TagsFilter[]) {
    let meta = await fetchMetaCached(prId);
    let hasAllSelectedTags = selectedTags.every(t => meta.tags.includes(t.name));
    let hasNoExcludedTags = excludedTags.every(t => !meta.tags.includes(t.name));
    return hasAllSelectedTags && hasNoExcludedTags;
}