
if (document.body.nodeName != "FRAMESET") {

var normalColor = "#333";
var hiliteColor = "#f88";

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
svg.setAttribute("stroke-linejoin","round");
svg.setAttribute("stroke-linecap","round");
document.body.appendChild(svg);

function shapeAllResize(pathWidth,circleRadius) {
	for ( var shape = svg.firstChild ; shape ; shape = shape.nextSibling )
		switch ( shape.nodeName ) {
		case "circle": shape.setAttribute("r",circleRadius); break;
		case "path": shape.setAttribute("stroke-width",pathWidth); } }

function shapeListColor(shape,color) {
	for ( ; shape ; shape = shape.nextSibling )
		switch ( shape.nodeName ) {
		case "circle": shape.setAttribute("fill",color); break;
		case "path": shape.setAttribute("stroke",color); } }

var pressed = false; // is the primary mouse button down?
var doodle = null; // the path currently being drawn
var lastX = 0; var lastY = 0; // pageX,pageY of last doodle point

// keyboard events don't have mouse position (needed for elementFromPoint)
var clientX = 0; var clientY = 0; // so stash them here in all mouse events

function shapeFindHilite() {
	var found = [];
	shapeAllResize(10,6);
	for ( var hit = document.elementFromPoint(clientX,clientY)
	      ; hit && hit.parentNode == svg
	      ; hit = document.elementFromPoint(clientX,clientY) ) {
		for ( var i = found.length - 1 ; i >= 0 ; -- i )
			if (hit == found[i]) {
				console.error("duplicate (pointer-events fails)");
				return; }
		found.push(hit);
		hit.setAttribute("pointer-events","none"); }
	for ( var i = found.length - 1 ; i >= 0 ; -- i )
		found[i].removeAttribute("pointer-events");
	shapeAllResize(4,3);
	if (found.length == 0) {
		shapeListColor(svg.firstChild,normalColor);
		return; }
	var shape = svg.firstChild;
	while ( shape && found.indexOf(shape) == -1 )
		shape = shape.nextSibling;
	if (!shape) console.error("zero hits found???"); else
	shapeListColor(shape,hiliteColor); }

function downMouse(event) {
	clientX = event.clientX; clientY = event.clientY;
	if (0 != event.button) return;
	if (pressed || doodle) { console.error("lost mouseup?"); doodle = null; }
	lastX = event.pageX; lastY = event.pageY;
	pressed = true; event.preventDefault(); }

function moveMouse(event) {
	clientX = event.clientX; clientY = event.clientY;
	if (!pressed) {
		if (event.ctrlKey) shapeFindHilite();
		return; }
	event.preventDefault();
	var deltaX = event.pageX - lastX; var deltaY = event.pageY - lastY;
	if (deltaX*deltaX + deltaY*deltaY < 17) return;
	if (doodle)
		doodle.setAttribute("d",doodle.getAttribute("d")
		                    + " "+deltaX+","+deltaY);
	else {
		doodle = document.createElementNS(svgNS,"path");
		doodle.setAttribute("d","m "+lastX+","+lastY
		                    + " "+deltaX+","+deltaY);
		doodle.setAttribute("stroke-width",4);
		doodle.setAttribute("stroke",normalColor);
		doodle.setAttribute("fill","none");
		svg.appendChild(doodle); }
	lastX = event.pageX; lastY = event.pageY; }

function upMouse(event) {
	moveMouse(event);
	if (0 != event.button) return;
	event.preventDefault();
	if (!pressed) console.error("lost mousedown?"); pressed = false;
	if (doodle) { doodle = null; return; }
	// svg.getIntersectionList is bounding-box based, hence useless
	// don't require precision clicks to erase
	var found = false;
	shapeAllResize(10,6);
	for ( var hit = document.elementFromPoint(clientX,clientY)
	      ; hit && hit.parentNode == svg
	      ; hit = document.elementFromPoint(clientX,clientY) ) {
		if (event.ctrlKey) while (svg.lastChild != hit)
			svg.removeChild(svg.lastChild);
		svg.removeChild(hit); found = true; }
	shapeAllResize(4,3);
	if (found) return;
	var dot = document.createElementNS(svgNS,"circle");
	dot.setAttribute("r",3);
	dot.setAttribute("cx",lastX);
	dot.setAttribute("cy",lastY);
 	dot.setAttribute("fill",normalColor);
	dot.setAttribute("stroke","none");
	svg.appendChild(dot); }

var focusX; var focusY; var focusOn;
function focusToMouse() {
	if (focusX == clientX && focusY == clientY ) return;
	focusX = clientX; focusY = clientY;
	svg.setAttribute("pointer-events","none");
	var hit = document.elementFromPoint(focusX,focusY);
	svg.setAttribute("pointer-events","visiblePainted");
	if (!hit || hit == focusOn) return;
	hit = focusTest( hit );
	if (hit) focusOn = hit; }
var focusTest = function(hit) {
	switch (hit.nodeName) {
	case "INPUT": case "BUTTON": case "SELECT": case "TEXTAREA":
		hit.focus(); return hit; }
	return null; }

function downKey(event) {
	if (event.keyCode == 17)
		shapeFindHilite(); }

function upKey(event) {
	if (event.keyCode == 17)
		shapeListColor(svg.firstChild,normalColor); }

// communication with the extension

var port = chrome.extension.connect({name:document.documentURI});

port.onDisconnect.addListener(function() {
	detachListeners();
	window.removeEventListener("resize",svgResize);
	document.body.removeChild(svg); });

port.onMessage.addListener(function(message) {
	switch (message) {
		case "attach": attachListeners(); break;
		case "detach": detachListeners(); break; } });

var isActive = false;
function attachListeners() { if (!isActive) {
	svg.setAttribute("pointer-events","visiblePainted");
	svg.addEventListener("mousedown",downMouse);
	svg.addEventListener("mousemove",moveMouse);
	svg.addEventListener("mouseup",upMouse);
	window.addEventListener("keydown",focusToMouse,true);
	window.addEventListener("keydown",downKey);
	window.addEventListener("keyup",upKey);
	isActive = true; }}
function detachListeners() { if (isActive) {
	svg.setAttribute("pointer-events","none");
	svg.removeEventListener("mousedown",downMouse);
	svg.removeEventListener("mousemove",moveMouse);
	svg.removeEventListener("mouseup",upMouse);
	window.removeEventListener("keydown",focusToMouse,true);
	window.removeEventListener("keydown",downKey);
	window.removeEventListener("keyup",upKey);
	isActive = false; }}

// ---------------------

if (/^http:\/\/www\.puzzlemix\.com\/playgrid/.test(document.documentURI)) {

	var clicks = []; var select = /^select_cell\((\d+)\)$/;
	var lefts = [null,"12%","32%","52%","12%","32%","52%","12%","32%","52%"];
	var tops =  [null,"55%","55%","55%","33%","33%","33%","11%","11%","11%"];

	for ( var cell = document.getElementById("gridcontainer").firstChild
	      ; cell ; cell = cell.nextSibling )
		if (cell.nodeType == 1/*element*/)
	{
		var click = select.exec(cell.getAttribute("onclick"));
		if (!click) continue;

		var index = Number(click[1]);
		if (!clicks[index]) clicks[index] = cell.onclick;
		else cell.onclick = clicks[index];

		for ( var part = cell.firstChild ; part ; part = part.nextSibling )
			if (part.nodeType == 1)
		{
			if (part.onclick) {
				console.error(part);
				alert("Unexpected click handler (see console)."); }
			part.onclick = cell.onclick;
			if ("numbcell" != part.getAttribute("class")) continue;
			index = Number(part.textContent);
			if (lefts[index]) part.style.left = lefts[index];
			if (tops[index]) part.style.top = tops[index];
		}			
	}
	var focusClick; var original = focusTest;
	focusTest = function(hit) {
		//console.log(hit);
		if (original(hit)) {
			//console.log("=input");
			hit.click(); return null; }
		var click = hit.onclick;
		if (!click) {
			//console.log("=noclick");
			return null; }
		if (click == focusClick) {
			//console.log("=already");
			return hit; }
		if (-1 != clicks.indexOf(click)) {
			//console.log("=new:"+click);
			focusClick = click; click(); return hit; }
		//console.log("=unknown:"+click);
		return null; }
	var keypressed = document.body.onkeydown;
	var keyDown32 = document.createEvent("KeyboardEvent");
	var keyCode32 = { get: function() { return 32; }};
	Object.defineProperty(keyDown32,'keyCode',keyCode32);
	Object.defineProperty(keyDown32,'which',keyCode32);
	keyDown32.initKeyboardEvent("keydown",true, true,null,
		false,false,false,false,32,32);
	document.body.onkeydown = function(event) {
		keypressed((event.keyCode == 107) ? keyDown32 : event); } }

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
			if (parent.nodeName == "OBJECT")
				parent.parentNode.replaceChild(embeds[i],parent); } }
	window.addEventListener("keydown",function(event) {
		if (event.keyCode == 107) port.postMessage("toggle"); });
 }

} // if not frameset

