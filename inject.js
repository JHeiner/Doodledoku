
var svgNS = "http://www.w3.org/2000/svg";

var svg = document.createElementNS(svgNS,"svg");
svg.setAttribute("preserveAspectRatio","none");
svg.setAttribute("zoomAndPan","disable");
svg.setAttribute("pointer-events","none");
svg.setAttribute("cursor","crosshair"); // cool: affected by pointer-events
svg.style.position = "absolute";
svg.style.zIndex = 999999999;
svg.style.top = 0; // origin at absolute 0,0 means that clientX and
svg.style.left = 0; // pageX are same, as are clientY and pageY
svg.setAttribute("stroke-linejoin","round");
svg.setAttribute("stroke-linecap","round");
svg.setAttribute("stroke","none");
svg.setAttribute("fill","none");
document.body.appendChild(svg);

var baseRadius = {
	circle: function(c) { c.setAttribute("r",1.5); },
	path: function(p) { p.setAttribute("stroke-width",3); } };
var pickRadius = {
	circle: function(c) { c.hit = false; c.setAttribute("r",4.5); },
	path: function(p) { p.hit = false; p.setAttribute("stroke-width",6); } };

var normalColor = {
	circle: function(c) { c.setAttribute("fill","#333"); },
	path: function(p) { p.setAttribute("stroke","#333"); } };
var eraserColor = {
	circle: function(c) { c.setAttribute("fill","#E9B"); },
	path: function(p) { p.setAttribute("stroke","#E9B"); } };

function oneShape(shape,actionMap) {
	var action = actionMap[shape.nodeName];
	if (action) action(shape); }
function someShapes(shape,actionMap) {
	for ( ; shape ; shape = shape.nextSibling )
		oneShape(shape,actionMap); }
function allShapes(actionMap) {
	someShapes(svg.firstChild.nextSibling,actionMap); }

var rubberRect = document.createElementNS(svgNS,"rect");
rubberRect.setAttribute("stroke","#E9B");
rubberRect.setAttribute("stroke-dasharray","5");
rubberRect.setAttribute("pointer-events","none");
svg.appendChild(rubberRect);

var rubberArea = svg.createSVGRect();
function rubberSet(x,y,w,h) {
	rubberRect.setAttribute("x",rubberArea.x=x);
	rubberRect.setAttribute("y",rubberArea.y=y);
	rubberRect.setAttribute("width",rubberArea.width=w);
	rubberRect.setAttribute("height",rubberArea.height=h); }
rubberSet(-1,-1,0,0);

function rubberErase() {
	var shapes = svg.getEnclosureList(rubberArea,svg);
	for ( index = shapes.length - 1 ; index >= 0 ; --index )
		svg.removeChild(shapes[index]);
	allShapes(normalColor); }

var mouseXY = {
	lastX: -1, lastY: -1, prevX: -1, prevY: -1,
	downX: -1, downY: -1, path: null,
	focusX: -1, focusY: -1, input: null };

mouseXY.down = function() {
	this.downX = this.lastX; this.downY = this.lastY; }

function focusTest(hit) {
	switch (hit.nodeName) {
	case "INPUT": case "BUTTON": case "SELECT": case "TEXTAREA":
		hit.focus(); return hit; }
	return null; }
mouseXY.focus = function() {
	if (this.focusX==this.lastX && this.focusY==this.lastY) return;
	this.focusX = this.lastX; this.focusY = this.lastY;
	svg.setAttribute("pointer-events","none");
	var hit = document.elementFromPoint(this.focusX,this.focusY);
	svg.setAttribute("pointer-events","visiblePainted");
	if (!hit || hit == this.input) return;
	hit = focusTest( hit );
	if (hit) this.input = hit; }

mouseXY.erase = function(subsequentSiblings) {
	var found = false; allShapes(pickRadius);
	for ( var hit = document.elementFromPoint(this.lastX,this.lastY)
	      ; hit && hit.parentNode == svg
	      ; hit = document.elementFromPoint(this.lastX,this.lastY) ) {
		if (subsequentSiblings) while (svg.lastChild != hit)
			svg.removeChild(svg.lastChild);
		svg.removeChild(hit); found = true; }
	allShapes(baseRadius); return found; }

mouseXY.eraseElseDot = function() {
	if (this.erase(false)) return;
	var c = document.createElementNS(svgNS,"circle");
	c.setAttribute("cx",this.lastX);
	c.setAttribute("cy",this.lastY);
	baseRadius.circle(c);
	normalColor.circle(c);
	svg.appendChild(c); }

mouseXY.pathMore = function() {
	var d = this.path.getAttribute("d")
	    + " "+(this.lastX-this.prevX)+","+(this.lastY-this.prevY);
	this.path.setAttribute("d",d); }

mouseXY.pathStart = function() {
	var p = document.createElementNS(svgNS,"path");
	p.setAttribute("d","m "+this.downX+","+this.downY);
	baseRadius.path(p);
	normalColor.path(p);
	svg.appendChild(p);
	this.path = p;
	this.pathMore(); }

mouseXY.pathEnd = function() {
	this.path = null; }

mouseXY.hilite = function() {
	allShapes(pickRadius);
	for ( var hit = document.elementFromPoint(this.lastX,this.lastY)
	      ; hit && hit.parentNode == svg
	      ; hit = document.elementFromPoint(this.lastX,this.lastY) ) {
		hit.setAttribute("pointer-events","none");
		hit.hit = true; found = true; }
	var found = false; var shape = svg.firstChild.nextSibling;
	for ( ; shape ; shape = shape.nextSibling ) {
		oneShape(shape,baseRadius);
		if (shape.hit) {
			shape.removeAttribute("pointer-events");
			found = true; }
		oneShape(shape,found ? eraserColor : normalColor); } }

mouseXY.rubber = function() {
	rubberSet(Math.min(this.downX,this.lastX),
	          Math.min(this.downY,this.lastY),
	          Math.abs(this.lastX-this.downX),
	          Math.abs(this.lastY-this.downY));
	allShapes(normalColor);
	var shapes = svg.getEnclosureList(rubberArea,svg);
	for ( index = shapes.length - 1 ; index >= 0 ; --index )
		oneShape(shapes[index],eraserColor); }

function State(name,mouse,ctrl) {
	this.name = name; this.mouse = mouse; this.ctrl = ctrl; }
State.prototype.enter = function() {}
State.prototype.leave = function() {}
State.prototype.missingTransition = function(input) {
	console.error("missingTransition:"+this.name+"."+input); }
State.prototype.mousemove = function() { this.missingTransition("mousemove"); }
State.prototype.mousedown = function() { this.missingTransition("mousedown"); }
State.prototype.mouseup = function() { this.missingTransition("mouseup"); }
State.prototype.ctrldown = function() { this.missingTransition("ctrldown"); }
State.prototype.ctrlup = function() { this.missingTransition("ctrlup"); }

var idleState = new State("idle",false,false);
var pressedState = new State("pressed",true,false);
var drawingState = new State("drawing",true,false);
var hilitingState = new State("hiliting",false,true);
var erasingState = new State("erasing",true,true);
var rubberState = new State("rubber",true,true);
var cancelState = new State("cancel",true,false);

var theState = idleState;

State.prototype.go = function() {
	//console.log(theState.name+"->"+this.name);
	theState.leave(); this.enter(); theState = this; }

mouseXY.move = function(event) {
	if (this.lastX==event.pageX && this.lastY==event.pageY) return;
	this.prevX = this.lastX; this.lastX = event.pageX;
	this.prevY = this.lastY; this.lastY = event.pageY;
	theState.mousemove(); }

idleState.mousemove = function() {}
idleState.mousedown = function() { pressedState.go(); }
idleState.ctrldown = function() { hilitingState.go(); }

pressedState.mousemove = function() { drawingState.go(); }
pressedState.mouseup = function() { mouseXY.eraseElseDot(); idleState.go(); }
pressedState.ctrldown = function() { erasingState.go(); }

drawingState.enter = function() { mouseXY.pathStart(); }
drawingState.mousemove = function() { mouseXY.pathMore(); }
drawingState.leave = function() { mouseXY.pathEnd(); }
drawingState.mouseup = function() { idleState.go(); }
drawingState.ctrldown = function() { mouseXY.down(); erasingState.go(); }

hilitingState.enter = function() { mouseXY.hilite(); }
hilitingState.mousemove = function() { mouseXY.hilite(); }
hilitingState.leave = function() { allShapes(normalColor); }
hilitingState.ctrlup = function() { idleState.go(); }
hilitingState.mousedown = function() { erasingState.go(); }

erasingState.enter = function() { mouseXY.hilite(); }
erasingState.mousemove = function() { rubberState.go(); }
erasingState.leave = function() { allShapes(normalColor); }
erasingState.mouseup = function() { mouseXY.erase(true); hilitingState.go(); }
erasingState.ctrlup = function() { pressedState.go(); }

rubberState.enter = function() { mouseXY.rubber(); }
rubberState.mousemove = function() { mouseXY.rubber(); }
rubberState.leave = function() { allShapes(normalColor); rubberSet(-1,-1,0,0); }
rubberState.mouseup = function() { rubberErase(); hilitingState.go(); }
rubberState.ctrlup = function() { cancelState.go(); }

cancelState.mousemove = function() {}
cancelState.mouseup = function() { idleState.go(); }
cancelState.ctrldown = function() { mouseXY.down(); erasingState.go(); }

function downMouse(event) {
	mouseXY.move(event);
	if (0 != event.button) return;
	event.preventDefault();
	mouseXY.down();
	theState.mousedown(); }

function moveMouse(event) {
	mouseXY.move(event); }

function upMouse(event) {
	mouseXY.move(event);
	if (0 != event.button) return;
	event.preventDefault();
	theState.mouseup(); }

function focusToMouse(event) {
	mouseXY.focus(); }

function downKey(event) {
	if (event.keyCode == 17/*ctrl*/)
		theState.ctrldown(); }

function upKey(event) {
	if (event.keyCode == 17/*ctrl*/)
		theState.ctrlup(); }

function svgResize() {
	// todo? stretch doodles in clever ways?
	svg.style.width = 0; svg.style.height = 0;
	svg.style.width = document.body.scrollWidth;
	svg.style.height = document.body.scrollHeight; }
window.addEventListener("resize",svgResize);
svgResize();

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

