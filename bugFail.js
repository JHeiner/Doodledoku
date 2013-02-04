// Copyright © 2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file.

"use strict";

$(function () {

	chrome.extension.sendMessage('bugDetails',function(response) {
		if (!response) response = "(details lost)";
		var rows = 1; var i = response.indexOf('\n');
		while (-1 != i) { ++rows; i = response.indexOf('\n',i+1); }
		var details = document.getElementById('details');
		details.value = response;
		details.rows = rows;
		details.select(); });

	$("#report").on("click",function() {
		chrome.tabs.create({url:
"https://chrome.google.com/webstore/support/adcigljcdlemflbekljdfohfpipeolof"
						   }); });

});
