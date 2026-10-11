import {getGlobalTags, PrMeta, saveMeta} from "./requests";
import {paintTag} from "./observer";
import {emmet} from "../../libs/Emmeter";
import {getGlobalSettingsCached} from "../plugin_options/options";
import {addButtonClickNoPropagation, ElementOrSelector, getElement, showPopover} from "../globals";

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
            paintTag(tagButton, tagDef, meta.tags.includes(tagDef.name));
            tagButton.onclick = async () => {
                tagButton.classList.toggle("selected");
                let selected = tagButton.classList.contains("selected");
                if (selected)
                    meta.tags.push(tagDef.name);
                else
                    meta.tags = meta.tags.filter(t => t != tagDef.name);
                await saveMeta(meta.prId, meta, "localStorage and cloud");
                await afterMetaChange(meta);
            };
        });

}

export async function addTagsBlock(container: ElementOrSelector<HTMLDivElement>, meta: PrMeta) {
    container = getElement(container);
    emmet.indent.appendChild(container, `
        div.tagsWrapper.flexRow
            button.naked.tagsPopupButton
                li.far.fa-circle-down
            div.tagsContainer
    `);
    let button = container.querySelector("button.tagsPopupButton") as HTMLButtonElement;
    button.onclick = async () => {
        await onTagsPopupButtonClick(meta, button, async () => {
            await updateTagsBlock(container, meta);
        });
    };
    await updateTagsBlock(container, meta);
}

export async function addDepartmentBlock(container: ElementOrSelector<HTMLDivElement>, meta: PrMeta) {
    let wrapper = emmet.indent.appendChild(getElement(container), `
        div.deptWrapper.flexRow
            select
            span
    `).first as HTMLDivElement;
    let select = wrapper.querySelector("select")!;
    let options = [SELECT_PROJECT, ...(await getGlobalSettingsCached()).projects];
    for (let option of options) {
        let optionEl = document.createElement("option");
        optionEl.textContent = option;
        optionEl.value = option;
        select.appendChild(optionEl);
    }

    select.onchange = async () => {
        await onSelectDepartmentClick(meta, select);
    }
    updateDepartmentBlock(wrapper, meta);
}

const SELECT_PROJECT = "--selecteer--";

function updateDepartmentBlock(container: HTMLElement, meta: PrMeta) {
    let select = container.querySelector("select")! as HTMLSelectElement;
    let span = container.querySelector("span") as HTMLSpanElement;
    select.value = meta.project??SELECT_PROJECT;
    span.textContent = meta.project??SELECT_PROJECT;
    container.classList.toggle("hasProject", (meta.project??SELECT_PROJECT) != SELECT_PROJECT);
}

async function onSelectDepartmentClick(meta: PrMeta, select: HTMLSelectElement) {
    meta.project = select.value;
    await saveMeta(meta.prId, meta, "localStorage and cloud");
    updateDepartmentBlock(select.closest(".deptWrapper")!, meta);
}

async function displayTags(tagsContainer: HTMLElement, meta: PrMeta) {
    tagsContainer.innerHTML = "";
    let globalTagsMap = await getGlobalTags();
    meta.tags
        .map(tag => {
            return globalTagsMap.get(tag);
        })
        .filter(t => !!t)
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            let tagSpan = emmet.appendChild(tagsContainer, `
                span    
            `).first as HTMLSpanElement;
            paintTag(tagSpan, tagDef, true);
        });
    let orphans = meta.tags.filter(tag => ![...globalTagsMap.values()].find(tagDef => tagDef.name == tag));
    if (orphans.length > 0) {
        emmet.appendChild(tagsContainer, orphans.map(tag => `span.gringoTag{${tag}}`).join("+"));
    }
}

async function updateTagsBlock(metaWrapper: HTMLElement, meta: PrMeta) {
    let tagsContainer = metaWrapper.querySelector(".tagsContainer") as HTMLElement;
    await displayTags(tagsContainer, meta);
}

