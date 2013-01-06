// Copyright © 2012-2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file for info.

"use strict";

var greenish = { color: "#0F0" };
var blackish = { color: "#333" };
function notifyState(active) {
	chrome.browserAction.setBadgeBackgroundColor(active?greenish:blackish); }

var listening = false;
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

var storage = (function() {
	var local = undefined; var sync = undefined; var waiters = [];
	function isEmpty(value) {
		if (!value) return true;
		if ("object" != typeof value) return true;
		for ( var property in value ) return false;
		return true; }
	function set(storage,value) {
		if (isEmpty(value)) storage.clear(); else storage.set(value); }
	var my = {
		get local() { return local; },
		set local(x) { set(chrome.storage.local,x); },
		get sync() { return sync; },
		set sync(x) { set(chrome.storage.sync,x); },
		get waiters() { return (!waiters) ? 0 : waiters.length; } };
	function changed() {
		if ((!local) || (!sync)) return;
		if ("changed" in my) my.changed(local,sync);
		if (!waiters) return;
		while (waiters.length > 0)
			(waiters.pop())(local,sync);
		waiters = undefined; }
	function localListener(items) {
		local = items ? items : {}; changed(); }
	function syncListener(items) {
		sync = items ? items : {}; changed(); }
	function changeListener(delta,area) {
		if (area == "local") chrome.storage.local.get(null,localListener);
		else if (area == "sync") chrome.storage.sync.get(null,syncListener); }
	chrome.storage.onChanged.addListener(changeListener);
	changeListener(null,"local");
	changeListener(null,"sync");
	my.read = function(waiter) {
		if (!waiters) waiter(local,sync);
		else waiters.push(waiter); }
	return my; })();

storage.changed = function(local,sync) {
	var old = localStorage.Options;
	if (!old) {
		localStorage.clear();
		delete storage.changed;
		return; }
	if ("code" in local)
		console.warn("old options set, but new local is in use");
	else {
		localStorage.clear();
		delete storage.changed;
		var time = new Date().toISOString();
		chrome.storage.local.set({ time: time, code: old }); } }

var tabHash = {}; var tabCount = 0;

function TabInfo(tabId) {
	this.tabId = tabId; this.isActive = true; this.ports = [];
	tabHash[tabId] = this; notifyState(true); notifyCount(++tabCount); }

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
	this.ports = [];
	delete tabHash[this.tabId];
	notifyState(false); }

TabInfo.prototype.dispatch = function(message) {
	if (message == "toggle") this.toggle();
	else console.error("dispatch:"+message); }

TabInfo.prototype.addPort = function(port) {
	if (this.isActive) { sendAttach(port); notifyState(true); }
	port.onDisconnect.addListener(this.destroy.bind(this));
	port.onMessage.addListener(this.dispatch.bind(this));
	this.ports.push(port);
	if (this.ports.length == 1 ) // allFrames
		storage.read(this.sendCode.bind(this)); }

TabInfo.prototype.sendCode = function(local,sync) {
	if ("code" in local) this.execCode(local.code);
	else if ("code" in sync) this.execCode(sync.code); }

TabInfo.prototype.execCode = function(code) {
	chrome.tabs.executeScript(this.tabId, { allFrames: true, code:
		"if (document.body.nodeName != 'FRAMESET') {\n"
		+code+"\n}" }); }

var inject = { allFrames: true, file: "inject.js" }

chrome.browserAction.onClicked.addListener(function(tab) {
	var found = tabHash[tab.id];
	if (found) found.toggle();
	else chrome.tabs.executeScript(tab.id,inject); });

chrome.extension.onConnect.addListener(function(port) {
	var tabId = port.sender.tab.id;
	var found = tabHash[tabId];
	if (!found) found = new TabInfo(tabId);
	found.addPort(port); });

function notifyTabState(tabId) {
	var found = tabHash[tabId];
	notifyState( (!found) ? false : found.isActive ); }

function tabActivated(info) {
	notifyTabState(info.tabId); }

function windowFocused(winId) { if (winId != -1)
	chrome.tabs.query( { active:true, windowId:winId }, function(tabs) {
		if (tabs.length != 1) console.error(tabs);
		else notifyTabState(tabs[0].id); }); }

