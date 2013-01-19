// Copyright © 2012-2013, Jeremy Heiner (github.com/JHeiner).
// All rights reserved. See LICENSE file for info.

"use strict";

var Doodles =
{
	svgNS: 'http://www.w3.org/2000/svg',

	readableProperty: function(obj,prop,thing) {
		Object.defineProperty(obj,prop,{
			configurable: true, enumerable: true, value: thing }); },
	getterProperty: function(obj,prop,getter) {
		Object.defineProperty(obj,prop,{
			configurable: true, enumerable: true, get: getter }); }
};

Doodles.Polys = function(element)
{
	if (element.nodeName != 'svg'
		|| element.namespaceURI != Doodles.svgNS
		|| element.hasChildNodes())
		throw new Error("the arg must be an empty <svg> element");

	Doodles.readableProperty(this,'element',element);

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
};

Doodles.Polys.prototype =
{
	get document() { return this.element.ownerDocument; },
	createSVG: function(name) {
		return this.document.createElementNS(Doodles.svgNS,name); },
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
		// webkit getIntersectionList is very buggy (does bbox, completely
		// ignoring pointer-events), but when fixed it should be used instead
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
			this.pick(point) ); },
	constructor: Doodles.Polys,
	destroy: function() {
		delete this.element;
		delete this.width;
		delete this.color; }
};

Doodles.DOM = function(element)
{
	if (element.nodeName != 'svg'
		|| element.namespaceURI != Doodles.svgNS)
		throw new Error("the arg must be a <svg> element");

	Doodles.readableProperty(this,'element',element);

	this.undoCTM = this.createSVG('g'),
	// inside of undoCTM the coordinates match the page coordinates
	this.undoCTM.transform.baseVal.appendItem(this.inverseCTM);
	element.appendChild(this.undoCTM);

	this.undoClip = this.createSVG('svg'),
	// resets the clipping (from viewport clip in page coords).
	// we cheat here and set w/h very large, rely on viewport to clip
	this.undoClip.setAttribute('width',999999999);
	this.undoClip.setAttribute('height',999999999);
	this.undoClip.setAttribute('cursor','crosshair');
	this.undoCTM.appendChild(this.undoClip);

	this.catcher = this.createSVG('rect'),
	// catches mouse events in the blank (un-doodled) areas
	this.catcher.setAttribute('width','100%');
	this.catcher.setAttribute('height','100%');
	this.catcher.setAttribute('stroke','none');
	this.catcher.setAttribute('fill','none');
	this.undoClip.appendChild(this.catcher);

	this.polys = new Doodles.Polys(this.createSVG('svg'));
	this.undoClip.appendChild(this.polys.element);

	this.rubberArea = element.createSVGRect();
	// just the geometry of the rubber rectangle
	this.rubberShow = this.createSVG('rect');
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
	get document() { return this.element.ownerDocument; },
	createSVG: function(name) {
		return this.document.createElementNS(Doodles.svgNS,name); },
	hit: function(point) {
		return this.document.elementFromPoint(point.x,point.y); },
	get inverseCTM() {
		var m = this.element.getCTM().inverse();
		for ( var e = this.element ; e ; e = e.offsetParent )
			m = m.translate(-e.offsetLeft,-e.offsetTop);
		return this.element.createSVGTransformFromMatrix(m); },
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
		this.rubberShow.setAttribute('stroke',this.polys.color.eraser); },
	rubber2P: function(p1,p2) {
		this.rubberXYWH(Math.min(p1.x,p2.x),Math.min(p1.y,p2.y),
			Math.abs(p2.x-p1.x),Math.abs(p2.y-p1.y)); },
	rubberPick: function(point) {
		var w = this.polys.width.pick; var h = w/2;
		this.rubberXYWH(point.x - h, point.y - h, w, w );
		return this.area; },
	rubberHide: function() {
		this.rubberXYWH(-1,-1,0,0); },
	rubberHilight: function() {
		this.polys.hilightArea(this.rubberArea); },
	rubberErase: function() {
		this.polys.eraseArea(this.rubberArea); },
	constructor: Doodles.DOM,
	destroy: function() {
		this.element.removeChild(this.undoCTM);
		this.polys.destroy();
		delete this.element;
		delete this.undoCTM;
		delete this.undoClip;
		delete this.catcher;
		delete this.polys;
		delete this.rubberArea;
		delete this.rubberShow; }
};

Doodles.Pointer = function(dom)
{
	if (!(dom instanceof Doodles.DOM))
		throw new Error("the arg must be a Doodles.DOM");

	Doodles.readableProperty(this,'dom',dom);

	this.client = dom.element.createSVGPoint();
	this.page = dom.element.createSVGPoint();
	this.mark = dom.element.createSVGPoint();
	this.polyline = null;
};

Doodles.Pointer.prototype =
{
	move: function(event) {
		if (this.client.x==event.clientX && this.client.y==event.clientY
			&& this.page.x==event.pageX && this.page.y==event.pageY)
			return false;
		this.client.x = event.clientX; this.client.y = event.clientY;
		this.page.x = event.pageX; this.page.y = event.pageY;
		return true; },
	remember: function() {
		this.mark.x = this.page.x; this.mark.y = this.page.y; },
	hit: function() {
		return this.dom.hit(this.client); },
	hilight: function() {
		this.dom.polys.hilightPoint(this.client,true); },
	erase: function(subsequentSiblings) {
		return this.dom.polys.erasePoint(this.client,subsequentSiblings); },
	eraseSince: function() {
		this.erase(true); },
	eraseElseDot: function() {
		if (!this.erase(false))
			this.dom.polys.dot(this.page); },
	pathMore: function() {
		this.dom.polys.lineMore(this.polyline,this.page); },
	pathStart: function() {
		this.polyline = this.dom.polys.lineStart(this.mark);
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
		this.dom.polys.unhilight();
		this.dom.rubberHide(); },
	underneath: function() {
		var was = this.dom.disable();
		var hit = this.hit();
		if (was) this.dom.enable();
		return hit; },
	constructor: Doodles.Pointer,
	destroy: function() {
		this.dom.destroy();
		delete this.dom;
		delete this.client;
		delete this.page;
		delete this.mark;
		delete this.polyline; }
};

Doodles.FSM = function(pointer)
{
	if (!(pointer instanceof Doodles.Pointer))
		throw new Error("the arg must be a Doodles.Pointer");

	Doodles.readableProperty(this,'pointer',pointer);

	this.current = 'idle';
};

Doodles.FSM.prototype =
{
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

	ctrlKey: function(event) {
		var state = this.state;
		if (event.ctrlKey) {
			if (!state.ctrl) this.follow(state,state.ctrldown); }
		else /*!ctrlKey*/ {
			if (state.ctrl) this.follow(state,state.ctrlup); } },
	get state() {
		return this[this.current]; },
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
		delete this.current; }
};

Doodles.Events = function(element,keyEventSource)
{
	Doodles.readableProperty(this,'keyEventSource',keyEventSource);

	Doodles.readableProperty(this,'fsm',
		new Doodles.FSM(new Doodles.Pointer(new Doodles.DOM(element))) );

	Doodles.readableProperty(this,'pointer',this.fsm.pointer);
	Doodles.readableProperty(this,'dom',this.fsm.pointer.dom);
	Doodles.getterProperty(this,'polys',function(){
		return this.fsm.pointer.dom.polys; });

	this.controlKey = Doodles.Events.prototype.controlKey.bind(this);
	this.downMouse = Doodles.Events.prototype.downMouse.bind(this);
	this.moveMouse = Doodles.Events.prototype.moveMouse.bind(this);
	this.upMouse = Doodles.Events.prototype.upMouse.bind(this);
};

Doodles.Events.prototype =
{
	controlKey: function(event) {
		this.fsm.ctrlKey(event); },
	downMouse: function(event) {
		this.controlKey(event);
		if (this.pointer.move(event))
			this.fsm.edge('mousemove');
		if (0 != event.button) return;
		event.preventDefault();
		this.pointer.remember();
		this.fsm.edge('mousedown'); },
	moveMouse: function(event) {
		if (this.fsm.state.mouse && event.which != 1) {
			var ctrl = this.fsm.state.ctrl
			if (ctrl) this.fsm.edge('ctrlup');
			this.fsm.edge('mouseup');
			if (ctrl) this.fsm.edge('ctrldown'); }
		this.controlKey(event);
		if (this.pointer.move(event))
			this.fsm.edge('mousemove'); },
	upMouse: function(event) {
		this.controlKey(event);
		if (this.pointer.move(event))
			this.fsm.edge('mousemove');
		if (0 != event.button) return;
		event.preventDefault();
		this.fsm.edge('mouseup'); },
	attach: function() {
		this.dom.enable();
		this.dom.undoClip.addEventListener('mousedown',this.downMouse);
		this.dom.undoClip.addEventListener('mousemove',this.moveMouse);
		this.dom.undoClip.addEventListener('mouseup',this.upMouse);
		this.keyEventSource.addEventListener('keydown',this.controlKey);
		this.keyEventSource.addEventListener('keyup',this.controlKey); },
	detach: function() {
		this.dom.disable();
		this.dom.undoClip.removeEventListener('mousedown',this.downMouse);
		this.dom.undoClip.removeEventListener('mousemove',this.moveMouse);
		this.dom.undoClip.removeEventListener('mouseup',this.upMouse);
		this.keyEventSource.removeEventListener('keydown',this.controlKey);
		this.keyEventSource.removeEventListener('keyup',this.controlKey); },
	constructor: Doodles.Events,
	destroy: function() {
		this.detach();
		this.fsm.destroy();
		delete this.keyEventSource;
		delete this.fsm;
		delete this.pointer;
		delete this.dom;
		delete this.polys;
		delete this.controlKey;
		delete this.downMouse;
		delete this.moveMouse;
		delete this.upMouse; }
};

Doodles.CoverBlock = function(block,window)
{
	var computed = window.getComputedStyle(block);
	if (body.nodeName == 'BODY'
		|| (computed.position != 'static' && computed.position != 'relative')
		|| computed.top != 'auto' || computed.left != 'auto'
		|| computed.right != 'auto' || computed.bottom != 'auto' )
		throw new Error("the arg can not be the <body> element,"
		                +" and must be static or relative positioned");
console.log("block.display=",computed.display);
	computed = undefined;
	this.positioning = block.style.position;
	block.style.position = 'relative';

	Doodles.readableProperty(this,'block',element);
	Doodles.readableProperty(this,'window',window);

	var div = block.ownerDocument.createElement('div');
	div.style.zIndex = -999999999;
	div.style.position = 'absolute';
	div.style.top = 0;
	div.style.left = 0;
	div.style.bottom = 0;
	div.style.right = 0;
	block.appendChild(div);

	// div necessary to get the cover correct, but it obscures
	// underneath (which always returns div). can play with zIndex
	// to get around this, but focus to pointer in a block???

	var svg = body.ownerDocument.createElementNS(Doodles.svgNS,'svg');
	svg.setAttribute('zoomAndPan','disable');
	svg.setAttribute('pointer-events','none');
	div.appendChild(svg);

	Doodles.readableProperty(this,'div',div);
	Doodles.readableProperty(this,'svg',svg);

	Doodles.Events.call(this,svg,window);
};

Doodles.CoverBlock.prototype =
{
	__proto__: Doodles.Events.prototype,
	attach: function() {
		Doodles.Events.prototype.attach.call(this);
		this.div.style.zIndex = 999999999; },
	detach: function() {
		Doodles.Events.prototype.detach.call(this);
		this.div.style.zIndex = -999999999; },
	constructor: Doodles.CoverBlock,
	destroy: function() {
		Doodles.Events.prototype.destroy.call(this);
		this.block.removeChild(this.div);
		this.block.style.position = this.positioning;
		delete this.positioning;
		delete this.block;
		delete this.window;
		delete this.div;
		delete this.svg; }
};

Doodles.CoverBody = function(body,window)
{
	if (body.nodeName != 'BODY')
		throw new Error("the arg must be the <body> element");

	Doodles.readableProperty(this,'body',body);
	Doodles.readableProperty(this,'window',window);

	var svg = body.ownerDocument.createElementNS(Doodles.svgNS,'svg');
	svg.setAttribute('zoomAndPan','disable');
	svg.setAttribute('pointer-events','none');
	svg.style.zIndex = 999999999;
	svg.style.position = 'absolute';
	svg.style.top = 0;
	svg.style.left = 0;
	body.appendChild(svg);

	Doodles.readableProperty(this,'svg',svg);
	this.svgResize = Doodles.CoverBody.prototype.svgResize.bind(this);
	window.addEventListener('resize',this.svgResize);
	this.svgResize();

	Doodles.Events.call(this,svg,window);

	// hack to get focus to pointer...
	this.controlKey = Doodles.CoverBody.prototype.controlKey.bind(this);
};

Doodles.CoverBody.prototype =
{
	__proto__: Doodles.Events.prototype,
	controlKey: function(event) {
		Doodles.Events.prototype.controlKey.call(this,event);
		if (this.dom.enabled)
			this.pointer.underneath().focus(); },
	svgResize: function() {
		this.svg.style.width = 0; this.svg.style.height = 0;
		this.svg.style.width = this.body.scrollWidth;
		this.svg.style.height = this.body.scrollHeight; },
	constructor: Doodles.CoverBody,
	destroy: function() {
		Doodles.Events.prototype.destroy.call(this);
		this.window.removeEventListener('resize',this.svgResize);
		this.body.removeChild(this.svg);
		delete this.body;
		delete this.window;
		delete this.svg;
		delete this.svgResize; }
};

Doodles.Extension = function(body,window)
{
	Doodles.CoverBody.call(this,body,window);

	this.port = chrome.extension.connect();

	this.destroy = Doodles.Extension.prototype.destroy.bind(this);
	this.port.onDisconnect.addListener(this.destroy);

	this.receive = Doodles.Extension.prototype.receive.bind(this);
	this.port.onMessage.addListener(this.receive);
};

Doodles.Extension.prototype =
{
	__proto__: Doodles.CoverBody.prototype,
	toggle: function() {
		this.port.postMessage('toggle'); },
	receive: function(message) {
		switch (message) {
		case 'attach': this.attach(); break;
		case 'detach': this.detach(); break; } },
	constructor: Doodles.Extension,
	destroy: function() {
		this.port.disconnect(); // surprisingly does not call onDisconnect
		Doodles.CoverBody.prototype.destroy.call(this);
		delete this.port;
		delete this.destroy;
		delete this.receive; }
};

if (document.body && document.body.nodeName != 'FRAMESET')
	window.doodledoku = new Doodles.Extension(document.body,window);

'OK';

