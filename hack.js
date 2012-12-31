$(function () {

	var inject = document.createElement("script");
	inject.setAttribute("src","inject.js");
	document.head.appendChild(inject);

	var request = new XMLHttpRequest();
	request.open("GET", chrome.extension.getURL("inject.js"), false);
	request.send();
	if (request.readyState != 4) console.error(request);
	var code = request.responseText;
	request = null;

	var mirror = CodeMirror(document.getElementById("mirror"), {
		value: code, readOnly: true, lineNumbers: true, matchBrackets: true });

});
