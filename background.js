// Copyright © 2012, Jeremy Heiner (github.com/JHeiner). All rights reserved.
// See LICENSE file for info.

var greenish = { color: "#0F0" };
var blackish = { color: "#333" };
function notifyState(active) {
	chrome.browserAction.setBadgeBackgroundColor(active?greenish:blackish); }
function notifyCount(count) {
	chrome.browserAction.setBadgeText({text:(count?""+count:"")});
	if (count == 0) {
		if (listening) {
			chrome.tabs.onActivated.removeListener(tabActivated)
			chrome.windows.onFocusChanged.removeListener(windowFocused);
			listening = false; } }
	else { // count != 0
		if (!listening) {
			chrome.tabs.onActivated.addListener(tabActivated)
			chrome.windows.onFocusChanged.addListener(windowFocused);
			listening = true; } } }

function sendAttach(port) { port.postMessage("attach"); }
function sendDetach(port) { port.postMessage("detach"); }
function disconnect(port) { port.disconnect(); }

var tabHash = {}; var tabCount = 0; var listening = false;
notifyState(false); notifyCount(0);

function notifyTabState(tabId) {
	var found = tabHash[tabId];
	notifyState( (!found) ? false : found.isActive ); }

function TabInfo(tabId,isActive) {
	this.tabId = tabId; this.isActive = isActive; this.ports = [];
	tabHash[tabId] = this; notifyCount(++tabCount); }

TabInfo.prototype.toggle = function() {
	if (this.isActive) {
		this.ports.forEach(sendDetach);
		notifyState(this.isActive = false); }
	else {
		this.ports.forEach(sendAttach);
		notifyState(this.isActive = true); } }

TabInfo.prototype.destroy = function() {
	notifyCount(--tabCount);
	this.ports.forEach(disconnect);
	delete tabHash[this.tabId];
	notifyState(false); }

var inject = { allFrames: true, file: "inject.js" }

chrome.browserAction.onClicked.addListener(function(tab) {
	var found = tabHash[tab.id];
	if (found) found.toggle(); else {
		var info = new TabInfo(tab.id,true);
		chrome.tabs.executeScript(tab.id,inject,function(results) {
			if (!results) info.destroy(); else {
				var code = localStorage.Options;
				if (code) {
					code = { allFrames: true, code:
						"if (document.body.nodeName != 'FRAMESET') {\n"
						+code+"\n}" };
					chrome.tabs.executeScript(tab.id,code); } } }); } });

chrome.extension.onConnect.addListener(function(port) {
	var tabId = port.sender.tab.id;
	var found = tabHash[tabId];
	if (!found) // the options page connects when opened
		found = new TabInfo(tabId,false);
	if (found.isActive) { sendAttach(port); notifyState(true); }
	found.ports.push(port);
	port.onDisconnect.addListener(function() {found.destroy()});
	port.onMessage.addListener(function(message) {
		if (message=="toggle") found.toggle(); }); });

function tabActivated(info) {
	notifyTabState(info.tabId); }

function windowFocused(winId) { if (winId != -1)
	chrome.tabs.query( { active:true, windowId:winId }, function(tabs) {
		if (tabs.length != 1) console.error(tabs);
		else notifyTabState(tabs[0].id); }); }

