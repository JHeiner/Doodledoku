
var xhr = new XMLHttpRequest();
xhr.open("GET", chrome.extension.getURL("/inject.js"), false);
xhr.send();
if (xhr.readyState != 4) console.error(xhr);
var inject = xhr.responseText;

var greenish = { color: "#0F0" };
var blackish = { color: "#333" };
function notifyState(active) {
	chrome.browserAction.setBadgeBackgroundColor(active?greenish:blackish); }
function notifyCount(count) {
	chrome.browserAction.setBadgeText({text:(count?""+count:"")}); }

function sendAttach(port) { port.postMessage("attach"); }
function sendDetach(port) { port.postMessage("detach"); }
function disconnect(port) { port.disconnect(); }

var tabHash = {}; var portCount = 0;
notifyState(false); notifyCount(0);

function notifyTabState(tabId) {
	var found = tabHash[tabId];
	notifyState( (!found) ? false : found.isActive ); }

function registerTab(tabId,active) {
	return (tabHash[tabId] = {
		isActive: active,
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
			delete tabHash[tabId];
			notifyState(false); } }); }

chrome.browserAction.onClicked.addListener(function(tab) {
	var found = tabHash[tab.id];
	if (found) found.toggle(); else {
		registerTab(tab.id,true);
		var code = localStorage.Options;
		if (!code) code = "";
		code = "if (document.body.nodeName != 'FRAMESET') {\n"
			+inject+"\n"+code+"\n}";
		chrome.tabs.executeScript(tab.id,{allFrames:true,code:code}); } });

chrome.extension.onConnect.addListener(function(port) {
	var found = tabHash[port.sender.tab.id];
	if (!found)
		found = registerTab(port.sender.tab.id,false);
	if (!found) {
		console.error("no hash entry for tab "+port.sender.tab.id);
		port.disconnect(); }
	else {
		if (found.isActive) { sendAttach(port); notifyState(true); }
		found.ports.push(port); notifyCount(++portCount);
		port.onDisconnect.addListener(function() {found.destroy()});
		port.onMessage.addListener(function(message) {
			if (message=="toggle") found.toggle(); }); } });

chrome.tabs.onActivated.addListener(function(info) {
	notifyTabState(info.tabId); });

chrome.windows.onFocusChanged.addListener(function(winId) { if (winId != -1)
	chrome.tabs.query( { active:true, windowId:winId }, function(tabs) {
		if (tabs.length != 1) console.error(tabs);
		else notifyTabState(tabs[0].id); }); });

