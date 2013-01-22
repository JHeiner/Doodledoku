
var listeners = [];
var originalOn = Doodles.on;
var originalOff = Doodles.off;
Doodles.on = function(element,event,action) {
	listeners.push([element,event,action]);
	originalOn(element,event,action); }
Doodles.off = function(element,event,action) {
	for (var i = listeners.length - 1 ; i >= 0 ; --i ) {
		var entry = listeners[i];
		if (entry[0] == element && entry[1] == event && entry[2] == action) {
			listeners.splice(i,1); i = -1; } }
	originalOff(element,event,action); }

var cover = null;
var event = {
	clientX:0,clientY:0,pageX:0,pageY:0,which:0,button:0,ctrlKey:false };
function mouse(down,hold) {
	event.which = (down?1:0);
	if (cover&&!hold)
		(down?cover.events.downMouse:cover.events.upMouse)(event); }
function click(hold) {
	mouse(1,hold); mouse(0,hold); }
function move(x,y,hold) {
	event.clientX = (event.pageX = x) - window.scrollX;
	event.clientY = (event.pageY = y) - window.scrollY;
	if (cover&&!hold)
		cover.events.moveMouse(event); }
function drag() {
	mouse(1);
	for (i = 0 ; i < arguments.length ; i += 2)
		move(arguments[i],arguments[i+1]);
	mouse(0); }
function ctrl(down,hold) {
	event.ctrlKey = (down?true:false);
	if (cover&&!hold)
		cover.events.ctrlKey(event); }
function erase(x1,y1,x2,y2) {
	ctrl(1); move(x1,y1); drag(x2,y2); ctrl(0); }

function nseq(list,into) {
	if (!into) into = [];
	if (list) for (var i = 0 ; i < list.length ; ++ i ) {
		into[i] = ndom(list.item(i)); }
	return into; }
function nmap(amap,into) {
	if (!into) into = {};
	if (amap) for (var i = 0 ; i < amap.length ; ++ i ) {
		var a = amap.item(i); var n = a.name;
		if (/[^0-9]/.test(n)) into[n] = a.value;
		else throw new Error("numeric attribute: "+n); }
	return into; }
function ndom(node) {
	if (node.nodeType != Node.ELEMENT_NODE)
		throw new Error("unexpected node type ("+node.nodeType+") "+node);
	var result = {};
	result[node.nodeName] = nseq(node.childNodes,nmap(node.attributes));
	return result; }
function drawn(expected) {
	var evaluated = eval('['+expected+']');
	if (!expected) expected = "should be zero shapes";
	else expected = "shapes should be: ["+expected+"]";
	deepEqual(nseq(cover.doodles),evaluated,expected); }
function dot(x,y) {
	return {polygon:{points:(x+' '+y)}}; }
function line() {
	return {polyline:{points:Array.prototype.join.call(arguments,' ')}}; }
function clear() {
	// cover.dom.shapes.svg.innerHTML = ''; // doesn't work for svg !
	for ( var i = cover.doodles.length - 1 ; i >= 0 ; -- i )
		cover.doodles[i].remove();
	drawn(''); }

var lifecycle = {
	setup: function() {
		cover = new Doodles.CoverBody(document.body,window);
		cover.color.normal = '#af8';
		cover.width.draw = 5;
		cover.dom.enable(); },
	teardown: function() {
		if (cover) { cover.destroy(); cover = null; }
		if (listeners.length) listeners = [];
		event.clientX = event.clientY = event.pageX = event.pageY = 0;
		event.which = 0; event.ctrlKey = false; } };

module("destroy restores everything");
test("CoverBody",3,function(){
	var before = document.documentElement.innerHTML;
	lifecycle.setup();
	cover.events.attach();
	equal(listeners.length,6,"should have 6 listeners");
	cover.destroy(); cover = null;
	deepEqual(listeners,[],"should have zero listeners");
	var after = document.documentElement.innerHTML;
	equal(after,before,"document should be restored to original");
	lifecycle.teardown(); });
test("CoverBlock",3,function(){
	var before = document.documentElement.innerHTML;
	cover = new Doodles.CoverBlock(window.qunit,window);
	cover.events.attach();
	equal(listeners.length,5,"should have 5 listeners");
	cover.destroy(); cover = null;
	deepEqual(listeners,[],"should have zero listeners");
	var after = document.documentElement.innerHTML;
	equal(after,before,"document should be restored to original");
	lifecycle.teardown(); });

module("basic doodling",lifecycle);
test("dot",1,function(){
	move(10,20);click(); drawn('dot(10,20)'); });
test("line",1,function(){
	move(20,10);drag(40,40,50,20); drawn('line(20,10,40,40,50,20)'); });
test("both (dot,line)",1,function(){
	move(10,20);click(); move(20,10);drag(40,40);
	drawn('dot(10,20),line(20,10,40,40)'); });
test("both (line,dot)",1,function(){
	move(20,10);drag(40,40); move(10,20);click();
	drawn('line(20,10,40,40),dot(10,20)'); });

module("basic erasing",lifecycle);
test("right over dot",1,function(){
	move(20,20);click(); click(); drawn(''); });
test("very near dot",1,function(){
	move(20,20);click(); move(21,19);click(); drawn(''); });
test("smudge near dot",1,function(){
	move(20,20);click(); move(21,19);drag(19,21); drawn(''); });
test("still near dot",2,function(){
	// see "far from dot" below...
	move(20,20);click(); move(20,23);click(); drawn('');
	move(20,20);click(); move(22,22);click(); drawn(''); });
test("along line",3,function() {
	move(10,10);drag(20,20); move(10,10);click(); drawn('');
	move(10,10);drag(20,20); move(15,15);click(); drawn('');
	move(10,10);drag(20,20); move(20,20);click(); drawn(''); });
test("near line",2,function(){
	move(10,10);drag(20,20); move(16,14);click(); drawn('');
	move(10,10);drag(20,20); move(16,14);drag(15,11); drawn(''); });

module("advanced erasing",lifecycle);
test("at intersection of shapes",function(){
	move(15,15);click();
	move(10,10);drag(20,20); move(10,20);drag(20,10);
	move(15,10);drag(15,20); move(10,15);drag(20,15);
	move(15,15);click(); drawn(''); });
test("within area",5,function(){
	move(10,10);click(); move(10,15);drag(10,20,20,20,20,10,20,15);
	equal(cover.doodles.length,2,"should be 2 shapes");
	erase(5,5,25,25); drawn('');
	move(15,15);click();
	move(10,10);click(); move(10,20);click();
	move(20,10);click(); move(20,20);click();
	erase(8,22,22,8); drawn('dot(10,10),dot(10,20),dot(20,10),dot(20,20)');
	move(15,15);click();
	cover.width.pick = 1;
	erase(9,9,21,11); drawn('dot(10,20),dot(20,20),dot(15,15)');
	move(10,10);click(); move(20,10);click();
	erase(21,11,9,21); drawn('dot(10,10),dot(20,10)'); });

module("not quite erasing",lifecycle);
test("far from dot",1,function(){
	// at default pick width (8) this is just past the edge...
	move(20,20);click(); move(20,24);click();
	drawn('dot(20,20),dot(20,24)'); });
test("3pt smudge",1,function(){
	move(20,20);click(); move(21,19);drag(19,21,20,20);
	drawn('dot(20,20),line(21,19,19,21,20,20)'); });

module("pick width",lifecycle);
test("around edge 9",12,function(){
	cover.width.pick = 9; // continuing from "far from dot"
	move(20,20);click(); move(20,25);click(); drawn('dot(20,20),dot(20,25)');
	clear(); move(20,20);click(); move(20,24);click(); drawn('');
	move(20,20);click(); move(25,20);click(); drawn('dot(20,20),dot(25,20)');
	clear(); move(20,20);click(); move(24,20);click(); drawn('');
	move(20,20);click(); move(20,15);click(); drawn('dot(20,20),dot(20,15)');
	clear(); move(20,20);click(); move(20,16);click(); drawn('');
	move(20,20);click(); move(15,20);click(); drawn('dot(20,20),dot(15,20)');
	clear(); move(20,20);click(); move(16,20);click(); drawn(''); });
test("around edge 21",12,function(){
	cover.width.pick = 21;
	move(20,20);click(); move(20,31);click(); drawn('dot(20,20),dot(20,31)');
	clear(); move(20,20);click(); move(20,30);click(); drawn('');
	move(20,20);click(); move(31,20);click(); drawn('dot(20,20),dot(31,20)');
	clear(); move(20,20);click(); move(30,20);click(); drawn('');
	move(20,20);click(); move(20, 9);click(); drawn('dot(20,20),dot(20, 9)');
	clear(); move(20,20);click(); move(20,10);click(); drawn('');
	move(20,20);click(); move( 9,20);click(); drawn('dot(20,20),dot( 9,20)');
	clear(); move(20,20);click(); move(10,20);click(); drawn(''); });
