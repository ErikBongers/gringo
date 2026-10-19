import {getGlobalTags, PrMeta, saveMeta, TagDef} from "./requests";
import {emmet} from "../../libs/Emmeter";
import {getGlobalSettingsCached} from "../plugin_options/options";
import {addButtonClickNoPropagation, ElementOrSelector, getElement, paintTag, showPopover} from "../globals";

async function onTagsPopupButtonClick(meta: PrMeta, button: HTMLButtonElement, afterMetaChange: (meta: PrMeta) => Promise<any>) {
    let popover = showPopover("gringo-tags-popover", button);
    popover.innerHTML = "";
    emmet.indent.appendChild(popover, `
            div.flexRow
                button.closePopup.naked{x}
            div.popoverContainer
    `);
    let closeButton = popover.querySelector("button.closePopup") as HTMLButtonElement;
    addButtonClickNoPropagation(closeButton as HTMLButtonElement, (ev) => {
        let popover = document.getElementById("gringo-tags-popover") as HTMLElement;
        if(!popover)
            return;
        // @ts-ignore
        popover.togglePopover({source:button});
    });


    let container = popover.querySelector(".popoverContainer") as HTMLUListElement;
    container.classList.add("tagList");
    let globalTags = await getGlobalTags();
    [...globalTags.values()]
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            let tagButton = emmet.appendChild(container, `
                    button.naked.gringoTag{${tagDef.name}}
                `).first as HTMLButtonElement;
            paintTag(tagButton, tagDef, meta.tags.includes(tagDef.name), false);
            tagButton.onclick = async () => {
                tagButton.classList.toggle("selected");
                let selected = tagButton.classList.contains("selected");
                if (selected)
                    meta.tags.push(tagDef.name);
                else
                    meta.tags = meta.tags.filter(t => t != tagDef.name);
                await saveMeta(meta);
                await afterMetaChange(meta);
            };
        });

}

let templateTagsBlock: HTMLElement | null = null

export function addTagsBlock(container: ElementOrSelector<HTMLDivElement>, meta: PrMeta, tagsMap: Map<string, TagDef>, onMetaChange: (meta: PrMeta)=> void) {
    container = getElement(container);
    if (!templateTagsBlock) {
        templateTagsBlock = emmet.indent.createElement(`
            div.tagsWrapper.flexRow
                button.naked.tagsPopupButton
                    li.far.fa-circle-down
                div.tagsContainer
        `);
    }
    let clone = templateTagsBlock.cloneNode(true) as HTMLElement;
    container.appendChild(clone);
    let button = container.querySelector("button.tagsPopupButton") as HTMLButtonElement;
    button.onclick = async () => {
        await onTagsPopupButtonClick(meta, button, async () => {
            updateTagsBlock(container, meta, tagsMap, onMetaChange);
        });
    };
    updateTagsBlock(container, meta, tagsMap, onMetaChange);
}

export function addDepartmentBlock(container: ElementOrSelector<HTMLDivElement>, meta: PrMeta, departments: string[], onMetaChange: (meta: PrMeta)=> void) {
    container = getElement(container);
    let wrapper = emmet.indent.appendChild(container, `
        div.deptWrapper.flexRow
    `).first as HTMLElement;
    updateDepartmentBlock(wrapper, meta, departments);
}


function updateDepartmentBlock(wrapper: HTMLElement, meta: PrMeta, departments: string[]) {
    wrapper.innerHTML = "";
    let project = meta.project??SELECT_PROJECT;
    if(project == SELECT_PROJECT) {
        let select = cloneDeptSelectTemplate(departments);
        wrapper.appendChild(select);
        select.value = meta.project??SELECT_PROJECT;
        select.onchange = async () => {
            await onSelectDepartmentClick(meta, select, departments);
        }
    } else {
        emmet.appendChild(wrapper, `
            span{${meta.project}}
        `);
    }
    wrapper.classList.toggle("hasProject", project != SELECT_PROJECT);
}

let templateDeptSelect: HTMLSelectElement | null = null
const SELECT_PROJECT = "--selecteer--";

function cloneDeptSelectTemplate(departments: string[]) {
    if(!templateDeptSelect) {
        templateDeptSelect = document.createElement("select");
        let options = [SELECT_PROJECT, ...departments];
        for (let option of options) {
            let optionEl = document.createElement("option");
            optionEl.textContent = option;
            optionEl.value = option;
            templateDeptSelect.appendChild(optionEl);
        }
    }
    return templateDeptSelect.cloneNode(true) as HTMLSelectElement;
}

async function onSelectDepartmentClick(meta: PrMeta, select: HTMLSelectElement, departments: string[]) {
    meta.project = select.value;
    await saveMeta(meta);
    updateDepartmentBlock(select.closest(".deptWrapper")!, meta, departments);
}

function displayTags(tagsContainer: HTMLElement, meta: PrMeta, tagsMap: Map<string, TagDef>) {
    tagsContainer.innerHTML = "";
    meta.tags
        .map(tag => {
            return tagsMap.get(tag);
        })
        .filter(t => !!t)
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            let tagSpan = emmet.appendChild(tagsContainer, `
                span    
            `).first as HTMLSpanElement;
            paintTag(tagSpan, tagDef, true, false);
        });
    let orphans = meta.tags.filter(tag => ![...tagsMap.values()].find(tagDef => tagDef.name == tag));
    if (orphans.length > 0) {
        emmet.appendChild(tagsContainer, orphans.map(tag => `span.gringoTag{${tag}}`).join("+"));
    }
}

function updateTagsBlock(metaWrapper: HTMLElement, meta: PrMeta, tagsMap: Map<string, TagDef>, onMetaChange: (meta: PrMeta)=> void) {
    let tagsContainer = metaWrapper.querySelector(".tagsContainer") as HTMLElement;
    displayTags(tagsContainer, meta, tagsMap);
    onMetaChange(meta);
}

export function displayMetaFields(container: HTMLDivElement, meta: PrMeta, departments: string[], tagsMap: Map<string, TagDef>, onMetaChange: (meta: PrMeta)=> void) {
    let metaWrapper = emmet.indent.appendChild(container, `div.metaWrapper`).first as HTMLDivElement;
    addTagsBlock(metaWrapper, meta, tagsMap, onMetaChange);
    addDepartmentBlock(metaWrapper, meta, departments, onMetaChange);
    return metaWrapper;
}