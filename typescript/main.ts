import {equals, getOptions, observers, registerObserver, settingsObservers} from "./globals";
import {fetchGlobalSettings, setGlobalSetting} from "./plugin_options/options";
import aanvragenObserver from "./aanvragen/observer";
import aanvraagObserver from "./aanvraag/observer";

init();

// noinspection JSUnusedGlobalSymbols
function init() {
    getOptions()
        .then(() => {
        // @ts-ignore
        chrome.storage.onChanged.addListener((_changes: any, area: string) => {
            if (area === 'sync') {
                getOptions().then(_r => {
                    onSettingsChanged();
                });
            }
        });

        // @ts-ignore
        window.navigation.addEventListener("navigatesuccess", () => {
            onPageChanged();
        });

        //do registrations here to get all these observers/pages into the same compilation unit.
        registerObserver(aanvragenObserver);
        registerObserver(aanvraagObserver);

        onPageChanged();
        if(document.readyState == "complete") {
            console.log("document ready. firing onPageRefreshed.");
            onPageRefreshed();
        }
        else {
            window.addEventListener("load", () => {
                console.log("load event fired.");
                onPageRefreshed();
            });
        }
    });
}

let lastCheckTime = Date.now();
function onSettingsChanged() {
    console.log("on settings changed.");
    for(let observer of settingsObservers) {
        observer();
    }
}

function onPageChanged() {
    for(let observer of observers) {
        observer.onPageChanged();
    }
}

//only fires on a page refresh, NOT on an initial page load, NOR on menu navigation.
function onPageRefreshed() {
    for(let observer of observers) {
        observer.onPageRefreshed();
    }
}
