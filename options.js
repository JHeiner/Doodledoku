
$(function () {

	$("#banner").addClass("ui-widget-content ui-corner-all");
	$("#contents").tabs();

	document.getElementById("expandAll").addEventListener("click",function() {
		$('details').each(function() { this.setAttribute("open","") }) });

	var inject = document.createElement("script");
	inject.setAttribute("src","inject.js");
	document.head.appendChild(inject);

});

