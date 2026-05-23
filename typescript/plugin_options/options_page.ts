import {emmet} from "../../libs/Emmeter/html";
import {defineHtmlOptions, fetchGlobalSettings, getGlobalSettingsCached, GlobalSettings, htmlOptionDefs, options, saveGlobalSettings, setGlobalSetting} from "./options";

defineHtmlOptions();

const saveOptionsFromGui = () => {
    let newOptions = {
        touched: Date.now() // needed to trigger the storage changed event.
    };
    for (let option of htmlOptionDefs.values()) {
        // @ts-ignore
        newOptions[option.id] = document.getElementById(option.id)[option.property];

    }
    // @ts-ignore
    chrome.storage.sync.set(
        newOptions, () => {
            // Update status to let user know options were saved.
            const status = document.getElementById('status')!;
            status.textContent = 'Opties bewaard.';
            setTimeout(() => {
                status.textContent = '';
            }, 750);
        }
    );

};

async function saveGlobalsFromGui() {
    let answer = prompt("Zijdezeker? Tik dan GRINGO en klik Ok.");
    if(answer != "GRINGO")
        return;
    console.log("SAVING GLOBALS");
    let txtProjects =  document.getElementById("txtProjects") as HTMLTextAreaElement;
    let projects = txtProjects.value
        .split("\n")
        .map(l => l.trim())
        .filter(l => l != "");
    let globalSettings: GlobalSettings = {
        projects
    }

    await saveGlobalSettings(globalSettings);
}

async function restoreOptionsToGui(){
    let items = await chrome.storage.sync.get(null); //get all
    Object.assign(options, items);
    for (const [key, value] of Object.entries(options)) {
        let optionDef = htmlOptionDefs.get(key);
        if(!optionDef)
            continue; //no GUI for this option.
        // @ts-ignore
        document.getElementById(optionDef.id)[optionDef.property] = value;
    }
}

async function fillGlobalOptionsInGui() {
    let txtProjects =  document.getElementById("txtProjects") as HTMLTextAreaElement;
    setGlobalSetting(await fetchGlobalSettings());
    let globalSettings = await getGlobalSettingsCached();
    txtProjects.value = globalSettings.projects.join("\n");
}

async function fillOptionsInGui() {
    for(let optiondDef of htmlOptionDefs.values()){
        if(!optiondDef.blockId)
            continue;
        let block = document.getElementById(optiondDef.blockId)!;
        emmet.appendChild(block, `label>input#${optiondDef.id}[type="checkbox"]+{${optiondDef.label}}`);
    }
    await restoreOptionsToGui();
    await fillGlobalOptionsInGui();
}


document.addEventListener('DOMContentLoaded', fillOptionsInGui);
document.getElementById('save')!.addEventListener('click', saveOptionsFromGui);
document.getElementById('btnSaveGlobal')!.addEventListener('click', saveGlobalsFromGui);