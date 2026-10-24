import {emmet} from "../../libs/Emmeter";
import {getGlobalTags, TagDef} from "./requests";
import {paintTag} from "../globals";
import {LocalDb} from "../db/idb/localDb";
import {Repository} from "../db/idb/repository";
import {createSearchField} from "../utils/searchField";
import {RowFilter} from "../filterTable";

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
                div.flexRow.centerV
                    span{Filter}
                    span.filterDesc.scale07
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
        button.w2ch.naked.greenBkg.white.squircle.solo.toggle{S}[title="Solo"]
    `).first as HTMLButtonElement;
    soloButton.addEventListener("click", () => {
        soloButton.classList.toggle("active");
        let solo = soloButton.classList.contains("active");
        saveTextFilter({text: getTextFilter().text, solo});
        applyFilters();
    });

    await updateSearchPanel();
    return tagsCollapse;
}

async function updateFilterDescription(tagFilters: TagsFilter[]) {
    let filterDescSpan = document.querySelector(".filterDesc") as HTMLSpanElement;
    filterDescSpan.innerText = "";
    filterDescSpan.appendChild(await tagFiltersToDesc(tagFilters));
}

async function updateSearchPanel() {
    let tagFilters = getTagsFilters();
    updateTagsFilters(tagFilters);
    updateTextFilter(getTextFilter());
    await updateFilterDescription(tagFilters);
}

async function tagFiltersToDesc(tagFilters: TagsFilter[]) {
    let wrapper = document.createElement("span");
    let globalTags = await getGlobalTags();
    for(let filter of tagFilters) {
        let tagSpan = wrapper.appendChild(document.createElement("span"));
        paintTag(tagSpan, globalTags.get(filter.name)!, true, filter.filterType == "!=");
    }
    return wrapper;
}

function updateTagsFilters(filters: TagsFilter[]) {
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

function updateTextFilter(filter: TextFilterDef) {
    let textFilterInput = document.getElementById("searchText") as HTMLInputElement;
    textFilterInput.classList.toggle("active", filter.solo);
    let soloButton = textFilterInput.closest(".searchTextWrapper")!.querySelector("button.solo")!;
    soloButton.classList.toggle("active", filter.solo);
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
    paintTag(tagSpan, tagDef, true, false);
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
        await updateFilterDescription(filters);
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

export function getTextFilter(): TextFilterDef {
    let text = localStorage.getItem('gringo.textFilter')??"";
    let solo = localStorage.getItem('gringo.textFilterSolo') == "true";
    if (!text)
        return {text, solo};
    return {text, solo};
}

function saveTagsFilters(tagsFilters: TagsFilter[]) {
    localStorage.setItem('gringo.tagsFilters', JSON.stringify(tagsFilters));
}

function saveTextFilter(textFilter: TextFilterDef) {
    localStorage.setItem('gringo.textFilter', textFilter.text);
    localStorage.setItem('gringo.textFilterSolo', textFilter.solo ? "true" : "false");
}

export function matchTags(selectedTags: string[], excludedTags: string[], tagString: string) {
    let hasAllSelectedTags = selectedTags.every(t => tagString.includes(t));
    if (!hasAllSelectedTags)
        return false;
    return excludedTags.every(t => !tagString.includes(t));
}

export type TextFilterDef = {
    text: string,
    solo: boolean
}

export type FilterDef = {
    textFilter: TextFilterDef,
    selectedTags: string[],
    excludedTags: string[]
}

export interface FilterContext {
    preparedFilterText: string,
    filterDef: FilterDef,
}

export interface PrRowType {
    rowText: string,
    tagString: string,
}

export function createRowFilter<SourceRow>(filterDef: FilterDef, rowConverter: (row: SourceRow) => PrRowType) {
    let textFilterContainsUpperCase = filterDef.textFilter.text != filterDef.textFilter.text.toLowerCase();
    let preparedFilterText = filterDef.textFilter.text;
    if(!textFilterContainsUpperCase)
        preparedFilterText = filterDef.textFilter.text.toLowerCase();
    let context: FilterContext = {
        preparedFilterText,
        filterDef,
    }
    let rowFilter;
    if (textFilterContainsUpperCase) {
        rowFilter = (row: PrRowType, ctx: FilterContext) => {
            return rowFilterFunc(row, ctx, row.rowText);
        }
    } else {
        rowFilter = (row: PrRowType, ctx: FilterContext) => {
            return rowFilterFunc(row, ctx, row.rowText.toLowerCase());
        }
    }
    let rowFilterDef: RowFilter<FilterContext, SourceRow, PrRowType> = {
        context,
        rowConverter,
        rowFilter
    }
    return rowFilterDef;
}

export function rowFilterFunc(row: PrRowType, ctx: FilterContext, rowText: string) {
    let matchingText = matchText(rowText, ctx.preparedFilterText);
    if (!matchingText)
        return false;
    if (ctx.filterDef.textFilter.solo && ctx.filterDef.textFilter.text)
        return matchingText;
    return matchTags(ctx.filterDef.selectedTags, ctx.filterDef.excludedTags, row.tagString);
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