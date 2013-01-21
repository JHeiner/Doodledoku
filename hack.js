// Copyright © 2012-2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file for info.

"use strict";

var doodledoku = function(self) { self.toggle(); };

$(function () {

	var request = new XMLHttpRequest();
	request.open("GET", chrome.extension.getURL("doodles.js"), false);
	request.send();
	if (request.readyState != 4) console.error(request);
	var code = request.responseText;
	request = null;

	var mirror = CodeMirror(document.getElementById("mirror"), {
		value: code, readOnly: true, lineNumbers: true, matchBrackets: true });

	window.doodles =
		new Doodles.Extension(new Doodles.CoverBody(document.body,window));
});
