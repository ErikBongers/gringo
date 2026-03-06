(function() {
	//#region typescript/messaging.ts
	let Actions = /* @__PURE__ */ function(Actions) {
		Actions["OpenHtmlTab"] = "open_tab";
		Actions["RequestTabData"] = "request_tab_data";
		Actions["TabData"] = "tab_data";
		Actions["GetParentTabId"] = "get_parent_tab_id";
		Actions["OpenHoursSettings"] = "open_hours_settings";
		Actions["HoursSettingsChanged"] = "open_hours_settings_changed";
		Actions["GreetingsFromParent"] = "greetingsFromParent";
		Actions["GreetingsFromChild"] = "greetingsFromChild";
		return Actions;
	}({});
	let TabType = /* @__PURE__ */ function(TabType) {
		TabType["Undefined"] = "Undefined";
		TabType["Main"] = "Main";
		TabType["HoursSettings"] = "HoursSettings";
		TabType["Html"] = "Html";
		return TabType;
	}({});
	//#endregion
	//#region typescript/serviceworker.ts
	let defaultOptions = {
		showDebug: true,
		showNotAssignedClasses: true,
		markOtherAcademies: true,
		otherAcademies: ""
	};
	chrome.runtime.onInstalled.addListener(() => {
		console.log("installed.");
		chrome.storage.sync.get(defaultOptions, (items) => {
			chrome.storage.sync.set({
				...defaultOptions,
				...items
			}, () => {
				console.log("Options initialized");
			});
		});
	});
	chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, _tab) {
		console.log("service worker: tab updated: ", tabId, changeInfo.status);
	});
	chrome.tabs.onRemoved.addListener(function(tabId, _removeInfo) {
		console.log("service worker: tab removed: ", tabId);
	});
	chrome.runtime.onMessage.addListener(onMessage);
	async function getTabId(tabType) {
		let data = await chrome.storage.session.get(tabType);
		console.log(data);
		let tabId = data[tabType];
		return parseInt(tabId);
	}
	async function setTabId(tabType, tabId) {
		let data = {};
		data[tabType] = tabId.toString();
		await chrome.storage.session.set(data);
	}
	function onMessage(message, sender, sendResponse) {
		switch (message.action) {
			case Actions.OpenHtmlTab:
				let url = chrome.runtime.getURL(`resources/blank.html?cacheId=${message.data.cacheId}`);
				if (message.senderTabType === TabType.Main) setTabId(TabType.Main, sender.tab.id).then(() => {});
				chrome.tabs.create({ url }).then((_tab) => {
					sendResponse({ tabId: _tab.id });
				});
				return true;
			case Actions.OpenHoursSettings:
				setTabId(TabType.Main, sender.tab.id).then(() => {});
				chrome.tabs.create({ url: chrome.runtime.getURL(`resources/teacherHoursSetup.html?schoolyear=${message.data.schoolyear}`) }).then((tab) => {
					sendResponse({ tabId: tab.id });
				});
				return true;
			case Actions.RequestTabData:
				getTabId(TabType.Main).then((tabId) => {
					chrome.tabs.sendMessage(tabId, message).then(() => {});
				});
				break;
			case Actions.TabData: break;
			case Actions.GetParentTabId:
				sendResponse(getTabId(TabType.Main));
				break;
			case Actions.GreetingsFromChild:
			default:
				console.log("service worker: received message: ", message);
				getTabId(message.targetTabType).then((id) => {
					chrome.tabs.sendMessage(id, message).then(() => {});
				});
				break;
		}
	}
	//#endregion
})();

//# sourceMappingURL=serviceworker.js.map