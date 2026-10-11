import {getGlobalTags, PrMeta, saveMeta} from "./requests";
import {paintTag, updateTags} from "./observer";
import {emmet} from "../../libs/Emmeter";
import {getGlobalSettingsCached} from "../plugin_options/options";

export async function updateMetaFields(metaWrapper: HTMLElement, meta: PrMeta) {
    await updateTags(metaWrapper, meta);
    let select = metaWrapper.querySelector("div.projectWrapper select")! as HTMLSelectElement;
    if (meta.project)
        select.value = meta.project;
}

export async function onSelectProjectClick(meta: PrMeta, select: HTMLSelectElement) {
    meta.project = select.value;
    await saveMeta(meta.prId, meta, "localStorage and cloud");
}

export async function onTagButtonClick(meta: PrMeta, button: HTMLButtonElement, afterMetaChange: (meta: PrMeta) => Promise<any>) {
    let popover = document.getElementById("gringo-tags-popover") as HTMLElement;
    if (!popover)
        return;
    // @ts-ignore
    popover.togglePopover({source: button});
    let container = popover.querySelector(".popoverContainer") as HTMLUListElement;
    container.classList.add("tagList");
    container.innerHTML = "";
    let globalTags = await getGlobalTags();
    [...globalTags.values()]
        .sort((a, b) => a.order - b.order)
        .forEach(tagDef => {
            let tagButton = emmet.appendChild(container, `
                    button.naked.gringoTag{${tagDef.name}}
                `).first as HTMLButtonElement;
            paintTag(tagButton, tagDef, meta.tags.includes(tagDef.name));
            tagButton.onclick = async (ev) => {
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

export function addTagBlock(container: HTMLDivElement, meta: PrMeta) {
    emmet.indent.appendChild(container, `
        div.tagsWrapper.flexRow
            button.naked.tagButton
                li.far.fa-circle-down
            div.tagsContainer
    `);
    let button = container.querySelector("button.tagButton") as HTMLButtonElement;
    button.onclick = async () => {
        await onTagButtonClick(meta, button, async () => {
            await updateMetaFields(container, meta);
        });
    };
}

export async function addProjectBlock(container: HTMLDivElement, meta: PrMeta) {
    emmet.indent.appendChild(container, `
        div.projectWrapper.flexRow
            select
    `);
    let select = container.querySelector("select")!;
    let options = ["--selecteer--", ...(await getGlobalSettingsCached()).projects];
    for (let option of options) {
        let optionEl = document.createElement("option");
        optionEl.textContent = option;
        optionEl.value = option;
        select.appendChild(optionEl);
    }

    select.onchange = async (ev) => {
        await onSelectProjectClick(meta, select);
    }
}