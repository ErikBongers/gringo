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
	function registerObserver(observer) {
		observers.push(observer);
		if (observers.length > 20) console.error("Too many observers!");
	}
	function equals(g1, g2) {
		return g1.globalHide === g2.globalHide;
	}
	async function getOptions() {
		let items = await chrome.storage.sync.get(null);
		Object.assign(options, items);
		setGlobalSetting(await fetchGlobalSettings(getGlobalSettings()));
	}
	function tryUntilThen(func, then) {
		if (func()) then();
		else setTimeout(() => tryUntilThen(func, then), 100);
	}
	//#endregion
	//#region typescript/pageObserver.ts
	var PartialUrlPageFilter = class {
		constructor(partialUrl) {
			this.partialUrl = partialUrl;
		}
		match() {
			return window.location.href.includes(this.partialUrl);
		}
	};
	var BaseObserver = class {
		constructor(onPageChangedCallback, pageFilter, onMutationCallback, trackModal = false, onPageRefreshedCallback) {
			this.isPageMatching = () => this.pageFilter.match();
			this.onPageChangedCallback = onPageChangedCallback;
			this.onPageRefreshedCallback = onPageRefreshedCallback;
			this.pageFilter = pageFilter;
			this.onMutation = onMutationCallback;
			this.trackModal = trackModal;
			if (onMutationCallback) this.observer = new MutationObserver((mutationList, observer) => this.observerCallback(mutationList, observer));
		}
		observerCallback(mutationList, _observer) {
			if (!this.onMutation) return;
			for (const mutation of mutationList) {
				if (mutation.type !== "childList") continue;
				if (this.onMutation(mutation)) break;
			}
		}
		onPageRefreshed() {
			if (this.onPageRefreshedCallback) {
				if (this.isPageMatching()) tryUntilThen(this.isPageReallyLoaded, this.onPageRefreshedCallback);
			}
		}
		onPageChanged() {
			if (!this.pageFilter.match()) {
				this.disconnect();
				return;
			}
			if (this.onPageChangedCallback) this.onPageChangedCallback();
			if (!this.onMutation) return;
			console.log("Observing main element.");
			if (!document.querySelector("main")) console.error("Can't attach observer to element.");
			this.observeElement(document.querySelector("main"));
			if (this.trackModal) this.observeElement(document.getElementById("dko3_modal"));
		}
		observeElement(element) {
			if (!element) {
				console.error("Can't attach observer to element.");
				return;
			}
			this.observer.observe(element, {
				attributes: false,
				childList: true,
				subtree: true
			});
		}
		disconnect() {
			this.observer?.disconnect();
		}
	};
	var PartialUrlObserver = class extends BaseObserver {
		constructor(partialUrl, onMutationCallback, trackModal = false, onPageRefreshedCallback) {
			super(void 0, new PartialUrlPageFilter(partialUrl), onMutationCallback, trackModal, onPageRefreshedCallback);
		}
	};
	//#endregion
	//#region typescript/aanvragen/observer.ts
	var AanvragenObserver = class extends PartialUrlObserver {
		constructor() {
			super("request-info-list/requisition", onMutation, false, onPageRefreshed$1);
		}
		isPageReallyLoaded() {
			return true;
		}
	};
	var observer_default = new AanvragenObserver();
	function onPageRefreshed$1() {
		gringo("page Aanvragen refreshed xxx.");
		decorateAllPRs();
	}
	function onMutation(mutation) {
		if (document.querySelector("fd-pagination")) {
			decorateAllPRs();
			return true;
		}
		return false;
	}
	function gringo(...args) {
		console.log("gringo", ...args);
	}
	function decorateAllPRs() {
		gringo("ids: ", [...document.querySelectorAll("request-info-item")].map(scrapeInfoItem));
	}
	function scrapeInfoItem(requestDiv) {
		let id = requestDiv.id.substring(8);
		let divOrders = requestDiv.querySelector(".item-orders");
		let orderAnchors = [];
		if (divOrders) orderAnchors = [...divOrders.querySelectorAll(".request-po-list-container ul > li a")];
		return {
			id,
			orderAnchors
		};
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
			registerObserver(observer_default);
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