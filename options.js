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

var editor = (function() {
	var code = null; var mirror = null;
	var my = undefined;
	function ensureMirror() {
		if (mirror) return mirror;
		mirror = CodeMirror(document.getElementById("tweak"), {
			lineNumbers: true, matchBrackets: true });
		mirror.on("change",function(mirror,updated) {
			var now = mirror.getValue();
			if (now == code) return;
			code = now;
			if ("changed" in my) my.changed(code); });
		return mirror; }
	my = {
		get code() { return code; },
		get mirror() { return mirror; },
		set code(value) {
			if ("string" == typeof value) {
				if (value == code) return;
				code = value; // changed will not be called
				ensureMirror().setValue(value); }
			else {
				if (mirror) $(mirror.getWrapperElement()).remove();
				code = null; mirror = null; } } };
	return my; })();

editor.changed = function(edited) {
	var now = new Date().toLocaleString();
	storage.local = { time: now, code: edited }; };

function storageChanged(local,sync) {
	var syncCode = (sync && ("code" in sync)) ? sync.code : undefined;
	if (syncCode == undefined) {
		$("#syncInfo").html("Sync'ed: <small><i>(none)");
		syncCode = ""; } // for comparing below to localCode
	else {
		var time = ("time" in sync) ?
			new Date(sync.time).toLocaleString() : "<i>(unknown)</i>";
		var code = syncCode;
		code = code.substring( code.search(/\S/) ); // skip leading spaces
		code = code.substring( 0, code.search(/\n|\r|\f|\v/) ); // 1st line
		code = code.replace(/&/g,"&amp;").replace(/</g,"&lt;");
		$("#syncInfo").html("Sync'ed: <small>"+time
			+"<br> <tt> &nbsp; "+code+"</tt></small><big> ...</big>"); }
	var localCode = (local && ("code" in local)) ? local.code : undefined;
	if (localCode == undefined) {
		$("#localInfo").html("Local: <small><i>(none)");
		editor.code = null; }
	else {
		$("#pushCode").removeAttr("disabled");
		var time = (!localCode) ? "<i>(none)" : (localCode == syncCode) ?
			"<i>(same as Sync'ed)" : ("time" in local) ?
			new Date(local.time).toLocaleString() : "<i>(unknown)</i>";
		$("#localInfo").html("Local: <small>"+time);
		editor.code = localCode; } }

var initialCode = "\n\
// the first line will be shown in Sync'ed.\n\
// put your javascript here... for example:\n\
\n\
/*\n\
if (document.location.hostname == 'www.example.com') {\n\
   // background is too dark to see the doodles...\n\
   doodles.color.normal = 'cyan';\n\
  }\n\
*/\n\
\n\
// unfortunately you'll need to read and understand\n\
// the doodle source code, and there are no guarantees\n\
// that updates to doodledoku won't break your code.\n";

$(function () {

	var $tabs = $("#contents").tabs({
		activate: function(event,ui) {
			if (ui.newPanel[0].id != "tweak") return;
			var mirror = editor.mirror;
			if (mirror) mirror.refresh(); } });

	$("#expandAll").on("click",function() {
		$('details').each(function() {
			this.setAttribute("open",""); }); });

	$("#editCode").on("click",function() {
		storage.read(function(local,sync) {
			if ("code" in sync) storage.local = sync;
			else editor.changed( initialCode ); }); });

	$("#pushCode").on("click",function() {
		$(this).attr("disabled","true");
		storage.read(function(local,sync) {
			storage.local = null;
			var syncCode = ("code" in sync) ? sync.code : undefined;
			var localCode = ("code" in local) ? local.code : undefined;
			if (syncCode != localCode)
				storage.sync = (!localCode) ? null : local; }); });

	storage.read(function(local,sync) {
		storage.changed = storageChanged;
		storageChanged(local,sync);
		if (("code" in local) || ("code" in sync))
			$tabs.tabs('option','active',-1); });

	window.doodles =
		new Doodles.Extension(new Doodles.CoverBody(document.body,window));
});

