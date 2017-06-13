

function close() {
	if (document.getElementById('forgot').checked) {		
		chrome.extension.sendRequest({reqtype: "not-show"}, function(extensions) {});
	}
	chrome.extension.sendRequest({reqtype: "close"}, function(extensions) {});
}

function onShow() {
	if (document.getElementById('forgot').checked) {
		document.getElementById('forgot').checked = false;
	} else {
		document.getElementById('forgot').checked = true;
	}
}

function init() {
  getErrorExtensions();
  document.getElementById("close").addEventListener("click", close , false);
  document.getElementById("footer").addEventListener("click", onShow , false);  
}

function windowResize() {
	var zoom = window.devicePixelRatio;
	var width = document.querySelector(".main").offsetWidth * zoom + 16;
	var height = document.querySelector(".container").offsetHeight * zoom + 38;
	window.resizeTo(width,height);
}

function removeExtension(elem) {
    var ext_id = elem.path[0].id;
    chrome.extension.sendRequest({reqtype: "remove-extensions", ext_id: ext_id}, function(extensions) {});
    elem.path[1].outerHTML = "";
    windowResize();
}

function getErrorExtensions() {
	chrome.extension.sendRequest({reqtype: "get-extensions"}, function(extensions) {
	  	var div = document.querySelector('#extensions'); 
	  	var text = '<div class="extension-item">{NAME}</div><i class="alert-del-extension">Отключить</i><i class="alert-deleted-extension">Отключено</i>';
	  	extensions = extensions.extensions;
	  	for (var elem in extensions) {
	        var new_elem = document.createElement("div");
	        new_elem.className = "extension-container";
	        //new_elem.innerHTML = text.replace('{NAME}', elem);
	        var new_elem1 = document.createElement("div");
	        new_elem1.className = "extension-item";
	        new_elem1.innerHTML = extensions[elem];
          	new_elem1.title = extensions[elem];
	        var new_i = document.createElement("i");
	        new_i.className = "alert-del-extension";
	        new_i.setAttribute("id", elem);
	        new_i.innerHTML = "Отключить";
	        new_elem.appendChild(new_elem1);
	        new_elem.appendChild(new_i);
	        div.appendChild(new_elem);
	  	};
	});
	setTimeout( function() {	
		var elems = document.querySelectorAll(".alert-del-extension");	
	  	for (var i = 0; i < elems.length; i++) {
	      	elems[i].addEventListener("click", removeExtension, false);
	  	};
	}, 1000);
  	setTimeout(windowResize, 1000);
}


window.addEventListener("DOMContentLoaded", init, false);
window.onresize = function(){
  windowResize();
}

setTimeout(windowResize, 1);