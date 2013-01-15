// Copyright © 2012-2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file for info.

"use strict";

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
		// these three are for debugging use only
		get local() { return local; },
		get sync() { return sync; },
		get waiters() { return (!waiters) ? 0 : waiters.length; },
		// the rest are for "real" use...
		set local(x) { set(chrome.storage.local,x); },
		set sync(x) { set(chrome.storage.sync,x); } };
	function changed() {
		if ((!local) || (!sync)) return;
		if ("changed" in my) my.changed(local,sync);
		if (!waiters) return;
		while (waiters.length > 0)
			(waiters.pop())(local,sync);
		waiters = undefined; }
	function localListener(items) {
		local = (!items) ? {} : items; changed(); }
	function syncListener(items) {
		sync = (!items) ? {} : items; changed(); }
	function changeListener(delta,area) {
		if (area == "local") chrome.storage.local.get(null,localListener);
		else if (area == "sync") chrome.storage.sync.get(null,syncListener); }
	chrome.storage.onChanged.addListener(changeListener);
	changeListener(null,"local");
	changeListener(null,"sync");
	// read might return old values, use changed to get notifications
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
		var now = new Date().toISOString();
		storage.local = { time: now, code: old }; } }

var badge = (function(){
	var my = undefined;
	var trueColor = { color: "#0F0" };
	var falseColor = { color: "#333" };
	function notifyState(state) {
		var color = (!state) ? falseColor : trueColor;
		chrome.browserAction.setBadgeBackgroundColor(color); }
	var lastFocused = chrome.windows.WINDOW_ID_NONE;
	function tabActivated(info) {
		if (info.windowId == lastFocused)
			notifyState(my.getState(info.tabId)); }
	function windowFocused(winId) {
		if (winId == chrome.windows.WINDOW_ID_NONE) return;
		lastFocused = winId;
		chrome.tabs.query( { active:true, windowId:winId }, function(tabs) {
			if (tabs.length != 1) console.error("weird tabs.query:",tabs);
			else notifyState(my.getState(tabs[0].id)); }); }
	var listening = false;
	function notifyCount(count) {
		chrome.browserAction.setBadgeText({text:(count?""+count:"")});
		if (count == 0) {
			if (listening) {
				chrome.tabs.onActivated.removeListener(tabActivated)
				chrome.windows.onFocusChanged.removeListener(windowFocused);
				listening = false; }
			notifyState(false); }
		else { // count != 0
			if (!listening) {
				chrome.tabs.onActivated.addListener(tabActivated)
				chrome.windows.onFocusChanged.addListener(windowFocused);
				listening = true; }
			chrome.windows.getLastFocused(function(window) {
				windowFocused(window.id); }); } }
	var count = 0; notifyCount(0);
	my = { // you must define getState(tabId)
		get trueColor() { return trueColor.color; },
		set trueColor(x) { trueColor.color = x; },
		get falseColor() { return falseColor.color; },
		set falseColor(x) { falseColor.color = x; },
		get lastFocused() { return lastFocused; },
		get listening() { return listening; },
		get count() { return count; } };
	my.increment = function() {
		if (-1 == count) throw new RangeError("how did you manage this?");
		notifyCount( ++count ); }
	my.decrement = function() {
		if (0 == count) throw new RangeError("decrement from zero?");
		notifyCount( --count ); }
	my.update = function() {
		windowFocused(lastFocused); }
	return my; })();

var tabHash = {};

function TabInfo(tab) {
	this.tab = tab; this.doodling = false; this.ports = [];
	tabHash[tab.id] = this; badge.increment();
	this.allFrames = false; }

badge.getState = function(tabId) {
	var found = tabHash[tabId];
	return (!found) ? false : found.doodling; }

TabInfo.prototype.destroy = function() {
	this.ports.forEach(function(port){port.disconnect();});
	this.ports = undefined;
	delete tabHash[this.tab.id]; badge.decrement(); }

TabInfo.prototype.toggle = function() {
	if (this.doodling) {
		this.ports.forEach(function(port){port.postMessage("detach");});
		this.doodling = false;
		badge.update(); }
	else {
		this.ports.forEach(function(port){port.postMessage("attach");});
		this.doodling = true;
		badge.update(); } }

TabInfo.prototype.dispatch = function(message) {
	if (message == "toggle") this.toggle();
	else console.error("dispatch:"+message); }

TabInfo.prototype.addPort = function(port) {
	port.onDisconnect.addListener(this.destroy.bind(this));
	port.onMessage.addListener(this.dispatch.bind(this));
	this.ports.push(port); }

TabInfo.prototype.executeScript = function(details,callback) {
	if (this.allFrames) details.allFrames = true;
	chrome.tabs.executeScript(this.tab.id,details,
		(!callback)?null:this[callback].bind(this) ); }

chrome.browserAction.onClicked.addListener(function(tab) {
	var found = tabHash[tab.id];
	if (found) found.toggle();
	else new TabInfo(tab).inject(); });

TabInfo.prototype.inject = function() {
	this.toggle = function(){ alert("tab contacted, awaiting reply"); };
	this.executeScript({code:"document.body.nodeName"},"bodyNodeName"); }

TabInfo.prototype.bodyNodeName = function(results) {
	if ( !Array.isArray(results) || results.length != 1 ) {
		console.error("weird results:",results);
		return; }
	if ('FRAMESET' == results[0])
		this.allFrames = true;
	else if ('BODY' != results[0]) {
		console.error("weird results:",results);
		return; }
	this.executeScript({file:"inject.js"},"injected"); }

TabInfo.prototype.injected = function(results) {
	if ( !Array.isArray(results) || results.length <= 0 ) {
		console.error("weird results:",results);
		return; }
	for ( var i = results.length - 1 ; 0 <= i ; --i )
		if (results[0] != "OK") {
			console.error("weird results:",results);
			return; }
	delete this.toggle;
	this.toggle();
	this.readOptions(); }

TabInfo.prototype.readOptions = function() {
	storage.read(this.sendOptions.bind(this)); }

TabInfo.prototype.sendOptions = function(local,sync) {
	var options = ("code" in local) ? local.code
		: ("code" in sync) ? sync.code : null;
	if (!options) return;
	if (options.indexOf('"required jQuery";') != -1 && !('jQuery' in this)) {
		this.jQuery = true;
		this.executeScript({file:"jquery-1.8.3/jquery.min.js"},"readOptions");
		return; }
	options = "if ('doodledoku' in window) {\n"+options+"\n}";
	this.executeScript({code:options},null); }

chrome.extension.onConnect.addListener(function(port) {
	var tab = port.sender.tab;
	var found = tabHash[tab.id];
	if (!found) found = new TabInfo(tab);
	found.addPort(port); });

