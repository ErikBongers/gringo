import {cloud} from "../cloud";
import {GLOBAL_SETTINGS_FILENAME} from "../def";
import {TagDef} from "../aanvragen/requests";

export type Options = {
    showDebug: boolean;
};

export const options: Options = {
    showDebug: false,
};

export function defineHtmlOptions() {
    defineHtmlOption("showDebug", 'checked', "Show debug info in console.", "block3");
}

type OptionDef = {
    id: string,
    property: string,
    label: string,
    blockId: string
}

export let htmlOptionDefs = new Map<string, OptionDef>();

export function defineHtmlOption(id: string, property: string, label: string, blockId: string) {
    htmlOptionDefs.set(id, {id, property, label, blockId});

}

export interface GlobalSettings {
    projects: string[];
    tagDefs: TagDef[];
}

const defaultTags: TagDef[] = [
    { name: "BB>", description: "Bestelbon verzonden", color: "", bkgColor: "orange", order: 0},
    { name: "✔", description: "Bestelling ontvangen", color: "green", bkgColor: "", order: 100},
    // { name: "MW", description: "", color: "", bkgColor: "", order: 300},
    // { name: "BK", description: "", color: "", bkgColor: "", order: 301},
    // { name: "brol", description: "", color: "", bkgColor: "", order: 330},
    // { name: "Zever", description: "", color: "blue", bkgColor: "", order: 390},
    // { name: "En", description: "", color: "blue", bkgColor: "", order: 400},
    // { name: "Nog", description: "", color: "blue", bkgColor: "", order: 500},
    // { name: "Veel", description: "", color: "blue", bkgColor: "", order: 600},
    // { name: "Langerx", description: "", color: "blue", bkgColor: "", order: 700},
];


let defaultGlobalSettings: GlobalSettings = {
    projects: [],
    tagDefs: structuredClone(defaultTags),
}

let globalSettings: GlobalSettings | null = null;
export async function getGlobalSettingsCached() {
    if(globalSettings)
        return globalSettings;
    return await fetchGlobalSettings();
}

export function setGlobalSetting(settings: GlobalSettings) {
    globalSettings = settings;
}

export async function saveGlobalSettings(globalSettings: GlobalSettings) {
    return cloud.json.upload(GLOBAL_SETTINGS_FILENAME, globalSettings);
}

export async function fetchGlobalSettings() {
    return await cloud.json.fetch(GLOBAL_SETTINGS_FILENAME)
        .catch(err => {
            console.log(err);
            return defaultGlobalSettings;
        }) as GlobalSettings;
}

