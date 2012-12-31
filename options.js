
$(function () {

	$("#banner").addClass("ui-widget-content ui-corner-all");

	var $tabs = $("#contents").tabs();

	$("#expandAll").on("click",function() {
		$('details').each(function() { this.setAttribute("open","") }) });

	var inject = document.createElement("script");
	inject.setAttribute("src","inject.js");
	document.head.appendChild(inject);

	var code = localStorage.Options;
	if (code) $tabs.tabs('select','#tweak');
	else code = "// put your javascript here\n\n";

	var delayed = null;
	var mirror = CodeMirror(document.getElementById("tweak"), {
		value: code, lineNumbers: true, matchBrackets: true,
		onChange: function(mirror,updated) {
			if (delayed) clearTimeout(delayed);
			delayed = setTimeout(function() {
				code = mirror.getValue();
				if (!code) localStorage.clear();
				else localStorage.Options = code;
				delayed = null; }, 1000 ); } });

	$tabs.bind('tabsshow', function(event,ui) {
		if (ui.panel.id!="tweak") return;
		mirror.refresh();
		$(this).unbind(event); });

});

