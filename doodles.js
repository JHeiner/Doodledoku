// Copyright © 2012-2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file for details.

"use strict";

// everything in this file is defined inside of the Doodles object.
// this first block contains convenience functions and constants.

var Doodles =
{
	domNew: function(name,element) {
		return element.ownerDocument.createElement(name); },
	domNewNS: function(name,uri,element) {
		return element.ownerDocument.createElementNS(uri,name); },

	svgURI: 'http://www.w3.org/2000/svg',
	svgEq: function(name,element) {
		return element.nodeName == name
			&& element.namespaceURI == Doodles.svgURI },
	svgNew: function(name,svg) {
		switch (name) {
		case 'Point': return svg.createSVGPoint();
		case 'Rect': return svg.createSVGRect();
		default: return Doodles.domNewNS(name,Doodles.svgURI,svg); } },

	hit: function(point,element) {
		return element.ownerDocument.elementFromPoint(point.x,point.y); },

	on: function(element,event,action) {
		if (!event) element.addListener(action);
		else element.addEventListener(event,action); },
	off: function(element,event,action) {
		if (!event) element.removeListener(action);
		else element.removeEventListener(event,action); }
};

// the rest of this file adds object constructors and prototypes.
// each object class depends only on those that precede it in this file.

// Shapes objects:
// - use the <svg> element provided to the constructor to hold the doodles.
// - provide methods to manipulate the doodles.

Doodles.Shapes = function(svg)
{
	var shapes = this;
	this.args = {svg:svg};

	if (!Doodles.svgEq('svg',svg) || svg.hasChildNodes())
		throw new Error("the arg must be an empty <svg> element");

	svg.setAttribute('stroke-linejoin','round');
	svg.setAttribute('stroke-linecap','round');
	svg.setAttribute('fill','none');

	var drawWidth = 0; var pickWidth = 0;
	this.width = {
		get draw() { return drawWidth; },
		set draw(x) { shapes.svg.setAttribute('stroke-width',drawWidth = x); },
		get pick() { return pickWidth; },
		set pick(x) { pickWidth = x; } };

	var normalColor = ''; var eraserColor = '';
	this.color = {
		get normal() { return normalColor; },
		set normal(x) { shapes.svg.setAttribute('stroke',normalColor = x); },
		get eraser() { return eraserColor; },
		set eraser(x) { eraserColor = x; } };

	this.width.draw = 3;
	this.width.pick = 8;
	this.color.normal = '#333';
	this.color.eraser = '#E9B';
};

Doodles.Shapes.prototype =
{
	get svg() { return this.args.svg; },
	get doodles() { return this.svg.childNodes; },
	dot: function(center) {
		var d = Doodles.svgNew('polygon',this.svg);
		var p = Doodles.svgNew('Point',this.svg);
		p.x = center.x; p.y = center.y;
		d.points.appendItem(p);
		this.svg.appendChild(d); },
	lineMore: function(line,more) {
		var p = Doodles.svgNew('Point',this.svg);
		p.x = more.x; p.y = more.y;
		line.points.appendItem(p); },
	lineStart: function(start) {
		var l = Doodles.svgNew('polyline',this.svg);
		this.lineMore(l,start);
		this.svg.appendChild(l);
		return l; },
	pick: function(point) {
		// webkit getIntersectionList is very buggy (does bbox, completely
		// ignoring pointer-events), but when fixed it should be used instead
		var found = [];
		this.svg.setAttribute('stroke-width',this.width.pick);
		for ( var hit = Doodles.hit(point,this.svg)
			  ; hit && hit.parentNode == this.svg
			  ; hit = Doodles.hit(point,this.svg) ) {
			hit.setAttribute('pointer-events','none');
			found.push(hit); }
		this.svg.setAttribute('stroke-width',this.width.draw);
		found.forEach(function(hit){hit.removeAttribute('pointer-events')});
		return found.reverse(); },
	hilightShape: function(shape) {
		shape.setAttribute('stroke',this.color.eraser); },
	unhilight: function() {
		for ( var e = this.svg.firstChild ; e ; e = e.nextSibling )
			//if (e.hasAttribute('stroke'))
				e.removeAttribute('stroke'); },
	removeShape: function(shape) {
		this.svg.removeChild(shape); },
	forSelected: function(action,subsequentSiblings,sorted,list) {
		if (!subsequentSiblings)
			for ( var i = list.length - 1 ; i >= 0 ; -- i )
				action.call(this,list[i]);
		else if (list.length) {
			var children = this.doodles;
			var first = children.length;
			for ( var i = (sorted ? 0 : list.length - 1) ; i >= 0 ; -- i ) {
				var at = Array.prototype.indexOf.call(children,list[i]);
				if (at < 0) throw new Error("non-child:"+list[i]);
				if (at < first) first = at; }
			for ( var i = children.length - 1 ; i >= first ; -- i )
				action.call(this,children[i]); }
		return list.length; },
	enclosed: function(area) {
		this.svg.setAttribute('stroke-width',this.width.pick);
		var list = this.svg.getEnclosureList(area,this.svg);
		this.svg.setAttribute('stroke-width',this.width.draw);
		return list; },
	hilightArea: function(area) {
		this.unhilight();
		return this.forSelected(this.hilightShape,false,false,
			this.enclosed(area) ); },
	eraseArea: function(area) {
		return this.forSelected(this.removeShape,false,false,
			this.enclosed(area) ); },
	hilightPoint: function(point,subsequentSiblings) {
		this.unhilight();
		return this.forSelected(this.hilightShape,subsequentSiblings,true,
			this.pick(point) ); },
	erasePoint: function(point,subsequentSiblings) {
		return this.forSelected(this.removeShape,subsequentSiblings,true,
			this.pick(point) ); },
	constructor: Doodles.Shapes,
	destroy: function() {
		delete this.args;
		delete this.width;
		delete this.color; }
};

// DOM objects:
// - build and manage the node tree needed for doodling.
// - create a Shape object for a <svg> element nested within the tree.
// - use the root <svg> element provided to the constructor to hold the tree.
// Note that the Shapes <svg> element is different from the root <svg>
// element, and that the root need not be the outermost <svg> element.

Doodles.DOM = function(root)
{
	this.args = {root:root};

	if (!Doodles.svgEq('svg',root))
		throw new Error("the arg must be a <svg> element");

	this.undoCTM = Doodles.svgNew('g',this.root),
	// inside of undoCTM the coordinates match the page coordinates
	this.undoCTM.transform.baseVal.appendItem(this.inverseCTM);
	root.appendChild(this.undoCTM);

	this.undoClip = Doodles.svgNew('svg',this.root),
	// resets the clipping (from viewport clip in page coords).
	// we cheat here and set w/h very large, rely on viewport to clip
	this.undoClip.setAttribute('width',999999999);
	this.undoClip.setAttribute('height',999999999);
	this.undoClip.setAttribute('cursor','crosshair');
	this.undoCTM.appendChild(this.undoClip);

	this.catcher = Doodles.svgNew('rect',this.root),
	// catches mouse events in the blank (un-doodled) areas
	this.catcher.setAttribute('width','100%');
	this.catcher.setAttribute('height','100%');
	this.catcher.setAttribute('stroke','none');
	this.catcher.setAttribute('fill','none');
	this.undoClip.appendChild(this.catcher);

	this.shapes = new Doodles.Shapes(Doodles.svgNew('svg',this.root));
	this.undoClip.appendChild(this.shapes.svg);

	this.rubberArea = Doodles.svgNew('Rect',this.root);
	// just the geometry of the rubber rectangle
	this.rubberShow = Doodles.svgNew('rect',this.root);
	// visible part of the rubber rectangle
	this.rubberShow.setAttribute('fill','none');
	this.rubberShow.setAttribute('stroke-dasharray','5');
	this.rubberShow.setAttribute('pointer-events','none');
	this.undoClip.appendChild(this.rubberShow);

	this.disable();
	this.rubberHide();
};

Doodles.DOM.prototype =
{
	get root() { return this.args.root; },
	get doodles() { return this.shapes.doodles; },
	get width() { return this.shapes.width; },
	get color() { return this.shapes.color; },
	get inverseCTM() {
		var m = this.root.getCTM().inverse();
		for ( var e = this.root ; e ; e = e.offsetParent )
			m = m.translate(-e.offsetLeft,-e.offsetTop);
		return this.root.createSVGTransformFromMatrix(m); },
	get enabled() {
		return (this.catcher.getAttribute('pointer-events') != 'none'
			|| this.undoClip.getAttribute('pointer-events') != 'none'); },
	disable: function() {
		if ( ! this.enabled ) return false; else {
			this.catcher.setAttribute('pointer-events','none');
			this.undoClip.setAttribute('pointer-events','none');
			return true; } },
	enable: function() {
		this.catcher.setAttribute('pointer-events','fill');
		this.undoClip.setAttribute('pointer-events','visiblePainted'); },
	rubberXYWH: function(x,y,w,h) {
 		this.rubberShow.setAttribute('x', this.rubberArea.x = x);
		this.rubberShow.setAttribute('y', this.rubberArea.y = y);
		this.rubberShow.setAttribute('width', this.rubberArea.width = w);
		this.rubberShow.setAttribute('height', this.rubberArea.height = h);
		this.rubberShow.setAttribute('stroke',this.color.eraser); },
	rubber2P: function(p1,p2) {
		this.rubberXYWH(Math.min(p1.x,p2.x),Math.min(p1.y,p2.y),
			Math.abs(p2.x-p1.x),Math.abs(p2.y-p1.y)); },
	/*rubberPick: function(point) {
		var w = this.width.pick; var h = w/2;
		this.rubberXYWH(point.x - h, point.y - h, w, w );
		return this.area; },*/
	rubberHide: function() {
		this.rubberXYWH(-1,-1,0,0); },
	rubberHilight: function() {
		this.shapes.hilightArea(this.rubberArea); },
	rubberErase: function() {
		this.shapes.eraseArea(this.rubberArea); },
	constructor: Doodles.DOM,
	destroy: function() {
		this.root.removeChild(this.undoCTM);
		this.shapes.destroy();
		delete this.args;
		delete this.undoCTM;
		delete this.undoClip;
		delete this.catcher;
		delete this.shapes;
		delete this.rubberArea;
		delete this.rubberShow; }
};

// Pointer objects:
// - store mouse event data
// - create a DOM object for the root element provided to the constructor.
// - provide methods which use the mouse data to manipulate the DOM
//   and its Shapes.

Doodles.Pointer = function(root)
{
	this.args = {root:root};

	this.dom = new Doodles.DOM(root);

	this.client = Doodles.svgNew('Point',root);
	this.page = Doodles.svgNew('Point',root);
	this.mark = Doodles.svgNew('Point',root);
	this.polyline = null;
};

Doodles.Pointer.prototype =
{
	get shapes() { return this.dom.shapes; },
	get doodles() { return this.dom.doodles; },
	get width() { return this.dom.width; },
	get color() { return this.dom.color; },
	move: function(clientX,clientY,pageX,pageY) {
		if (this.client.x == clientX && this.client.y == clientY
			&& this.page.x == pageX && this.page.y == pageY)
			return false;
		this.client.x = clientX; this.client.y = clientY;
		this.page.x = pageX; this.page.y = pageY;
		return true; },
	remember: function() {
		this.mark.x = this.page.x; this.mark.y = this.page.y; },
	hit: function() {
		return Doodles.hit(this.client,this.args.root); },
	hilight: function() {
		this.shapes.hilightPoint(this.client,true); },
	erase: function(subsequentSiblings) {
		return this.shapes.erasePoint(this.client,subsequentSiblings); },
	eraseSince: function() {
		this.erase(true); },
	eraseElseDot: function() {
		if (!this.erase(false))
			this.shapes.dot(this.page); },
	pathMore: function() {
		this.shapes.lineMore(this.polyline,this.page); },
	pathStart: function() {
		this.polyline = this.shapes.lineStart(this.mark);
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
	rubberSet: function() {
		this.dom.rubber2P(this.mark,this.page);
		this.dom.rubberHilight(); },
	rubberErase: function() {
		this.dom.rubberErase(); },
	unhilight: function() {
		this.shapes.unhilight();
		this.dom.rubberHide(); },
	underneath: function() {
		var was = this.dom.disable();
		var hit = this.hit();
		if (was) this.dom.enable();
		return hit; },
	constructor: Doodles.Pointer,
	destroy: function() {
		this.dom.destroy();
		delete this.args;
		delete this.dom;
		delete this.client;
		delete this.page;
		delete this.mark;
		delete this.polyline; }
};

// FSM objects:
// - create a Pointer object for the root element provided to the constructor.
// - manage a finite state machine that reacts to mouse and key events by
//   calling methods on the Pointer.

Doodles.FSM = function(root)
{
	this.args = {root:root};

	this.pointer = new Doodles.Pointer(root);

	this.current = 'idle';
};

Doodles.FSM.prototype =
{
	// each state has:
	// - mouse, ctrl: two required booleans which are true if the
	//   state represents one where that button/key is pressed/down.
	// - enter, leave: two optional strings which name Pointer methods
	//   to be called upon entering/leaving the state.
	// - mousedown, mousemove, mouseup, ctrldown, ctrlup: five optional
	//   string arrays indicating actions to be performed upon receiving
	//   the corresponding event:
	//   - [0] names a Pointer method to call.
	//   - [1] names a state to transition to.
	// note that each state will have at most three of the five event
	// "edges" since two will always be redundant (e.g. mousedown in any
	// state where the button is already pressed).
	idle: { mouse:false, ctrl:false,
		mousedown: ['',            'pressed'],
		ctrldown:  ['',            'hiliting'] },
	pressed: { mouse:true, ctrl:false,
		mousemove: ['',            'drawing' ],
		mouseup:   ['eraseElseDot','idle'],
		ctrldown:  ['',            'erasing'] },
	drawing: { mouse:true, ctrl:false,
		enter:      'pathStart',
		mousemove: ['pathMore',    ''],
		leave:      'pathEnd',
		mouseup:   ['',            'idle'],
		ctrldown:  ['remember',    'erasing'] },
	hiliting: { mouse:false, ctrl:true,
		enter:      'hilight',
		mousemove: ['hilight',     ''],
		leave:      'unhilight',
		ctrlup:    ['',            'idle'],
		mousedown: ['',            'erasing'] },
	erasing: { mouse:true, ctrl:true,
		enter:      'hilight',
		mousemove: ['',            'rubber'],
		leave:      'unhilight',
		mouseup:   ['eraseSince',  'hiliting'],
		ctrlup:    ['',            'pressed'] },
	rubber: { mouse:true, ctrl:true,
		enter:      'rubberSet',
		mousemove: ['rubberSet',   ''],
		leave:      'unhilight',
		mouseup:   ['rubberErase', 'hiliting'],
		ctrlup:    ['',            'cancel'] },
	cancel: { mouse:true, ctrl:false,
		mouseup:   ['',            'idle'],
		ctrldown:  ['remember',    'erasing'] },
	// end state definitions
	get dom() { return this.pointer.dom; },
	get doodles() { return this.pointer.doodles; },
	get width() { return this.pointer.width; },
	get color() { return this.pointer.color; },
	get state() { return this[this.current]; },
	controlKey: function(down) {
		var state = this.state;
		if (down) { if (!state.ctrl) this.follow(state,state.ctrldown); }
		else/*up*/{ if (state.ctrl) this.follow(state,state.ctrlup); } },
	perform: function(actionName) {
		if (actionName)
			this.pointer[actionName](); },
	transition: function(stateName,leaveAction) {
		if (stateName) {
			this.perform(leaveAction);
			this.perform(this[this.current = stateName].enter); } },
	follow: function(state,edge) {
		if (edge) {
			this.perform(edge[0]);
			this.transition(edge[1],state.leave); } },
	edge: function(edgeName) {
		var state = this.state;
		this.follow(state,state[edgeName]); },
	constructor: Doodles.FSM,
	destroy: function() {
		this.pointer.destroy();
		delete this.args;
		delete this.pointer;
		delete this.current; }
};

// Events objects:
// - create an FSM object for the root element provided to the constructor.
// - contain event listener methods which trigger the FSM actions.
// - provide methods to attach/detach the event listeners:
//   - mouse events come from a node created within the DOM.
//   - key events come from the source provided to the constructor.
// - fill in as best as is possible for missing events (e.g. when mouse is
//   pressed then moves outside the window and released while outside the
//   window, that mouseup event is not reported to the window).
// The keySource is typically the window object.

Doodles.Events = function(root,keySource)
{
	this.args = {root:root,keySource:keySource};

	if (!keySource)
		throw new Error("the 2nd arg should be the window");

	this.fsm = new Doodles.FSM(root);

	this.ctrlKey = Doodles.Events.prototype.ctrlKey.bind(this);
	this.downMouse = Doodles.Events.prototype.downMouse.bind(this);
	this.moveMouse = Doodles.Events.prototype.moveMouse.bind(this);
	this.upMouse = Doodles.Events.prototype.upMouse.bind(this);
};

Doodles.Events.prototype =
{
	get pointer() { return this.fsm.pointer; },
	get dom() { return this.fsm.dom; },
	get doodles() { return this.fsm.doodles; },
	get width() { return this.fsm.width; },
	get color() { return this.fsm.color; },
	ctrlKey: function(event) {
		this.fsm.controlKey(event.ctrlKey); },
	pointerMove: function(event) {
		return this.pointer.move(
			event.clientX,event.clientY,event.pageX,event.pageY ); },
	downMouse: function(event) {
		this.ctrlKey(event);
		if (this.pointerMove(event))
			this.fsm.edge('mousemove');
		if (0 == event.button) {
			this.pointer.remember();
			this.fsm.edge('mousedown'); }
		this.focusMouse(); },
	moveMouse: function(event) {
		if (this.fsm.state.mouse && event.which != 1) {
			var ctrl = this.fsm.state.ctrl
			if (ctrl) this.fsm.edge('ctrlup');
			this.fsm.edge('mouseup');
			if (ctrl) this.fsm.edge('ctrldown'); }
		this.ctrlKey(event);
		if (this.pointerMove(event))
			this.fsm.edge('mousemove');
		this.focusMouse(); },
	upMouse: function(event) {
		this.ctrlKey(event);
		if (this.pointerMove(event))
			this.fsm.edge('mousemove');
		if (0 == event.button) {
			this.fsm.edge('mouseup'); }
		this.focusMouse(); },
	focusMouse: function() {
		var under = this.pointer.underneath();
		if (under && 'function' == typeof under.focus)
			under.focus(); },
	attach: function() {
		this.dom.enable();
		Doodles.on(this.dom.undoClip,'mousedown',this.downMouse);
		Doodles.on(this.dom.undoClip,'mousemove',this.moveMouse);
		Doodles.on(this.dom.undoClip,'mouseup',this.upMouse);
		Doodles.on(this.args.keySource,'keydown',this.ctrlKey);
		Doodles.on(this.args.keySource,'keyup',this.ctrlKey); },
	detach: function() {
		this.dom.disable();
		Doodles.off(this.dom.undoClip,'mousedown',this.downMouse);
		Doodles.off(this.dom.undoClip,'mousemove',this.moveMouse);
		Doodles.off(this.dom.undoClip,'mouseup',this.upMouse);
		Doodles.off(this.args.keySource,'keydown',this.ctrlKey);
		Doodles.off(this.args.keySource,'keyup',this.ctrlKey); },
	constructor: Doodles.Events,
	destroy: function() {
		this.detach();
		this.fsm.destroy();
		delete this.args;
		delete this.fsm;
		delete this.ctrlKey;
		delete this.downMouse;
		delete this.moveMouse;
		delete this.upMouse; }
};

// Cover objects:
// - create an outermost <svg> element as a child of the html element
//   provided to the constructor.
// - create an Events object for the outermost <svg> element.
// - arrange for the outermost <svg> to always cover the parent html element.

// CoverBlock objects use css absolute positioning to cover an html element
// nested within a document body. It does not work for the document body.

Doodles.CoverBlock = function(block,window)
{
	this.args = {block:block,window:window};

	var computed = window.getComputedStyle(block);
	if (block.ownerDocument.body == block
		|| (computed.position != 'static' && computed.position != 'relative')
		|| computed.top != 'auto' || computed.left != 'auto'
		|| computed.right != 'auto' || computed.bottom != 'auto' )
		throw new Error("the 1st arg can not be the <body> element,"
		                +" and must be static or relative positioned");
	computed = undefined;

	this.originalBlockPositioning = block.style.position;
	this.originalBlockHasStyle = block.hasAttribute('style');
	block.style.position = 'relative';

	this.div = Doodles.domNew('div',block);
	this.div.style.position = 'absolute';
	this.div.style.zIndex = -999999999;
	this.div.style.top = 0;
	this.div.style.left = 0;
	this.div.style.bottom = 0;
	this.div.style.right = 0;
	block.appendChild(this.div);

	this.svg = Doodles.svgNew('svg',block);
	this.svg.setAttribute('zoomAndPan','disable');
	this.svg.setAttribute('pointer-events','none');
	this.div.appendChild(this.svg);

	this.events = new Doodles.Events(this.svg,window);

	this.dom.enable = Doodles.CoverBlock.prototype.enable.bind(this);
	this.dom.disable = Doodles.CoverBlock.prototype.disable.bind(this);
};

Doodles.CoverBlock.prototype =
{
	get fsm() { return this.events.fsm; },
	get pointer() { return this.events.pointer; },
	get dom() { return this.events.dom; },
	get doodles() { return this.events.doodles; },
	get width() { return this.events.width; },
	get color() { return this.events.color; },
	disable: function() {
		this.div.style.zIndex = -999999999;
		return Doodles.DOM.prototype.disable.call(this.dom); },
	enable: function() {
		this.div.style.zIndex = 999999999;
		Doodles.DOM.prototype.enable.call(this.dom); },
	constructor: Doodles.CoverBlock,
	destroy: function() {
		this.events.destroy();
		this.args.block.removeChild(this.div);
		this.args.block.style.position = this.originalBlockPositioning;
		if (!this.args.block.getAttribute('style')
			&& !this.originalBlockHasStyle)
			this.args.block.removeAttribute('style');
		delete this.args;
		delete this.originalBlockPositioning;
		delete this.originalBlockHasStyle;
		delete this.div;
		delete this.svg;
		delete this.events; }
};

// CoverBody listens for window resize events to maintain coverage over
// the entire document body.

Doodles.CoverBody = function(body,window)
{
	this.args = {body:body,window:window};

	if (body.ownerDocument.body != body)
		throw new Error("the 1st arg must be the <body> element");

	this.svg = Doodles.svgNew('svg',body);
	this.svg.setAttribute('zoomAndPan','disable');
	this.svg.setAttribute('pointer-events','none');
	this.svg.style.zIndex = 999999999;
	this.svg.style.position = 'absolute';
	this.svg.style.top = 0;
	this.svg.style.left = 0;
	body.appendChild(this.svg);

	this.events = new Doodles.Events(this.svg,window);

	this.resize = Doodles.CoverBody.prototype.resize.bind(this);
	Doodles.on(window,'resize',this.resize);
	this.resize();
};

Doodles.CoverBody.prototype =
{
	get fsm() { return this.events.fsm; },
	get pointer() { return this.events.pointer; },
	get dom() { return this.events.dom; },
	get doodles() { return this.events.doodles; },
	get width() { return this.events.width; },
	get color() { return this.events.color; },
	resize: function() {
		this.svg.style.width = 0; this.svg.style.height = 0;
		this.svg.style.width = this.args.body.scrollWidth;
		this.svg.style.height = this.args.body.scrollHeight; },
	constructor: Doodles.CoverBody,
	destroy: function() {
		Doodles.off(this.args.window,'resize',this.resize);
		this.events.destroy();
		this.args.body.removeChild(this.svg);
		delete this.args;
		delete this.svg;
		delete this.events;
		delete this.resize; }
};

// Extension objects:
// - take ownership of the Cover object provided to the constructor, so
//   destroying the Extension object also destroys its Cover object.
// - open a port to the Doodledoku extension.
// - react to messages received on the port by calling methods on the
//   Cover object (well, on the Events object owned by the Cover object).

Doodles.Extension = function(cover)
{
	this.args = {cover:cover};

	this.port = chrome.extension.connect();

	this.destroy = Doodles.Extension.prototype.destroy.bind(this);
	Doodles.on(this.port.onDisconnect,'',this.destroy);

	this.receive = Doodles.Extension.prototype.receive.bind(this);
	Doodles.on(this.port.onMessage,'',this.receive);
};

Doodles.Extension.prototype =
{
	get cover() { return this.args.cover; },
	get events() { return this.cover.events; },
	get fsm() { return this.cover.fsm; },
	get pointer() { return this.cover.pointer; },
	get dom() { return this.cover.dom; },
	get doodles() { return this.cover.doodles; },
	get width() { return this.cover.width; },
	get color() { return this.cover.color; },
	toggle: function() {
		this.port.postMessage('toggle'); },
	receive: function(message) {
		switch (message) {
		case 'attach': this.events.attach(); break;
		case 'detach': this.events.detach(); break; } },
	constructor: Doodles.Extension,
	destroy: function() {
		Doodles.off(this.port.onMessage,'',this.receive);
		Doodles.off(this.port.onDisconnect,'',this.destroy);
		this.port.disconnect(); // surprisingly does not call onDisconnect
		this.cover.destroy();
		delete this.args;
		delete this.port;
		delete this.destroy;
		delete this.receive; }
};

'OK';

