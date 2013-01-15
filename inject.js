// Copyright © 2012-2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file for info.

"use strict";

function Doodle(svg)
{

var doodle = this;
var svgNS = 'http://www.w3.org/2000/svg';

if (svg.nodeName != 'svg')
	throw new Error("argument must an <svg> element");
if (svg.namespaceURI != svgNS)
	throw new Error("svg element isn't in the svg namespace");

var undoCTM = svg.ownerDocument.createElementNS(svgNS,"g");
function offsetFarthest(ctm) {
	var x = 0; var y = 0;
	for ( var e = svg ; e ; e = e.offsetParent ) {
		x -= e.offsetLeft; y -= e.offsetTop; }
	return ctm.translate(x,y); }
undoCTM.transform.baseVal.initialize(
	svg.createSVGTransformFromMatrix(offsetFarthest(svg.getCTM().inverse())) );
svg.appendChild(undoCTM);

svg = svg.ownerDocument.createElementNS(svgNS,"svg");
svg.setAttribute("width",999999999);
svg.setAttribute("height",999999999);
svg.setAttribute("cursor","crosshair");
svg.setAttribute("pointer-events","none");
svg.setAttribute("stroke-linejoin","round");
svg.setAttribute("stroke-linecap","round");
undoCTM.appendChild(svg);
this.__defineGetter__("svg",function(){return svg});

var input = svg.ownerDocument.createElementNS(svgNS,"rect");
input.setAttribute("width","100%");
input.setAttribute("height","100%");
input.setAttribute("stroke","none");
input.setAttribute("fill","none");
input.setAttribute("pointer-events","none");
svg.appendChild(input);

var group = svg.ownerDocument.createElementNS(svgNS,"g");
svg.appendChild(group);

var rubberRect = svg.ownerDocument.createElementNS(svgNS,"rect");
this.__defineGetter__("rubber",function(){return rubberRect});
rubberRect.setAttribute("fill","none");
rubberRect.setAttribute("stroke-dasharray","5");
rubberRect.setAttribute("pointer-events","none");
svg.appendChild(rubberRect);

this.color = {
	get normal() {
		return svg.getAttribute("stroke"); },
	set normal(x) {
		svg.setAttribute("stroke", x);
		svg.setAttribute("fill", x); },
	get eraser() {
		return rubberRect.getAttribute("stroke"); },
	set eraser(x) {
		rubberRect.setAttribute("stroke",x); } };
this.color.normal = "#333";
this.color.eraser = "#E9B";

var baseRadius = {
	circle: function(c) { c.setAttribute("r",1.5); },
	path: function(p) { p.setAttribute("stroke-width",3); } };
var pickRadius = {
	circle: function(c) { c.hit = false; c.setAttribute("r",4.5); },
	path: function(p) { p.hit = false; p.setAttribute("stroke-width",6); } };

var normalColor = {
	circle: function(c) { c.setAttribute("fill","inherit"); },
	path: function(p) { p.setAttribute("stroke","inherit"); } };
var eraserColor = {
	circle: function(c) { c.setAttribute("fill",doodle.color.eraser); },
	path: function(p) { p.setAttribute("stroke",doodle.color.eraser); } };

function oneShape(shape,actionMap) {
	var action = actionMap[shape.nodeName];
	if (action) action(shape); }
function someShapes(shape,actionMap) {
	for ( ; shape ; shape = shape.nextSibling )
		oneShape(shape,actionMap); }
function allShapes(actionMap) {
	someShapes(group.firstChild,actionMap); }

var rubberArea = svg.createSVGRect();
function rubberSet(x,y,w,h) {
	rubberRect.setAttribute("x",rubberArea.x=x);
	rubberRect.setAttribute("y",rubberArea.y=y);
	rubberRect.setAttribute("width",rubberArea.width=w);
	rubberRect.setAttribute("height",rubberArea.height=h); }
rubberSet(-1,-1,0,0);

function rubberErase() {
	var shapes = svg.getEnclosureList(rubberArea,group);
	for ( var index = shapes.length - 1 ; index >= 0 ; --index )
		group.removeChild(shapes[index]);
	allShapes(normalColor); }

var mouseXY = {
	pageX: -1, pageY: -1, clientX: -1, clientY: -1,
	downX: -1, downY: -1, path: null };

mouseXY.down = function() {
	this.downX = this.pageX; this.downY = this.pageY; }

mouseXY.hit = function() {
	return svg.ownerDocument.elementFromPoint(this.clientX,this.clientY); }

this.hit = function() {
	var inputWas = input.getAttribute("pointer-events");
	input.setAttribute("pointer-events","none");
	var svgWas = svg.getAttribute("pointer-events");
	svg.setAttribute("pointer-events","none");
	var hit = mouseXY.hit();
	svg.setAttribute("pointer-events",svgWas);
	input.setAttribute("pointer-events",inputWas);
	return hit; }

mouseXY.erase = function(subsequentSiblings) {
	var found = false; allShapes(pickRadius);
	for ( var hit = this.hit()
	      ; hit && hit.parentNode == group
	      ; hit = this.hit() ) {
		if (subsequentSiblings) while (group.lastChild != hit)
			group.removeChild(group.lastChild);
		group.removeChild(hit); found = true; }
	allShapes(baseRadius); return found; }

mouseXY.eraseElseDot = function() {
	if (this.erase(false)) return;
	var c = svg.ownerDocument.createElementNS(svgNS,"circle");
	c.setAttribute("cx",this.pageX);
	c.setAttribute("cy",this.pageY);
	c.setAttribute("stroke","none");
	baseRadius.circle(c);
	normalColor.circle(c);
	group.appendChild(c); }

mouseXY.pathMore = function() {
	var s = this.path.pathSegList;
	var p = s.getItem(s.numberOfItems-1);
	if (p.x != this.pageX || p.y != this.pageY)
		s.appendItem(
			this.path.createSVGPathSegLinetoAbs(this.pageX,this.pageY)); }

mouseXY.pathStart = function() {
	var p = svg.ownerDocument.createElementNS(svgNS,"path");
	p.pathSegList.appendItem(
		p.createSVGPathSegMovetoAbs(this.downX,this.downY));
	p.setAttribute("fill","none");
	baseRadius.path(p);
	normalColor.path(p);
	group.appendChild(p);
	this.path = p;
	this.pathMore(); }

function nearby(one,two) {
	var x = one.x - two.x; var y = one.y - two.y;
	return 9 >= x*x + y*y; }

mouseXY.pathEnd = function() {
	if (this.path == null) return;
	this.path.setAttribute("pointer-events","none");
	var s = this.path.pathSegList;
	var n = s.numberOfItems;
	var click = ( n == 1
		|| (n == 2 && nearby(s.getItem(1),s.getItem(0))) );
	if (click && this.erase(false))
		group.removeChild(this.path);
	else
		this.path.removeAttribute("pointer-events");
	this.path = null; }

mouseXY.hilite = function() {
	allShapes(pickRadius);
	for ( var hit = this.hit()
	      ; hit && hit.parentNode == group
	      ; hit = this.hit() ) {
		hit.setAttribute("pointer-events","none");
		hit.hit = true; }
	var found = false; var shape = group.firstChild;
	for ( ; shape ; shape = shape.nextSibling ) {
		oneShape(shape,baseRadius);
		if (shape.hit) {
			shape.removeAttribute("pointer-events");
			found = true; }
		oneShape(shape,found ? eraserColor : normalColor); } }

mouseXY.rubber = function() {
	rubberSet(Math.min(this.downX,this.pageX),
	          Math.min(this.downY,this.pageY),
	          Math.abs(this.pageX-this.downX),
	          Math.abs(this.pageY-this.downY));
	allShapes(normalColor);
	var shapes = svg.getEnclosureList(rubberArea,group);
	for ( var index = shapes.length - 1 ; index >= 0 ; --index )
		oneShape(shapes[index],eraserColor); }

function State(name,mouse,ctrl) {
	this.name = name; this.mouse = mouse; this.ctrl = ctrl; }
State.prototype.enter = function() {}
State.prototype.leave = function() {}
State.prototype.mousemove = function() {}
State.prototype.mousedown = function() {}
State.prototype.mouseup = function() {}
State.prototype.ctrldown = function() {}
State.prototype.ctrlup = function() {}

var idleState = new State("idle",false,false);
var pressedState = new State("pressed",true,false);
var drawingState = new State("drawing",true,false);
var hilitingState = new State("hiliting",false,true);
var erasingState = new State("erasing",true,true);
var rubberState = new State("rubber",true,true);
var cancelState = new State("cancel",true,false);

var theState = idleState;
this.__defineGetter__("state",function(){return theState.name});

State.prototype.go = function() {
	theState.leave(); this.enter(); theState = this; }

mouseXY.move = function(event) {
	if (event.ctrlKey) { if (!theState.ctrl) theState.ctrldown(); }
	else /*!event.ctl*/{ if (theState.ctrl) theState.ctrlup(); }
	if (this.pageX==event.pageX && this.pageY==event.pageY) return;
	this.pageX = event.pageX; this.pageY = event.pageY;
	this.clientX = event.clientX; this.clientY = event.clientY;
	theState.mousemove(); }

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

cancelState.mouseup = function() { idleState.go(); }
cancelState.ctrldown = function() { mouseXY.down(); erasingState.go(); }

function downMouse(event) {
	mouseXY.move(event);
	if (0 != event.button) return;
	event.preventDefault();
	mouseXY.down();
	theState.mousedown(); }

function moveMouse(event) {
	if (theState.mouse && event.which != 1) {
		var ctrl = theState.ctrl
		if (ctrl) theState.ctrlup();
		theState.mouseup();
		if (ctrl) theState.ctrldown(); }
	mouseXY.move(event); }

function upMouse(event) {
	mouseXY.move(event);
	if (0 != event.button) return;
	event.preventDefault();
	theState.mouseup(); }

function downKey(event) {
	if (event.keyCode == 17/*ctrl*/)
		theState.ctrldown(); }

function upKey(event) {
	if (event.keyCode == 17/*ctrl*/)
		theState.ctrlup(); }

var listening = false;
this.__defineGetter__("listening",function(){return listening});
this.attach = function() { if (!listening) {
	svg.setAttribute("pointer-events","visiblePainted");
	input.setAttribute("pointer-events","fill");
	svg.addEventListener("mousedown",downMouse);
	svg.addEventListener("mousemove",moveMouse);
	svg.addEventListener("mouseup",upMouse);
	svg.addEventListener("keydown",downKey);
	svg.addEventListener("keyup",upKey);
	listening = true; }}
this.detach = function() { if (listening) {
	svg.setAttribute("pointer-events","none");
	input.setAttribute("pointer-events","none");
	svg.removeEventListener("mousedown",downMouse);
	svg.removeEventListener("mousemove",moveMouse);
	svg.removeEventListener("mouseup",upMouse);
	svg.removeEventListener("keydown",downKey);
	svg.removeEventListener("keyup",upKey);
	listening = false; }}

}// end Doodle constructor

function Doodledoku(element,window)
{
var doodledoku = this;
var positioning = null;
var div = null;

function validateAndSetPositioning() {
	var style = window.getComputedStyle(element);
	if ((style.position != 'static' && style.position != 'relative')
		|| style.top != 'auto' || style.left != 'auto'
		|| style.right != 'auto' || style.bottom != 'auto' )
		throw new Error("unexpected positioning on element");
	positioning = element.style.position;
	element.style.position = 'relative'; }

var svg = element.ownerDocument.createElementNS(
	'http://www.w3.org/2000/svg','svg');
svg.setAttribute("zoomAndPan","disable");
svg.setAttribute("pointer-events","none");
this.__defineGetter__("svg",function(){return svg});

function svgResize() {
	// only use when element is body
	svg.style.width = 0; svg.style.height = 0;
	svg.style.width = element.scrollWidth;
	svg.style.height = element.scrollHeight; }

if (element != element.ownerDocument.body) {
	validateAndSetPositioning();
	div = element.ownerDocument.createElement('div');
	div.style.zIndex = -999999999;
	div.style.position = "absolute";
	div.style.top = 0;
	div.style.left = 0;
	div.style.bottom = 0;
	div.style.right = 0;
	element.appendChild(div);
	div.appendChild(svg); }
else /* element is document body */ {
	svg.style.zIndex = 999999999;
	svg.style.position = "absolute";
	svg.style.top = 0;
	svg.style.left = 0;
	element.appendChild(svg);
	window.addEventListener("resize",svgResize);
	svgResize(); }

var doodle = new Doodle(svg);
this.__defineGetter__("doodle",function(){return doodle});
this.__defineGetter__("color",function(){return doodle.color});

function focusToMouse(event) {
	if (div) div.style.zIndex = -999999999;
	var hit = doodle.hit();
	if (div) div.style.zIndex = 999999999;
	if (hit) hit.focus(); }

function attach() {
	doodle.attach();
	if (div) div.style.zIndex = 999999999;
	window.addEventListener("keydown",focusToMouse,true); }

function detach() {
	doodle.detach();
	if (div) div.style.zIndex = -999999999;
	window.removeEventListener("keydown",focusToMouse,true); }

function destroy() {
	detach();
	if (div) {
		element.removeChild(div);
		element.style.position = positioning;
		positioning = null;
		div = null; }
	else {
		window.removeEventListener("resize",svgResize);
		element.removeChild(svg); }
	svg = undefined; doodle = undefined; }

// communication with the extension

var port = chrome.extension.connect();

port.onDisconnect.addListener(destroy);

this.destroy = function() {
	port.disconnect(); // surprisingly does not call onDisconnect
	destroy(); };

port.onMessage.addListener(function(message) {
	switch (message) {
	case "attach": attach(); break;
	case "detach": detach(); break; } });

this.toggle = function() { port.postMessage("toggle"); }

}// end Doodledoku constructor

if (document.body.nodeName != 'FRAMESET')
	window.doodledoku = new Doodledoku(document.body,window);

"OK";

