
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

function eraseAt(x,y,subsequent) {
	var found = false;
	for ( var hit = document.elementFromPoint(x,y)
	      ; hit && hit.parentNode == svg
	      ; hit = document.elementFromPoint(x,y) ) {
		if (subsequent) while (svg.lastChild != hit)
			svg.removeChild(svg.lastChild);
		svg.removeChild(hit); found = true; }
	return found; }

var pressed = false; // is the primary mouse button down?
var doodle = null; // the path currently being drawn
var lastX = 0; var lastY = 0; // pageX,pageY of last doodle point

// keyboard events don't have mouse position (needed for elementFromPoint)
var clientX = 0; var clientY = 0; // so stash them here in all mouse events

function downMouse(event) {
	clientX = event.clientX; clientY = event.clientY;
	if (0 != event.button) return;
	if (pressed || doodle) { console.error("lost mouseup?"); doodle = null; }
	lastX = event.pageX; lastY = event.pageY;
	pressed = true; event.preventDefault(); }

function moveMouse(event) {
	clientX = event.clientX; clientY = event.clientY;
	if (!pressed) return;
	event.preventDefault();
	var deltaX = event.pageX - lastX; var deltaY = event.pageY - lastY;
	if (deltaX*deltaX + deltaY*deltaY < 17) return;
	if (doodle)
		doodle.setAttribute("d",doodle.getAttribute("d")
		                    + " L "+event.pageX+" "+event.pageY);
	else {
		doodle = document.createElementNS(svgNS,"path");
		doodle.setAttribute("d","M "+lastX+" "+lastY
		                    + " L "+event.pageX+" "+event.pageY);
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
	var found = false; var subsequent = event.ctrlKey;
	if (eraseAt(clientX,clientY,subsequent)) found = true;
	if (eraseAt(clientX+3,clientY+3,subsequent)) found = true;
	if (eraseAt(clientX-3,clientY-3,subsequent)) found = true;
	if (eraseAt(clientX-3,clientY+3,subsequent)) found = true;
	if (eraseAt(clientX+3,clientY-3,subsequent)) found = true;
	if (found) return;
	var dot = document.createElementNS(svgNS,"circle");
	dot.setAttribute("r",3);
	dot.setAttribute("cx",lastX);
	dot.setAttribute("cy",lastY);
 	dot.setAttribute("fill","black");
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


/*
if (/^http:\/\/www\.puzzlemix\.com\/playgrid/.test(document.documentURI)) {
	focusTest = function(was,hit) {
		// if (hit.nodeName == "INPUT") { hit.click(); return hit; } ???
		var cell = hit;
		while (cell && ! /select_cell\(\d+\)/.test(cell.onclick))
			cell = cell.parentNode;
		if (cell && was != cell) {
			/x*console.log(cell.id+".click");*x/ cell.click(); return cell; }
		return was; }
	var original = document.body.onkeydown;
	var tracking = function(event) { focusToMouse(); original(event); }
	attachKeyboard = function() { document.body.onkeydown = tracking; };
	detachKeyboard = function() { document.body.onkeydown = original; }; }
else
if (/^http:\/\/www\.sudoku\.org\.uk\/Puzzles/.test(document.documentURI)) {
/x*
for <object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000">s
  var param = document.createElement('param');
    param.setAttribute('name','wmode');
    param.setAttribute('value','opaque');
    obj.appendChild(param);
  var wrapper = document.createElement('div');
    obj.parentNode.replaceChild(wrapper,obj.parentNode);
	wrapper.appendChild(obj)
*x/
	var embeds = document.getElementsByTagName("EMBED")
	for (var i = embeds.length - 1 ; i >= 0 ; --i ) {
		if (embeds[i].getAttribute("type")=="application/x-shockwave-flash") {
			embeds[i].setAttribute("wmode","opaque");
			var parent = embeds[i].parentElement;
			while (parent.nodeName == "OBJECT") {
				var grandp = parent.parentElement;
				grandp.replaceChild(embeds[i],parent);
				parent = grandp; } } } }
*/

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
	isActive = true; }}
function detachListeners() { if (isActive) {
	svg.setAttribute("pointer-events","none");
	svg.removeEventListener("mousedown",downMouse);
	svg.removeEventListener("mousemove",moveMouse);
	svg.removeEventListener("mouseup",upMouse);
	window.removeEventListener("keydown",focusToMouse,true);
	isActive = false; }}

} // if not frameset

