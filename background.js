
var injected = { allFrames: true, file: "inject.js" };

var greenish = { color: "#0D0" };
var grayish = { color: "#AAA" };
function notifyState(active) {
	chrome.browserAction.setBadgeBackgroundColor(active?greenish:grayish); }
function notifyCount(count) {
	chrome.browserAction.setBadgeText({text:(count?""+count:"")}); }

function sendAttach(port) { port.postMessage("attach"); }
function sendDetach(port) { port.postMessage("detach"); }
function disconnect(port) { port.disconnect(); }

var tabHash = {}; var portCount = 0;
notifyState(false); notifyCount(0);

chrome.browserAction.onClicked.addListener(function(tab) {
	var found = tabHash[tab.id];
	if (found) found.toggle(); else {
		tabHash[tab.id] = {
			isActive: true,
			ports: [],
			toggle: function() {
				if (this.isActive) {
					this.ports.forEach(sendDetach);
					notifyState(this.isActive = false); }
				else {
					this.ports.forEach(sendAttach);
					notifyState(this.isActive = true); } },
			destroy: function() {
				notifyCount( portCount -= this.ports.length );
				this.ports.forEach(disconnect);
				delete tabHash[tab.id];
				notifyState(false); } };
		chrome.tabs.executeScript(tab.id,injected); } });

chrome.tabs.onActivated.addListener(function(info) {
	var found = tabHash[info.tabId];
	notifyState( (!found) ? false : found.isActive ); });

chrome.extension.onConnect.addListener(function(port) {
	var found = tabHash[port.sender.tab.id];
	if (!found) {
		console.error("no hash entry for tab "+port.sender.tab.id);
		port.disconnect(); }
	else {
		if (found.isActive) { sendAttach(port); notifyState(true); }
		found.ports.push(port); notifyCount(++portCount);
		port.onDisconnect.addListener(function() {found.destroy()}); } });

