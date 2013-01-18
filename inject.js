// Copyright © 2012-2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file for info.

"use strict";

function Doodles(element) {

	if (element.nodeName != 'svg'
		|| element.namespaceURI != this.svgNS
		|| element.hasChildNodes())
		throw new Error("the arg must be an empty <svg> element");

	element.setAttribute('stroke-linejoin','round');
	element.setAttribute('stroke-linecap','round');
	element.setAttribute('fill','none');

	var drawWidth = 0; var pickWidth = 0;
	this.width = {
		get draw() { return drawWidth; },
		set draw(x) { element.setAttribute('stroke-width',drawWidth = x); },
		get pick() { return pickWidth; },
		set pick(x) { pickWidth = x; } };

	var normalColor = ''; var eraserColor = '';
	this.color = {
		get normal() { return normalColor; },
		set normal(x) { element.setAttribute('stroke',normalColor = x); },
		get eraser() { return eraserColor; },
		set eraser(x) { eraserColor = x; } };

	this.width.draw = 3;
	this.width.pick = 8;
	this.color.normal = '#333';
	this.color.eraser = '#E9B';

	this.__defineGetter__('element',function(){return element}); }

Doodles.prototype = {
	svgNS: 'http://www.w3.org/2000/svg',
	get document() { return this.element.ownerDocument; },
	createSVG: function(name) {
		return this.document.createElementNS(this.svgNS,name); },
	dot: function(center) {
		var d = this.createSVG('polygon');
		var p = this.element.createSVGPoint();
		p.x = center.x; p.y = center.y;
		d.points.appendItem(p);
		this.element.appendChild(d); },
	lineMore: function(line,more) {
		var p = this.element.createSVGPoint();
		p.x = more.x; p.y = more.y;
		line.points.appendItem(p); },
	lineStart: function(start) {
		var l = this.createSVG('polyline');
		this.lineMore(l,start);
		this.element.appendChild(l);
		return l; },
	hit: function(point) {
		return this.document.elementFromPoint(point.x,point.y); },
	pick: function(point) {
		// webkit getIntersectionlist is very buggy (does bbox intersection,
		// ignores pointer-events), but when fixed it should be used instead
		var found = [];
		this.element.setAttribute('stroke-width',this.width.pick);
		for ( var hit = this.hit(point)
			  ; hit && hit.parentNode == this.element
			  ; hit = this.hit(point) ) {
			hit.setAttribute('pointer-events','none');
			found.push(hit); }
		this.element.setAttribute('stroke-width',this.width.draw);
		found.forEach(function(hit){hit.removeAttribute('pointer-events')});
		return found.reverse(); },
	hilightShape: function(shape) {
		shape.setAttribute('stroke',this.color.eraser); },
	unhilight: function() {
		for ( var e = this.element.firstChild ; e ; e = e.nextSibling )
			//if (e.hasAttribute('stroke'))
				e.removeAttribute('stroke'); },
	removeShape: function(shape) {
		this.element.removeChild(shape); },
	forSelected: function(action,subsequentSiblings,sorted,list) {
		if (!subsequentSiblings)
			for ( var i = list.length - 1 ; i >= 0 ; -- i )
				action.call(this,list[i]);
		else if (list.length) {
			var children = this.element.childNodes;
			var first = children.length;
			for ( var i = (sorted ? 0 : list.length - 1) ; i >= 0 ; -- i ) {
				var at = Array.prototype.indexOf.call(children,list[i]);
				if (at < 0) throw new Error("non-child:"+list[i]);
				if (at < first) first = at; }
			for ( var i = children.length - 1 ; i >= first ; -- i )
				action.call(this,children[i]); }
		return list.length; },
	hilightArea: function(area) {
		this.unhilight();
		return this.forSelected(this.hilightShape,false,false,
			this.element.getEnclosureList(area,this.element) ); },
	eraseArea: function(area) {
		return this.forSelected(this.removeShape,false,false,
			this.element.getEnclosureList(area,this.element) ); },
	hilightPoint: function(point,subsequentSiblings) {
		this.unhilight();
		return this.forSelected(this.hilightShape,subsequentSiblings,true,
			this.pick(point) ); },
	erasePoint: function(point,subsequentSiblings) {
		return this.forSelected(this.removeShape,subsequentSiblings,true,
			this.pick(point) ); } };

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
	hit: function(point) {
		return this.document.elementFromPoint(point.x,point.y); },
	get inverseCTM() {
		var m = this.element.getCTM().inverse();
		for ( var e = this.element ; e ; e = e.offsetParent )
			m = m.translate(-e.offsetLeft,-e.offsetTop);
		return this.element.createSVGTransformFromMatrix(m); } };

this.structure = {
	undoCTM: doodle.viewport.createSVG('g'),
	// inside of undoCTM the coordinates match the page coordinates
	undoClip: doodle.viewport.createSVG('svg'),
	// resets the clipping (from viewport clip in page coords).
	// we cheat here and set w/h very large, rely on viewport to clip
	input: doodle.viewport.createSVG('rect'),
	// catches mouse events in the blank (un-doodled) areas
	get enabled() {
		return (this.input.getAttribute('pointer-events') != 'none'
			|| this.undoClip.getAttribute('pointer-events') != 'none'); },
	disable: function() {
		if ( ! this.enabled ) return false; else {
			this.input.setAttribute('pointer-events','none');
			this.undoClip.setAttribute('pointer-events','none');
			return true; } },
	enable: function() {
		this.input.setAttribute('pointer-events','fill');
		this.undoClip.setAttribute('pointer-events','visiblePainted'); },
	initialize: function() {
		this.undoCTM.transform.baseVal.appendItem(doodle.viewport.inverseCTM);
		this.undoClip.setAttribute('width',999999999);
		this.undoClip.setAttribute('height',999999999);
		this.undoClip.setAttribute('cursor','crosshair');
		this.input.setAttribute('width','100%');
		this.input.setAttribute('height','100%');
		this.input.setAttribute('stroke','none');
		this.input.setAttribute('fill','none');
		this.disable(); } };

this.doodles = new Doodles(this.viewport.createSVG('svg'));

this.rubber = {
	element: doodle.viewport.createSVG('rect'),
	// visible part of the rubber rectangle
	area: viewport.createSVGRect(),
	// just the geometry of the rubber rectangle
	setXYWH: function(x,y,w,h) {
 		this.element.setAttribute('x', this.area.x = x);
		this.element.setAttribute('y', this.area.y = y);
		this.element.setAttribute('width', this.area.width = w);
		this.element.setAttribute('height', this.area.height = h); },
	set2P: function(p1,p2) {
		this.setXYWH(Math.min(p1.x,p2.x),Math.min(p1.y,p2.y),
			Math.abs(p2.x-p1.x),Math.abs(p2.y-p1.y)); },
	setPick: function(point) {
		var w = doodle.width.pick; var h = w/2;
		this.setXYWH(point.x - h, point.y - h, w, w );
		return this.area; },
	hide: function() {
		this.setXYWH(-1,-1,0,0); },
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
this.structure.undoCTM.appendChild(this.structure.undoClip);
this.structure.undoClip.appendChild(this.structure.input);
this.structure.undoClip.appendChild(this.doodles.element);
this.structure.undoClip.appendChild(this.rubber.element);

this.structure.initialize();
this.rubber.initialize();

var eraserColorSetter = this.doodles.color.__lookupSetter__('eraser');
this.doodles.color.__defineSetter__('eraser',function(x){
	eraserColorSetter(x); doodle.rubber.element.setAttribute('stroke',x); });
this.doodles.color.eraser = this.doodles.color.eraser

var mouseXY = {
	page: viewport.createSVGPoint(),
	down: viewport.createSVGPoint(),
	client: viewport.createSVGPoint(),
	polyline: null,
	remember: function() {
		this.down.x = this.page.x; this.down.y = this.page.y; },
	hit: function() {
		return doodle.viewport.hit(this.client); },
	hilight: function() {
		doodle.doodles.hilightPoint(this.client,true); },
	erase: function(subsequentSiblings) {
		return doodle.doodles.erasePoint(this.client,subsequentSiblings); },
	eraseElseDot: function() {
		if (!this.erase(false))
			doodle.doodles.dot(this.page); },
	pathMore: function() {
		doodle.doodles.lineMore(this.polyline,this.page); },
	pathStart: function() {
		this.polyline = doodle.doodles.lineStart(this.down);
		this.pathMore(); },
	nearby: function(one,two) {
		var x = one.x - two.x; var y = one.y - two.y;
		return 10 >= x*x + y*y; },
	pathEnd: function() {
		var ps = this.polyline.points;
		var n = ps.numberOfItems;
		var click = ( n == 1
			|| (n == 2 && this.nearby(ps.getItem(1),ps.getItem(0))) );
		this.polyline.setAttribute('pointer-events','none');
		if (click && this.erase(false))
			this.polyline.remove();
		else
			this.polyline.removeAttribute('pointer-events');
		this.polyline = null; },
	rubber: function() {
		doodle.rubber.set2P(this.down,this.page);
		doodle.rubber.hilight(); } };

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
this.__defineGetter__('state',function(){return theState});

State.prototype.go = function() {
	theState.leave(); this.enter(); theState = this; }

function controlKey(event) {
	if (event.ctrlKey) { if (!theState.ctrl) theState.ctrldown(); }
	else /*!event.ctl*/{ if (theState.ctrl) theState.ctrlup(); } }
mouseXY.move = function(event) {
	controlKey(event);
	if (this.page.x==event.pageX && this.page.y==event.pageY) return;
	this.page.x = event.pageX; this.page.y = event.pageY;
	this.client.x = event.clientX; this.client.y = event.clientY;
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
drawingState.ctrldown = function() { mouseXY.remember(); erasingState.go(); }

hilitingState.enter = function() { mouseXY.hilight(); }
hilitingState.mousemove = function() { mouseXY.hilight(); }
hilitingState.leave = function() { doodle.doodles.unhilight(); }
hilitingState.ctrlup = function() { idleState.go(); }
hilitingState.mousedown = function() { erasingState.go(); }

erasingState.enter = function() { mouseXY.hilight(); }
erasingState.mousemove = function() { rubberState.go(); }
erasingState.leave = function() { doodle.doodles.unhilight(); }
erasingState.mouseup = function() { mouseXY.erase(true); hilitingState.go(); }
erasingState.ctrlup = function() { pressedState.go(); }

rubberState.enter = function() { mouseXY.rubber(); }
rubberState.mousemove = function() { mouseXY.rubber(); }
rubberState.leave = function() { doodle.doodles.unhilight(); doodle.rubber.hide(); }
rubberState.mouseup = function() { doodle.rubber.erase(); hilitingState.go(); }
rubberState.ctrlup = function() { cancelState.go(); }

cancelState.mouseup = function() { idleState.go(); }
cancelState.ctrldown = function() { mouseXY.remember(); erasingState.go(); }

function downMouse(event) {
	mouseXY.move(event);
	if (0 != event.button) return;
	event.preventDefault();
	mouseXY.remember();
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

this.mouseXY = mouseXY;
this.hit = function() {
	var was = doodle.structure.disable();
	var hit = mouseXY.hit();
	if (was) doodle.structure.enable();
	return hit; }

var listening = false;
this.__defineGetter__('listening',function(){return listening});
this.attach = function() { if (!listening) {
	doodle.structure.enable();
	doodle.structure.undoClip.addEventListener('mousedown',downMouse);
	doodle.structure.undoClip.addEventListener('mousemove',moveMouse);
	doodle.structure.undoClip.addEventListener('mouseup',upMouse);
	window.addEventListener('keydown',controlKey);
	window.addEventListener('keyup',controlKey);
	listening = true; }}
this.detach = function() { if (listening) {
	doodle.structure.disable();
	doodle.structure.undoClip.removeEventListener('mousedown',downMouse);
	doodle.structure.undoClip.removeEventListener('mousemove',moveMouse);
	doodle.structure.undoClip.removeEventListener('mouseup',upMouse);
	window.removeEventListener('keydown',controlKey);
	window.removeEventListener('keyup',controlKey);
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
		div.remove();
		element.style.position = positioning;
		positioning = null;
		div = null; }
	else {
		window.removeEventListener('resize',svgResize);
		svg.remove(); }
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

if (!chrome.extension)
	chrome.extension = {
		connect:function(){return {
			postMessage:function(){},
			disconnect:function(){},
			onMessage:{addListener:function(){}},
			onDisconnect:{addListener:function(){}} }} };

if (document.body && document.body.nodeName != 'FRAMESET')
	window.doodledoku = new Doodledoku(document.body,window);

'OK';

