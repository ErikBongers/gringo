import {cloud} from "../cloud";
import {GLOBAL_SETTINGS_FILENAME} from "../def";

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
}

let defaultGlobalSettings: GlobalSettings = {
    projects: []
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

