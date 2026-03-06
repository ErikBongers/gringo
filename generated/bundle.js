(function() {
	//#region typescript/def.ts
	const JSON_URL = "https://europe-west1-ebo-tain.cloudfunctions.net/json";
	const GLOBAL_SETTINGS_FILENAME = "gringo_global_settings.json";
	//#endregion
	//#region typescript/cloud.ts
	let cloud = { json: {
		fetch: fetchJson,
		upload: uploadJson
	} };
	async function fetchJson(fileName) {
		return fetch(JSON_URL + "?fileName=" + fileName, { method: "GET" }).then((res) => res.json());
	}
	async function uploadJson(fileName, data) {
		return await (await fetch(JSON_URL + "?fileName=" + fileName, {
			method: "POST",
			body: JSON.stringify(data),
			keepalive: true
		})).text();
	}
	//#endregion
	//#region typescript/plugin_options/options.ts
	const options = { showDebug: false };
	let globalSettings = { globalHide: false };
	function getGlobalSettings() {
		return globalSettings;
	}
	function setGlobalSetting(settings) {
		globalSettings = settings;
	}
	async function fetchGlobalSettings(defaultSettings) {
		return await cloud.json.fetch(GLOBAL_SETTINGS_FILENAME).catch((err) => {
			console.log(err);
			return defaultSettings;
		});
	}
	//#endregion
	//#region typescript/globals.ts
	let observers = [];
	let settingsObservers = [];
	function equals(g1, g2) {
		return g1.globalHide === g2.globalHide;
	}
	async function getOptions() {
		let items = await chrome.storage.sync.get(null);
		Object.assign(options, items);
		setGlobalSetting(await fetchGlobalSettings(getGlobalSettings()));
	}
	//#endregion
	//#region typescript/main.ts
	init();
	function init() {
		getOptions().then(() => {
			chrome.storage.onChanged.addListener((_changes, area) => {
				if (area === "sync") getOptions().then((_r) => {
					onSettingsChanged();
				});
			});
			window.navigation.addEventListener("navigatesuccess", () => {
				checkGlobalSettings();
				onPageChanged();
			});
			onPageChanged();
			if (document.readyState == "complete") {
				console.log("document ready. firing onPageRefreshed.");
				onPageRefreshed();
			} else window.addEventListener("load", () => {
				console.log("load event fired.");
				onPageRefreshed();
			});
		});
	}
	let lastCheckTime = Date.now();
	function checkGlobalSettings() {
		if (Date.now() > lastCheckTime + 10 * 1e3) {
			lastCheckTime = Date.now();
			console.log("Re-fetching global settings.");
			fetchGlobalSettings(getGlobalSettings()).then((r) => {
				if (!equals(getGlobalSettings(), r)) {
					setGlobalSetting(r);
					onSettingsChanged();
				}
			});
		}
	}
	function onSettingsChanged() {
		console.log("on settings changed.");
		for (let observer of settingsObservers) observer();
	}
	function onPageChanged() {
		if (getGlobalSettings().globalHide) return;
		for (let observer of observers) observer.onPageChanged();
	}
	function onPageRefreshed() {
		if (getGlobalSettings().globalHide) return;
		for (let observer of observers) observer.onPageRefreshed();
	}
	//#endregion
})();

//# sourceMappingURL=bundle.js.map