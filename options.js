
var orderedList;
function createItem(key,value,open) {
	var item = document.createElement("li");
	var details = document.createElement("details");
	if (open) details.open = true;
	item.appendChild(details);
	var summary = document.createElement("summary");
	details.appendChild(summary);
	var input = document.createElement("input");
	input.type = "text";
	input.title = "RegExp to match against documentURI";
	input.style.width = "90%";
	input.value = key;
	summary.appendChild(input);
	var textarea = document.createElement("textarea");
	textarea.title = "Javascript to exec if RegExp matches";
	textarea.style.marginLeft = "10%";
	textarea.style.width = "80%";
	textarea.value = value;
	details.appendChild(textarea);
	orderedList.appendChild(item); }

window.onload = function (event) {

orderedList = document.createElement("ol");

var addItem = document.createElement("button");
addItem.style.fontSize = "xx-large";
addItem.innerHTML = "+";
addItem.addEventListener("click",function (event) {
	createItem("^https?://","",true); });

var keys = [];
for ( var i = localStorage.length-1 ; i >= 0 ; --i ) {
	var key = localStorage.key(i);
	var match = /(\d+)=(.*)/.exec(key);
	if (!match) console.warn("broken key: "+key);
	else keys[Number(match[1])] = match[2]; }
keys.forEach(function (key) {
	createItem(key,localStorage.getItem(key),false); });

document.body.replaceChild(orderedList,document.getElementById("loading"));
document.body.appendChild(addItem);

}

