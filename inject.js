
if (document.body.nodeName != "FRAMESET") {

var svgNS = "http://www.w3.org/2000/svg";

var svg = document.createElementNS(svgNS,"svg");
svg.setAttribute("preserveAspectRatio","none");
svg.setAttribute("zoomAndPan","disable");
svg.setAttribute("cursor","crosshair"); // cool: affected by pointer-events
svg.style.position = "absolute";
svg.style.zIndex = 999999999;
svg.style.top = 0;
svg.style.left = 0;
function svgResize() {
	svg.style.width = 0; svg.style.height = 0;
	svg.style.width = document.body.scrollWidth;
	svg.style.height = document.body.scrollHeight; }
window.addEventListener("resize",svgResize);
svgResize();
svg.setAttribute("stroke-linecap","square");
svg.setAttribute("stroke-width",4);
svg.setAttribute("stroke","black");
svg.setAttribute("fill","none");
document.body.appendChild(svg);

// keyboard events don't have mouse position, so...

var clientX; var clientY;
function trackMouse(event) {
	clientX = event.clientX; clientY = event.clientY; }

var trackX; var trackY; var trackFromPoint;
var trackChange = function(was,hit) {
	// should probably limit focus to text inputs...
	hit.focus(); return hit; }
function trackElement() {
	if (trackX != clientX || trackY != clientY ) {
		trackX = clientX; trackY = clientY;
		svg.style.visibility="hidden";
		var element = document.elementFromPoint(trackX,trackY);
		svg.style.visibility="visible";
		if ( element != trackFromPoint )
			trackFromPoint = trackChange( trackFromPoint, element ); } }

var attachKeyboard = function() {
	document.addEventListener("keydown",trackElement);
	document.addEventListener("keypress",trackElement);
	document.addEventListener("keyup",trackElement); };
var detachKeyboard = function() {
	document.removeEventListener("keydown",trackElement);
	document.removeEventListener("keypress",trackElement);
	document.removeEventListener("keyup",trackElement); };

// new doodle being doodled, and previous doodle path moused down on
// (which could turn out to be a click on that path or start of a new doodle)

var doodle; var pressPath; var pressX; var pressY;
function thunkPress(path) { return function(event) {
	pressPath = path; downMouse(event); }}

function downMouse(event) {
	pressX = event.pageX; pressY = event.pageY;
	trackMouse(event); event.preventDefault();
	svg.addEventListener("mousemove",moveMouse);
	svg.addEventListener("mouseup",upMouse); }

function moveMouse(event) {
	trackMouse(event);
	if (event.pageX != pressX || event.pageY != pressY) {
		if (!doodle) {
			doodle = document.createElementNS(svgNS,"path");
			doodle.setAttribute("d","M "+pressX+" "+pressY);
			doodle.addEventListener("mousedown",thunkPress(doodle));
			svg.appendChild(doodle); pressPath = null; }
		var data = doodle.getAttribute("d");
		var add = " "+event.pageX+" "+event.pageY;
		if (data.substr(data.length-add.length) != add) {
			data = data+" L"+add; doodle.setAttribute("d",data); } } }

function upMouse(event) {
	moveMouse(event);
	if (pressPath) {
		svg.removeChild(pressPath);
		pressPath = null; }
	else { if (!doodle) {
		doodle = document.createElementNS(svgNS,"circle");
		doodle.setAttribute("r",3);
		doodle.setAttribute("cx",pressX);
		doodle.setAttribute("cy",pressY);
		doodle.setAttribute("fill","black");
		doodle.setAttribute("stroke","none");
		doodle.addEventListener("mousedown",thunkPress(doodle));
		svg.appendChild(doodle);
	} doodle = null; }
	svg.removeEventListener("mousemove",moveMouse);
	svg.removeEventListener("mouseup",upMouse); }

// attach and detach all our event handlers

var isActive = false;
function attachListeners() { if (!isActive) {
	svg.setAttribute("pointer-events","visiblePainted");
	svg.addEventListener("mousedown",downMouse);
	document.addEventListener("mousemove",trackMouse);
	attachKeyboard();
	isActive = true; }}
function detachListeners() { if (isActive) {
	svg.setAttribute("pointer-events","none");
	svg.removeEventListener("mousedown",downMouse);
	document.removeEventListener("mousemove",trackMouse);
	detachKeyboard();
	isActive = false; }}

if (/^http:\/\/www\.puzzlemix\.com\/playgrid/.test(document.documentURI)) {
	trackChange = function(was,hit) {
		// if (hit.nodeName == "INPUT") { hit.click(); return hit; } ???
		var cell = hit;
		while (cell && ! /select_cell\(\d+\)/.test(cell.onclick))
			cell = cell.parentNode;
		if (cell && was != cell) {
			/*console.log(cell.id+".click");*/ cell.click(); return cell; }
		return was; }
	var original = document.body.onkeydown;
	var tracking = function(event) { trackElement(); original(event); }
	attachKeyboard = function() { document.body.onkeydown = tracking; };
	detachKeyboard = function() { document.body.onkeydown = original; }; }
else
if (/^http:\/\/www\.sudoku\.org\.uk\/Puzzles/.test(document.documentURI)) {
/*
for <object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000">s
  var param = document.createElement('param');
    param.setAttribute('name','wmode');
    param.setAttribute('value','opaque');
    obj.appendChild(param);
  var wrapper = document.createElement('div');
    obj.parentNode.replaceChild(wrapper,obj.parentNode);
	wrapper.appendChild(obj)
*/
	var embeds = document.getElementsByTagName("EMBED")
	for (var i = embeds.length - 1 ; i >= 0 ; --i ) {
		if (embeds[i].getAttribute("type")=="application/x-shockwave-flash") {
			embeds[i].setAttribute("wmode","opaque");
			var parent = embeds[i].parentElement;
			while (parent.nodeName == "OBJECT") {
				var grandp = parent.parentElement;
				grandp.replaceChild(embeds[i],parent);
				parent = grandp; } } } }

// communication with the extension

var port = chrome.extension.connect({name:document.documentURI});
// in a frameset tab.url isn't very helpful

function keybindingHack(event) {
	// experimental.keybinding only supports alpha keys ('A' to 'Z')
	if (event.keyCode == 107) // numpad +
		port.postMessage("toggle"); }
window.addEventListener("keydown",keybindingHack);

port.onDisconnect.addListener(function() {
	detachListeners();
	window.removeEventListener("resize",svgResize);
	window.removeEventListener("keydown",keybindingHack);
	document.body.removeChild(svg); });
port.onMessage.addListener(function(message) {
	switch (message) {
		case "attach": attachListeners(); break;
		case "detach": detachListeners(); break; } });

} // if not frameset

