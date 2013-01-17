// Copyright © 2012-2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file for info.

"use strict";

function Doodle(viewport)
{
var doodle = this;

var svgNS = 'http://www.w3.org/2000/svg';
if (viewport.nodeName != 'svg' || viewport.namespaceURI != svgNS)
	throw new Error("viewport must be a <svg> element");
this.viewport = {
	element: viewport,
	get document() {
		return this.element.ownerDocument; },
	createSVG: function(name) {
		return this.document.createElementNS(svgNS,name); },
	hit: function(clientX,clientY) {
		return this.document.elementFromPoint(clientX,clientY); },
	get inverseCTM() {
		var m = this.element.getCTM().inverse();
		for ( var e = this.element ; e ; e = e.offsetParent )
			m = m.translate(-e.offsetLeft,-e.offsetTop);
		return this.element.createSVGTransformFromMatrix(m); } };

this.structure = {
	undoCTM: doodle.viewport.createSVG('g'),
	// inside of undoCTM the coordinates match the page coordinates
	enclosed: doodle.viewport.createSVG('svg'),
	// enclosed is needed so we can call getEnclosureList...
	enclosureList: function(area,parent) {
		return this.enclosed.getEnclosureList(area,parent); },
	initialize: function() {
		this.undoCTM.transform.baseVal.initialize(doodle.viewport.inverseCTM);
		this.enclosed.setAttribute('width',999999999);
		this.enclosed.setAttribute('height',999999999);
		this.enclosed.setAttribute('cursor','crosshair'); } };

this.input = {
	element: doodle.viewport.createSVG('rect'),
	// input catches mouse events in the blank (un-doodled) areas
	get enclosed() {
		return doodle.structure.enclosed; },
	get enabled() {
		return (this.element.getAttribute('pointer-events') != 'none'
			|| this.enclosed.getAttribute('pointer-events') != 'none'); },
	disable: function() {
		if ( ! this.enabled ) return false; else {
			this.element.setAttribute('pointer-events','none');
			this.enclosed.setAttribute('pointer-events','none');
			return true; } },
	enable: function() {
		this.element.setAttribute('pointer-events','fill');
		this.enclosed.setAttribute('pointer-events','visiblePainted'); },
	initialize: function() {
		this.element.setAttribute('width','100%');
		this.element.setAttribute('height','100%');
		this.element.setAttribute('stroke','none');
		this.element.setAttribute('fill','none');
		this.disable(); } };

this.doodles = {
	element: doodle.viewport.createSVG('g'),
	// keeps the doodles separate from input and rubber rectangle
	baseRadius: {
		circle: function(c) {
			c.setAttribute('r',doodle.radius.base); },
		path: function(p) {
			p.setAttribute('stroke-width',2*doodle.radius.base); } },
	pickRadius: {
		circle: function(c) {
			c.hit = false;
			c.setAttribute('r',doodle.radius.pick); },
		path: function(p) {
			p.hit = false;
			p.setAttribute('stroke-width',2*doodle.radius.pick); } },
	normalColor: {
		circle: function(c) {
			c.setAttribute('fill','inherit');
			c.removeAttribute('fill'); },
		path: function(p) {
			p.setAttribute('stroke','inherit');
			p.removeAttribute('stroke'); } },
	eraserColor: {
		circle: function(c) {
			c.setAttribute('fill',doodle.color.eraser); },
		path: function(p) {
			p.setAttribute('stroke',doodle.color.eraser); } },
	oneShape: function(shape,actionMap) {
		actionMap[shape.nodeName](shape); },
	someShapes: function(shape,actionMap) {
		for ( ; shape ; shape = shape.nextSibling )
			this.oneShape(shape,actionMap); },
	allShapes: function(actionMap) {
		this.someShapes(this.element.firstChild,actionMap); },
	get enclosed() {
		return doodle.structure.enclosed; },
	hilightArea: function(area) {
		this.allShapes(this.normalColor);
		var shapes = doodle.structure.enclosureList(area,this.element);
		for ( var index = shapes.length - 1 ; index >= 0 ; --index )
			this.oneShape(shapes.item(index),this.eraserColor); },
	eraseArea: function(area) {
		var shapes = doodle.structure.enclosureList(area,this.element);
		for ( var index = shapes.length - 1 ; index >= 0 ; --index )
			this.element.removeChild(shapes.item(index));
		this.allShapes(this.normalColor); },
	hilightMouseXY: function() {
		this.allShapes(this.pickRadius);
		for ( var hit = doodle.mouseXY.hit()
			  ; hit && hit.parentNode == this.element
			  ; hit = doodle.mouseXY.hit() ) {
			hit.setAttribute('pointer-events','none');
			hit.hit = true; }
		var found = false; var shape = this.element.firstChild;
		for ( ; shape ; shape = shape.nextSibling ) {
			this.oneShape(shape,this.baseRadius);
			if (shape.hit) {
				shape.removeAttribute('pointer-events');
				found = true; }
			this.oneShape(shape,found?this.eraserColor:this.normalColor); } },
	eraseMouseXY: function(subsequentSiblings) {
		var found = false; this.allShapes(this.pickRadius);
		for ( var hit = doodle.mouseXY.hit()
			  ; hit && hit.parentNode == this.element
			  ; hit = doodle.mouseXY.hit() ) {
			if (subsequentSiblings) while (this.element.lastChild != hit)
				this.element.removeChild(this.element.lastChild);
			this.element.removeChild(hit); found = true; }
		this.allShapes(this.baseRadius); return found; },
	initialize: function() {
		this.element.setAttribute('stroke-linejoin','round');
		this.element.setAttribute('stroke-linecap','round'); } };

this.rubber = {
	element: doodle.viewport.createSVG('rect'),
	// visible part of the rubber rectangle
	area: viewport.createSVGRect(),
	// just the geometry of the rubber rectangle
	set: function(x1,y1,x2,y2) {
		this.element.setAttribute('width', this.area.width = Math.abs(x2-x1));
		this.element.setAttribute('height', this.area.height = Math.abs(y2-y1));
 		this.element.setAttribute('x', this.area.x = Math.min(x1,x2));
		this.element.setAttribute('y', this.area.y = Math.min(y1,y2)); },
	hide: function() {
		this.set(-1,-1,-1,-1); },
	hilight: function() {
		doodle.doodles.hilightArea(this.area); },
	erase: function() {
		doodle.doodles.eraseArea(this.area); },
	initialize: function() {
		this.element.setAttribute('fill','none');
		this.element.setAttribute('stroke-dasharray','5');
		this.element.setAttribute('pointer-events','none');
		this.hide(); } };

this.viewport.element.appendChild(this.structure.undoCTM);
this.structure.undoCTM.appendChild(this.structure.enclosed);
this.structure.enclosed.appendChild(this.input.element);
this.structure.enclosed.appendChild(this.doodles.element);
this.structure.enclosed.appendChild(this.rubber.element);

this.structure.initialize();
this.input.initialize();
this.doodles.initialize();
this.rubber.initialize();

var baseRadius = 1.5; var pickRadius = 4.5;
this.radius = {
	get base() {
		return baseRadius; },
	set base(x) {
		baseRadius = x;
		doodle.doodles.allShapes(doodle.doodles.baseRadius); },
	get pick() {
		return pickRadius; },
	set pick(x) {
		pickRadius = x; } };

this.color = {
	get normal() {
		return doodle.doodles.element.getAttribute('stroke'); },
	set normal(x) {
		doodle.doodles.element.setAttribute('stroke', x);
		doodle.doodles.element.setAttribute('fill', x); },
	get eraser() {
		return doodle.rubber.element.getAttribute('stroke'); },
	set eraser(x) {
		doodle.rubber.element.setAttribute('stroke',x); } };

this.color.normal = '#333';
this.color.eraser = '#E9B';

var mouseXY = {
	pageX: -1, pageY: -1, clientX: -1, clientY: -1,
	downX: -1, downY: -1, path: null };

mouseXY.down = function() {
	this.downX = this.pageX; this.downY = this.pageY; }

mouseXY.hit = function() {
	return doodle.viewport.hit(this.clientX,this.clientY); }

mouseXY.eraseElseDot = function() {
	if (doodle.doodles.eraseMouseXY(false)) return;
	var c = doodle.viewport.createSVG('circle');
	c.setAttribute('cx',this.pageX);
	c.setAttribute('cy',this.pageY);
	c.setAttribute('stroke','none');
	doodle.doodles.baseRadius.circle(c);
	doodle.doodles.normalColor.circle(c);
	doodle.doodles.element.appendChild(c); }

mouseXY.pathMore = function() {
	var s = this.path.pathSegList;
	var p = s.getItem(s.numberOfItems-1);
	if (p.x != this.pageX || p.y != this.pageY)
		s.appendItem(
			this.path.createSVGPathSegLinetoAbs(this.pageX,this.pageY)); }

mouseXY.pathStart = function() {
	var p = doodle.viewport.createSVG('path');
	p.pathSegList.appendItem(
		p.createSVGPathSegMovetoAbs(this.downX,this.downY));
	p.setAttribute('fill','none');
	doodle.doodles.baseRadius.path(p);
	doodle.doodles.normalColor.path(p);
	doodle.doodles.element.appendChild(p);
	this.path = p;
	this.pathMore(); }

function nearby(one,two) {
	var x = one.x - two.x; var y = one.y - two.y;
	return 10 >= x*x + y*y; }

mouseXY.pathEnd = function() {
	if (this.path == null) return;
	this.path.setAttribute('pointer-events','none');
	var s = this.path.pathSegList;
	var n = s.numberOfItems;
	var click = ( n == 1
		|| (n == 2 && nearby(s.getItem(1),s.getItem(0))) );
	if (click && doodle.doodles.eraseMouseXY(false))
		doodles.removeChild(this.path);
	else
		this.path.removeAttribute('pointer-events');
	this.path = null; }

mouseXY.rubber = function() {
	doodle.rubber.set(this.downX,this.downY,this.pageX,this.pageY);
	doodle.rubber.hilight(); }

function State(name,mouse,ctrl) {
	this.name = name; this.mouse = mouse; this.ctrl = ctrl; }
State.prototype.enter = function() {}
State.prototype.leave = function() {}
State.prototype.mousemove = function() {}
State.prototype.mousedown = function() {}
State.prototype.mouseup = function() {}
State.prototype.ctrldown = function() {}
State.prototype.ctrlup = function() {}

var idleState = new State('idle',false,false);
var pressedState = new State('pressed',true,false);
var drawingState = new State('drawing',true,false);
var hilitingState = new State('hiliting',false,true);
var erasingState = new State('erasing',true,true);
var rubberState = new State('rubber',true,true);
var cancelState = new State('cancel',true,false);

var theState = idleState;

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

hilitingState.enter = function() { doodle.doodles.hilightMouseXY(); }
hilitingState.mousemove = function() { doodle.doodles.hilightMouseXY(); }
hilitingState.leave = function() { doodle.doodles.allShapes(doodle.doodles.normalColor); }
hilitingState.ctrlup = function() { idleState.go(); }
hilitingState.mousedown = function() { erasingState.go(); }

erasingState.enter = function() { doodle.doodles.hilightMouseXY(); }
erasingState.mousemove = function() { rubberState.go(); }
erasingState.leave = function() { doodle.doodles.allShapes(doodle.doodles.normalColor); }
erasingState.mouseup = function() { doodle.doodles.eraseMouseXY(true); hilitingState.go(); }
erasingState.ctrlup = function() { pressedState.go(); }

rubberState.enter = function() { mouseXY.rubber(); }
rubberState.mousemove = function() { mouseXY.rubber(); }
rubberState.leave = function() { doodle.doodles.allShapes(doodle.doodles.normalColor); doodle.rubber.hide(); }
rubberState.mouseup = function() { doodle.rubber.erase(); hilitingState.go(); }
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

this.mouseXY = mouseXY;
this.hit = function() {
	var was = doodle.input.disable();
	var hit = mouseXY.hit();
	if (was ) doodle.input.enable();
	return hit; }

var listening = false;
this.__defineGetter__('listening',function(){return listening});
this.attach = function() { if (!listening) {
	doodle.input.enable();
	doodle.structure.enclosed.addEventListener('mousedown',downMouse);
	doodle.structure.enclosed.addEventListener('mousemove',moveMouse);
	doodle.structure.enclosed.addEventListener('mouseup',upMouse);
	doodle.structure.enclosed.addEventListener('keydown',downKey);
	doodle.structure.enclosed.addEventListener('keyup',upKey);
	listening = true; }}
this.detach = function() { if (listening) {
	doodle.input.disable();
	doodle.structure.enclosed.removeEventListener('mousedown',downMouse);
	doodle.structure.enclosed.removeEventListener('mousemove',moveMouse);
	doodle.structure.enclosed.removeEventListener('mouseup',upMouse);
	doodle.structure.enclosed.removeEventListener('keydown',downKey);
	doodle.structure.enclosed.removeEventListener('keyup',upKey);
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
svg.setAttribute('zoomAndPan','disable');
svg.setAttribute('pointer-events','none');
this.__defineGetter__('svg',function(){return svg});

function svgResize() {
	// only use when element is body
	svg.style.width = 0; svg.style.height = 0;
	svg.style.width = element.scrollWidth;
	svg.style.height = element.scrollHeight; }

if (element != element.ownerDocument.body) {
	validateAndSetPositioning();
	div = element.ownerDocument.createElement('div');
	div.style.zIndex = -999999999;
	div.style.position = 'absolute';
	div.style.top = 0;
	div.style.left = 0;
	div.style.bottom = 0;
	div.style.right = 0;
	element.appendChild(div);
	div.appendChild(svg); }
else /* element is document body */ {
	svg.style.zIndex = 999999999;
	svg.style.position = 'absolute';
	svg.style.top = 0;
	svg.style.left = 0;
	element.appendChild(svg);
	window.addEventListener('resize',svgResize);
	svgResize(); }

var doodle = new Doodle(svg);
this.__proto__ = doodle;
//this.__defineGetter__('doodle',function(){return doodle});
//this.__defineGetter__('color',function(){return doodle.color});

function focusToMouse(event) {
	if (div) div.style.zIndex = -999999999;
	var hit = doodle.hit();
	if (div) div.style.zIndex = 999999999;
	if (hit) hit.focus(); }

function attach() {
	doodle.attach();
	if (div) div.style.zIndex = 999999999;
	window.addEventListener('keydown',focusToMouse,true); }

function detach() {
	doodle.detach();
	if (div) div.style.zIndex = -999999999;
	window.removeEventListener('keydown',focusToMouse,true); }

function destroy() {
	detach();
	if (div) {
		element.removeChild(div);
		element.style.position = positioning;
		positioning = null;
		div = null; }
	else {
		window.removeEventListener('resize',svgResize);
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
	case 'attach': attach(); break;
	case 'detach': detach(); break; } });

this.toggle = function() { port.postMessage('toggle'); }

}// end Doodledoku constructor

if ('body' in document) if (document.body)
if (document.body.nodeName != 'FRAMESET')
	window.doodledoku = new Doodledoku(document.body,window);

'OK';

