// Copyright © 2012-2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file.

/*jshint bitwise:true camelcase:true forin:true immed:true latedef:true
         newcap:true noarg:true noempty:true nonew:true regexp:true
         undef:true unused:true strict:true trailing:true */
// curly:true eqeqeq:true indent:4 plusplus:true quotmark:true maxcomplexity:4
/*jshint smarttabs:true es5:true */
/*global chrome:false localStorage:false console:false alert:false */

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
		else waiters.push(waiter); };
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
		storage.local = { time: now, code: old }; } };

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
		if (count === 0) {
			if (listening) {
				chrome.tabs.onActivated.removeListener(tabActivated);
				chrome.windows.onFocusChanged.removeListener(windowFocused);
				listening = false; }
			notifyState(false); }
		else { // count != 0
			if (!listening) {
				chrome.tabs.onActivated.addListener(tabActivated);
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
		notifyCount( ++count ); };
	my.decrement = function() {
		if (0 === count) throw new RangeError("decrement from zero?");
		notifyCount( --count ); };
	my.update = function() {
		windowFocused(lastFocused); };
	return my; })();

var tabHash = {};

function TabInfo(tab) {
	this.tab = tab; this.doodling = false; this.ports = [];
	tabHash[tab.id] = this; badge.increment();
	this.allFrames = false; }

badge.getState = function(tabId) {
	var found = tabHash[tabId];
	return (!found) ? false : found.doodling; };

TabInfo.prototype.destroy = function() {
	this.ports.forEach(function(port){port.disconnect();});
	this.ports = undefined;
	delete tabHash[this.tab.id]; badge.decrement(); };

TabInfo.prototype.toggle = function() {
	if (this.doodling) {
		this.ports.forEach(function(port){port.postMessage("detach");});
		this.doodling = false;
		badge.update(); }
	else {
		this.ports.forEach(function(port){port.postMessage("attach");});
		this.doodling = true;
		badge.update(); } };

TabInfo.prototype.dispatch = function(message) {
	if (message == "toggle") this.toggle();
	else console.error("dispatch:"+message); };

TabInfo.prototype.addPort = function(port) {
	port.onDisconnect.addListener(this.destroy.bind(this));
	port.onMessage.addListener(this.dispatch.bind(this));
	this.ports.push(port); };

TabInfo.prototype.executeScript = function(details,callback) {
	if (this.allFrames) details.allFrames = true;
	chrome.tabs.executeScript(this.tab.id,details,
		(!callback)?null:this[callback].bind(this) ); };

var bugDetails = [];

chrome.extension.onMessage.addListener(function(message,sender,respond){
	if (-1 == chrome.extension.getURL('').indexOf('/'+sender.id+'/')) {
		console.warn("message ignored:",message,sender);
		return; }
	switch (message) {
	case "bugDetails":
		respond(bugDetails.join('\n\n')); bugDetails = []; break;
	default:
		console.warn("message unknown:",message,sender); break; } });

TabInfo.prototype.bugReport = function(method,results) {
	var flags = [];
	if (this.allFrames) flags.push('allFrames');
	if (this.doodling) flags.push('doodling');
	if (this.jQuery) flags.push('jQuery');
	if (this.ports) flags.push('ports:'+this.ports.length);
	if (this.tab.selected) flags.push('selected');
	var lastError = chrome.extension.lastError;
	var colon = this.tab.url.indexOf(':');
	var url = this.tab.url.substring(0,colon);
	if (url=='http' || url=='https') {
		var end = this.tab.url.indexOf('/',colon+3);
		url = (-1 == end) ? this.tab.url : this.tab.url.substring(0,end); }
	var details = method+"("+(results?JSON.stringify(results):'')+")"
		+"\n"+flags.join(" ")+" "+this.tab.status+"\n"+url;
	if (lastError) details += ("\n"+lastError.message);
	if (this.options) details += ("\n"+this.options);
	bugDetails.push(details);
	chrome.tabs.create({ openerTabId:this.tab.id,
		url:chrome.extension.getURL('bugFail.html') });
	this.destroy(); };

TabInfo.prototype.validResults = function(method,results) {
	if ( !Array.isArray(results) || results.length <= 0 ) {
		this.bugReport(method,results);
		return false; }
	return true; };

TabInfo.prototype.allResultsOK = function(method,results) {
	if (!this.validResults(method,results))
		return false;
	for ( var i = results.length - 1 ; 0 <= i ; --i )
		if (results[0] != 'OK') {
			this.bugReport(method,results);
			return false; }
	return true; };

chrome.browserAction.onClicked.addListener(function(tab) {
	var found = tabHash[tab.id];
	if (found) { found.toggle(); return; }
	if (tab.url.substr(0,5)=='http:' || tab.url.substr(0,6)=='https:') {
		var webStoreHostAt = tab.url.indexOf('//chrome.google.com/');
		if (webStoreHostAt==5 || webStoreHostAt==6) {
			chrome.tabs.create({ openerTabId:tab.id,
				url:chrome.extension.getURL('bugPerm.html') });
			return; } }
	else if (tab.url.substr(0,5)!='file:') {
		chrome.tabs.create({ openerTabId:tab.id,
			url:chrome.extension.getURL('bugPerm.html') });
		return; }
	if (tab.status != 'complete') {
		alert("Sorry, but this page hasn't finished loading yet.\n"
		      +"Please try again once it has.");
		return; }
	new TabInfo(tab).inject(); });

TabInfo.prototype.inject = function() {
	this.toggle = function(){ alert("tab contacted, awaiting reply"); };
	this.executeScript({code:"document.body.nodeName"},"bodyNodeName"); };

TabInfo.prototype.bodyNodeName = function(results) {
	if (!this.validResults("bodyNodeName",results))
		return;
	if (results.length != 1) {
		this.bugReport("bodyNodeName",results);
		return; }
	if ('FRAMESET' == results[0])
		this.allFrames = true;
	else if ('BODY' != results[0]) {
		this.bugReport("bodyNodeName",results);
		return; }
	this.executeScript({file:"doodles.js"},"injected"); };

TabInfo.prototype.injected = function(results) {
	if (!this.allResultsOK("injected",results))
		return;
	delete this.toggle;
	this.readOptions(['OK']); };

TabInfo.prototype.readOptions = function(results) {
	if (!this.validResults("readOptions",results))
		return;
	storage.read(this.sendOptions.bind(this)); };

TabInfo.prototype.sendOptions = function(local,sync) {
	var options = ("code" in local) ? local.code
		: ("code" in sync) ? sync.code : "";
	if (options.indexOf('"required jQuery";') != -1 && !('jQuery' in this)) {
		this.jQuery = true;
		this.executeScript({file:"jquery-2.0.3/jquery.min.js"},"readOptions");
		return; }
	this.options = options;
	this.executeScript({code: "Doodles.ifNotFrameset( window, function() {"
		+ options +"}); 'OK';" }, "done" ); };

TabInfo.prototype.done = function(results) {
	this.allResultsOK("done",results);
	if (!this.doodling) this.toggle(); };

chrome.extension.onConnect.addListener(function(port) {
	var tab = port.sender.tab;
	var found = tabHash[tab.id];
	if (!found) found = new TabInfo(tab);
	found.addPort(port); });

